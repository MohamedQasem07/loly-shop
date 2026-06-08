import { type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Spinner({ className }: { className?: string }) {
  return <div className={cn('animate-spin rounded-full border-2 border-rose/25 border-t-rose', className ?? 'w-6 h-6')} />
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-cocoa/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          'relative card w-full max-h-[92vh] overflow-auto rounded-b-none sm:rounded-3xl sm:m-4',
          wide ? 'sm:max-w-4xl' : 'sm:max-w-lg',
        )}
      >
        {title && (
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur flex items-center justify-between px-5 py-4 border-b border-pink/50">
            <h3 className="font-display text-lg font-bold text-cocoa">{title}</h3>
            <button onClick={onClose} className="text-cocoa-light hover:text-rose transition">
              <X />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
        {footer && (
          <div className="sticky bottom-0 bg-white/95 backdrop-blur px-5 py-4 border-t border-pink/50 flex gap-2 justify-end safe-bottom">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-cocoa">{title}</h1>
        {subtitle && <p className="text-sm text-cocoa-light mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Empty({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 text-cocoa-light">
      {icon && <div className="mb-3 text-rose/60">{icon}</div>}
      <p className="font-semibold text-cocoa">{title}</p>
      {hint && <p className="text-sm mt-1">{hint}</p>}
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="block text-xs text-cocoa-light/70 mt-1">{hint}</span>}
    </label>
  )
}
