import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { globalToast } from '../components/Layout'

const empty = { nombre: '', contacto: '', telefono: '', direccion: '', email: '', notas: '' }

export default function Proveedores() {
  const { user } = useAuth()
  const [proveedores, setProveedores] = useState<any[]>([])
  const [openPrecios, setOpenPrecios] = useState<string | null>(null)
  const [precios, setPrecios] = useState<any[]>([])
  const [formPrecio, setFormPrecio] = useState({ articulo: '', codigo: '', precio_cliente: 0, precio_pvp: 0, categoria: 'Pan' })
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState(empty)
  const [busqueda, setBusqueda] = useState('')
  const [misProductos, setMisProductos] = useState<any[]>([])
  const [buscadorPVP, setBuscadorPVP] = useState<string | null>(null)
  const [busqProducto, setBusqProducto] = useState('')
  const [editandoPrecio, setEditandoPrecio] = useState<string | null>(null)
  const [pagoModal, setPagoModal] = useState<any>(null) // proveedor al que se paga
  const [pagoForm, setPagoForm] = useState({ concepto: '', importe: 0, forma_pago: 'Transferencia', fecha: new Date().toISOString().split('T')[0], notas: '' }) // id del precio en edición
  const [editValores, setEditValores] = useState({ precio_cliente: 0, precio_pvp: 0, articulo: '' })

  const load = async () => {
    const { data } = await supabase.from('proveedores').select('*').order('nombre')
    if (data) setProveedores(data)
  }

  // Cargar mis productos para sincronizar PVP
  const loadProductos = async () => {
    const { data } = await supabase.from('productos').select('id, nombre, precio_sin_iva, iva').order('nombre')
    if (data) setMisProductos(data)
  }

  useEffect(() => { load(); loadProductos() }, [])

  // Buscar producto coincidente por nombre (para auto-rellenar PVP)
  const buscarProductoCoincidente = (nombreArticulo: string) => {
    const n = nombreArticulo.toLowerCase().trim()
    return misProductos.find(p => {
      const pn = p.nombre.toLowerCase().trim()
      return pn === n || pn.includes(n) || n.includes(pn)
    })
  }

  // Auto-sincronizar PVP de todos los artículos de un proveedor
  const autoSincronizarPVP = async (proveedorId: string, preciosList: any[]) => {
    let actualizados = 0
    for (const precio of preciosList) {
      if (Number(precio.precio_pvp) > 0) continue // ya tiene PVP, no tocar
      const match = buscarProductoCoincidente(precio.articulo)
      if (match) {
        const pvp = Number(match.precio_sin_iva) * (1 + Number(match.iva || 4) / 100)
        await supabase.from('precios_proveedor').update({ precio_pvp: parseFloat(pvp.toFixed(4)) }).eq('id', precio.id)
        actualizados++
      }
    }
    return actualizados
  }

  const f = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const handleSave = async () => {
    if (!user || !form.nombre.trim()) return globalToast('El nombre es obligatorio', 'error')
    if (editing) {
      await supabase.from('proveedores').update(form).eq('id', editing.id)
    } else {
      await supabase.from('proveedores').insert({ ...form, user_id: user.id })
    }
    globalToast(editing ? 'Proveedor actualizado ✓' : 'Proveedor creado ✓')
    setOpen(false); setEditing(null); setForm(empty); load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar proveedor?')) return
    await supabase.from('proveedores').delete().eq('id', id)
    globalToast('Proveedor eliminado')
    load()
  }

  const verPrecios = async (proveedorId: string) => {
    const { data } = await supabase
      .from('precios_proveedor')
      .select('*')
      .eq('proveedor_id', proveedorId)
      .order('categoria').order('articulo')
    setPrecios(data || [])
    setOpenPrecios(proveedorId)

    // Auto-sincronizar PVP con mis productos
    if (data && data.length > 0 && misProductos.length > 0) {
      const actualizados = await autoSincronizarPVP(proveedorId, data)
      if (actualizados > 0) {
        // Recargar con los PVPs actualizados
        const { data: data2 } = await supabase
          .from('precios_proveedor')
          .select('*')
          .eq('proveedor_id', proveedorId)
          .order('categoria').order('articulo')
        setPrecios(data2 || [])
        globalToast(`✅ ${actualizados} precios PVP sincronizados automáticamente`)
      }
    }
  }

  const añadirPrecio = async () => {
    if (!formPrecio.articulo) return globalToast('El artículo es obligatorio', 'error')
    await supabase.from('precios_proveedor').insert({
      user_id: user?.id,
      proveedor_id: openPrecios,
      ...formPrecio
    })
    const { data } = await supabase.from('precios_proveedor').select('*').eq('proveedor_id', openPrecios).order('categoria').order('articulo')
    setPrecios(data || [])
    setFormPrecio({ articulo: '', codigo: '', precio_cliente: 0, precio_pvp: 0, categoria: 'Pan' })
    globalToast('✅ Artículo añadido')
  }

  const eliminarPrecio = async (id: string) => {
    await supabase.from('precios_proveedor').delete().eq('id', id)
    setPrecios(prev => prev.filter((p: any) => p.id !== id))
  }

  const registrarPago = async () => {
    if (!pagoModal || !user) return
    if (!pagoForm.concepto.trim()) return globalToast('El concepto es obligatorio', 'error')
    if (!pagoForm.importe || pagoForm.importe <= 0) return globalToast('El importe debe ser mayor que 0', 'error')
    await supabase.from('gastos').insert({
      user_id: user.id,
      concepto: pagoForm.concepto,
      categoria: '🚛 Proveedor',
      importe: pagoForm.importe,
      fecha: pagoForm.fecha,
      forma_pago: pagoForm.forma_pago,
      notas: 'Proveedor: ' + pagoModal.nombre + (pagoForm.notas ? ' — ' + pagoForm.notas : '')
    })
    globalToast('✅ Pago de ' + pagoForm.importe.toFixed(2) + '€ a ' + pagoModal.nombre + ' registrado en Gastos')
    setPagoModal(null)
    setPagoForm({ concepto: '', importe: 0, forma_pago: 'Transferencia', fecha: new Date().toISOString().split('T')[0], notas: '' })
  }

  const abrirEdicion = (p: any) => {
    setEditandoPrecio(p.id)
    setEditValores({ precio_cliente: Number(p.precio_cliente), precio_pvp: Number(p.precio_pvp), articulo: p.articulo })
    setBuscadorPVP(null)
  }

  const guardarEdicion = async () => {
    if (!editandoPrecio) return
    await supabase.from('precios_proveedor').update({
      articulo: editValores.articulo,
      precio_cliente: editValores.precio_cliente,
      precio_pvp: editValores.precio_pvp,
    }).eq('id', editandoPrecio)
    const { data } = await supabase.from('precios_proveedor').select('*').eq('proveedor_id', openPrecios).order('categoria').order('articulo')
    setPrecios(data || [])
    setEditandoPrecio(null)
    globalToast('✅ Artículo actualizado')
  }

  const filteredProv = proveedores.filter(p => {
    if (!busqueda.trim()) return true
    const q = busqueda.toLowerCase()
    return p.nombre?.toLowerCase().includes(q) ||
      p.telefono?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.contacto?.toLowerCase().includes(q)
  })

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">🚚 Proveedores</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gris)' }}>🔍</span>
            <input className="input" placeholder="Buscar proveedor..." value={busqueda}
              onChange={e => setBusqueda(e.target.value)} style={{ paddingLeft: 34, width: 200 }} />
          </div>
          <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(empty); setOpen(true) }}>
            <Plus size={16} /> Nuevo
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Nombre</th><th>Contacto</th><th>Teléfono</th><th>Email</th><th>Dirección</th><th></th></tr>
            </thead>
            <tbody>
              {filteredProv.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.nombre}</strong></td>
                  <td>{p.contacto}</td>
                  <td>{p.telefono}</td>
                  <td>{p.email}</td>
                  <td>{p.direccion}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => verPrecios(p.id)}>
                        📋 Precios
                      </button>
                      <button className="btn btn-success btn-sm" onClick={() => {
                        setPagoModal(p)
                        setPagoForm({ concepto: `Pago ${p.nombre}`, importe: 0, forma_pago: 'Transferencia', fecha: new Date().toISOString().split('T')[0], notas: '' })
                      }}>
                        💳 Pago
                      </button>
                      <button className="btn btn-secondary btn-sm btn-icon" onClick={() => {
                        setEditing(p)
                        setForm({ nombre: p.nombre, contacto: p.contacto || '', telefono: p.telefono || '', direccion: p.direccion || '', email: p.email || '', notas: p.notas || '' })
                        setOpen(true)
                      }}><Edit2 size={14} /></button>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(p.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {proveedores.length === 0 && (
                <tr><td colSpan={6}><div className="empty-state"><p>No hay proveedores</p><span>Pulsa "Nuevo" para añadir el primero</span></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal editar/crear proveedor */}
      {open && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">{editing ? '✏️ Editar' : '➕ Nuevo'} Proveedor</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setOpen(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">Nombre *</label>
                <input className="input" value={form.nombre} onChange={e => f('nombre', e.target.value)} />
              </div>
              <div className="form-grid-2">
                <div className="input-group">
                  <label className="input-label">Contacto</label>
                  <input className="input" value={form.contacto} onChange={e => f('contacto', e.target.value)} />
                </div>
                <div className="input-group">
                  <label className="input-label">Teléfono</label>
                  <input className="input" value={form.telefono} onChange={e => f('telefono', e.target.value)} />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Email</label>
                <input className="input" type="email" value={form.email} onChange={e => f('email', e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Dirección</label>
                <input className="input" value={form.direccion} onChange={e => f('direccion', e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Notas</label>
                <textarea className="input" rows={2} value={form.notas} onChange={e => f('notas', e.target.value)} style={{ resize: 'vertical' }} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave}>{editing ? '💾 Guardar' : '✅ Crear'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal precios proveedor */}
      {openPrecios && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setOpenPrecios(null)}>
          <div className="modal" style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <h3 className="modal-title">📋 Precios del proveedor</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setOpenPrecios(null)}>✕</button>
            </div>
            <div className="modal-body">
              {/* Formulario añadir precio */}
              <div style={{ background: 'var(--crema)', borderRadius: 10, padding: '12px', marginBottom: 14, border: '1px solid #f5e8d8' }}>
                <div style={{ fontFamily: 'Fredoka One', color: 'var(--marron)', marginBottom: 10 }}>➕ Añadir artículo</div>
                <div className="form-grid-2">
                  <div className="input-group" style={{ marginBottom: 8 }}>
                    <label className="input-label">Código</label>
                    <input className="input" value={formPrecio.codigo}
                      onChange={e => setFormPrecio(p => ({ ...p, codigo: e.target.value }))}
                      placeholder="001" />
                  </div>
                  <div className="input-group" style={{ marginBottom: 8 }}>
                    <label className="input-label">Artículo *</label>
                    <input className="input" value={formPrecio.articulo}
                      onChange={e => setFormPrecio(p => ({ ...p, articulo: e.target.value.toUpperCase() }))}
                      placeholder="NOMBRE DEL ARTÍCULO" />
                  </div>
                  <div className="input-group" style={{ marginBottom: 8 }}>
                    <label className="input-label">Precio que me cobra (€)</label>
                    <input className="input" type="number" step="0.0001" value={formPrecio.precio_cliente}
                      onChange={e => setFormPrecio(p => ({ ...p, precio_cliente: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div className="input-group" style={{ marginBottom: 8 }}>
                    <label className="input-label">Mi precio de venta (€)</label>
                    <input className="input" type="number" step="0.01" value={formPrecio.precio_pvp}
                      onChange={e => setFormPrecio(p => ({ ...p, precio_pvp: parseFloat(e.target.value) || 0 }))} />
                  </div>
                </div>
                <div className="input-group" style={{ marginBottom: 8 }}>
                  <label className="input-label">Categoría</label>
                  <select className="select" value={formPrecio.categoria}
                    onChange={e => setFormPrecio(p => ({ ...p, categoria: e.target.value }))}>
                    <option>Pan</option>
                    <option>Bollería</option>
                    <option>Huevos</option>
                    <option>Pastelería</option>
                    <option>Otros</option>
                  </select>
                </div>
                {formPrecio.precio_cliente > 0 && formPrecio.precio_pvp > 0 && (
                  <div style={{ background: formPrecio.precio_pvp > formPrecio.precio_cliente ? '#f0fdf4' : '#fef2f2', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: '0.85rem', fontWeight: 800 }}>
                    {formPrecio.precio_pvp > formPrecio.precio_cliente
                      ? `✅ Margen: ${(formPrecio.precio_pvp - formPrecio.precio_cliente).toFixed(4)}€ (${((formPrecio.precio_pvp - formPrecio.precio_cliente) / formPrecio.precio_cliente * 100).toFixed(1)}%)`
                      : `⚠️ Vendes por debajo del coste. Pérdida: ${(formPrecio.precio_cliente - formPrecio.precio_pvp).toFixed(4)}€`
                    }
                  </div>
                )}
                <button className="btn btn-primary btn-sm" onClick={añadirPrecio}>
                  Añadir artículo
                </button>
              </div>

              {/* Tabla de precios */}
              {precios.length > 0 ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Artículo proveedor</th>
                        <th style={{textAlign:'right'}}>Me cobra</th>
                        <th style={{textAlign:'right'}}>Yo vendo</th>
                        <th style={{textAlign:'right'}}>Margen</th>
                        <th style={{width:110}}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {precios.map((p: any) => {
                        const margen = Number(p.precio_pvp) - Number(p.precio_cliente)
                        const pct = p.precio_cliente > 0 ? (margen / Number(p.precio_cliente) * 100).toFixed(1) : '0'
                        const sinPVP = Number(p.precio_pvp) === 0
                        return (
                          <tr key={p.id} style={{ background: sinPVP ? '#fefce8' : 'white' }}>
                            <td>
                              <div style={{fontWeight:700}}>{p.articulo}</div>
                              <div style={{fontSize:'0.72rem',color:'var(--gris)'}}>{p.categoria}</div>
                            </td>
                            <td style={{textAlign:'right',color:'#dc2626',fontWeight:700}}>
                              {Number(p.precio_cliente).toFixed(4)} €
                            </td>
                            <td style={{textAlign:'right',fontWeight:700}}>
                              {sinPVP
                                ? <span style={{color:'#f59e0b'}}>⚠️ Sin vincular</span>
                                : <span style={{color:'#16a34a'}}>{Number(p.precio_pvp).toFixed(2)} €</span>
                              }
                            </td>
                            <td style={{textAlign:'right',fontSize:'0.8rem',fontWeight:800}}>
                              {!sinPVP && (
                                <span style={{color: margen >= 0 ? '#16a34a' : '#dc2626'}}>
                                  {margen >= 0 ? '+' : ''}{margen.toFixed(2)}€<br/>
                                  <span style={{fontSize:'0.72rem'}}>({pct}%)</span>
                                </span>
                              )}
                            </td>
                            <td style={{whiteSpace:'nowrap'}}>
                              <button className="btn btn-secondary btn-sm" style={{padding:'4px 8px',marginRight:3}}
                                title="Editar" onClick={() => abrirEdicion(p)}>✏️</button>
                              <button className="btn btn-secondary btn-sm" style={{padding:'4px 8px',marginRight:3}}
                                title="Vincular con mi producto"
                                onClick={() => { setBuscadorPVP(buscadorPVP === p.id ? null : p.id); setBusqProducto('') }}>🔍</button>
                              <button className="btn btn-danger btn-sm" style={{padding:'4px 8px'}}
                                onClick={() => eliminarPrecio(p.id)}>🗑️</button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--gris)' }}>
                  Sin artículos. Añade los precios del proveedor arriba.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* MODAL BUSCADOR PVP */}
      {buscadorPVP && (
        <div className="modal-overlay" onClick={() => setBuscadorPVP(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">🔍 Vincular con mi producto</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setBuscadorPVP(null)}><X size={16}/></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.85rem', color: 'var(--gris)', marginBottom: 12 }}>
                Busca tu producto equivalente para sincronizar el precio de venta:
              </p>
              <input className="input" placeholder="Escribe el nombre de tu producto..."
                value={busqProducto} onChange={e => setBusqProducto(e.target.value)} autoFocus />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto', marginTop: 10 }}>
                {misProductos
                  .filter(mp => !busqProducto || mp.nombre.toLowerCase().includes(busqProducto.toLowerCase()))
                  .slice(0, 20)
                  .map(mp => {
                    const pvp = Number(mp.precio_sin_iva) * (1 + Number(mp.iva || 4) / 100)
                    return (
                      <div key={mp.id}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', cursor: 'pointer' }}
                        onClick={async () => {
                          await supabase.from('precios_proveedor').update({ precio_pvp: parseFloat(pvp.toFixed(4)) }).eq('id', buscadorPVP)
                          const { data: d2 } = await supabase.from('precios_proveedor').select('*').eq('proveedor_id', openPrecios).order('categoria').order('articulo')
                          setPrecios(d2 || [])
                          setBuscadorPVP(null)
                          globalToast(`✅ Vinculado — PVP: ${pvp.toFixed(2)}€`)
                        }}>
                        <span style={{ fontWeight: 700 }}>{mp.nombre}</span>
                        <span style={{ color: '#16a34a', fontWeight: 800 }}>{pvp.toFixed(2)} €</span>
                      </div>
                    )
                  })
                }
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setBuscadorPVP(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR PRECIO */}
      {editandoPrecio && (
        <div className="modal-overlay" onClick={() => setEditandoPrecio(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">✏️ Editar artículo</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setEditandoPrecio(null)}><X size={16}/></button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">Nombre del artículo</label>
                <input className="input" value={editValores.articulo}
                  onChange={e => setEditValores(v => ({ ...v, articulo: e.target.value.toUpperCase() }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Me cobra el proveedor (€ sin IVA)</label>
                <input className="input" type="number" step="0.0001" min="0"
                  value={editValores.precio_cliente}
                  onChange={e => setEditValores(v => ({ ...v, precio_cliente: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Yo vendo al cliente (€ con IVA)</label>
                <input className="input" type="number" step="0.01" min="0"
                  value={editValores.precio_pvp}
                  onChange={e => setEditValores(v => ({ ...v, precio_pvp: parseFloat(e.target.value) || 0 }))} />
              </div>
              {editValores.precio_cliente > 0 && editValores.precio_pvp > 0 && (
                <div style={{ background: editValores.precio_pvp >= editValores.precio_cliente ? '#f0fdf4' : '#fef2f2', borderRadius: 8, padding: '10px 14px', fontWeight: 800, marginTop: 8 }}>
                  {editValores.precio_pvp >= editValores.precio_cliente
                    ? `✅ Margen: +${(editValores.precio_pvp - editValores.precio_cliente).toFixed(4)}€ (${((editValores.precio_pvp - editValores.precio_cliente) / editValores.precio_cliente * 100).toFixed(1)}%)`
                    : `⚠️ Vendes por debajo del coste`}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditandoPrecio(null)}>Cancelar</button>
              <button className="btn btn-success" onClick={guardarEdicion}>💾 Guardar</button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL REGISTRAR PAGO */}
      {pagoModal && (
        <div className="modal-overlay" onClick={() => setPagoModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">💳 Registrar pago — {pagoModal.nombre}</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setPagoModal(null)}><X size={16}/></button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">Concepto del pago *</label>
                <input className="input" value={pagoForm.concepto}
                  onChange={e => setPagoForm(v => ({ ...v, concepto: e.target.value }))}
                  placeholder="Ej: Liquidación mayo, Semanas 18-20..." />
              </div>
              <div className="form-grid-2">
                <div className="input-group">
                  <label className="input-label">Importe (€) *</label>
                  <input className="input" type="number" step="0.01" min="0"
                    value={pagoForm.importe}
                    onChange={e => setPagoForm(v => ({ ...v, importe: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Fecha del pago</label>
                  <input className="input" type="date" value={pagoForm.fecha}
                    onChange={e => setPagoForm(v => ({ ...v, fecha: e.target.value }))} />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Forma de pago</label>
                <select className="select" value={pagoForm.forma_pago}
                  onChange={e => setPagoForm(v => ({ ...v, forma_pago: e.target.value }))}>
                  <option>Transferencia</option>
                  <option>Bizum</option>
                  <option>Efectivo</option>
                  <option>Tarjeta</option>
                  <option>Domiciliación</option>
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Notas adicionales (opcional)</label>
                <input className="input" value={pagoForm.notas}
                  onChange={e => setPagoForm(v => ({ ...v, notas: e.target.value }))}
                  placeholder="Ej: Factura nº 456, referencia transferencia..." />
              </div>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', fontSize: '0.85rem', color: '#16a34a', fontWeight: 700 }}>
                ✅ Este pago se guardará automáticamente en <strong>Gastos</strong> con categoría 🚛 Proveedor
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPagoModal(null)}>Cancelar</button>
              <button className="btn btn-success" onClick={registrarPago}>💾 Registrar pago</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}