import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Clock, MessageSquare, Star, Trash2 } from 'lucide-react'
import { db } from '@/lib/db'
import { fmtDateTime } from '@/lib/format'
import { Empty, PageHeader } from '@/components/ui'
import { save, removeRow } from '@/data/repo'
import { useAuth } from '@/store/auth'
import { toast } from '@/store/ui'
import { cn } from '@/lib/cn'
import type { Review } from '@/lib/types'

export default function Reviews() {
  const { isAdmin } = useAuth()
  const reviews = (useLiveQuery(() => db.reviews.orderBy('created_at').reverse().toArray(), []) ?? []) as Review[]
  const products = useLiveQuery(() => db.products.toArray(), []) ?? []
  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? '—'

  const pending = reviews.filter((r) => !r.is_approved)
  const approved = reviews.filter((r) => r.is_approved)

  if (!isAdmin) return <div className="card p-10 text-center"><p className="font-bold text-cocoa">التقييمات للمالك والمدير فقط</p></div>

  async function approve(r: Review) { await save('reviews', { ...r, is_approved: true }); toast('تم نشر التقييم ✅') }
  async function unapprove(r: Review) { await save('reviews', { ...r, is_approved: false }); toast('تم إخفاء التقييم') }
  async function remove(r: Review) { if (window.confirm('حذف التقييم نهائيًا؟')) { await removeRow('reviews', r.id); toast('اتحذف') } }

  return (
    <div>
      <PageHeader title="تقييمات المنتجات" subtitle={pending.length > 0 ? `${pending.length} بانتظار المراجعة` : 'تقييمات عملاء المتجر'} />
      {reviews.length === 0 ? (
        <div className="card"><Empty icon={<MessageSquare size={40} />} title="مفيش تقييمات لسه" hint="تقييمات العملاء من المتجر الأونلاين هتظهر هنا عشان تراجعيها قبل النشر" /></div>
      ) : (
        <div className="space-y-5">
          {pending.length > 0 && (
            <section>
              <h3 className="font-bold text-cocoa mb-2 flex items-center gap-2"><Clock size={16} className="text-warn" /> بانتظار المراجعة ({pending.length})</h3>
              <div className="space-y-2">{pending.map((r) => <ReviewCard key={r.id} r={r} product={productName(r.product_id)} onApprove={() => approve(r)} onRemove={() => remove(r)} pending />)}</div>
            </section>
          )}
          {approved.length > 0 && (
            <section>
              <h3 className="font-bold text-cocoa mb-2">منشورة ({approved.length})</h3>
              <div className="space-y-2">{approved.map((r) => <ReviewCard key={r.id} r={r} product={productName(r.product_id)} onUnapprove={() => unapprove(r)} onRemove={() => remove(r)} />)}</div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function Stars({ n }: { n: number }) {
  return <span className="inline-flex">{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={14} className={i <= n ? 'text-gold fill-gold' : 'text-pink'} />)}</span>
}

function ReviewCard({ r, product, onApprove, onUnapprove, onRemove, pending }: {
  r: Review; product: string; onApprove?: () => void; onUnapprove?: () => void; onRemove: () => void; pending?: boolean
}) {
  return (
    <div className={cn('card p-4', pending && 'border-r-4 border-warn')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap"><span className="font-bold text-cocoa">{r.customer_name}</span><Stars n={r.rating} /></div>
          <p className="text-xs text-cocoa-light mt-0.5">على: <span className="font-semibold text-cocoa">{product}</span> · {fmtDateTime(r.created_at)}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {onApprove && <button onClick={onApprove} className="btn-primary text-xs py-1.5 px-3"><Check size={14} /> نشر</button>}
          {onUnapprove && <button onClick={onUnapprove} className="btn-ghost text-xs py-1.5 px-3">إخفاء</button>}
          <button onClick={onRemove} className="text-cocoa-light hover:text-danger" title="حذف"><Trash2 size={16} /></button>
        </div>
      </div>
      {r.comment && <p className="text-sm text-cocoa mt-2 bg-blush/40 rounded-xl p-2.5 leading-relaxed">{r.comment}</p>}
    </div>
  )
}
