import { useEffect, useState } from 'react'
import { Plus, Trash2, X, TrendingUp, TrendingDown, Edit2, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { globalToast } from '../components/Layout'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const EMOJIS = ['⛽','🚛','🥖','👤','🔧','📱','🏛️','🏠','💊','📦','💰','🎁','🔑','📋','🚗','✈️','🍽️','💡','🔒','📊']

const DEFAULT_CATS = [
  { emoji: '⛽', nombre: 'Gasoil' },
  { emoji: '🚛', nombre: 'Proveedor' },
  { emoji: '🥖', nombre: 'Materias Primas' },
  { emoji: '👤', nombre: 'Autónomo/Seguro Social' },
  { emoji: '🔧', nombre: 'Mantenimiento/Averías' },
  { emoji: '📱', nombre: 'Teléfono/Internet' },
  { emoji: '🏛️', nombre: 'Seguros' },
  { emoji: '🏠', nombre: 'Alquiler' },
  { emoji: '📦', nombre: 'Otros' },
]

const CAT_STORAGE_KEY = 'telepan_gasto_cats_v1'

const FORMAS_PAGO = ['Transferencia', 'Bizum', 'Efectivo', 'Tarjeta', 'Domiciliación']
const INGRESOS_CATS = ['🎁 Venta directa', '🔑 Servicio extra', '💰 Otros ingresos', '📋 Devolución']
const MESES_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const emptyGasto = { concepto: '', categoria: '⛽ Gasoil', importe: 0, fecha: new Date().toISOString().split('T')[0], forma_pago: 'Transferencia', notas: '' }
const emptyIngreso = { concepto: '', categoria: '💰 Otros ingresos', importe: 0, fecha: new Date().toISOString().split('T')[0], forma_cobro: 'Efectivo', notas: '' }

export default function Gastos() {
  const { user } = useAuth()
  const [gastos, setGastos] = useState<any[]>([])
  const [ingresos, setIngresos] = useState<any[]>([])
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7))
  const [openGasto, setOpenGasto] = useState(false)
  const [openIngreso, setOpenIngreso] = useState(false)
  const [editingGasto, setEditingGasto] = useState<any>(null)
  const [editingIngreso, setEditingIngreso] = useState<any>(null)
  const [formGasto, setFormGasto] = useState(emptyGasto)
  const [formIngreso, setFormIngreso] = useState(emptyIngreso)
  const [tab, setTab] = useState<'gastos' | 'ingresos' | 'beneficios' | 'categorias'>('gastos')
  const [ventasMes, setVentasMes] = useState(0)
  const [comparativa, setComparativa] = useState<any[]>([])
  const [filterCat, setFilterCat] = useState('todas')
  // Categorías personalizables
  const [cats, setCats] = useState<{emoji:string,nombre:string}[]>(() => {
    try { return JSON.parse(localStorage.getItem(CAT_STORAGE_KEY) || 'null') || DEFAULT_CATS } catch { return DEFAULT_CATS }
  })
  const [editCatIdx, setEditCatIdx] = useState<number|null>(null)
  const [editCatVal, setEditCatVal] = useState({ emoji: '', nombre: '' })
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [newCat, setNewCat] = useState({ emoji: '📦', nombre: '' })

  const saveCats = (updated: typeof cats) => {
    setCats(updated)
    localStorage.setItem(CAT_STORAGE_KEY, JSON.stringify(updated))
  }

  const catLabel = (c: {emoji:string,nombre:string}) => `${c.emoji} ${c.nombre}`
  const CATEGORIAS = cats.map(catLabel)

  const load = async () => {
    const [g, i, f] = await Promise.all([
      supabase.from('gastos').select('*').gte('fecha', mes+'-01').lte('fecha', mes+'-31').order('fecha', { ascending: false }),
      supabase.from('otros_ingresos').select('*').gte('fecha', mes+'-01').lte('fecha', mes+'-31').order('fecha', { ascending: false }),
      supabase.from('facturas').select('total, pagado').like('mes', mes+'%'),
    ])
    if (g.data) setGastos(g.data)
    if (i.data) setIngresos(i.data)
    const totalVentas = (f.data || []).reduce((s,x) => s+Number(x.total), 0)
    setVentasMes(totalVentas)
  }

  const loadComparativa = async () => {
    const anio = new Date().getFullYear()
    const datos = await Promise.all(MESES_SHORT.map(async (m, i) => {
      const mesStr = `${anio}-${String(i+1).padStart(2,'0')}`
      const [g, f, ing] = await Promise.all([
        supabase.from('gastos').select('importe').gte('fecha', mesStr+'-01').lte('fecha', mesStr+'-31'),
        supabase.from('facturas').select('total, pagado').like('mes', mesStr+'%'),
        supabase.from('otros_ingresos').select('importe').gte('fecha', mesStr+'-01').lte('fecha', mesStr+'-31'),
      ])
      const gastosMes = (g.data||[]).reduce((s,x) => s+Number(x.importe), 0)
      const ventasMesCmp = (f.data||[]).reduce((s,x) => s+Number(x.total), 0)
      const cobrado = (f.data||[]).filter(x=>x.pagado).reduce((s,x) => s+Number(x.total), 0)
      const otrosIngresos = (ing.data||[]).reduce((s,x) => s+Number(x.importe), 0)
      return {
        mes: m,
        gastos: parseFloat(gastosMes.toFixed(2)),
        ventas: parseFloat(ventasMesCmp.toFixed(2)),
        cobrado: parseFloat(cobrado.toFixed(2)),
        otros_ingresos: parseFloat(otrosIngresos.toFixed(2)),
        beneficio: parseFloat((cobrado + otrosIngresos - gastosMes).toFixed(2)),
      }
    }))
    setComparativa(datos)
  }

  useEffect(() => { load() }, [mes])
  useEffect(() => { if (tab === 'beneficios') loadComparativa() }, [tab])

  const fG = (k:string, v:any) => setFormGasto(prev => ({...prev, [k]: v}))
  const fI = (k:string, v:any) => setFormIngreso(prev => ({...prev, [k]: v}))

  const saveGasto = async () => {
    if (!user || !formGasto.concepto.trim()) return globalToast('El concepto es obligatorio', 'error')
    if (editingGasto) {
      await supabase.from('gastos').update(formGasto).eq('id', editingGasto.id)
      globalToast('Gasto actualizado ✓')
    } else {
      await supabase.from('gastos').insert({...formGasto, user_id: user.id})
      globalToast('Gasto añadido ✓')
    }
    setOpenGasto(false); setEditingGasto(null); setFormGasto(emptyGasto); load()
  }

  const saveIngreso = async () => {
    if (!user || !formIngreso.concepto.trim()) return globalToast('El concepto es obligatorio', 'error')
    if (editingIngreso) {
      await supabase.from('otros_ingresos').update(formIngreso).eq('id', editingIngreso.id)
      globalToast('Ingreso actualizado ✓')
    } else {
      await supabase.from('otros_ingresos').insert({...formIngreso, user_id: user.id})
      globalToast('Ingreso añadido ✓')
    }
    setOpenIngreso(false); setEditingIngreso(null); setFormIngreso(emptyIngreso); load()
  }

  const deleteGasto = async (id:string) => {
    if (!confirm('¿Eliminar este gasto?')) return
    await supabase.from('gastos').delete().eq('id', id)
    globalToast('Gasto eliminado'); load()
  }

  const deleteIngreso = async (id:string) => {
    if (!confirm('¿Eliminar este ingreso?')) return
    await supabase.from('otros_ingresos').delete().eq('id', id)
    globalToast('Ingreso eliminado'); load()
  }

  const totalGastos = gastos.reduce((s,g) => s+Number(g.importe), 0)
  const totalIngresos = ingresos.reduce((s,i) => s+Number(i.importe), 0)
  const totalEntradas = ventasMes + totalIngresos
  const beneficioMes = totalEntradas - totalGastos
  const gastosFiltrados = filterCat === 'todas' ? gastos : gastos.filter(g => g.categoria === filterCat)
  const porCategoria = CATEGORIAS.map(cat => ({
    cat, total: gastos.filter(g => g.categoria === cat).reduce((s,g) => s+Number(g.importe), 0)
  })).filter(x => x.total > 0)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">💸 Gastos y Beneficios</h1>
        <div className="page-actions">
          <input type="month" className="input" style={{width:'auto'}} value={mes} onChange={e => setMes(e.target.value)} />
          {tab === 'gastos' && (
            <button className="btn btn-primary" onClick={() => { setEditingGasto(null); setFormGasto(emptyGasto); setOpenGasto(true) }}>
              <Plus size={16} /> Gasto
            </button>
          )}
          {tab === 'ingresos' && (
            <button className="btn btn-success" onClick={() => { setEditingIngreso(null); setFormIngreso(emptyIngreso); setOpenIngreso(true) }}>
              <Plus size={16} /> Ingreso extra
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginBottom:16}}>
        {[
          { label: '💸 Gastos', value: totalGastos, color: '#dc2626', bg: '#fef2f2' },
          { label: '📈 Ventas ruta', value: ventasMes, color: 'var(--naranja)', bg: '#fff8f0' },
          { label: '🎁 Otros ingresos', value: totalIngresos, color: '#2563eb', bg: '#eff6ff' },
          { label: beneficioMes >= 0 ? '✅ Beneficio' : '❌ Pérdida', value: beneficioMes, color: beneficioMes >= 0 ? '#16a34a' : '#dc2626', bg: beneficioMes >= 0 ? '#f0fdf4' : '#fef2f2' },
        ].map(k => (
          <div key={k.label} className="card" style={{padding:'14px',background:k.bg,textAlign:'center'}}>
            <div style={{fontFamily:'Fredoka One',fontSize:'1.3rem',color:k.color}}>{k.value.toFixed(2)} €</div>
            <div style={{fontSize:'0.72rem',fontWeight:800,color:'var(--gris)',textTransform:'uppercase',marginTop:2}}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div className="tabs">
        <div className={`tab ${tab==='gastos'?'active':''}`} onClick={() => setTab('gastos')}>💸 Gastos</div>
        <div className={`tab ${tab==='ingresos'?'active':''}`} onClick={() => setTab('ingresos')}>🎁 Otros ingresos</div>
        <div className={`tab ${tab==='beneficios'?'active':''}`} onClick={() => setTab('beneficios')}>📈 Evolución</div>
        <div className={`tab ${tab==='categorias'?'active':''}`} onClick={() => setTab('categorias')}>🏷️ Categorías</div>
      </div>

      {/* TAB GASTOS */}
      {tab === 'gastos' && (
        <>
          {porCategoria.length > 0 && (
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16,alignItems:'center'}}>
              <button className={`btn btn-sm ${filterCat==='todas'?'btn-primary':'btn-secondary'}`}
                onClick={() => setFilterCat('todas')}>Todas — {totalGastos.toFixed(2)}€</button>
              {porCategoria.map(x => (
                <button key={x.cat} className={`btn btn-sm ${filterCat===x.cat?'btn-primary':'btn-secondary'}`}
                  onClick={() => setFilterCat(filterCat===x.cat?'todas':x.cat)}>
                  {x.cat} — {x.total.toFixed(2)}€
                </button>
              ))}
            </div>
          )}
          <div className="card" style={{padding:0}}>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Forma pago</th><th>Importe</th><th></th></tr></thead>
                <tbody>
                  {gastosFiltrados.map(g => (
                    <tr key={g.id}>
                      <td style={{fontSize:'0.85rem'}}>{g.fecha}</td>
                      <td>
                        <strong>{g.concepto}</strong>
                        {g.notas && <div style={{fontSize:'0.72rem',color:'var(--gris)'}}>{g.notas}</div>}
                      </td>
                      <td><span className="badge badge-gray">{g.categoria}</span></td>
                      <td style={{fontSize:'0.82rem'}}>{g.forma_pago||'—'}</td>
                      <td><strong style={{color:'#dc2626'}}>{Number(g.importe).toFixed(2)} €</strong></td>
                      <td>
                        <div style={{display:'flex',gap:4}}>
                          <button className="btn btn-secondary btn-sm btn-icon" onClick={() => {
                            setEditingGasto(g)
                            setFormGasto({concepto:g.concepto,categoria:g.categoria,importe:g.importe,fecha:g.fecha,forma_pago:g.forma_pago||'Transferencia',notas:g.notas||''})
                            setOpenGasto(true)
                          }}><Edit2 size={14}/></button>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => deleteGasto(g.id)}><Trash2 size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {gastosFiltrados.length === 0 && (
                    <tr><td colSpan={6}><div className="empty-state"><p>No hay gastos este mes</p></div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB OTROS INGRESOS */}
      {tab === 'ingresos' && (
        <div className="card" style={{padding:0}}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Forma cobro</th><th>Importe</th><th></th></tr></thead>
              <tbody>
                {ingresos.map(i => (
                  <tr key={i.id}>
                    <td style={{fontSize:'0.85rem'}}>{i.fecha}</td>
                    <td>
                      <strong>{i.concepto}</strong>
                      {i.notas && <div style={{fontSize:'0.72rem',color:'var(--gris)'}}>{i.notas}</div>}
                    </td>
                    <td><span className="badge badge-green">{i.categoria}</span></td>
                    <td style={{fontSize:'0.82rem'}}>{i.forma_cobro||'—'}</td>
                    <td><strong style={{color:'#16a34a'}}>{Number(i.importe).toFixed(2)} €</strong></td>
                    <td>
                      <div style={{display:'flex',gap:4}}>
                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => {
                          setEditingIngreso(i)
                          setFormIngreso({concepto:i.concepto,categoria:i.categoria,importe:i.importe,fecha:i.fecha,forma_cobro:i.forma_cobro||'Efectivo',notas:i.notas||''})
                          setOpenIngreso(true)
                        }}><Edit2 size={14}/></button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => deleteIngreso(i.id)}><Trash2 size={14}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {ingresos.length === 0 && (
                  <tr><td colSpan={6}><div className="empty-state"><p>No hay otros ingresos este mes</p><span>Usa este apartado para ventas fuera de ruta, trabajos extra, etc.</span></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB EVOLUCIÓN */}
      {tab === 'beneficios' && (
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div className="card">
            <h3 style={{fontFamily:'Fredoka One',color:'var(--marron)',marginBottom:14}}>📊 Evolución mensual — {new Date().getFullYear()}</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={comparativa}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5e8d8"/>
                <XAxis dataKey="mes" tick={{fontSize:11}}/>
                <YAxis tick={{fontSize:10}}/>
                <Tooltip formatter={(v:any) => `${v} €`}/>
                <Legend/>
                <Bar dataKey="ventas" fill="#E8670A" name="Ventas" radius={[4,4,0,0]}/>
                <Bar dataKey="otros_ingresos" fill="#2563eb" name="Otros ingresos" radius={[4,4,0,0]}/>
                <Bar dataKey="gastos" fill="#dc2626" name="Gastos" radius={[4,4,0,0]}/>
                <Bar dataKey="beneficio" fill="#16a34a" name="Beneficio" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card" style={{padding:0}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid #f5e8d8',fontFamily:'Fredoka One',color:'var(--marron)'}}>Resumen mensual</div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Mes</th><th>Ventas</th><th>Otros ingresos</th><th>Gastos</th><th>Beneficio</th><th>Margen</th></tr></thead>
                <tbody>
                  {comparativa.map((d,i) => (
                    <tr key={i} style={{background:d.mes===MESES_SHORT[new Date().getMonth()]?'#fff8f0':''}}>
                      <td><strong style={{color:d.mes===MESES_SHORT[new Date().getMonth()]?'var(--naranja)':''}}>{d.mes}</strong></td>
                      <td><span style={{color:'var(--naranja)',fontWeight:700}}>{d.ventas.toFixed(2)} €</span></td>
                      <td><span style={{color:'#2563eb',fontWeight:700}}>{d.otros_ingresos.toFixed(2)} €</span></td>
                      <td><span style={{color:'#dc2626',fontWeight:700}}>{d.gastos.toFixed(2)} €</span></td>
                      <td><span style={{color:d.beneficio>=0?'#16a34a':'#dc2626',fontWeight:800}}>{d.beneficio>=0?'+':''}{d.beneficio.toFixed(2)} €</span></td>
                      <td><span style={{color:d.beneficio>=0?'#16a34a':'#dc2626',fontWeight:700,fontSize:'0.85rem'}}>{d.ventas>0?((d.beneficio/d.ventas)*100).toFixed(1):'0'}%</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CATEGORÍAS */}
      {tab === 'categorias' && (
        <div className="card">
          <h3 style={{fontFamily:'Fredoka One',color:'var(--marron)',marginBottom:16}}>🏷️ Gestionar categorías de gastos</h3>
          <p style={{fontSize:'0.85rem',color:'var(--gris)',marginBottom:16}}>Personaliza las categorías con el nombre y emoji que prefieras.</p>
          <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:20}}>
            {cats.map((cat,idx) => (
              <div key={idx} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'#fff8f0',border:'1px solid #f5e8d8',borderRadius:10}}>
                {editCatIdx === idx ? (
                  <>
                    <div style={{position:'relative'}}>
                      <button style={{fontSize:'1.4rem',background:'none',border:'1px solid #f5e8d8',borderRadius:8,padding:'4px 8px',cursor:'pointer'}}
                        onClick={() => setShowEmojiPicker(showEmojiPicker?false:true)}>
                        {editCatVal.emoji}
                      </button>
                      {showEmojiPicker && (
                        <div style={{position:'absolute',top:'100%',left:0,background:'white',border:'1px solid #f5e8d8',borderRadius:10,padding:8,display:'flex',flexWrap:'wrap',gap:4,width:200,zIndex:100,boxShadow:'0 4px 20px rgba(0,0,0,0.1)'}}>
                          {EMOJIS.map(e => (
                            <span key={e} style={{fontSize:'1.3rem',cursor:'pointer',padding:4,borderRadius:6}} onClick={() => { setEditCatVal(v=>({...v,emoji:e})); setShowEmojiPicker(false) }}>{e}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <input className="input" style={{flex:1}} value={editCatVal.nombre}
                      onChange={e => setEditCatVal(v=>({...v,nombre:e.target.value}))} />
                    <button className="btn btn-success btn-sm" onClick={() => {
                      const updated = cats.map((c,i) => i===idx ? editCatVal : c)
                      saveCats(updated); setEditCatIdx(null); setShowEmojiPicker(false)
                      globalToast('Categoría actualizada')
                    }}><Save size={14}/></button>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setEditCatIdx(null); setShowEmojiPicker(false) }}>✕</button>
                  </>
                ) : (
                  <>
                    <span style={{fontSize:'1.4rem'}}>{cat.emoji}</span>
                    <span style={{flex:1,fontWeight:700}}>{cat.nombre}</span>
                    <button className="btn btn-secondary btn-sm btn-icon" onClick={() => { setEditCatIdx(idx); setEditCatVal({emoji:cat.emoji,nombre:cat.nombre}); setShowEmojiPicker(false) }}><Edit2 size={14}/></button>
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => {
                      if (!confirm('¿Eliminar esta categoría?')) return
                      saveCats(cats.filter((_,i)=>i!==idx))
                    }}><Trash2 size={14}/></button>
                  </>
                )}
              </div>
            ))}
          </div>
          <div style={{borderTop:'1px solid #f5e8d8',paddingTop:16}}>
            <h4 style={{fontWeight:800,marginBottom:10,color:'var(--marron)'}}>➕ Añadir nueva categoría</h4>
            <div style={{display:'flex',gap:10,alignItems:'center'}}>
              <div style={{position:'relative'}}>
                <button style={{fontSize:'1.4rem',background:'none',border:'1px solid #f5e8d8',borderRadius:8,padding:'4px 8px',cursor:'pointer'}}
                  onClick={() => setShowEmojiPicker(!showEmojiPicker && editCatIdx===null)}>
                  {newCat.emoji}
                </button>
                {showEmojiPicker && editCatIdx===null && (
                  <div style={{position:'absolute',top:'100%',left:0,background:'white',border:'1px solid #f5e8d8',borderRadius:10,padding:8,display:'flex',flexWrap:'wrap',gap:4,width:200,zIndex:100,boxShadow:'0 4px 20px rgba(0,0,0,0.1)'}}>
                    {EMOJIS.map(e => (
                      <span key={e} style={{fontSize:'1.3rem',cursor:'pointer',padding:4,borderRadius:6}} onClick={() => { setNewCat(v=>({...v,emoji:e})); setShowEmojiPicker(false) }}>{e}</span>
                    ))}
                  </div>
                )}
              </div>
              <input className="input" style={{flex:1}} placeholder="Nombre de la categoría..."
                value={newCat.nombre} onChange={e => setNewCat(v=>({...v,nombre:e.target.value}))} />
              <button className="btn btn-primary" onClick={() => {
                if (!newCat.nombre.trim()) return globalToast('Pon un nombre', 'error')
                saveCats([...cats, {emoji:newCat.emoji,nombre:newCat.nombre}])
                setNewCat({emoji:'📦',nombre:''})
                globalToast('Categoría añadida')
              }}>Añadir</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GASTO */}
      {openGasto && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setOpenGasto(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">{editingGasto?'✏️ Editar Gasto':'➕ Nuevo Gasto'}</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => {setOpenGasto(false);setEditingGasto(null)}}><X size={16}/></button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">Concepto *</label>
                <input className="input" value={formGasto.concepto} onChange={e => fG('concepto',e.target.value)} placeholder="Ej: Gasoil semana 20..."/>
              </div>
              <div className="form-grid-2">
                <div className="input-group">
                  <label className="input-label">Categoría</label>
                  <select className="select" value={formGasto.categoria} onChange={e => fG('categoria',e.target.value)}>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Forma de pago</label>
                  <select className="select" value={formGasto.forma_pago} onChange={e => fG('forma_pago',e.target.value)}>
                    {FORMAS_PAGO.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-grid-2">
                <div className="input-group">
                  <label className="input-label">Importe (€)</label>
                  <input className="input" type="number" step="0.01" value={formGasto.importe} onChange={e => fG('importe',parseFloat(e.target.value)||0)}/>
                </div>
                <div className="input-group">
                  <label className="input-label">Fecha</label>
                  <input className="input" type="date" value={formGasto.fecha} onChange={e => fG('fecha',e.target.value)}/>
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Notas (opcional)</label>
                <input className="input" value={formGasto.notas} onChange={e => fG('notas',e.target.value)} placeholder="Factura nº, referencia..."/>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => {setOpenGasto(false);setEditingGasto(null)}}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveGasto}>{editingGasto?'💾 Guardar':'✅ Añadir'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INGRESO */}
      {openIngreso && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setOpenIngreso(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">{editingIngreso?'✏️ Editar Ingreso':'➕ Nuevo Ingreso extra'}</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => {setOpenIngreso(false);setEditingIngreso(null)}}><X size={16}/></button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">Concepto *</label>
                <input className="input" value={formIngreso.concepto} onChange={e => fI('concepto',e.target.value)} placeholder="Ej: Venta directa panadería, trabajo extra..."/>
              </div>
              <div className="form-grid-2">
                <div className="input-group">
                  <label className="input-label">Categoría</label>
                  <select className="select" value={formIngreso.categoria} onChange={e => fI('categoria',e.target.value)}>
                    {INGRESOS_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Forma de cobro</label>
                  <select className="select" value={formIngreso.forma_cobro} onChange={e => fI('forma_cobro',e.target.value)}>
                    {FORMAS_PAGO.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-grid-2">
                <div className="input-group">
                  <label className="input-label">Importe (€)</label>
                  <input className="input" type="number" step="0.01" value={formIngreso.importe} onChange={e => fI('importe',parseFloat(e.target.value)||0)}/>
                </div>
                <div className="input-group">
                  <label className="input-label">Fecha</label>
                  <input className="input" type="date" value={formIngreso.fecha} onChange={e => fI('fecha',e.target.value)}/>
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Notas (opcional)</label>
                <input className="input" value={formIngreso.notas} onChange={e => fI('notas',e.target.value)} placeholder="Detalles adicionales..."/>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => {setOpenIngreso(false);setEditingIngreso(null)}}>Cancelar</button>
              <button className="btn btn-success" onClick={saveIngreso}>{editingIngreso?'💾 Guardar':'✅ Añadir ingreso'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
