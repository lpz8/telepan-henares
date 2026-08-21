import { useEffect, useState } from 'react'
import { Zap, Plus, Trash2, X, ChevronDown, ChevronUp, PauseCircle, Edit2, ArrowUpDown } from 'lucide-react'
import SearchableSelect from '../components/SearchableSelect'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { globalToast } from '../components/Layout'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function getWeekNumber(dateStr: string): number {
  const d = new Date(dateStr + 'T12:00:00')
  const jan1 = new Date(d.getFullYear(), 0, 1)
  return Math.ceil((((d.getTime() - jan1.getTime()) / 86400000) + jan1.getDay() + 1) / 7)
}

function shouldInclude(frecuencia: string, fecha: string, fechaInicioAlternos?: string): boolean {
  if (!frecuencia || frecuencia === 'todos') return true
  const week = getWeekNumber(fecha)
  if (frecuencia === 'semanas_impares') return week % 2 === 1
  if (frecuencia === 'semanas_pares') return week % 2 === 0
  if (frecuencia === 'si_no') {
    // Día sí, día no — basado en la fecha de inicio real del habitual
    // Si hay fecha de inicio: contar días desde esa fecha
    // Si no: usar día del año como referencia
    if (fechaInicioAlternos) {
      const ref = new Date(fechaInicioAlternos + 'T12:00:00')
      const hoy = new Date(fecha + 'T12:00:00')
      const diffDias = Math.round((hoy.getTime() - ref.getTime()) / 86400000)
      return diffDias % 2 === 0  // día 0, 2, 4... = toca
    } else {
      // Sin fecha de referencia: usar número de día del año
      const d = new Date(fecha + 'T12:00:00')
      const jan1 = new Date(d.getFullYear(), 0, 1)
      const dayOfYear = Math.ceil((d.getTime() - jan1.getTime()) / 86400000)
      return dayOfYear % 2 === 0
    }
  }
  return true
}

const ORDEN_CATS = ['Pan', 'Bollería', 'Pastelería', 'Huevos', 'Otros']
const CAT_EMOJI: Record<string, string> = {
  'Pan': '🍞', 'Bollería': '🥐', 'Pastelería': '🎂', 'Huevos': '🥚', 'Otros': '📦'
}

