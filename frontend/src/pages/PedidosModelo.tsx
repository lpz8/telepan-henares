import { useEffect, useState } from 'react'
import { Plus, Trash2, X, Save, ChevronDown, ChevronUp, Calendar, AlertTriangle, Edit2, ArrowUp, ArrowDown, Search, Download } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { globalToast } from '../components/Layout'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const DIAS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const ZONA_ORDEN: Record<string, number> = {
  'SAN FERNANDO DE HENARES': 1, 'ALOVERA': 2, 'AZUQUECA DE HENARES': 3,
  'VILLANUEVA DE LA TORRE': 4, 'CHILOECHES': 5, 'LOS HUEROS/VILLALBILLA': 6, 'MADRID': 7,
}

const FRECUENCIAS = [
  { value: 'todos', label: '📅 Todos los días' },
  { value: 'si_no', label: '🔄 Día sí, día no' },
  { value: 'semanas_impares', label: '1️⃣ Semanas impares' },
  { value: 'semanas_pares', label: '2️⃣ Semanas pares' },
]

const FREC_BADGE: Record<string, { label: string; color: string }> = {
  'todos': { label: 'Diario', color: '#16a34a' },
  'si_no': { label: 'Día sí/no', color: '#E8670A' },
  'semanas_impares': { label: 'Sem. impares', color: '#7c3aed' },
  'semanas_pares': { label: 'Sem. pares', color: '#2563eb' },
}

interface LineaForm {
  producto_id: string
  dias: number[]
  cantidad: number
  frecuencia: string
  descuento: number
}

interface LineaEdit extends LineaForm {
  ids: string[]
}

