import { useEffect, useState } from 'react'
import { Save, Download, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { globalToast } from '../components/Layout'

const empty = {
  nombre_empresa: 'TELEPAN HENARES S.G.L.',
  nie: 'Z1806715R',
  titular: 'Yeny Rubi Ruiz Carvajal',
  direccion: 'Calle Valdecanillas 59 3A',
  cp: '28037',
  ciudad: 'Madrid',
  telefono: '633958532',
  bizum: '622334126',
  iban: 'ES9420858284100330219325',
  num_inicio_facturas: 1,
  email: 'telepansgl@gmail.com',
}

const FESTIVOS_FIJOS = [
  { fecha: '25/12', nombre: 'Navidad' },
  { fecha: '01/01', nombre: 'Año Nuevo' },
]

export default function Configuracion() {
  const { user } = useAuth()
  const [form, setForm] = useState(empty)
  const [configId, setConfigId] = useState<string | null>(null)
  const [tab, setTab] = useState<'empresa' | 'vacaciones'>('empresa')
  const [diasNoReparto, setDiasNoReparto] = useState<{fecha: string, motivo: string}[]>([])
  const [nuevaFecha, setNuevaFecha] = useState('')
  const [nuevoMotivo, setNuevoMotivo] = useState('')

  useEffect(() => {
    supabase.from('configuracion').select('*').single().then(({ data }) => {
      if (data) {
        setConfigId(data.id)
        setForm({
          nombre_empresa: data.nombre_empresa || empty.nombre_empresa,
          nie: data.nie || empty.nie,
          titular: data.titular || empty.titular,
          direccion: data.direccion || empty.direccion,
          cp: data.cp || empty.cp,
          ciudad: data.ciudad || empty.ciudad,
          telefono: data.telefono || empty.telefono,
          bizum: data.bizum || empty.bizum,
          iban: data.iban || empty.iban,
          num_inicio_facturas: data.num_inicio_facturas || 1,
          email: data.email || empty.email,
        })
        if (data.dias_no_reparto) {
          try { setDiasNoReparto(JSON.parse(data.dias_no_reparto)) } catch { }
        }
      }
    })
  }, [])

  const f = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const handleSave = async () => {
    if (!user) return
    try {
      const dataToSave = { ...form, dias_no_reparto: JSON.stringify(diasNoReparto) }
      if (configId) {
        await supabase.from('configuracion').update(dataToSave).eq('id', configId)
      } else {
        const { data } = await supabase.from('configuracion').insert({ ...dataToSave, user_id: user.id }).select().single()
        if (data) setConfigId(data.id)
      }
      globalToast('Configuración guardada ✓')
    } catch (err: any) { globalToast(err.message, 'error') }
  }

  const añadirDia = () => {
    if (!nuevaFecha) return globalToast('Selecciona una fecha', 'error')
    if (diasNoReparto.find(d => d.fecha === nuevaFecha)) return globalToast('Esa fecha ya está añadida', 'error')
    setDiasNoReparto(prev => [...prev, { fecha: nuevaFecha, motivo: nuevoMotivo || 'Sin reparto' }])
    setNuevaFecha(''); setNuevoMotivo('')
  }

  const eliminarDia = (fecha: string) => setDiasNoReparto(prev => prev.filter(d => d.fecha !== fecha))

  const exportBackup = async () => {
    const [c, p, pm, g, pr, cfg] = await Promise.all([
      supabase.from('clientes').select('*'),
      supabase.from('productos').select('*'),
      supabase.from('pedidos_modelo').select('*'),
      supabase.from('gastos').select('*'),
      supabase.from('proveedores').select('*'),
      supabase.from('configuracion').select('*'),
    ])
    const backup = { fecha: new Date().toISOString(), clientes: c.data, productos: p.data, pedidos_modelo: pm.data, gastos: g.data, proveedores: pr.data, configuracion: cfg.data }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `backup-telepan-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    globalToast('Backup descargado ✓')
  }

  const hoy = new Date().toISOString().split('T')[0]
  const diasOrdenados = [...diasNoReparto].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const proximosSinReparto = diasOrdenados.filter(d => d.fecha >= hoy)

  return (
    <div style={{ maxWidth: 700 }}>
      <div className="page-header">
        <h1 className="page-title">⚙️ Configuración</h1>
        <button className="btn btn-secondary" onClick={exportBackup}>
          <Download size={16} /> Backup JSON
        </button>
      </div>

      <div className="tabs">
        <div className={`tab ${tab === 'empresa' ? 'active' : ''}`} onClick={() => setTab('empresa')}>🏢 Empresa</div>
        <div className={`tab ${tab === 'vacaciones' ? 'active' : ''}`} onClick={() => setTab('vacaciones')}>
          📅 Días sin reparto
          {proximosSinReparto.length > 0 && (
            <span style={{ background: '#E8670A', color: 'white', borderRadius: 10, padding: '1px 7px', fontSize: '0.72rem', marginLeft: 6 }}>
              {proximosSinReparto.length}
            </span>
          )}
        </div>
      </div>

      {tab === 'empresa' && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontFamily: 'Fredoka One', color: 'var(--marron)', marginBottom: 16 }}>🏢 Datos de la Empresa</h3>
            <div className="input-group">
              <label className="input-label">Nombre empresa</label>
              <input className="input" value={form.nombre_empresa} onChange={e => f('nombre_empresa', e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Titular / Autónomo</label>
              <input className="input" value={form.titular} onChange={e => f('titular', e.target.value)} />
            </div>
            <div className="form-grid-2">
              <div className="input-group">
                <label className="input-label">NIE / CIF</label>
                <input className="input" value={form.nie} onChange={e => f('nie', e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Teléfono</label>
                <input className="input" value={form.telefono} onChange={e => f('telefono', e.target.value)} />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Dirección</label>
              <input className="input" value={form.direccion} onChange={e => f('direccion', e.target.value)} />
            </div>
            <div className="form-grid-2">
              <div className="input-group">
                <label className="input-label">Código Postal</label>
                <input className="input" value={form.cp} onChange={e => f('cp', e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Ciudad</label>
                <input className="input" value={form.ciudad} onChange={e => f('ciudad', e.target.value)} />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Email</label>
              <input className="input" type="email" value={form.email} onChange={e => f('email', e.target.value)} />
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontFamily: 'Fredoka One', color: 'var(--marron)', marginBottom: 16 }}>💳 Datos de Pago</h3>
            <div className="form-grid-2">
              <div className="input-group">
                <label className="input-label">Bizum</label>
                <input className="input" value={form.bizum} onChange={e => f('bizum', e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Nº inicio facturas</label>
                <input className="input" type="number" value={form.num_inicio_facturas} onChange={e => f('num_inicio_facturas', parseInt(e.target.value) || 1)} />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">IBAN</label>
              <input className="input" value={form.iban} onChange={e => f('iban', e.target.value)} />
            </div>
            <div style={{ background: 'var(--crema)', borderRadius: 10, padding: '12px 16px', fontSize: '0.85rem', color: 'var(--gris)' }}>
              <strong style={{ color: 'var(--marron)' }}>💡 Estos datos aparecerán en todas las facturas y albaranes</strong>
            </div>
          </div>

          <button className="btn btn-primary" onClick={handleSave} style={{ width: '100%', justifyContent: 'center', padding: 12 }}>
            <Save size={16} /> Guardar configuración
          </button>
        </>
      )}

      {tab === 'vacaciones' && (
        <>
          <div className="card" style={{ marginBottom: 16, background: '#fff8f0', border: '1.5px solid #f5e8d8' }}>
            <h3 style={{ fontFamily: 'Fredoka One', color: 'var(--marron)', marginBottom: 12 }}>🎄 Festivos fijos (todos los años)</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--gris)', marginBottom: 12 }}>
              Estos días nunca hay reparto. Se aplican automáticamente cada año.
            </p>
            {FESTIVOS_FIJOS.map((fest, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'white', borderRadius: 8, marginBottom: 6 }}>
                <span style={{ fontSize: '1.1rem' }}>🔒</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800 }}>{fest.nombre}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--gris)' }}>Cada año el {fest.fecha}</div>
                </div>
                <span className="badge badge-orange">Fijo</span>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontFamily: 'Fredoka One', color: 'var(--marron)', marginBottom: 12 }}>➕ Añadir día sin reparto</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--gris)', marginBottom: 12 }}>
              Vacaciones, festivos locales, incidencias...
            </p>
            <div className="form-grid-2">
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Fecha</label>
                <input className="input" type="date" value={nuevaFecha} min={hoy} onChange={e => setNuevaFecha(e.target.value)} />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Motivo (opcional)</label>
                <input className="input" value={nuevoMotivo} placeholder="Ej: Vacaciones, Festivo local..." onChange={e => setNuevoMotivo(e.target.value)} />
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={añadirDia} style={{ marginTop: 10 }}>
              <Plus size={14} /> Añadir fecha
            </button>
          </div>

          <div className="card" style={{ marginBottom: 16, padding: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f5e8d8', fontFamily: 'Fredoka One', color: 'var(--marron)', display: 'flex', justifyContent: 'space-between' }}>
              <span>📋 Días sin reparto programados</span>
              <span style={{ fontSize: '0.82rem', color: 'var(--gris)', fontFamily: 'Nunito' }}>{diasOrdenados.length} días</span>
            </div>
            {diasOrdenados.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px' }}>
                <p>No hay días sin reparto programados</p>
                <span>Añade fechas de vacaciones o festivos arriba</span>
              </div>
            ) : (
              diasOrdenados.map((d, i) => {
                const esPasado = d.fecha < hoy
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid #faf5ef', opacity: esPasado ? 0.5 : 1 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: esPasado ? '#f3f4f6' : '#fff3e8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                      {esPasado ? '✓' : '📅'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: '0.875rem' }}>
                        {new Date(d.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--gris)' }}>{d.motivo}</div>
                    </div>
                    {esPasado
                      ? <span className="badge badge-gray">Pasado</span>
                      : <span className="badge badge-orange">Próximo</span>
                    }
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => eliminarDia(d.fecha)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                )
              })
            )}
          </div>

          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', fontSize: '0.82rem', color: '#1e40af', marginBottom: 16 }}>
            💡 <strong>Cómo funciona:</strong> Los días marcados aparecen como aviso en el Dashboard. Al generar pedidos del mes, estos días quedan excluidos automáticamente.
          </div>

          <button className="btn btn-primary" onClick={handleSave} style={{ width: '100%', justifyContent: 'center', padding: 12 }}>
            <Save size={16} /> Guardar días sin reparto
          </button>
        </>
      )}
    </div>
  )
}