export default function Pedidos() {
  const { user } = useAuth()
  const today = new Date().toISOString().split('T')[0]
  const [fecha, setFechaState] = useState(() => localStorage.getItem('telepan_fecha_pedidos') || today)

  const setFecha = (f: string) => {
    setFechaState(f)
    localStorage.setItem('telepan_fecha_pedidos', f)
  }
  const [pedidos, setPedidos] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [productos, setProductos] = useState<any[]>([])
  const [modelos, setModelos] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [openManual, setOpenManual] = useState(false)
  const [formManual, setFormManual] = useState({ cliente_id: '', producto_id: '', cantidad: 1, precio: 0, iva: 4 })
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set())
  const [suspendidos, setSuspendidos] = useState<any[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [tabActiva, setTabActiva] = useState<string>('pedidos')
  const [ordenPorRuta, setOrdenPorRuta] = useState(true)
  const [openSuspModal, setOpenSuspModal] = useState(false)
  const [editSusp, setEditSusp] = useState<any>(null)
  const [resumenDetalle, setResumenDetalle] = useState<{ nombre: string; clientes: { nombre: string; codigo: string; cantidad: number; total: number }[] } | null>(null)
  const [editCliente, setEditCliente] = useState<{
    id: string; nombre: string; lineas: any[]
    _productoAdd?: string; _cantidadAdd?: number
  } | null>(null)

  const load = async () => {
    const { data: ped } = await supabase
      .from('pedidos')
      .select('*, clientes(nombre, codigo, orden_ruta, poblacion), productos(nombre, iva, categoria)')
      .eq('fecha', fecha).order('created_at')
    setPedidos(ped || [])

    const { data: susps } = await supabase
      .from('suspensiones_pedido').select('*, clientes(nombre, codigo)')
      .lte('fecha_inicio', fecha).gte('fecha_fin', fecha)
    setSuspendidos(susps || [])

    const dayOfWeek = new Date(fecha + 'T12:00:00').getDay()
    const { data: mods } = await supabase
      .from('pedidos_modelo').select('*, productos(nombre, precio_sin_iva, iva)')
      .eq('dia_semana', dayOfWeek)
    setModelos(mods || [])
  }

  useEffect(() => { load() }, [fecha])
  useEffect(() => {
    supabase.from('clientes').select('id, nombre, codigo, orden_ruta, poblacion').order('orden_ruta').then(r => { if (r.data) setClientes(r.data) })
    supabase.from('productos').select('id, nombre, precio_sin_iva, iva, categoria').order('nombre').then(r => { if (r.data) setProductos(r.data) })
  }, [])

  const generarMesCompleto = async () => {
    if (!user) return
    const anio = parseInt(fecha.split('-')[0])
    const mes = parseInt(fecha.split('-')[1])
    const diasEnMes = new Date(anio, mes, 0).getDate()
    const primerDia = `${fecha.substring(0,7)}-01`
    const ultimoDia = `${fecha.substring(0,7)}-${String(diasEnMes).padStart(2,'0')}`

    if (!confirm(`¿Generar pedidos para TODO ${new Date(fecha+'T12:00:00').toLocaleString('es-ES',{month:'long',year:'numeric'})}?\n\nSe generarán los ${diasEnMes} días respetando:\n✅ Días habituales de cada cliente\n✅ Frecuencias (semanas pares/impares)\n✅ Suspensiones activas\n\nSe eliminarán los pedidos existentes del mes.`)) return

    setLoading(true)
    globalToast('⏳ Generando pedidos del mes...')

    try {
      // Eliminar pedidos existentes del mes
      await supabase.from('pedidos').delete()
        .gte('fecha', primerDia).lte('fecha', ultimoDia).eq('user_id', user.id)

      // Obtener suspensiones del mes
      const { data: susps } = await supabase.from('suspensiones_pedido')
        .select('cliente_id, fecha_inicio, fecha_fin')
      const suspList = susps || []

      // Obtener todos los habituales
      const { data: mods } = await supabase.from('pedidos_modelo')
        .select('*, productos(precio_sin_iva, iva)')
        .eq('user_id', user.id)

      if (!mods || mods.length === 0) {
        globalToast('No hay habituales configurados', 'error')
        setLoading(false); return
      }

      let totalInserts = 0

      // Recorrer cada día del mes
      for (let dia = 1; dia <= diasEnMes; dia++) {
        const fechaDia = `${fecha.substring(0,7)}-${String(dia).padStart(2,'0')}`
        const dayOfWeek = new Date(fechaDia + 'T12:00:00').getDay()

        // Habituales de ese día de la semana
        const modsDia = mods.filter(m => m.dia_semana === dayOfWeek && m.cantidad > 0)
        if (modsDia.length === 0) continue

        // Clientes suspendidos ese día
        const clientesSusp = new Set(
          suspList
            .filter(s => s.fecha_inicio <= fechaDia && s.fecha_fin >= fechaDia)
            .map(s => s.cliente_id)
        )

        const inserts = modsDia
          .filter(m => !clientesSusp.has(m.cliente_id))
          .filter(m => shouldInclude(m.frecuencia, fechaDia, m.fecha_inicio_alternos))
          .map(m => ({
            user_id: user.id, fecha: fechaDia,
            cliente_id: m.cliente_id, producto_id: m.producto_id,
            cantidad: m.cantidad,
            precio: Number(m.productos?.precio_sin_iva || 0),
            iva: Number(m.productos?.iva || 4)
          }))

        if (inserts.length > 0) {
          await supabase.from('pedidos').insert(inserts)
          totalInserts += inserts.length
        }
      }

      globalToast(`✅ Mes generado — ${totalInserts} líneas de pedido en ${diasEnMes} días`)
      load()
    } catch (err: any) {
      globalToast('Error: ' + err.message, 'error')
    }
    setLoading(false)
  }

  const generarPedidos = async () => {
    if (!user) return
    const dayOfWeek = new Date(fecha + 'T12:00:00').getDay()
    const diaName = DIAS[dayOfWeek]
    const { count } = await supabase.from('pedidos').select('id', { count: 'exact', head: true }).eq('fecha', fecha).eq('user_id', user.id)
    if (count && count > 0) {
      if (!confirm(`Ya hay ${count} pedidos para el ${fecha}.\n¿Reemplazarlos con los habituales de ${diaName}?`)) return
    }
    setLoading(true)
    try {
      const { data: mods } = await supabase.from('pedidos_modelo')
        .select('*, productos(precio_sin_iva, iva), clientes(orden_ruta, codigo)')
        .eq('dia_semana', dayOfWeek).eq('user_id', user.id)
      if (!mods || mods.length === 0) {
        globalToast(`Sin habituales para ${diaName}. Configúralos en "Habituales"`, 'info')
        setLoading(false); return
      }
      await supabase.from('pedidos').delete().eq('fecha', fecha).eq('user_id', user.id)
      const { data: susps } = await supabase.from('suspensiones_pedido').select('cliente_id').lte('fecha_inicio', fecha).gte('fecha_fin', fecha)
      const clientesSusp = new Set((susps || []).map((s: any) => s.cliente_id))
      const inserts = mods.filter(m => m.cantidad > 0).filter(m => !clientesSusp.has(m.cliente_id)).filter(m => shouldInclude(m.frecuencia, fecha, m.fecha_inicio_alternos))
        .map(m => ({ user_id: user.id, fecha, cliente_id: m.cliente_id, producto_id: m.producto_id, cantidad: m.cantidad, precio: Number(m.productos?.precio_sin_iva || 0), iva: Number(m.productos?.iva || 4) }))
      if (inserts.length > 0) await supabase.from('pedidos').insert(inserts)
      const omitidos = new Set(mods.filter(m => clientesSusp.has(m.cliente_id)).map(m => m.cliente_id)).size
      globalToast(`✅ ${inserts.length} pedidos generados${omitidos > 0 ? ` · ${omitidos} suspendidos omitidos` : ''}`)
      load()
    } catch (err: any) { globalToast(err.message, 'error') }
    setLoading(false)
  }

  const handleAddManual = async () => {
    if (!user || !formManual.cliente_id || !formManual.producto_id) return globalToast('Selecciona cliente y producto', 'error')
    const { error } = await supabase.from('pedidos').insert({ ...formManual, fecha, user_id: user.id })
    if (error) return globalToast('Error: ' + error.message, 'error')
    globalToast('Pedido añadido ✓')
    setOpenManual(false); setFormManual({ cliente_id: '', producto_id: '', cantidad: 1, precio: 0, iva: 4 }); load()
  }

  const handleDelete = async (id: string) => { await supabase.from('pedidos').delete().eq('id', id); load() }

  const grouped = pedidos.reduce((acc: Record<string, any>, p) => {
    const id = p.cliente_id
    if (!acc[id]) acc[id] = { cliente: p.clientes, items: [] }
    acc[id].items.push(p); return acc
  }, {})

  const getSusp = (cId: string) => suspendidos.find(s => s.cliente_id === cId)

  const sortedGroups = Object.entries(grouped)
    .sort(([, a]: any, [, b]: any) => ordenPorRuta
      ? (a.cliente?.orden_ruta || 999) - (b.cliente?.orden_ruta || 999)
      : parseInt(a.cliente?.codigo || '9999') - parseInt(b.cliente?.codigo || '9999'))
    .filter(([, { cliente }]: any) => {
      if (!busqueda.trim()) return true
      const q = busqueda.toLowerCase()
      return cliente?.nombre?.toLowerCase().includes(q) || String(cliente?.codigo)?.includes(q) || cliente?.poblacion?.toLowerCase().includes(q)
    })

  const totalUnidades = pedidos.reduce((s, p) => s + Number(p.cantidad), 0)
  const totalEuros = pedidos.reduce((s, p) => s + Number(p.cantidad) * Number(p.precio) * (1 + Number(p.iva) / 100), 0)

  // Cambios del día vs habituales
  const cambiosDelDia = (() => {
    const cambios: { tipo: string; clienteNombre: string; clienteId: string; descripcion: string }[] = []
    Object.entries(grouped).forEach(([cId, { cliente, items }]: any) => {
      const tieneHabitual = modelos.some(m => m.cliente_id === cId)
      if (!tieneHabitual) {
        cambios.push({ tipo: 'manual', clienteNombre: cliente?.nombre, clienteId: cId, descripcion: `Pedido manual: ${items.map((i: any) => `${i.productos?.nombre} x${i.cantidad}`).join(', ')}` })
        return
      }
      const habs = modelos.filter(m => m.cliente_id === cId)
      items.forEach((item: any) => {
        const hab = habs.find(h => h.producto_id === item.producto_id)
        if (!hab) cambios.push({ tipo: 'añadido', clienteNombre: cliente?.nombre, clienteId: cId, descripcion: `➕ ${item.productos?.nombre}: ${item.cantidad} ud (añadido)` })
        else if (Number(item.cantidad) !== Number(hab.cantidad)) cambios.push({ tipo: 'modificado', clienteNombre: cliente?.nombre, clienteId: cId, descripcion: `✏️ ${item.productos?.nombre}: ${hab.cantidad} → ${item.cantidad} ud` })
      })
      habs.forEach(h => {
        if (!items.find((i: any) => i.producto_id === h.producto_id))
          cambios.push({ tipo: 'eliminado', clienteNombre: cliente?.nombre, clienteId: cId, descripcion: `🗑️ ${h.productos?.nombre}: eliminado hoy` })
      })
    })
    return cambios
  })()

  const resumenArticulos = (() => {
    const totales: Record<string, { nombre: string; cantidad: number; esAgrupado?: boolean; grupo?: string }> = {}
    pedidos.forEach(p => {
      const nombre: string = p.productos?.nombre || 'Desconocido'
      const cantidad = Number(p.cantidad); const up = nombre.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
      if (up.includes('PICO')) {
        if (!totales['__PICOS__']) totales['__PICOS__'] = { nombre: 'PICOS (todos)', cantidad: 0, esAgrupado: true, grupo: 'picos' }
        totales['__PICOS__'].cantidad += cantidad
      } else if (up.includes('CASA') || up.includes('PISTOLA')) {
        if (!totales['__BARRA__']) totales['__BARRA__'] = { nombre: 'BARRAS — CASA + PISTOLA', cantidad: 0, esAgrupado: true, grupo: 'barra' }
        totales['__BARRA__'].cantidad += cantidad
      } else if (up.includes('ARTESANA')) {
        if (!totales['__ARTESANA__']) totales['__ARTESANA__'] = { nombre: 'ARTESANA (todas)', cantidad: 0, esAgrupado: true, grupo: 'artesana' }
        totales['__ARTESANA__'].cantidad += cantidad
      } else { if (!totales[up]) totales[up] = { nombre, cantidad: 0 }; totales[up].cantidad += cantidad }
    })
    return Object.values(totales).sort((a, b) => b.cantidad - a.cantidad)
  })()
  const totalResumen = resumenArticulos.reduce((s, a) => s + a.cantidad, 0)
  const categoriasDelDia = ORDEN_CATS.filter(cat => pedidos.some(p => (p.productos?.categoria || 'Pan') === cat))
  const resumenPorCategoria = (cat: string) => {
    const pedsCat = pedidos.filter(p => (p.productos?.categoria || 'Pan') === cat)
    const totales: Record<string, { nombre: string; cantidad: number; esAgrupado?: boolean; grupo?: string }> = {}
    pedsCat.forEach(p => {
      const nombre: string = p.productos?.nombre || 'Desconocido'; const cantidad = Number(p.cantidad); const up = nombre.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
      if (up.includes('PICO')) {
        if (!totales['__PICOS__']) totales['__PICOS__'] = { nombre: 'PICOS (todos)', cantidad: 0, esAgrupado: true, grupo: 'picos' }
        totales['__PICOS__'].cantidad += cantidad
      } else if (cat === 'Pan' && (up.includes('CASA') || up.includes('PISTOLA'))) {
        if (!totales['__BARRA__']) totales['__BARRA__'] = { nombre: 'BARRAS — CASA + PISTOLA', cantidad: 0, esAgrupado: true, grupo: 'barra' }
        totales['__BARRA__'].cantidad += cantidad
      } else if (cat === 'Pan' && up.includes('ARTESANA')) {
        if (!totales['__ARTESANA__']) totales['__ARTESANA__'] = { nombre: 'ARTESANA (todas)', cantidad: 0, esAgrupado: true, grupo: 'artesana' }
        totales['__ARTESANA__'].cantidad += cantidad
      } else { if (!totales[up]) totales[up] = { nombre, cantidad: 0 }; totales[up].cantidad += cantidad }
    })
    return Object.values(totales).sort((a, b) => b.cantidad - a.cantidad)
  }

  const buildTablaHTML = (arts: any[], total: number, titulo: string) => {
    const rows = arts.map((a, i) => `<tr style="background:${i%2===0?'white':'#fffaf6'}">
      <td><strong>${a.nombre}</strong>${a.esAgrupado ? `<br><small style="color:#888">${a.subNombres?.join(' / ')|| ''}</small>` : ''}</td>
      <td style="text-align:center;font-weight:800;color:#2563eb">${a.cantidad} ud</td>
      <td style="text-align:center;color:#888;font-size:0.85rem">${total > 0 ? (a.cantidad / total * 100).toFixed(1) : 0}%</td>
    </tr>`).join('')
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>${titulo} - ${fecha}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:28px 36px;color:#1a1a1a;font-size:12px}
      h1{color:#E8670A;font-size:1.3rem;margin-bottom:4px}
      .sub{color:#888;font-size:0.78rem;margin-bottom:14px}
      table{width:100%;border-collapse:collapse}
      th{background:#E8670A;color:white;padding:7px 10px;text-align:left;font-size:0.7rem;text-transform:uppercase}
      td{padding:7px 10px;border-bottom:1px solid #f5e0c5}
      tfoot tr{background:#5a2d0c;color:white;font-weight:900}
      tfoot td{border:none;padding:8px 10px}
    </style></head><body>
    <h1>${titulo} - ${fecha}</h1>
    <div class="sub">TelePan Henares - ${new Date().toLocaleDateString('es-ES')}</div>
    <table>
      <thead><tr><th>Articulo</th><th>Uds</th><th>%</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td>TOTAL</td><td style="text-align:center">${total} ud</td><td></td></tr></tfoot>
    </table></body></html>`
  }

  const descargarTablaExcel = async (arts: any[], titulo: string) => {
    globalToast('Generando Excel...')
    try {
      if (!(window as any).XLSX) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script')
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
          s.onload = () => resolve(); s.onerror = reject
          document.head.appendChild(s)
        })
      }
      const XLSX = (window as any).XLSX
      const wb = XLSX.utils.book_new()
      const rows = arts.map(a => ({ 'Articulo': a.nombre, 'Unidades': a.cantidad }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), titulo.slice(0, 30))
      XLSX.writeFile(wb, `${titulo}_${fecha}.xlsx`)
      globalToast('Excel descargado')
    } catch(e: any) { globalToast('Error: ' + e.message, 'error') }
  }

  const descargarTablaPDF = (arts: any[], total: number, titulo: string) => {
    const html = buildTablaHTML(arts, total, titulo)
    const w = window.open('', '_blank')
    if (!w) return globalToast('Permite las ventanas emergentes', 'error')
    w.document.write(html); w.document.close()
    globalToast('Usa Ctrl+P para guardar como PDF')
  }

  const descargarTablaJPG = async (arts: any[], total: number, titulo: string) => {
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
      const html = buildTablaHTML(arts, total, titulo)
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const blobUrl = URL.createObjectURL(blob)
      const iframe = document.createElement('iframe')
      iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:700px;height:1000px;border:none'
      document.body.appendChild(iframe)
      await new Promise<void>(resolve => { iframe.onload = () => resolve(); iframe.src = blobUrl })
      if (iframe.contentWindow) (iframe.contentWindow as any).print = () => {}
      await new Promise(r => setTimeout(r, 1000))
      const canvas = await h2c(iframe.contentDocument!.body, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false, width: 700 })
      document.body.removeChild(iframe); URL.revokeObjectURL(blobUrl)
      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/jpeg', 0.95)
      a.download = `${titulo}_${fecha}.jpg`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      globalToast('JPG descargado')
    } catch(e: any) { globalToast('Error: ' + e.message, 'error') }
  }

  const renderTabla = (arts: any[], total: number, titulo = 'Resumen') => (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ padding: '12px 18px', borderBottom: '1px solid #f5e8d8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontFamily: 'Fredoka One', color: 'var(--marron)' }}>{titulo} — {fecha} — <span style={{ color: 'var(--naranja)' }}>{total} ud</span></span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => descargarTablaExcel(arts, titulo)}>Excel</button>
          <button className="btn btn-secondary btn-sm" onClick={() => descargarTablaPDF(arts, total, titulo)}>PDF</button>
          <button className="btn btn-secondary btn-sm" onClick={() => descargarTablaJPG(arts, total, titulo)}>JPG</button>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Artículo</th><th style={{ textAlign: 'center' }}>Uds</th><th style={{ textAlign: 'center' }}>%</th></tr></thead>
          <tbody>
            {arts.map((a, i) => {
              // Calcular qué clientes pidieron este artículo
              const clientesQueOrdenaron = (() => {
                const result: { nombre: string; codigo: string; cantidad: number; total: number }[] = []
                Object.entries(grouped).forEach(([, { cliente, items }]: any) => {
                  let cant = 0; let tot = 0
                  items.forEach((p: any) => {
                    const n = p.productos?.nombre?.toUpperCase() || ''
                    const matches = a.esAgrupado
                      ? (a.grupo === 'barra' ? (n.includes('CASA') || n.includes('PISTOLA'))
                        : a.grupo === 'artesana' ? n.includes('ARTESANA')
                        : n.includes('PICO'))
                      : n === a.nombre.toUpperCase()
                    if (matches) {
                      cant += Number(p.cantidad)
                      tot += Number(p.cantidad) * Number(p.precio) * (1 + Number(p.iva) / 100)
                    }
                  })
                  if (cant > 0) result.push({ nombre: cliente?.nombre, codigo: cliente?.codigo, cantidad: cant, total: tot })
                })
                return result.sort((a, b) => b.cantidad - a.cantidad)
              })()
              return (
                <tr key={i} style={{ background: a.esAgrupado ? '#fff8f0' : '', cursor: 'pointer' }}
                  onClick={() => setResumenDetalle({ nombre: a.nombre, clientes: clientesQueOrdenaron })}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fff3e8')}
                  onMouseLeave={e => (e.currentTarget.style.background = a.esAgrupado ? '#fff8f0' : '')}>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {a.esAgrupado && <span style={{ background: a.grupo === 'barra' ? 'var(--naranja)' : a.grupo === 'artesana' ? '#7c3aed' : '#16a34a', color: 'white', borderRadius: 5, padding: '1px 6px', fontSize: '0.65rem', fontWeight: 800 }}>{a.grupo === 'barra' ? 'CASA+PISTOLA' : a.grupo === 'artesana' ? 'ARTESANA' : 'PICOS'}</span>}
                    <strong style={{ color: a.grupo === 'barra' ? 'var(--naranja)' : a.grupo === 'artesana' ? '#7c3aed' : a.grupo === 'picos' ? '#16a34a' : 'var(--marron)' }}>{a.nombre}</strong>
                    <span style={{ fontSize: '0.7rem', color: 'var(--gris)', marginLeft: 4 }}>👆 {clientesQueOrdenaron.length} clientes</span>
                  </div></td>
                  <td style={{ textAlign: 'center' }}><span style={{ fontFamily: 'Fredoka One', fontSize: '1.6rem', color: a.grupo === 'barra' ? 'var(--naranja)' : a.grupo === 'artesana' ? '#7c3aed' : a.grupo === 'picos' ? '#16a34a' : '#2563eb' }}>{a.cantidad}</span></td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                      <div style={{ width: 80, height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${total > 0 ? a.cantidad / total * 100 : 0}%`, height: '100%', background: a.grupo === 'barra' ? '#E8670A' : a.grupo === 'artesana' ? '#7c3aed' : '#2563eb', borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--gris)' }}>{total > 0 ? (a.cantidad / total * 100).toFixed(1) : 0}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
            {arts.length === 0 && <tr><td colSpan={3}><div className="empty-state"><p>Sin artículos</p></div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">🛒 Pedidos</h1>
        <div className="page-actions">
          <input type="date" className="input" style={{ width: 'auto' }} value={fecha} onChange={e => setFecha(e.target.value)} />
          <button className="btn btn-success" onClick={generarPedidos} disabled={loading}><Zap size={16} /> {loading ? 'Generando...' : 'Generar día'}</button>
          <button className="btn btn-secondary" onClick={generarMesCompleto} disabled={loading} title="Generar todos los pedidos del mes de golpe">
            📅 Generar mes
          </button>
          <button className="btn btn-primary" onClick={() => setOpenManual(true)}><Plus size={16} /> Añadir</button>
          {pedidos.length > 0 && (
            <button className="btn btn-danger" onClick={async () => {
              if (!confirm(`¿Eliminar TODOS los pedidos del ${fecha}?`)) return
              await supabase.from('pedidos').delete().eq('fecha', fecha).eq('user_id', user!.id)
              globalToast('🗑️ Pedidos eliminados'); load()
            }}><Trash2 size={16} /> Borrar día</button>
          )}
        </div>
      </div>

      {suspendidos.length > 0 && (
        <div onClick={() => setOpenSuspModal(true)} style={{ background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: '#92400e', cursor: 'pointer' }}>
          <PauseCircle size={18} />
          <div style={{ flex: 1 }}><strong>{suspendidos.length} suspendido{suspendidos.length > 1 ? 's' : ''}</strong> — {suspendidos.map((s: any) => s.clientes?.nombre).join(', ')}</div>
          <span style={{ fontSize: '0.78rem', fontWeight: 800, background: '#f59e0b', color: 'white', borderRadius: 6, padding: '3px 10px', whiteSpace: 'nowrap' }}>✏️ Ver / modificar</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gris)' }}>🔍</span>
          <input className="input" placeholder="Buscar cliente..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ paddingLeft: 34 }} />
        </div>
        <button className={`btn btn-sm ${ordenPorRuta ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setOrdenPorRuta(!ordenPorRuta)}>
          <ArrowUpDown size={14} /> {ordenPorRuta ? '🗺️ Por ruta' : '# Por código'}
        </button>
      </div>
<div className="tabs" style={{ flexWrap: 'wrap' }}>
        <div className={`tab ${tabActiva === 'pedidos' ? 'active' : ''}`} onClick={() => setTabActiva('pedidos')}>🛒 Pedidos ({sortedGroups.length})</div>
        <div className={`tab ${tabActiva === 'cambios' ? 'active' : ''}`} onClick={() => setTabActiva('cambios')}>
          🔄 Cambios {cambiosDelDia.length > 0 && <span style={{ background: '#dc2626', color: 'white', borderRadius: 10, padding: '0 6px', fontSize: '0.7rem', marginLeft: 4 }}>{cambiosDelDia.length}</span>}
        </div>
        <div className={`tab ${tabActiva === 'resumen' ? 'active' : ''}`} onClick={() => setTabActiva('resumen')}>📦 Resumen ({totalResumen} ud)</div>
        {categoriasDelDia.map(cat => <div key={cat} className={`tab ${tabActiva === cat ? 'active' : ''}`} onClick={() => setTabActiva(cat)}>{CAT_EMOJI[cat]} {cat} ({resumenPorCategoria(cat).reduce((s, a) => s + a.cantidad, 0)} ud)</div>)}
      </div>

      {tabActiva === 'cambios' && (
        <div>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 16px', marginBottom: 14, fontSize: '0.85rem', color: '#1e40af' }}>
            🔄 Diferencias entre habituales y el pedido real de hoy. Pulsa <strong>Editar</strong> para corregir.
          </div>
          {cambiosDelDia.length === 0
            ? <div className="card"><div className="empty-state"><span style={{ fontSize: 36 }}>✅</span><p>Sin cambios — el pedido coincide con los habituales</p></div></div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cambiosDelDia.map((c, i) => (
                <div key={i} className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, borderLeft: `4px solid ${c.tipo === 'añadido' || c.tipo === 'manual' ? '#16a34a' : c.tipo === 'modificado' ? '#2563eb' : '#dc2626'}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, color: 'var(--marron)' }}>{c.clienteNombre}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--gris)', marginTop: 2 }}>{c.descripcion}</div>
                  </div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap',
                    background: c.tipo === 'añadido' || c.tipo === 'manual' ? '#f0fdf4' : c.tipo === 'modificado' ? '#eff6ff' : '#fef2f2',
                    color: c.tipo === 'añadido' || c.tipo === 'manual' ? '#16a34a' : c.tipo === 'modificado' ? '#2563eb' : '#dc2626' }}>
                    {c.tipo.toUpperCase()}
                  </span>
                  <button className="btn btn-primary btn-sm" onClick={() => {
                    const items = grouped[c.clienteId]?.items || []
                    setEditCliente({ id: c.clienteId, nombre: c.clienteNombre, lineas: items.map((p: any) => ({ ...p, _cantidad: p.cantidad })) })
                  }}><Edit2 size={12} /> Editar</button>
                </div>
              ))}
            </div>
          }
        </div>
      )}

      {tabActiva === 'resumen' && (
        <div>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 16px', marginBottom: 14, fontSize: '0.85rem', color: '#1e40af' }}>
            📋 Total del <strong>{fecha}</strong> — CASA* y PISTOLA* agrupadas.
          </div>
          {renderTabla(resumenArticulos, totalResumen, 'Resumen total')}
        </div>
      )}

      {categoriasDelDia.includes(tabActiva) && (() => {
        const arts = resumenPorCategoria(tabActiva)
        const total = arts.reduce((s, a) => s + a.cantidad, 0)
        return <div>
          <div style={{ background: '#fff8f0', border: '1px solid #f5e8d8', borderRadius: 10, padding: '10px 16px', marginBottom: 14, fontSize: '0.85rem', color: 'var(--marron)', fontWeight: 700 }}>
            {CAT_EMOJI[tabActiva]} <strong>{tabActiva}</strong> del {fecha} — <strong style={{ color: 'var(--naranja)' }}>{total} unidades</strong>
          </div>
          {renderTabla(arts, total, tabActiva)}
        </div>
      })()}

      {tabActiva === 'pedidos' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
            {[{ label: 'Clientes', value: sortedGroups.length, color: 'var(--naranja)' }, { label: 'Unidades', value: totalUnidades, color: '#2563eb' }, { label: 'Total €', value: totalEuros.toFixed(2) + ' €', color: '#16a34a' }]
              .map(k => <div key={k.label} className="card" style={{ padding: '12px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Fredoka One', fontSize: '1.4rem', color: k.color }}>{k.value}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--gris)', fontWeight: 800, textTransform: 'uppercase' }}>{k.label}</div>
              </div>)}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sortedGroups.map(([clienteId, { cliente, items }]: any, idx) => {
              const isExpanded = expandedClients.has(clienteId)
              const susp = getSusp(clienteId)
              const tienesCambios = cambiosDelDia.some(c => c.clienteId === clienteId)
              const total = items.reduce((s: number, p: any) => s + Number(p.cantidad) * Number(p.precio) * (1 + Number(p.iva) / 100), 0)
              return (
                <div key={clienteId} className="card" style={{ padding: 0, overflow: 'hidden', border: susp ? '2px solid #f59e0b' : tienesCambios ? '2px solid #2563eb' : '1px solid #f5e8d8' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer', background: susp ? '#fffbeb' : tienesCambios ? '#eff6ff' : isExpanded ? 'var(--crema-dark)' : 'white' }}
                    onClick={() => setExpandedClients(prev => { const n = new Set(prev); n.has(clienteId) ? n.delete(clienteId) : n.add(clienteId); return n })}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: susp ? '#f59e0b' : 'var(--naranja)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fredoka One', fontSize: '0.82rem', flexShrink: 0 }}>
                      {susp ? '⏸' : (ordenPorRuta ? cliente?.orden_ruta : idx + 1) || idx + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'Fredoka One', color: 'var(--naranja)', fontSize: '0.82rem' }}>#{cliente?.codigo}</span>
                        <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.88rem' }}>{cliente?.nombre}</strong>
                        {susp && <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 5, padding: '1px 6px', fontSize: '0.65rem', fontWeight: 800, flexShrink: 0 }}>⏸ SUSPENDIDO</span>}
                        {tienesCambios && !susp && (() => {
                          const misCambios = cambiosDelDia.filter(c => c.clienteId === clienteId)
                          const tipos = misCambios.map(c => c.tipo)
                          const esManual = tipos.includes('manual')
                          const tieneHabitual = modelos.some(m => m.cliente_id === clienteId)
                          if (esManual && !tieneHabitual) return <span style={{ background: '#eff6ff', color: '#2563eb', borderRadius: 5, padding: '1px 6px', fontSize: '0.65rem', fontWeight: 800, flexShrink: 0 }}>➕ CLIENTE AÑADIDO</span>
                          if (esManual && tieneHabitual) return <span style={{ background: '#eff6ff', color: '#2563eb', borderRadius: 5, padding: '1px 6px', fontSize: '0.65rem', fontWeight: 800, flexShrink: 0 }}>➕ CLIENTE AÑADIDO · ✏️ MODIFICADO</span>
                          return <span style={{ background: '#fff8f0', color: '#E8670A', borderRadius: 5, padding: '1px 6px', fontSize: '0.65rem', fontWeight: 800, flexShrink: 0 }}>✏️ CLIENTE MODIFICADO</span>
                        })()}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--gris)' }}>{cliente?.poblacion} · {items.length} producto{items.length !== 1 ? 's' : ''}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                      <span style={{ fontWeight: 800, color: '#16a34a', fontSize: '0.88rem' }}>{total.toFixed(2)} €</span>
                      <button className="btn btn-primary btn-sm" style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                        onClick={e => { e.stopPropagation(); setEditCliente({ id: clienteId, nombre: cliente?.nombre, lineas: items.map((p: any) => ({ ...p, _cantidad: p.cantidad })) }) }}>
                        <Edit2 size={12} /> Editar
                      </button>
                      <button className="btn btn-danger btn-sm btn-icon"
                        onClick={e => { e.stopPropagation(); if (!confirm(`¿Eliminar el pedido de ${cliente?.nombre}?`)) return; Promise.all(items.map((p: any) => supabase.from('pedidos').delete().eq('id', p.id))).then(() => { globalToast('🗑️ Pedido eliminado'); load() }) }}>
                        <Trash2 size={13} />
                      </button>
                      <span style={{ color: 'var(--gris)' }}>{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
                    </div>
                  </div>
                  {isExpanded && (
                    <div style={{ padding: '0 0 8px' }}>
                      <table style={{ width: '100%' }}>
                        <thead><tr><th>Producto</th><th style={{ textAlign: 'center' }}>Cant.</th><th>Precio</th><th>Total</th><th></th></tr></thead>
                        <tbody>
                          {items.map((p: any) => (
                            <tr key={p.id}>
                              <td style={{ fontWeight: 700 }}>{p.productos?.nombre}</td>
                              <td style={{ textAlign: 'center' }}><span style={{ fontFamily: 'Fredoka One', fontSize: '1.1rem', color: 'var(--naranja)' }}>{p.cantidad}</span></td>
                              <td>{Number(p.precio).toFixed(2)} €</td>
                              <td><strong style={{ color: 'var(--naranja)' }}>{(Number(p.cantidad) * Number(p.precio) * (1 + Number(p.iva) / 100)).toFixed(2)} €</strong></td>
                              <td><button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(p.id)}><Trash2 size={12} /></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
            {sortedGroups.length === 0 && (
              <div className="card"><div className="empty-state"><span style={{ fontSize: 36 }}>🛒</span>
                <p>{busqueda ? `Sin resultados para "${busqueda}"` : 'No hay pedidos para esta fecha'}</p>
                {!busqueda && <span>Pulsa "Generar día" para crear los pedidos habituales</span>}
              </div></div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DETALLE PRODUCTO — clientes que lo pidieron */}
      {resumenDetalle && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setResumenDetalle(null)}>
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3 className="modal-title">👆 {resumenDetalle.nombre}</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setResumenDetalle(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: '0.82rem', color: '#1e40af' }}>
                📋 <strong>{resumenDetalle.clientes.length} clientes</strong> pidieron este producto hoy —{' '}
                <strong>{resumenDetalle.clientes.reduce((s, c) => s + c.cantidad, 0)} unidades</strong> en total
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th style={{ textAlign: 'center' }}>Uds</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumenDetalle.clientes.map((c, i) => (
                      <tr key={i}>
                        <td>
                          <div style={{ fontWeight: 800, color: 'var(--marron)' }}>{c.nombre}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--gris)' }}>#{c.codigo}</div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontFamily: 'Fredoka One', fontSize: '1.4rem', color: 'var(--naranja)' }}>{c.cantidad}</span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                          {c.total.toFixed(2)} €
                        </td>
                        <td>
                          <button className="btn btn-primary btn-sm btn-icon" title="Editar pedido"
                            onClick={() => {
                              const cId = Object.keys(grouped).find(id => grouped[id].cliente?.nombre === c.nombre)
                              if (cId) {
                                setResumenDetalle(null)
                                setEditCliente({ id: cId, nombre: c.nombre, lineas: grouped[cId].items.map((p: any) => ({ ...p, _cantidad: p.cantidad })) })
                              }
                            }}>
                            <Edit2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setResumenDetalle(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR PEDIDO CLIENTE */}
      {editCliente && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditCliente(null)}>
          <div className="modal" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h3 className="modal-title">✏️ Editar — {editCliente.nombre}</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setEditCliente(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: '0.82rem', color: '#1e40af' }}>
                💡 Modifica cantidades con − +, elimina con 🗑️, o añade nuevos productos abajo.
              </div>

              {editCliente.lineas.map((l, i) => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: i % 2 === 0 ? 'var(--crema)' : 'white', borderRadius: 8, marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, color: 'var(--marron)', fontSize: '0.9rem' }}>{l.productos?.nombre}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--gris)' }}>{Number(l.precio).toFixed(2)} € · IVA {l.iva}%</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button style={{ background: '#f3f4f6', border: 'none', borderRadius: 6, width: 34, height: 34, fontSize: '1.2rem', cursor: 'pointer', fontWeight: 800 }}
                      onClick={() => setEditCliente(prev => prev ? { ...prev, lineas: prev.lineas.map((x, j) => j === i ? { ...x, _cantidad: Math.max(1, x._cantidad - 1) } : x) } : prev)}>−</button>
                    <input type="number" min={1} step={1} value={l._cantidad}
                      onChange={e => { const v = Math.max(1, parseInt(e.target.value) || 1); setEditCliente(prev => prev ? { ...prev, lineas: prev.lineas.map((x, j) => j === i ? { ...x, _cantidad: v } : x) } : prev) }}
                      style={{ width: 54, textAlign: 'center', fontWeight: 800, fontSize: '1.1rem', border: '2px solid var(--naranja)', borderRadius: 8, padding: '4px', fontFamily: 'Nunito' }} />
                    <button style={{ background: 'var(--naranja)', border: 'none', borderRadius: 6, width: 34, height: 34, fontSize: '1.2rem', cursor: 'pointer', fontWeight: 800, color: 'white' }}
                      onClick={() => setEditCliente(prev => prev ? { ...prev, lineas: prev.lineas.map((x, j) => j === i ? { ...x, _cantidad: x._cantidad + 1 } : x) } : prev)}>+</button>
                  </div>
                  <div style={{ minWidth: 58, textAlign: 'right', fontWeight: 800, color: '#16a34a', fontSize: '0.88rem' }}>
                    {(l._cantidad * Number(l.precio) * (1 + Number(l.iva) / 100)).toFixed(2)} €
                  </div>
                  <button className="btn btn-danger btn-sm btn-icon"
                    onClick={() => setEditCliente(prev => prev ? { ...prev, lineas: prev.lineas.filter((_, j) => j !== i) } : prev)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}

              {editCliente.lineas.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--gris)', padding: '16px 0', fontSize: '0.85rem' }}>Sin productos. Añade uno abajo o guarda para eliminar el pedido.</div>
              )}

              <div style={{ background: '#fff8f0', borderRadius: 8, padding: '10px 14px', marginTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 800, marginBottom: 16 }}>
                <span>Total:</span>
                <span style={{ color: 'var(--naranja)', fontFamily: 'Fredoka One', fontSize: '1.2rem' }}>
                  {editCliente.lineas.reduce((s, l) => s + l._cantidad * Number(l.precio) * (1 + Number(l.iva) / 100), 0).toFixed(2)} €
                </span>
              </div>

              {/* Añadir producto */}
              <div style={{ borderTop: '2px solid #f5e8d8', paddingTop: 14 }}>
                <div style={{ fontWeight: 800, color: 'var(--naranja)', fontSize: '0.9rem', marginBottom: 10 }}>➕ Añadir producto al pedido</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <label className="input-label">Producto</label>
                    <select className="select" value={editCliente._productoAdd || ''}
                      onChange={e => setEditCliente(prev => prev ? { ...prev, _productoAdd: e.target.value } : prev)}>
                      <option value="">Seleccionar...</option>
                      {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} — {Number(p.precio_sin_iva).toFixed(2)}€</option>)}
                    </select>
                  </div>
                  <div style={{ width: 80 }}>
                    <label className="input-label">Cant.</label>
                    <input className="input" type="number" min={1} step={1}
                      value={editCliente._cantidadAdd || 1}
                      onChange={e => setEditCliente(prev => prev ? { ...prev, _cantidadAdd: Math.max(1, parseInt(e.target.value) || 1) } : prev)}
                      style={{ textAlign: 'center', fontWeight: 800 }} />
                  </div>
                  <button className="btn btn-success" onClick={() => {
                    const prodId = editCliente._productoAdd
                    if (!prodId) { globalToast('Selecciona un producto', 'error'); return }
                    const cant = Number(editCliente._cantidadAdd || 1)
                    const prod = productos.find(p => p.id === prodId)
                    if (!prod) { globalToast('Producto no encontrado', 'error'); return }
                    const existe = editCliente.lineas.findIndex(l => l.producto_id === prodId)
                    if (existe >= 0) {
                      // Ya existe — sumar cantidad
                      setEditCliente(prev => prev ? {
                        ...prev,
                        lineas: prev.lineas.map((x, j) => j === existe ? { ...x, _cantidad: x._cantidad + cant } : x),
                        _productoAdd: '', _cantidadAdd: 1
                      } : prev)
                      globalToast(`✅ ${prod.nombre}: cantidad aumentada`)
                      return
                    }
                    // Producto nuevo — añadir a la lista
                    setEditCliente(prev => prev ? {
                      ...prev,
                      lineas: [...prev.lineas, {
                        id: 'new_' + Date.now(),
                        producto_id: prod.id,
                        productos: { nombre: prod.nombre },
                        precio: Number(prod.precio_sin_iva || 0),
                        iva: Number(prod.iva || 4),
                        cantidad: cant,
                        _cantidad: cant,
                        _nuevo: true
                      }],
                      _productoAdd: '', _cantidadAdd: 1
                    } : prev)
                    globalToast(`✅ ${prod.nombre} añadido al pedido`)
                  }}>➕ Añadir</button>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditCliente(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={async () => {
                if (!user) return
                try {
                  const existentes = editCliente.lineas.filter(l => !l._nuevo)
                  const nuevas = editCliente.lineas.filter(l => l._nuevo)

                  // 1. Actualizar cantidades de líneas existentes
                  for (const l of existentes) {
                    const { error } = await supabase.from('pedidos')
                      .update({ cantidad: Number(l._cantidad) }).eq('id', l.id)
                    if (error) { globalToast('Error al actualizar: ' + error.message, 'error'); return }
                  }

                  // 2. Eliminar líneas que se borraron del modal
                  const idsRestantes = new Set(existentes.map(l => l.id))
                  const { data: orig } = await supabase.from('pedidos')
                    .select('id').eq('cliente_id', editCliente.id).eq('fecha', fecha)
                  const paraEliminar = (orig || []).filter(o => !idsRestantes.has(o.id))
                  for (const o of paraEliminar) {
                    await supabase.from('pedidos').delete().eq('id', o.id)
                  }

                  // 3. Insertar productos nuevos
                  if (nuevas.length > 0) {
                    const inserts = nuevas.map(l => ({
                      user_id: user.id,
                      cliente_id: editCliente.id,
                      fecha,
                      producto_id: l.producto_id,
                      cantidad: Number(l._cantidad),
                      precio: Number(l.precio || 0),
                      iva: Number(l.iva || 4)
                    }))
                    const { error: insErr } = await supabase.from('pedidos').insert(inserts)
                    if (insErr) { globalToast('Error al insertar nuevo producto: ' + insErr.message, 'error'); return }
                  }

                  globalToast('✅ Pedido de ' + editCliente.nombre + ' actualizado')
                  setEditCliente(null)
                  load()
                } catch (err: any) {
                  globalToast('Error inesperado: ' + err.message, 'error')
                }
              }}>💾 Guardar todo</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SUSPENSIONES */}
      {openSuspModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setOpenSuspModal(false)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3 className="modal-title">⏸ Clientes suspendidos</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setOpenSuspModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {suspendidos.map((s: any) => (
                <div key={s.id} style={{ background: 'var(--crema)', borderRadius: 10, padding: '12px 14px', marginBottom: 10, border: '1px solid #f5e8d8' }}>
                  {editSusp?.id === s.id ? (
                    <div>
                      <div style={{ fontWeight: 800, color: 'var(--marron)', marginBottom: 10 }}>✏️ {s.clientes?.nombre}</div>
                      <div className="form-grid-2" style={{ marginBottom: 8 }}>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                          <label className="input-label">Fecha inicio</label>
                          <input className="input" type="date" value={editSusp.fecha_inicio} onChange={e => setEditSusp((p: any) => ({ ...p, fecha_inicio: e.target.value }))} />
                        </div>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                          <label className="input-label">Fecha fin</label>
                          <input className="input" type="date" value={editSusp.fecha_fin} onChange={e => setEditSusp((p: any) => ({ ...p, fecha_fin: e.target.value }))} />
                        </div>
                      </div>
                      <div className="input-group" style={{ marginBottom: 10 }}>
                        <label className="input-label">Motivo</label>
                        <select className="select" value={editSusp.motivo} onChange={e => setEditSusp((p: any) => ({ ...p, motivo: e.target.value }))}>
                          <option value="Vacaciones">🏖 Vacaciones</option>
                          <option value="Enfermedad">🏥 Enfermedad</option>
                          <option value="Viaje">✈️ Viaje</option>
                          <option value="Cierre temporal">🔒 Cierre temporal</option>
                          <option value="Otro">📝 Otro</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-primary btn-sm" onClick={async () => {
                          const { error } = await supabase.from('suspensiones_pedido').update({ fecha_inicio: editSusp.fecha_inicio, fecha_fin: editSusp.fecha_fin, motivo: editSusp.motivo }).eq('id', s.id)
                          if (error) return globalToast('Error: ' + error.message, 'error')
                          // Si la suspensión empieza hoy, eliminar pedido del día
                          if (editSusp.fecha_inicio <= today) {
                            await supabase.from('pedidos').delete().eq('cliente_id', s.cliente_id).eq('fecha', today)
                          }
                          globalToast('✅ Suspensión actualizada'); setEditSusp(null); load()
                        }}>💾 Guardar</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditSusp(null)}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, color: 'var(--marron)' }}>#{s.clientes?.codigo} — {s.clientes?.nombre}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--gris)', marginTop: 2 }}>📅 {s.fecha_inicio} → {s.fecha_fin} · <strong>{s.motivo}</strong></div>
                      </div>
                      <button className="btn btn-primary btn-sm" onClick={() => setEditSusp({ ...s })}>✏️ Modificar</button>
                      <button className="btn btn-success btn-sm" onClick={async () => {
                        if (!confirm(`¿Reanudar pedidos de ${s.clientes?.nombre}?`)) return
                        await supabase.from('suspensiones_pedido').delete().eq('id', s.id)
                        globalToast('✅ Reanudado')
                        // Si la suspensión cubría la fecha actual, regenerar pedidos de ese cliente para hoy
                        const hoy = fecha
                        if (s.fecha_inicio <= hoy && s.fecha_fin >= hoy && user) {
                          // Cargar habituales del cliente para hoy
                          const dayOfWeek = new Date(hoy + 'T12:00:00').getDay()
                          const { data: mods } = await supabase
                            .from('pedidos_modelo')
                            .select('*, productos(precio_sin_iva, iva)')
                            .eq('cliente_id', s.cliente_id)
                            .eq('dia_semana', dayOfWeek)
                          if (mods && mods.length > 0) {
                            const validos = mods
                              .filter((m: any) => m.cantidad > 0)
                              .filter((m: any) => shouldInclude(m.frecuencia, hoy, m.fecha_inicio_alternos))
                            if (validos.length > 0) {
                              const inserts = validos.map((m: any) => ({
                                user_id: user.id, fecha: hoy,
                                cliente_id: m.cliente_id, producto_id: m.producto_id,
                                cantidad: m.cantidad,
                                precio: Number(m.productos?.precio_sin_iva || 0),
                                iva: Number(m.productos?.iva || 4)
                              }))
                              await supabase.from('pedidos').insert(inserts)
                              globalToast('✅ Reanudado — pedido de hoy añadido automáticamente')
                            } else {
                              globalToast('✅ Reanudado — hoy no le tocaba pedido según habituales')
                            }
                          } else {
                            globalToast('✅ Reanudado — sin habituales configurados para hoy')
                          }
                        }
                        load()
                      }}>✅ Reanudar</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setOpenSuspModal(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AÑADIR MANUAL */}
      {openManual && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setOpenManual(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">➕ Añadir Pedido Manual</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setOpenManual(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">Cliente</label>
                <SearchableSelect
                  value={formManual.cliente_id}
                  onChange={v => setFormManual(f => ({ ...f, cliente_id: v }))}
                  placeholder="🔍 Buscar cliente..."
                  options={clientes.map(c => ({
                    value: c.id,
                    label: `#${c.codigo} — ${c.nombre}`,
                    sublabel: c.poblacion
                  }))}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Producto</label>
                <SearchableSelect
                  value={formManual.producto_id}
                  onChange={v => {
                    const prod = productos.find(p => p.id === v)
                    setFormManual(f => ({ ...f, producto_id: v, precio: prod?.precio_sin_iva || 0, iva: prod?.iva || 4 }))
                  }}
                  placeholder="🔍 Buscar producto..."
                  options={productos.map(p => ({
                    value: p.id,
                    label: p.nombre,
                    sublabel: `${Number(p.precio_sin_iva).toFixed(2)} € · IVA ${p.iva}%`
                  }))}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Cantidad</label>
                <input className="input" type="number" min={1} value={formManual.cantidad} onChange={e => setFormManual(f => ({ ...f, cantidad: parseInt(e.target.value) || 1 }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setOpenManual(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleAddManual}>✅ Añadir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}