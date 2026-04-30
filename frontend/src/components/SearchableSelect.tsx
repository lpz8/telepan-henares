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
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 })
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find(o => o.value === value)

  const filtered = query.trim()
    ? options.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        o.sublabel?.toLowerCase().includes(query.toLowerCase())
      )
    : options

  const openDropdown = () => {
    if (disabled) return
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const dropHeight = Math.min(280, filtered.length * 52 + 56)
      const showAbove = spaceBelow < dropHeight && rect.top > dropHeight
      setDropPos({
        top: showAbove ? rect.top - dropHeight - 4 : rect.bottom + 4,
        left: rect.left,
        width: rect.width
      })
    }
    setOpen(true)
    setQuery('')
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        // Also check if click is inside the portal dropdown
        const portal = document.getElementById('searchable-select-portal')
        if (portal && portal.contains(e.target as Node)) return
        setOpen(false); setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Reposition on scroll/resize
  useEffect(() => {
    if (!open) return
    const update = () => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect()
        setDropPos(p => ({ ...p, top: rect.bottom + 4, left: rect.left, width: rect.width }))
      }
    }
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update) }
  }, [open])

  const select = (v: string) => { onChange(v); setOpen(false); setQuery('') }

  return (
    <>
      <div ref={ref} style={{ position: 'relative' }}>
        {/* Trigger */}
        <div
          onClick={openDropdown}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 12px', borderRadius: 10,
            border: open ? '2px solid var(--naranja)' : '1.5px solid #e0c9b0',
            background: disabled ? '#f9fafb' : 'white',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem', color: selected ? 'var(--marron)' : '#aaa',
            fontWeight: selected ? 700 : 400, minHeight: 44,
            transition: 'border 0.15s', userSelect: 'none'
          }}>
          <Search size={14} color={open ? 'var(--naranja)' : '#aaa'} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selected ? selected.label : placeholder}
          </span>
          {selected ? (
            <button onClick={e => { e.stopPropagation(); onChange('') }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#aaa', display: 'flex', borderRadius: 4 }}>
              <X size={14} />
            </button>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, opacity: 0.4 }}>
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
      </div>

      {/* Portal dropdown — fixed position so it works inside modals on mobile */}
      {open && (
        <div
          id="searchable-select-portal"
          style={{
            position: 'fixed',
            top: dropPos.top, left: dropPos.left, width: dropPos.width,
            zIndex: 99999,
            background: 'white',
            border: '2px solid var(--naranja)',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            overflow: 'hidden'
          }}>
          {/* Search input */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #f5e8d8', position: 'relative', background: '#fff8f0' }}>
            <Search size={14} style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'var(--naranja)' }} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Escribe para filtrar..."
              style={{
                width: '100%', padding: '7px 8px 7px 30px',
                border: 'none', outline: 'none',
                fontSize: '0.9rem', background: 'transparent',
                fontFamily: 'Nunito', fontWeight: 700, color: 'var(--marron)'
              }} />
          </div>

          {/* Options list */}
          <div style={{ maxHeight: 220, overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
            {filtered.length === 0 ? (
              <div style={{ padding: '16px', color: '#aaa', fontSize: '0.85rem', textAlign: 'center' }}>
                Sin resultados para "{query}"
              </div>
            ) : (
              filtered.map(o => (
                <div key={o.value}
                  onMouseDown={e => { e.preventDefault(); select(o.value) }}
                  onTouchEnd={e => { e.preventDefault(); select(o.value) }}
                  style={{
                    padding: '10px 14px', cursor: 'pointer',
                    background: o.value === value ? '#fff8f0' : 'white',
                    borderLeft: o.value === value ? '3px solid var(--naranja)' : '3px solid transparent',
                    minHeight: 48, display: 'flex', flexDirection: 'column', justifyContent: 'center'
                  }}>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--marron)' }}>{o.label}</div>
                  {o.sublabel && <div style={{ fontSize: '0.75rem', color: 'var(--gris)', marginTop: 1 }}>{o.sublabel}</div>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  )
}