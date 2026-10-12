import { useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import { ToastContainer } from './Toast'
import { useToast } from '../hooks/useToast'
import { supabase } from '../lib/supabase'

const pageTitles: Record<string, string> = {
  '/': 'Inicio',
  '/pedidos': 'Pedidos del Día',
  '/pedidos-habituales': 'Pedidos Habituales',
  '/catalogo': 'Catálogo de Productos',
  '/albaranes': 'Albaranes',
  '/facturas': 'Facturas',
  '/cobros': 'Control de Cobros',
  '/clientes': 'Clientes',
  '/productos': 'Productos',
  '/gastos': 'Gastos',
  '/proveedores': 'Proveedores',
  '/configuracion': 'Configuración',
  '/estadisticas': 'Estadísticas',
  '/rutas': 'Rutas Diarias',
  '/ia-facturas': 'IA — Análisis de Facturas',
  '/backup': 'Copias de Seguridad',
  '/publicidad': 'Catálogo de Precios',
}

export let globalToast: (msg: string, type?: 'success' | 'error' | 'info') => void = () => {}

export default function Layout() {
  const { toasts, toast } = useToast()
  const [avisoVisible, setAvisoVisible] = useState(false)
  const [resumenDia, setResumenDia] = useState<any>(null)
  const location = useLocation()
  globalToast = toast

  const title = pageTitles[location.pathname] || 'TelePan'
  const dateStr = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    const yaVisto = localStorage.getItem('aviso_dia_' + today)
    if (yaVisto) return

    async function cargarResumen() {
      const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const [pedidos, facturas30] = await Promise.all([
        supabase.from('pedidos').select('id', { count: 'exact', head: true }).eq('fecha', today),
        supabase.from('facturas').select('total, clientes(nombre)').eq('pagado', false).lt('fecha', hace30)
      ])
      setResumenDia({
        pedidosHoy: pedidos.count || 0,
        facturasVencidas: facturas30.data || [],
      })
      setAvisoVisible(true)
      localStorage.setItem('aviso_dia_' + today, '1')
    }
    cargarResumen()
  }, [])

  const [busquedaGlobal, setBusquedaGlobal] = useState('')
  const [resultados, setResultados] = useState<any[]>([])
  const [buscando, setBuscando] = useState(false)
  const navigate = useNavigate()

  const buscarGlobal = async (q: string) => {
    if (q.length < 2) { setResultados([]); return }
    setBuscando(true)
    const esDateLike = /^\d{4}-\d{2}/.test(q) || /^\d{1,2}\/\d{1,2}/.test(q)
    const [clientes, facturas, pedidosFecha, proveedores, gastos, productos] = await Promise.all([
      supabase.from('clientes').select('id, nombre, codigo, poblacion').ilike('nombre', `%${q}%`).limit(4),
      supabase.from('facturas').select('id, numero, mes, total, pagado, clientes(nombre)').or(`numero.ilike.%${q}%,mes.ilike.%${q}%`).limit(4),
      esDateLike
        ? supabase.from('pedidos').select('fecha, clientes(nombre)').eq('fecha', q).limit(1)
        : Promise.resolve({ data: [] }),
      supabase.from('proveedores').select('id, nombre, telefono').ilike('nombre', `%${q}%`).limit(3),
      supabase.from('gastos').select('id, descripcion, importe, fecha, categoria').ilike('descripcion', `%${q}%`).limit(3),
      supabase.from('productos').select('id, nombre, precio_sin_iva, categoria').ilike('nombre', `%${q}%`).limit(4),
    ])
    const res: any[] = [
      ...(clientes.data || []).map(c => ({ tipo: 'cliente', id: c.id, titulo: c.nombre, sub: `#${c.codigo} · ${c.poblacion}`, ruta: '/clientes', emoji: '👤' })),
      ...(facturas.data || []).map((f: any) => ({ tipo: 'factura', id: f.id, titulo: f.numero, sub: `${f.clientes?.nombre} · ${Number(f.total).toFixed(2)}€ · ${f.pagado ? '✅ Cobrada' : '⏳ Pendiente'}`, ruta: '/facturas', emoji: '📄' })),
      ...(pedidosFecha.data && pedidosFecha.data.length > 0 ? [{ tipo: 'pedido', id: q, titulo: `Pedidos del ${q}`, sub: 'Ver pedidos de esta fecha', ruta: '/pedidos', emoji: '🛒' }] : []),
      ...(proveedores.data || []).map((p: any) => ({ tipo: 'proveedor', id: p.id, titulo: p.nombre, sub: `📞 ${p.telefono || 'Sin teléfono'}`, ruta: '/proveedores', emoji: '🚚' })),
      ...(gastos.data || []).map((g: any) => ({ tipo: 'gasto', id: g.id, titulo: g.descripcion, sub: `${g.categoria} · ${Number(g.importe).toFixed(2)}€ · ${g.fecha}`, ruta: '/gastos', emoji: '💸' })),
      ...(productos.data || []).map((p: any) => ({ tipo: 'producto', id: p.id, titulo: p.nombre, sub: `${p.categoria} · ${Number(p.precio_sin_iva).toFixed(2)}€ sin IVA`, ruta: '/productos', emoji: '🍞' })),
    ]
    setResultados(res)
    setBuscando(false)
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <div className="topbar no-print">
          <div className="topbar-left">
            <h2 className="topbar-title">{title}</h2>
            <span className="topbar-date">🗓 {dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}</span>
          </div>
          {/* BÚSQUEDA GLOBAL */}
          <div style={{ position: 'relative', flex: 1, maxWidth: 320, margin: '0 16px' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gris)', fontSize: '0.9rem' }}>🔍</span>
            <input
              className="input"
              style={{ paddingLeft: 32, width: '100%', height: 36, fontSize: '0.875rem' }}
              placeholder="Buscar cliente, factura, producto, proveedor, gasto..."
              value={busquedaGlobal}
              onChange={e => { setBusquedaGlobal(e.target.value); buscarGlobal(e.target.value) }}
              onBlur={() => setTimeout(() => setResultados([]), 200)}
            />
            {resultados.length > 0 && (
              <div style={{ position: 'absolute', top: '110%', left: 0, right: 0, background: 'white', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', border: '1px solid #f5e8d8', zIndex: 9999, overflow: 'hidden' }}>
                {resultados.map((r, i) => (
                  <div key={i}
                    onMouseDown={() => { navigate(r.ruta); setBusquedaGlobal(''); setResultados([]) }}
                    style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f5e8d8', display: 'flex', alignItems: 'center', gap: 10 }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fff8f0')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                    <span style={{ fontSize: '1rem' }}>{r.emoji || (r.tipo === 'cliente' ? '👤' : r.tipo === 'factura' ? '📄' : '🛒')}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--marron)' }}>{r.titulo}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--gris)' }}>{r.sub}</div>
                    </div>
                  </div>
                ))}
                {buscando && <div style={{ padding: '10px 14px', fontSize: '0.8rem', color: 'var(--gris)' }}>Buscando...</div>}
              </div>
            )}
          </div>
        </div>

        {avisoVisible && resumenDia && (
          <div style={{ position:'fixed', top:16, right:16, zIndex:9999, background:'white', borderRadius:14, boxShadow:'0 8px 32px rgba(0,0,0,0.15)', border:'2px solid var(--naranja)', padding:'16px 20px', maxWidth:320, animation:'slideIn 0.3s ease' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <span style={{ fontFamily:'Fredoka One', color:'var(--marron)', fontSize:'1rem' }}>☀️ Resumen del día</span>
              <button onClick={() => setAvisoVisible(false)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'1.1rem', color:'var(--gris)' }}>✕</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <div style={{ background:'#fff8f0', borderRadius:8, padding:'8px 12px', display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:'0.85rem', fontWeight:700 }}>🛒 Pedidos hoy</span>
                <span style={{ fontFamily:'Fredoka One', color:'var(--naranja)' }}>{resumenDia.pedidosHoy}</span>
              </div>
              {resumenDia.facturasVencidas.length > 0 && (
                <div style={{ background:'#fef2f2', borderRadius:8, padding:'8px 12px' }}>
                  <div style={{ fontSize:'0.85rem', fontWeight:700, color:'#dc2626', marginBottom:4 }}>
                    ⚠️ {resumenDia.facturasVencidas.length} facturas +30 días sin cobrar
                  </div>
                  {resumenDia.facturasVencidas.slice(0, 2).map((f: any, i: number) => (
                    <div key={i} style={{ fontSize:'0.75rem', color:'#dc2626' }}>
                      • {f.clientes?.nombre} — {Number(f.total).toFixed(2)}€
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => setAvisoVisible(false)}
              className="btn btn-primary"
              style={{ width:'100%', justifyContent:'center', marginTop:10, padding:'8px' }}>
              Entendido
            </button>
          </div>
        )}
        <style>{`@keyframes slideIn{from{transform:translateX(100px);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>

        <div className="page-content"><Outlet /></div>
      </div>
      <ToastContainer toasts={toasts} />
    </div>
  )
}
