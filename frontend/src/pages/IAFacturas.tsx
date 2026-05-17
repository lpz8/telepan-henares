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

const PROMPT = `Eres un asistente contable para TELEPAN HENARES, panadería española.
Analiza la imagen (factura, albarán, ticket o pedido).
Responde ÚNICAMENTE con JSON válido sin markdown ni texto extra:
{"resumen":"descripción","tipo_documento":"factura|albaran|ticket|pedido","fecha_documento":null,"cliente":null,"productos":[{"nombre":"","cantidad":1,"precio":0,"total":0,"iva":4}],"total_unidades":0,"subtotal_sin_iva":0,"total_iva":0,"total_con_iva":0,"gastos_detectados":[],"beneficio_estimado":0,"forma_pago":null,"observaciones":""}
Productos IVA 4%: CASA 1€, PISTOLA 0.88€, BASTÓN 1.20€, LEÑA 1.35€, CHAPATA 1.05€, ROMBITO 0.88€, ARTESANA 0.88€, CANDEALITO 0.88€.
IVA 21%: REVISTAS/PERIÓDICO 3-4€. Huevos IVA 4%: CAJA 76.93€, DOCENA 4.10€.
beneficio = total_con_iva - suma importes de gastos_detectados.`


const PROMPT_CATALOGO = `Eres un asistente para TELEPAN HENARES, panadería española.
Analiza esta imagen de catálogo o lista de precios de proveedor.
Extrae TODOS los productos con sus precios.
Responde ÚNICAMENTE con JSON válido sin markdown ni texto extra:
{"proveedor":"nombre del proveedor si aparece","fecha":"fecha si aparece","productos":[{"nombre":"nombre del artículo","precio_sin_iva":0.00,"iva":4,"unidad":"ud/kg/caja/docena","descripcion":"descripción adicional si hay"}],"observaciones":"notas relevantes"}
IMPORTANTE:
- precio_sin_iva: precio SIN IVA en euros (número decimal)
- iva: porcentaje de IVA (4, 10 o 21)
- Si el precio incluye IVA y el IVA es 4%, divide entre 1.04 para obtener precio sin IVA
- Pan y productos de panadería: IVA 4%
- Bollería: IVA 4%  
- Huevos: IVA 4%
- Extrae TODOS los productos que veas, no omitas ninguno`

const KEY_NAME = 'groq_key_v1'

