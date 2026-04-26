import { useEffect, useState } from 'react'
import { MapPin, ArrowUp, ArrowDown, Save, Plus, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { globalToast } from '../components/Layout'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const DIAS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const ZONA_EMOJI: Record<string, string> = {
  'SAN FERNANDO DE HENARES': '🔵',
  'ALOVERA': '🟢',
  'AZUQUECA DE HENARES': '🔴',
  'VILLANUEVA DE LA TORRE': '🟠',
  'CHILOECHES': '🟣',
  'LOS HUEROS/VILLALBILLA': '🟡',
  'MADRID': '⚫',
}

export default function Rutas() {
  const { user } = useAuth()
  const today = new Date().getDay()
  const [dia, setDia] = useState(today)
  const [tab, setTab] = useState<'ruta' | 'semana'>('ruta')
  const [rutaClientes, setRutaClientes] = useState<any[]>([])
  const [todosClientes, setTodosClientes] = useState<any[]>([])
  const [resumenSemana, setResumenSemana] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [clienteAdd, setClienteAdd] = useState('')

  const load = async () => {
    const [todos, modelos] = await Promise.all([
      supabase.from('clientes').select('*').order('orden_ruta').order('codigo'),
      supabase.from('pedidos_modelo')
        .select('cliente_id, dia_semana, cantidad, productos(nombre, precio_sin_iva), clientes(id, nombre, codigo, direccion, poblacion, orden_ruta, telefono1)')
        .eq('dia_semana', dia)
    ])
    if (todos.data) setTodosClientes(todos.data)
    if (modelos.data) {
      const unique = new Map<string, any>()
      modelos.data.forEach((m: any) => {
        const c = m.clientes
        if (c && !unique.has(c.id)) unique.set(c.id, c)
      })
      const sorted = Array.from(unique.values()).sort((a, b) => (a.orden_ruta || 0) - (b.orden_ruta || 0))
      setRutaClientes(sorted)
    }
  }

  const loadSemana = async () => {
    const { data: modelos } = await supabase
      .from('pedidos_modelo')
      .select('cliente_id, dia_semana, cantidad, productos(nombre, precio_sin_iva), clientes(id, nombre, codigo, poblacion, orden_ruta)')
    if (!modelos) return

    const semana = DIAS.map((nombreDia, diaIdx) => {
      const itemsDia = modelos.filter(m => m.dia_semana === diaIdx)
      const clientesUnicos = new Map<string, any>()
      itemsDia.forEach((m: any) => {
        const c = m.clientes
        if (!c) return
        if (!clientesUnicos.has(c.id)) {
          clientesUnicos.set(c.id, { ...c, productos: [], totalUnidades: 0 })
        }
        const entry = clientesUnicos.get(c.id)
        entry.productos.push(m.productos?.nombre || '—')
        entry.totalUnidades += Number(m.cantidad)
      })
      const lista = Array.from(clientesUnicos.values()).sort((a, b) => (a.orden_ruta || 0) - (b.orden_ruta || 0))
      const totalUd = lista.reduce((s, c) => s + c.totalUnidades, 0)
      return { dia: nombreDia, diaIdx, clientes: lista, totalUd }
    })
    setResumenSemana(semana)
  }

  useEffect(() => { load() }, [dia])
  useEffect(() => { if (tab === 'semana') loadSemana() }, [tab])

  const moveUp = async (idx: number) => {
    if (idx === 0) return
    const arr = [...rutaClientes]
    const a = arr[idx - 1], b = arr[idx]
    await supabase.from('clientes').update({ orden_ruta: b.orden_ruta }).eq('id', a.id)
    await supabase.from('clientes').update({ orden_ruta: a.orden_ruta }).eq('id', b.id)
    load()
  }

  const moveDown = async (idx: number) => {
    if (idx === rutaClientes.length - 1) return
    const arr = [...rutaClientes]
    const a = arr[idx], b = arr[idx + 1]
    await supabase.from('clientes').update({ orden_ruta: b.orden_ruta }).eq('id', a.id)
    await supabase.from('clientes').update({ orden_ruta: a.orden_ruta }).eq('id', b.id)
    load()
  }

  const saveOrder = async () => {
    setSaving(true)
    try {
      for (let i = 0; i < rutaClientes.length; i++) {
        await supabase.from('clientes').update({ orden_ruta: i + 1 }).eq('id', rutaClientes[i].id)
      }
      globalToast('Orden de ruta guardado ✓')
      load()
    } catch (err: any) { globalToast(err.message, 'error') }
    setSaving(false)
  }

  const addCliente = async () => {
    if (!user || !clienteAdd) return
    const { data: existing } = await supabase.from('pedidos_modelo').select('id').eq('cliente_id', clienteAdd).eq('dia_semana', dia)
    if (existing && existing.length > 0) { globalToast('Este cliente ya está en la ruta de este día', 'info'); return }
    const { data: prods } = await supabase.from('productos').select('id').limit(1)
    if (!prods?.length) { globalToast('No hay productos. Añade productos primero.', 'error'); return }
    await supabase.from('pedidos_modelo').insert({
      user_id: user.id, cliente_id: clienteAdd,
      producto_id: prods[0].id, dia_semana: dia, cantidad: 1
    })
    globalToast('Cliente añadido a la ruta ✓')
    setShowAdd(false); setClienteAdd(''); load()
  }

  const removeCliente = async (clienteId: string) => {
    if (!confirm('¿Quitar este cliente de la ruta de este día?')) return
    await supabase.from('pedidos_modelo').delete().eq('cliente_id', clienteId).eq('dia_semana', dia)
    globalToast('Cliente eliminado de la ruta')
    load()
  }

  const noEnRuta = todosClientes.filter(c => !rutaClientes.find(r => r.id === c.id))

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">🗺️ Rutas Diarias</h1>
        <div className="page-actions">
          {tab === 'ruta' && <>
            <select className="select" style={{ width: 'auto' }} value={dia} onChange={e => setDia(Number(e.target.value))}>
              {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
            <button className="btn btn-secondary" onClick={() => setShowAdd(true)}><Plus size={16} /> Añadir cliente</button>
            <button className="btn btn-primary" onClick={saveOrder} disabled={saving}><Save size={16} /> {saving ? 'Guardando...' : 'Guardar orden'}</button>
          </>}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <div className={`tab ${tab === 'ruta' ? 'active' : ''}`} onClick={() => setTab('ruta')}>🗺️ Ruta del día</div>
        <div className={`tab ${tab === 'semana' ? 'active' : ''}`} onClick={() => setTab('semana')}>📅 Resumen semanal</div>
      </div>

      {/* ── RUTA DEL DÍA ── */}
      {tab === 'ruta' && (
        <>
          {/* BUSCADOR */}
          <div style={{ position: 'relative', maxWidth: 280, marginBottom: 10 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gris)' }}>🔍</span>
            <input className="input" placeholder="Buscar cliente en ruta..." value={busqueda}
              onChange={e => setBusqueda(e.target.value)} style={{ paddingLeft: 34 }} />
          </div>
          <div style={{ background: '#fff8f0', border: '1px solid #f5e8d8', borderRadius: 12, padding: '10px 16px', marginBottom: 14, fontSize: '0.85rem', color: 'var(--marron)', fontWeight: 700 }}>
            📋 Ruta del {DIAS[dia]} — <strong style={{ color: 'var(--naranja)' }}>{rutaClientes.length} clientes</strong>
            <span style={{ fontWeight: 400, color: 'var(--gris)', marginLeft: 8 }}>Reordena con las flechas y guarda.</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {(busqueda.trim() ? rutaClientes.filter(c => c.nombre?.toLowerCase().includes(busqueda.toLowerCase()) || String(c.codigo)?.includes(busqueda)) : rutaClientes).map((c, idx) => (
              <div key={c.id} className="card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--naranja)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fredoka One', flexShrink: 0 }}>
                  {idx + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: 'Fredoka One', color: 'var(--naranja)', fontSize: '0.85rem' }}>#{c.codigo}</span>
                    <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</strong>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--gris)', marginTop: 1 }}>
                    {ZONA_EMOJI[c.poblacion] || '📍'} {c.poblacion}
                    {c.telefono1 && <> · 📞 {c.telefono1}</>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <button className="btn btn-secondary btn-sm btn-icon" onClick={() => moveUp(idx)} disabled={idx === 0}><ArrowUp size={13} /></button>
                    <button className="btn btn-secondary btn-sm btn-icon" onClick={() => moveDown(idx)} disabled={idx === rutaClientes.length - 1}><ArrowDown size={13} /></button>
                  </div>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeCliente(c.id)}><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
            {rutaClientes.length === 0 && (
              <div className="card"><div className="empty-state"><MapPin size={40} /><p>No hay clientes para el {DIAS[dia]}</p></div></div>
            )}
          </div>
        </>
      )}

      {/* ── RESUMEN SEMANAL ── */}
      {tab === 'semana' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 10, marginBottom: 16 }}>
            {resumenSemana.map((d, i) => (
              <div key={i} className="card" style={{ padding: '12px', textAlign: 'center', border: d.diaIdx === today ? '2px solid var(--naranja)' : '1px solid #f5e8d8', cursor: 'pointer' }}
                onClick={() => { setDia(d.diaIdx); setTab('ruta') }}>
                <div style={{ fontFamily: 'Fredoka One', color: d.diaIdx === today ? 'var(--naranja)' : 'var(--marron)', fontSize: '1rem' }}>
                  {d.diaIdx === today ? '⭐ ' : ''}{DIAS_SHORT[d.diaIdx]}
                </div>
                <div style={{ fontFamily: 'Fredoka One', fontSize: '1.6rem', color: 'var(--naranja)', margin: '4px 0' }}>{d.clientes.length}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--gris)', fontWeight: 700 }}>clientes</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--gris)', marginTop: 2 }}>{d.totalUd} unidades</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {resumenSemana.filter(d => d.clientes.length > 0).map((d, di) => (
              <div key={di} className="card" style={{ padding: 0, overflow: 'hidden', border: d.diaIdx === today ? '2px solid var(--naranja)' : '1px solid #f5e8d8' }}>
                <div style={{ padding: '10px 16px', background: d.diaIdx === today ? '#fff3e8' : 'var(--crema-dark)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'Fredoka One', color: 'var(--naranja)', fontSize: '1rem' }}>
                    {d.diaIdx === today ? '⭐ ' : ''}{d.dia}
                  </span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--gris)', fontWeight: 700 }}>
                    {d.clientes.length} clientes · {d.totalUd} unidades
                  </span>
                </div>
                <div style={{ padding: '8px 0' }}>
                  {d.clientes.map((c: any, ci: number) => (
                    <div key={ci} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 16px', borderBottom: ci < d.clientes.length - 1 ? '1px solid #faf5ef' : 'none' }}>
                      <span style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--naranja)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fredoka One', fontSize: '0.75rem', flexShrink: 0 }}>{ci + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--gris)' }}>{ZONA_EMOJI[c.poblacion] || '📍'} {c.poblacion}</div>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--gris)', textAlign: 'right', flexShrink: 0 }}>
                        {c.totalUnidades} ud
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal añadir cliente */}
      {showAdd && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3 className="modal-title">➕ Añadir cliente a ruta del {DIAS[dia]}</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowAdd(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <select className="select" value={clienteAdd} onChange={e => setClienteAdd(e.target.value)}>
                <option value="">Seleccionar cliente...</option>
                {noEnRuta.map(c => <option key={c.id} value={c.id}>#{c.codigo} — {c.nombre} ({c.poblacion})</option>)}
              </select>
              {noEnRuta.length === 0 && <p style={{ color: 'var(--gris)', fontSize: '0.85rem', marginTop: 8 }}>Todos los clientes ya están en esta ruta.</p>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={addCliente} disabled={!clienteAdd}>✅ Añadir a la ruta</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}