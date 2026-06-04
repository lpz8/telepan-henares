import { useState, useEffect } from 'react'
import { Upload, Brain, FileText, X, Loader, CheckCircle, TrendingUp, ShoppingCart, PlusCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { globalToast } from '../components/Layout'

interface Producto {
  nombre: string; cantidad: number; precio?: number; total?: number; iva?: number
}
interface AnalysisResult {
  resumen: string; tipo_documento: string; fecha_documento?: string; cliente?: string
  productos: Producto[]; total_unidades: number; subtotal_sin_iva: number
  total_iva: number; total_con_iva: number; gastos_detectados: string[]
  beneficio_estimado: number; forma_pago?: string; observaciones: string
}

const GROQ_MODELOS = [
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'llama-3.2-11b-vision-preview',
]

const PROMPT = 'Eres un asistente contable para TELEPAN HENARES, panaderia espanola. Analiza la imagen (factura, albaran, ticket o pedido). Responde UNICAMENTE con JSON valido sin markdown ni texto extra: {"resumen":"descripcion","tipo_documento":"factura|albaran|ticket|pedido","fecha_documento":null,"cliente":null,"productos":[{"nombre":"","cantidad":1,"precio":0,"total":0,"iva":4}],"total_unidades":0,"subtotal_sin_iva":0,"total_iva":0,"total_con_iva":0,"gastos_detectados":[],"beneficio_estimado":0,"forma_pago":null,"observaciones":""}'

const PROMPT_CATALOGO = 'Eres un asistente para TELEPAN HENARES. Analiza esta imagen de catalogo o lista de precios de proveedor. Extrae TODOS los productos. Responde UNICAMENTE con JSON valido sin markdown: {"proveedor":"nombre","fecha":"fecha","productos":[{"nombre":"articulo","precio_sin_iva":0.00,"iva":4,"unidad":"ud"}],"observaciones":""}. precio_sin_iva en euros sin IVA. Pan/Bolleria/Huevos: IVA 4%.'

const PROMPT_COTEJO = 'Eres un asistente para TelePan Henares. Analiza este albaran de proveedor. Responde SOLO con JSON sin texto extra: {"proveedor":"nombre","fecha":"fecha","productos":[{"nombre":"nombre exacto","cantidad":0,"precio_unit":0.00,"total":0.00}],"total_albaran":0.00}. Nombre TAL COMO APARECE.'

const KEY_NAME = 'groq_key_v1'
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function IAFacturas() {
  const { user } = useAuth()
  // Facturas tab
  const [files, setFiles] = useState<File[]>([])
  const [previewUrl, setPreviewUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [inputKey, setInputKey] = useState('')
  const [status, setStatus] = useState('')
  const [modeloUsado, setModeloUsado] = useState('')
  const [showSetup, setShowSetup] = useState(false)
  const [guardandoGasto, setGuardandoGasto] = useState(false)
  const [gastoGuardado, setGastoGuardado] = useState(false)
  const [editando, setEditando] = useState(false)
  const [totalManual, setTotalManual] = useState('')
  const [conceptoManual, setConceptoManual] = useState('')
  const [fechaManual, setFechaManual] = useState(new Date().toISOString().split('T')[0])
  // Tabs
  const [tabIA, setTabIA] = useState<'facturas' | 'catalogo' | 'cotejo'>('facturas')
  // Catalogo
  const [catalogoFile, setCatalogoFile] = useState<File | null>(null)
  const [catalogoPreview, setCatalogoPreview] = useState('')
  const [catalogoLoading, setCatalogoLoading] = useState(false)
  const [catalogoResult, setCatalogoResult] = useState<any>(null)
  const [catalogoError, setCatalogoError] = useState('')
  const [productosEditados, setProductosEditados] = useState<any[]>([])
  const [proveedores, setProveedores] = useState<any[]>([])
  const [proveedorSel, setProveedorSel] = useState('')
  const [guardandoCatalogo, setGuardandoCatalogo] = useState(false)
  // Cotejo
  const [cotejoFile, setCotejoFile] = useState<File | null>(null)
  const [cotejoPreview, setCotejoPreview] = useState('')
  const [cotejoLoading, setCotejoLoading] = useState(false)
  const [cotejoMes, setCotejoMes] = useState(new Date().toISOString().slice(0, 7))
  const [cotejoProveedor, setCotejoProveedor] = useState('')
  const [cotejoResultado, setCotejoResultado] = useState<any>(null)

  useEffect(() => {
    const saved = localStorage.getItem(KEY_NAME) || ''
    if (saved.startsWith('gsk_')) { setApiKey(saved); setShowSetup(false) }
    else setShowSetup(true)
  }, [])

  useEffect(() => {
    supabase.from('proveedores').select('id, nombre').order('nombre').then(r => {
      if (r.data) setProveedores(r.data)
    })
  }, [])

  const saveKey = () => {
    const k = inputKey.trim()
    if (!k.startsWith('gsk_')) { setError('La key debe empezar por gsk_'); return }
    localStorage.setItem(KEY_NAME, k)
    setApiKey(k); setShowSetup(false); setError('')
    globalToast('API Key de Groq guardada')
  }

  const handleFiles = (fl: FileList | null) => {
    if (!fl) return
    const valid = Array.from(fl).filter(f => f.type.startsWith('image/'))
    if (!valid.length) { setError('Solo imagenes: JPG, PNG, WEBP.'); return }
    setFiles(prev => [...prev, ...valid])
    setPreviewUrl(URL.createObjectURL(valid[0]))
    setError('')
  }

  const toBase64 = (f: File): Promise<string> => new Promise(res => {
    const r = new FileReader()
    r.onload = () => res((r.result as string).split(',')[1])
    r.readAsDataURL(f)
  })

  const callGroq = async (messages: any[], maxTokens = 2048): Promise<string> => {
    for (const model of GROQ_MODELOS) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.1 })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error?.message || `Error ${res.status}`)
        const text = data.choices?.[0]?.message?.content || ''
        if (text) return text
      } catch (e: any) {
        if (e.message?.includes('401') || e.message?.includes('invalid_api_key')) {
          localStorage.removeItem(KEY_NAME); setApiKey(''); setShowSetup(true)
          throw new Error('API Key no valida')
        }
      }
    }
    throw new Error('Todos los modelos fallaron')
  }

  const parseJSON = (text: string) => {
    const clean = text.replace(/```json/g, '').replace(/```/g, '').trim()
    const match = clean.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('La IA no devolvio datos validos')
    return JSON.parse(match[0])
  }

  const analyze = async () => {
    if (!files.length || !apiKey) return
    setLoading(true); setError(''); setResult(null); setGastoGuardado(false); setStatus('Preparando imagen...')
    try {
      const b64 = await toBase64(files[0])
      const mime = files[0].type || 'image/jpeg'
      setStatus('Analizando con IA...')
      const text = await callGroq([{
        role: 'user',
        content: [
          { type: 'text', text: PROMPT },
          { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } }
        ]
      }])
      setResult(parseJSON(text))
    } catch (e: any) { setError(e.message || 'Error desconocido') }
    setLoading(false); setStatus('')
  }

  const guardarComoGasto = async () => {
    if (!result || !user) return
    setGuardandoGasto(true)
    try {
      const fecha = editando && fechaManual ? fechaManual : (result.fecha_documento || new Date().toISOString().split('T')[0])
      const totalFinal = editando && totalManual ? parseFloat(totalManual) : result.total_con_iva
      const conceptoFinal = editando && conceptoManual ? conceptoManual : (result.resumen || 'Factura proveedor')
      await supabase.from('gastos').insert({
        user_id: user.id, concepto: conceptoFinal,
        categoria: 'Proveedor', importe: totalFinal, fecha,
        forma_pago: result.forma_pago || 'Transferencia'
      })
      globalToast('Gasto registrado en contabilidad')
      setGastoGuardado(true)
    } catch (e: any) { globalToast(e.message, 'error') }
    setGuardandoGasto(false)
  }

  const analizarCatalogo = async () => {
    if (!catalogoFile) return globalToast('Sube una imagen del catalogo', 'error')
    if (!apiKey) return globalToast('Configura tu API Key de Groq primero', 'error')
    setCatalogoLoading(true); setCatalogoError(''); setCatalogoResult(null)
    try {
      const b64 = await toBase64(catalogoFile)
      const mime = catalogoFile.type || 'image/jpeg'
      const text = await callGroq([{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
          { type: 'text', text: PROMPT_CATALOGO }
        ]
      }], 4000)
      const resultado = parseJSON(text)
      setCatalogoResult(resultado)
      setProductosEditados(resultado.productos || [])
      if (resultado.proveedor) {
        const match = proveedores.find((p: any) => p.nombre.toLowerCase().includes((resultado.proveedor || '').toLowerCase()))
        if (match) setProveedorSel(match.id)
      }
      globalToast(`${(resultado.productos || []).length} productos detectados`)
    } catch (err: any) {
      setCatalogoError(err.message)
      globalToast('Error: ' + err.message, 'error')
    }
    setCatalogoLoading(false)
  }

  const guardarCatalogo = async () => {
    if (!productosEditados.length) return
    if (!user) return
    if (!proveedorSel) return globalToast('Selecciona el proveedor primero', 'error')
    setGuardandoCatalogo(true)
    let guardados = 0
    for (const prod of productosEditados) {
      if (!prod.nombre || prod.precio_sin_iva === undefined) continue
      const { data: existing } = await supabase.from('precios_proveedor')
        .select('id').eq('proveedor_id', proveedorSel).ilike('articulo', prod.nombre).limit(1)
      if (existing && existing.length > 0) {
        await supabase.from('precios_proveedor').update({ precio_cliente: Number(prod.precio_sin_iva) }).eq('id', existing[0].id)
      } else {
        await supabase.from('precios_proveedor').insert({
          user_id: user.id, proveedor_id: proveedorSel,
          articulo: prod.nombre.toUpperCase(), precio_cliente: Number(prod.precio_sin_iva),
          precio_pvp: 0, categoria: 'Pan', codigo: ''
        })
      }
      guardados++
    }
    await supabase.from('proveedores').update({
      notas: `Catalogo: ${new Date().toLocaleDateString('es-ES')} - ${guardados} articulos`
    }).eq('id', proveedorSel)
    globalToast(`${guardados} articulos guardados en Proveedores`)
    setGuardandoCatalogo(false); setCatalogoResult(null)
    setProductosEditados([]); setCatalogoFile(null); setCatalogoPreview('')
  }

  const analizarCotejo = async () => {
    if (!cotejoFile) return globalToast('Sube el albaran del proveedor', 'error')
    if (!apiKey) return globalToast('Configura tu API Key de Groq primero', 'error')
    setCotejoLoading(true); setCotejoResultado(null)
    try {
      const b64 = await toBase64(cotejoFile)
      const mime = cotejoFile.type || 'image/jpeg'
      const text = await callGroq([{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
          { type: 'text', text: PROMPT_COTEJO }
        ]
      }], 3000)
      const albaran = parseJSON(text)

      // Cargar pedidos del mes con paginacion
      const [y, m] = cotejoMes.split('-').map(Number)
      const lastDayNum = new Date(y, m, 0).getDate()
      const fin = `${cotejoMes}-${String(lastDayNum).padStart(2, '0')}`
      let allPeds: any[] = []
      let page = 0
      while (true) {
        const { data: chunk } = await supabase.from('pedidos')
          .select('cantidad, productos(nombre)')
          .gte('fecha', `${cotejoMes}-01`).lte('fecha', fin)
          .range(page * 1000, (page + 1) * 1000 - 1)
        if (!chunk || chunk.length === 0) break
        allPeds = allPeds.concat(chunk)
        if (chunk.length < 1000) break
        page++
      }

      // Agrupar pedidos por producto
      const misPedidos: Record<string, number> = {}
      allPeds.forEach((p: any) => {
        const n = (p.productos?.nombre || '').toUpperCase().trim()
        misPedidos[n] = (misPedidos[n] || 0) + Number(p.cantidad)
      })

      // Cotejar lineas
      const lineasCotejo = (albaran.productos || []).map((prod: any) => {
        const nombreAlbaran = (prod.nombre || '').toUpperCase().trim()
        const matchKey = Object.keys(misPedidos).find(k =>
          k === nombreAlbaran || k.includes(nombreAlbaran) || nombreAlbaran.includes(k)
        )
        const miCantidad = matchKey !== undefined ? misPedidos[matchKey] : null
        const diff = miCantidad !== null ? prod.cantidad - miCantidad : null
        let estado = 'No encontrado'
        if (miCantidad !== null) {
          if (diff === 0) estado = 'Correcto'
          else if ((diff as number) > 0) estado = 'Te cobran mas'
          else estado = 'Te cobran menos'
        }
        return { nombreAlbaran: prod.nombre, cantidadAlbaran: prod.cantidad, precioUnit: prod.precio_unit, total: prod.total, miCantidad, miProducto: matchKey || null, diff, estado }
      })

      const enAlbaran = lineasCotejo.map((l: any) => l.miProducto).filter(Boolean)
      const noEnAlbaran = Object.keys(misPedidos)
        .filter(k => !enAlbaran.includes(k))
        .map(k => ({ nombreAlbaran: '—', cantidadAlbaran: 0, precioUnit: 0, total: 0, miCantidad: misPedidos[k], miProducto: k, diff: null, estado: 'No facturado' }))

      setCotejoResultado({
        proveedor: albaran.proveedor, fecha: albaran.fecha, totalAlbaran: albaran.total_albaran,
        lineas: [...lineasCotejo, ...noEnAlbaran],
        ok: lineasCotejo.filter((l: any) => l.estado === 'Correcto').length,
        diferencias: lineasCotejo.filter((l: any) => l.estado.includes('cobran')).length,
        noEncontrados: lineasCotejo.filter((l: any) => l.estado === 'No encontrado').length,
        noFacturados: noEnAlbaran.length,
      })
      globalToast('Cotejo completado')
    } catch (err: any) { globalToast('Error: ' + err.message, 'error') }
    setCotejoLoading(false)
  }

  const ivaColor = (iva?: number) => !iva || iva <= 4 ? '#16a34a' : iva <= 10 ? '#E8670A' : '#dc2626'
  const estadoColor = (estado: string) => estado === 'Correcto' ? '#16a34a' : estado.includes('cobran') ? '#f59e0b' : estado === 'No facturado' ? '#dc2626' : '#6b7280'
  const estadoBg = (estado: string) => estado === 'Correcto' ? '#f0fdf4' : estado.includes('cobran') ? '#fefce8' : estado === 'No facturado' ? '#fef2f2' : '#f9fafb'
  const estadoEmoji = (estado: string) => estado === 'Correcto' ? 'Correcto' : estado.includes('mas') ? 'Te cobran mas' : estado.includes('menos') ? 'Te cobran menos' : estado === 'No facturado' ? 'No facturado' : 'No encontrado'

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">IA Analisis</h1>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowSetup(!showSetup)}>
          {apiKey ? 'Cambiar API Key' : 'Configurar API Key'}
        </button>
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        <div className={`tab ${tabIA === 'facturas' ? 'active' : ''}`} onClick={() => setTabIA('facturas')}>Analizar Facturas</div>
        <div className={`tab ${tabIA === 'catalogo' ? 'active' : ''}`} onClick={() => setTabIA('catalogo')}>Catalogo Proveedor</div>
        <div className={`tab ${tabIA === 'cotejo' ? 'active' : ''}`} onClick={() => setTabIA('cotejo')}>Cotejar Albaran</div>
      </div>

      {/* TAB CATALOGO */}
      {tabIA === 'catalogo' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontFamily: 'Fredoka One', color: 'var(--marron)', marginBottom: 14 }}>Subir catalogo de proveedor</h3>
            <div onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { setCatalogoFile(f); setCatalogoPreview(URL.createObjectURL(f)); setCatalogoResult(null) } }}
              style={{ border: '2px dashed #E8670A', borderRadius: 12, padding: 24, textAlign: 'center', cursor: 'pointer', background: '#fff8f0' }}
              onClick={() => document.getElementById('cat-input')?.click()}>
              <input id="cat-input" type="file" accept="image/*,.pdf" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) { setCatalogoFile(f); setCatalogoPreview(URL.createObjectURL(f)); setCatalogoResult(null) } }} />
              {catalogoPreview
                ? <img src={catalogoPreview} alt="catalogo" style={{ maxHeight: 300, maxWidth: '100%', borderRadius: 8 }} />
                : <div><div style={{ fontSize: '2.5rem', marginBottom: 8 }}>imagen</div><div style={{ fontWeight: 700, color: 'var(--naranja)' }}>Arrastra el catalogo aqui</div></div>
              }
            </div>
            {catalogoFile && (
              <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <label className="input-label">Proveedor</label>
                  <select className="select" value={proveedorSel} onChange={e => setProveedorSel(e.target.value)}>
                    <option value="">Seleccionar proveedor...</option>
                    {proveedores.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <button className="btn btn-primary" onClick={analizarCatalogo} disabled={catalogoLoading} style={{ marginTop: 20 }}>
                  {catalogoLoading ? 'Analizando...' : 'Analizar catalogo'}
                </button>
              </div>
            )}
            {catalogoError && <div style={{ background: '#fef2f2', borderRadius: 8, padding: '10px 14px', marginTop: 12, color: '#dc2626', fontSize: '0.85rem' }}>{catalogoError}</div>}
          </div>

          {catalogoResult && productosEditados.length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ fontFamily: 'Fredoka One', color: 'var(--marron)' }}>{productosEditados.length} productos detectados</h3>
                <button className="btn btn-success" onClick={guardarCatalogo} disabled={guardandoCatalogo}>
                  {guardandoCatalogo ? 'Guardando...' : `Guardar ${productosEditados.length} articulos`}
                </button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Producto</th><th>Precio sin IVA</th><th>IVA %</th><th>Con IVA</th><th>Unidad</th><th></th></tr></thead>
                  <tbody>
                    {productosEditados.map((prod: any, i: number) => (
                      <tr key={i}>
                        <td><input className="input" style={{ minWidth: 180 }} value={prod.nombre}
                          onChange={e => setProductosEditados(prev => prev.map((p: any, j: number) => j === i ? { ...p, nombre: e.target.value } : p))} /></td>
                        <td><input className="input" type="number" step="0.01" style={{ width: 90 }} value={prod.precio_sin_iva}
                          onChange={e => setProductosEditados(prev => prev.map((p: any, j: number) => j === i ? { ...p, precio_sin_iva: parseFloat(e.target.value) || 0 } : p))} /></td>
                        <td>
                          <select className="select" style={{ width: 70 }} value={prod.iva || 4}
                            onChange={e => setProductosEditados(prev => prev.map((p: any, j: number) => j === i ? { ...p, iva: parseInt(e.target.value) } : p))}>
                            <option value={4}>4%</option><option value={10}>10%</option><option value={21}>21%</option>
                          </select>
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--naranja)' }}>{((prod.precio_sin_iva || 0) * (1 + (prod.iva || 4) / 100)).toFixed(2)} EUR</td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--gris)' }}>{prod.unidad || 'ud'}</td>
                        <td><button className="btn btn-danger btn-sm" onClick={() => setProductosEditados(prev => prev.filter((_: any, j: number) => j !== i))}>X</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB COTEJO */}
      {tabIA === 'cotejo' && (
        <div>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '14px 16px', marginBottom: 16, fontSize: '0.85rem', color: '#1e40af' }}>
            <strong>Cotejo de albaranes</strong><br />
            1. Selecciona el mes<br />
            2. Sube la foto del albaran del proveedor<br />
            3. La IA compara con tus pedidos del mes<br />
            4. Ves si te cobran mas, menos o todo correcto
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="form-grid-2" style={{ marginBottom: 12 }}>
              <div className="input-group">
                <label className="input-label">Mes a cotejar</label>
                <input type="month" className="input" value={cotejoMes} onChange={e => setCotejoMes(e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Proveedor (opcional)</label>
                <select className="select" value={cotejoProveedor} onChange={e => setCotejoProveedor(e.target.value)}>
                  <option value="">Todos</option>
                  {proveedores.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
            </div>
            <div onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { setCotejoFile(f); setCotejoPreview(URL.createObjectURL(f)); setCotejoResultado(null) } }}
              style={{ border: '2px dashed #E8670A', borderRadius: 12, padding: 24, textAlign: 'center', cursor: 'pointer', background: '#fff8f0' }}
              onClick={() => document.getElementById('cotejo-input')?.click()}>
              <input id="cotejo-input" type="file" accept="image/*,.pdf" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) { setCotejoFile(f); setCotejoPreview(URL.createObjectURL(f)); setCotejoResultado(null) } }} />
              {cotejoPreview
                ? <img src={cotejoPreview} alt="albaran" style={{ maxHeight: 280, maxWidth: '100%', borderRadius: 8 }} />
                : <div><div style={{ fontSize: '2.5rem', marginBottom: 8 }}>albaran</div><div style={{ fontWeight: 700, color: 'var(--naranja)' }}>Arrastra el albaran aqui</div><div style={{ fontSize: '0.8rem', color: 'var(--gris)' }}>JPG, PNG o PDF</div></div>
              }
            </div>
            {cotejoFile && (
              <div style={{ marginTop: 12 }}>
                <button className="btn btn-primary" onClick={analizarCotejo} disabled={cotejoLoading} style={{ width: '100%' }}>
                  {cotejoLoading ? 'Analizando y cotejando...' : 'Analizar albaran y cotejar'}
                </button>
              </div>
            )}
          </div>

          {cotejoResultado && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
                {[
                  { label: 'Correctos', value: cotejoResultado.ok, color: '#16a34a', bg: '#f0fdf4' },
                  { label: 'Diferencias', value: cotejoResultado.diferencias, color: '#f59e0b', bg: '#fefce8' },
                  { label: 'No encontrado', value: cotejoResultado.noEncontrados, color: '#6b7280', bg: '#f9fafb' },
                  { label: 'No facturado', value: cotejoResultado.noFacturados, color: '#dc2626', bg: '#fef2f2' },
                  { label: 'Total albaran', value: `${Number(cotejoResultado.totalAlbaran || 0).toFixed(2)} EUR`, color: 'var(--naranja)', bg: '#fff8f0' },
                ].map(k => (
                  <div key={k.label} className="card" style={{ padding: 12, background: k.bg, textAlign: 'center' }}>
                    <div style={{ fontFamily: 'Fredoka One', fontSize: '1.2rem', color: k.color }}>{k.value}</div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--gris)', textTransform: 'uppercase', marginTop: 2 }}>{k.label}</div>
                  </div>
                ))}
              </div>

              {(cotejoResultado.proveedor || cotejoResultado.fecha) && (
                <div style={{ background: '#f9fafb', borderRadius: 10, padding: '10px 16px', fontSize: '0.85rem', color: 'var(--gris)' }}>
                  <strong style={{ color: 'var(--marron)' }}>{cotejoResultado.proveedor || 'Proveedor'}</strong>
                  {cotejoResultado.fecha && <span style={{ marginLeft: 12 }}>{cotejoResultado.fecha}</span>}
                  <span style={{ marginLeft: 12 }}>{MESES[parseInt(cotejoMes.split('-')[1]) - 1]} {cotejoMes.split('-')[0]}</span>
                </div>
              )}

              <div className="card" style={{ padding: 0 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #f5e8d8', fontFamily: 'Fredoka One', color: 'var(--marron)' }}>
                  Resultado del cotejo linea por linea
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Estado</th>
                        <th>Articulo en albaran</th>
                        <th style={{ textAlign: 'right' }}>Albaran ud</th>
                        <th style={{ textAlign: 'right' }}>Mis pedidos ud</th>
                        <th style={{ textAlign: 'right' }}>Diferencia</th>
                        <th style={{ textAlign: 'right' }}>Precio unit.</th>
                        <th style={{ textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cotejoResultado.lineas.map((l: any, i: number) => (
                        <tr key={i} style={{ background: estadoBg(l.estado) }}>
                          <td><span style={{ fontWeight: 800, fontSize: '0.82rem', color: estadoColor(l.estado) }}>{estadoEmoji(l.estado)}</span></td>
                          <td>
                            <div style={{ fontWeight: 700 }}>{l.nombreAlbaran !== '—' ? l.nombreAlbaran : '—'}</div>
                            {l.miProducto && l.miProducto !== l.nombreAlbaran && <div style={{ fontSize: '0.7rem', color: 'var(--gris)' }}>{l.miProducto}</div>}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{l.cantidadAlbaran > 0 ? `${l.cantidadAlbaran} ud` : '—'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{l.miCantidad !== null ? `${l.miCantidad} ud` : '—'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: l.diff === 0 ? '#16a34a' : l.diff !== null ? '#dc2626' : '#6b7280' }}>
                            {l.diff !== null ? (l.diff > 0 ? `+${l.diff}` : String(l.diff)) : '—'}
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '0.82rem', color: 'var(--gris)' }}>{l.precioUnit > 0 ? `${Number(l.precioUnit).toFixed(4)} EUR` : '—'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{l.total > 0 ? `${Number(l.total).toFixed(2)} EUR` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ margin: 12, borderRadius: 10, padding: '12px 16px', fontSize: '0.85rem', fontWeight: 700,
                  background: cotejoResultado.diferencias + cotejoResultado.noEncontrados + cotejoResultado.noFacturados > 0 ? '#fef2f2' : '#f0fdf4',
                  color: cotejoResultado.diferencias + cotejoResultado.noEncontrados + cotejoResultado.noFacturados > 0 ? '#dc2626' : '#16a34a' }}>
                  {cotejoResultado.diferencias + cotejoResultado.noEncontrados + cotejoResultado.noFacturados > 0
                    ? `Hay ${cotejoResultado.diferencias + cotejoResultado.noEncontrados + cotejoResultado.noFacturados} incidencias que revisar antes de pagar.`
                    : 'Todo cuadra perfectamente con tus pedidos.'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB FACTURAS */}
      {tabIA === 'facturas' && (
        <div>
          {showSetup && (
            <div className="card" style={{ marginBottom: 16, border: '2px solid #E8670A55', background: '#fff8f0' }}>
              <h3 style={{ fontFamily: 'Fredoka One', color: 'var(--marron)', marginBottom: 10 }}>Configurar Groq</h3>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <input className="input" type="password" placeholder="gsk_..." value={inputKey}
                  onChange={e => setInputKey(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveKey()} style={{ flex: 1 }} />
                <button className="btn btn-primary" onClick={saveKey} disabled={!inputKey.trim()}>Guardar</button>
              </div>
              {error && <p style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: 8, fontWeight: 700 }}>{error}</p>}
            </div>
          )}

          {apiKey && !showSetup && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={16} color="#16a34a" />
              <span><strong style={{ color: '#16a34a' }}>Groq listo.</strong> Sube una foto de factura o albaran.</span>
              {modeloUsado && <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--gris)', background: 'white', padding: '2px 8px', borderRadius: 6 }}>{modeloUsado}</span>}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="card">
              <h3 style={{ fontFamily: 'Fredoka One', color: 'var(--marron)', marginBottom: 8 }}>Subir Imagen</h3>
              <div onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
                onClick={() => document.getElementById('ia-img-input')?.click()}
                style={{ border: `2px dashed ${dragOver ? 'var(--naranja)' : '#e0c9b0'}`, borderRadius: 12, padding: '24px 16px', textAlign: 'center', cursor: 'pointer', background: dragOver ? '#fff3e8' : 'var(--crema)', marginBottom: 12 }}>
                <Upload size={28} color="var(--naranja)" style={{ margin: '0 auto 8px', display: 'block' }} />
                <p style={{ fontWeight: 700, color: 'var(--marron)' }}>Arrastra imagen aqui</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--gris)', marginTop: 4 }}>JPG, PNG, WEBP</p>
              </div>
              <input id="ia-img-input" type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />

              {files.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--crema)', borderRadius: 8, marginBottom: 6 }}>
                  <FileText size={15} color="var(--naranja)" />
                  <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => { setFiles(p => p.filter((_, j) => j !== i)); setPreviewUrl('') }}><X size={12} /></button>
                </div>
              ))}

              {previewUrl && (
                <div style={{ marginBottom: 12 }}>
                  <img src={previewUrl} alt="Vista previa"
                    style={{ width: '100%', borderRadius: 10, objectFit: 'contain', maxHeight: 280, cursor: 'zoom-in', border: '1px solid #f5e8d8' }}
                    onClick={() => window.open(previewUrl, '_blank')} />
                </div>
              )}

              <button className="btn btn-primary" onClick={analyze}
                disabled={!files.length || loading || !apiKey}
                style={{ width: '100%', justifyContent: 'center', padding: 12 }}>
                {loading
                  ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> {status || 'Analizando...'}</>
                  : <><Brain size={16} /> Analizar con IA</>}
              </button>
              {error && <div style={{ marginTop: 10, padding: '12px 14px', background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontSize: '0.85rem', fontWeight: 600 }}>{error}</div>}
            </div>

            <div>
              {loading && (
                <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <Brain size={44} color="var(--naranja)" style={{ margin: '0 auto 14px', display: 'block' }} />
                  <p style={{ fontFamily: 'Fredoka One', fontSize: '1.1rem', color: 'var(--marron)' }}>{status || 'Analizando...'}</p>
                </div>
              )}

              {result && !loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="card" style={{ background: 'var(--crema-dark)' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--marron)' }}>{result.resumen}</p>
                    {result.fecha_documento && <p style={{ fontSize: '0.78rem', color: 'var(--gris)', marginTop: 4 }}>Fecha: {result.fecha_documento}</p>}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                    {[
                      { label: 'Unidades', value: result.total_unidades, color: '#2563eb', icon: ShoppingCart },
                      { label: 'Base s/IVA', value: `${Number(result.subtotal_sin_iva).toFixed(2)}EUR`, color: '#ca8a04', icon: TrendingUp },
                      { label: 'IVA', value: `${Number(result.total_iva).toFixed(2)}EUR`, color: '#7c3aed', icon: TrendingUp },
                      { label: 'TOTAL', value: `${Number(result.total_con_iva).toFixed(2)}EUR`, color: '#16a34a', icon: TrendingUp },
                    ].map(s => (
                      <div key={s.label} className="card" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <s.icon size={18} color={s.color} />
                        <div>
                          <div style={{ fontFamily: 'Fredoka One', fontSize: '1.1rem', color: s.color }}>{s.value}</div>
                          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--gris)', textTransform: 'uppercase' }}>{s.label}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {result.productos?.length > 0 && (
                    <div className="card" style={{ padding: 0 }}>
                      <div style={{ padding: '10px 14px', borderBottom: '1px solid #f5e8d8', fontFamily: 'Fredoka One', color: 'var(--marron)' }}>
                        Productos ({result.productos.length})
                      </div>
                      <div className="table-wrap">
                        <table>
                          <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>IVA</th><th>Total</th></tr></thead>
                          <tbody>
                            {result.productos.map((p, i) => (
                              <tr key={i}>
                                <td><strong>{p.nombre}</strong></td>
                                <td style={{ textAlign: 'center' }}>{p.cantidad}</td>
                                <td>{p.precio ? `${Number(p.precio).toFixed(2)}EUR` : '—'}</td>
                                <td><span style={{ color: ivaColor(p.iva), fontWeight: 800, fontSize: '0.8rem' }}>{p.iva ? `${p.iva}%` : '—'}</span></td>
                                <td><strong style={{ color: 'var(--naranja)' }}>{p.total ? `${Number(p.total).toFixed(2)}EUR` : '—'}</strong></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div style={{ background: '#fff8f0', border: '1px solid #f5e8d8', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editando ? 10 : 0 }}>
                      <p style={{ fontSize: '0.85rem', color: 'var(--marron)', fontWeight: 700, margin: 0 }}>Corregir importe</p>
                      <button className="btn btn-secondary btn-sm" onClick={() => {
                        setEditando(!editando)
                        setTotalManual(String(result.total_con_iva || ''))
                        setConceptoManual(result.resumen || '')
                        setFechaManual(result.fecha_documento || new Date().toISOString().split('T')[0])
                      }}>{editando ? 'Cerrar' : 'Corregir'}</button>
                    </div>
                    {editando && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                          <label className="input-label">Concepto</label>
                          <input className="input" value={conceptoManual} onChange={e => setConceptoManual(e.target.value)} />
                        </div>
                        <div className="form-grid-2">
                          <div className="input-group" style={{ marginBottom: 0 }}>
                            <label className="input-label">Importe total (EUR)</label>
                            <input className="input" type="number" step="0.01" value={totalManual} onChange={e => setTotalManual(e.target.value)} />
                          </div>
                          <div className="input-group" style={{ marginBottom: 0 }}>
                            <label className="input-label">Fecha</label>
                            <input className="input" type="date" value={fechaManual} onChange={e => setFechaManual(e.target.value)} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '14px 16px' }}>
                    <p style={{ fontSize: '0.85rem', color: '#166534', fontWeight: 700, marginBottom: 6 }}>Registrar en contabilidad</p>
                    {gastoGuardado ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a', fontWeight: 800 }}>
                        <CheckCircle size={18} /> Registrado en Gastos.
                      </div>
                    ) : (
                      <button className="btn btn-success" onClick={guardarComoGasto} disabled={guardandoGasto} style={{ width: '100%', justifyContent: 'center' }}>
                        <PlusCircle size={16} />
                        {guardandoGasto ? 'Guardando...' : `Registrar ${editando && totalManual ? parseFloat(totalManual).toFixed(2) : Number(result.total_con_iva).toFixed(2)} EUR como gasto`}
                      </button>
                    )}
                  </div>

                  {result.observaciones && (
                    <div className="card" style={{ background: '#fff8f0', border: '1px solid #f5e8d8' }}>
                      <p style={{ fontSize: '0.85rem', color: 'var(--marron)' }}>{result.observaciones}</p>
                    </div>
                  )}
                </div>
              )}

              {!result && !loading && (
                <div className="card">
                  {previewUrl ? (
                    <div>
                      <p style={{ fontFamily: 'Fredoka One', color: 'var(--marron)', marginBottom: 8 }}>Imagen lista</p>
                      <img src={previewUrl} alt="Vista previa"
                        style={{ width: '100%', borderRadius: 10, objectFit: 'contain', maxHeight: 350, cursor: 'zoom-in' }}
                        onClick={() => window.open(previewUrl, '_blank')} />
                    </div>
                  ) : (
                    <div className="empty-state">
                      <Brain size={48} />
                      <p>Sube una imagen para analizar</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  )
}