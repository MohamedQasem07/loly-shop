import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ImageOff, Minus, Plus, Search, ShoppingBag, ShoppingCart, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { uuid } from '@/lib/ids'
import { cn } from '@/lib/cn'
import { LOGO_URL } from '@/lib/assets'

interface SP { id: string; name: string; category_id: string | null; image_url: string | null; color: string | null; price: number; stock_qty: number }
interface SC { id: string; name: string; name_ar: string | null; sort_order: number }
interface SD { id: string; type: string; value: number; scope: string; category_id: string | null; product_id: string | null }
interface SInfo { store_name: string; logo_url: string | null; store_phone: string | null; store_whatsapp: string | null; currency: string; shipping_fee: number; store_open: boolean; receipt_footer: string | null }

const egp = (n: number) => `${(n || 0).toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ج.م`

export default function Store() {
  const [info, setInfo] = useState<SInfo | null>(null)
  const [products, setProducts] = useState<SP[]>([])
  const [cats, setCats] = useState<SC[]>([])
  const [discounts, setDiscounts] = useState<SD[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [view, setView] = useState<'shop' | 'checkout' | 'done'>('shop')
  const [doneNo, setDoneNo] = useState('')

  useEffect(() => {
    ;(async () => {
      const [pi, pp, pc, pd] = await Promise.all([
        supabase.from('store_info').select('*').maybeSingle(),
        supabase.from('store_products').select('*'),
        supabase.from('store_categories').select('*'),
        supabase.from('store_discounts').select('*'),
      ])
      setInfo((pi.data as SInfo) ?? null)
      setProducts(((pp.data as SP[]) ?? []).map((p) => ({ ...p, price: Number(p.price), stock_qty: Number(p.stock_qty) })))
      setCats((pc.data as SC[]) ?? [])
      setDiscounts(((pd.data as SD[]) ?? []).map((d) => ({ ...d, value: Number(d.value) })))
      setLoading(false)
    })()
  }, [])

  const priceOf = useMemo(() => {
    return (p: SP) => {
      let best = p.price
      for (const d of discounts) {
        const applies = d.scope === 'all' || (d.scope === 'category' && d.category_id === p.category_id) || (d.scope === 'product' && d.product_id === p.id)
        if (!applies) continue
        const np = d.type === 'percent' ? p.price * (1 - d.value / 100) : p.price - d.value
        if (np < best) best = np
      }
      return Math.max(0, +best.toFixed(2))
    }
  }, [discounts])

  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return products
      .filter((p) => (cat === 'all' ? true : p.category_id === cat))
      .filter((p) => (!term ? true : p.name.toLowerCase().includes(term)))
  }, [products, q, cat])

  const cartLines = useMemo(
    () => Object.entries(cart).map(([id, qty]) => ({ p: products.find((x) => x.id === id)!, qty })).filter((l) => l.p),
    [cart, products],
  )
  const subtotalFull = cartLines.reduce((s, l) => s + l.p.price * l.qty, 0)
  const subtotalDisc = cartLines.reduce((s, l) => s + priceOf(l.p) * l.qty, 0)
  const discountTotal = +(subtotalFull - subtotalDisc).toFixed(2)
  const shipping = info?.shipping_fee ?? 0
  const count = cartLines.reduce((s, l) => s + l.qty, 0)
  const total = +(subtotalDisc + shipping).toFixed(2)

  const add = (id: string) => setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }))
  const dec = (id: string) => setCart((c) => { const n = (c[id] ?? 0) - 1; const x = { ...c }; if (n <= 0) delete x[id]; else x[id] = n; return x })

  if (loading) return <div className="min-h-screen grid place-items-center bg-cream"><img src={LOGO_URL} className="w-16 h-16 rounded-2xl animate-pulse" /></div>

  if (info && !info.store_open) {
    return (
      <div className="min-h-screen grid place-items-center bg-cream p-6 text-center">
        <div>
          <img src={info.logo_url || LOGO_URL} className="w-24 h-24 rounded-3xl mx-auto object-cover shadow-soft" />
          <h1 className="font-display text-2xl font-extrabold text-rose mt-4">{info.store_name}</h1>
          <p className="text-cocoa-light mt-2">المتجر مغلق حالياً 🌙 — تابعنا قريباً</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="bg-gradient-to-l from-rose to-rose-dark text-white sticky top-0 z-20 shadow-soft">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <img src={info?.logo_url || LOGO_URL} className="w-11 h-11 rounded-2xl object-cover bg-white/20" />
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-extrabold text-lg leading-tight">{info?.store_name ?? 'Loly Store'}</h1>
            <p className="text-[11px] opacity-90">تسوّقي أونلاين 🌸</p>
          </div>
          {view !== 'shop' && (
            <button onClick={() => setView('shop')} className="bg-white/20 rounded-full px-3 py-1.5 text-sm font-bold">المتجر</button>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 pb-28">
        {view === 'shop' && (
          <>
            <div className="relative mb-3">
              <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-cocoa-light" />
              <input className="input pr-10" placeholder="ابحثي عن منتج…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
              <Chip active={cat === 'all'} onClick={() => setCat('all')}>الكل</Chip>
              {cats.slice().sort((a, b) => a.sort_order - b.sort_order).map((c) => (
                <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.name_ar ?? c.name}</Chip>
              ))}
            </div>
            {list.length === 0 ? (
              <div className="card"><div className="py-16 text-center text-cocoa-light"><ShoppingBag className="mx-auto mb-2 text-rose/50" size={40} /><p className="font-semibold">مفيش منتجات متاحة دلوقتي</p></div></div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {list.map((p) => {
                  const dp = priceOf(p)
                  const hasDisc = dp < p.price
                  const out = p.stock_qty <= 0
                  return (
                    <div key={p.id} className="card p-2.5 flex flex-col">
                      <div className="aspect-square rounded-2xl bg-blush mb-2 overflow-hidden grid place-items-center text-rose/40 relative">
                        {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <ImageOff size={28} />}
                        {hasDisc && <span className="absolute top-1 right-1 bg-rose text-white text-[10px] font-bold rounded-full px-2 py-0.5">خصم</span>}
                      </div>
                      <p className="font-bold text-sm text-cocoa leading-tight line-clamp-2 min-h-[2.5rem]">{p.name}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="font-bold text-rose">{egp(dp)}</span>
                        {hasDisc && <span className="text-[11px] text-cocoa-light line-through">{egp(p.price)}</span>}
                      </div>
                      <button onClick={() => add(p.id)} disabled={out} className={cn('btn-primary w-full mt-2 py-2 text-sm', out && 'opacity-50')}>
                        {out ? 'نفد' : cart[p.id] ? `في السلة (${cart[p.id]})` : 'أضف للسلة'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {view === 'checkout' && (
          <Checkout
            lines={cartLines.map((l) => ({ ...l, unit: priceOf(l.p) }))}
            add={add} dec={dec}
            subtotal={subtotalDisc} discount={discountTotal} shipping={shipping} total={total}
            info={info}
            onBack={() => setView('shop')}
            onPlaced={(no) => { setDoneNo(no); setCart({}); setView('done') }}
          />
        )}

        {view === 'done' && (
          <div className="card p-8 text-center mt-6">
            <div className="w-20 h-20 rounded-full bg-ok/15 text-ok grid place-items-center mx-auto mb-3"><CheckCircle2 size={44} /></div>
            <h2 className="font-display text-2xl font-extrabold text-cocoa">تم استلام طلبك 🌸</h2>
            <p className="text-cocoa-light mt-2">رقم الطلب: <span className="font-bold text-rose">{doneNo}</span></p>
            <p className="text-sm text-cocoa-light mt-1">هنتواصل معاكي لتأكيد الطلب والتوصيل.</p>
            {info?.store_whatsapp && (
              <a href={`https://wa.me/${info.store_whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="btn-ghost mt-5 inline-flex">تواصل واتساب</a>
            )}
            <button onClick={() => setView('shop')} className="btn-primary w-full mt-3">تسوّقي تاني</button>
          </div>
        )}
      </main>

      {/* Floating cart */}
      {view === 'shop' && count > 0 && (
        <button onClick={() => setView('checkout')} className="fixed bottom-4 inset-x-4 max-w-3xl mx-auto z-30 btn-primary py-3.5 justify-between shadow-soft">
          <span className="flex items-center gap-2"><ShoppingCart size={18} /> {count} منتج</span>
          <span>{egp(total)} · إتمام الطلب</span>
        </button>
      )}
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={cn('shrink-0 rounded-full px-4 py-1.5 text-sm font-bold border transition', active ? 'bg-rose text-white border-rose' : 'bg-white text-cocoa-light border-pink')}>{children}</button>
}

function Checkout({ lines, add, dec, subtotal, discount, shipping, total, info, onBack, onPlaced }: {
  lines: { p: SP; qty: number; unit: number }[]
  add: (id: string) => void
  dec: (id: string) => void
  subtotal: number; discount: number; shipping: number; total: number
  info: SInfo | null
  onBack: () => void
  onPlaced: (orderNo: string) => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [payment, setPayment] = useState<'cod' | 'instapay'>('cod')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  if (lines.length === 0) {
    return (
      <div className="card p-10 text-center mt-6">
        <ShoppingCart className="mx-auto text-rose/40 mb-2" size={40} />
        <p className="font-bold text-cocoa">السلة فاضية</p>
        <button onClick={onBack} className="btn-primary mt-4">تسوّقي دلوقتي</button>
      </div>
    )
  }

  async function place() {
    if (!name.trim() || !phone.trim()) { setErr('اكتبي الاسم ورقم الموبايل'); return }
    if (!address.trim()) { setErr('اكتبي عنوان التوصيل'); return }
    setBusy(true); setErr('')
    try {
      const orderId = uuid()
      const orderNo = 'ORD-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 90 + 10)
      const { error: e1 } = await supabase.from('orders').insert({
        id: orderId, order_no: orderNo, customer_name: name.trim(), customer_phone: phone.trim(), address: address.trim(),
        status: 'new', payment, paid: false, subtotal, discount, shipping, total, note: note || null,
      })
      if (e1) throw e1
      const { error: e2 } = await supabase.from('order_items').insert(
        lines.map((l) => ({ id: uuid(), order_id: orderId, product_id: l.p.id, product_name: l.p.name, qty: l.qty, unit_price: l.unit, line_total: +(l.unit * l.qty).toFixed(2) })),
      )
      if (e2) throw e2
      onPlaced(orderNo)
    } catch {
      setErr('حصل خطأ، حاولي تاني')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 mt-2">
      <h2 className="font-display text-xl font-extrabold text-cocoa">إتمام الطلب</h2>
      <div className="card p-3 space-y-2">
        {lines.map((l) => (
          <div key={l.p.id} className="flex items-center gap-2">
            <div className="flex-1 min-w-0"><p className="font-bold text-sm text-cocoa truncate">{l.p.name}</p><p className="text-xs text-cocoa-light">{egp(l.unit)} × {l.qty}</p></div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => dec(l.p.id)} className="w-7 h-7 rounded-full bg-blush grid place-items-center text-rose"><Minus size={14} /></button>
              <span className="w-6 text-center font-bold text-sm">{l.qty}</span>
              <button onClick={() => add(l.p.id)} className="w-7 h-7 rounded-full bg-blush grid place-items-center text-rose"><Plus size={14} /></button>
            </div>
            <span className="font-bold text-rose text-sm w-20 text-left">{egp(l.unit * l.qty)}</span>
          </div>
        ))}
      </div>

      <div className="card p-4 space-y-3">
        <label className="block"><span className="label">الاسم</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="block"><span className="label">رقم الموبايل</span><input className="input" dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        <label className="block"><span className="label">عنوان التوصيل</span><textarea className="input min-h-[70px]" value={address} onChange={(e) => setAddress(e.target.value)} /></label>
        <div>
          <span className="label">طريقة الدفع</span>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setPayment('cod')} className={cn('rounded-2xl border-2 p-3 text-sm font-bold', payment === 'cod' ? 'border-rose bg-rose/5 text-rose' : 'border-pink text-cocoa-light')}>دفع عند الاستلام</button>
            <button type="button" onClick={() => setPayment('instapay')} className={cn('rounded-2xl border-2 p-3 text-sm font-bold', payment === 'instapay' ? 'border-rose bg-rose/5 text-rose' : 'border-pink text-cocoa-light')}>تحويل إنستاباي</button>
          </div>
          {payment === 'instapay' && info?.store_phone && <p className="text-xs text-cocoa-light mt-2">حوّلي على: <span className="font-bold" dir="ltr">{info.store_phone}</span> وابعتي الإيصال واتساب.</p>}
        </div>
        <label className="block"><span className="label">ملاحظة (اختياري)</span><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></label>
      </div>

      <div className="card p-4 space-y-1.5 text-sm">
        <Row label="الإجمالي الفرعي" value={egp(subtotal)} />
        {discount > 0 && <Row label="الخصم" value={`- ${egp(discount)}`} />}
        <Row label="الشحن" value={shipping > 0 ? egp(shipping) : 'مجاني'} />
        <div className="border-t border-pink/40 pt-2 flex justify-between text-lg"><span className="font-bold text-cocoa">الإجمالي</span><span className="font-extrabold text-rose">{egp(total)}</span></div>
      </div>

      {err && <p className="text-danger text-sm font-semibold text-center bg-danger/10 rounded-xl py-2">{err}</p>}
      <button onClick={place} disabled={busy} className="btn-primary w-full py-3.5">{busy ? 'جاري الإرسال…' : `تأكيد الطلب (${egp(total)})`}</button>
      <button onClick={onBack} className="btn-ghost w-full">رجوع للمتجر</button>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-cocoa-light">{label}</span><span className="text-cocoa font-semibold">{value}</span></div>
}
