import { useEffect, useState } from 'react'
import { Plus, Search, Edit2, Trash2, X, ArrowUp, ArrowDown, Eye, EyeOff, Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { globalToast } from '../components/Layout'

const FORMAS_PAGO = ['Efectivo', 'Transferencia', 'Domiciliación', 'Bizum']
const POBLACIONES = [
  'LOS HUEROS (VILLALBILLA)', 'AZUQUECA DE HENARES', 'CHILOECHES',
  'EL MAPA', 'LA CELADA', 'ALOVERA', 'QUER (VILLANUEVA DE LA TORRE)',
  'SAN FERNANDO DE HENARES', 'MADRID', 'Otro'
]

const ZONA_BADGE: Record<string, string> = {
  'LOS HUEROS (VILLALBILLA)': 'badge-yellow',
  'AZUQUECA DE HENARES': 'badge-red',
  'CHILOECHES': 'badge-purple',
  'EL MAPA': 'badge-blue',
  'LA CELADA': 'badge-green',
  'ALOVERA': 'badge-green',
  'QUER (VILLANUEVA DE LA TORRE)': 'badge-orange',
  'SAN FERNANDO DE HENARES': 'badge-blue',
  'MADRID': 'badge-gray',
}

const ZONA_COLOR: Record<string, string> = {
  'LOS HUEROS (VILLALBILLA)': '#ca8a04',
  'AZUQUECA DE HENARES': '#dc2626',
  'CHILOECHES': '#7c3aed',
  'EL MAPA': '#2563eb',
  'LA CELADA': '#16a34a',
  'ALOVERA': '#059669',
  'QUER (VILLANUEVA DE LA TORRE)': '#E8670A',
  'SAN FERNANDO DE HENARES': '#2563eb',
  'MADRID': '#6b7280',
}

const ZONA_RANGOS: Record<string, [number, number]> = {
  'SAN FERNANDO DE HENARES': [1, 99],
  'LOS HUEROS (VILLALBILLA)': [100, 199],
  'AZUQUECA DE HENARES': [200, 399],
  'CHILOECHES': [400, 449],
  'EL MAPA': [450, 499],
  'LA CELADA': [500, 549],
  'ALOVERA': [550, 649],
  'QUER (VILLANUEVA DE LA TORRE)': [650, 799],
  'MADRID': [800, 899],
}

const PIN_CUENTAS = 'Telepan8'
const CUENTA_STORAGE = 'telepan_cuentas_v1'

const emptyForm = {
  codigo: '', nombre: '', direccion: '', codigo_postal: '',
  poblacion: 'SAN FERNANDO DE HENARES', provincia: 'GUADALAJARA',
  telefono1: '', telefono2: '', forma_pago: 'Efectivo',
  es_alterno: false, observaciones: '', orden_ruta: 0, numero_cuenta: '',
  // Tipo y datos empresa
  tipo_cliente: 'particular' as 'particular' | 'empresa',
  razon_social: '', cif: '', email: '',
  direccion_fiscal: '', cp_fiscal: '', poblacion_fiscal: '', provincia_fiscal: ''
}

function getCuentas(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(CUENTA_STORAGE) || '{}') } catch { return {} }
}
function saveCuenta(id: string, v: string) { const c = getCuentas(); c[id] = v; localStorage.setItem(CUENTA_STORAGE, JSON.stringify(c)) }
function deleteCuenta(id: string) { const c = getCuentas(); delete c[id]; localStorage.setItem(CUENTA_STORAGE, JSON.stringify(c)) }

