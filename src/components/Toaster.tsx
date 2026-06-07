import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useUI } from '@/store/ui'
import { cn } from '@/lib/cn'

export function Toaster() {
  const { toasts, dismiss } = useUI()
  return (
    <div className="fixed top-4 inset-x-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex items-center gap-2 rounded-2xl px-4 py-3 shadow-soft text-white text-sm font-semibold w-full max-w-sm animate-[fadeIn_.15s_ease]',
            t.type === 'success' && 'bg-ok',
            t.type === 'error' && 'bg-danger',
            t.type === 'info' && 'bg-rose',
          )}
        >
          {t.type === 'success' ? <CheckCircle2 size={18} /> : t.type === 'error' ? <XCircle size={18} /> : <Info size={18} />}
          <span className="flex-1">{t.message}</span>
          <button onClick={() => dismiss(t.id)} className="opacity-80 hover:opacity-100">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
