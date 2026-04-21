import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import { ToastContainer } from './Toast'
import { useToast } from '../hooks/useToast'
import { supabase } from '../lib/supabase'

const pageTitles: Record<string, string> = {
  '/': 'Inicio',
  '/pedidos': 'Pedidos del Día',
  '/pedidos-habituales': 'Pedidos Habituales',
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

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <div className="topbar no-print">
          <div className="topbar-left">
            <h2 className="topbar-title">{title}</h2>
            <span className="topbar-date">🗓 {dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}</span>
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
