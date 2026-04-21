import { useEffect, useState } from 'react'
import { Plus, Search, Edit2, Trash2, X, ArrowUp, ArrowDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { globalToast } from '../components/Layout'

const FORMAS_PAGO = ['Efectivo', 'Transferencia', 'Domiciliación', 'Bizum']
const POBLACIONES = ['SAN FERNANDO DE HENARES', 'ALOVERA', 'CHILOECHES', 'AZUQUECA DE HENARES', 'VILLANUEVA DE LA TORRE', 'LOS HUEROS/VILLALBILLA', 'MADRID', 'Otro']

const ZONA_BADGE: Record<string, string> = {
  'SAN FERNANDO DE HENARES': 'badge-blue',
  'ALOVERA': 'badge-green',
  'CHILOECHES': 'badge-purple',
  'AZUQUECA DE HENARES': 'badge-red',
  'VILLANUEVA DE LA TORRE': 'badge-orange',
  'LOS HUEROS/VILLALBILLA': 'badge-yellow',
  'MADRID': 'badge-gray',
}

const ZONA_RANGOS: Record<string, [number, number]> = {
  'SAN FERNANDO DE HENARES': [1, 34],
  'LOS HUEROS/VILLALBILLA': [1, 34],
  'ALOVERA': [35, 290],
  'VILLANUEVA DE LA TORRE': [182, 250],
  'AZUQUECA DE HENARES': [290, 399],
  'CHILOECHES': [400, 599],
  'MADRID': [1, 10],
}

const emptyForm = {
  codigo: '', nombre: '', direccion: '', codigo_postal: '',
  poblacion: 'SAN FERNANDO DE HENARES', provincia: 'GUADALAJARA',
  telefono1: '', telefono2: '', forma_pago: 'Efectivo',
  es_alterno: false, observaciones: '', orden_ruta: 0
}

export default function Clientes() {
  const { user } = useAuth()
  const [clientes, setClientes] = useState<any[]>([])
  const [deudas, setDeudas] = useState<Record<string, number>>({})
  const [soloDeudores, setSoloDeudores] = useState(false)
  const [historialCliente, setHistorialCliente] = useState<any>(null)
  const [historialPedidos, setHistorialPedidos] = useState<any[]>([])
  const [loadingHistorial, setLoadingHistorial] = useState(false)
  const [search, setSearch] = useState('')
  const [filterPoblacion, setFilterPoblacion] = useState('all')
  const [filterPago, setFilterPago] = useState('all')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState(emptyForm)
  const [tab, setTab] = useState<'lista' | 'ruta'>('lista')

  const load = async () => {
    const { data } = await supabase.from('clientes').select('*').order('orden_ruta').order('codigo')
    if (data) setClientes(data)

    const { data: factPend } = await supabase
      .from('facturas').select('cliente_id, total').eq('pagado', false)
    const deudasMap: Record<string, number> = {}
    ;(factPend || []).forEach((f: any) => {
      deudasMap[f.cliente_id] = (deudasMap[f.cliente_id] || 0) + Number(f.total)
    })
    setDeudas(deudasMap)
  }

  useEffect(() => { load() }, [])

  const f = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const nextCodigo = (poblacion: string) => {
    const rango = ZONA_RANGOS[poblacion]
    if (!rango) return ''
    const used = clientes.map(c => parseInt(c.codigo || '0')).filter(n => !isNaN(n))
    for (let i = rango[0]; i <= rango[1]; i++) {
      if (!used.includes(i)) return String(i)
    }
    return ''
  }

  const nextOrdenRuta = (poblacion: string) => {
    const zonaClientes = clientes.filter(c => c.poblacion === poblacion)
    if (zonaClientes.length === 0) {
      const maxOrden = clientes.length > 0 ? Math.max(...clientes.map(c => c.orden_ruta || 0)) : 0
      return maxOrden + 1
    }
    const maxZona = Math.max(...zonaClientes.map(c => c.orden_ruta || 0))
    return maxZona + 1
  }

  const openNew = () => {
    const codigo = nextCodigo(emptyForm.poblacion)
    const orden = nextOrdenRuta(emptyForm.poblacion)
    setEditing(null)
    setForm({ ...emptyForm, codigo, orden_ruta: orden })
    setOpen(true)
  }

  const openEdit = (c: any) => {
    setEditing(c)
    setForm({
      codigo: c.codigo || '', nombre: c.nombre || '', direccion: c.direccion || '',
      codigo_postal: c.codigo_postal || '', poblacion: c.poblacion || '',
      provincia: c.provincia || 'GUADALAJARA', telefono1: c.telefono1 || '',
      telefono2: c.telefono2 || '', forma_pago: c.forma_pago || 'Efectivo',
      es_alterno: c.es_alterno || false, observaciones: c.observaciones || '',
      orden_ruta: c.orden_ruta || 0
    })
    setOpen(true)
  }

  const handleSave = async () => {
    if (!user || !form.nombre.trim()) return globalToast('El nombre es obligatorio', 'error')
    try {
      if (editing?.id) {
        await supabase.from('clientes').update(form).eq('id', editing.id)
        globalToast('Cliente actualizado ✓')
      } else {
        const orden = form.orden_ruta
        const toShift = clientes.filter(c => c.orden_ruta >= orden)
        for (const c of toShift) {
          await supabase.from('clientes').update({ orden_ruta: (c.orden_ruta || 0) + 1 }).eq('id', c.id)
        }
        await supabase.from('clientes').insert({ ...form, user_id: user.id })
        globalToast('Cliente creado ✓')
      }
      setOpen(false); setEditing(null); setForm(emptyForm); load()
    } catch (err: any) { globalToast(err.message, 'error') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este cliente? Se renumerarán automáticamente los demás.')) return
    try {
      const { data: cDel } = await supabase.from('clientes').select('orden_ruta').eq('id', id).single()
      const ordenActual = cDel?.orden_ruta || 0
      await supabase.from('pedidos_modelo').delete().eq('cliente_id', id)
      await supabase.from('suspensiones_pedido').delete().eq('cliente_id', id)
      await supabase.from('clientes').delete().eq('id', id)
      if (ordenActual > 0) {
        const { data: rest } = await supabase.from('clientes').select('id, orden_ruta').gt('orden_ruta', ordenActual).order('orden_ruta')
        if (rest) {
          for (const c of rest) {
            await supabase.from('clientes').update({ orden_ruta: (c.orden_ruta || 1) - 1 }).eq('id', c.id)
          }
        }
      }
      globalToast('✅ Cliente eliminado y ruta renumerada')
      load()
    } catch (err: any) { globalToast(err.message, 'error') }
  }

      const verHistorial = async (c: any) => {
  setHistorialCliente(c)
  setLoadingHistorial(true)
  const { data } = await supabase
    .from('pedidos')
    .select('fecha, cantidad, precio, iva, productos(nombre)')
    .eq('cliente_id', c.id)
    .order('fecha', { ascending: false })
    .limit(200)
  setHistorialPedidos(data || [])
  setLoadingHistorial(false)
}

  const moveRuta = async (idx: number, dir: -1 | 1) => {
    const rutaList = [...clientes].sort((a, b) => (a.orden_ruta || 0) - (b.orden_ruta || 0))
    const target = idx + dir
    if (target < 0 || target >= rutaList.length) return
    const a = rutaList[idx], b = rutaList[target]
    await supabase.from('clientes').update({ orden_ruta: b.orden_ruta }).eq('id', a.id)
    await supabase.from('clientes').update({ orden_ruta: a.orden_ruta }).eq('id', b.id)
    load()
  }

  const filtered = clientes.filter(c => {
    if (search && !c.nombre?.toLowerCase().includes(search.toLowerCase()) &&
      !c.codigo?.toString().includes(search) &&
      !c.direccion?.toLowerCase().includes(search.toLowerCase()) &&
      !c.telefono1?.includes(search)) return false
    if (filterPoblacion !== 'all' && c.poblacion !== filterPoblacion) return false
    if (filterPago !== 'all' && c.forma_pago !== filterPago) return false
    if (soloDeudores && !(deudas[c.id] > 0)) return false
    return true
  })

  const rutaList = [...clientes].sort((a, b) => (a.orden_ruta || 0) - (b.orden_ruta || 0))

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">👥 Clientes <span style={{ fontSize: '1rem', color: 'var(--gris)', fontWeight: 700 }}>({clientes.length})</span></h1>
        <div className="page-actions">
          <button
            className={`btn btn-sm ${soloDeudores ? 'btn-danger' : 'btn-secondary'}`}
            onClick={() => setSoloDeudores(!soloDeudores)}>
            {soloDeudores ? '⚠️ Solo deudores' : '💰 Ver deudores'}
          </button>
          <div className="search-box">
            <Search size={16} />
            <input className="input" style={{ paddingLeft: 32, width: 180 }} placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="select" style={{ width: 'auto' }} value={filterPoblacion} onChange={e => setFilterPoblacion(e.target.value)}>
            <option value="all">Todas las zonas</option>
            {POBLACIONES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="select" style={{ width: 'auto' }} value={filterPago} onChange={e => setFilterPago(e.target.value)}>
            <option value="all">Todos los pagos</option>
            {FORMAS_PAGO.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Nuevo</button>
        </div>
      </div>

      <div className="tabs">
        <div className={`tab ${tab === 'lista' ? 'active' : ''}`} onClick={() => setTab('lista')}>📋 Lista de clientes</div>
        <div className={`tab ${tab === 'ruta' ? 'active' : ''}`} onClick={() => setTab('ruta')}>🗺️ Orden de ruta</div>
      </div>

      {tab === 'lista' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ruta</th><th>Cód.</th><th>Nombre</th><th>Zona</th><th>Pago</th><th>Teléfono</th><th>Deuda</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td><span style={{ fontFamily: 'Fredoka One', color: 'var(--naranja)' }}>#{c.orden_ruta}</span></td>
                    <td><strong style={{ color: 'var(--marron)' }}>{c.codigo}</strong></td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{c.nombre}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--gris)' }}>{c.direccion}</div>
                      {c.es_alterno && <span className="badge badge-yellow">Alterno</span>}
                      {c.observaciones && (
                        <span style={{ fontSize: '0.72rem', background: '#fef3c7', color: '#92400e', borderRadius: 5, padding: '1px 7px', fontWeight: 700, marginLeft: 4 }}>
                          📝 {c.observaciones}
                        </span>
                      )}
                    </td>
                    <td><span className={`badge ${ZONA_BADGE[c.poblacion] || 'badge-gray'}`}>{c.poblacion}</span></td>
                    <td>{c.forma_pago}</td>
                    <td>{c.telefono1}</td>
                    <td>
                      {deudas[c.id] > 0
                        ? <span style={{ color: '#dc2626', fontWeight: 800, fontSize: '0.85rem' }}>💰 {deudas[c.id].toFixed(2)} €</span>
                        : <span style={{ color: '#16a34a', fontSize: '0.8rem' }}>✅ Al día</span>
                      }
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(c)}><Edit2 size={14} /></button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(c.id)}><Trash2 size={14} /></button>
                        <button className="btn btn-secondary btn-sm btn-icon"
  title="Ver historial de pedidos"
  onClick={() => verHistorial(c)}>
  📋
</button>
                        {deudas[c.id] > 0 && (
                          <button
                            style={{ background: '#25D366', color: 'white', border: 'none', fontWeight: 800, fontSize: '0.72rem', padding: '4px 8px', borderRadius: 6, cursor: 'pointer' }}
                            onClick={() => {
                              const tel = (c.telefono1 || '').replace(/\D/g, '')
                              const msg = encodeURIComponent(`Hola ${c.nombre}, le recordamos que tiene una deuda pendiente de ${deudas[c.id].toFixed(2)}€. Por favor contacte con nosotros. Gracias, TelePan Henares.`)
                              window.open(`https://wa.me/34${tel}?text=${msg}`, '_blank')
                            }}>
                            📱
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8}><div className="empty-state"><p>No hay clientes</p><span>Pulsa "Nuevo" para añadir el primero</span></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'ruta' && (
        <div>
          <div style={{ background: '#fff8f0', border: '1px solid #f5e8d8', borderRadius: 12, padding: '10px 16px', marginBottom: 12, fontSize: '0.85rem', color: 'var(--marron)', fontWeight: 700 }}>
            🗺️ Reordena los clientes según el orden de tu ruta diaria.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rutaList.map((c, idx) => (
              <div key={c.id} className="card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--naranja)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fredoka One', flexShrink: 0 }}>
                  {idx + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontFamily: 'Fredoka One', color: 'var(--naranja)', fontSize: '0.85rem' }}>#{c.codigo}</span>
                    <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</strong>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--gris)' }}>{c.poblacion} · {c.telefono1}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button className="btn btn-secondary btn-sm btn-icon" onClick={() => moveRuta(idx, -1)} disabled={idx === 0}><ArrowUp size={13} /></button>
                  <button className="btn btn-secondary btn-sm btn-icon" onClick={() => moveRuta(idx, 1)} disabled={idx === rutaList.length - 1}><ArrowDown size={13} /></button>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(c)}><Edit2 size={13} /></button>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(c.id)}><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {open && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">{editing ? '✏️ Editar Cliente' : '➕ Nuevo Cliente'}</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setOpen(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid-2">
                <div className="input-group">
                  <label className="input-label">Código</label>
                  <input className="input" value={form.codigo} onChange={e => f('codigo', e.target.value)} />
                </div>
                <div className="input-group">
                  <label className="input-label">Nº en ruta</label>
                  <input className="input" type="number" value={form.orden_ruta} onChange={e => f('orden_ruta', parseInt(e.target.value) || 0)} />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Nombre *</label>
                <input className="input" value={form.nombre} onChange={e => f('nombre', e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Dirección</label>
                <input className="input" value={form.direccion} onChange={e => f('direccion', e.target.value)} />
              </div>
              <div className="form-grid-2">
                <div className="input-group">
                  <label className="input-label">Código Postal</label>
                  <input className="input" value={form.codigo_postal} onChange={e => f('codigo_postal', e.target.value)} />
                </div>
                <div className="input-group">
                  <label className="input-label">Provincia</label>
                  <input className="input" value={form.provincia} onChange={e => f('provincia', e.target.value)} />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Zona / Población</label>
                <select className="select" value={form.poblacion} onChange={e => {
                  const p = e.target.value
                  f('poblacion', p)
                  if (!editing) {
                    f('codigo', nextCodigo(p))
                    f('orden_ruta', nextOrdenRuta(p))
                  }
                }}>
                  {POBLACIONES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-grid-2">
                <div className="input-group">
                  <label className="input-label">Teléfono 1</label>
                  <input className="input" value={form.telefono1} onChange={e => f('telefono1', e.target.value)} />
                </div>
                <div className="input-group">
                  <label className="input-label">Teléfono 2</label>
                  <input className="input" value={form.telefono2} onChange={e => f('telefono2', e.target.value)} />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Forma de pago</label>
                <select className="select" value={form.forma_pago} onChange={e => f('forma_pago', e.target.value)}>
                  {FORMAS_PAGO.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Observaciones (visible en pedidos)</label>
                <textarea className="textarea" rows={2} value={form.observaciones} onChange={e => f('observaciones', e.target.value)} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.es_alterno} onChange={e => f('es_alterno', e.target.checked)} />
                <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>Cliente alterno</span>
              </label>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave}>{editing ? '💾 Guardar' : '✅ Crear'}</button>
            </div>
          </div>
        </div>
      )}

{historialCliente && (
  <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setHistorialCliente(null)}>
    <div className="modal" style={{ maxWidth: 600 }}>
      <div className="modal-header">
        <h3 className="modal-title">📋 Historial — {historialCliente.nombre}</h3>
        <button className="btn btn-secondary btn-icon" onClick={() => setHistorialCliente(null)}>✕</button>
      </div>
      <div className="modal-body">
        {loadingHistorial ? (
          <p style={{ textAlign: 'center', color: 'var(--gris)' }}>Cargando...</p>
        ) : historialPedidos.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--gris)', padding: '20px 0' }}>Sin pedidos registrados</p>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div style={{ background: '#fff8f0', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Fredoka One', fontSize: '1.3rem', color: 'var(--naranja)' }}>{historialPedidos.length}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--gris)', fontWeight: 800 }}>PEDIDOS TOTALES</div>
              </div>
              <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Fredoka One', fontSize: '1.3rem', color: '#16a34a' }}>
                  {historialPedidos.reduce((s, p) => s + Number(p.cantidad), 0)}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--gris)', fontWeight: 800 }}>UNIDADES TOTALES</div>
              </div>
              <div style={{ background: '#eff6ff', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Fredoka One', fontSize: '1.3rem', color: '#2563eb' }}>
                  {historialPedidos.reduce((s, p) => s + Number(p.cantidad) * Number(p.precio) * (1 + Number(p.iva) / 100), 0).toFixed(2)}€
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--gris)', fontWeight: 800 }}>FACTURADO TOTAL</div>
              </div>
            </div>
            <div className="table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
              <table>
                <thead><tr><th>Fecha</th><th>Producto</th><th>Cant.</th><th>Total</th></tr></thead>
                <tbody>
                  {historialPedidos.map((p, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: '0.8rem' }}>{p.fecha}</td>
                      <td><strong>{(p as any).productos?.nombre}</strong></td>
                      <td style={{ textAlign: 'center' }}>{p.cantidad}</td>
                      <td><strong style={{ color: 'var(--naranja)' }}>
                        {(Number(p.cantidad) * Number(p.precio) * (1 + Number(p.iva) / 100)).toFixed(2)}€
                      </strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  </div>
)}

    </div>
  )
}
