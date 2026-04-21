import { useState, useCallback } from 'react'

interface Toast { id: number; message: string; type: 'success' | 'error' | 'info' }
let counter = 0

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const toast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = ++counter
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])
  return { toasts, toast }
}
