import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import Productos from './pages/Productos'
import Pedidos from './pages/Pedidos'
import PedidosModelo from './pages/PedidosModelo'
import Albaranes from './pages/Albaranes'
import Facturas from './pages/Facturas'
import Cobros from './pages/Cobros'
import Gastos from './pages/Gastos'
import Proveedores from './pages/Proveedores'
import Configuracion from './pages/Configuracion'
import Estadisticas from './pages/Estadisticas'
import IAFacturas from './pages/IAFacturas'
import Rutas from './pages/Rutas'
import Backup from './pages/Backup'
import Publicidad from './pages/Publicidad'

function PrivateRoutes() {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#5a2d0c,#3d1a06)' }}>
      <div style={{ fontFamily:'Pacifico,cursive', fontSize:'2.5rem', color:'#E8670A', marginBottom:8 }}>TelePan</div>
      <div style={{ color:'rgba(255,255,255,0.6)' }}>Cargando...</div>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/productos" element={<Productos />} />
        <Route path="/pedidos" element={<Pedidos />} />
        <Route path="/pedidos-habituales" element={<PedidosModelo />} />
        <Route path="/albaranes" element={<Albaranes />} />
        <Route path="/facturas" element={<Facturas />} />
        <Route path="/cobros" element={<Cobros />} />
        <Route path="/gastos" element={<Gastos />} />
        <Route path="/proveedores" element={<Proveedores />} />
        <Route path="/configuracion" element={<Configuracion />} />
        <Route path="/estadisticas" element={<Estadisticas />} />
        <Route path="/ia-facturas" element={<IAFacturas />} />
        <Route path="/rutas" element={<Rutas />} />
        <Route path="/backup" element={<Backup />} />
        <Route path="/publicidad" element={<Publicidad />} />
      </Route>
    </Routes>
  )
}

function LoginRoute() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/" replace />
  return <Login />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/*" element={<PrivateRoutes />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
