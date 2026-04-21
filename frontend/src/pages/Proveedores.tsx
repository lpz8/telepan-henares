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

  const load = async () => {
    const { data } = await supabase.from('proveedores').select('*').order('nombre')
    if (data) setProveedores(data)
  }

  useEffect(() => { load() }, [])

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

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">🚚 Proveedores</h1>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(empty); setOpen(true) }}>
          <Plus size={16} /> Nuevo
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Nombre</th><th>Contacto</th><th>Teléfono</th><th>Email</th><th>Dirección</th><th></th></tr>
            </thead>
            <tbody>
              {proveedores.map(p => (
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
                      <tr><th>Cód.</th><th>Artículo</th><th>Cat.</th><th>Me cobra</th><th>Yo vendo</th><th>Margen</th><th></th></tr>
                    </thead>
                    <tbody>
                      {precios.map((p: any) => {
                        const margen = Number(p.precio_pvp) - Number(p.precio_cliente)
                        const pct = p.precio_cliente > 0 ? (margen / Number(p.precio_cliente) * 100).toFixed(1) : '0'
                        return (
                          <tr key={p.id}>
                            <td style={{ fontSize: '0.75rem', color: 'var(--gris)' }}>{p.codigo || '—'}</td>
                            <td><strong>{p.articulo}</strong></td>
                            <td><span className="badge badge-gray">{p.categoria}</span></td>
                            <td style={{ color: '#dc2626', fontWeight: 700 }}>{Number(p.precio_cliente).toFixed(4)} €</td>
                            <td style={{ color: '#16a34a', fontWeight: 700 }}>{Number(p.precio_pvp).toFixed(2)} €</td>
                            <td>
                              <span style={{ color: margen >= 0 ? '#16a34a' : '#dc2626', fontWeight: 800, fontSize: '0.82rem' }}>
                                {margen >= 0 ? '+' : ''}{margen.toFixed(4)}€ ({pct}%)
                              </span>
                            </td>
                            <td>
                              <button className="btn btn-danger btn-sm btn-icon" onClick={() => eliminarPrecio(p.id)}>🗑</button>
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
    </div>
  )
}
