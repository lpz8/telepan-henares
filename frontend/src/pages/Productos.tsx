import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { globalToast } from '../components/Layout'

const CATEGORIAS = ['Pan', 'Bollería', 'Pastelería', 'Huevos', 'Otros']
const IVA_POR_CATEGORIA: Record<string, number> = {
  'Pan': 4, 'Bollería': 10, 'Pastelería': 10, 'Huevos': 4, 'Otros': 21
}
const empty = { nombre: '', categoria: 'Pan', precio_sin_iva: 0, iva: 4, activo: true }

export default function Productos() {
  const { user } = useAuth()
  const [productos, setProductos] = useState<any[]>([])
  const [filterCat, setFilterCat] = useState('all')
  const [busqueda, setBusqueda] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState(empty)

  const load = async () => {
    const { data } = await supabase.from('productos').select('*').order('categoria').order('nombre')
    if (data) setProductos(data)
  }
  useEffect(() => { load() }, [])

  const f = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const handleSave = async () => {
    if (!user || !form.nombre.trim()) return globalToast('El nombre es obligatorio', 'error')
    try {
      if (editing) {
        await supabase.from('productos').update(form).eq('id', editing.id)
        globalToast('Producto actualizado ✓')
      } else {
        await supabase.from('productos').insert({ ...form, user_id: user.id })
        globalToast('Producto creado ✓')
      }
      setOpen(false); setEditing(null); setForm(empty); load()
    } catch (err: any) { globalToast(err.message, 'error') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este producto?')) return
    await supabase.from('productos').delete().eq('id', id)
    globalToast('Producto eliminado')
    load()
  }

  const filtered = productos.filter(p => {
    if (filterCat !== 'all' && p.categoria !== filterCat) return false
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      if (!p.nombre?.toLowerCase().includes(q) && !p.categoria?.toLowerCase().includes(q)) return false
    }
    return true
  })
  const pvp = (p: any) => (Number(p.precio_sin_iva) * (1 + Number(p.iva) / 100)).toFixed(2)

  const ivaColor = (iva: number) => {
    if (iva <= 4) return 'badge-green'
    if (iva <= 10) return 'badge-orange'
    return 'badge-red'
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">📦 Productos</h1>
        <div className="page-actions">
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gris)' }}>🔍</span>
            <input className="input" placeholder="Buscar producto..." value={busqueda}
              onChange={e => setBusqueda(e.target.value)} style={{ paddingLeft: 34, width: 200 }} />
          </div>
          <select className="select" style={{ width: 'auto' }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="all">Todas las categorías</option>
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(empty); setOpen(true) }}>
            <Plus size={16} /> Nuevo
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Precio s/IVA</th>
                <th>IVA</th>
                <th>PVP</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.nombre}</strong></td>
                  <td>{p.categoria || 'Pan'}</td>
                  <td>{Number(p.precio_sin_iva).toFixed(2)} €</td>
                  <td><span className={`badge ${ivaColor(Number(p.iva))}`}>{p.iva}%</span></td>
                  <td><strong style={{ color: 'var(--naranja)' }}>{pvp(p)} €</strong></td>
                  <td>
                    <span className={`badge ${p.activo ? 'badge-green' : 'badge-gray'}`}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-secondary btn-sm btn-icon" onClick={() => {
                        setEditing(p)
                        setForm({ nombre: p.nombre, categoria: p.categoria || 'Pan', precio_sin_iva: Number(p.precio_sin_iva), iva: Number(p.iva), activo: p.activo ?? true })
                        setOpen(true)
                      }}><Edit2 size={14} /></button>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(p.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7}><div className="empty-state"><p>No hay productos</p></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">{editing ? '✏️ Editar Producto' : '➕ Nuevo Producto'}</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setOpen(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">Nombre *</label>
                <input className="input" value={form.nombre} onChange={e => f('nombre', e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Categoría</label>
                <select className="select" value={form.categoria} onChange={e => {
                  const cat = e.target.value
                  f('categoria', cat)
                  f('iva', IVA_POR_CATEGORIA[cat] || 4)
                }}>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-grid-2">
                <div className="input-group">
                  <label className="input-label">Precio sin IVA (€)</label>
                  <input className="input" type="number" step="0.01" value={form.precio_sin_iva} onChange={e => f('precio_sin_iva', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="input-group">
                  <label className="input-label">IVA (%)</label>
                  <select className="select" value={form.iva} onChange={e => f('iva', Number(e.target.value))}>
                    <option value={4}>4% (Pan, Huevos)</option>
                    <option value={10}>10% (Bollería)</option>
                    <option value={21}>21% (Otros)</option>
                  </select>
                </div>
              </div>
              <div style={{ background: 'var(--crema)', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
                <strong>PVP con IVA: </strong>
                <span style={{ color: 'var(--naranja)', fontFamily: 'Fredoka One', fontSize: '1.2rem' }}>
                  {(form.precio_sin_iva * (1 + form.iva / 100)).toFixed(2)} €
                </span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.activo} onChange={e => f('activo', e.target.checked)} />
                <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>Producto activo</span>
              </label>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave}>{editing ? '💾 Guardar' : '✅ Crear'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}