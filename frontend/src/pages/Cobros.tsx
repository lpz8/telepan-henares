import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Clock, Filter } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { globalToast } from '../components/Layout'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const FORMAS_PAGO = ['Efectivo', 'Bizum', 'Transferencia', 'Domiciliación']

export default function Cobros() {
  const { user } = useAuth()
  const now = new Date()
  const [mes, setMes] = useState(String(now.getMonth()))
  const anio = String(now.getFullYear())
  const [facturas, setFacturas] = useState<any[]>([])
  const [filterPago, setFilterPago] = useState('all')
  const [filterEstado, setFilterEstado] = useState('all')
  const [busqueda, setBusqueda] = useState('')

  const mesNum = String(parseInt(mes) + 1).padStart(2, '0')

  const load = async () => {
    const { data } = await supabase
      .from('facturas')
      .select('*, clientes(nombre, telefono1, forma_pago, poblacion)')
      .eq('mes', `${anio}-${mesNum}`)
      .order('numero')
    if (data) setFacturas(data)
  }

  useEffect(() => { load() }, [mes])

  const togglePagado = async (factura: any) => {
    const nuevoPagado = !factura.pagado
    const { error } = await supabase.from('facturas').update({
      pagado: nuevoPagado,
      fecha_pago: nuevoPagado ? new Date().toISOString().split('T')[0] : null
    }).eq('id', factura.id)
    if (error) return globalToast(error.message, 'error')
    globalToast(nuevoPagado ? '✅ Marcada como cobrada' : '↩️ Marcada como pendiente')
    load()
  }

  const filtered = facturas.filter(f => {
    const pago = f.tipo_pago || f.clientes?.forma_pago
    if (filterPago !== 'all' && pago !== filterPago) return false
    if (filterEstado === 'pagado' && !f.pagado) return false
    if (filterEstado === 'pendiente' && f.pagado) return false
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      if (!f.clientes?.nombre?.toLowerCase().includes(q) && !f.numero?.toLowerCase().includes(q)) return false
    }
    return true
  })

  const totalPendiente = filtered.filter(f => !f.pagado).reduce((s, f) => s + Number(f.total), 0)
  const totalCobrado = filtered.filter(f => f.pagado).reduce((s, f) => s + Number(f.total), 0)
  const totalGeneral = filtered.reduce((s, f) => s + Number(f.total), 0)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">💰 Control de Cobros</h1>
        <div className="page-actions">
          <select className="select" style={{ width: 'auto' }} value={mes} onChange={e => setMes(e.target.value)}>
            {MESES.map((m, i) => <option key={i} value={String(i)}>{m} {anio}</option>)}
          </select>
          <select className="select" style={{ width: 'auto' }} value={filterPago} onChange={e => setFilterPago(e.target.value)}>
            <option value="all">Todas las formas de pago</option>
            {FORMAS_PAGO.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gris)', fontSize: '0.9rem' }}>🔍</span>
            <input className="input" placeholder="Buscar cliente..." value={busqueda}
              onChange={e => setBusqueda(e.target.value)} style={{ paddingLeft: 34, width: 200 }} />
          </div>
          <select className="select" style={{ width: 'auto' }} value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
            <option value="all">Todos los estados</option>
            <option value="pendiente">⏳ Pendientes</option>
            <option value="pagado">✅ Cobradas</option>
          </select>
        </div>
      </div>

      {/* Resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Total facturas', value: `${totalGeneral.toFixed(2)} €`, color: 'var(--naranja)', bg: '#fff3e8' },
          { label: '✅ Cobrado', value: `${totalCobrado.toFixed(2)} €`, color: '#16a34a', bg: '#f0fdf4' },
          { label: '⏳ Pendiente', value: `${totalPendiente.toFixed(2)} €`, color: '#dc2626', bg: '#fef2f2' },
          { label: 'Facturas', value: `${filtered.filter(f=>f.pagado).length} / ${filtered.length}`, color: '#2563eb', bg: '#eff6ff' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '12px 14px', background: s.bg }}>
            <div style={{ fontFamily: 'Fredoka One', fontSize: '1.3rem', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--gris)', textTransform: 'uppercase', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Estado</th>
                <th>Nº Factura</th>
                <th>Cliente</th>
                <th>Teléfono</th>
                <th>Pago</th>
                <th>Total</th>
                <th>Fecha cobro</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => (
                <tr key={f.id} style={{ background: f.pagado ? '#f0fdf4' : 'white' }}>
                  <td>
                    {f.pagado
                      ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#16a34a', fontWeight: 800, fontSize: '0.8rem' }}><CheckCircle size={16} /> Cobrada</span>
                      : <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#dc2626', fontWeight: 800, fontSize: '0.8rem' }}><Clock size={16} /> Pendiente</span>
                    }
                  </td>
                  <td><strong style={{ color: 'var(--naranja)' }}>{f.numero}</strong></td>
                  <td>
                    <div style={{ fontWeight: 700 }}>{f.clientes?.nombre}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--gris)' }}>{f.clientes?.poblacion}</div>
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{f.clientes?.telefono1 || '—'}</td>
                  <td><span className="badge badge-gray">{f.tipo_pago}</span></td>
                  <td><strong style={{ color: f.pagado ? '#16a34a' : '#dc2626' }}>{Number(f.total).toFixed(2)} €</strong></td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--gris)' }}>{f.fecha_pago || '—'}</td>
                  <td>
                    <button
                      className={`btn btn-sm ${f.pagado ? 'btn-secondary' : 'btn-success'}`}
                      onClick={() => togglePagado(f)}
                    >
                      {f.pagado ? <><XCircle size={13} /> Desmarcar</> : <><CheckCircle size={13} /> Marcar cobrada</>}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8}><div className="empty-state"><p>No hay facturas para este mes</p><span>Genera las facturas primero desde la sección Facturas</span></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}