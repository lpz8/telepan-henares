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

  const ivaColor = (iva?: number) => !iva || iva <= 4 ? '#16a34a' : iva <= 10 ? '#E8670A' : '#dc2626'

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">🧠 IA — Análisis de Facturas</h1>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowSetup(!showSetup)}>
          🔑 {apiKey ? 'Cambiar API Key' : 'Configurar API Key'}
        </button>
      </div>

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
    </div>
  )
}