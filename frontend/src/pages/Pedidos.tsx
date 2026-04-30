import { useEffect, useState } from 'react'
import { Zap, Plus, Trash2, X, ChevronDown, ChevronUp, AlertCircle, PauseCircle, Edit2 } from 'lucide-react'
import SearchableSelect from '../components/SearchableSelect'
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
  const [editCliente, setEditCliente] = useState<{ id: string; nombre: string; lineas: any[]; _productoAdd?: string; _cantidadAdd?: number } | null>(null)
  const [formManual, setFormManual] = useState({ cliente_id: '', producto_id: '', cantidad: 1, precio: 0, iva: 4 })
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set())
  const [suspendidos, setSuspendidos] = useState<any[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [tabActiva, setTabActiva] = useState<string>('pedidos')
  const [openSuspModal, setOpenSuspModal] = useState(false)
  const [editSusp, setEditSusp] = useState<any>(null)

  const load = async () => {
    const { data } = await supabase
      .from('pedidos')
      .select('*, clientes(nombre, codigo, orden_ruta, poblacion), productos(nombre, iva, categoria)')
      .eq('fecha', fecha)
      .order('created_at')
    if (data) setPedidos(data)

    // Load suspensions for this date
    const { data: susps } = await supabase
      .from('suspensiones_pedido')
      .select('*, clientes(nombre, codigo)')
      .lte('fecha_inicio', fecha)
      .gte('fecha_fin', fecha)
    if (susps) setSuspendidos(susps)
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

  const sortedGroups = Object.entries(grouped)
    .sort(([, a]: any, [, b]: any) => parseInt(a.cliente?.codigo || '9999') - parseInt(b.cliente?.codigo || '9999'))
    .filter(([, { cliente }]: any) => {
      if (!busqueda.trim()) return true
      const q = busqueda.toLowerCase()
      return cliente?.nombre?.toLowerCase().includes(q) ||
        String(cliente?.codigo)?.includes(q) ||
        cliente?.poblacion?.toLowerCase().includes(q)
    })

  const totalUnidades = pedidos.reduce((s, p) => s + Number(p.cantidad), 0)
  const totalEuros = pedidos.reduce((s, p) => s + Number(p.cantidad) * Number(p.precio) * (1 + Number(p.iva) / 100), 0)

  // Resumen artículos del día — CASA* y PISTOLA* agrupados
  const resumenArticulos = (() => {
    const totales: Record<string, { nombre: string; cantidad: number; esAgrupado?: boolean }> = {}
    pedidos.forEach(p => {
      const nombre: string = p.productos?.nombre || 'Desconocido'
      const cantidad = Number(p.cantidad)
      const up = nombre.toUpperCase().trim()
      if (up.startsWith('CASA')) {
        if (!totales['__CASA__']) totales['__CASA__'] = { nombre: 'BARRA CASA (todas)', cantidad: 0, esAgrupado: true }
        totales['__CASA__'].cantidad += cantidad
      } else if (up.startsWith('PISTOLA')) {
        if (!totales['__PISTOLA__']) totales['__PISTOLA__'] = { nombre: 'BARRA PISTOLA (todas)', cantidad: 0, esAgrupado: true }
        totales['__PISTOLA__'].cantidad += cantidad
      } else {
        const key = up
        if (!totales[key]) totales[key] = { nombre, cantidad: 0 }
        totales[key].cantidad += cantidad
      }
    })
    return Object.values(totales).sort((a, b) => b.cantidad - a.cantidad)
  })()
  const totalResumen = resumenArticulos.reduce((s, a) => s + a.cantidad, 0)

  // Categorías presentes en los pedidos del día
  const ORDEN_CATS = ['Pan', 'Bollería', 'Pastelería', 'Huevos', 'Otros']
  const categoriasDelDia = ORDEN_CATS.filter(cat =>
    pedidos.some(p => (p.productos?.categoria || 'Pan') === cat)
  )

  // Resumen por categoría
  const resumenPorCategoria = (cat: string) => {
    const pedidosCat = pedidos.filter(p => (p.productos?.categoria || 'Pan') === cat)
    const totales: Record<string, { nombre: string; cantidad: number; esAgrupado?: boolean }> = {}
    pedidosCat.forEach(p => {
      const nombre: string = p.productos?.nombre || 'Desconocido'
      const cantidad = Number(p.cantidad)
      const up = nombre.toUpperCase().trim()
      if (cat === 'Pan' && up.startsWith('CASA')) {
        if (!totales['__CASA__']) totales['__CASA__'] = { nombre: 'BARRA CASA (todas)', cantidad: 0, esAgrupado: true }
        totales['__CASA__'].cantidad += cantidad
      } else if (cat === 'Pan' && up.startsWith('PISTOLA')) {
        if (!totales['__PISTOLA__']) totales['__PISTOLA__'] = { nombre: 'BARRA PISTOLA (todas)', cantidad: 0, esAgrupado: true }
        totales['__PISTOLA__'].cantidad += cantidad
      } else {
        if (!totales[up]) totales[up] = { nombre, cantidad: 0 }
        totales[up].cantidad += cantidad
      }
    })
    return Object.values(totales).sort((a, b) => b.cantidad - a.cantidad)
  }

  const CAT_EMOJI: Record<string, string> = {
    'Pan': '🍞', 'Bollería': '🥐', 'Pastelería': '🎂', 'Huevos': '🥚', 'Otros': '📦'
  }

  const renderTablaResumen = (arts: { nombre: string; cantidad: number; esAgrupado?: boolean }[], total: number) => (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ padding: '12px 18px', borderBottom: '1px solid #f5e8d8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'Fredoka One', color: 'var(--marron)', fontSize: '1rem' }}>📦 Total artículos — {fecha}</span>
        <span style={{ fontFamily: 'Fredoka One', color: 'var(--naranja)', fontSize: '1.1rem' }}>{total} unidades</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Artículo</th><th style={{ textAlign: 'center' }}>Unidades</th><th style={{ textAlign: 'center' }}>% del total</th></tr></thead>
          <tbody>
            {arts.map((a, i) => (
              <tr key={i} style={{ background: a.esAgrupado ? '#fff8f0' : '' }}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {a.esAgrupado && <span style={{ background: 'var(--naranja)', color: 'white', borderRadius: 5, padding: '1px 7px', fontSize: '0.65rem', fontWeight: 800 }}>AGRUPADO</span>}
                    <strong style={{ color: a.esAgrupado ? 'var(--naranja)' : 'var(--marron)', fontSize: '0.95rem' }}>{a.nombre}</strong>
                  </div>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <span style={{ fontFamily: 'Fredoka One', fontSize: '1.8rem', color: a.esAgrupado ? 'var(--naranja)' : '#2563eb' }}>{a.cantidad}</span>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                    <div style={{ width: 100, height: 10, background: '#f3f4f6', borderRadius: 5, overflow: 'hidden' }}>
                      <div style={{ width: `${total > 0 ? (a.cantidad / total * 100) : 0}%`, height: '100%', background: a.esAgrupado ? '#E8670A' : '#2563eb', borderRadius: 5 }} />
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--gris)', minWidth: 36 }}>
                      {total > 0 ? (a.cantidad / total * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
            {arts.length === 0 && (
              <tr><td colSpan={3}><div className="empty-state"><p>No hay artículos de esta categoría hoy</p></div></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

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

      {/* Aviso clientes suspendidos — clicable */}
      {suspendidos.length > 0 && (
        <div onClick={() => setOpenSuspModal(true)} style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: '#92400e', cursor: 'pointer' }}>
          <PauseCircle size={18} />
          <div style={{ flex: 1 }}>
            <strong>{suspendidos.length} cliente{suspendidos.length > 1 ? 's' : ''} suspendido{suspendidos.length > 1 ? 's' : ''}</strong>
            {' '}para esta fecha —{' '}
            {suspendidos.map((s: any) => s.clientes?.nombre).join(', ')}
          </div>
          <span style={{ fontSize: '0.78rem', fontWeight: 800, background: '#f59e0b', color: 'white', borderRadius: 6, padding: '3px 10px', whiteSpace: 'nowrap' }}>
            ✏️ Ver / modificar
          </span>
        </div>
      )}

      {/* BUSCADOR */}
      <div style={{ position: 'relative', maxWidth: 300, marginBottom: 12 }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gris)' }}>🔍</span>
        <input className="input" placeholder="Buscar cliente..." value={busqueda}
          onChange={e => setBusqueda(e.target.value)} style={{ paddingLeft: 34 }} />
      </div>

      {/* SELECTOR DE VISTA — select en móvil, tabs en escritorio */}
      <div className="tabs-mobile-select">
        <select
          value={tabActiva}
          onChange={e => setTabActiva(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '2px solid var(--naranja)', fontFamily: 'Nunito', fontWeight: 800, fontSize: '0.95rem', color: 'var(--marron)', background: '#fff8f0', marginBottom: 12 }}>
          <option value="pedidos">🛒 Pedidos del día ({sortedGroups.length} clientes)</option>
          <option value="resumen">📦 Resumen total ({totalResumen} ud)</option>
          {categoriasDelDia.map(cat => (
            <option key={cat} value={cat}>
              {CAT_EMOJI[cat]} {cat} ({resumenPorCategoria(cat).reduce((s, a) => s + a.cantidad, 0)} ud)
            </option>
          ))}
        </select>
      </div>
      <div className="tabs-desktop" style={{ flexWrap: 'wrap' }}>
        <div className={`tab ${tabActiva === 'pedidos' ? 'active' : ''}`} onClick={() => setTabActiva('pedidos')}>
          🛒 Pedidos del día ({sortedGroups.length})
        </div>
        <div className={`tab ${tabActiva === 'resumen' ? 'active' : ''}`} onClick={() => setTabActiva('resumen')}>
          📦 Resumen total ({totalResumen} ud)
        </div>
        {categoriasDelDia.map(cat => (
          <div key={cat} className={`tab ${tabActiva === cat ? 'active' : ''}`} onClick={() => setTabActiva(cat as any)}>
            {CAT_EMOJI[cat]} {cat} ({resumenPorCategoria(cat).reduce((s, a) => s + a.cantidad, 0)} ud)
          </div>
        ))}
      </div>

      {/* TAB RESUMEN TOTAL */}
      {tabActiva === 'resumen' && (
        <div>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 16px', marginBottom: 14, fontSize: '0.85rem', color: '#1e40af', fontWeight: 700 }}>
            📋 Pedido total del <strong>{fecha}</strong> — todos los artículos de todos los clientes.
            <br/><span style={{ fontWeight: 400, fontSize: '0.78rem' }}>💡 <strong>CASA*</strong> y <strong>PISTOLA*</strong> agrupadas.</span>
          </div>
          {renderTablaResumen(resumenArticulos, totalResumen)}
        </div>
      )}

      {/* TABS POR CATEGORÍA */}
      {categoriasDelDia.includes(tabActiva) && (() => {
        const arts = resumenPorCategoria(tabActiva)
        const total = arts.reduce((s, a) => s + a.cantidad, 0)
        return (
          <div>
            <div style={{ background: '#fff8f0', border: '1px solid #f5e8d8', borderRadius: 10, padding: '10px 16px', marginBottom: 14, fontSize: '0.85rem', color: 'var(--marron)', fontWeight: 700 }}>
              {CAT_EMOJI[tabActiva]} Pedido de <strong>{tabActiva}</strong> del {fecha} — <strong style={{ color: 'var(--naranja)' }}>{total} unidades en total</strong>
            </div>
            {renderTablaResumen(arts, total)}
          </div>
        )
      })()}

      {/* TAB PEDIDOS */}
      {tabActiva === 'pedidos' && <>

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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 800, color: '#16a34a' }}>{total.toFixed(2)} €</span>
                  <button className="btn btn-primary btn-sm"
                    onClick={e => {
                      e.stopPropagation()
                      setEditCliente({
                        id: clienteId,
                        nombre: cliente?.nombre,
                        lineas: items.map((p: any) => ({ ...p, _cantidad: p.cantidad }))
                      })
                    }}
                    title="Editar pedido de este cliente">
                    <Edit2 size={12} /> Editar
                  </button>
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
                    <thead><tr><th>Producto</th><th style={{textAlign:'center'}}>Cant.</th><th>Precio</th><th>Total</th><th></th></tr></thead>
                    <tbody>
                      {items.map((p: any) => (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 700 }}>{p.productos?.nombre}</td>
                          <td style={{ textAlign: 'center' }}><strong style={{fontFamily:'Fredoka One',fontSize:'1.1rem',color:'var(--naranja)'}}>{p.cantidad}</strong></td>
                          <td>{Number(p.precio).toFixed(2)} €</td>
                          <td><strong style={{color:'var(--naranja)'}}>{(Number(p.cantidad)*Number(p.precio)*(1+Number(p.iva)/100)).toFixed(2)} €</strong></td>
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

      </>}

      {/* Modal editar pedido completo del cliente */}
      {editCliente && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditCliente(null)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3 className="modal-title">✏️ Editar pedido — {editCliente.nombre}</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setEditCliente(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: '0.82rem', color: '#1e40af' }}>
                💡 Cambia las cantidades y pulsa <strong>Guardar todo</strong>. También puedes eliminar líneas con 🗑️.
              </div>
              {editCliente.lineas.map((l, i) => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: i % 2 === 0 ? 'var(--crema)' : 'white', borderRadius: 8, marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, color: 'var(--marron)', fontSize: '0.9rem' }}>{l.productos?.nombre}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--gris)' }}>{Number(l.precio).toFixed(2)} € · IVA {l.iva}%</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button style={{ background: '#f3f4f6', border: 'none', borderRadius: 6, width: 32, height: 32, fontSize: '1.1rem', cursor: 'pointer', fontWeight: 800 }}
                      onClick={() => setEditCliente(prev => prev ? { ...prev, lineas: prev.lineas.map((x, j) => j === i ? { ...x, _cantidad: Math.max(1, x._cantidad - 1) } : x) } : prev)}>−</button>
                    <input type="number" min={1} step={1}
                      value={l._cantidad}
                      onChange={e => {
                        const v = Math.max(1, parseInt(e.target.value) || 1)
                        setEditCliente(prev => prev ? { ...prev, lineas: prev.lineas.map((x, j) => j === i ? { ...x, _cantidad: v } : x) } : prev)
                      }}
                      style={{ width: 56, textAlign: 'center', fontWeight: 800, fontSize: '1.1rem', border: '2px solid var(--naranja)', borderRadius: 8, padding: '4px', fontFamily: 'Nunito' }} />
                    <button style={{ background: 'var(--naranja)', border: 'none', borderRadius: 6, width: 32, height: 32, fontSize: '1.1rem', cursor: 'pointer', fontWeight: 800, color: 'white' }}
                      onClick={() => setEditCliente(prev => prev ? { ...prev, lineas: prev.lineas.map((x, j) => j === i ? { ...x, _cantidad: x._cantidad + 1 } : x) } : prev)}>+</button>
                  </div>
                  <div style={{ minWidth: 60, textAlign: 'right', fontWeight: 800, color: '#16a34a', fontSize: '0.9rem' }}>
                    {(l._cantidad * Number(l.precio) * (1 + Number(l.iva) / 100)).toFixed(2)} €
                  </div>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() =>
                    setEditCliente(prev => prev ? { ...prev, lineas: prev.lineas.filter((_, j) => j !== i) } : prev)
                  }><Trash2 size={13} /></button>
                </div>
              ))}
              {editCliente.lineas.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--gris)', padding: 20 }}>No quedan productos. Pulsa Guardar para borrar el pedido del cliente.</div>
              )}

              {/* AÑADIR PRODUCTO NUEVO */}
              <div style={{ marginTop: 14, borderTop: '2px solid #f5e8d8', paddingTop: 14, background: '#fff8f0', borderRadius: 10, padding: '12px' }}>
                <div style={{ fontWeight: 800, color: 'var(--naranja)', fontSize: '0.9rem', marginBottom: 10 }}>➕ Añadir producto al pedido</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label className="input-label">Producto</label>
                    <select className="select"
                      value={editCliente._productoAdd || ''}
                      onChange={e => setEditCliente(prev => prev ? { ...prev, _productoAdd: e.target.value } : prev)}>
                      <option value="">Seleccionar producto...</option>
                      {productos.map(p => (
                        <option key={p.id} value={p.id}>{p.nombre} — {Number(p.precio_sin_iva).toFixed(2)}€</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ width: 80 }}>
                    <label className="input-label">Cant.</label>
                    <input className="input" type="number" min={1} step={1}
                      value={editCliente._cantidadAdd || 1}
                      onChange={e => setEditCliente(prev => prev ? { ...prev, _cantidadAdd: Math.max(1, parseInt(e.target.value) || 1) } : prev)}
                      style={{ textAlign: 'center', fontWeight: 800 }} />
                  </div>
                  <button className="btn btn-primary" style={{ minWidth: 80 }}
                    onClick={() => {
                      const prodId = editCliente._productoAdd
                      if (!prodId) { globalToast('Selecciona un producto', 'error'); return }
                      const cant = editCliente._cantidadAdd || 1
                      // Si ya existe, sumar cantidad
                      const existe = editCliente.lineas.findIndex(l => l.producto_id === prodId)
                      if (existe >= 0) {
                        setEditCliente(prev => prev ? {
                          ...prev,
                          lineas: prev.lineas.map((x, j) => j === existe ? { ...x, _cantidad: x._cantidad + cant } : x),
                          _productoAdd: '', _cantidadAdd: 1
                        } : prev)
                        globalToast('✅ Cantidad aumentada')
                        return
                      }
                      const prod = productos.find(p => p.id === prodId)
                      if (!prod) return
                      setEditCliente(prev => prev ? {
                        ...prev,
                        lineas: [...prev.lineas, {
                          id: 'new_' + Date.now(),
                          producto_id: prod.id,
                          productos: { nombre: prod.nombre },
                          precio: prod.precio_sin_iva,
                          iva: prod.iva,
                          cantidad: cant,
                          _cantidad: cant,
                          _nuevo: true
                        }],
                        _productoAdd: '', _cantidadAdd: 1
                      } : prev)
                    }}>
                    ➕ Añadir
                  </button>
                </div>
              </div>
              <div style={{ background: '#fff8f0', borderRadius: 8, padding: '10px 14px', marginTop: 12, display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                <span>Total del pedido:</span>
                <span style={{ color: 'var(--naranja)', fontFamily: 'Fredoka One', fontSize: '1.2rem' }}>
                  {editCliente.lineas.reduce((s, l) => s + l._cantidad * Number(l.precio) * (1 + Number(l.iva) / 100), 0).toFixed(2)} €
                </span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditCliente(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={async () => {
                if (!user) return
                // Líneas existentes (actualizar cantidad)
                const existentes = editCliente.lineas.filter(l => !l._nuevo)
                const nuevas = editCliente.lineas.filter(l => l._nuevo)

                // Updates de existentes
                const updates = existentes.map(l =>
                  supabase.from('pedidos').update({ cantidad: l._cantidad }).eq('id', l.id)
                )
                // Eliminar las que se borraron
                const idsRestantes = new Set(existentes.map(l => l.id))
                const { data: originales } = await supabase.from('pedidos')
                  .select('id').eq('cliente_id', editCliente.id).eq('fecha', fecha)
                const eliminados = (originales || []).filter(o => !idsRestantes.has(o.id))
                const deletes = eliminados.map(o => supabase.from('pedidos').delete().eq('id', o.id))
                // Insertar nuevos productos
                const inserts = nuevas.length > 0
                  ? supabase.from('pedidos').insert(nuevas.map(l => ({
                      user_id: user.id,
                      cliente_id: editCliente.id,
                      producto_id: l.producto_id,
                      fecha,
                      cantidad: l._cantidad,
                      precio: l.precio,
                      iva: l.iva
                    })))
                  : Promise.resolve()

                await Promise.all([...updates, ...deletes, inserts])
                globalToast('✅ Pedido de ' + editCliente.nombre + ' actualizado')
                setEditCliente(null)
                load()
              }}>💾 Guardar todo</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal suspensiones */}
      {openSuspModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setOpenSuspModal(false)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3 className="modal-title">⏸ Clientes suspendidos</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setOpenSuspModal(false)}><X size={16}/></button>
            </div>
            <div className="modal-body">
              {suspendidos.map((s: any) => (
                <div key={s.id} style={{ background: 'var(--crema)', borderRadius: 10, padding: '12px 14px', marginBottom: 10, border: '1px solid #f5e8d8' }}>
                  {editSusp?.id === s.id ? (
                    /* Modo edición */
                    <div>
                      <div style={{ fontWeight: 800, color: 'var(--marron)', marginBottom: 10 }}>
                        ✏️ #{s.clientes?.codigo} — {s.clientes?.nombre}
                      </div>
                      <div className="form-grid-2" style={{ marginBottom: 8 }}>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                          <label className="input-label">Fecha inicio</label>
                          <input className="input" type="date" value={editSusp.fecha_inicio}
                            onChange={e => setEditSusp((prev: any) => ({ ...prev, fecha_inicio: e.target.value }))} />
                        </div>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                          <label className="input-label">Fecha fin</label>
                          <input className="input" type="date" value={editSusp.fecha_fin}
                            onChange={e => setEditSusp((prev: any) => ({ ...prev, fecha_fin: e.target.value }))} />
                        </div>
                      </div>
                      <div className="input-group" style={{ marginBottom: 10 }}>
                        <label className="input-label">Motivo</label>
                        <select className="select" value={editSusp.motivo}
                          onChange={e => setEditSusp((prev: any) => ({ ...prev, motivo: e.target.value }))}>
                          <option value="Vacaciones">🏖 Vacaciones</option>
                          <option value="Enfermedad">🏥 Enfermedad</option>
                          <option value="Viaje">✈️ Viaje</option>
                          <option value="Cierre temporal">🔒 Cierre temporal</option>
                          <option value="Otro">📝 Otro</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-primary btn-sm" onClick={async () => {
                          await supabase.from('suspensiones_pedido').update({
                            fecha_inicio: editSusp.fecha_inicio,
                            fecha_fin: editSusp.fecha_fin,
                            motivo: editSusp.motivo
                          }).eq('id', s.id)
                          globalToast('✅ Suspensión actualizada')
                          setEditSusp(null); load()
                        }}>💾 Guardar</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditSusp(null)}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    /* Modo vista */
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, color: 'var(--marron)' }}>#{s.clientes?.codigo} — {s.clientes?.nombre}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--gris)', marginTop: 2 }}>
                          📅 {s.fecha_inicio} → {s.fecha_fin} &nbsp;·&nbsp;
                          <span style={{ fontWeight: 700 }}>{s.motivo}</span>
                        </div>
                      </div>
                      <button className="btn btn-primary btn-sm" onClick={() => setEditSusp({ ...s })}>✏️ Modificar</button>
                      <button className="btn btn-success btn-sm" onClick={async () => {
                        if (!confirm(`¿Reanudar pedidos de ${s.clientes?.nombre} ahora?`)) return
                        await supabase.from('suspensiones_pedido').delete().eq('id', s.id)
                        globalToast(`✅ ${s.clientes?.nombre} reanudado`)
                        load()
                      }}>✅ Reanudar</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setOpenSuspModal(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

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
                <SearchableSelect
                  value={formManual.cliente_id}
                  onChange={v => setFormManual(f => ({ ...f, cliente_id: v }))}
                  placeholder="🔍 Buscar cliente..."
                  options={clientes.map(c => ({
                    value: c.id,
                    label: `#${c.codigo} — ${c.nombre}`,
                    sublabel: c.poblacion
                  }))}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Producto</label>
                <SearchableSelect
                  value={formManual.producto_id}
                  onChange={v => {
                    const prod = productos.find(p => p.id === v)
                    setFormManual(f => ({ ...f, producto_id: v, precio: prod?.precio_sin_iva || 0, iva: prod?.iva || 4 }))
                  }}
                  placeholder="🔍 Buscar producto..."
                  options={productos.map(p => ({
                    value: p.id,
                    label: p.nombre,
                    sublabel: `${Number(p.precio_sin_iva).toFixed(2)}€ · IVA ${p.iva}%`
                  }))}
                />
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