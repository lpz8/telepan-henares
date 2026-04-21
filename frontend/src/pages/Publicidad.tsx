import { useState } from 'react'
import { Plus, Trash2, Edit2, X, Printer, Save, Image } from 'lucide-react'

const logoUrl = '/logo.jpg'

interface ProductoPubli {
  id: string
  nombre: string
  precio: string
  categoria: string
  emoji: string
}

interface Catalogo {
  id: string
  titulo: string
  subtitulo: string
  productos: ProductoPubli[]
  color: string
}

const CATEGORIAS = ['Pan', 'Bollería', 'Huevos', 'Otros']
const EMOJIS_PAN = ['🍞', '🥖', '🥐', '🫓', '🥨', '🧆', '🍳', '🥚']

const CATALOGO_INICIAL: Catalogo[] = [
  {
    id: 'pan',
    titulo: 'PAN',
    subtitulo: 'Precios sin IVA + 4%',
    color: '#E8670A',
    productos: [
      { id: '1', nombre: 'BAGUETTINA', precio: '0,83€', categoria: 'Pan', emoji: '🥖' },
      { id: '2', nombre: 'PRECOCIDA DE LA CASA', precio: '1€', categoria: 'Pan', emoji: '🍞' },
      { id: '3', nombre: 'TRILLA (GALLEGA)', precio: '1,35€', categoria: 'Pan', emoji: '🥖' },
      { id: '4', nombre: 'BAGUETTE', precio: '1,35€', categoria: 'Pan', emoji: '🥖' },
      { id: '5', nombre: 'ARTESANA', precio: '1€', categoria: 'Pan', emoji: '🍞' },
      { id: '6', nombre: 'CHAPATITA', precio: '0,83€', categoria: 'Pan', emoji: '🫓' },
      { id: '7', nombre: 'BAGUETTE INTEGRAL', precio: '1,37€', categoria: 'Pan', emoji: '🥖' },
      { id: '8', nombre: 'CRUDA', precio: '1€', categoria: 'Pan', emoji: '🍞' },
      { id: '9', nombre: 'CHAPATA MEDIANA', precio: '1,10€', categoria: 'Pan', emoji: '🫓' },
      { id: '10', nombre: 'INTEGRAL PLANA', precio: '1,20€', categoria: 'Pan', emoji: '🥖' },
      { id: '11', nombre: 'CORPEÑA (CORPA)', precio: '1,30€', categoria: 'Pan', emoji: '🍞' },
      { id: '12', nombre: 'CHAPATA GRANDE', precio: '2€', categoria: 'Pan', emoji: '🫓' },
      { id: '13', nombre: 'INTEGRAL 100% PEQ.', precio: '0,83€', categoria: 'Pan', emoji: '🥖' },
      { id: '14', nombre: 'LEÑA', precio: '1,35€', categoria: 'Pan', emoji: '🥖' },
      { id: '15', nombre: 'FRANCELA PEQ.', precio: '1,85€', categoria: 'Pan', emoji: '🍞' },
      { id: '16', nombre: 'INTEGRAL 100% GR.', precio: '1,20€', categoria: 'Pan', emoji: '🥖' },
      { id: '17', nombre: 'BASTÓN', precio: '1,25€', categoria: 'Pan', emoji: '🥖' },
      { id: '18', nombre: 'FRANCELA GR.', precio: '2,50€', categoria: 'Pan', emoji: '🍞' },
      { id: '19', nombre: 'VIENA', precio: '0,83€', categoria: 'Pan', emoji: '🍞' },
      { id: '20', nombre: 'BARA DE PICOS', precio: '1,20€', categoria: 'Pan', emoji: '🥨' },
      { id: '21', nombre: 'PAN PAYES', precio: '3,50€', categoria: 'Pan', emoji: '🍞' },
      { id: '22', nombre: 'MOLLETE', precio: '0,70€', categoria: 'Pan', emoji: '🍞' },
      { id: '23', nombre: 'COLONCITO', precio: '1,50€', categoria: 'Pan', emoji: '🥖' },
      { id: '24', nombre: 'PAN PAYES CORTADO', precio: '3,65€', categoria: 'Pan', emoji: '🍞' },
      { id: '25', nombre: 'TERCERA', precio: '0,75€', categoria: 'Pan', emoji: '🥖' },
      { id: '26', nombre: 'COLON FABIOLO', precio: '1,30€', categoria: 'Pan', emoji: '🥖' },
      { id: '27', nombre: 'MOLLETE CENTENO', precio: '0,90€', categoria: 'Pan', emoji: '🍞' },
      { id: '28', nombre: 'ROMBITO', precio: '0,75€', categoria: 'Pan', emoji: '🥖' },
      { id: '29', nombre: 'COLON LARGO', precio: '1,30€', categoria: 'Pan', emoji: '🥖' },
      { id: '30', nombre: 'ROMBO MULTICEREAL', precio: '0,90€', categoria: 'Pan', emoji: '🥖' },
      { id: '31', nombre: 'PULGA', precio: '0,45€', categoria: 'Pan', emoji: '🍞' },
      { id: '32', nombre: 'PAN CANDEAL', precio: '4€ (al peso)', categoria: 'Pan', emoji: '🍞' },
      { id: '33', nombre: 'LIBRETA', precio: '3€', categoria: 'Pan', emoji: '🍞' },
      { id: '34', nombre: 'CANDEALITO', precio: '0,70€', categoria: 'Pan', emoji: '🥖' },
    ]
  },
  {
    id: 'bolleria',
    titulo: 'BOLLERÍA Y OTROS',
    subtitulo: 'Precios sin IVA + 10%',
    color: '#c45508',
    productos: [
      { id: 'b1', nombre: 'CROISSANT', precio: '1,20€', categoria: 'Bollería', emoji: '🥐' },
      { id: 'b2', nombre: 'NAPOLITANA', precio: '1,20€', categoria: 'Bollería', emoji: '🥐' },
      { id: 'b3', nombre: 'BERLINA', precio: '1,00€', categoria: 'Bollería', emoji: '🍩' },
      { id: 'b4', nombre: 'CAJA HUEVOS', precio: '76,93€', categoria: 'Huevos', emoji: '🥚' },
      { id: 'b5', nombre: 'DOCENA HUEVOS', precio: '4,10€', categoria: 'Huevos', emoji: '🥚' },
    ]
  }
]

