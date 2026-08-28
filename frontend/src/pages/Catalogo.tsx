import { useEffect, useState, useRef } from 'react'
import { Plus, Trash2, X, Edit2, MoveUp, MoveDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { globalToast } from '../components/Layout'

const CATEGORIAS = ['Bollería', 'Tartas', 'Especiales', 'Bandejas', 'Rincón Gallego']

const CAT_COLORS: Record<string, string> = {
  'Bollería': '#E8670A',
  'Tartas': '#be185d',
  'Especiales': '#7c3aed',
  'Bandejas': '#0891b2',
  'Rincón Gallego': '#16a34a',
}

const EMISOR = { nombre: 'TelePan Henares', slogan: '¡la panadería en casa!', telefono: '633 95 85 32' }
const emptyForm = { nombre: '', descripcion: '', categoria: 'Bollería', precio: 0, precio_label: '', foto_base64: '', activo: true, orden: 0 }

export default function Catalogo() {
  const { user } = useAuth()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [openModal, setOpenModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState(emptyForm)
  const [fotoPreview, setFotoPreview] = useState('')
  const [catFiltro, setCatFiltro] = useState('Todas')
  const [descargando, setDescargando] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('catalogo').select('*').order('categoria').order('orden')
    setItems(data || [])
    setLoading(false)
  }

  const fSet = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  const handleFoto = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const b64 = e.target?.result as string
      setFotoPreview(b64)
      fSet('foto_base64', b64)
    }
    reader.readAsDataURL(file)
  }

  const openNew = () => { setEditing(null); setForm(emptyForm); setFotoPreview(''); setOpenModal(true) }

  const openEdit = (item: any) => {
    setEditing(item)
    setForm({ nombre: item.nombre, descripcion: item.descripcion || '', categoria: item.categoria, precio: item.precio, precio_label: item.precio_label || '', foto_base64: item.foto_base64 || '', activo: item.activo, orden: item.orden || 0 })
    setFotoPreview(item.foto_base64 || '')
    setOpenModal(true)
  }

  const save = async () => {
    if (!user || !form.nombre.trim()) return globalToast('El nombre es obligatorio', 'error')
    if (editing) {
      await supabase.from('catalogo').update(form).eq('id', editing.id)
      globalToast('Artículo actualizado')
    } else {
      await supabase.from('catalogo').insert({ ...form, user_id: user.id })
      globalToast('Artículo añadido')
    }
    setOpenModal(false); load()
  }

  const deleteItem = async (id: string) => {
    if (!confirm('¿Eliminar este artículo?')) return
    await supabase.from('catalogo').delete().eq('id', id)
    globalToast('Artículo eliminado'); load()
  }

  const toggleActivo = async (item: any) => {
    await supabase.from('catalogo').update({ activo: !item.activo }).eq('id', item.id)
    load()
  }

  const moverOrden = async (item: any, dir: 'up' | 'down') => {
    const catItems = items.filter(i => i.categoria === item.categoria).sort((a, b) => (a.orden||0) - (b.orden||0))
    const idx = catItems.findIndex(i => i.id === item.id)
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= catItems.length) return
    const other = catItems[swapIdx]
    await Promise.all([
      supabase.from('catalogo').update({ orden: other.orden }).eq('id', item.id),
      supabase.from('catalogo').update({ orden: item.orden }).eq('id', other.id),
    ])
    load()
  }

  const buildHTML = () => {
    const activos = items.filter(i => i.activo)
    const porCat = CATEGORIAS.filter(c => activos.some(i => i.categoria === c))
    const cardsHTML = porCat.map(cat => {
      const color = CAT_COLORS[cat] || '#E8670A'
      const catItems = activos.filter(i => i.categoria === cat)
      const itemsHTML = catItems.map(item => `
        <div class="card-art">
          <div class="card-img" style="background:${color}15">
            ${item.foto_base64 ? `<img src="${item.foto_base64}" alt="${item.nombre}"/>` : '<span style="font-size:2.5rem">🍞</span>'}
          </div>
          <div class="card-body">
            <div class="card-nombre">${item.nombre}</div>
            ${item.descripcion ? `<div class="card-desc">${item.descripcion}</div>` : ''}
            <div class="card-precio">${item.precio_label || (item.precio > 0 ? Number(item.precio).toFixed(2) + ' \u20AC' : 'Consultar')}</div>
          </div>
        </div>`).join('')
      return `<div class="seccion">
        <div class="sec-header" style="background:${color}"><span>${cat}</span></div>
        <div class="cards-grid">${itemsHTML}</div>
      </div>`
    }).join('')

    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;700;800&display=swap" rel="stylesheet">
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Nunito',Arial,sans-serif;background:#fdf8f3;color:#2a1500;width:900px}
      .portada{background:linear-gradient(135deg,#E8670A,#c4500a);color:white;padding:40px 50px;text-align:center}
      .portada h1{font-family:'Fredoka One',cursive;font-size:2.8rem;margin-bottom:6px}
      .portada .slogan{font-size:1.1rem;opacity:.9;font-style:italic;margin-bottom:16px}
      .portada .tel{background:rgba(255,255,255,.2);border-radius:30px;padding:8px 24px;font-weight:800;display:inline-block;border:2px solid rgba(255,255,255,.4)}
      .seccion{margin:20px 30px}
      .sec-header{border-radius:12px 12px 0 0;padding:10px 20px}
      .sec-header span{font-family:'Fredoka One',cursive;color:white;font-size:1.3rem}
      .cards-grid{display:grid;grid-template-columns:repeat(3,1fr);border:2px solid #f0e0d0;border-top:none;border-radius:0 0 12px 12px;overflow:hidden;background:white}
      .card-art{border-right:1px solid #f5e8d8;border-bottom:1px solid #f5e8d8}
      .card-art:nth-child(3n){border-right:none}
      .card-img{height:150px;overflow:hidden;display:flex;align-items:center;justify-content:center}
      .card-img img{width:100%;height:100%;object-fit:cover}
      .card-body{padding:10px 12px}
      .card-nombre{font-weight:800;font-size:.88rem;color:#2a1500;margin-bottom:4px}
      .card-desc{font-size:.75rem;color:#888;margin-bottom:4px;line-height:1.4}
      .card-precio{font-family:'Fredoka One',cursive;color:#E8670A;font-size:1rem}
      .footer{text-align:center;padding:20px;font-size:.75rem;color:#bbb;border-top:1px solid #f0e0d0;margin-top:10px}
    </style></head><body>
    <div class="portada">
      <h1>${EMISOR.nombre}</h1>
      <div class="slogan">"${EMISOR.slogan}"</div>
      <div class="tel">📞 ${EMISOR.telefono}</div>
    </div>
    ${cardsHTML}
    <div class="footer">${EMISOR.nombre} &middot; ${EMISOR.telefono} &middot; ${new Date().getFullYear()}</div>
    </body></html>`
  }

  const descargarPDF = () => {
    const w = window.open('', '_blank')
    if (!w) return globalToast('Permite las ventanas emergentes', 'error')
    w.document.write(buildHTML()); w.document.close()
    globalToast('Usa Ctrl+P para guardar como PDF')
  }

  const descargarJPG = async () => {
    setDescargando(true)
    globalToast('Generando imagen...')
    try {
      if (!(window as any).html2canvas) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script')
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
          s.onload = () => resolve(); s.onerror = reject
          document.head.appendChild(s)
        })
      }
      const h2c = (window as any).html2canvas
      const html = buildHTML()
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const blobUrl = URL.createObjectURL(blob)
      const iframe = document.createElement('iframe')
      iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:900px;height:2000px;border:none'
      document.body.appendChild(iframe)
      await new Promise<void>(r => { iframe.onload = () => r(); iframe.src = blobUrl })
      if (iframe.contentWindow) (iframe.contentWindow as any).print = () => {}
      await new Promise(r => setTimeout(r, 1500))
      const canvas = await h2c(iframe.contentDocument!.body, { scale: 2, useCORS: true, backgroundColor: '#fdf8f3', logging: false, width: 900, height: iframe.contentDocument!.body.scrollHeight })
      document.body.removeChild(iframe); URL.revokeObjectURL(blobUrl)
      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/jpeg', 0.92)
      a.download = 'Catalogo_TelePan.jpg'
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      globalToast('JPG descargado')
    } catch(e: any) { globalToast('Error: ' + e.message, 'error') }
    setDescargando(false)
  }

  const filtrados = catFiltro === 'Todas' ? items : items.filter(i => i.categoria === catFiltro)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Catalogo</h1>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={descargarPDF} disabled={descargando}>PDF</button>
          <button className="btn btn-secondary" onClick={descargarJPG} disabled={descargando}>JPG</button>
          <button className="btn btn-primary" onClick={openNew}><Plus size={16}/> Añadir</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Total', value: items.length, color: 'var(--naranja)', bg: '#fff8f0' },
          { label: 'Activos', value: items.filter(i => i.activo).length, color: '#16a34a', bg: '#f0fdf4' },
          { label: 'Con foto', value: items.filter(i => i.foto_base64).length, color: '#0891b2', bg: '#eff6ff' },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: 12, background: k.bg, textAlign: 'center' }}>
            <div style={{ fontFamily: 'Fredoka One', fontSize: '1.3rem', color: k.color }}>{k.value}</div>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--gris)', textTransform: 'uppercase', marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div className="tabs" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        {['Todas', ...CATEGORIAS].map(cat => (
          <div key={cat} className={`tab ${catFiltro === cat ? 'active' : ''}`} onClick={() => setCatFiltro(cat)}>
            {cat}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="card"><div className="empty-state"><p>Cargando...</p></div></div>
      ) : filtrados.length === 0 ? (
        <div className="card"><div className="empty-state">
          <span style={{ fontSize: 48 }}>📖</span>
          <p>No hay artículos</p>
          <span>Pulsa "Añadir" para empezar</span>
        </div></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16 }}>
          {filtrados.map(item => (
            <div key={item.id} className="card" style={{ padding: 0, opacity: item.activo ? 1 : 0.55 }}>
              <div style={{ height: 180, overflow: 'hidden', borderRadius: '10px 10px 0 0', background: '#f5f0eb', cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}
                onClick={() => { if (fileRef.current) { fileRef.current.dataset.id = item.id; fileRef.current.click() } }}>
                {item.foto_base64
                  ? <img src={item.foto_base64} alt={item.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }} />
                  : <><span style={{ fontSize: '3rem' }}>📷</span><span style={{ fontSize: '0.75rem', color: 'var(--gris)' }}>Pulsa para añadir foto</span></>
                }
                <span style={{ position: 'absolute', top: 8, left: 8, background: CAT_COLORS[item.categoria] || '#E8670A', color: 'white', borderRadius: 6, padding: '2px 8px', fontSize: '0.65rem', fontWeight: 800 }}>{item.categoria}</span>
                <span style={{ position: 'absolute', top: 8, right: 8, background: item.activo ? '#16a34a' : '#6b7280', color: 'white', borderRadius: 6, padding: '2px 8px', fontSize: '0.65rem', fontWeight: 800 }}>{item.activo ? 'Activo' : 'Oculto'}</span>
              </div>
              <div style={{ padding: '12px 14px' }}>
                <div style={{ fontFamily: 'Fredoka One', fontSize: '1rem', color: 'var(--marron)', marginBottom: 4 }}>{item.nombre}</div>
                {item.descripcion && <div style={{ fontSize: '0.78rem', color: 'var(--gris)', marginBottom: 6, lineHeight: 1.4 }}>{item.descripcion}</div>}
                <div style={{ fontFamily: 'Fredoka One', fontSize: '1.1rem', color: CAT_COLORS[item.categoria] || 'var(--naranja)' }}>
                  {item.precio_label || (item.precio > 0 ? Number(item.precio).toFixed(2) + ' €' : 'Consultar precio')}
                </div>
              </div>
              <div style={{ padding: '8px 14px 12px', borderTop: '1px solid #f5e8d8', display: 'flex', gap: 6, alignItems: 'center' }}>
                <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(item)}><Edit2 size={14}/></button>
                <button className="btn btn-secondary btn-sm btn-icon" onClick={() => moverOrden(item, 'up')}><MoveUp size={14}/></button>
                <button className="btn btn-secondary btn-sm btn-icon" onClick={() => moverOrden(item, 'down')}><MoveDown size={14}/></button>
                <button className="btn btn-sm" onClick={() => toggleActivo(item)}
                  style={{ background: item.activo ? '#f9fafb' : '#f0fdf4', color: item.activo ? '#6b7280' : '#16a34a', border: '1px solid currentColor', borderRadius: 6, padding: '3px 10px', fontSize: '0.72rem', fontWeight: 800 }}>
                  {item.activo ? 'Ocultar' : 'Activar'}
                </button>
                <button className="btn btn-danger btn-sm btn-icon" style={{ marginLeft: 'auto' }} onClick={() => deleteItem(item.id)}><Trash2 size={14}/></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={async e => {
          const file = e.target.files?.[0]
          const id = fileRef.current?.dataset.id
          if (!file || !id) return
          const reader = new FileReader()
          reader.onload = async ev => {
            await supabase.from('catalogo').update({ foto_base64: ev.target?.result as string }).eq('id', id)
            globalToast('Foto actualizada'); load()
          }
          reader.readAsDataURL(file); e.target.value = ''
        }} />

      {openModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setOpenModal(false)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3 className="modal-title">{editing ? 'Editar artículo' : 'Nuevo artículo'}</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setOpenModal(false)}><X size={16}/></button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 14 }}>
                <label className="input-label">Foto</label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 100, height: 100, borderRadius: 10, overflow: 'hidden', border: '2px dashed #f5e8d8', background: '#fdf8f3', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => document.getElementById('foto-modal')?.click()}>
                    {fotoPreview ? <img src={fotoPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '2rem' }}>📷</span>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => document.getElementById('foto-modal')?.click()}>{fotoPreview ? 'Cambiar foto' : 'Añadir foto'}</button>
                    {fotoPreview && <button className="btn btn-danger btn-sm" onClick={() => { setFotoPreview(''); fSet('foto_base64', '') }}>Quitar foto</button>}
                  </div>
                </div>
                <input id="foto-modal" type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFoto(f); e.target.value = '' }} />
              </div>
              <div className="input-group">
                <label className="input-label">Nombre *</label>
                <input className="input" value={form.nombre} onChange={e => fSet('nombre', e.target.value)} placeholder="Nombre del artículo..." />
              </div>
              <div className="input-group">
                <label className="input-label">Descripción</label>
                <input className="input" value={form.descripcion} onChange={e => fSet('descripcion', e.target.value)} placeholder="Descripción breve..." />
              </div>
              <div className="form-grid-2">
                <div className="input-group">
                  <label className="input-label">Categoría</label>
                  <select className="select" value={form.categoria} onChange={e => fSet('categoria', e.target.value)}>
                    {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Precio (€)</label>
                  <input className="input" type="number" step="0.01" min="0" value={form.precio} onChange={e => fSet('precio', parseFloat(e.target.value) || 0)} />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Texto de precio personalizado</label>
                <input className="input" value={form.precio_label} onChange={e => fSet('precio_label', e.target.value)} placeholder="Ej: Desde 18,50 € / Solo temporada..." />
                <span style={{ fontSize: '0.72rem', color: 'var(--gris)', marginTop: 4, display: 'block' }}>Si lo rellenas, se muestra en vez del precio numérico</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="activo-ck" checked={form.activo} onChange={e => fSet('activo', e.target.checked)} />
                <label htmlFor="activo-ck" style={{ fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>Visible en el catálogo</label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setOpenModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>{editing ? 'Guardar cambios' : 'Añadir'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}