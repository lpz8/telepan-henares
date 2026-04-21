import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingCart, Users, Package, TrendingDown, FileText, Receipt, Truck, Settings, BarChart2, Brain, MapPin, ClipboardList, CheckSquare, HardDrive, PauseCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const [counts, setCounts] = useState({ clientes: 0, productos: 0, pedidosHoy: 0, gastosMes: 0, facturasMes: 0, cobradoMes: 0, suspendidos: 0 })
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().split('T')[0]
  const mesActual = new Date().toISOString().slice(0, 7)

  useEffect(() => {
    async function load() {
      const [c, p, ped, g, f, fc, susp] = await Promise.all([
        supabase.from('clientes').select('id', { count: 'exact', head: true }),
        supabase.from('productos').select('id', { count: 'exact', head: true }),
        supabase.from('pedidos').select('id', { count: 'exact', head: true }).eq('fecha', today),
        supabase.from('gastos').select('importe').gte('fecha', mesActual + '-01').lte('fecha', mesActual + '-31'),
        supabase.from('facturas').select('id', { count: 'exact', head: true }).like('mes', mesActual + '%'),
        supabase.from('facturas').select('total').like('mes', mesActual + '%').eq('pagado', true),
        supabase.from('suspensiones_pedido').select('id', { count: 'exact', head: true }).lte('fecha_inicio', today).gte('fecha_fin', today),
      ])
      setCounts({
        clientes: c.count || 0,
        productos: p.count || 0,
        pedidosHoy: ped.count || 0,
        gastosMes: g.data?.reduce((s, r) => s + Number(r.importe), 0) || 0,
        facturasMes: f.count || 0,
        cobradoMes: fc.data?.reduce((s, r) => s + Number(r.total), 0) || 0,
        suspendidos: susp.count || 0,
      })
      setLoading(false)
    }
    load()
  }, [])

  const stats = [
    { label: 'Pedidos Hoy', value: counts.pedidosHoy, icon: ShoppingCart, bg: '#fff3e8', color: '#E8670A', to: '/pedidos' },
    { label: 'Clientes', value: counts.clientes, icon: Users, bg: '#eff6ff', color: '#2563eb', to: '/clientes' },
    { label: 'Productos', value: counts.productos, icon: Package, bg: '#f0fdf4', color: '#16a34a', to: '/productos' },
    { label: 'Gastos Mes', value: `${counts.gastosMes.toFixed(0)}€`, icon: TrendingDown, bg: '#fef2f2', color: '#dc2626', to: '/gastos' },
    { label: 'Facturas Mes', value: counts.facturasMes, icon: Receipt, bg: '#f5f3ff', color: '#7c3aed', to: '/facturas' },
    { label: 'Cobrado Mes', value: `${counts.cobradoMes.toFixed(0)}€`, icon: CheckSquare, bg: '#f0fdf4', color: '#16a34a', to: '/cobros' },
  ]

  const shortcuts = [
    { label: 'Pedidos', icon: ShoppingCart, to: '/pedidos', color: '#E8670A' },
    { label: 'Habituales', icon: ClipboardList, to: '/pedidos-habituales', color: '#f59e0b' },
    { label: 'Albaranes', icon: FileText, to: '/albaranes', color: '#2563eb' },
    { label: 'Facturas', icon: Receipt, to: '/facturas', color: '#7c3aed' },
    { label: 'Cobros', icon: CheckSquare, to: '/cobros', color: '#16a34a' },
    { label: 'Rutas', icon: MapPin, to: '/rutas', color: '#0891b2' },
    { label: 'Gastos', icon: TrendingDown, to: '/gastos', color: '#dc2626' },
    { label: 'Estadísticas', icon: BarChart2, to: '/estadisticas', color: '#ca8a04' },
    { label: 'IA Facturas', icon: Brain, to: '/ia-facturas', color: '#db2777' },
    { label: 'Proveedores', icon: Truck, to: '/proveedores', color: '#0891b2' },
    { label: 'Backup', icon: HardDrive, to: '/backup', color: '#6b7280' },
    { label: 'Configuración', icon: Settings, to: '/configuracion', color: '#6b7280' },
  ]

  return (
    <div>
      {/* Alerta suspendidos */}
      {counts.suspendidos > 0 && (
        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, color: '#92400e' }}>
          <PauseCircle size={20} color="#f59e0b" />
          <span style={{ fontWeight: 700 }}>{counts.suspendidos} cliente{counts.suspendidos > 1 ? 's' : ''} con pedidos suspendidos hoy por vacaciones</span>
          <Link to="/pedidos-habituales" style={{ marginLeft: 'auto', color: '#E8670A', fontWeight: 800, fontSize: '0.85rem' }}>Ver →</Link>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid">
        {stats.map(s => (
          <Link key={s.label} to={s.to} style={{ textDecoration: 'none' }}>
            <div className="stat-card" style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
              onMouseOver={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseOut={e => (e.currentTarget.style.transform = '')}>
              <div className="stat-icon" style={{ background: s.bg }}>
                <s.icon size={22} color={s.color} />
              </div>
              <div>
                <div className="stat-value">{loading ? '—' : s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Acceso rápido */}
      <div className="card">
        <h3 style={{ fontFamily: 'Fredoka One', fontSize: '1.1rem', color: 'var(--marron)', marginBottom: 14 }}>🚀 Acceso Rápido</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 10 }}>
          {shortcuts.map(s => (
            <Link key={s.to} to={s.to} style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 8px', background: '#fffaf5', borderRadius: 12, border: '1.5px solid #f5e8d8', cursor: 'pointer', transition: 'all 0.2s', color: s.color }}
                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)' }}
                onMouseOut={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: s.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <s.icon size={20} />
                </div>
                <span style={{ fontWeight: 800, fontSize: '0.75rem', color: 'var(--texto)', textAlign: 'center' }}>{s.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
