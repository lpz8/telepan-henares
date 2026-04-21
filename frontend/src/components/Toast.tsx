import { CheckCircle, XCircle, Info } from 'lucide-react'

interface ToastItem { id: number; message: string; type: 'success' | 'error' | 'info' }

export function ToastContainer({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          {t.type === 'success' && <CheckCircle size={18} color="#16a34a" />}
          {t.type === 'error' && <XCircle size={18} color="#dc2626" />}
          {t.type === 'info' && <Info size={18} color="#E8670A" />}
          {t.message}
        </div>
      ))}
    </div>
  )
}
