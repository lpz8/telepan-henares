import { useState, useRef, useEffect } from 'react'
import { Search, X } from 'lucide-react'

interface Option {
  value: string
  label: string
  sublabel?: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  disabled?: boolean
}

export default function SearchableSelect({ value, onChange, options, placeholder = 'Buscar...', disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find(o => o.value === value)

  const filtered = query.trim()
    ? options.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        o.sublabel?.toLowerCase().includes(query.toLowerCase())
      )
    : options

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Botón principal */}
      <div
        onClick={() => { if (!disabled) { setOpen(!open); setQuery('') } }}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 12px', borderRadius: 10,
          border: open ? '2px solid var(--naranja)' : '1.5px solid #e0c9b0',
          background: disabled ? '#f9fafb' : 'white',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: '0.875rem', color: selected ? 'var(--marron)' : '#aaa',
          fontWeight: selected ? 700 : 400, minHeight: 42,
          transition: 'border 0.15s'
        }}>
        <Search size={14} color={open ? 'var(--naranja)' : '#aaa'} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : placeholder}
        </span>
        {selected && (
          <button onClick={e => { e.stopPropagation(); onChange(''); setQuery('') }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#aaa', display: 'flex' }}>
            <X size={14} />
          </button>
        )}
        {!selected && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}>
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
          background: 'white', border: '2px solid var(--naranja)',
          borderRadius: 10, marginTop: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          overflow: 'hidden'
        }}>
          {/* Input búsqueda */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #f5e8d8', position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'var(--naranja)' }} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Escribe para buscar..."
              style={{
                width: '100%', padding: '6px 8px 6px 28px',
                border: 'none', outline: 'none',
                fontSize: '0.875rem', background: 'transparent',
                fontFamily: 'Nunito', fontWeight: 700, color: 'var(--marron)'
              }} />
          </div>

          {/* Lista */}
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '14px 14px', color: '#aaa', fontSize: '0.85rem', textAlign: 'center' }}>
                Sin resultados para "{query}"
              </div>
            ) : (
              filtered.map(o => (
                <div key={o.value}
                  onClick={() => { onChange(o.value); setOpen(false); setQuery('') }}
                  style={{
                    padding: '10px 14px', cursor: 'pointer',
                    background: o.value === value ? '#fff8f0' : 'white',
                    borderLeft: o.value === value ? '3px solid var(--naranja)' : '3px solid transparent',
                    transition: 'background 0.1s'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fff8f0')}
                  onMouseLeave={e => (e.currentTarget.style.background = o.value === value ? '#fff8f0' : 'white')}>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--marron)' }}>{o.label}</div>
                  {o.sublabel && <div style={{ fontSize: '0.75rem', color: 'var(--gris)', marginTop: 1 }}>{o.sublabel}</div>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}