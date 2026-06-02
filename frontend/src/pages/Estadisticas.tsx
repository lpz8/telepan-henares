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
  const [mesPDF, setMesPDF] = useState(String(new Date().getMonth()))
  const [mesProd, setMesProd] = useState(new Date().toISOString().slice(0,7))
  const [prodMes, setProdMes] = useState<any[]>([])
  const [kpis, setKpis] = useState({ ventas: 0, cobrado: 0, pendiente: 0, gastos: 0, beneficio: 0, clientes: 0, productos: 0, facturas: 0 })
  const [allGastosAnio, setAllGastosAnio] = useState<any[]>([])
  const [totalOtrosIngresos, setTotalOtrosIngresos] = useState(0)
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

  const MESES_NOMBRES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  const loadProdMes = async (mes: string) => {
    const { data } = await supabase
      .from('pedidos')
      .select('cantidad, precio, iva, productos(nombre)')
      .gte('fecha', `${mes}-01`)
      .lte('fecha', `${mes}-31`)
    const map: Record<string, { nombre: string, unidades: number, total: number, conIva: number }> = {}
    ;(data || []).forEach((p: any) => {
      const nombre = p.productos?.nombre || 'Sin nombre'
      if (!map[nombre]) map[nombre] = { nombre, unidades: 0, total: 0, conIva: 0 }
      const qty = Number(p.cantidad)
      const precio = Number(p.precio || 0)
      const iva = Number(p.iva || 4)
      map[nombre].unidades += qty
      map[nombre].total += qty * precio
      map[nombre].conIva += qty * precio * (1 + iva / 100)
    })
    setProdMes(Object.values(map).sort((a, b) => b.unidades - a.unidades))
  }

  useEffect(() => { loadProdMes(mesProd) }, [mesProd])
  const [formGasto, setFormGasto] = useState({ concepto: '', categoria: 'General', importe: 0, fecha: '' })

  useEffect(() => {
    async function load() {
      setLoading(true)
      const fechaInicio = `${anio}-01-01`

      // Cargar pedidos con paginación para no perder ninguno
      let allPedidosRaw: any[] = []
      let page = 0
      while (true) {
        const { data: chunk } = await supabase.from('pedidos')
          .select('cliente_id, producto_id, cantidad, precio, iva, fecha, clientes(nombre), productos(nombre)')
          .gte('fecha', fechaInicio)
          .range(page * 1000, (page + 1) * 1000 - 1)
        if (!chunk || chunk.length === 0) break
        allPedidosRaw = allPedidosRaw.concat(chunk)
        if (chunk.length < 1000) break
        page++
      }

      const [facturas, gastos, clientes, productos] = await Promise.all([
        supabase.from('facturas').select('total, mes, tipo_pago, pagado, iva_total, base, cliente_id, fecha').gte('fecha', fechaInicio),
        supabase.from('gastos').select('importe, categoria, fecha').gte('fecha', fechaInicio),
        supabase.from('clientes').select('id', { count: 'exact', head: true }),
        supabase.from('productos').select('id', { count: 'exact', head: true }),
      ])
      const { data: otrosIngresos } = await supabase
        .from('otros_ingresos').select('importe, categoria, fecha').gte('fecha', fechaInicio)
      const pedidos = { data: allPedidosRaw }

      const allFacturas = facturas.data || []
      const allGastos = gastos.data || []
      const allPedidos = allPedidosRaw
      setAllGastosAnio(allGastos)
      setTotalOtrosIngresos((otrosIngresos || []).reduce((s, i) => s + Number(i.importe), 0))

      // Cargar precios de proveedores para calcular margen real
      const { data: provPrecios } = await supabase
        .from('precios_proveedor')
        .select('articulo, precio_cliente, precio_pvp')

      // Calcular coste total real basado en pedidos × precio_cliente del proveedor
      // precio_cliente = lo que te cobra el proveedor = tu COSTE
      let totalCosteProveedor = 0
      if (provPrecios && provPrecios.length > 0) {
        allPedidos.forEach((p: any) => {
          const nombre = (p as any).productos?.nombre || ''
          const art = provPrecios.find((a: any) => {
            const artNombre = (a.articulo || '').toLowerCase()
            const prodNombre = nombre.toLowerCase()
            return prodNombre.includes(artNombre) || artNombre.includes(prodNombre)
          })
          if (art) {
            totalCosteProveedor += Number(p.cantidad) * Number(art.precio_cliente || 0)
          }
        })
      }

      const totalOtrosIngresos = (otrosIngresos || []).reduce((s, i) => s + Number(i.importe), 0)
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
        gastos: totalCosteProveedor > 0 ? totalCosteProveedor + totalGastos : totalGastos,
        beneficio: totalCosteProveedor > 0
          ? totalCobrado + totalOtrosIngresos - totalCosteProveedor - totalGastos
          : totalCobrado + totalOtrosIngresos - totalGastos,
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
    { id: 'resultados', label: '💰 Resultados' },
    { id: 'ventas', label: '📈 Ventas/Gastos' },
    { id: 'clientes', label: '👥 Clientes' },
    { id: 'productos', label: '📦 Productos' },
    { id: 'cobros', label: '💰 Cobros' },
    { id: 'gastos_detalle', label: '✏️ Editar Gastos' },
  ]

  const generarInformePDF = async () => {
    const mesNum = String(parseInt(mesPDF) + 1).padStart(2,'0')
    const mesLabel = MESES_NOMBRES[parseInt(mesPDF)]
    const mesKey = `${anio}-${mesNum}`

    globalToast('⏳ Generando informe...')

    const [factsMes, pedMes, gastosMes, deudoresMes, otrosIngresosMes] = await Promise.all([
      supabase.from('facturas').select('*, clientes(nombre, forma_pago)').eq('mes', mesKey),
      supabase.from('pedidos').select('cantidad, precio, iva, productos(nombre)').gte('fecha', `${mesKey}-01`).lte('fecha', `${mesKey}-31`),
      supabase.from('gastos').select('concepto, categoria, importe, fecha, notas').gte('fecha', `${mesKey}-01`).lte('fecha', `${mesKey}-31`),
      supabase.from('facturas').select('total, clientes(nombre)').eq('mes', mesKey).eq('pagado', false),
      supabase.from('otros_ingresos').select('concepto, categoria, importe, fecha').gte('fecha', `${mesKey}-01`).lte('fecha', `${mesKey}-31`),
    ])

    const facts = factsMes.data || []
    const peds = pedMes.data || []
    const gasts = gastosMes.data || []
    const deud = deudoresMes.data || []
    const otrosIng = otrosIngresosMes.data || []

    const totalFact = facts.reduce((s,f) => s+Number(f.total),0)
    const totalCobrado = facts.filter(f=>f.pagado).reduce((s,f)=>s+Number(f.total),0)
    const totalPend = facts.filter(f=>!f.pagado).reduce((s,f)=>s+Number(f.total),0)
    const totalGastos = gasts.reduce((s,g)=>s+Number(g.importe),0)
    const totalOtrosIng = otrosIng.reduce((s,i)=>s+Number(i.importe),0)
    const totalEntradas = totalCobrado + totalOtrosIng
    const beneficio = totalEntradas - totalGastos
    const totalUnidades = peds.reduce((s,p)=>s+Number(p.cantidad),0)
    const margen = totalEntradas > 0 ? ((beneficio/totalEntradas)*100).toFixed(1) : '0'

    // Top productos
    const prodMap: Record<string,number> = {}
    peds.forEach((p:any) => { const n=p.productos?.nombre||'?'; prodMap[n]=(prodMap[n]||0)+Number(p.cantidad) })
    const topProds = Object.entries(prodMap).sort(([,a],[,b])=>b-a).slice(0,8)

    // Gastos por categoría
    const gastoCats: Record<string,number> = {}
    gasts.forEach((g:any) => { gastoCats[g.categoria]=(gastoCats[g.categoria]||0)+Number(g.importe) })

    // Deudores
    const deudMap: Record<string,number> = {}
    deud.forEach((f:any)=>{ const n=f.clientes?.nombre||'?'; deudMap[n]=(deudMap[n]||0)+Number(f.total) })

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Informe ${mesLabel} ${anio} — TelePan Henares</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;padding:36px 44px;color:#1a1a1a;font-size:12.5px;line-height:1.4}
      .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #E8670A;padding-bottom:16px;margin-bottom:20px}
      .logo-area h1{font-size:1.6rem;color:#E8670A;margin-bottom:2px}
      .logo-area .sub{color:#888;font-size:0.8rem}
      .fecha{text-align:right;color:#888;font-size:0.8rem}
      .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
      .kpi{border:1.5px solid #f5e8d8;border-radius:10px;padding:12px;text-align:center}
      .kpi-val{font-size:1.3rem;font-weight:900}
      .kpi-lbl{font-size:0.65rem;color:#888;text-transform:uppercase;font-weight:700;margin-top:3px}
      .kpi.naranja{background:#fff8f0}.kpi.naranja .kpi-val{color:#E8670A}
      .kpi.verde{background:#f0fdf4}.kpi.verde .kpi-val{color:#16a34a}
      .kpi.rojo{background:#fef2f2}.kpi.rojo .kpi-val{color:#dc2626}
      .kpi.azul{background:#eff6ff}.kpi.azul .kpi-val{color:#2563eb}
      .kpi.gris{background:#f9fafb}.kpi.gris .kpi-val{color:#555}
      h2{font-size:0.9rem;font-weight:900;color:#5a2d0c;border-bottom:2px solid #E8670A;padding-bottom:5px;margin:18px 0 10px;text-transform:uppercase;letter-spacing:0.05em}
      table{width:100%;border-collapse:collapse;font-size:0.8rem;margin-bottom:6px}
      th{background:#E8670A;color:white;padding:6px 9px;text-align:left;font-size:0.68rem;text-transform:uppercase;font-weight:800}
      td{padding:6px 9px;border-bottom:1px solid #f5e0c5;vertical-align:middle}
      tr:last-child td{border:none}
      tr:nth-child(even){background:#fffaf6}
      .resultado-box{background:#f0fdf4;border:2px solid #16a34a;border-radius:12px;padding:16px 20px;margin:20px 0}
      .resultado-box.rojo{background:#fef2f2;border-color:#dc2626}
      .resultado-row{display:flex;justify-content:space-between;padding:5px 0;font-size:0.85rem}
      .resultado-total{display:flex;justify-content:space-between;border-top:2px solid #16a34a;margin-top:8px;padding-top:8px;font-size:1.1rem;font-weight:900}
      .resultado-total.rojo{border-color:#dc2626}
      .badge-v{background:#f0fdf4;color:#16a34a;border-radius:4px;padding:2px 7px;font-weight:800;font-size:0.7rem}
      .badge-r{background:#fef2f2;color:#dc2626;border-radius:4px;padding:2px 7px;font-weight:800;font-size:0.7rem}
      .two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px}
      .footer{margin-top:24px;text-align:center;font-size:0.68rem;color:#bbb;border-top:1px solid #f5e0c5;padding-top:10px}
      @media print{body{padding:20px 28px}}
    </style></head><body>

    <div class="header">
      <div class="logo-area">
        <h1>📊 Informe Mensual</h1>
        <div class="sub">TelePan Henares · ${mesLabel} ${anio}</div>
      </div>
      <div class="fecha">Generado el ${new Date().toLocaleDateString('es-ES')}<br>
        <strong>${facts.length} facturas · ${totalUnidades} unidades</strong>
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpi-grid">
      <div class="kpi naranja"><div class="kpi-val">${totalFact.toFixed(2)} €</div><div class="kpi-lbl">📄 Facturado</div></div>
      <div class="kpi verde"><div class="kpi-val">${totalCobrado.toFixed(2)} €</div><div class="kpi-lbl">✅ Cobrado</div></div>
      <div class="kpi rojo"><div class="kpi-val">${totalPend.toFixed(2)} €</div><div class="kpi-lbl">⏳ Pendiente</div></div>
      <div class="kpi gris"><div class="kpi-val">${totalUnidades}</div><div class="kpi-lbl">🍞 Unidades</div></div>
      <div class="kpi rojo"><div class="kpi-val">${totalGastos.toFixed(2)} €</div><div class="kpi-lbl">💸 Gastos</div></div>
      <div class="kpi azul"><div class="kpi-val">${totalOtrosIng.toFixed(2)} €</div><div class="kpi-lbl">🎁 Otros ingresos</div></div>
      <div class="kpi ${beneficio>=0?'verde':'rojo'}"><div class="kpi-val">${beneficio>=0?'+':''}${beneficio.toFixed(2)} €</div><div class="kpi-lbl">${beneficio>=0?'✅':'❌'} Beneficio</div></div>
      <div class="kpi ${beneficio>=0?'verde':'rojo'}"><div class="kpi-val">${margen}%</div><div class="kpi-lbl">📊 Margen</div></div>
    </div>

    <!-- CUADRO DE RESULTADOS -->
    <h2>💰 Cuadro de resultados</h2>
    <div class="resultado-box ${beneficio<0?'rojo':''}">
      <div class="resultado-row"><span>📈 Ventas cobradas</span><span style="color:#16a34a;font-weight:700">+${totalCobrado.toFixed(2)} €</span></div>
      ${totalOtrosIng > 0 ? `<div class="resultado-row"><span>🎁 Otros ingresos</span><span style="color:#2563eb;font-weight:700">+${totalOtrosIng.toFixed(2)} €</span></div>` : ''}
      ${Object.entries(gastoCats).map(([cat,imp]) => `<div class="resultado-row"><span>${cat}</span><span style="color:#dc2626;font-weight:700">-${(imp as number).toFixed(2)} €</span></div>`).join('')}
      <div class="resultado-total ${beneficio<0?'rojo':''}">
        <span>${beneficio>=0?'✅ BENEFICIO NETO':'❌ PÉRDIDA NETA'}</span>
        <span style="color:${beneficio>=0?'#16a34a':'#dc2626'}">${beneficio>=0?'+':''}${beneficio.toFixed(2)} €</span>
      </div>
    </div>

    <div class="two-col">
      <!-- TOP PRODUCTOS -->
      ${topProds.length > 0 ? `
      <div>
        <h2>🍞 Top productos</h2>
        <table>
          <tr><th>Producto</th><th>Uds</th></tr>
          ${topProds.map(([n,u])=>`<tr><td>${n}</td><td><strong>${u}</strong></td></tr>`).join('')}
        </table>
      </div>` : '<div></div>'}

      <!-- GASTOS DETALLE -->
      ${gasts.length > 0 ? `
      <div>
        <h2>💸 Detalle gastos</h2>
        <table>
          <tr><th>Concepto</th><th>Cat.</th><th>Importe</th></tr>
          ${gasts.map(g=>`<tr><td>${g.concepto}</td><td style="font-size:0.7rem">${g.categoria}</td><td><strong>${Number(g.importe).toFixed(2)} €</strong></td></tr>`).join('')}
          <tr style="background:#fef2f2"><td colspan="2"><strong>TOTAL</strong></td><td><strong style="color:#dc2626">${totalGastos.toFixed(2)} €</strong></td></tr>
        </table>
      </div>` : '<div></div>'}
    </div>

    <!-- FACTURAS -->
    <h2>📄 Facturas del mes</h2>
    <table>
      <tr><th>Nº</th><th>Cliente</th><th>Forma pago</th><th>Total</th><th>Estado</th></tr>
      ${facts.map(f=>`<tr><td>${f.numero}</td><td>${(f as any).clientes?.nombre||'—'}</td><td>${f.tipo_pago}</td><td><strong>${Number(f.total).toFixed(2)} €</strong></td><td><span class="${f.pagado?'badge-v':'badge-r'}">${f.pagado?'✅ Cobrada':'⏳ Pendiente'}</span></td></tr>`).join('')}
    </table>

    ${Object.keys(deudMap).length > 0 ? `
    <h2>⚠️ Pendientes de cobro</h2>
    <table>
      <tr><th>Cliente</th><th>Importe</th></tr>
      ${Object.entries(deudMap).map(([n,t])=>`<tr><td>${n}</td><td><strong style="color:#dc2626">${(t as number).toFixed(2)} €</strong></td></tr>`).join('')}
    </table>` : '<p style="margin-top:12px;color:#16a34a;font-weight:700">✅ Todos los clientes han pagado este mes</p>'}

    <div class="footer">TelePan Henares · Informe ${mesLabel} ${anio} · ${new Date().toLocaleString('es-ES')}</div>
    </body></html>`

    const w = window.open('','_blank')
    if (!w) { globalToast('Permite las ventanas emergentes', 'error'); return }
    w.document.write(html)
    w.document.close()
    setTimeout(() => w.print(), 800)
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">📊 Estadísticas {anio}</h1>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <select className="select" style={{ width:'auto' }} value={mesPDF} onChange={e=>setMesPDF(e.target.value)}>
            {MESES_NOMBRES.map((m,i)=><option key={i} value={String(i)}>{m}</option>)}
          </select>
          <button className="btn btn-primary" onClick={generarInformePDF}>📄 Informe mensual PDF</button>
          <button className="btn btn-secondary" onClick={() => window.print()}>🖨️ Exportar PDF</button>
        </div>
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
      {/* TAB RESULTADOS — Cuadro de resultados real */}
      {tabActiva === 'resultados' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <h3 style={{ fontFamily: 'Fredoka One', color: 'var(--marron)', marginBottom: 16, fontSize: '1.1rem' }}>
              📊 Cuadro de resultados — {anio}
            </h3>

            {/* INGRESOS */}
            <div style={{ marginBottom: 8, fontWeight: 800, color: '#16a34a', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ➕ INGRESOS
            </div>
            {[
              { label: 'Total facturado', value: kpis.ventas, color: 'var(--naranja)' },
              { label: 'Total cobrado', value: kpis.cobrado, color: '#16a34a' },
              { label: '🎁 Otros ingresos', value: totalOtrosIngresos, color: '#2563eb' },
              { label: 'Pendiente de cobro', value: kpis.pendiente, color: '#f59e0b' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #f5e8d8', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', color: '#444' }}>{r.label}</span>
                <span style={{ fontFamily: 'Fredoka One', fontSize: '1.1rem', color: r.color }}>{r.value.toFixed(2)} €</span>
              </div>
            ))}

            {/* GASTOS */}
            <div style={{ margin: '16px 0 8px', fontWeight: 800, color: '#dc2626', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ➖ GASTOS
            </div>
            {[
              { label: '🚛 Pagos a proveedores', value: allGastosAnio.filter((g:any) => g.categoria === '🚛 Proveedor').reduce((s:number,g:any) => s+Number(g.importe),0) },
              { label: '⛽ Gasoil', value: allGastosAnio.filter((g:any) => g.categoria === '⛽ Gasoil').reduce((s:number,g:any) => s+Number(g.importe),0) },
              { label: '👤 Autónomo/Seguro Social', value: allGastosAnio.filter((g:any) => g.categoria === '👤 Autónomo/Seguro Social').reduce((s:number,g:any) => s+Number(g.importe),0) },
              { label: '🔧 Mantenimiento/Averías', value: allGastosAnio.filter((g:any) => g.categoria === '🔧 Mantenimiento/Averías').reduce((s:number,g:any) => s+Number(g.importe),0) },
              { label: '📱 Teléfono/Internet', value: allGastosAnio.filter((g:any) => g.categoria === '📱 Teléfono/Internet').reduce((s:number,g:any) => s+Number(g.importe),0) },
              { label: '🏛️ Seguros', value: allGastosAnio.filter((g:any) => g.categoria === '🏛️ Seguros').reduce((s:number,g:any) => s+Number(g.importe),0) },
              { label: '🏠 Alquiler', value: allGastosAnio.filter((g:any) => g.categoria === '🏠 Alquiler').reduce((s:number,g:any) => s+Number(g.importe),0) },
              { label: '📦 Otros gastos', value: allGastosAnio.filter((g:any) => !['🚛 Proveedor','⛽ Gasoil','👤 Autónomo/Seguro Social','🔧 Mantenimiento/Averías','📱 Teléfono/Internet','🏛️ Seguros','🏠 Alquiler'].includes(g.categoria)).reduce((s:number,g:any) => s+Number(g.importe),0) },
            ].filter(r => r.value > 0).map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #f5e8d8', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', color: '#444' }}>{r.label}</span>
                <span style={{ fontFamily: 'Fredoka One', fontSize: '1.1rem', color: '#dc2626' }}>-{r.value.toFixed(2)} €</span>
              </div>
            ))}

            {/* TOTAL GASTOS */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '2px solid #dc2626', alignItems: 'center', background: '#fef2f2' }}>
              <span style={{ fontWeight: 800 }}>Total gastos</span>
              <span style={{ fontFamily: 'Fredoka One', fontSize: '1.1rem', color: '#dc2626' }}>-{kpis.gastos.toFixed(2)} €</span>
            </div>

            {/* RESULTADO FINAL */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 14px', alignItems: 'center', background: kpis.beneficio >= 0 ? '#f0fdf4' : '#fef2f2', borderRadius: '0 0 12px 12px', marginTop: 4 }}>
              <span style={{ fontWeight: 900, fontSize: '1.1rem' }}>
                {kpis.beneficio >= 0 ? '✅ BENEFICIO NETO' : '❌ PÉRDIDA NETA'}
              </span>
              <span style={{ fontFamily: 'Fredoka One', fontSize: '1.6rem', color: kpis.beneficio >= 0 ? '#16a34a' : '#dc2626' }}>
                {kpis.beneficio >= 0 ? '+' : ''}{kpis.beneficio.toFixed(2)} €
              </span>
            </div>

            {/* MARGEN */}
            {kpis.ventas > 0 && (
              <div style={{ textAlign: 'center', marginTop: 12, color: 'var(--gris)', fontSize: '0.85rem' }}>
                Margen sobre ventas: <strong style={{ color: kpis.beneficio >= 0 ? '#16a34a' : '#dc2626' }}>
                  {((kpis.beneficio / kpis.ventas) * 100).toFixed(1)}%
                </strong>
              </div>
            )}
          </div>
        </div>
      )}

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

          {/* Selector de mes */}
          <div className="card" style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'Fredoka One', color: 'var(--marron)', fontSize: '1rem' }}>📦 Desglose por mes:</span>
              <input type="month" className="input" style={{ width: 'auto' }}
                value={mesProd} onChange={e => setMesProd(e.target.value)} />
              <span style={{ color: 'var(--gris)', fontSize: '0.85rem' }}>
                {prodMes.length} productos · {prodMes.reduce((s,p)=>s+p.unidades,0)} unidades totales
              </span>
            </div>
          </div>

          {/* KPIs del mes */}
          {prodMes.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
              {[
                { label: '🍞 Total unidades', value: prodMes.reduce((s,p)=>s+p.unidades,0).toString(), color: '#2563eb', bg: '#eff6ff' },
                { label: '💰 Total sin IVA', value: prodMes.reduce((s,p)=>s+p.total,0).toFixed(2)+' €', color: 'var(--naranja)', bg: '#fff8f0' },
                { label: '💳 Total con IVA', value: prodMes.reduce((s,p)=>s+p.conIva,0).toFixed(2)+' €', color: '#16a34a', bg: '#f0fdf4' },
                { label: '📊 Productos distintos', value: prodMes.length.toString(), color: '#7c3aed', bg: '#f5f3ff' },
              ].map(k => (
                <div key={k.label} className="card" style={{ padding: '12px', background: k.bg, textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Fredoka One', fontSize: '1.25rem', color: k.color }}>{k.value}</div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--gris)', textTransform: 'uppercase', marginTop: 2 }}>{k.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Gráfica barras */}
          {prodMes.length > 0 && (
            <div className="card">
              <h3 style={{ fontFamily: 'Fredoka One', color: 'var(--marron)', marginBottom: 14 }}>
                📊 Unidades por producto — {MESES_NOMBRES[parseInt(mesProd.split('-')[1])-1]} {mesProd.split('-')[0]}
              </h3>
              <ResponsiveContainer width="100%" height={Math.max(250, prodMes.length * 32)}>
                <BarChart data={prodMes} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5e8d8" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="nombre" width={160} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: any, name: string) => [
                    name === 'unidades' ? `${v} ud` : `${Number(v).toFixed(2)} €`, name
                  ]} />
                  <Legend />
                  <Bar dataKey="unidades" fill="#2563eb" radius={[0,4,4,0]} name="Unidades" />
                  <Bar dataKey="total" fill="#E8670A" radius={[0,4,4,0]} name="Sin IVA (€)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tabla completa para cotejar con panificadora */}
          {prodMes.length > 0 ? (
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #f5e8d8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'Fredoka One', color: 'var(--marron)', fontSize: '1rem' }}>
                  🧾 Desglose completo — Para cotejar con la panificadora
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--gris)', fontStyle: 'italic' }}>
                  {MESES_NOMBRES[parseInt(mesProd.split('-')[1])-1]} {mesProd.split('-')[0]}
                </span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}>#</th>
                      <th>Producto</th>
                      <th style={{ textAlign: 'right' }}>Unidades</th>
                      <th style={{ textAlign: 'right' }}>Precio unit. sin IVA</th>
                      <th style={{ textAlign: 'right' }}>Total sin IVA</th>
                      <th style={{ textAlign: 'right' }}>Total con IVA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prodMes.map((p, i) => {
                      const precioUnit = p.unidades > 0 ? p.total / p.unidades : 0
                      const pctTotal = prodMes.reduce((s,x)=>s+x.unidades,0) > 0
                        ? (p.unidades / prodMes.reduce((s,x)=>s+x.unidades,0) * 100).toFixed(1)
                        : '0'
                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#fffaf6' }}>
                          <td>
                            <span style={{
                              fontFamily: 'Fredoka One', fontSize: '0.9rem',
                              color: i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#cd7c2f' : 'var(--gris)'
                            }}>
                              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i+1}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 700 }}>{p.nombre}</div>
                            <div style={{ height: 4, background: '#f5e8d8', borderRadius: 2, marginTop: 3, width: '100%' }}>
                              <div style={{ height: 4, background: '#E8670A', borderRadius: 2, width: `${pctTotal}%` }} />
                            </div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--gris)', marginTop: 1 }}>{pctTotal}% del total</div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span style={{ background: '#eff6ff', color: '#2563eb', fontWeight: 800, padding: '3px 10px', borderRadius: 6, fontSize: '0.9rem' }}>
                              {p.unidades} ud
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', color: 'var(--gris)', fontSize: '0.85rem' }}>
                            {precioUnit.toFixed(4)} €
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--naranja)' }}>
                            {p.total.toFixed(2)} €
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                            {p.conIva.toFixed(2)} €
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#5a2d0c', color: 'white' }}>
                      <td colSpan={2} style={{ fontFamily: 'Fredoka One', fontSize: '0.95rem', padding: '10px 10px' }}>
                        TOTALES
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'Fredoka One', fontSize: '1.05rem' }}>
                        {prodMes.reduce((s,p)=>s+p.unidades,0)} ud
                      </td>
                      <td></td>
                      <td style={{ textAlign: 'right', fontFamily: 'Fredoka One', fontSize: '1.05rem' }}>
                        {prodMes.reduce((s,p)=>s+p.total,0).toFixed(2)} €
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'Fredoka One', fontSize: '1.05rem' }}>
                        {prodMes.reduce((s,p)=>s+p.conIva,0).toFixed(2)} €
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="empty-state">
                <span style={{ fontSize: 40 }}>📦</span>
                <p>No hay pedidos en {MESES_NOMBRES[parseInt(mesProd.split('-')[1])-1]} {mesProd.split('-')[0]}</p>
              </div>
            </div>
          )}
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