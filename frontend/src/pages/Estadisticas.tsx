import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts'
import { supabase } from '../lib/supabase'
import { globalToast } from '../components/Layout'
import { TrendingUp, TrendingDown, Users, Package, CheckCircle, Clock } from 'lucide-react'

const COLORS = ['#E8670A','#2563eb','#16a34a','#dc2626','#7c3aed','#ca8a04','#0891b2','#db2777']
const MESES_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export default function Estadisticas() {
  const [loading, setLoading] = useState(true)
  const [anio] = useState(new Date().getFullYear())
  const [kpis, setKpis] = useState({ ventas: 0, cobrado: 0, pendiente: 0, gastos: 0, beneficio: 0, clientes: 0, productos: 0, facturas: 0 })
  const [ventasMes, setVentasMes] = useState<any[]>([])
  const [topClientes, setTopClientes] = useState<any[]>([])
  const [topProductos, setTopProductos] = useState<any[]>([])
  const [ticketMedio, setTicketMedio] = useState<any[]>([])
  const [gastosCat, setGastosCat] = useState<any[]>([])
  const [cobrosEstado, setCobrosEstado] = useState<any[]>([])
  const [pendientePago, setPendientePago] = useState(0)
  const [pendienteCobro, setPendienteCobro] = useState(0)
  const [tabActiva, setTabActiva] = useState('resumen')
  const [gastosList, setGastosList] = useState<any[]>([])
  const [editandoGasto, setEditandoGasto] = useState<any>(null)
  const [formGasto, setFormGasto] = useState({ concepto: '', categoria: 'General', importe: 0, fecha: '' })

  useEffect(() => {
    async function load() {
      setLoading(true)
      const fechaInicio = `${anio}-01-01`

      const [pedidos, facturas, gastos, clientes, productos] = await Promise.all([
        supabase.from('pedidos').select('cliente_id, producto_id, cantidad, precio, iva, clientes(nombre), productos(nombre)').gte('fecha', fechaInicio),
        supabase.from('facturas').select('total, mes, tipo_pago, pagado, iva_total, base').gte('fecha', fechaInicio),
        supabase.from('gastos').select('importe, categoria, fecha').gte('fecha', fechaInicio),
        supabase.from('clientes').select('id', { count: 'exact', head: true }),
        supabase.from('productos').select('id', { count: 'exact', head: true }),
      ])

      const allFacturas = facturas.data || []
      const allGastos = gastos.data || []
      const allPedidos = pedidos.data || []

      const totalVentas = allFacturas.reduce((s, f) => s + Number(f.total), 0)
      const totalCobrado = allFacturas.filter(f => f.pagado).reduce((s, f) => s + Number(f.total), 0)
      const totalPendiente = totalVentas - totalCobrado
      const totalGastos = allGastos.reduce((s, g) => s + Number(g.importe), 0)
      const totalGastosProv = allGastos.filter(g => g.categoria === 'Proveedor').reduce((s, g) => s + Number(g.importe), 0)
      const totalPendCobro = allFacturas.filter(f => !f.pagado).reduce((s, f) => s + Number(f.total), 0)
      setPendientePago(totalGastosProv)
      setPendienteCobro(totalPendCobro)

      setKpis({
        ventas: totalVentas,
        cobrado: totalCobrado,
        pendiente: totalPendiente,
        gastos: totalGastos,
        beneficio: totalCobrado - totalGastos,
        clientes: clientes.count || 0,
        productos: productos.count || 0,
        facturas: allFacturas.length,
      })

      const mesesData = MESES_SHORT.map((mes, i) => {
        const mesStr = String(i + 1).padStart(2, '0')
        const fMes = allFacturas.filter(f => f.mes?.endsWith(mesStr) || f.mes?.includes(`-${mesStr}`))
        const gMes = allGastos.filter(g => g.fecha?.slice(5, 7) === mesStr)
        const ventas = fMes.reduce((s, f) => s + Number(f.total), 0)
        const cobrado = fMes.filter(f => f.pagado).reduce((s, f) => s + Number(f.total), 0)
        const gastosMes = gMes.reduce((s, g) => s + Number(g.importe), 0)
        return {
          mes,
          ventas: parseFloat(ventas.toFixed(2)),
          cobrado: parseFloat(cobrado.toFixed(2)),
          gastos: parseFloat(gastosMes.toFixed(2)),
          beneficio: parseFloat((cobrado - gastosMes).toFixed(2)),
        }
      })
      setVentasMes(mesesData)

      const byCliente: Record<string, any> = {}
      allPedidos.forEach(p => {
        const id = p.cliente_id
        const nombre = (p as any).clientes?.nombre || 'Sin nombre'
        if (!byCliente[id]) byCliente[id] = { nombre, total: 0, unidades: 0 }
        byCliente[id].total += Number(p.cantidad) * Number(p.precio) * (1 + Number(p.iva) / 100)
        byCliente[id].unidades += Number(p.cantidad)
      })
      setTopClientes(Object.values(byCliente).sort((a, b) => b.total - a.total).slice(0, 10).map(c => ({ ...c, total: parseFloat(c.total.toFixed(2)) })))

      // Ticket medio por cliente (total / meses activos)
      const ticketData = Object.values(byCliente).map((c: any) => {
        const mesesActivos = new Set(allPedidos.filter((p: any) => p.cliente_id === Object.keys(byCliente).find(k => byCliente[k] === c)).map((p: any) => p.fecha?.slice(0, 7))).size || 1
        return {
          nombre: c.nombre,
          total: parseFloat(c.total.toFixed(2)),
          unidades: c.unidades,
          ticketMedio: parseFloat((c.total / mesesActivos).toFixed(2)),
          meses: mesesActivos
        }
      }).sort((a: any, b: any) => b.ticketMedio - a.ticketMedio).slice(0, 10)
      setTicketMedio(ticketData)

      const byProd: Record<string, any> = {}
      allPedidos.forEach(p => {
        const nombre = (p as any).productos?.nombre || 'Sin nombre'
        if (!byProd[nombre]) byProd[nombre] = { nombre, unidades: 0, total: 0 }
        byProd[nombre].unidades += Number(p.cantidad)
        byProd[nombre].total += Number(p.cantidad) * Number(p.precio) * (1 + Number(p.iva) / 100)
      })
      setTopProductos(Object.values(byProd).sort((a, b) => b.unidades - a.unidades).slice(0, 10))

      const byCat: Record<string, number> = {}
      allGastos.forEach(g => { byCat[g.categoria] = (byCat[g.categoria] || 0) + Number(g.importe) })
      setGastosCat(Object.entries(byCat).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) })))

      const cobradoPorTipo: Record<string, any> = {}
      allFacturas.forEach(f => {
        const tipo = f.tipo_pago || 'Efectivo'
        if (!cobradoPorTipo[tipo]) cobradoPorTipo[tipo] = { tipo, cobrado: 0, pendiente: 0 }
        if (f.pagado) cobradoPorTipo[tipo].cobrado += Number(f.total)
        else cobradoPorTipo[tipo].pendiente += Number(f.total)
      })
      setCobrosEstado(Object.values(cobradoPorTipo))

      const { data: gastosDetalle } = await supabase
        .from('gastos').select('*').gte('fecha', fechaInicio).order('fecha', { ascending: false })
      setGastosList(gastosDetalle || [])

      setLoading(false)
    }
    load()
  }, [anio])

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <div style={{ fontFamily: 'Fredoka One', fontSize: '1.4rem', color: 'var(--naranja)' }}>📊 Cargando estadísticas...</div>
    </div>
  )

  const pctCobrado = kpis.ventas > 0 ? (kpis.cobrado / kpis.ventas * 100).toFixed(1) : '0'

  const tabs = [
    { id: 'resumen', label: '📊 Resumen' },
    { id: 'ventas', label: '📈 Ventas/Gastos' },
    { id: 'clientes', label: '👥 Clientes' },
    { id: 'productos', label: '📦 Productos' },
    { id: 'cobros', label: '💰 Cobros' },
    { id: 'gastos_detalle', label: '✏️ Editar Gastos' },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">📊 Estadísticas {anio}</h1>
        <button className="btn btn-secondary" onClick={() => window.print()}>🖨️ Exportar PDF</button>
      </div>

      <div className="tabs">
        {tabs.map(t => (
          <div key={t.id} className={`tab ${tabActiva === t.id ? 'active' : ''}`} onClick={() => setTabActiva(t.id)}>{t.label}</div>
        ))}
      </div>

      {/* RESUMEN */}
      {tabActiva === 'resumen' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Ventas Totales', value: `${kpis.ventas.toFixed(2)} €`, icon: TrendingUp, color: '#E8670A', bg: '#fff3e8' },
              { label: 'Cobrado', value: `${kpis.cobrado.toFixed(2)} €`, icon: CheckCircle, color: '#16a34a', bg: '#f0fdf4' },
              { label: 'Pendiente cobro', value: `${kpis.pendiente.toFixed(2)} €`, icon: Clock, color: '#dc2626', bg: '#fef2f2' },
              { label: 'Gastos', value: `${kpis.gastos.toFixed(2)} €`, icon: TrendingDown, color: '#7c3aed', bg: '#f5f3ff' },
              { label: 'Beneficio neto', value: `${kpis.beneficio.toFixed(2)} €`, icon: kpis.beneficio >= 0 ? TrendingUp : TrendingDown, color: kpis.beneficio >= 0 ? '#16a34a' : '#dc2626', bg: kpis.beneficio >= 0 ? '#f0fdf4' : '#fef2f2' },
              { label: 'Clientes activos', value: kpis.clientes, icon: Users, color: '#2563eb', bg: '#eff6ff' },
              { label: 'Productos', value: kpis.productos, icon: Package, color: '#ca8a04', bg: '#fefce8' },
              { label: 'Facturas', value: kpis.facturas, icon: CheckCircle, color: '#0891b2', bg: '#f0f9ff' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-icon" style={{ background: s.bg }}><s.icon size={20} color={s.color} /></div>
                <div>
                  <div className="stat-value" style={{ color: s.color, fontSize: '1.2rem' }}>{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 800 }}>💰 Porcentaje cobrado: <strong style={{ color: '#16a34a' }}>{pctCobrado}%</strong></span>
              <span style={{ fontSize: '0.85rem', color: 'var(--gris)' }}>{kpis.cobrado.toFixed(2)} € de {kpis.ventas.toFixed(2)} €</span>
            </div>
            <div style={{ height: 16, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pctCobrado}%`, background: 'linear-gradient(90deg, #16a34a, #22c55e)', borderRadius: 99 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.75rem', color: 'var(--gris)' }}>
              <span style={{ color: '#16a34a', fontWeight: 800 }}>✅ Cobrado</span>
              <span style={{ color: '#dc2626', fontWeight: 800 }}>⏳ Pendiente: {kpis.pendiente.toFixed(2)} €</span>
            </div>
          </div>
          <div className="card">
            <h3 style={{ fontFamily: 'Fredoka One', color: 'var(--marron)', marginBottom: 14 }}>📈 Resumen mensual</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={ventasMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5e8d8" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: any) => `${v} €`} />
                <Bar dataKey="cobrado" fill="#16a34a" name="Cobrado" radius={[3,3,0,0]} />
                <Bar dataKey="gastos" fill="#dc2626" name="Gastos" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* VENTAS/GASTOS */}
      {tabActiva === 'ventas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <h3 style={{ fontFamily: 'Fredoka One', color: 'var(--marron)', marginBottom: 14 }}>📈 Ventas vs Gastos vs Beneficio por mes</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={ventasMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5e8d8" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => `${v} €`} />
                <Legend />
                <Bar dataKey="ventas" fill="#E8670A" name="Ventas" radius={[4,4,0,0]} />
                <Bar dataKey="cobrado" fill="#16a34a" name="Cobrado" radius={[4,4,0,0]} />
                <Bar dataKey="gastos" fill="#dc2626" name="Gastos" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <h3 style={{ fontFamily: 'Fredoka One', color: 'var(--marron)', marginBottom: 14 }}>💹 Evolución del beneficio</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={ventasMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5e8d8" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: any) => `${v} €`} />
                <Line type="monotone" dataKey="beneficio" stroke="#E8670A" strokeWidth={3} dot={{ fill: '#E8670A', r: 4 }} name="Beneficio" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {gastosCat.length > 0 && (
            <div className="card">
              <h3 style={{ fontFamily: 'Fredoka One', color: 'var(--marron)', marginBottom: 14 }}>💸 Gastos por categoría</h3>
              <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie data={gastosCat} cx={85} cy={85} innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                      {gastosCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => `${v} €`} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1 }}>
                  {gastosCat.map((g, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 3, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 700 }}>{g.name}</span>
                      <span style={{ fontWeight: 800, color: '#dc2626' }}>{g.value} €</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CLIENTES */}
      {tabActiva === 'clientes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <h3 style={{ fontFamily: 'Fredoka One', color: 'var(--marron)', marginBottom: 14 }}>🥇 Top 10 clientes por facturación</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topClientes} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f5e8d8" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${v}€`} />
                <YAxis type="category" dataKey="nombre" width={160} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: any) => `${v} €`} />
                <Bar dataKey="total" fill="#E8670A" radius={[0,4,4,0]} name="Facturación" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f5e8d8', fontFamily: 'Fredoka One', color: 'var(--marron)' }}>Ranking completo</div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>#</th><th>Cliente</th><th>Unidades</th><th>Facturado</th></tr></thead>
                <tbody>
                  {topClientes.map((c, i) => (
                    <tr key={i}>
                      <td><strong style={{ color: i < 3 ? 'var(--naranja)' : 'var(--gris)', fontFamily: 'Fredoka One' }}>{i + 1}</strong></td>
                      <td><strong>{c.nombre}</strong></td>
                      <td>{c.unidades} ud</td>
                      <td><strong style={{ color: '#16a34a' }}>{c.total.toFixed(2)} €</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* TICKET MEDIO POR CLIENTE */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f5e8d8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'Fredoka One', color: 'var(--marron)' }}>🎫 Ticket medio mensual por cliente</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--gris)' }}>Gasto medio por mes activo</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>#</th><th>Cliente</th><th>Meses activo</th><th>Total año</th><th>Ticket medio/mes</th></tr>
                </thead>
                <tbody>
                  {ticketMedio.map((c: any, i: number) => (
                    <tr key={i}>
                      <td><strong style={{ color: i < 3 ? 'var(--naranja)' : 'var(--gris)', fontFamily: 'Fredoka One' }}>{i + 1}</strong></td>
                      <td><strong>{c.nombre}</strong></td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-blue">{c.meses} mes{c.meses !== 1 ? 'es' : ''}</span>
                      </td>
                      <td><span style={{ color: 'var(--naranja)', fontWeight: 700 }}>{c.total.toFixed(2)} €</span></td>
                      <td>
                        <span style={{ fontFamily: 'Fredoka One', fontSize: '1rem', color: i === 0 ? '#16a34a' : 'var(--marron)' }}>
                          {c.ticketMedio.toFixed(2)} €
                        </span>
                        {i === 0 && <span style={{ fontSize: '0.7rem', color: '#16a34a', marginLeft: 4 }}>⭐ Mayor</span>}
                      </td>
                    </tr>
                  ))}
                  {ticketMedio.length === 0 && (
                    <tr><td colSpan={5}><div className="empty-state"><p>Sin datos suficientes</p></div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PRODUCTOS */}
      {tabActiva === 'productos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <h3 style={{ fontFamily: 'Fredoka One', color: 'var(--marron)', marginBottom: 14 }}>📦 Top 10 productos más vendidos</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProductos} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f5e8d8" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="nombre" width={140} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="unidades" fill="#2563eb" radius={[0,4,4,0]} name="Unidades" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f5e8d8', fontFamily: 'Fredoka One', color: 'var(--marron)' }}>Ranking productos</div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>#</th><th>Producto</th><th>Unidades</th><th>Ingresos</th></tr></thead>
                <tbody>
                  {topProductos.map((p, i) => (
                    <tr key={i}>
                      <td><strong style={{ color: i < 3 ? 'var(--naranja)' : 'var(--gris)', fontFamily: 'Fredoka One' }}>{i + 1}</strong></td>
                      <td><strong>{p.nombre}</strong></td>
                      <td><span className="badge badge-blue">{p.unidades} ud</span></td>
                      <td><strong style={{ color: '#16a34a' }}>{p.total.toFixed(2)} €</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* COBROS */}
      {tabActiva === 'cobros' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
            {[
              { label: '✅ Total cobrado', value: `${kpis.cobrado.toFixed(2)} €`, color: '#16a34a', bg: '#f0fdf4' },
              { label: '⏳ Pendiente cobro', value: `${pendienteCobro.toFixed(2)} €`, color: '#dc2626', bg: '#fef2f2' },
              { label: '💸 Pendiente pago', value: `${pendientePago.toFixed(2)} €`, color: '#7c3aed', bg: '#f5f3ff' },
              { label: '📊 % Cobrado', value: `${pctCobrado}%`, color: '#E8670A', bg: '#fff3e8' },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: '14px', background: s.bg, textAlign: 'center' }}>
                <div style={{ fontFamily: 'Fredoka One', fontSize: '1.5rem', color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--gris)', textTransform: 'uppercase', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
          {cobrosEstado.length > 0 && (
            <div className="card">
              <h3 style={{ fontFamily: 'Fredoka One', color: 'var(--marron)', marginBottom: 14 }}>💳 Cobros por forma de pago</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={cobrosEstado}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5e8d8" />
                  <XAxis dataKey="tipo" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: any) => `${v.toFixed(2)} €`} />
                  <Legend />
                  <Bar dataKey="cobrado" fill="#16a34a" name="Cobrado" radius={[4,4,0,0]} />
                  <Bar dataKey="pendiente" fill="#fca5a5" name="Pendiente" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f5e8d8', fontFamily: 'Fredoka One', color: 'var(--marron)' }}>
              Desglose por forma de pago
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Forma de pago</th><th>Cobrado</th><th>Pendiente</th><th>% Cobrado</th></tr></thead>
                <tbody>
                  {cobrosEstado.map((c, i) => {
                    const total = c.cobrado + c.pendiente
                    const pct = total > 0 ? (c.cobrado / total * 100).toFixed(0) : '0'
                    return (
                      <tr key={i}>
                        <td><strong>{c.tipo}</strong></td>
                        <td><span style={{ color: '#16a34a', fontWeight: 800 }}>{c.cobrado.toFixed(2)} €</span></td>
                        <td><span style={{ color: '#dc2626', fontWeight: 800 }}>{c.pendiente.toFixed(2)} €</span></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 8, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: '#16a34a', borderRadius: 99 }} />
                            </div>
                            <span style={{ fontWeight: 800, fontSize: '0.8rem' }}>{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f5e8d8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'Fredoka One', color: 'var(--marron)' }}>📋 Gestión de facturas</span>
              <span onClick={() => window.location.href = '/facturas'}
                style={{ color: 'var(--naranja)', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}>
                Ir a Facturas →
              </span>
            </div>
            <div style={{ padding: '12px 16px', fontSize: '0.85rem', color: 'var(--gris)' }}>
              Para editar o eliminar facturas ve a <strong>Facturas</strong> o <strong>Cobros</strong>.
            </div>
          </div>
          <div className="card" style={{ marginTop: 8 }}>
            <h3 style={{ fontFamily: 'Fredoka One', color: 'var(--marron)', marginBottom: 14 }}>💸 Gastos pendientes de pago (Proveedores)</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: '#f5f3ff', borderRadius: 10 }}>
              <div>
                <div style={{ fontFamily: 'Fredoka One', fontSize: '1.4rem', color: '#7c3aed' }}>{pendientePago.toFixed(2)} €</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--gris)', marginTop: 4 }}>Total registrado en gastos de proveedores este año</div>
              </div>
              <span onClick={() => window.location.href = '/gastos'}
                style={{ color: '#7c3aed', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}>
                Ver gastos →
              </span>
            </div>
          </div>
        </div>
      )}

      {/* EDITAR GASTOS */}
      {tabActiva === 'gastos_detalle' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontFamily: 'Fredoka One', color: 'var(--marron)' }}>✏️ Gestión de Gastos</h3>
            <div style={{ fontFamily: 'Fredoka One', fontSize: '1.1rem', color: '#dc2626' }}>
              Total: {gastosList.reduce((s, g) => s + Number(g.importe), 0).toFixed(2)} €
            </div>
          </div>
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Importe</th><th></th></tr>
                </thead>
                <tbody>
                  {gastosList.map((g, i) => (
                    <tr key={g.id || i}>
                      <td style={{ fontSize: '0.82rem' }}>{g.fecha}</td>
                      <td><strong>{g.concepto}</strong></td>
                      <td><span className="badge badge-gray">{g.categoria}</span></td>
                      <td><strong style={{ color: '#dc2626' }}>{Number(g.importe).toFixed(2)} €</strong></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-secondary btn-sm btn-icon"
                            onClick={() => { setEditandoGasto(g); setFormGasto({ concepto: g.concepto, categoria: g.categoria, importe: g.importe, fecha: g.fecha }) }}>
                            ✏️
                          </button>
                          <button className="btn btn-danger btn-sm btn-icon"
                            onClick={async () => {
                              if (!confirm('¿Eliminar este gasto?')) return
                              await supabase.from('gastos').delete().eq('id', g.id)
                              setGastosList(prev => prev.filter(x => x.id !== g.id))
                              globalToast('✅ Gasto eliminado')
                            }}>
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {gastosList.length === 0 && (
                    <tr><td colSpan={5}><div className="empty-state"><p>No hay gastos registrados</p></div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {editandoGasto && (
            <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditandoGasto(null)}>
              <div className="modal" style={{ maxWidth: 440 }}>
                <div className="modal-header">
                  <h3 className="modal-title">✏️ Editar Gasto</h3>
                  <button className="btn btn-secondary btn-icon" onClick={() => setEditandoGasto(null)}>✕</button>
                </div>
                <div className="modal-body">
                  <div className="input-group">
                    <label className="input-label">Concepto</label>
                    <input className="input" value={formGasto.concepto}
                      onChange={e => setFormGasto(f => ({ ...f, concepto: e.target.value }))} />
                  </div>
                  <div className="form-grid-2">
                    <div className="input-group">
                      <label className="input-label">Importe (€)</label>
                      <input className="input" type="number" step="0.01" value={formGasto.importe}
                        onChange={e => setFormGasto(f => ({ ...f, importe: parseFloat(e.target.value) || 0 }))} />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Fecha</label>
                      <input className="input" type="date" value={formGasto.fecha}
                        onChange={e => setFormGasto(f => ({ ...f, fecha: e.target.value }))} />
                    </div>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Categoría</label>
                    <select className="select" value={formGasto.categoria}
                      onChange={e => setFormGasto(f => ({ ...f, categoria: e.target.value }))}>
                      {['General','Proveedor','Transporte','Material','Personal','Otros'].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setEditandoGasto(null)}>Cancelar</button>
                  <button className="btn btn-primary" onClick={async () => {
                    await supabase.from('gastos').update(formGasto).eq('id', editandoGasto.id)
                    setGastosList(prev => prev.map(g => g.id === editandoGasto.id ? { ...g, ...formGasto } : g))
                    setEditandoGasto(null)
                    globalToast('✅ Gasto actualizado')
                  }}>💾 Guardar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}