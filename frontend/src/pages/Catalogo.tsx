import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Catalogo() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('catalogo').select('*').then(({ data, error }) => {
      if (error) setError(error.message)
      else setItems(data || [])
      setLoading(false)
    })
  }, [])

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Cargando catalogo...</div>
  if (error) return <div style={{ padding: 40, color: 'red' }}>Error: {error}</div>

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontFamily: 'Fredoka One', color: '#E8670A', marginBottom: 16 }}>Catalogo</h1>
      <p style={{ color: '#888' }}>{items.length} articulos cargados. El modulo completo se cargara pronto.</p>
    </div>
  )
}