export default function IAFacturas() {
  const { user } = useAuth()
  const [files, setFiles] = useState<File[]>([])
  const [previewUrl, setPreviewUrl] = useState<string>('')
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
  // Catálogo proveedor
  const [tabIA, setTabIA] = useState<'facturas' | 'catalogo'>('facturas')
  const [catalogoFile, setCatalogoFile] = useState<File | null>(null)
  const [catalogoPreview, setCatalogoPreview] = useState('')
  const [catalogoLoading, setCatalogoLoading] = useState(false)
  const [catalogoResult, setCatalogoResult] = useState<any>(null)
  const [catalogoError, setCatalogoError] = useState('')
  const [proveedores, setProveedores] = useState<any[]>([])
  const [proveedorSel, setProveedorSel] = useState('')
  const [guardandoCatalogo, setGuardandoCatalogo] = useState(false)
  const [productosEditados, setProductosEditados] = useState<any[]>([])
  const [fechaManual, setFechaManual] = useState('')

  useEffect(() => {
    ['gemini_key', 'gemini_key_v3', 'openrouter_key', 'or_key_v1'].forEach(k => localStorage.removeItem(k))
    const saved = localStorage.getItem(KEY_NAME) || ''
    if (saved.startsWith('gsk_')) { setApiKey(saved); setShowSetup(false) }
    else setShowSetup(true)
  }, [])

  const saveKey = () => {
    const k = inputKey.trim()
    if (!k.startsWith('gsk_')) { setError('La key debe empezar por gsk_ (es de Groq)'); return }
    localStorage.setItem(KEY_NAME, k)
    setApiKey(k); setShowSetup(false); setError('')
    globalToast('✅ API Key de Groq guardada')
  }

  const handleFiles = (fl: FileList | null) => {
    if (!fl) return
    const valid = Array.from(fl).filter(f => f.type.startsWith('image/'))
    if (!valid.length) { setError('Solo imágenes: JPG, PNG, WEBP.'); return }
    setFiles(prev => [...prev, ...valid])
    setPreviewUrl(URL.createObjectURL(valid[0]))
    setError('')
  }

  const toBase64 = (f: File): Promise<string> => new Promise(res => {
    const r = new FileReader()
    r.onload = () => res((r.result as string).split(',')[1])
    r.readAsDataURL(f)
  })

  const tryGroqModel = async (model: string, b64: string, mime: string): Promise<string> => {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: [
          { type: 'text', text: PROMPT },
          { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } }
        ]}],
        max_tokens: 2048, temperature: 0.1,
      })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error?.message || `Error ${res.status}`)
    const text = data.choices?.[0]?.message?.content || ''
    if (!text) throw new Error('Respuesta vacía')
    return text
  }

  const analyze = async () => {
    if (!files.length || !apiKey) return
    setLoading(true); setError(''); setResult(null)
    setModeloUsado(''); setGastoGuardado(false); setStatus('Preparando imagen...')
    try {
      const file = files[0]
      const b64 = await toBase64(file)
      const mime = file.type || 'image/jpeg'
      let text = '', modelName = '', lastErr = ''
      for (const model of GROQ_MODELOS) {
        setStatus(`Probando ${model}...`)
        try { text = await tryGroqModel(model, b64, mime); modelName = model; break }
        catch (e: any) {
          lastErr = e.message
          if (e.message?.includes('401') || e.message?.includes('invalid_api_key')) {
            localStorage.removeItem(KEY_NAME); setApiKey(''); setShowSetup(true)
            throw new Error('API Key no válida. Crea una nueva en console.groq.com')
          }
        }
      }
      if (!modelName) throw new Error(`Todos los modelos fallaron. Error: ${lastErr}`)
      setModeloUsado(modelName); setStatus('Extrayendo datos...')
      const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()
      const match = clean.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('La IA no devolvió datos válidos. Usa imagen más nítida.')
      setResult(JSON.parse(match[0]))
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
      if (result.gastos_detectados?.length > 0 && !editando) {
        const inserts = result.gastos_detectados.map(g => {
          const parts = g.split(' - ')
          const concepto = parts[0]?.trim() || g
          const importe = parseFloat((parts[1] || '0').replace('€','').replace(',','.').trim()) || totalFinal
          return { user_id: user.id, concepto, categoria: 'Proveedor', importe, fecha }
        })
        await supabase.from('gastos').insert(inserts)
        globalToast(`✅ ${inserts.length} gastos registrados`)
      } else {
        await supabase.from('gastos').insert({ user_id: user.id, concepto: conceptoFinal, categoria: 'Proveedor', importe: totalFinal, fecha })
        globalToast('✅ Gasto registrado en contabilidad')
      }
      setGastoGuardado(true)
    } catch (e: any) { globalToast(e.message, 'error') }
    setGuardandoGasto(false)
  }

  // Cargar proveedores
  useEffect(() => {
    supabase.from('proveedores').select('id, nombre').order('nombre').then(r => {
      if (r.data) setProveedores(r.data)
    })
  }, [])

  // Analizar catálogo con IA
  const analizarCatalogo = async () => {
    if (!catalogoFile) return globalToast('Sube una imagen del catálogo', 'error')
    if (!apiKey) return globalToast('Configura tu API Key de Groq primero', 'error')
    setCatalogoLoading(true); setCatalogoError(''); setCatalogoResult(null)

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = e => resolve((e.target?.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(catalogoFile)
      })

      const isImage = catalogoFile.type.startsWith('image/')
      const messages = [{
        role: 'user',
        content: isImage ? [
          { type: 'image_url', image_url: { url: `data:${catalogoFile.type};base64,${base64}` } },
          { type: 'text', text: PROMPT_CATALOGO }
        ] : [{ type: 'text', text: PROMPT_CATALOGO }]
      }]

      let resultado = null
      for (const modelo of GROQ_MODELOS) {
        try {
          const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model: modelo, messages, max_tokens: 4000, temperature: 0.1 })
          })
          const data = await resp.json()
          if (data.choices?.[0]?.message?.content) {
            const text = data.choices[0].message.content.trim()
              .replace(/^```json[\r\n]?/, '').replace(/[\r\n]?```$/, '').trim()
            resultado = JSON.parse(text)
            break
          }
        } catch { continue }
      }

      if (!resultado) throw new Error('No se pudo analizar el catálogo')

      setCatalogoResult(resultado)
      setProductosEditados(resultado.productos || [])
      if (resultado.proveedor) {
        const match = proveedores.find(p => p.nombre.toLowerCase().includes(resultado.proveedor.toLowerCase()))
        if (match) setProveedorSel(match.id)
      }
      globalToast(`✅ ${(resultado.productos || []).length} productos detectados`)
    } catch (err: any) {
      setCatalogoError(err.message)
      globalToast('Error: ' + err.message, 'error')
    }
    setCatalogoLoading(false)
  }

  // Guardar artículos del catálogo en precios_proveedor
  const guardarCatalogo = async () => {
    if (!productosEditados.length) return
    if (!user) return
    if (!proveedorSel) return globalToast('Selecciona el proveedor primero', 'error')
    setGuardandoCatalogo(true)

    let guardados = 0
    for (const prod of productosEditados) {
      if (!prod.nombre || prod.precio_sin_iva === undefined) continue

      // Buscar si ya existe este artículo en precios_proveedor
      const { data: existing } = await supabase
        .from('precios_proveedor')
        .select('id')
        .eq('proveedor_id', proveedorSel)
        .ilike('articulo', prod.nombre)
        .limit(1)

      if (existing && existing.length > 0) {
        await supabase.from('precios_proveedor').update({
          precio_cliente: Number(prod.precio_sin_iva),
        }).eq('id', existing[0].id)
      } else {
        await supabase.from('precios_proveedor').insert({
          user_id: user.id,
          proveedor_id: proveedorSel,
          articulo: prod.nombre.toUpperCase(),
          precio_cliente: Number(prod.precio_sin_iva),
          precio_pvp: 0,
          categoria: 'Pan',
          codigo: ''
        })
      }
      guardados++
    }

    await supabase.from('proveedores').update({
      notas: `Catálogo actualizado: ${new Date().toLocaleDateString('es-ES')} — ${guardados} artículos`
    }).eq('id', proveedorSel)

    globalToast(`✅ ${guardados} artículos guardados en Proveedores → Precios`)
    setGuardandoCatalogo(false)
    setCatalogoResult(null)
    setProductosEditados([])
    setCatalogoFile(null)
    setCatalogoPreview('')
  }

  const ivaColor = (iva?: number) => !iva || iva <= 4 ? '#16a34a' : iva <= 10 ? '#E8670A' : '#dc2626'

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">🧠 IA — Análisis</h1>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowSetup(!showSetup)}>
          🔑 {apiKey ? 'Cambiar API Key' : 'Configurar API Key'}
        </button>
      </div>

      {/* TABS */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        <div className={`tab ${tabIA === 'facturas' ? 'active' : ''}`} onClick={() => setTabIA('facturas')}>
          📄 Analizar Facturas / Albaranes
        </div>
        <div className={`tab ${tabIA === 'catalogo' ? 'active' : ''}`} onClick={() => setTabIA('catalogo')}>
          📦 Catálogo de Proveedor
        </div>
      </div>

      {/* TAB CATÁLOGO */}
      {tabIA === 'catalogo' && (
        <div>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '14px 16px', marginBottom: 16, fontSize: '0.85rem', color: '#1e40af' }}>
            <strong>📦 ¿Cómo funciona?</strong><br />
            1. Sube la foto o PDF del catálogo de tu proveedor<br />
            2. La IA detecta automáticamente todos los productos y precios<br />
            3. Revisa y corrige si es necesario<br />
            4. Pulsa "Guardar" — los precios se guardan en Proveedores → Precios y se usan en Estadísticas
          </div>

          {!apiKey && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 14, marginBottom: 16, color: '#dc2626', fontWeight: 700 }}>
              ⚠️ Configura tu API Key de Groq primero (botón arriba a la derecha)
            </div>
          )}

          {/* Subir imagen */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontFamily: 'Fredoka One', color: 'var(--marron)', marginBottom: 14 }}>📷 Subir catálogo</h3>
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault()
                const file = e.dataTransfer.files[0]
                if (file) {
                  setCatalogoFile(file)
                  setCatalogoPreview(URL.createObjectURL(file))
                  setCatalogoResult(null)
                }
              }}
              style={{ border: '2px dashed #E8670A', borderRadius: 12, padding: '24px', textAlign: 'center', cursor: 'pointer', background: '#fff8f0' }}
              onClick={() => document.getElementById('cat-input')?.click()}>
              <input id="cat-input" type="file" accept="image/*,.pdf" style={{ display: 'none' }}
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) { setCatalogoFile(file); setCatalogoPreview(URL.createObjectURL(file)); setCatalogoResult(null) }
                }} />
              {catalogoPreview ? (
                <img src={catalogoPreview} alt="catálogo" style={{ maxHeight: 300, maxWidth: '100%', borderRadius: 8 }} />
              ) : (
                <div>
                  <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📄</div>
                  <div style={{ fontWeight: 700, color: 'var(--naranja)' }}>Arrastra la foto del catálogo aquí</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--gris)', marginTop: 4 }}>o haz clic para seleccionar (JPG, PNG, PDF)</div>
                </div>
              )}
            </div>

            {catalogoFile && (
              <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <label className="input-label">Proveedor (opcional)</label>
                  <select className="select" value={proveedorSel} onChange={e => setProveedorSel(e.target.value)}>
                    <option value="">Seleccionar proveedor...</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <button className="btn btn-primary" onClick={analizarCatalogo} disabled={catalogoLoading}
                  style={{ marginTop: 20, minWidth: 160 }}>
                  {catalogoLoading ? '⏳ Analizando...' : '🧠 Analizar catálogo'}
                </button>
              </div>
            )}

            {catalogoError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginTop: 12, color: '#dc2626', fontSize: '0.85rem' }}>
                ❌ {catalogoError}
              </div>
            )}
          </div>

          {/* Resultados del catálogo */}
          {catalogoResult && productosEditados.length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ fontFamily: 'Fredoka One', color: 'var(--marron)' }}>
                  ✅ {productosEditados.length} productos detectados
                  {catalogoResult.proveedor && <span style={{ fontSize: '0.85rem', fontWeight: 400, marginLeft: 8 }}>— {catalogoResult.proveedor}</span>}
                </h3>
                <button className="btn btn-success" onClick={guardarCatalogo} disabled={guardandoCatalogo}>
                  {guardandoCatalogo ? '⏳ Guardando...' : `💾 Guardar ${productosEditados.length} artículos en Proveedor`}
                </button>
              </div>

              <div style={{ background: '#eff6ff', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: '0.82rem', color: '#1e40af' }}>
                💡 Revisa y corrige los precios si es necesario antes de guardar. Se actualizarán en tus productos.
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th style={{ textAlign: 'center' }}>Precio sin IVA</th>
                      <th style={{ textAlign: 'center' }}>IVA %</th>
                      <th style={{ textAlign: 'center' }}>Precio con IVA</th>
                      <th>Unidad</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {productosEditados.map((prod, i) => (
                      <tr key={i}>
                        <td>
                          <input className="input" style={{ minWidth: 200, padding: '4px 8px' }}
                            value={prod.nombre}
                            onChange={e => setProductosEditados(prev => prev.map((p, j) => j === i ? { ...p, nombre: e.target.value } : p))} />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input className="input" type="number" step="0.01" min="0"
                            style={{ width: 90, textAlign: 'center', padding: '4px 8px' }}
                            value={prod.precio_sin_iva}
                            onChange={e => setProductosEditados(prev => prev.map((p, j) => j === i ? { ...p, precio_sin_iva: parseFloat(e.target.value) || 0 } : p))} />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <select className="select" style={{ width: 70, padding: '4px 6px' }}
                            value={prod.iva || 4}
                            onChange={e => setProductosEditados(prev => prev.map((p, j) => j === i ? { ...p, iva: parseInt(e.target.value) } : p))}>
                            <option value={4}>4%</option>
                            <option value={10}>10%</option>
                            <option value={21}>21%</option>
                          </select>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--naranja)' }}>
                          {((prod.precio_sin_iva || 0) * (1 + (prod.iva || 4) / 100)).toFixed(2)} €
                        </td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--gris)' }}>{prod.unidad || 'ud'}</td>
                        <td>
                          <button className="btn btn-danger btn-sm btn-icon"
                            onClick={() => setProductosEditados(prev => prev.filter((_, j) => j !== i))}>
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ textAlign: 'right', marginTop: 12 }}>
                <button className="btn btn-success" onClick={guardarCatalogo} disabled={guardandoCatalogo}>
                  {guardandoCatalogo ? '⏳ Guardando...' : `💾 Guardar ${productosEditados.length} artículos en Proveedor`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB FACTURAS — lo existente */}
      {tabIA === 'facturas' && (<div>

      {showSetup && (
        <div className="card" style={{ marginBottom: 16, border: '2px solid #E8670A55', background: '#fff8f0' }}>
          <h3 style={{ fontFamily: 'Fredoka One', color: 'var(--marron)', marginBottom: 10 }}>
            🔑 Configurar Groq — Gratis, 14.400 análisis/día
          </h3>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: '0.85rem' }}>
            ✅ <strong style={{ color: '#16a34a' }}>Completamente gratis.</strong> 14.400 análisis por día. Sin tarjeta de crédito.
          </div>
          {[
            { n: '1', text: 'Ve a console.groq.com e inicia sesión con Gmail' },
            { n: '2', text: 'Menú izquierdo → API Keys → Create API Key' },
            { n: '3', text: 'Copia la key — empieza por gsk_...' },
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--naranja)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fredoka One', flexShrink: 0 }}>{s.n}</div>
              <span style={{ fontSize: '0.875rem' }}>{s.text}</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input className="input" type="password" placeholder="gsk_..." value={inputKey}
              onChange={e => setInputKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveKey()}
              style={{ flex: 1 }} />
            <button className="btn btn-primary" onClick={saveKey} disabled={!inputKey.trim()}>
              <CheckCircle size={16} /> Guardar
            </button>
          </div>
          {error && <p style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: 8, fontWeight: 700 }}>⚠️ {error}</p>}
        </div>
      )}

      {apiKey && !showSetup && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={16} color="#16a34a" />
          <span><strong style={{ color: '#16a34a' }}>Groq listo.</strong> Sube una foto de factura o albarán.</span>
          {modeloUsado && <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--gris)', background: 'white', padding: '2px 8px', borderRadius: 6 }}>✓ {modeloUsado}</span>}
        </div>
      )}

      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: '0.82rem', color: '#1e40af' }}>
        💡 <strong>Conectado con Gastos y Estadísticas:</strong> Tras el análisis puedes registrar el gasto directamente con un clic.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* COLUMNA IZQUIERDA — Subir imagen */}
        <div className="card">
          <h3 style={{ fontFamily: 'Fredoka One', color: 'var(--marron)', marginBottom: 8 }}>📎 Subir Imagen</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--gris)', marginBottom: 12 }}>
            Haz una foto clara a la factura o albarán. <strong>Buena luz y enfocada</strong> para mejores resultados.
          </p>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
            onClick={() => document.getElementById('ia-img-input')?.click()}
            style={{ border: `2px dashed ${dragOver ? 'var(--naranja)' : '#e0c9b0'}`, borderRadius: 12, padding: '24px 16px', textAlign: 'center', cursor: 'pointer', background: dragOver ? '#fff3e8' : 'var(--crema)', transition: 'all 0.2s', marginBottom: 12 }}>
            <Upload size={28} color="var(--naranja)" style={{ margin: '0 auto 8px', display: 'block' }} />
            <p style={{ fontWeight: 700, color: 'var(--marron)' }}>Arrastra imagen aquí</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--gris)', marginTop: 4 }}>o clic para seleccionar · JPG, PNG, WEBP</p>
          </div>
          <input id="ia-img-input" type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />

          {files.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--crema)', borderRadius: 8, marginBottom: 6 }}>
              <FileText size={15} color="var(--naranja)" />
              <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--gris)' }}>{(f.size / 1024).toFixed(0)}KB</span>
              <button className="btn btn-danger btn-sm btn-icon" onClick={() => { setFiles(p => p.filter((_, j) => j !== i)); setPreviewUrl('') }}><X size={12} /></button>
            </div>
          ))}

          {/* PREVIEW IMAGEN */}
          {previewUrl && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--gris)', fontWeight: 700, marginBottom: 6 }}>📷 Vista previa (clic para ampliar):</p>
              <img src={previewUrl} alt="Vista previa"
                style={{ width: '100%', borderRadius: 10, objectFit: 'contain', maxHeight: 280, cursor: 'zoom-in', border: '1px solid #f5e8d8' }}
                onClick={() => window.open(previewUrl, '_blank')} />
            </div>
          )}

          <button className="btn btn-primary" onClick={analyze}
            disabled={!files.length || loading || !apiKey}
            style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: 4 }}>
            {loading
              ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> {status || 'Analizando...'}</>
              : <><Brain size={16} /> Analizar con IA (Gratis)</>}
          </button>

          {!apiKey && !showSetup && (
            <div style={{ marginTop: 10, padding: '10px 14px', background: '#fef3c7', borderRadius: 8, fontSize: '0.85rem', color: '#92400e', fontWeight: 700 }}>
              ⚠️ Primero configura la API Key de Groq (botón arriba a la derecha)
            </div>
          )}
          {error && (
            <div style={{ marginTop: 10, padding: '12px 14px', background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.5 }}>
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA — Resultados */}
        <div>
          {loading && (
            <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <Brain size={44} color="var(--naranja)" style={{ margin: '0 auto 14px', display: 'block' }} />
              <p style={{ fontFamily: 'Fredoka One', fontSize: '1.1rem', color: 'var(--marron)' }}>{status || 'Analizando...'}</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--gris)', marginTop: 6 }}>Extrayendo productos, cantidades e importes</p>
              {previewUrl && (
                <img src={previewUrl} alt="Analizando" style={{ width: '100%', borderRadius: 10, marginTop: 14, opacity: 0.6, maxHeight: 200, objectFit: 'contain' }} />
              )}
            </div>
          )}

          {result && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* IMAGEN ORIGINAL para comparar */}
              {previewUrl && (
                <div className="card" style={{ padding: 8 }}>
                  <p style={{ fontFamily: 'Fredoka One', color: 'var(--marron)', fontSize: '0.82rem', marginBottom: 6 }}>
                    📷 Imagen original — compara con los datos detectados
                  </p>
                  <img src={previewUrl} alt="Factura original"
                    style={{ width: '100%', borderRadius: 8, objectFit: 'contain', maxHeight: 300, cursor: 'zoom-in', border: '1px solid #f5e8d8' }}
                    onClick={() => window.open(previewUrl, '_blank')} />
                  <p style={{ fontSize: '0.7rem', color: 'var(--gris)', marginTop: 4, textAlign: 'center' }}>
                    Clic para ampliar a pantalla completa
                  </p>
                </div>
              )}

              {/* Cabecera resultado */}
              <div className="card" style={{ background: 'var(--crema-dark)' }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
                  {[
                    { label: 'Tipo', value: result.tipo_documento },
                    result.fecha_documento ? { label: 'Fecha', value: result.fecha_documento } : null,
                    result.cliente ? { label: 'Cliente', value: result.cliente } : null,
                  ].filter(Boolean).map((s: any) => (
                    <div key={s.label}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--gris)', fontWeight: 800, textTransform: 'uppercase' }}>{s.label}</div>
                      <div style={{ fontWeight: 800, textTransform: 'capitalize' }}>{s.value}</div>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--marron)' }}>{result.resumen}</p>
              </div>

              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                {[
                  { label: 'Unidades', value: result.total_unidades, color: '#2563eb', icon: ShoppingCart },
                  { label: 'Base s/IVA', value: `${Number(result.subtotal_sin_iva).toFixed(2)}€`, color: '#ca8a04', icon: TrendingUp },
                  { label: 'IVA', value: `${Number(result.total_iva).toFixed(2)}€`, color: '#7c3aed', icon: TrendingUp },
                  { label: 'TOTAL', value: `${Number(result.total_con_iva).toFixed(2)}€`, color: '#16a34a', icon: TrendingUp },
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

              {/* Productos */}
              {result.productos?.length > 0 && (
                <div className="card" style={{ padding: 0 }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid #f5e8d8', fontFamily: 'Fredoka One', color: 'var(--marron)' }}>
                    📦 Productos ({result.productos.length})
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>IVA</th><th>Total</th></tr></thead>
                      <tbody>
                        {result.productos.map((p, i) => (
                          <tr key={i}>
                            <td><strong>{p.nombre}</strong></td>
                            <td style={{ textAlign: 'center' }}>{p.cantidad}</td>
                            <td>{p.precio ? `${Number(p.precio).toFixed(2)}€` : '—'}</td>
                            <td><span style={{ color: ivaColor(p.iva), fontWeight: 800, fontSize: '0.8rem' }}>{p.iva ? `${p.iva}%` : '—'}</span></td>
                            <td><strong style={{ color: 'var(--naranja)' }}>{p.total ? `${Number(p.total).toFixed(2)}€` : '—'}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Corrección manual */}
              <div style={{ background: '#fff8f0', border: '1px solid #f5e8d8', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editando ? 10 : 0 }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--marron)', fontWeight: 700, margin: 0 }}>
                    ✏️ ¿Algún importe no reconocido?
                  </p>
                  <button className="btn btn-secondary btn-sm" onClick={() => {
                    setEditando(!editando)
                    setTotalManual(String(result.total_con_iva || ''))
                    setConceptoManual(result.resumen || '')
                    setFechaManual(result.fecha_documento || new Date().toISOString().split('T')[0])
                  }}>
                    {editando ? 'Cerrar' : 'Corregir'}
                  </button>
                </div>
                {editando && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label className="input-label">Concepto</label>
                      <input className="input" value={conceptoManual} onChange={e => setConceptoManual(e.target.value)} />
                    </div>
                    <div className="form-grid-2">
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label">Importe total (€)</label>
                        <input className="input" type="number" step="0.01" value={totalManual} onChange={e => setTotalManual(e.target.value)} />
                      </div>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label">Fecha</label>
                        <input className="input" type="date" value={fechaManual} onChange={e => setFechaManual(e.target.value)} />
                      </div>
                    </div>
                    <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '8px 12px', fontSize: '0.78rem', color: '#166534' }}>
                      💡 Al registrar usará estos valores corregidos.
                    </div>
                  </div>
                )}
              </div>

              {/* Registrar gasto */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '14px 16px' }}>
                <p style={{ fontSize: '0.85rem', color: '#166534', fontWeight: 700, marginBottom: 6 }}>
                  📊 ¿Registrar en contabilidad?
                </p>
                {gastoGuardado ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a', fontWeight: 800 }}>
                    <CheckCircle size={18} /> ¡Registrado! Consulta Gastos o Estadísticas.
                  </div>
                ) : (
                  <button className="btn btn-success" onClick={guardarComoGasto}
                    disabled={guardandoGasto}
                    style={{ width: '100%', justifyContent: 'center' }}>
                    <PlusCircle size={16} />
                    {guardandoGasto ? 'Guardando...' : `Registrar ${editando && totalManual ? parseFloat(totalManual).toFixed(2) : Number(result.total_con_iva).toFixed(2)}€ como gasto`}
                  </button>
                )}
              </div>

              {result.observaciones && (
                <div className="card" style={{ background: '#fff8f0', border: '1px solid #f5e8d8' }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--marron)' }}>💡 {result.observaciones}</p>
                </div>
              )}
            </div>
          )}

          {!result && !loading && (
            <div className="card">
              {previewUrl ? (
                <div>
                  <p style={{ fontFamily: 'Fredoka One', color: 'var(--marron)', marginBottom: 8, fontSize: '0.9rem' }}>
                    📷 Imagen lista — pulsa Analizar con IA
                  </p>
                  <img src={previewUrl} alt="Vista previa"
                    style={{ width: '100%', borderRadius: 10, objectFit: 'contain', maxHeight: 350, cursor: 'zoom-in' }}
                    onClick={() => window.open(previewUrl, '_blank')} />
                  <p style={{ fontSize: '0.7rem', color: 'var(--gris)', marginTop: 6, textAlign: 'center' }}>Clic para ampliar</p>
                </div>
              ) : (
                <div className="empty-state">
                  <Brain size={48} />
                  <p>Sube una imagen para analizar</p>
                  <span>Detecta productos, IVA, totales y gastos automáticamente</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
      `}</style>
    </div>)}
    </div>
  )
}