export default function Clientes() {
  const { user } = useAuth()
  const [clientes, setClientes] = useState<any[]>([])
  const [deudas, setDeudas] = useState<Record<string, number>>({})
  const [soloDeudores, setSoloDeudores] = useState(false)
  const [search, setSearch] = useState('')
  const [filterPoblacion, setFilterPoblacion] = useState('all')
  const [filterPago, setFilterPago] = useState('all')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState(emptyForm)
  const [tab, setTab] = useState<'lista' | 'ruta'>('lista')
  const [historialCliente, setHistorialCliente] = useState<any>(null)
  const [historialPedidos, setHistorialPedidos] = useState<any[]>([])
  const [loadingHistorial, setLoadingHistorial] = useState(false)
  const [pinVisible, setPinVisible] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [cuentasVisibles, setCuentasVisibles] = useState<Set<string>>(new Set())
  const [clientePinId, setClientePinId] = useState<string | null>(null)

  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  // Renumerar todos los clientes del 1 en adelante sin huecos ni duplicados
  const renumerarTodos = async () => {
    const sorted = [...clientes].sort((a, b) => {
      if ((a.orden_ruta || 0) !== (b.orden_ruta || 0)) return (a.orden_ruta || 0) - (b.orden_ruta || 0)
      return parseInt(a.codigo || '9999') - parseInt(b.codigo || '9999')
    })
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].orden_ruta !== i + 1) {
        await supabase.from('clientes').update({ orden_ruta: i + 1 }).eq('id', sorted[i].id)
      }
    }
    await load()
  }

  const load = async () => {
    const { data } = await supabase.from('clientes').select('*').order('orden_ruta').order('codigo')
    if (data) setClientes(data)
    const { data: factPend } = await supabase.from('facturas').select('cliente_id, total').eq('pagado', false)
    const deudasMap: Record<string, number> = {}
    ;(factPend || []).forEach((f: any) => { deudasMap[f.cliente_id] = (deudasMap[f.cliente_id] || 0) + Number(f.total) })
    setDeudas(deudasMap)
  }

  useEffect(() => { load() }, [])

  const f = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const nextCodigo = (p: string) => {
    const rango = ZONA_RANGOS[p]; if (!rango) return ''
    const used = clientes.map(c => parseInt(c.codigo || '0')).filter(n => !isNaN(n))
    for (let i = rango[0]; i <= rango[1]; i++) { if (!used.includes(i)) return String(i) }
    return ''
  }

  const nextOrdenRuta = (p: string) => {
    const z = clientes.filter(c => c.poblacion === p)
    if (!z.length) return (clientes.length ? Math.max(...clientes.map(c => c.orden_ruta || 0)) : 0) + 1
    return Math.max(...z.map(c => c.orden_ruta || 0)) + 1
  }

  const openNew = () => {
    setEditing(null)
    setForm({ ...emptyForm, codigo: nextCodigo(emptyForm.poblacion), orden_ruta: nextOrdenRuta(emptyForm.poblacion) })
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
      orden_ruta: c.orden_ruta || 0, numero_cuenta: getCuentas()[c.id] || '',
      tipo_cliente: c.tipo_cliente || 'particular',
      razon_social: c.razon_social || '', cif: c.cif || '', email: c.email || '',
      direccion_fiscal: c.direccion_fiscal || '', cp_fiscal: c.cp_fiscal || '',
      poblacion_fiscal: c.poblacion_fiscal || '', provincia_fiscal: c.provincia_fiscal || ''
    })
    setOpen(true)
  }

  const handleSave = async () => {
    if (!user || !form.nombre.trim()) return globalToast('El nombre es obligatorio', 'error')
    try {
      const { numero_cuenta, ...dataToSave } = form
      if (editing?.id) {
        await supabase.from('clientes').update({ ...dataToSave, orden_ruta: form.orden_ruta }).eq('id', editing.id)
        if (numero_cuenta) saveCuenta(editing.id, numero_cuenta); else deleteCuenta(editing.id)
        globalToast('Cliente actualizado ✓')
      } else {
        const { data: todos } = await supabase.from('clientes').select('id, orden_ruta').gte('orden_ruta', form.orden_ruta).order('orden_ruta', { ascending: false })
        for (const c of (todos || [])) await supabase.from('clientes').update({ orden_ruta: (c.orden_ruta || 0) + 1 }).eq('id', c.id)
        const { data: nuevo, error } = await supabase.from('clientes').insert({ ...dataToSave, user_id: user.id, orden_ruta: form.orden_ruta }).select().single()
        if (error) { globalToast('Error: ' + error.message, 'error'); return }
        if (nuevo && numero_cuenta) saveCuenta(nuevo.id, numero_cuenta)
        globalToast('Cliente creado ✓')
      }
      setOpen(false); setEditing(null); setForm(emptyForm)
      await renumerarTodos()
    } catch (err: any) { globalToast('Error: ' + err.message, 'error') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este cliente?')) return
    try {
      const { data: cDel } = await supabase.from('clientes').select('orden_ruta').eq('id', id).single()
      await supabase.from('pedidos_modelo').delete().eq('cliente_id', id)
      await supabase.from('suspensiones_pedido').delete().eq('cliente_id', id)
      await supabase.from('clientes').delete().eq('id', id)
      deleteCuenta(id)
      const ordenActual = cDel?.orden_ruta || 0
      if (ordenActual > 0) {
        const { data: rest } = await supabase.from('clientes').select('id, orden_ruta').gt('orden_ruta', ordenActual).order('orden_ruta')
        if (rest) for (const c of rest) await supabase.from('clientes').update({ orden_ruta: (c.orden_ruta || 1) - 1 }).eq('id', c.id)
      }
      globalToast('✅ Cliente eliminado'); await renumerarTodos()
    } catch (err: any) { globalToast(err.message, 'error') }
  }

  const handleDrop = async (toIdx: number) => {
    if (dragIdx === null || dragIdx === toIdx) { setDragIdx(null); setDragOver(null); return }
    // Reorder the list
    const newList = [...rutaList]
    const [moved] = newList.splice(dragIdx, 1)
    newList.splice(toIdx, 0, moved)
    // Save new order to Supabase
    for (let i = 0; i < newList.length; i++) {
      await supabase.from('clientes').update({ orden_ruta: i + 1 }).eq('id', newList[i].id)
    }
    setDragIdx(null); setDragOver(null)
    await load()
  }

  const moveRuta = async (idx: number, dir: -1 | 1) => {
    const rl = [...clientes].sort((a, b) => (a.orden_ruta || 0) - (b.orden_ruta || 0))
    const target = idx + dir; if (target < 0 || target >= rl.length) return
    const a = rl[idx], b = rl[target]
    await supabase.from('clientes').update({ orden_ruta: b.orden_ruta }).eq('id', a.id)
    await supabase.from('clientes').update({ orden_ruta: a.orden_ruta }).eq('id', b.id)
    await load()
  }

  const verHistorial = async (c: any) => {
    setHistorialCliente(c); setLoadingHistorial(true)
    const { data } = await supabase.from('pedidos').select('fecha, cantidad, precio, iva, productos(nombre)').eq('cliente_id', c.id).order('fecha', { ascending: false }).limit(200)
    setHistorialPedidos(data || []); setLoadingHistorial(false)
  }

  const pedirPin = (id: string) => { setClientePinId(id); setPinInput(''); setPinVisible(true) }

  const verificarPin = () => {
    if (pinInput === PIN_CUENTAS) {
      if (clientePinId) setCuentasVisibles(prev => new Set([...prev, clientePinId]))
      setPinVisible(false); setPinInput(''); globalToast('✅ Acceso autorizado')
    } else { globalToast('❌ PIN incorrecto', 'error'); setPinInput('') }
  }

  const filtered = clientes.filter(c => {
    if (search && !c.nombre?.toLowerCase().includes(search.toLowerCase()) && !c.codigo?.toString().includes(search) && !c.direccion?.toLowerCase().includes(search.toLowerCase()) && !c.telefono1?.includes(search)) return false
    if (filterPoblacion !== 'all' && c.poblacion !== filterPoblacion) return false
    if (filterPago !== 'all' && c.forma_pago !== filterPago) return false
    if (soloDeudores && !(deudas[c.id] > 0)) return false
    return true
  })

  const rutaList = [...clientes].sort((a, b) => (a.orden_ruta || 0) - (b.orden_ruta || 0))
  const cuentas = getCuentas()

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">👥 Clientes <span style={{ fontSize: '1rem', color: 'var(--gris)', fontWeight: 700 }}>({clientes.length})</span></h1>
        <div className="page-actions">
          <button className={`btn btn-sm ${soloDeudores ? 'btn-danger' : 'btn-secondary'}`} onClick={() => setSoloDeudores(!soloDeudores)}>
            {soloDeudores ? '⚠️ Solo deudores' : '💰 Deudores'}
          </button>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gris)' }} />
            <input className="input" style={{ paddingLeft: 32, width: 200 }} placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
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
        <div className={`tab ${tab === 'lista' ? 'active' : ''}`} onClick={() => setTab('lista')}>📋 Lista ({filtered.length})</div>
        <div className={`tab ${tab === 'ruta' ? 'active' : ''}`} onClick={() => setTab('ruta')}>🗺️ Orden de ruta</div>
      </div>

      {/* ── LISTA ── */}
      {tab === 'lista' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>Ruta</th>
                  <th style={{ width: 55 }}>Cód.</th>
                  <th>Nombre / Dirección</th>
                  <th>Zona</th>
                  <th>Pago</th>
                  <th>Teléfono</th>
                  <th>Deuda</th>
                  <th style={{ width: 150, textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const rutaPos = rutaList.findIndex(r => r.id === c.id) + 1
                  return (
                  <tr key={c.id}>
                    <td><span style={{ fontFamily: 'Fredoka One', color: 'var(--naranja)' }}>#{rutaPos}</span></td>
                    <td><strong style={{ color: 'var(--marron)' }}>{c.codigo}</strong></td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{c.nombre}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--gris)' }}>{c.direccion}</div>
                      {c.tipo_cliente === 'empresa' && (
                        <div style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 700, marginTop: 2 }}>
                          🏢 {c.razon_social} · CIF: {c.cif}
                        </div>
                      )}
                      {c.es_alterno && <span className="badge badge-yellow" style={{ fontSize: '0.62rem' }}>Alterno</span>}
                      {c.observaciones && <span style={{ fontSize: '0.7rem', background: '#fef3c7', color: '#92400e', borderRadius: 5, padding: '1px 6px', fontWeight: 700, marginLeft: 4 }}>📝 {c.observaciones}</span>}
                      {c.forma_pago === 'Domiciliación' && cuentas[c.id] && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <Lock size={10} color="#ca8a04" />
                          {cuentasVisibles.has(c.id)
                            ? <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#92400e', fontWeight: 700 }}>{cuentas[c.id]}</span>
                            : <span style={{ fontSize: '0.7rem', color: '#ca8a04', fontWeight: 700 }}>IBAN ••••••</span>}
                          <button onClick={() => cuentasVisibles.has(c.id) ? setCuentasVisibles(prev => { const n = new Set(prev); n.delete(c.id); return n }) : pedirPin(c.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#ca8a04' }}>
                            {cuentasVisibles.has(c.id) ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                        </div>
                      )}
                    </td>
                    <td><span className={`badge ${ZONA_BADGE[c.poblacion] || 'badge-gray'}`} style={{ fontSize: '0.65rem' }}>{c.poblacion}</span></td>
                    <td><span className={`badge ${c.forma_pago === 'Domiciliación' ? 'badge-yellow' : c.forma_pago === 'Efectivo' ? 'badge-green' : 'badge-blue'}`}>{c.forma_pago}</span></td>
                    <td style={{ fontSize: '0.82rem' }}>{c.telefono1}</td>
                    <td>
                      {deudas[c.id] > 0
                        ? <span style={{ color: '#dc2626', fontWeight: 800, fontSize: '0.8rem' }}>💰 {deudas[c.id].toFixed(2)} €</span>
                        : <span style={{ color: '#16a34a', fontSize: '0.8rem' }}>✅</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button className="btn btn-primary btn-sm" style={{ padding: '5px 10px', fontSize: '0.78rem' }} onClick={() => openEdit(c)} title="Editar">
                          <Edit2 size={13} /> Editar
                        </button>
                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => verHistorial(c)} title="Historial">📋</button>
                        <button style={{ background: c.telefono1 ? '#25D366' : '#ccc', color: 'white', border: 'none', borderRadius: 6, padding: '5px 8px', cursor: c.telefono1 ? 'pointer' : 'not-allowed', fontSize: '0.78rem' }}
                          onClick={() => {
                            if (!c.telefono1) return
                            const tel = c.telefono1.replace(/\D/g, '')
                            const msg = deudas[c.id] > 0
                              ? encodeURIComponent(`Hola ${c.nombre}, tiene una deuda de ${deudas[c.id].toFixed(2)}€. Gracias, TelePan 🍞`)
                              : encodeURIComponent(`Hola ${c.nombre}, le contactamos desde TelePan Henares 🍞`)
                            window.open(`https://wa.me/34${tel}?text=${msg}`, '_blank')
                          }} title="WhatsApp">📱</button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(c.id)} title="Eliminar"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={8}><div className="empty-state"><p>No hay clientes</p></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── RUTA ── */}
      {tab === 'ruta' && (
        <div>
          <div style={{ background: '#fff8f0', border: '1px solid #f5e8d8', borderRadius: 12, padding: '10px 16px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--marron)', fontWeight: 700 }}>🗺️ Arrastra los clientes para reordenar tu ruta · También puedes usar las flechas ↑↓</span>
            <button className="btn btn-secondary btn-sm" onClick={async () => {
              if (!confirm('¿Limpiar la numeración? Se renumerarán todos los clientes del 1 al ' + rutaList.length + ' sin duplicados.')) return
              await renumerarTodos()
              globalToast('✅ Numeración corregida')
            }}>🔢 Limpiar numeración</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rutaList.map((c, idx) => (
              <div key={c.id}
                draggable
                onDragStart={() => setDragIdx(idx)}
                onDragOver={e => { e.preventDefault(); setDragOver(idx) }}
                onDrop={() => handleDrop(idx)}
                onDragEnd={() => { setDragIdx(null); setDragOver(null) }}
                className="card" style={{
                  padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
                  cursor: 'grab',
                  border: dragOver === idx ? '2px solid var(--naranja)' : '1px solid #f5e8d8',
                  opacity: dragIdx === idx ? 0.4 : 1,
                  background: dragOver === idx ? '#fff8f0' : 'white',
                  transition: 'all 0.15s'
                }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: dragOver === idx ? 'var(--naranja)' : '#f5e8d8', color: dragOver === idx ? 'white' : 'var(--naranja)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fredoka One', flexShrink: 0, fontSize: '1rem', transition: 'all 0.15s' }}>
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

      {/* ── MODAL CLIENTE ── */}
      {open && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">{editing ? '✏️ Editar Cliente' : '➕ Nuevo Cliente'}</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setOpen(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {/* TIPO: PARTICULAR / EMPRESA */}
              <div className="input-group">
                <label className="input-label">Tipo de cliente</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {(['particular', 'empresa'] as const).map(tipo => (
                    <label key={tipo} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1, padding: '10px 14px', borderRadius: 10, border: `2px solid ${form.tipo_cliente === tipo ? 'var(--naranja)' : '#e5e7eb'}`, background: form.tipo_cliente === tipo ? '#fff8f0' : 'white', fontWeight: 700, fontSize: '0.9rem' }}>
                      <input type="radio" name="tipo_cliente" value={tipo} checked={form.tipo_cliente === tipo} onChange={() => f('tipo_cliente', tipo)} style={{ accentColor: '#E8670A' }} />
                      {tipo === 'particular' ? '👤 Particular' : '🏢 Empresa'}
                    </label>
                  ))}
                </div>
              </div>

              {/* DATOS EMPRESA */}
              {form.tipo_cliente === 'empresa' && (
                <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 12, padding: '14px', marginBottom: 12 }}>
                  <div style={{ fontWeight: 800, color: '#1e40af', fontSize: '0.85rem', marginBottom: 12 }}>
                    🏢 Datos fiscales — necesarios para facturas válidas en España
                  </div>
                  <div className="input-group">
                    <label className="input-label">Razón Social *</label>
                    <input className="input" placeholder="Nombre oficial de la empresa" value={form.razon_social} onChange={e => f('razon_social', e.target.value)} />
                  </div>
                  <div className="form-grid-2">
                    <div className="input-group">
                      <label className="input-label">CIF / NIF *</label>
                      <input className="input" placeholder="B12345678" value={form.cif} onChange={e => f('cif', e.target.value.toUpperCase())} />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Email facturación</label>
                      <input className="input" type="email" placeholder="facturacion@empresa.com" value={form.email} onChange={e => f('email', e.target.value)} />
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem', marginBottom: 8 }}>
                    📍 Dirección fiscal (si es distinta a la de entrega):
                  </div>
                  <div className="input-group">
                    <label className="input-label">Dirección fiscal</label>
                    <input className="input" placeholder="Calle, número..." value={form.direccion_fiscal} onChange={e => f('direccion_fiscal', e.target.value)} />
                  </div>
                  <div className="form-grid-2">
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label className="input-label">C.P. fiscal</label>
                      <input className="input" placeholder="28001" value={form.cp_fiscal} onChange={e => f('cp_fiscal', e.target.value)} />
                    </div>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label className="input-label">Población fiscal</label>
                      <input className="input" value={form.poblacion_fiscal} onChange={e => f('poblacion_fiscal', e.target.value)} />
                    </div>
                  </div>
                  <div className="input-group" style={{ marginTop: 10, marginBottom: 0 }}>
                    <label className="input-label">Provincia fiscal</label>
                    <input className="input" value={form.provincia_fiscal} onChange={e => f('provincia_fiscal', e.target.value)} />
                  </div>
                </div>
              )}

              <div className="form-grid-2">
                <div className="input-group"><label className="input-label">Código</label><input className="input" value={form.codigo} onChange={e => f('codigo', e.target.value)} /></div>
                <div className="input-group"><label className="input-label">Nº en ruta</label><input className="input" type="number" value={form.orden_ruta} onChange={e => f('orden_ruta', parseInt(e.target.value) || 0)} /></div>
              </div>
              <div className="input-group"><label className="input-label">Nombre *</label><input className="input" value={form.nombre} onChange={e => f('nombre', e.target.value)} /></div>
              <div className="input-group"><label className="input-label">Dirección</label><input className="input" value={form.direccion} onChange={e => f('direccion', e.target.value)} /></div>
              <div className="form-grid-2">
                <div className="input-group"><label className="input-label">Código Postal</label><input className="input" value={form.codigo_postal} onChange={e => f('codigo_postal', e.target.value)} /></div>
                <div className="input-group"><label className="input-label">Provincia</label><input className="input" value={form.provincia} onChange={e => f('provincia', e.target.value)} /></div>
              </div>
              <div className="input-group">
                <label className="input-label">Zona / Población</label>
                <select className="select" value={form.poblacion} onChange={e => { const p = e.target.value; f('poblacion', p); if (!editing) { f('codigo', nextCodigo(p)); f('orden_ruta', nextOrdenRuta(p)) } }}>
                  {POBLACIONES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-grid-2">
                <div className="input-group"><label className="input-label">Teléfono 1</label><input className="input" value={form.telefono1} onChange={e => f('telefono1', e.target.value)} /></div>
                <div className="input-group"><label className="input-label">Teléfono 2</label><input className="input" value={form.telefono2} onChange={e => f('telefono2', e.target.value)} /></div>
              </div>
              <div className="input-group">
                <label className="input-label">Forma de pago</label>
                <select className="select" value={form.forma_pago} onChange={e => f('forma_pago', e.target.value)}>
                  {FORMAS_PAGO.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              {form.forma_pago === 'Domiciliación' && (
                <div className="input-group" style={{ background: '#fff8f0', border: '1.5px solid #f5e8d8', borderRadius: 10, padding: '10px 12px' }}>
                  <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Lock size={13} color="#ca8a04" /> IBAN — Solo visible con PIN</label>
                  <input className="input" type="password" value={form.numero_cuenta} onChange={e => f('numero_cuenta', e.target.value)} placeholder="ES00 0000 0000 0000 0000 0000" autoComplete="off" />
                  <p style={{ fontSize: '0.72rem', color: '#92400e', marginTop: 4 }}>🔒 Solo en tu dispositivo. PIN: Telepan8</p>
                </div>
              )}
              <div className="input-group"><label className="input-label">Observaciones (visible en pedidos)</label><textarea className="textarea" rows={2} value={form.observaciones} onChange={e => f('observaciones', e.target.value)} /></div>
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

      {/* ── MODAL PIN ── */}
      {pinVisible && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPinVisible(false)}>
          <div className="modal" style={{ maxWidth: 320 }}>
            <div className="modal-header">
              <h3 className="modal-title"><Lock size={16} /> PIN de seguridad</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setPinVisible(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.85rem', color: 'var(--gris)', marginBottom: 12 }}>🔒 Introduce el PIN para ver el número de cuenta.</p>
              <input className="input" type="password" placeholder="PIN" value={pinInput} onChange={e => setPinInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && verificarPin()} autoFocus style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '0.2em' }} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPinVisible(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={verificarPin}>🔓 Desbloquear</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL HISTORIAL ── */}
      {historialCliente && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setHistorialCliente(null)}>
          <div className="modal" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3 className="modal-title">📋 Historial — {historialCliente.nombre}</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setHistorialCliente(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {loadingHistorial ? <p style={{ textAlign: 'center' }}>Cargando...</p> : historialPedidos.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--gris)' }}>Sin pedidos registrados</p> : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
                    {[
                      { label: 'PEDIDOS', value: historialPedidos.length, color: 'var(--naranja)' },
                      { label: 'UNIDADES', value: historialPedidos.reduce((s, p) => s + Number(p.cantidad), 0), color: '#2563eb' },
                      { label: 'FACTURADO', value: historialPedidos.reduce((s, p) => s + Number(p.cantidad) * Number(p.precio) * (1 + Number(p.iva) / 100), 0).toFixed(2) + ' €', color: '#16a34a' },
                    ].map(k => (
                      <div key={k.label} style={{ background: '#fff8f0', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                        <div style={{ fontFamily: 'Fredoka One', fontSize: '1.3rem', color: k.color }}>{k.value}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--gris)', fontWeight: 800 }}>{k.label}</div>
                      </div>
                    ))}
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
                            <td><strong style={{ color: 'var(--naranja)' }}>{(Number(p.cantidad) * Number(p.precio) * (1 + Number(p.iva) / 100)).toFixed(2)} €</strong></td>
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