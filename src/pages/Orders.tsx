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
import type { Order, OrderStatus, Settings } from '@/lib/types'

const STATUS: Record<OrderStatus, { label: string; cls: string }> = {
  new: { label: 'جديد', cls: 'bg-rose/15 text-rose' },
  confirmed: { label: 'مؤكّد', cls: 'bg-gold/15 text-gold-dark' },
  preparing: { label: 'بيتجهّز', cls: 'bg-gold/15 text-gold-dark' },
  shipped: { label: 'اتشحن', cls: 'bg-blue-100 text-blue-700' },
  delivered: { label: 'اتسلّم', cls: 'bg-ok/15 text-ok' },
  cancelled: { label: 'ملغي', cls: 'bg-danger/10 text-danger' },
}

const FLOW: OrderStatus[] = ['new', 'confirmed', 'preparing', 'shipped', 'delivered']
const nextStatus = (s: OrderStatus): OrderStatus | null => {
  const i = FLOW.indexOf(s)
  return i >= 0 && i < FLOW.length - 1 ? FLOW[i + 1] : null
}

/** Compose a WhatsApp message to the customer about the order's current status. */
function waCustomer(order: Order, storeName: string): string {
  const n = order.order_no
  let body: string
  switch (order.status) {
    case 'confirmed': body = `تم تأكيد طلبك ✅\nرقم الطلب: ${n}\nهنجهّزه ونتواصل معاكي للتوصيل.`; break
    case 'preparing': body = `طلبك ${n} بيتجهّز دلوقتي 🛍️`; break
    case 'shipped': body = `طلبك ${n} اتشحن وفي الطريق إليكي 🚚\nالإجمالي: ${money(order.total)}`; break
    case 'delivered': body = `تم توصيل طلبك ${n} 🌸\nشكراً لتسوّقك معانا، في انتظارك تاني!`; break
    case 'cancelled': body = `بخصوص طلبك ${n} — للأسف اتلغى. لو حابة تعرفي التفاصيل تواصلي معانا.`; break
    default: body = `بخصوص طلبك ${n} 🌸`
  }
  return `https://wa.me/${order.customer_phone.replace(/\D/g, '')}?text=${encodeURIComponent(`${body}\n— ${storeName}`)}`
}

export default function Orders() {
  const { isAdmin, profile } = useAuth()
  const orders = useLiveQuery(() => db.orders.orderBy('created_at').reverse().toArray(), []) ?? []
  const items = useLiveQuery(() => db.order_items.toArray(), []) ?? []
  const settings = useLiveQuery(() => db.settings.get(1), []) as Settings | undefined
  const [filter, setFilter] = useState<'active' | 'all'>('active')
  const storeName = settings?.store_name ?? 'Loly Store'

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
        <div className="grid lg:grid-cols-2 gap-3">
          {shown.map((o) => (
            <OrderCard key={o.id} order={o} items={items.filter((i) => i.order_id === o.id)} userId={profile?.id ?? null} storeName={storeName} />
          ))}
        </div>
      )}
    </div>
  )
}

function OrderSteps({ status }: { status: OrderStatus }) {
  if (status === 'cancelled') return <div className="mt-3 rounded-xl bg-danger/10 text-danger text-center text-sm font-bold py-2">الطلب ملغي</div>
  const idx = FLOW.indexOf(status)
  return (
    <div className="flex items-center justify-between mt-3 gap-1">
      {FLOW.map((s, i) => (
        <div key={s} className="flex flex-col items-center gap-1 flex-1">
          <span className={cn('w-6 h-6 rounded-full grid place-items-center text-[10px] font-bold', i <= idx ? 'bg-ok text-white' : 'bg-blush text-cocoa-light border border-pink')}>{i < idx ? '✓' : i + 1}</span>
          <span className={cn('text-[10px] font-semibold text-center leading-tight', i <= idx ? 'text-cocoa' : 'text-cocoa-light')}>{STATUS[s].label}</span>
        </div>
      ))}
    </div>
  )
}

