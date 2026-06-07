import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CheckCircle2, MessageCircle, Phone, ShoppingBag, Truck, X } from 'lucide-react'
import { db } from '@/lib/db'
import { money, num, fmtDateTime } from '@/lib/format'
import { Empty, PageHeader } from '@/components/ui'
import { convertOrderToSale, updateOrderStatus } from '@/data/repo'
import { useAuth } from '@/store/auth'
import { toast } from '@/store/ui'
import { cn } from '@/lib/cn'
import type { Order, OrderStatus } from '@/lib/types'

const STATUS: Record<OrderStatus, { label: string; cls: string }> = {
  new: { label: 'جديد', cls: 'bg-rose/15 text-rose' },
  confirmed: { label: 'مؤكّد', cls: 'bg-gold/15 text-gold-dark' },
  preparing: { label: 'بيتجهّز', cls: 'bg-gold/15 text-gold-dark' },
  shipped: { label: 'اتشحن', cls: 'bg-blue-100 text-blue-700' },
  delivered: { label: 'اتسلّم', cls: 'bg-ok/15 text-ok' },
  cancelled: { label: 'ملغي', cls: 'bg-danger/10 text-danger' },
}

export default function Orders() {
  const { isAdmin, profile } = useAuth()
  const orders = useLiveQuery(() => db.orders.orderBy('created_at').reverse().toArray(), []) ?? []
  const items = useLiveQuery(() => db.order_items.toArray(), []) ?? []
  const [filter, setFilter] = useState<'active' | 'all'>('active')

  const newCount = orders.filter((o) => o.status === 'new').length
  const shown = useMemo(
    () => orders.filter((o) => (filter === 'all' ? true : o.status !== 'delivered' && o.status !== 'cancelled')),
    [orders, filter],
  )

  if (!isAdmin) return <div className="card p-10 text-center"><p className="font-bold text-cocoa">الأوردرات للمالك والمدير فقط</p></div>

  return (
    <div>
      <PageHeader title="أوردرات المتجر" subtitle={newCount > 0 ? `${num(newCount)} طلب جديد` : 'طلبات المتجر الأونلاين'} />

      <div className="flex gap-2 mb-4">
        <button onClick={() => setFilter('active')} className={cn('rounded-full px-4 py-1.5 text-sm font-bold border', filter === 'active' ? 'bg-rose text-white border-rose' : 'bg-white text-cocoa-light border-pink')}>الحالية</button>
        <button onClick={() => setFilter('all')} className={cn('rounded-full px-4 py-1.5 text-sm font-bold border', filter === 'all' ? 'bg-rose text-white border-rose' : 'bg-white text-cocoa-light border-pink')}>الكل</button>
      </div>

      {shown.length === 0 ? (
        <div className="card"><Empty icon={<ShoppingBag size={40} />} title="مفيش أوردرات" hint="الطلبات من المتجر الأونلاين هتظهر هنا" /></div>
      ) : (
        <div className="space-y-3">
          {shown.map((o) => (
            <OrderCard key={o.id} order={o} items={items.filter((i) => i.order_id === o.id)} userId={profile?.id ?? null} />
          ))}
        </div>
      )}
    </div>
  )
}

function OrderCard({ order, items, userId }: { order: Order; items: { id: string; product_name: string; qty: number; unit_price: number }[]; userId: string | null }) {
  const [busy, setBusy] = useState(false)
  const st = STATUS[order.status]

  async function convert() {
    setBusy(true)
    try { await convertOrderToSale(order.id, userId); toast('اتحوّل لفاتورة واتخصم من المخزون 🌸') }
    catch { toast('حصل خطأ', 'error') } finally { setBusy(false) }
  }
  async function setStatus(status: OrderStatus) {
    await updateOrderStatus(order.id, { status })
    toast('اتحدّث')
  }

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-cocoa">{order.order_no} <span className={cn('chip mr-1', st.cls)}>{st.label}</span></p>
          <p className="text-[11px] text-cocoa-light">{fmtDateTime(order.created_at)}</p>
        </div>
        <div className="text-left">
          <p className="font-bold text-rose">{money(order.total)}</p>
          <p className="text-[11px] text-cocoa-light">{order.payment === 'instapay' ? 'إنستاباي' : 'عند الاستلام'} {order.paid ? '· مدفوع' : ''}</p>
        </div>
      </div>

      <div className="mt-2 rounded-2xl bg-blush/40 p-3">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-bold text-cocoa">{order.customer_name}</span>
          <a href={`tel:${order.customer_phone}`} className="text-cocoa-light flex items-center gap-1" dir="ltr"><Phone size={13} /> {order.customer_phone}</a>
          <a href={`https://wa.me/${order.customer_phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-ok"><MessageCircle size={16} /></a>
        </div>
        {order.address && <p className="text-xs text-cocoa-light mt-1">📍 {order.address}</p>}
        {order.note && <p className="text-xs text-cocoa-light mt-1">📝 {order.note}</p>}
      </div>

      <ul className="mt-2 text-sm divide-y divide-pink/30">
        {items.map((it) => (
          <li key={it.id} className="flex justify-between py-1.5"><span className="text-cocoa">{it.product_name} × {num(it.qty)}</span><span className="text-cocoa-light">{money(it.unit_price * it.qty)}</span></li>
        ))}
      </ul>
      <div className="text-xs text-cocoa-light mt-1">الشحن: {order.shipping > 0 ? money(order.shipping) : 'مجاني'}{order.discount > 0 ? ` · خصم: ${money(order.discount)}` : ''}</div>

      {order.status !== 'cancelled' && order.status !== 'delivered' && (
        <div className="flex flex-wrap gap-2 mt-3">
          {!order.sale_id && (
            <button onClick={convert} disabled={busy} className="btn-primary text-sm py-2"><CheckCircle2 size={16} /> تأكيد وتحويل لفاتورة</button>
          )}
          {order.status === 'new' && <button onClick={() => setStatus('confirmed')} className="btn-ghost text-sm py-2">تأكيد بس</button>}
          {(order.status === 'confirmed' || order.status === 'preparing') && <button onClick={() => setStatus('shipped')} className="btn-ghost text-sm py-2"><Truck size={16} /> اتشحن</button>}
          <button onClick={() => setStatus('cancelled')} className="btn-ghost text-sm py-2 text-danger border-danger/30"><X size={16} /> إلغاء</button>
        </div>
      )}
      {order.sale_id && <p className="text-[11px] text-ok mt-2 font-semibold">✓ اتحوّل لفاتورة بيع</p>}
    </div>
  )
}