export default function PedidosModelo() {
  const { user } = useAuth()
  const [clientes, setClientes] = useState<any[]>([])
  const [productos, setProductos] = useState<any[]>([])
  const [modelos, setModelos] = useState<any[]>([])
  const [suspensiones, setSuspensiones] = useState<any[]>([])
  const [diaFiltro, setDiaFiltro] = useState<number | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [busqueda, setBusqueda] = useState('')
  const [tabActiva, setTabActiva] = useState<'habituales' | 'resumen'>('habituales')

  // Modal añadir
  const [openAdd, setOpenAdd] = useState(false)
  const [formCliente, setFormCliente] = useState('')
  const [formLineas, setFormLineas] = useState<LineaForm[]>([{ producto_id: '', dias: [], cantidad: 1, frecuencia: 'todos', descuento: 0 }])

  // Modal editar
  const [openEdit, setOpenEdit] = useState(false)
  const [editClienteId, setEditClienteId] = useState('')
  const [editClienteNombre, setEditClienteNombre] = useState('')
  const [editLineas, setEditLineas] = useState<LineaEdit[]>([])

  // Modal suspensión
  const [openSusp, setOpenSusp] = useState(false)
  const [suspCId, setSuspCId] = useState('')
  const [suspCNombre, setSuspCNombre] = useState('')
  const [suspInicio, setSuspInicio] = useState('')
  const [suspFin, setSuspFin] = useState('')
  const [suspMotivo, setSuspMotivo] = useState('Vacaciones')

  // Orden y drag
  const [ordenManual, setOrdenManual] = useState<string[]>([])
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  // Modal duplicar
  const [openDuplicar, setOpenDuplicar] = useState(false)
  const [duplicarDesde, setDuplicarDesde] = useState('')
  const [duplicarHasta, setDuplicarHasta] = useState('')

  const today = new Date().toISOString().split('T')[0]

  const load = async () => {
    const [c, p, m, s] = await Promise.all([
      supabase.from('clientes').select('*').order('orden_ruta').order('codigo'),
      supabase.from('productos').select('*').order('nombre'),
      supabase.from('pedidos_modelo').select('*, clientes(nombre,codigo,poblacion,orden_ruta), productos(nombre,precio_sin_iva)'),
      supabase.from('suspensiones_pedido').select('*').gte('fecha_fin', today),
    ])
    if (c.data) setClientes(c.data)
    if (p.data) setProductos(p.data)
    if (m.data) setModelos(m.data)
    if (s.data) setSuspensiones(s.data)
  }
  useEffect(() => { load() }, [])

  const getSusp = (cId: string) => suspensiones.find(s => s.cliente_id === cId && s.fecha_inicio <= today && s.fecha_fin >= today)

  const byCliente = clientes.reduce((acc: Record<string, any>, c) => {
    const cms = modelos.filter(m => m.cliente_id === c.id)
    const filtered = diaFiltro !== null ? cms.filter(m => m.dia_semana === diaFiltro) : cms
    if (filtered.length > 0) acc[c.id] = { cliente: c, items: filtered }
    return acc
  }, {})

  const allClientIds = Object.keys(byCliente)

  const sorted = (() => {
    let entries: [string, any][]
    if (ordenManual.length > 0) {
      const ordered = ordenManual.filter(id => allClientIds.includes(id))
      const rest = allClientIds.filter(id => !ordered.includes(id))
      entries = [...ordered, ...rest].map(id => [id, byCliente[id]] as [string, any])
    } else {
      entries = Object.entries(byCliente).sort(([, a]: any, [, b]: any) => {
        const za = ZONA_ORDEN[a.cliente.poblacion] || 99
        const zb = ZONA_ORDEN[b.cliente.poblacion] || 99
        if (za !== zb) return za - zb
        return (a.cliente.orden_ruta || 999) - (b.cliente.orden_ruta || 999)
      })
    }
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      entries = entries.filter(([, { cliente }]) =>
        cliente.nombre?.toLowerCase().includes(q) ||
        String(cliente.codigo)?.includes(q) ||
        cliente.poblacion?.toLowerCase().includes(q)
      )
    }
    return entries
  })()

  const moveUp = (idx: number) => {
    if (idx === 0) return
    const ids = sorted.map(([id]) => id)
    const newIds = [...ids]; [newIds[idx-1], newIds[idx]] = [newIds[idx], newIds[idx-1]]
    setOrdenManual(newIds)
  }

  const moveDown = (idx: number) => {
    if (idx === sorted.length - 1) return
    const ids = sorted.map(([id]) => id)
    const newIds = [...ids]; [newIds[idx], newIds[idx+1]] = [newIds[idx+1], newIds[idx]]
    setOrdenManual(newIds)
  }

  const ordenarPorRuta = () => {
    const ids = Object.entries(byCliente)
      .sort(([, a]: any, [, b]: any) => (a.cliente.orden_ruta || 999) - (b.cliente.orden_ruta || 999))
      .map(([id]) => id)
    setOrdenManual(ids)
    globalToast('✅ Ordenado por ruta — pulsa "Guardar orden" para confirmar')
  }

  const saveOrden = async () => {
    if (ordenManual.length === 0) return
    try {
      for (let i = 0; i < ordenManual.length; i++) {
        await supabase.from('clientes').update({ orden_ruta: i + 1 }).eq('id', ordenManual[i])
      }
      globalToast('✅ Orden de ruta guardado')
      setOrdenManual([])
      load()
    } catch (err: any) { globalToast(err.message, 'error') }
  }

  const handleDragStart = (idx: number) => setDragIndex(idx)
  const handleDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOver(idx) }
  const handleDrop = (idx: number) => {
    if (dragIndex === null || dragIndex === idx) { setDragIndex(null); setDragOver(null); return }
    const ids = sorted.map(([id]) => id)
    const newIds = [...ids]
    const [moved] = newIds.splice(dragIndex, 1)
    newIds.splice(idx, 0, moved)
    setOrdenManual(newIds)
    setDragIndex(null); setDragOver(null)
  }

  // Resumen artículos — CASA* y PISTOLA* agrupados
  const resumenArticulos = (() => {
    const totales: Record<string, { nombre: string; cantidad: number; esAgrupado?: boolean }> = {}
    modelos.forEach(m => {
      const prod = productos.find(p => p.id === m.producto_id)
      const nombre: string = prod?.nombre || 'Desconocido'
      const cantidad = Number(m.cantidad)
      const up = nombre.toUpperCase().trim()
      if (up.startsWith('CASA')) {
        if (!totales['__CASA__']) totales['__CASA__'] = { nombre: 'BARRA CASA (todas)', cantidad: 0, esAgrupado: true }
        totales['__CASA__'].cantidad += cantidad
      } else if (up.startsWith('PISTOLA')) {
        if (!totales['__PISTOLA__']) totales['__PISTOLA__'] = { nombre: 'BARRA PISTOLA (todas)', cantidad: 0, esAgrupado: true }
        totales['__PISTOLA__'].cantidad += cantidad
      } else {
        const key = up
        if (!totales[key]) totales[key] = { nombre, cantidad: 0 }
        totales[key].cantidad += cantidad
      }
    })
    return Object.values(totales).sort((a, b) => b.cantidad - a.cantidad)
  })()
  const totalResumen = resumenArticulos.reduce((s, a) => s + a.cantidad, 0)

  const agruparLineas = (items: any[]): LineaEdit[] => {
    const byKey: Record<string, LineaEdit> = {}
    items.forEach((m: any) => {
      const key = `${m.producto_id}_${m.frecuencia || 'todos'}_${m.cantidad}_${m.descuento || 0}`
      if (!byKey[key]) byKey[key] = { producto_id: m.producto_id, dias: [], cantidad: m.cantidad, frecuencia: m.frecuencia || 'todos', descuento: m.descuento || 0, ids: [] }
      byKey[key].dias.push(m.dia_semana)
      byKey[key].ids.push(m.id)
    })
    return Object.values(byKey)
  }

  const abrirEdicion = (cId: string, cNombre: string, items: any[]) => {
    setEditClienteId(cId); setEditClienteNombre(cNombre)
    setEditLineas(agruparLineas(items)); setOpenEdit(true)
  }

  const guardarEdicion = async () => {
    if (!user || !editClienteId) return
    try {
      await supabase.from('pedidos_modelo').delete().eq('cliente_id', editClienteId).eq('user_id', user.id)
      const validas = editLineas.filter(l => l.producto_id && l.dias.length > 0 && l.cantidad > 0)
      if (validas.length > 0) {
        const inserts: any[] = []
        validas.forEach(l => l.dias.forEach(dia => inserts.push({
          user_id: user.id, cliente_id: editClienteId, producto_id: l.producto_id,
          dia_semana: dia, cantidad: l.cantidad, frecuencia: l.frecuencia || 'todos', descuento: l.descuento || 0
        })))
        await supabase.from('pedidos_modelo').insert(inserts)
      }
      globalToast(`✅ Habituales de ${editClienteNombre} actualizados`)
      setOpenEdit(false); load()
    } catch (err: any) { globalToast(err.message, 'error') }
  }

  const editLineaField = (i: number, campo: string, val: any) =>
    setEditLineas(prev => prev.map((l, j) => j === i ? { ...l, [campo]: val } : l))

  const toggleDiaEdit = (lineaIdx: number, dia: number) => {
    setEditLineas(prev => prev.map((l, i) => {
      if (i !== lineaIdx) return l
      const dias = l.dias.includes(dia) ? l.dias.filter(d => d !== dia) : [...l.dias, dia]
      return { ...l, dias }
    }))
  }

  const selectAllDias = (lineaIdx: number, all: boolean) =>
    setEditLineas(prev => prev.map((l, i) => i !== lineaIdx ? l : { ...l, dias: all ? [0,1,2,3,4,5,6] : [] }))

  const toggleDiaAdd = (lineaIdx: number, dia: number) => {
    setFormLineas(prev => prev.map((l, i) => {
      if (i !== lineaIdx) return l
      const dias = l.dias.includes(dia) ? l.dias.filter(d => d !== dia) : [...l.dias, dia]
      return { ...l, dias }
    }))
  }

  const selectAllDiasAdd = (lineaIdx: number, all: boolean) =>
    setFormLineas(prev => prev.map((l, i) => i !== lineaIdx ? l : { ...l, dias: all ? [0,1,2,3,4,5,6] : [] }))

  const handleAdd = async () => {
    if (!user || !formCliente) return globalToast('Selecciona un cliente', 'error')
    const validas = formLineas.filter(l => l.producto_id && l.dias.length > 0 && l.cantidad > 0)
    if (!validas.length) return globalToast('Añade al menos un producto con días', 'error')
    const existentes = modelos.filter(m => m.cliente_id === formCliente)
    if (existentes.length > 0) {
      const clienteNombre = clientes.find(c => c.id === formCliente)?.nombre || ''
      const resp = confirm(`⚠️ ${clienteNombre} ya tiene ${existentes.length} pedido(s) habitual(es).\n\n- Aceptar = SUSTITUIR los existentes\n- Cancelar = No hacer nada`)
      if (!resp) return
      await supabase.from('pedidos_modelo').delete().eq('cliente_id', formCliente).eq('user_id', user.id)
    }
    const inserts: any[] = []
    validas.forEach(l => l.dias.forEach(dia => inserts.push({
      user_id: user.id, cliente_id: formCliente, producto_id: l.producto_id,
      dia_semana: dia, cantidad: l.cantidad, frecuencia: l.frecuencia || 'todos', descuento: l.descuento || 0
    })))
    try {
      await supabase.from('pedidos_modelo').insert(inserts)
      globalToast(`✅ ${inserts.length} habituales guardados`)
      setOpenAdd(false); setFormCliente('')
      setFormLineas([{ producto_id: '', dias: [], cantidad: 1, frecuencia: 'todos', descuento: 0 }])
      load()
    } catch (err: any) { globalToast(err.message, 'error') }
  }

  const deleteAll = async (cId: string, nombre: string) => {
    if (!confirm(`¿Eliminar TODOS los habituales de ${nombre}?`)) return
    await supabase.from('pedidos_modelo').delete().eq('cliente_id', cId)
    globalToast(`✅ Habituales de ${nombre} eliminados`); load()
  }

  const handleSusp = async () => {
    if (!user || !suspCId || !suspInicio || !suspFin) return globalToast('Rellena todos los campos', 'error')
    if (suspFin < suspInicio) return globalToast('La fecha fin debe ser posterior', 'error')
    await supabase.from('suspensiones_pedido').insert({ user_id: user.id, cliente_id: suspCId, fecha_inicio: suspInicio, fecha_fin: suspFin, motivo: suspMotivo })
    globalToast('✅ Suspensión guardada'); setOpenSusp(false); setSuspCId(''); setSuspInicio(''); setSuspFin(''); load()
  }

  const deleteSusp = async (cId: string) => {
    await supabase.from('suspensiones_pedido').delete().eq('cliente_id', cId).gte('fecha_fin', today)
    globalToast('✅ Pedidos reanudados'); load()
  }

  const handleDuplicar = async () => {
    if (!user || !duplicarDesde || !duplicarHasta) return globalToast('Selecciona los dos clientes', 'error')
    if (duplicarDesde === duplicarHasta) return globalToast('Los clientes deben ser distintos', 'error')
    const { data: orig } = await supabase.from('pedidos_modelo').select('*').eq('cliente_id', duplicarDesde).eq('user_id', user.id)
    if (!orig || orig.length === 0) return globalToast('El cliente origen no tiene habituales', 'error')
    const inserts = orig.map(m => ({
      user_id: user.id, cliente_id: duplicarHasta, producto_id: m.producto_id,
      dia_semana: m.dia_semana, cantidad: m.cantidad, frecuencia: m.frecuencia || 'todos', descuento: m.descuento || 0
    }))
    await supabase.from('pedidos_modelo').delete().eq('cliente_id', duplicarHasta).eq('user_id', user.id)
    await supabase.from('pedidos_modelo').insert(inserts)
    globalToast(`✅ ${inserts.length} habituales copiados`)
    setOpenDuplicar(false); setDuplicarDesde(''); setDuplicarHasta(''); load()
  }

  const exportarHabituales = async () => {
    const { data } = await supabase.from('pedidos_modelo')
      .select('*, clientes(nombre,codigo,poblacion), productos(nombre,precio_sin_iva)')
    if (!data) return globalToast('Error al exportar', 'error')
    const backup = { fecha: new Date().toISOString(), pedidos_habituales: data }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `habituales-telepan-${today}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    globalToast('✅ Habituales exportados')
  }

  const importarHabituales = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (!confirm('⚠️ Esto REEMPLAZARÁ todos los habituales actuales. ¿Continuar?')) return
    try {
      const backup = JSON.parse(await file.text())
      const datos = backup.pedidos_habituales || backup
      if (!Array.isArray(datos)) throw new Error('Formato no válido')
      await supabase.from('pedidos_modelo').delete().eq('user_id', user.id)
      const inserts = datos.map((m: any) => ({
        user_id: user.id, cliente_id: m.cliente_id, producto_id: m.producto_id,
        dia_semana: m.dia_semana, cantidad: m.cantidad, frecuencia: m.frecuencia || 'todos', descuento: m.descuento || 0
      }))
      await supabase.from('pedidos_modelo').insert(inserts)
      globalToast(`✅ ${inserts.length} habituales importados`)
      load()
    } catch (err: any) { globalToast('Error: ' + err.message, 'error') }
    e.target.value = ''
  }

  const renderLinea = (
    linea: LineaForm | LineaEdit, i: number,
    onChange: (i: number, k: string, v: any) => void,
    onToggle: (i: number, d: number) => void,
    onSelectAll: (i: number, all: boolean) => void,
    onRemove: (i: number) => void,
    total: number
  ) => (
    <div key={i} style={{ background: 'var(--crema)', borderRadius: 10, padding: '12px', marginBottom: 10, border: '1px solid #f5e8d8' }}>
      <div className="form-grid-2" style={{ marginBottom: 8 }}>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label className="input-label">Producto</label>
          <select className="select" value={linea.producto_id} onChange={e => onChange(i, 'producto_id', e.target.value)}>
            <option value="">Seleccionar...</option>
            {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} — {Number(p.precio_sin_iva).toFixed(2)}€</option>)}
          </select>
        </div>
        <div className="form-grid-2" style={{ marginBottom: 0 }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Cantidad</label>
            <input className="input" type="number" min={1} step={1} value={linea.cantidad}
              onChange={e => onChange(i, 'cantidad', Math.max(1, Math.round(parseFloat(e.target.value) || 1)))} />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Descuento %</label>
            <input className="input" type="number" min={0} max={100} step={1} value={linea.descuento}
              onChange={e => onChange(i, 'descuento', Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
              placeholder="0" />
          </div>
        </div>
      </div>
      {linea.descuento > 0 && linea.producto_id && (() => {
        const prod = productos.find(p => p.id === linea.producto_id)
        const precioBase = Number(prod?.precio_sin_iva || 0)
        const precioDto = precioBase * (1 - linea.descuento / 100)
        return (
          <div style={{ background: '#f0fdf4', borderRadius: 6, padding: '4px 10px', marginBottom: 8, fontSize: '0.78rem', color: '#16a34a', fontWeight: 700 }}>
            💰 Precio con {linea.descuento}% dto: {precioDto.toFixed(2)}€ (antes {precioBase.toFixed(2)}€)
          </div>
        )
      })()}
      <div className="input-group" style={{ marginBottom: 8 }}>
        <label className="input-label">Frecuencia</label>
        <select className="select" value={linea.frecuencia} onChange={e => onChange(i, 'frecuencia', e.target.value)}>
          {FRECUENCIAS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <label className="input-label" style={{ margin: 0 }}>Días de reparto</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={() => onSelectAll(i, true)}
            style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 6, border: '1px solid #e0c9b0', background: 'white', cursor: 'pointer', fontWeight: 700, color: '#16a34a' }}>
            ✓ Todos
          </button>
          <button type="button" onClick={() => onSelectAll(i, false)}
            style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 6, border: '1px solid #e0c9b0', background: 'white', cursor: 'pointer', fontWeight: 700, color: '#dc2626' }}>
            ✗ Ninguno
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {DIAS.map((d, di) => (
          <button key={di} type="button" onClick={() => onToggle(i, di)}
            style={{ padding: '5px 9px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', border: 'none',
              background: linea.dias.includes(di) ? 'var(--naranja)' : '#e5d8cc',
              color: linea.dias.includes(di) ? 'white' : 'var(--gris)', transition: 'all 0.15s' }}>
            {d}
          </button>
        ))}
      </div>
      {total > 1 && (
        <button className="btn btn-danger btn-sm" style={{ marginTop: 8 }} onClick={() => onRemove(i)}>
          <Trash2 size={12} /> Eliminar línea
        </button>
      )}
    </div>
  )

  return (
    <div>
      {/* ══ CABECERA ══ */}
      <div className="page-header">
        <h1 className="page-title">📋 Pedidos Habituales
          <span style={{ fontSize: '0.85rem', color: 'var(--gris)', fontFamily: 'Nunito', fontWeight: 700, marginLeft: 8 }}>
            {sorted.length} clientes
          </span>
        </h1>
        <div className="page-actions">
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <button className={`btn btn-sm ${diaFiltro === null ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDiaFiltro(null)}>Todos</button>
            {DIAS_SHORT.map((d, i) => (
              <button key={i} className={`btn btn-sm ${diaFiltro === i ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDiaFiltro(i)}>{d}</button>
            ))}
          </div>
          {ordenManual.length > 0 && (
            <button className="btn btn-success btn-sm" onClick={saveOrden}><Save size={14} /> Guardar orden</button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={ordenarPorRuta}>🗺️ Ordenar por ruta</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setOpenDuplicar(true)}>📋 Duplicar</button>
          <button className="btn btn-secondary btn-sm" onClick={exportarHabituales}><Download size={14} /> Backup</button>
          <button className="btn btn-primary" onClick={() => setOpenAdd(true)}><Plus size={16} /> Añadir</button>
        </div>
      </div>

      {/* ══ BUSCADOR ══ */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gris)' }} />
          <input className="input" placeholder="Buscar cliente..." value={busqueda}
            onChange={e => setBusqueda(e.target.value)} style={{ paddingLeft: 34 }} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.82rem', color: 'var(--gris)' }}>
          <input type="file" accept=".json" style={{ display: 'none' }} onChange={importarHabituales} />
          <span style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e0c9b0', background: 'white', fontWeight: 700 }}>📂 Importar backup</span>
        </label>
      </div>

      {/* ══ TABS ══ */}
      <div className="tabs-mobile-select">
        <select value={tabActiva} onChange={e => setTabActiva(e.target.value as any)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '2px solid var(--naranja)', fontFamily: 'Nunito', fontWeight: 800, fontSize: '0.95rem', color: 'var(--marron)', background: '#fff8f0', marginBottom: 12 }}>
          <option value="habituales">📋 Habituales ({sorted.length} clientes)</option>
          <option value="resumen">📦 Resumen artículos ({totalResumen} ud)</option>
        </select>
      </div>
      <div className="tabs-desktop">
        <div className={`tab ${tabActiva === 'habituales' ? 'active' : ''}`} onClick={() => setTabActiva('habituales')}>
          📋 Habituales ({sorted.length} clientes)
        </div>
        <div className={`tab ${tabActiva === 'resumen' ? 'active' : ''}`} onClick={() => setTabActiva('resumen')}>
          📦 Resumen artículos ({totalResumen} ud)
        </div>
      </div>

      {/* ══ TAB: RESUMEN ARTÍCULOS ══ */}
      {tabActiva === 'resumen' && (
        <div>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: '0.82rem', color: '#1e40af' }}>
            💡 <strong>CASA*</strong> y <strong>PISTOLA*</strong> agrupadas en una sola línea — son la misma barra aunque tengan distintos precios.
          </div>
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f5e8d8', fontFamily: 'Fredoka One', color: 'var(--marron)' }}>
              📦 Total artículos en pedidos habituales
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Artículo</th>
                    <th style={{ textAlign: 'center' }}>Unidades/día</th>
                    <th style={{ textAlign: 'center' }}>% del total</th>
                  </tr>
                </thead>
                <tbody>
                  {resumenArticulos.map((a, i) => (
                    <tr key={i} style={{ background: a.esAgrupado ? '#fff8f0' : '' }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {a.esAgrupado && (
                            <span style={{ background: 'var(--naranja)', color: 'white', borderRadius: 5, padding: '1px 6px', fontSize: '0.65rem', fontWeight: 800 }}>
                              AGRUPADO
                            </span>
                          )}
                          <strong style={{ color: a.esAgrupado ? 'var(--naranja)' : 'var(--marron)' }}>{a.nombre}</strong>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontFamily: 'Fredoka One', fontSize: '1.4rem', color: a.esAgrupado ? 'var(--naranja)' : '#2563eb' }}>
                          {a.cantidad}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                          <div style={{ width: 80, height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${totalResumen > 0 ? (a.cantidad / totalResumen * 100) : 0}%`, height: '100%', background: a.esAgrupado ? '#E8670A' : '#2563eb', borderRadius: 4 }} />
                          </div>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--gris)' }}>
                            {totalResumen > 0 ? (a.cantidad / totalResumen * 100).toFixed(1) : 0}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {resumenArticulos.length === 0 && (
                    <tr><td colSpan={3}>
                      <div className="empty-state"><p>No hay habituales configurados</p></div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB: HABITUALES ══ */}
      {tabActiva === 'habituales' && (
        <div>
          {ordenManual.length > 0 && (
            <div style={{ background: '#fff3e8', border: '1px solid #f5e8d8', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: '0.85rem', color: 'var(--marron)', fontWeight: 700 }}>
              🔀 Modo reordenación activo. Arrastra o usa ↑↓ y pulsa "Guardar orden".
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sorted.map(([clienteId, { cliente, items }]: any, idx) => {
              const isOpen = expanded.has(clienteId)
              const susp = getSusp(clienteId)
              const lineas = agruparLineas(items)

              return (
                <div key={clienteId} className="card"
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={e => handleDragOver(e, idx)}
                  onDrop={() => handleDrop(idx)}
                  style={{
                    padding: 0, overflow: 'hidden',
                    border: dragOver === idx ? '2px solid var(--naranja)' : susp ? '2px solid #f59e0b' : '1px solid #f5e8d8',
                    opacity: dragIndex === idx ? 0.5 : 1,
                    cursor: 'grab', transition: 'all 0.15s'
                  }}>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer', background: susp ? '#fffbeb' : isOpen ? 'var(--crema-dark)' : 'white' }}
                    onClick={() => setExpanded(prev => { const n = new Set(prev); n.has(clienteId) ? n.delete(clienteId) : n.add(clienteId); return n })}>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => moveUp(idx)} disabled={idx === 0}
                        style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'not-allowed' : 'pointer', padding: '1px 4px', color: idx === 0 ? '#ddd' : 'var(--naranja)', lineHeight: 1 }}>
                        <ArrowUp size={14} />
                      </button>
                      <button onClick={() => moveDown(idx)} disabled={idx === sorted.length - 1}
                        style={{ background: 'none', border: 'none', cursor: idx === sorted.length - 1 ? 'not-allowed' : 'pointer', padding: '1px 4px', color: idx === sorted.length - 1 ? '#ddd' : 'var(--naranja)', lineHeight: 1 }}>
                        <ArrowDown size={14} />
                      </button>
                    </div>

                    <div style={{ width: 28, height: 28, borderRadius: 7, background: susp ? '#f59e0b' : 'var(--naranja)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fredoka One', fontSize: '0.85rem', flexShrink: 0 }}>
                      {susp ? '⏸' : cliente.orden_ruta || idx + 1}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'Fredoka One', color: 'var(--naranja)', fontSize: '0.82rem' }}>#{cliente.codigo}</span>
                        <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.88rem' }}>{cliente.nombre}</strong>
                        {susp && <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 5, padding: '1px 6px', fontSize: '0.68rem', fontWeight: 800, flexShrink: 0 }}>⏸ hasta {susp.fecha_fin}</span>}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--gris)' }}>{cliente.poblacion} · {lineas.length} producto{lineas.length !== 1 ? 's' : ''}</div>
                    </div>

                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      {DIAS_SHORT.map((d, i) => {
                        const activo = items.some((m: any) => m.dia_semana === i)
                        return <span key={i} style={{ width: 20, height: 20, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 800, background: activo ? (susp ? '#f59e0b' : 'var(--naranja)') : '#f3f4f6', color: activo ? 'white' : '#ccc' }}>{d[0]}</span>
                      })}
                    </div>
                    <span style={{ color: 'var(--gris)' }}>{isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
                  </div>

                  {isOpen && (
                    <div>
                      <div style={{ padding: '8px 12px', display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: '1px solid #f5e8d8', borderBottom: '1px solid #f5e8d8', background: '#fafafa' }}>
                        <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); abrirEdicion(clienteId, cliente.nombre, items) }}>
                          <Edit2 size={12} /> Editar
                        </button>
                        {susp ? (
                          <button className="btn btn-success btn-sm" onClick={() => deleteSusp(clienteId)}>✅ Reanudar</button>
                        ) : (
                          <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); setSuspCId(clienteId); setSuspCNombre(cliente.nombre); setOpenSusp(true) }}>
                            <Calendar size={12} /> Suspender
                          </button>
                        )}
                        <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); deleteAll(clienteId, cliente.nombre) }}>
                          <Trash2 size={12} /> Borrar todos
                        </button>
                      </div>
                      <table style={{ width: '100%' }}>
                        <thead><tr><th>Producto</th><th>Cant.</th><th>Descuento</th><th>Días</th><th>Frecuencia</th><th>€</th></tr></thead>
                        <tbody>
                          {lineas.map((l, pi) => {
                            const badge = FREC_BADGE[l.frecuencia] || FREC_BADGE['todos']
                            const prod = productos.find(p => p.id === l.producto_id)
                            const precioFinal = prod ? Number(prod.precio_sin_iva) * (1 - (l.descuento || 0) / 100) : 0
                            return (
                              <tr key={pi}>
                                <td><strong>{prod?.nombre || '—'}</strong></td>
                                <td>{l.cantidad}</td>
                                <td>{l.descuento > 0 ? <span style={{ color: '#16a34a', fontWeight: 800 }}>-{l.descuento}%</span> : '—'}</td>
                                <td><div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>{l.dias.sort((a,b)=>a-b).map(d => <span key={d} style={{ background: 'var(--naranja)', color: 'white', borderRadius: 4, padding: '1px 5px', fontSize: '0.68rem', fontWeight: 800 }}>{DIAS_SHORT[d]}</span>)}</div></td>
                                <td><span style={{ background: badge.color + '20', color: badge.color, borderRadius: 5, padding: '2px 6px', fontSize: '0.68rem', fontWeight: 800 }}>{badge.label}</span></td>
                                <td style={{ fontSize: '0.82rem' }}>{prod ? `${precioFinal.toFixed(2)}€` : '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
            {sorted.length === 0 && (
              <div className="card">
                <div className="empty-state">
                  <span style={{ fontSize: 36 }}>📋</span>
                  <p>{busqueda ? `Sin resultados para "${busqueda}"` : 'No hay pedidos habituales'}</p>
                  <span>{!busqueda && 'Pulsa "Añadir" para configurar'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ MODAL EDITAR ══ */}
      {openEdit && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setOpenEdit(false)}>
          <div className="modal" style={{ maxWidth: 660 }}>
            <div className="modal-header">
              <h3 className="modal-title">✏️ Editar — {editClienteNombre}</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setOpenEdit(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {editLineas.map((linea, i) => renderLinea(
                linea, i, editLineaField, toggleDiaEdit, selectAllDias,
                (idx) => setEditLineas(prev => prev.filter((_, j) => j !== idx)),
                editLineas.length
              ))}
              <button className="btn btn-secondary btn-sm" onClick={() => setEditLineas(prev => [...prev, { producto_id: '', dias: [], cantidad: 1, frecuencia: 'todos', descuento: 0, ids: [] }])}>
                <Plus size={13} /> Añadir producto
              </button>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setOpenEdit(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarEdicion}><Save size={15} /> Guardar cambios</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL AÑADIR ══ */}
      {openAdd && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setOpenAdd(false)}>
          <div className="modal" style={{ maxWidth: 660 }}>
            <div className="modal-header">
              <h3 className="modal-title">➕ Añadir Pedidos Habituales</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setOpenAdd(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">Cliente</label>
                <select className="select" value={formCliente} onChange={e => setFormCliente(e.target.value)}>
                  <option value="">Seleccionar cliente...</option>
                  {clientes.map(c => {
                    const tieneHabituales = modelos.some(m => m.cliente_id === c.id)
                    return <option key={c.id} value={c.id}>#{c.codigo} — {c.nombre}{tieneHabituales ? ' ⚠️ ya tiene habituales' : ''}</option>
                  })}
                </select>
              </div>
              {formCliente && modelos.some(m => m.cliente_id === formCliente) && (
                <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: '0.82rem', color: '#92400e', fontWeight: 700 }}>
                  ⚠️ Este cliente ya tiene pedidos habituales. Al guardar los SUSTITUIRÁ.
                </div>
              )}
              <div style={{ borderTop: '1px solid #f5e8d8', paddingTop: 12, marginTop: 4 }}>
                <label className="input-label" style={{ marginBottom: 10, display: 'block' }}>Productos y días</label>
                {formLineas.map((linea, i) => renderLinea(
                  linea, i,
                  (idx, k, v) => setFormLineas(prev => prev.map((l, j) => j === idx ? { ...l, [k]: v } : l)),
                  toggleDiaAdd, selectAllDiasAdd,
                  (idx) => setFormLineas(prev => prev.filter((_, j) => j !== idx)),
                  formLineas.length
                ))}
                <button className="btn btn-secondary btn-sm" onClick={() => setFormLineas(prev => [...prev, { producto_id: '', dias: [], cantidad: 1, frecuencia: 'todos', descuento: 0 }])}>
                  <Plus size={13} /> Añadir producto
                </button>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setOpenAdd(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleAdd}><Save size={15} /> Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL DUPLICAR ══ */}
      {openDuplicar && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setOpenDuplicar(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3 className="modal-title">📋 Duplicar Pedidos Habituales</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setOpenDuplicar(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: '0.82rem', color: '#166534' }}>
                💡 Copia los habituales de un cliente a otro. Los del destino serán reemplazados.
              </div>
              <div className="input-group">
                <label className="input-label">Cliente ORIGEN (copiar desde)</label>
                <select className="select" value={duplicarDesde} onChange={e => setDuplicarDesde(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>#{c.codigo} — {c.nombre}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Cliente DESTINO (copiar hacia)</label>
                <select className="select" value={duplicarHasta} onChange={e => setDuplicarHasta(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {clientes.filter(c => c.id !== duplicarDesde).map(c => <option key={c.id} value={c.id}>#{c.codigo} — {c.nombre}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setOpenDuplicar(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleDuplicar}>📋 Duplicar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL SUSPENSIÓN ══ */}
      {openSusp && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setOpenSusp(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3 className="modal-title">⏸ Suspensión Vacacional</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setOpenSusp(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: '0.875rem', color: '#92400e' }}>
                <AlertTriangle size={14} style={{ display: 'inline', marginRight: 6 }} />
                <strong>{suspCNombre}</strong> — Sin pedidos durante el periodo indicado.
              </div>
              <div className="input-group">
                <label className="input-label">Motivo</label>
                <select className="select" value={suspMotivo} onChange={e => setSuspMotivo(e.target.value)}>
                  <option value="Vacaciones">🏖 Vacaciones</option>
                  <option value="Enfermedad">🏥 Enfermedad</option>
                  <option value="Viaje">✈️ Viaje</option>
                  <option value="Cierre temporal">🔒 Cierre temporal</option>
                  <option value="Otro">📝 Otro</option>
                </select>
              </div>
              <div className="form-grid-2">
                <div className="input-group">
                  <label className="input-label">Fecha inicio</label>
                  <input className="input" type="date" value={suspInicio} onChange={e => setSuspInicio(e.target.value)} min={today} />
                </div>
                <div className="input-group">
                  <label className="input-label">Fecha fin</label>
                  <input className="input" type="date" value={suspFin} onChange={e => setSuspFin(e.target.value)} min={suspInicio || today} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setOpenSusp(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSusp}><Calendar size={15} /> Guardar suspensión</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}