function OrderCard({ order, items, userId, storeName }: {
  order: Order
  items: { id: string; product_name: string; qty: number; unit_price: number }[]
  userId: string | null
  storeName: string
}) {
  const [busy, setBusy] = useState(false)
  const next = nextStatus(order.status)

  async function convert() {
    setBusy(true)
    try { await convertOrderToSale(order.id, userId); toast('اتحوّل لفاتورة واتخصم من المخزون 🌸') }
    catch { toast('حصل خطأ', 'error') } finally { setBusy(false) }
  }
  async function advance() {
    if (!next) return
    await updateOrderStatus(order.id, { status: next })
    toast(`الطلب بقى: ${STATUS[next].label}`)
  }
  async function cancel() {
    if (!window.confirm('تأكيد إلغاء الطلب؟')) return
    await updateOrderStatus(order.id, { status: 'cancelled' })
    toast('اتلغى الطلب')
  }

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-cocoa">{order.order_no} <span className={cn('chip mr-1', STATUS[order.status].cls)}>{STATUS[order.status].label}</span></p>
          <p className="text-[11px] text-cocoa-light">{fmtDateTime(order.created_at)}</p>
        </div>
        <div className="text-left">
          <p className="font-bold text-rose">{money(order.total)}</p>
          <p className="text-[11px] text-cocoa-light">{order.payment === 'instapay' ? 'إنستاباي' : 'عند الاستلام'} {order.paid ? '· مدفوع' : ''}</p>
        </div>
      </div>

      <div className="mt-2 rounded-2xl bg-blush/40 p-3">
        <div className="flex items-center gap-3 text-sm flex-wrap">
          <span className="font-bold text-cocoa">{order.customer_name}</span>
          <a href={`tel:${order.customer_phone}`} className="text-cocoa-light flex items-center gap-1" dir="ltr"><Phone size={13} /> {order.customer_phone}</a>
        </div>
        {order.address && <p className="text-xs text-cocoa-light mt-1">📍 {order.address}</p>}
        {order.note && <p className="text-xs text-cocoa-light mt-1">📝 {order.note}</p>}
      </div>

      <ul className="mt-2 text-sm divide-y divide-pink/30">
        {items.map((it) => (
          <li key={it.id} className="flex justify-between py-1.5"><span className="text-cocoa">{it.product_name} × {num(it.qty)}</span><span className="text-cocoa-light">{money(it.unit_price * it.qty)}</span></li>
        ))}
      </ul>
      <div className="text-xs text-cocoa-light mt-1">
        الشحن: {order.shipping > 0 ? money(order.shipping) : 'مجاني'}
        {order.discount > 0 ? ` · خصم عروض: ${money(order.discount)}` : ''}
        {order.coupon_code ? ` · كوبون ${order.coupon_code}: ${money(order.coupon_discount)}` : ''}
        {order.points_used > 0 ? ` · نقاط مستخدمة: ${num(order.points_used)}` : ''}
      </div>

      <OrderSteps status={order.status} />

      <div className="flex flex-wrap gap-2 mt-3">
        {!order.sale_id && order.status !== 'cancelled' && (
          <button onClick={convert} disabled={busy} className="btn-primary text-sm py-2"><CheckCircle2 size={16} /> تأكيد وتحويل لفاتورة</button>
        )}
        {next && <button onClick={advance} className="btn-ghost text-sm py-2"><Truck size={15} /> {STATUS[next].label} ›</button>}
        <a href={waCustomer(order, storeName)} target="_blank" rel="noreferrer" className="btn-ghost text-sm py-2 text-ok border-ok/30"><MessageCircle size={15} /> بلّغ واتساب</a>
        {order.status !== 'cancelled' && order.status !== 'delivered' && (
          <button onClick={cancel} className="btn-ghost text-sm py-2 text-danger border-danger/30"><X size={16} /> إلغاء</button>
        )}
      </div>
      {order.sale_id && <p className="text-[11px] text-ok mt-2 font-semibold">✓ اتحوّل لفاتورة بيع</p>}
    </div>
  )
}
