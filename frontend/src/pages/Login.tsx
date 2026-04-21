import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

const logoUrl = '/logo.jpg'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('telepansgl@gmail.com')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) { setError('Introduce tu contraseña'); return }
    setLoading(true); setError('')
    const { error: err } = await signIn(email, password)
    if (err) setError('Contraseña incorrecta. Compruébala en Supabase → Authentication')
    setLoading(false)
  }

  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="login-logo-wrap">
          <img src={logoUrl} alt="TelePan Henares" className="login-logo" />
        </div>
        <h1 className="login-title">TelePan Henares</h1>
        <p className="login-sub">"La panadería en casa"</p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">Email</label>
            <input className="input" type="email" value={email}
              onChange={e => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className="input-group">
            <label className="input-label">Contraseña</label>
            <input className="input" type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Tu contraseña de Supabase"
              autoComplete="current-password" autoFocus />
          </div>
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', color: '#dc2626', fontSize: '0.875rem', fontWeight: 700, marginBottom: 12 }}>
              ⚠️ {error}
            </div>
          )}
          <button className="btn btn-primary" type="submit" disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '1rem', marginTop: 4 }}>
            {loading ? 'Entrando...' : '🍞 Entrar'}
          </button>
        </form>

        <div style={{ marginTop: 20, padding: '12px 16px', background: 'var(--crema)', borderRadius: 10, fontSize: '0.78rem', color: 'var(--gris)', textAlign: 'center' }}>
          <strong style={{ color: 'var(--marron)' }}>¿Olvidaste la contraseña?</strong><br />
          Supabase → Authentication → Users → Reset password
        </div>
      </div>
    </div>
  )
}
