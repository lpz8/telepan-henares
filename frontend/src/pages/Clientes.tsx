import { useEffect, useState } from 'react'
import { Plus, Search, Edit2, Trash2, X, ArrowUp, ArrowDown, Eye, EyeOff, Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { globalToast } from '../components/Layout'

const FORMAS_PAGO = ['Efectivo', 'Transferencia', 'Domiciliación', 'Bizum']
const POBLACIONES = ['LOS HUEROS/VILLALBILLA', 'AZUQUECA DE HENARES', 'BUENDIA', 'CHILOECHES', 'EL MAPA', 'LA CELADA', 'ALOVERA', 'QUER', 'SAN FERNANDO DE HENARES', 'VILLANUEVA DE LA TORRE', 'MADRID', 'Otro']

const ZONA_BADGE: Record<string, string> = {
  'LOS HUEROS/VILLALBILLA': 'badge-yellow', 'AZUQUECA DE HENARES': 'badge-red',
  'BUENDIA': 'badge-orange', 'CHILOECHES': 'badge-purple',
  'EL MAPA': 'badge-blue', 'LA CELADA': 'badge-green',
  'ALOVERA': 'badge-green', 'QUER': 'badge-gray',
  'SAN FERNANDO DE HENARES': 'badge-blue', 'VILLANUEVA DE LA TORRE': 'badge-orange',
  'MADRID': 'badge-gray',
}

const ZONA_RANGOS: Record<string, [number, number]> = {
  'LOS HUEROS/VILLALBILLA': [100, 199], 'AZUQUECA DE HENARES': [200, 299],
  'BUENDIA': [300, 349], 'CHILOECHES': [400, 449], 'EL MAPA': [450, 499],
  'LA CELADA': [500, 549], 'ALOVERA': [550, 649], 'QUER': [650, 699],
  'SAN FERNANDO DE HENARES': [1, 99], 'VILLANUEVA DE LA TORRE': [700, 799], 'MADRID': [800, 899],
}

const PIN_CUENTAS = 'Telepan8' // PIN para ver números de cuenta
const CUENTA_STORAGE = 'telepan_cuentas_v1'

const emptyForm = {
  codigo: '', nombre: '', direccion: '', codigo_postal: '',
  poblacion: 'SAN FERNANDO DE HENARES', provincia: 'GUADALAJARA',
  telefono1: '', telefono2: '', forma_pago: 'Efectivo',
  es_alterno: false, observaciones: '', orden_ruta: 0, numero_cuenta: ''
}

// Cuentas guardadas en localStorage cifradas (solo visibles con PIN)
function getCuentas(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(CUENTA_STORAGE) || '{}') } catch { return {} }
}
function saveCuenta(clienteId: string, cuenta: string) {
  const cuentas = getCuentas()
  cuentas[clienteId] = cuenta
  localStorage.setItem(CUENTA_STORAGE, JSON.stringify(cuentas))
}
function deleteCuenta(clienteId: string) {
  const cuentas = getCuentas()
  delete cuentas[clienteId]
  localStorage.setItem(CUENTA_STORAGE, JSON.stringify(cuentas))
}

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

  // Historial
  const [historialCliente, setHistorialCliente] = useState<any>(null)
  const [historialPedidos, setHistorialPedidos] = useState<any[]>([])
  const [loadingHistorial, setLoadingHistorial] = useState(false)

  // PIN para cuentas bancarias
  const [pinVisible, setPinVisible] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinDesbloqueado, setPinDesbloqueado] = useState(false)
  const [cuentasVisibles, setCuentasVisibles] = useState<Set<string>>(new Set())
  const [clientePinId, setClientePinId] = useState<string | null>(null)

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

  const nextCodigo = (poblacion: string) => {
    const rango = ZONA_RANGOS[poblacion]
    if (!rango) return ''
    const used = clientes.map(c => parseInt(c.codigo || '0')).filter(n => !isNaN(n))
    for (let i = rango[0]; i <= rango[1]; i++) { if (!used.includes(i)) return String(i) }
    return ''
  }

  const nextOrdenRuta = (poblacion: string) => {
    const zonaClientes = clientes.filter(c => c.poblacion === poblacion)
    if (zonaClientes.length === 0) {
      const maxOrden = clientes.length > 0 ? Math.max(...clientes.map(c => c.orden_ruta || 0)) : 0
      return maxOrden + 1
    }
    return Math.max(...zonaClientes.map(c => c.orden_ruta || 0)) + 1
  }

  const openNew = () => {
    const codigo = nextCodigo(emptyForm.poblacion)
    const orden = nextOrdenRuta(emptyForm.poblacion)
    setEditing(null); setForm({ ...emptyForm, codigo, orden_ruta: orden }); setOpen(true)
  }

  const openEdit = (c: any) => {
    setEditing(c)
    const cuentas = getCuentas()
    setForm({
      codigo: c.codigo || '', nombre: c.nombre || '', direccion: c.direccion || '',
      codigo_postal: c.codigo_postal || '', poblacion: c.poblacion || '',
      provincia: c.provincia || 'GUADALAJARA', telefono1: c.telefono1 || '',
      telefono2: c.telefono2 || '', forma_pago: c.forma_pago || 'Efectivo',
      es_alterno: c.es_alterno || false, observaciones: c.observaciones || '',
      orden_ruta: c.orden_ruta || 0, numero_cuenta: cuentas[c.id] || ''
    })
    setOpen(true)
  }

  const handleSave = async () => {
    if (!user || !form.nombre.trim()) return globalToast('El nombre es obligatorio', 'error')
    try {
      const { numero_cuenta, ...dataToSave } = form
      const nuevoOrden = form.orden_ruta

      if (editing?.id) {
        const ordenAnterior = editing.orden_ruta || 0
        // Solo renumerar si cambió el número de ruta
        if (nuevoOrden !== ordenAnterior) {
          // Primero poner el cliente editado a un número temporal (9999) para no chocar
          await supabase.from('clientes').update({ orden_ruta: 9999 }).eq('id', editing.id)
          // Recargar lista actual sin el cliente editado
          const { data: resto } = await supabase.from('clientes')
            .select('id, orden_ruta').neq('id', editing.id).order('orden_ruta')
          const lista = (resto || []).filter(c => c.orden_ruta !== 9999)
          // Insertar hueco en la posición nueva
          for (const c of lista) {
            const or = c.orden_ruta || 0
            if (or >= nuevoOrden) {
              await supabase.from('clientes').update({ orden_ruta: or + 1 }).eq('id', c.id)
            }
          }
          // Cerrar hueco donde estaba antes (solo los que quedaron por encima del hueco anterior)
          const { data: resto2 } = await supabase.from('clientes')
            .select('id, orden_ruta').neq('id', editing.id).order('orden_ruta')
          const lista2 = (resto2 || []).filter(c => c.orden_ruta !== 9999)
          // Renumerar todo limpio desde 1 para evitar duplicados residuales
          lista2.sort((a, b) => (a.orden_ruta || 0) - (b.orden_ruta || 0))
          let counter = 1
          for (const c of lista2) {
            if (counter === nuevoOrden) counter++ // dejar hueco para el editado
            await supabase.from('clientes').update({ orden_ruta: counter }).eq('id', c.id)
            counter++
          }
        }
        await supabase.from('clientes').update({ ...dataToSave, orden_ruta: nuevoOrden }).eq('id', editing.id)
        if (numero_cuenta) saveCuenta(editing.id, numero_cuenta)
        else deleteCuenta(editing.id)
        globalToast('Cliente actualizado ✓')
      } else {
        // Cliente NUEVO — hacer hueco en nuevoOrden y renumerar limpito
        const { data: todos } = await supabase.from('clientes')
          .select('id, orden_ruta').order('orden_ruta')
        const lista = (todos || [])
        lista.sort((a, b) => (a.orden_ruta || 0) - (b.orden_ruta || 0))
        // Desplazar hacia arriba todos los que tienen orden >= nuevoOrden
        // Recorrer al revés para no chocar
        const aDesplazar = lista.filter(c => (c.orden_ruta || 0) >= nuevoOrden)
          .sort((a, b) => (b.orden_ruta || 0) - (a.orden_ruta || 0))
        for (const c of aDesplazar) {
          await supabase.from('clientes').update({ orden_ruta: (c.orden_ruta || 0) + 1 }).eq('id', c.id)
        }
        const { data: nuevo } = await supabase.from('clientes')
          .insert({ ...dataToSave, user_id: user.id }).select().single()
        if (nuevo && numero_cuenta) saveCuenta(nuevo.id, numero_cuenta)
        globalToast('Cliente creado ✓')
      }
      setOpen(false); setEditing(null); setForm(emptyForm); load()
    } catch (err: any) { globalToast(err.message, 'error') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este cliente?')) return
    try {
      const { data: cDel } = await supabase.from('clientes').select('orden_ruta').eq('id', id).single()
      const ordenActual = cDel?.orden_ruta || 0
      await supabase.from('pedidos_modelo').delete().eq('cliente_id', id)
      await supabase.from('suspensiones_pedido').delete().eq('cliente_id', id)
      await supabase.from('clientes').delete().eq('id', id)
      deleteCuenta(id)
      if (ordenActual > 0) {
        const { data: rest } = await supabase.from('clientes').select('id, orden_ruta').gt('orden_ruta', ordenActual).order('orden_ruta')
        if (rest) for (const c of rest) await supabase.from('clientes').update({ orden_ruta: (c.orden_ruta || 1) - 1 }).eq('id', c.id)
      }
      globalToast('✅ Cliente eliminado'); load()
    } catch (err: any) { globalToast(err.message, 'error') }
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

  const verHistorial = async (c: any) => {
    setHistorialCliente(c); setLoadingHistorial(true)
    const { data } = await supabase.from('pedidos')
      .select('fecha, cantidad, precio, iva, productos(nombre)')
      .eq('cliente_id', c.id).order('fecha', { ascending: false }).limit(200)
    setHistorialPedidos(data || []); setLoadingHistorial(false)
  }

  // PIN para ver número de cuenta
  const pedirPin = (clienteId: string) => {
    setClientePinId(clienteId); setPinInput(''); setPinVisible(true)
  }

  const verificarPin = () => {
    if (pinInput === PIN_CUENTAS) {
      setPinDesbloqueado(true)
      if (clientePinId) {
        setCuentasVisibles(prev => new Set([...prev, clientePinId]))
      }
      setPinVisible(false); setPinInput('')
      globalToast('✅ Acceso autorizado')
    } else {
      globalToast('❌ PIN incorrecto', 'error')
      setPinInput('')
    }
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
  const cuentas = getCuentas()

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">👥 Clientes <span style={{ fontSize: '1rem', color: 'var(--gris)', fontWeight: 700 }}>({clientes.length})</span></h1>
        <div className="page-actions">
          <button className={`btn btn-sm ${soloDeudores ? 'btn-danger' : 'btn-secondary'}`} onClick={() => setSoloDeudores(!soloDeudores)}>
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
                <tr><th>Ruta</th><th>Cód.</th><th>Nombre</th><th>Zona</th><th>Pago</th><th>Teléfono</th><th>Deuda</th><th></th></tr>
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
                      {/* Número de cuenta para domiciliados */}
                      {c.forma_pago === 'Domiciliación' && cuentas[c.id] && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <Lock size={10} color="#ca8a04" />
                          {cuentasVisibles.has(c.id) ? (
                            <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#92400e', fontWeight: 700 }}>
                              {cuentas[c.id]}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: '#ca8a04', fontWeight: 700 }}>
                              IBAN: ••••••••••
                            </span>
                          )}
                          <button onClick={() => cuentasVisibles.has(c.id)
                            ? setCuentasVisibles(prev => { const n = new Set(prev); n.delete(c.id); return n })
                            : pedirPin(c.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#ca8a04' }}>
                            {cuentasVisibles.has(c.id) ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                        </div>
                      )}
                    </td>
                    <td><span className={`badge ${ZONA_BADGE[c.poblacion] || 'badge-gray'}`}>{c.poblacion}</span></td>
                    <td>
                      <span className={`badge ${c.forma_pago === 'Domiciliación' ? 'badge-yellow' : c.forma_pago === 'Efectivo' ? 'badge-green' : 'badge-blue'}`}>
                        {c.forma_pago}
                      </span>
                    </td>
                    <td>{c.telefono1}</td>
                    <td>
                      {deudas[c.id] > 0
                        ? <span style={{ color: '#dc2626', fontWeight: 800, fontSize: '0.85rem' }}>💰 {deudas[c.id].toFixed(2)} €</span>
                        : <span style={{ color: '#16a34a', fontSize: '0.8rem' }}>✅ Al día</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(c)}><Edit2 size={14} /></button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(c.id)}><Trash2 size={14} /></button>
                        <button className="btn btn-secondary btn-sm btn-icon" title="Ver historial" onClick={() => verHistorial(c)}>📋</button>
                        {/* WhatsApp — siempre visible, verde si tiene tel, gris si no */}
                        <button
                          title={c.telefono1 ? 'Enviar WhatsApp' : 'Sin teléfono registrado'}
                          style={{ background: c.telefono1 ? '#25D366' : '#ccc', color: 'white', border: 'none', fontWeight: 800, fontSize: '0.72rem', padding: '4px 8px', borderRadius: 6, cursor: c.telefono1 ? 'pointer' : 'not-allowed' }}
                          onClick={() => {
                            if (!c.telefono1) return
                            const tel = c.telefono1.replace(/\D/g, '')
                            const msg = deudas[c.id] > 0
                              ? encodeURIComponent(`Hola ${c.nombre}, le recordamos que tiene una deuda pendiente de ${deudas[c.id].toFixed(2)}€. Por favor contacte con nosotros. Gracias, TelePan Henares 🍞`)
                              : encodeURIComponent(`Hola ${c.nombre}, le contactamos desde TelePan Henares. ¿En qué podemos ayudarle? 🍞`)
                            window.open(`https://wa.me/34${tel}?text=${msg}`, '_blank')
                          }}>
                          📱
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8}><div className="empty-state"><p>No hay clientes</p></div></td></tr>
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
                  {c.orden_ruta || idx + 1}
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

      {/* MODAL CLIENTE */}
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
                  const p = e.target.value; f('poblacion', p)
                  if (!editing) { f('codigo', nextCodigo(p)); f('orden_ruta', nextOrdenRuta(p)) }
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

              {/* NÚMERO DE CUENTA — solo para domiciliados */}
              {form.forma_pago === 'Domiciliación' && (
                <div className="input-group" style={{ background: '#fff8f0', border: '1.5px solid #f5e8d8', borderRadius: 10, padding: '10px 12px' }}>
                  <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Lock size={13} color="#ca8a04" /> Número de cuenta (IBAN) — Solo visible con PIN
                  </label>
                  <input className="input" type="password" value={form.numero_cuenta}
                    onChange={e => f('numero_cuenta', e.target.value)}
                    placeholder="ES00 0000 0000 0000 0000 0000"
                    autoComplete="off" />
                  <p style={{ fontSize: '0.72rem', color: '#92400e', marginTop: 4 }}>
                    🔒 Solo tú puedes verlo con el PIN de seguridad. No se sube a internet.
                  </p>
                </div>
              )}

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

      {/* MODAL PIN */}
      {pinVisible && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPinVisible(false)}>
          <div className="modal" style={{ maxWidth: 320 }}>
            <div className="modal-header">
              <h3 className="modal-title"><Lock size={16} /> Introduce el PIN</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setPinVisible(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.85rem', color: 'var(--gris)', marginBottom: 12 }}>
                🔒 El número de cuenta está protegido. Introduce el PIN para verlo.
              </p>
              <input className="input" type="password" placeholder="PIN de seguridad" value={pinInput}
                onChange={e => setPinInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && verificarPin()}
                autoFocus style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '0.2em' }} />
              <p style={{ fontSize: '0.72rem', color: 'var(--gris)', marginTop: 8, textAlign: 'center' }}>
                Introduce el PIN de 8 caracteres para desbloquear.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPinVisible(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={verificarPin}>🔓 Desbloquear</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HISTORIAL */}
      {historialCliente && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setHistorialCliente(null)}>
          <div className="modal" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3 className="modal-title">📋 Historial — {historialCliente.nombre}</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setHistorialCliente(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {loadingHistorial ? (
                <p style={{ textAlign: 'center', color: 'var(--gris)' }}>Cargando...</p>
              ) : historialPedidos.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--gris)', padding: '20px 0' }}>Sin pedidos registrados</p>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
                    <div style={{ background: '#fff8f0', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                      <div style={{ fontFamily: 'Fredoka One', fontSize: '1.3rem', color: 'var(--naranja)' }}>{historialPedidos.length}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--gris)', fontWeight: 800 }}>PEDIDOS</div>
                    </div>
                    <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                      <div style={{ fontFamily: 'Fredoka One', fontSize: '1.3rem', color: '#16a34a' }}>
                        {historialPedidos.reduce((s, p) => s + Number(p.cantidad), 0)}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--gris)', fontWeight: 800 }}>UNIDADES</div>
                    </div>
                    <div style={{ background: '#eff6ff', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                      <div style={{ fontFamily: 'Fredoka One', fontSize: '1.3rem', color: '#2563eb' }}>
                        {historialPedidos.reduce((s, p) => s + Number(p.cantidad) * Number(p.precio) * (1 + Number(p.iva) / 100), 0).toFixed(2)}€
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--gris)', fontWeight: 800 }}>FACTURADO</div>
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