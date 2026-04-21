import { useEffect, useState } from 'react'
import { Plus, Trash2, X, TrendingUp, TrendingDown, Edit2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { globalToast } from '../components/Layout'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const CATEGORIAS = ['General', 'Proveedor', 'Materias Primas', 'Personal', 'Transporte', 'Suministros', 'Alquiler', 'Seguros', 'Otros']
const CAT_BADGE: Record<string, string> = {
  'Proveedor': 'badge-orange', 'Materias Primas': 'badge-orange', 'Personal': 'badge-blue',
  'Transporte': 'badge-green', 'Suministros': 'badge-yellow', 'Alquiler': 'badge-purple',
  'Seguros': 'badge-red', 'Otros': 'badge-gray'
}
const empty = { concepto: '', categoria: 'General', importe: 0, fecha: new Date().toISOString().split('T')[0] }
const MESES_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export default function Gastos() {
  const { user } = useAuth()
  const [gastos, setGastos] = useState<any[]>([])
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7))
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState(empty)
  const [tab, setTab] = useState<'gastos' | 'beneficios'>('gastos')
  const [ventasMes, setVentasMes] = useState(0)
  const [comparativa, setComparativa] = useState<any[]>([])

  const load = async () => {
    const { data } = await supabase.from('gastos').select('*')
      .gte('fecha', mes + '-01').lte('fecha', mes + '-31')
      .order('fecha', { ascending: false })
    if (data) setGastos(data)

    // Cargar ventas del mes para calcular beneficio
    const { data: facturas } = await supabase.from('facturas').select('total, pagado')
      .like('mes', mes + '%')
    const totalVentas = (facturas || []).reduce((s, f) => s + Number(f.total), 0)
    setVentasMes(totalVentas)
  }

  const loadComparativa = async () => {
    const anio = new Date().getFullYear()
    const datos = await Promise.all(
      MESES_SHORT.map(async (m, i) => {
        const mesStr = `${anio}-${String(i + 1).padStart(2, '0')}`
        const [g, f] = await Promise.all([
          supabase.from('gastos').select('importe').gte('fecha', mesStr + '-01').lte('fecha', mesStr + '-31'),
          supabase.from('facturas').select('total, pagado').like('mes', mesStr + '%'),
        ])
        const gastosMes = (g.data || []).reduce((s, x) => s + Number(x.importe), 0)
        const ventasMesCmp = (f.data || []).reduce((s, x) => s + Number(x.total), 0)
        const cobrado = (f.data || []).filter(x => x.pagado).reduce((s, x) => s + Number(x.total), 0)
        return {
          mes: m,
          gastos: parseFloat(gastosMes.toFixed(2)),
          ventas: parseFloat(ventasMesCmp.toFixed(2)),
          cobrado: parseFloat(cobrado.toFixed(2)),
          beneficio: parseFloat((cobrado - gastosMes).toFixed(2)),
        }
      })
    )
    setComparativa(datos)
  }

  useEffect(() => { load() }, [mes])
  useEffect(() => { if (tab === 'beneficios') loadComparativa() }, [tab])

  const f = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const handleSave = async () => {
    if (!user || !form.concepto.trim()) return globalToast('El concepto es obligatorio', 'error')
    if (editing) {
      await supabase.from('gastos').update(form).eq('id', editing.id)
      globalToast('Gasto actualizado ✓')
    } else {
      await supabase.from('gastos').insert({ ...form, user_id: user.id })
      globalToast('Gasto añadido ✓')
    }
    setOpen(false); setEditing(null); setForm(empty); load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este gasto?')) return
    await supabase.from('gastos').delete().eq('id', id)
    globalToast('Gasto eliminado'); load()
  }

  const total = gastos.reduce((s, g) => s + Number(g.importe), 0)
  const beneficioMes = ventasMes - total
  const porCategoria = CATEGORIAS.map(cat => ({
    cat, total: gastos.filter(g => g.categoria === cat).reduce((s, g) => s + Number(g.importe), 0)
  })).filter(x => x.total > 0)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">💸 Gastos y Beneficios</h1>
        <div className="page-actions">
          <input type="month" className="input" style={{ width: 'auto' }} value={mes} onChange={e => setMes(e.target.value)} />
          <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(empty); setOpen(true) }}>
            <Plus size={16} /> Añadir
          </button>
        </div>
      </div>

      {/* RESUMEN MES */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 12, marginBottom: 16 }}>
        <div className="card" style={{ padding: '14px', background: '#fef2f2', textAlign: 'center' }}>
          <TrendingDown size={20} color="#dc2626" style={{ margin: '0 auto 4px' }} />
          <div style={{ fontFamily: 'Fredoka One', fontSize: '1.4rem', color: '#dc2626' }}>{total.toFixed(2)} €</div>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--gris)', textTransform: 'uppercase' }}>💸 Gastos del mes</div>
        </div>
        <div className="card" style={{ padding: '14px', background: '#fff8f0', textAlign: 'center' }}>
          <TrendingUp size={20} color="var(--naranja)" style={{ margin: '0 auto 4px' }} />
          <div style={{ fontFamily: 'Fredoka One', fontSize: '1.4rem', color: 'var(--naranja)' }}>{ventasMes.toFixed(2)} €</div>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--gris)', textTransform: 'uppercase' }}>📈 Ventas del mes</div>
        </div>
        <div className="card" style={{ padding: '14px', background: beneficioMes >= 0 ? '#f0fdf4' : '#fef2f2', textAlign: 'center' }}>
          {beneficioMes >= 0
            ? <TrendingUp size={20} color="#16a34a" style={{ margin: '0 auto 4px' }} />
            : <TrendingDown size={20} color="#dc2626" style={{ margin: '0 auto 4px' }} />
          }
          <div style={{ fontFamily: 'Fredoka One', fontSize: '1.4rem', color: beneficioMes >= 0 ? '#16a34a' : '#dc2626' }}>
            {beneficioMes >= 0 ? '+' : ''}{beneficioMes.toFixed(2)} €
          </div>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--gris)', textTransform: 'uppercase' }}>💰 Beneficio neto</div>
        </div>
        <div className="card" style={{ padding: '14px', background: '#eff6ff', textAlign: 'center' }}>
          <div style={{ fontFamily: 'Fredoka One', fontSize: '1.4rem', color: '#2563eb' }}>
            {ventasMes > 0 ? ((beneficioMes / ventasMes) * 100).toFixed(1) : '0'}%
          </div>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--gris)', textTransform: 'uppercase' }}>📊 Margen</div>
        </div>
      </div>

      {/* TABS */}
      <div className="tabs">
        <div className={`tab ${tab === 'gastos' ? 'active' : ''}`} onClick={() => setTab('gastos')}>💸 Gastos del mes</div>
        <div className={`tab ${tab === 'beneficios' ? 'active' : ''}`} onClick={() => setTab('beneficios')}>📈 Gastos vs Beneficios</div>
      </div>

      {/* TAB GASTOS */}
      {tab === 'gastos' && (
        <>
          {porCategoria.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {porCategoria.map(x => (
                <div key={x.cat} className="card" style={{ padding: '8px 14px', flex: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.75rem', color: 'var(--gris)', textTransform: 'uppercase' }}>{x.cat}</div>
                  <div style={{ fontFamily: 'Fredoka One', color: '#dc2626' }}>{x.total.toFixed(2)} €</div>
                </div>
              ))}
            </div>
          )}

          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Importe</th><th></th></tr></thead>
                <tbody>
                  {gastos.map(g => (
                    <tr key={g.id}>
                      <td>{g.fecha}</td>
                      <td><strong>{g.concepto}</strong></td>
                      <td><span className={`badge ${CAT_BADGE[g.categoria] || 'badge-gray'}`}>{g.categoria}</span></td>
                      <td><strong style={{ color: '#dc2626' }}>{Number(g.importe).toFixed(2)} €</strong></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-secondary btn-sm btn-icon" onClick={() => {
                            setEditing(g)
                            setForm({ concepto: g.concepto, categoria: g.categoria, importe: g.importe, fecha: g.fecha })
                            setOpen(true)
                          }}><Edit2 size={14} /></button>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(g.id)}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {gastos.length === 0 && (
                    <tr><td colSpan={5}>
                      <div className="empty-state">
                        <p>No hay gastos este mes</p>
                        <span>Los gastos registrados desde IA Facturas aparecen aquí automáticamente</span>
                      </div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB BENEFICIOS */}
      {tab === 'beneficios' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <h3 style={{ fontFamily: 'Fredoka One', color: 'var(--marron)', marginBottom: 14 }}>
              📊 Ventas vs Gastos vs Beneficio — {new Date().getFullYear()}
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={comparativa}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5e8d8" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: any) => `${v} €`} />
                <Legend />
                <Bar dataKey="ventas" fill="#E8670A" name="Ventas" radius={[4,4,0,0]} />
                <Bar dataKey="gastos" fill="#dc2626" name="Gastos" radius={[4,4,0,0]} />
                <Bar dataKey="beneficio" fill="#16a34a" name="Beneficio" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f5e8d8', fontFamily: 'Fredoka One', color: 'var(--marron)' }}>
              Resumen mensual
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Mes</th><th>Ventas</th><th>Gastos</th><th>Cobrado</th><th>Beneficio</th><th>Margen</th></tr>
                </thead>
                <tbody>
                  {comparativa.map((d, i) => (
                    <tr key={i} style={{ background: d.mes === MESES_SHORT[new Date().getMonth()] ? '#fff8f0' : '' }}>
                      <td><strong style={{ color: d.mes === MESES_SHORT[new Date().getMonth()] ? 'var(--naranja)' : '' }}>{d.mes}</strong></td>
                      <td><span style={{ color: 'var(--naranja)', fontWeight: 700 }}>{d.ventas.toFixed(2)} €</span></td>
                      <td><span style={{ color: '#dc2626', fontWeight: 700 }}>{d.gastos.toFixed(2)} €</span></td>
                      <td><span style={{ color: '#16a34a', fontWeight: 700 }}>{d.cobrado.toFixed(2)} €</span></td>
                      <td>
                        <span style={{ color: d.beneficio >= 0 ? '#16a34a' : '#dc2626', fontWeight: 800 }}>
                          {d.beneficio >= 0 ? '+' : ''}{d.beneficio.toFixed(2)} €
                        </span>
                      </td>
                      <td>
                        <span style={{ color: d.beneficio >= 0 ? '#16a34a' : '#dc2626', fontWeight: 700, fontSize: '0.85rem' }}>
                          {d.ventas > 0 ? ((d.beneficio / d.ventas) * 100).toFixed(1) : '0'}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL */}
      {open && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">{editing ? '✏️ Editar Gasto' : '➕ Nuevo Gasto'}</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => { setOpen(false); setEditing(null) }}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">Concepto *</label>
                <input className="input" value={form.concepto} onChange={e => f('concepto', e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Categoría</label>
                <select className="select" value={form.categoria} onChange={e => f('categoria', e.target.value)}>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-grid-2">
                <div className="input-group">
                  <label className="input-label">Importe (€)</label>
                  <input className="input" type="number" step="0.01" value={form.importe} onChange={e => f('importe', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="input-group">
                  <label className="input-label">Fecha</label>
                  <input className="input" type="date" value={form.fecha} onChange={e => f('fecha', e.target.value)} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setOpen(false); setEditing(null) }}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave}>{editing ? '💾 Guardar' : '✅ Añadir gasto'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}