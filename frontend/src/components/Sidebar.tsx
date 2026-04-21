import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Package, ShoppingCart, FileText,
  Receipt, TrendingDown, Truck, Settings, LogOut,
  BarChart2, Brain, ChevronLeft, ChevronRight, MapPin,
  ClipboardList, CheckSquare, HardDrive, Megaphone
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useState } from 'react'

const logoUrl = '/logo.jpg'

const navItems = [
  { section: 'Principal', items: [
    { to: '/', icon: LayoutDashboard, label: 'Inicio' },
    { to: '/estadisticas', icon: BarChart2, label: 'Estadísticas' },
  ]},
  { section: 'Operaciones', items: [
    { to: '/pedidos', icon: ShoppingCart, label: 'Pedidos' },
    { to: '/pedidos-habituales', icon: ClipboardList, label: 'Habituales' },
    { to: '/albaranes', icon: FileText, label: 'Albaranes' },
    { to: '/facturas', icon: Receipt, label: 'Facturas' },
    { to: '/cobros', icon: CheckSquare, label: 'Cobros' },
  ]},
  { section: 'Maestros', items: [
    { to: '/clientes', icon: Users, label: 'Clientes' },
    { to: '/productos', icon: Package, label: 'Productos' },
    { to: '/rutas', icon: MapPin, label: 'Rutas' },
    { to: '/proveedores', icon: Truck, label: 'Proveedores' },
  ]},
  { section: 'Finanzas', items: [
    { to: '/gastos', icon: TrendingDown, label: 'Gastos y Beneficios' },
    { to: '/ia-facturas', icon: Brain, label: 'IA Facturas' },
  ]},
  { section: 'Marketing', items: [
    { to: '/publicidad', icon: Megaphone, label: 'Catálogo' },
  ]},
  { section: 'Sistema', items: [
    { to: '/configuracion', icon: Settings, label: 'Configuración' },
    { to: '/backup', icon: HardDrive, label: 'Backup' },
  ]},
]

export default function Sidebar() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-logo">
        <img src={logoUrl} alt="TelePan" />
        {!collapsed && (
          <div>
            <span className="brand-name">TelePan</span>
            <span className="brand-sub">Henares</span>
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 4 }}>
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(section => (
          <div key={section.section} className="nav-section">
            {!collapsed && <div className="nav-section-title">{section.section}</div>}
            {section.items.map(item => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <item.icon size={20} />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer no-print">
        <button onClick={async () => { await signOut(); navigate('/login') }}
          className="nav-item" style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)' }}>
          <LogOut size={20} />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </div>
  )
}
