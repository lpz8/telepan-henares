import { useEffect, useState } from 'react'
import { Zap, Plus, Trash2, X, ChevronDown, ChevronUp, AlertCircle, PauseCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { globalToast } from '../components/Layout'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

// Get ISO week number
function getWeekNumber(dateStr: string): number {
  const d = new Date(dateStr + 'T12:00:00')
  const jan1 = new Date(d.getFullYear(), 0, 1)
  return Math.ceil((((d.getTime() - jan1.getTime()) / 86400000) + jan1.getDay() + 1) / 7)
}

function shouldInclude(frecuencia: string, fecha: string): boolean {
  if (!frecuencia || frecuencia === 'todos') return true
  const week = getWeekNumber(fecha)
  if (frecuencia === 'si_no') return week % 2 === 1  // odd weeks = yes
  if (frecuencia === 'semanas_impares') return week % 2 === 1
  if (frecuencia === 'semanas_pares') return week % 2 === 0
  return true
}

export default function Pedidos() {
  const { user } = useAuth()
  const today = new Date().toISOString().split('T')[0]
  const [fecha, setFecha] = useState(today)
  const [pedidos, setPedidos] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [productos, setProductos] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [openManual, setOpenManual] = useState(false)
  const [formManual, setFormManual] = useState({ cliente_id: '', producto_id: '', cantidad: 1, precio: 0, iva: 4 })
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set())
  const [suspendidos, setSuspendidos] = useState<string[]>([])

  const load = async () => {
    const { data } = await supabase
      .from('pedidos')
      .select('*, clientes(nombre, codigo, orden_ruta, poblacion), productos(nombre, iva)')
      .eq('fecha', fecha)
      .order('created_at')
    if (data) setPedidos(data)

    // Load suspensions for this date
    const { data: susps } = await supabase
      .from('suspensiones_pedido')
      .select('cliente_id')
      .lte('fecha_inicio', fecha)
      .gte('fecha_fin', fecha)
    if (susps) setSuspendidos(susps.map(s => s.cliente_id))
  }

  useEffect(() => { load() }, [fecha])

  useEffect(() => {
    supabase.from('clientes').select('id, nombre, codigo, orden_ruta').order('codigo').then(r => { if (r.data) setClientes(r.data) })
    supabase.from('productos').select('id, nombre, precio_sin_iva, iva').order('nombre').then(r => { if (r.data) setProductos(r.data) })
  }, [])

  const generarPedidos = async () => {
    if (!user) return
    const dayOfWeek = new Date(fecha + 'T12:00:00').getDay()
    const diaName = DIAS[dayOfWeek]

    const { count } = await supabase.from('pedidos').select('id', { count: 'exact', head: true }).eq('fecha', fecha).eq('user_id', user.id)
    if (count && count > 0) {
      if (!confirm(`Ya hay ${count} pedidos para el ${fecha}.\n¿Quieres REEMPLAZARLOS con los pedidos habituales de ${diaName}?`)) return
    }

    setLoading(true)
    try {
      const { data: modelos } = await supabase
        .from('pedidos_modelo')
        .select('*, productos(precio_sin_iva, iva), clientes(orden_ruta, codigo)')
        .eq('dia_semana', dayOfWeek)
        .eq('user_id', user.id)

      if (!modelos || modelos.length === 0) {
        globalToast(`Sin pedidos habituales para ${diaName}. Configúralos en "Habituales"`, 'info')
        setLoading(false)
        return
      }

      await supabase.from('pedidos').delete().eq('fecha', fecha).eq('user_id', user.id)

      // Load suspensions for this date
      const { data: susps } = await supabase
        .from('suspensiones_pedido')
        .select('cliente_id')
        .lte('fecha_inicio', fecha)
        .gte('fecha_fin', fecha)
      const clientesSuspendidos = new Set((susps || []).map(s => s.cliente_id))

      // Filter by suspension, cantidad > 0, and frequency
      const inserts = modelos
        .filter(m => m.cantidad > 0)
        .filter(m => !clientesSuspendidos.has(m.cliente_id))
        .filter(m => shouldInclude(m.frecuencia, fecha))
        .map(m => ({
          user_id: user.id,
          fecha,
          cliente_id: m.cliente_id,
          producto_id: m.producto_id,
          cantidad: m.cantidad,
          precio: Number(m.productos?.precio_sin_iva || 0),
          iva: Number(m.productos?.iva || 4),
        }))

      const skipped = modelos.filter(m => clientesSuspendidos.has(m.cliente_id))
      const skippedFreq = modelos.filter(m => !shouldInclude(m.frecuencia, fecha))

      if (inserts.length > 0) await supabase.from('pedidos').insert(inserts)

      let msg = `✅ ${inserts.length} pedidos generados para ${diaName}`
      if (skipped.length > 0) msg += ` · ${new Set(skipped.map(m => m.cliente_id)).size} clientes suspendidos omitidos`
      if (skippedFreq.length > 0) msg += ` · ${skippedFreq.length} omitidos por frecuencia`
      globalToast(msg)
      load()
    } catch (err: any) {
      globalToast(err.message, 'error')
    }
    setLoading(false)
  }

  const handleAddManual = async () => {
    if (!user || !formManual.cliente_id || !formManual.producto_id) return globalToast('Selecciona cliente y producto', 'error')
    await supabase.from('pedidos').insert({ ...formManual, fecha, user_id: user.id })
    globalToast('Pedido añadido ✓')
    setOpenManual(false)
    setFormManual({ cliente_id: '', producto_id: '', cantidad: 1, precio: 0, iva: 4 })
    load()
  }

  const handleDelete = async (id: string) => {
    await supabase.from('pedidos').delete().eq('id', id)
    load()
  }

  const grouped = pedidos.reduce((acc: Record<string, any>, p) => {
    const id = p.cliente_id
    if (!acc[id]) acc[id] = { cliente: p.clientes, items: [] }
    acc[id].items.push(p)
    return acc
  }, {})

  const sortedGroups = Object.entries(grouped).sort(([, a]: any, [, b]: any) => {
    return parseInt(a.cliente?.codigo || '9999') - parseInt(b.cliente?.codigo || '9999')
  })

  const totalUnidades = pedidos.reduce((s, p) => s + Number(p.cantidad), 0)
  const totalEuros = pedidos.reduce((s, p) => s + Number(p.cantidad) * Number(p.precio) * (1 + Number(p.iva) / 100), 0)

  const toggleExpand = (id: string) => {
    setExpandedClients(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">🛒 Pedidos</h1>
        <div className="page-actions">
          <input type="date" className="input" style={{ width: 'auto' }} value={fecha} onChange={e => setFecha(e.target.value)} />
          <button className="btn btn-success" onClick={generarPedidos} disabled={loading}>
            <Zap size={16} /> {loading ? 'Generando...' : 'Generar día completo'}
          </button>
          <button className="btn btn-primary" onClick={() => setOpenManual(true)}><Plus size={16} /> Añadir manual</button>
          {pedidos.length > 0 && (
            <button className="btn btn-danger" onClick={async () => {
              if (!confirm(`¿Eliminar TODOS los pedidos del ${fecha}?\n\nEsta acción no se puede deshacer.`)) return
              await supabase.from('pedidos').delete().eq('fecha', fecha).eq('user_id', user!.id)
              globalToast('🗑️ Pedidos del día eliminados')
              load()
            }}>
              <Trash2 size={16} /> Borrar día
            </button>
          )}
        </div>
      </div>

      {/* Aviso clientes suspendidos */}
      {suspendidos.length > 0 && (
        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: '#92400e' }}>
          <PauseCircle size={18} />
          <strong>{suspendidos.length} cliente{suspendidos.length > 1 ? 's' : ''} suspendido{suspendidos.length > 1 ? 's' : ''}</strong> por vacaciones para esta fecha — no se incluirán al generar pedidos
        </div>
      )}

      {/* Resumen */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Clientes', value: sortedGroups.length, color: 'var(--naranja)' },
          { label: 'Unidades', value: totalUnidades, color: '#2563eb' },
          { label: 'Total €', value: `${totalEuros.toFixed(2)} €`, color: '#16a34a' },
        ].map(s => (
          <div key={s.label} className="card" style={{ flex: 1, minWidth: 100, padding: '12px 16px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Fredoka One', fontSize: '1.5rem', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--gris)', textTransform: 'uppercase' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Pedidos por cliente */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sortedGroups.map(([clienteId, { cliente, items }]: any) => {
          const total = items.reduce((s: number, p: any) => s + Number(p.cantidad) * Number(p.precio) * (1 + Number(p.iva) / 100), 0)
          const isExpanded = expandedClients.has(clienteId)
          return (
            <div key={clienteId} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer', background: 'var(--crema-dark)' }}
                onClick={() => toggleExpand(clienteId)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: 'Fredoka One', color: 'var(--naranja)', fontSize: '1rem' }}>#{cliente?.codigo}</span>
                  <strong>{cliente?.nombre}</strong>
                  <span className="badge badge-gray">{cliente?.poblacion}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 800, color: '#16a34a' }}>{total.toFixed(2)} €</span>
                  <button className="btn btn-danger btn-sm btn-icon"
                    onClick={e => {
                      e.stopPropagation()
                      if (!confirm(`¿Eliminar el pedido de ${cliente?.nombre} del ${fecha}?`)) return
                      Promise.all(items.map((p: any) => supabase.from('pedidos').delete().eq('id', p.id)))
                        .then(() => { globalToast(`🗑️ Pedido de ${cliente?.nombre} eliminado`); load() })
                    }}
                    title="Eliminar pedido de este cliente">
                    <Trash2 size={13} />
                  </button>
                  <span style={{ color: 'var(--gris)' }}>{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
                </div>
              </div>
              {isExpanded && (
                <div style={{ padding: '0 0 8px' }}>
                  <table style={{ width: '100%' }}>
                    <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Total</th><th></th></tr></thead>
                    <tbody>
                      {items.map((p: any) => (
                        <tr key={p.id}>
                          <td>{p.productos?.nombre}</td>
                          <td>{p.cantidad}</td>
                          <td>{Number(p.precio).toFixed(2)} €</td>
                          <td><strong>{(Number(p.cantidad) * Number(p.precio) * (1 + Number(p.iva) / 100)).toFixed(2)} €</strong></td>
                          <td><button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(p.id)}><Trash2 size={12} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
        {pedidos.length === 0 && (
          <div className="card">
            <div className="empty-state">
              <Zap size={40} />
              <p>No hay pedidos para esta fecha</p>
              <span>Pulsa "Generar día completo" para crear los pedidos automáticos</span>
            </div>
          </div>
        )}
      </div>

      {/* Modal añadir manual */}
      {openManual && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setOpenManual(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">➕ Añadir Pedido Manual</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setOpenManual(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">Cliente</label>
                <select className="select" value={formManual.cliente_id} onChange={e => setFormManual(f => ({ ...f, cliente_id: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Producto</label>
                <select className="select" value={formManual.producto_id} onChange={e => {
                  const prod = productos.find(p => p.id === e.target.value)
                  setFormManual(f => ({ ...f, producto_id: e.target.value, precio: prod?.precio_sin_iva || 0, iva: prod?.iva || 4 }))
                }}>
                  <option value="">Seleccionar...</option>
                  {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} ({Number(p.precio_sin_iva).toFixed(2)}€)</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Cantidad</label>
                <input className="input" type="number" min={1} value={formManual.cantidad} onChange={e => setFormManual(f => ({ ...f, cantidad: parseInt(e.target.value) || 1 }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setOpenManual(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleAddManual}>✅ Añadir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}