const empty: ProductoPubli = { id: '', nombre: '', precio: '', categoria: 'Pan', emoji: '🍞' }

export default function Publicidad() {
  const [catalogos, setCatalogos] = useState<Catalogo[]>(() => {
    try {
      const saved = localStorage.getItem('telepan_catalogos')
      return saved ? JSON.parse(saved) : CATALOGO_INICIAL
    } catch { return CATALOGO_INICIAL }
  })
  const [catActivo, setCatActivo] = useState(catalogos[0]?.id || '')
  const [openProd, setOpenProd] = useState(false)
  const [editingProd, setEditingProd] = useState<ProductoPubli | null>(null)
  const [formProd, setFormProd] = useState(empty)
  const [openNewCat, setOpenNewCat] = useState(false)
  const [newCatNombre, setNewCatNombre] = useState('')
  const [newCatSub, setNewCatSub] = useState('')

  const save = (cats: Catalogo[]) => {
    setCatalogos(cats)
    localStorage.setItem('telepan_catalogos', JSON.stringify(cats))
  }

  const catActual = catalogos.find(c => c.id === catActivo)

  const addProducto = () => {
    if (!catActual || !formProd.nombre) return
    const newProd = { ...formProd, id: Date.now().toString() }
    const updated = catalogos.map(c =>
      c.id === catActivo ? { ...c, productos: [...c.productos, newProd] } : c
    )
    save(updated)
    setOpenProd(false); setFormProd(empty); setEditingProd(null)
  }

  const updateProducto = () => {
    if (!catActual || !editingProd) return
    const updated = catalogos.map(c =>
      c.id === catActivo ? { ...c, productos: c.productos.map(p => p.id === editingProd.id ? { ...formProd, id: editingProd.id } : p) } : c
    )
    save(updated)
    setOpenProd(false); setFormProd(empty); setEditingProd(null)
  }

  const deleteProducto = (id: string) => {
    const updated = catalogos.map(c =>
      c.id === catActivo ? { ...c, productos: c.productos.filter(p => p.id !== id) } : c
    )
    save(updated)
  }

  const deleteCatalogo = (id: string) => {
    if (!confirm('¿Eliminar este catálogo?')) return
    const updated = catalogos.filter(c => c.id !== id)
    save(updated)
    setCatActivo(updated[0]?.id || '')
  }

  const addCatalogo = () => {
    if (!newCatNombre) return
    const newCat: Catalogo = { id: Date.now().toString(), titulo: newCatNombre.toUpperCase(), subtitulo: newCatSub, color: '#E8670A', productos: [] }
    save([...catalogos, newCat])
    setCatActivo(newCat.id)
    setOpenNewCat(false); setNewCatNombre(''); setNewCatSub('')
  }

  const printCatalogo = () => {
    if (!catActual) return
    const w = window.open('', '_blank')
    if (!w) return
    const cols = Math.min(3, Math.ceil(catActual.productos.length / 4))
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>TelePan — ${catActual.titulo}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&display=swap');
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Nunito',sans-serif;padding:20px;background:white;color:#1a1a1a}
      .header{display:flex;align-items:center;justify-content:space-between;border-bottom:4px solid ${catActual.color};padding-bottom:12px;margin-bottom:16px}
      .logo{height:60px;object-fit:contain}
      .titulo{font-size:2rem;font-weight:900;color:${catActual.color};text-align:center}
      .subtitulo{font-size:0.8rem;color:#888;text-align:right;font-style:italic}
      .grid{display:grid;grid-template-columns:repeat(${cols},1fr);gap:10px;margin-bottom:16px}
      .item{border:2px solid ${catActual.color};border-radius:10px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center}
      .item-nombre{font-weight:800;font-size:0.82rem;text-transform:uppercase}
      .item-precio{font-size:1.1rem;font-weight:900;color:${catActual.color};white-space:nowrap;margin-left:8px}
      .footer{text-align:center;font-size:0.75rem;color:#888;border-top:1px solid #eee;padding-top:10px;font-style:italic}
      @media print{body{padding:10px}}
    </style></head><body>
    <div class="header">
      <img src="${logoUrl}" class="logo" alt="TelePan"/>
      <div class="titulo">${catActual.titulo}</div>
      <div class="subtitulo">TelePan Henares<br>${catActual.subtitulo}</div>
    </div>
    <div class="grid">
      ${catActual.productos.map(p => `
        <div class="item">
          <span class="item-nombre">${p.emoji} ${p.nombre}</span>
          <span class="item-precio">${p.precio}</span>
        </div>
      `).join('')}
    </div>
    <div class="footer">"La panadería en casa" · TelePan Henares · 633 95 85 32 · 622 33 41 26 (Bizum)</div>
    <script>window.onload=()=>window.print()</script>
    </body></html>`)
    w.document.close()
  }

  const resetCatalogo = () => {
    if (!confirm('¿Restaurar el catálogo original de TelePan? Se perderán los cambios.')) return
    save(CATALOGO_INICIAL)
    setCatActivo(CATALOGO_INICIAL[0].id)
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">📢 Catálogo de Precios</h1>
        <div className="page-actions">
          <button className="btn btn-secondary btn-sm" onClick={resetCatalogo}>↺ Restaurar original</button>
          <button className="btn btn-secondary" onClick={() => setOpenNewCat(true)}><Plus size={16} /> Nuevo catálogo</button>
          {catActual && (
            <button className="btn btn-primary" onClick={printCatalogo}><Printer size={16} /> Imprimir / PDF</button>
          )}
        </div>
      </div>

      {/* Tabs catálogos */}
      <div className="tabs" style={{ marginBottom: 0 }}>
        {catalogos.map(c => (
          <div key={c.id} className={`tab ${catActivo === c.id ? 'active' : ''}`} onClick={() => setCatActivo(c.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {c.titulo}
            <button onClick={e => { e.stopPropagation(); deleteCatalogo(c.id) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '0 2px', fontSize: '0.9rem', lineHeight: 1 }}>×</button>
          </div>
        ))}
      </div>

      {catActual && (
        <>
          {/* Info catálogo */}
          <div style={{ background: catActual.color + '15', border: `1.5px solid ${catActual.color}33`, borderRadius: '0 0 12px 12px', padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontFamily: 'Fredoka One', fontSize: '1.1rem', color: catActual.color }}>{catActual.titulo}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--gris)', marginLeft: 10 }}>{catActual.subtitulo}</span>
            </div>
            <span style={{ fontSize: '0.85rem', color: 'var(--gris)', fontWeight: 700 }}>{catActual.productos.length} productos</span>
          </div>

          {/* Grid de productos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8, marginBottom: 16 }}>
            {catActual.productos.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'white', borderRadius: 10, border: `1.5px solid ${catActual.color}33`, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <span style={{ fontSize: '1.3rem' }}>{p.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</div>
                  <div style={{ fontFamily: 'Fredoka One', fontSize: '1rem', color: catActual.color }}>{p.precio}</div>
                </div>
                <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                  <button className="btn btn-secondary btn-sm btn-icon" onClick={() => { setEditingProd(p); setFormProd({ ...p }); setOpenProd(true) }}><Edit2 size={12} /></button>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => deleteProducto(p.id)}><Trash2 size={12} /></button>
                </div>
              </div>
            ))}

            {/* Añadir producto */}
            <div onClick={() => { setEditingProd(null); setFormProd(empty); setOpenProd(true) }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 12px', background: 'var(--crema)', borderRadius: 10, border: '2px dashed #e0c9b0', cursor: 'pointer', color: 'var(--gris)', fontWeight: 700, fontSize: '0.85rem', transition: 'all 0.2s' }}
              onMouseOver={e => e.currentTarget.style.borderColor = 'var(--naranja)'}
              onMouseOut={e => e.currentTarget.style.borderColor = '#e0c9b0'}>
              <Plus size={18} color="var(--naranja)" /> Añadir producto
            </div>
          </div>

          {/* Vista previa impresión */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f5e8d8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'Fredoka One', color: 'var(--marron)' }}>👁️ Vista previa del catálogo</span>
              <button className="btn btn-primary btn-sm" onClick={printCatalogo}><Printer size={14} /> Imprimir</button>
            </div>
            <div style={{ padding: 20, background: 'white' }}>
              {/* Header preview */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `3px solid ${catActual.color}`, paddingBottom: 10, marginBottom: 14 }}>
                <img src={logoUrl} style={{ height: 50, objectFit: 'contain' }} alt="Logo" />
                <div style={{ fontFamily: 'Fredoka One', fontSize: '1.5rem', color: catActual.color }}>{catActual.titulo}</div>
                <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#888' }}>TelePan Henares<br />{catActual.subtitulo}</div>
              </div>
              {/* Products preview */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {catActual.productos.slice(0, 12).map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1.5px solid ${catActual.color}`, borderRadius: 7, padding: '6px 8px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>{p.emoji} {p.nombre}</span>
                    <span style={{ fontWeight: 900, color: catActual.color, fontSize: '0.85rem', marginLeft: 6, flexShrink: 0 }}>{p.precio}</span>
                  </div>
                ))}
                {catActual.productos.length > 12 && (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', fontSize: '0.8rem', color: 'var(--gris)', padding: '6px' }}>
                    ... y {catActual.productos.length - 12} productos más
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'center', fontSize: '0.72rem', color: '#aaa', borderTop: '1px solid #eee', paddingTop: 8, marginTop: 10 }}>
                "La panadería en casa" · TelePan Henares · 633 95 85 32
              </div>
            </div>
          </div>
        </>
      )}

      {catalogos.length === 0 && (
        <div className="card"><div className="empty-state"><Image size={48} /><p>No hay catálogos</p><span>Crea tu primer catálogo de precios</span></div></div>
      )}

      {/* Modal producto */}
      {openProd && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setOpenProd(false)}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3 className="modal-title">{editingProd ? '✏️ Editar' : '➕ Añadir'} Producto</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setOpenProd(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">Emoji</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                  {EMOJIS_PAN.map(e => (
                    <button key={e} type="button" onClick={() => setFormProd(f => ({ ...f, emoji: e }))}
                      style={{ fontSize: '1.3rem', padding: '4px 6px', borderRadius: 8, border: formProd.emoji === e ? '2px solid var(--naranja)' : '1px solid #e5d8cc', cursor: 'pointer', background: 'white' }}>
                      {e}
                    </button>
                  ))}
                  <input value={formProd.emoji} onChange={e => setFormProd(f => ({ ...f, emoji: e.target.value }))}
                    style={{ width: 50, fontSize: '1.2rem', border: '1px solid #e5d8cc', borderRadius: 8, textAlign: 'center', padding: '4px' }} placeholder="✏️" />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Nombre *</label>
                <input className="input" value={formProd.nombre} onChange={e => setFormProd(f => ({ ...f, nombre: e.target.value.toUpperCase() }))} placeholder="NOMBRE DEL PRODUCTO" />
              </div>
              <div className="form-grid-2">
                <div className="input-group">
                  <label className="input-label">Precio (con €)</label>
                  <input className="input" value={formProd.precio} onChange={e => setFormProd(f => ({ ...f, precio: e.target.value }))} placeholder="1,35€" />
                </div>
                <div className="input-group">
                  <label className="input-label">Categoría</label>
                  <select className="select" value={formProd.categoria} onChange={e => setFormProd(f => ({ ...f, categoria: e.target.value }))}>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setOpenProd(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={editingProd ? updateProducto : addProducto}>
                <Save size={16} /> {editingProd ? 'Guardar' : 'Añadir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nuevo catálogo */}
      {openNewCat && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setOpenNewCat(false)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3 className="modal-title">📋 Nuevo Catálogo</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setOpenNewCat(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">Título del catálogo</label>
                <input className="input" value={newCatNombre} onChange={e => setNewCatNombre(e.target.value)} placeholder="Ej: BOLLERÍA, NAVIDAD, OFERTAS..." />
              </div>
              <div className="input-group">
                <label className="input-label">Nota de precios</label>
                <input className="input" value={newCatSub} onChange={e => setNewCatSub(e.target.value)} placeholder="Ej: Precios sin IVA + 10%" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setOpenNewCat(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={addCatalogo} disabled={!newCatNombre}><Plus size={16} /> Crear catálogo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
