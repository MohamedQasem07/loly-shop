import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight, Banknote, CheckCircle2, ChevronDown, ImageOff, Lock, Minus, Plus,
  RefreshCcw, Search, Share2, ShieldCheck, ShoppingBag, ShoppingCart, Smartphone,
  Sparkles, Truck, MessageCircle, Tag,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { uuid } from '@/lib/ids'
import { cn } from '@/lib/cn'
import { LOGO_URL } from '@/lib/assets'
import { toast } from '@/store/ui'

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
  const [view, setView] = useState<'shop' | 'product' | 'checkout' | 'done'>('shop')
  const [selectedId, setSelectedId] = useState<string | null>(null)
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

  // scroll to top when navigating between store views / products
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }) }, [view, selectedId])

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

  const catName = (id: string | null) => {
    const c = cats.find((x) => x.id === id)
    return c ? (c.name_ar ?? c.name) : null
  }

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

  const add = (id: string, n = 1, silent = false) => {
    setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + n }))
    if (!silent) toast('تمت الإضافة للسلة 🛍️')
  }
  const dec = (id: string) => setCart((c) => { const n = (c[id] ?? 0) - 1; const x = { ...c }; if (n <= 0) delete x[id]; else x[id] = n; return x })
  const removeLine = (id: string) => setCart((c) => { const x = { ...c }; delete x[id]; return x })

  const openProduct = (id: string) => { setSelectedId(id); setView('product') }
  const buyNow = (id: string, n = 1) => { setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + n })); setView('checkout') }

  const selected = products.find((p) => p.id === selectedId) ?? null

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
      <header className="bg-gradient-to-l from-rose to-rose-dark text-white sticky top-0 z-30 shadow-soft">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => setView('shop')} className="flex items-center gap-3 min-w-0">
            <img src={info?.logo_url || LOGO_URL} className="w-11 h-11 rounded-2xl object-cover bg-white/20 shrink-0" />
            <div className="text-right min-w-0">
              <h1 className="font-display font-extrabold text-lg leading-tight truncate">{info?.store_name ?? 'Loly Store'}</h1>
              <p className="text-[11px] opacity-90">تسوّقي أونلاين 🌸</p>
            </div>
          </button>
          <div className="flex-1" />
          {(view === 'product' || view === 'checkout') && (
            <button onClick={() => setView('shop')} className="hidden sm:inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 rounded-full px-3 py-2 text-sm font-bold transition">
              <ArrowRight size={16} /> المتجر
            </button>
          )}
          <button onClick={() => setView('checkout')} className="relative bg-white/15 hover:bg-white/25 rounded-full p-2.5 transition" aria-label="السلة">
            <ShoppingCart size={20} />
            {count > 0 && <span className="absolute -top-1 -left-1 bg-white text-rose text-[11px] font-extrabold rounded-full min-w-[18px] h-[18px] px-1 grid place-items-center shadow">{count}</span>}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-5 pb-28">
        {view === 'shop' && (
          <Catalog
            info={info} products={list} allCount={products.length} cats={cats}
            q={q} setQ={setQ} cat={cat} setCat={setCat}
            priceOf={priceOf} onOpen={openProduct} onAdd={(id) => add(id)} cart={cart}
          />
        )}

        {view === 'product' && selected && (
          <ProductDetail
            key={selected.id} p={selected} info={info} catName={catName(selected.category_id)}
            unit={priceOf(selected)} inCart={cart[selected.id] ?? 0}
            related={products.filter((x) => x.id !== selected.id).sort((a, b) => (b.category_id === selected.category_id ? 1 : 0) - (a.category_id === selected.category_id ? 1 : 0)).slice(0, 8)}
            priceOf={priceOf}
            onAdd={add} onBuy={buyNow} onOpen={openProduct} onBack={() => setView('shop')}
          />
        )}

        {view === 'checkout' && (
          <Checkout
            lines={cartLines.map((l) => ({ ...l, unit: priceOf(l.p) }))}
            add={(id) => add(id, 1, true)} dec={dec} remove={removeLine}
            subtotal={subtotalDisc} discount={discountTotal} shipping={shipping} total={total}
            info={info}
            onBack={() => setView('shop')}
            onPlaced={(no) => { setDoneNo(no); setCart({}); setView('done') }}
          />
        )}

        {view === 'done' && (
          <div className="card p-8 text-center mt-6 max-w-lg mx-auto animate-pop">
            <div className="w-20 h-20 rounded-full bg-ok/15 text-ok grid place-items-center mx-auto mb-3"><CheckCircle2 size={44} /></div>
            <h2 className="font-display text-2xl font-extrabold text-cocoa">تم استلام طلبك 🌸</h2>
            <p className="text-cocoa-light mt-2">رقم الطلب: <span className="font-bold text-rose">{doneNo}</span></p>
            <p className="text-sm text-cocoa-light mt-1">هنتواصل معاكي لتأكيد الطلب والتوصيل.</p>
            {info?.store_whatsapp && (
              <a href={`https://wa.me/${info.store_whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="btn-ghost mt-5 inline-flex"><MessageCircle size={18} /> تواصل واتساب</a>
            )}
            <button onClick={() => setView('shop')} className="btn-primary w-full mt-3">تسوّقي تاني</button>
          </div>
        )}
      </main>

      {/* Floating cart (mobile) */}
      {(view === 'shop' || view === 'product') && count > 0 && (
        <button onClick={() => setView('checkout')} className="sm:hidden fixed bottom-4 inset-x-4 z-40 btn-primary py-3.5 justify-between shadow-lift">
          <span className="flex items-center gap-2"><ShoppingCart size={18} /> {count} منتج</span>
          <span>{egp(total)} · إتمام الطلب</span>
        </button>
      )}
    </div>
  )
}

/* ───────────────────────── Catalog ───────────────────────── */

function Catalog({ info, products, allCount, cats, q, setQ, cat, setCat, priceOf, onOpen, onAdd, cart }: {
  info: SInfo | null
  products: SP[]; allCount: number; cats: SC[]
  q: string; setQ: (v: string) => void; cat: string; setCat: (v: string) => void
  priceOf: (p: SP) => number; onOpen: (id: string) => void; onAdd: (id: string) => void; cart: Record<string, number>
}) {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-rose-grad text-white p-6 sm:p-9 mb-5 shadow-soft">
        <div className="absolute -top-10 -left-10 w-44 h-44 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-12 right-10 w-52 h-52 rounded-full bg-white/10 blur-2xl" />
        <div className="relative max-w-xl">
          <span className="inline-flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1 text-xs font-bold"><Sparkles size={14} /> {info?.store_name ?? 'Loly Store'}</span>
          <h2 className="font-display text-2xl sm:text-4xl font-extrabold mt-3 leading-tight">إكسسوارات تكمّل أناقتك ✨</h2>
          <p className="opacity-90 mt-2 text-sm sm:text-base">تشكيلة مختارة من أحلى الإكسسوارات — اطلبي أونلاين والدفع عند الاستلام.</p>
          <div className="flex flex-wrap gap-2 mt-4">
            <HeroPill icon={Truck} text="شحن لكل المحافظات" />
            <HeroPill icon={Banknote} text="الدفع عند الاستلام" />
            <HeroPill icon={RefreshCcw} text="استبدال خلال ١٤ يوم" />
          </div>
        </div>
      </section>

      {/* Search */}
      <div className="relative mb-3">
        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-cocoa-light" />
        <input className="input pr-10" placeholder="ابحثي عن منتج…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
        <Chip active={cat === 'all'} onClick={() => setCat('all')}>الكل</Chip>
        {cats.slice().sort((a, b) => a.sort_order - b.sort_order).map((c) => (
          <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.name_ar ?? c.name}</Chip>
        ))}
      </div>

      {allCount === 0 || products.length === 0 ? (
        <div className="card"><div className="py-20 text-center text-cocoa-light"><ShoppingBag className="mx-auto mb-2 text-rose/50" size={44} /><p className="font-semibold">مفيش منتجات متاحة دلوقتي</p><p className="text-sm mt-1">تابعينا، هنضيف تشكيلة جديدة قريب 🌸</p></div></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {products.map((p) => (
            <ProductCard key={p.id} p={p} unit={priceOf(p)} inCart={cart[p.id] ?? 0} onOpen={() => onOpen(p.id)} onAdd={() => onAdd(p.id)} />
          ))}
        </div>
      )}
    </>
  )
}

function ProductCard({ p, unit, inCart, onOpen, onAdd }: { p: SP; unit: number; inCart: number; onOpen: () => void; onAdd: () => void }) {
  const hasDisc = unit < p.price
  const off = hasDisc ? Math.round((1 - unit / p.price) * 100) : 0
  const out = p.stock_qty <= 0
  return (
    <div onClick={onOpen} className="card p-2.5 sm:p-3 flex flex-col text-right cursor-pointer group hover:shadow-lift hover:-translate-y-1 transition-all">
      <div className="aspect-square rounded-2xl bg-blush mb-2.5 overflow-hidden grid place-items-center text-rose/40 relative">
        {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" /> : <ImageOff size={30} />}
        {hasDisc && <span className="absolute top-2 right-2 bg-rose text-white text-[10px] font-extrabold rounded-full px-2 py-0.5 shadow">-{off}%</span>}
        {out && <span className="absolute inset-0 bg-white/55 grid place-items-center text-cocoa font-bold text-sm">نفد المخزون</span>}
      </div>
      <p className="font-bold text-sm text-cocoa leading-tight line-clamp-2 min-h-[2.5rem]">{p.name}</p>
      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
        <span className="font-extrabold text-rose">{egp(unit)}</span>
        {hasDisc && <span className="text-[11px] text-cocoa-light line-through">{egp(p.price)}</span>}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onAdd() }}
        disabled={out}
        className={cn('btn-primary w-full mt-2.5 py-2 text-sm', out && 'opacity-50')}
      >
        {out ? 'غير متاح' : inCart ? `في السلة (${inCart})` : 'أضف للسلة'}
      </button>
    </div>
  )
}

/* ───────────────────────── Product detail ───────────────────────── */

function ProductDetail({ p, info, catName, unit, inCart, related, priceOf, onAdd, onBuy, onOpen, onBack }: {
  p: SP; info: SInfo | null; catName: string | null
  unit: number; inCart: number
  related: SP[]; priceOf: (p: SP) => number
  onAdd: (id: string, n: number) => void; onBuy: (id: string, n: number) => void
  onOpen: (id: string) => void; onBack: () => void
}) {
  const [qty, setQty] = useState(1)
  const hasDisc = unit < p.price
  const off = hasDisc ? Math.round((1 - unit / p.price) * 100) : 0
  const out = p.stock_qty <= 0
  const low = !out && p.stock_qty <= 3

  const desc = `${p.name} من ${info?.store_name ?? 'Loly Store'}${catName ? ` — ${catName}` : ''} بتصميم أنيق${p.color ? ` بلون ${p.color}` : ''}. خامة عالية الجودة ولمسة ناعمة تناسب كل المناسبات، واختيار مثالي كهدية مميزة. متوفر شحن سريع لكل المحافظات مع إمكانية الدفع عند الاستلام.`

  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: p.name, url })
      else { await navigator.clipboard.writeText(url); toast('تم نسخ رابط المتجر 🔗') }
    } catch { /* user cancelled */ }
  }

  return (
    <div className="animate-fadeIn">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-cocoa-light hover:text-rose font-bold text-sm mb-4 transition">
        <ArrowRight size={16} /> رجوع للمتجر
      </button>

      <div className="grid lg:grid-cols-2 gap-6 lg:gap-10">
        {/* Gallery */}
        <div className="lg:sticky lg:top-24 self-start">
          <div className="card p-3">
            <div className="aspect-square rounded-2xl bg-blush overflow-hidden grid place-items-center text-rose/40 relative">
              {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <ImageOff size={56} />}
              {hasDisc && <span className="absolute top-3 right-3 bg-rose text-white text-xs font-extrabold rounded-full px-3 py-1 shadow">خصم {off}%</span>}
              <button onClick={share} className="absolute top-3 left-3 bg-white/90 hover:bg-white text-cocoa rounded-full p-2 shadow transition" aria-label="مشاركة"><Share2 size={16} /></button>
            </div>
          </div>
        </div>

        {/* Info */}
        <div>
          {catName && <span className="chip bg-blush text-rose"><Tag size={12} /> {catName}</span>}
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-cocoa mt-2 leading-tight">{p.name}</h1>

          <div className="flex items-end gap-3 mt-4">
            <span className="font-extrabold text-rose text-3xl">{egp(unit)}</span>
            {hasDisc && <span className="text-cocoa-light line-through text-lg mb-1">{egp(p.price)}</span>}
            {hasDisc && <span className="chip bg-ok/15 text-ok mb-1.5">وفّرتي {off}%</span>}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            {out ? <span className="chip bg-danger/10 text-danger">نفد المخزون</span>
              : low ? <span className="chip bg-warn/15 text-warn">باقي {p.stock_qty} قطع بس!</span>
                : <span className="chip bg-ok/15 text-ok"><CheckCircle2 size={12} /> متوفر</span>}
            {p.color && (
              <span className="inline-flex items-center gap-1.5 text-sm text-cocoa-light">
                <span className="w-4 h-4 rounded-full border border-pink shadow-sm" style={{ background: cssColor(p.color) }} />
                اللون: <span className="font-semibold text-cocoa">{p.color}</span>
              </span>
            )}
          </div>

          {/* Quantity + actions */}
          <div className="flex items-center gap-3 mt-5">
            <span className="label mb-0">الكمية</span>
            <div className="inline-flex items-center gap-1 bg-white border border-pink rounded-full p-1">
              <button onClick={() => setQty((n) => Math.max(1, n - 1))} className="w-8 h-8 rounded-full bg-blush grid place-items-center text-rose disabled:opacity-40" disabled={qty <= 1}><Minus size={15} /></button>
              <span className="w-9 text-center font-extrabold">{qty}</span>
              <button onClick={() => setQty((n) => n + 1)} className="w-8 h-8 rounded-full bg-blush grid place-items-center text-rose"><Plus size={15} /></button>
            </div>
            {inCart > 0 && <span className="text-xs text-cocoa-light">({inCart} في السلة)</span>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <button onClick={() => onAdd(p.id, qty)} disabled={out} className={cn('btn-ghost py-3.5 text-base border-2 border-rose text-rose hover:bg-rose/5', out && 'opacity-50')}>
              <ShoppingCart size={18} /> أضف إلى السلة
            </button>
            <button onClick={() => onBuy(p.id, qty)} disabled={out} className={cn('btn-primary py-3.5 text-base', out && 'opacity-50')}>
              اشتري الآن
            </button>
          </div>

          {info?.store_whatsapp && (
            <a href={`https://wa.me/${info.store_whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent('عايزة أستفسر عن: ' + p.name)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-bold text-cocoa-light hover:text-rose mt-4 transition">
              <MessageCircle size={16} /> عندك استفسار؟ اسألينا واتساب
            </a>
          )}

          {/* Trust */}
          <div className="grid grid-cols-3 gap-2 mt-6">
            <Trust icon={ShieldCheck} text="منتجات أصلية" />
            <Trust icon={RefreshCcw} text="استبدال سهل" />
            <Trust icon={Truck} text="شحن سريع" />
          </div>

          {/* Accordion */}
          <div className="mt-6 space-y-2.5">
            <Accordion title="الوصف" defaultOpen>{desc}</Accordion>
            <Accordion title="الشحن والتوصيل">بنشحن لكل محافظات مصر، والتوصيل عادةً خلال ٢-٥ أيام عمل. مصاريف الشحن بتتحسب عند إتمام الطلب{info && info.shipping_fee > 0 ? ` (${egp(info.shipping_fee)})` : ''}.</Accordion>
            <Accordion title="الاستبدال والاسترجاع">يمكنك الاستبدال أو الاسترجاع خلال ١٤ يوم من الاستلام، بشرط أن يكون المنتج بحالته الأصلية وبكامل ملحقاته.</Accordion>
            <Accordion title="طريقة الطلب">أضيفي المنتجات للسلة ← اضغطي «إتمام الطلب» ← أدخلي بياناتك. هنتواصل معاكي لتأكيد الطلب والتوصيل، والدفع عند الاستلام أو تحويل إنستاباي.</Accordion>
          </div>

          {/* Payment */}
          <div className="card p-4 mt-5">
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-cocoa text-sm">الدفع والأمان</span>
              <span className="inline-flex items-center gap-1 text-[11px] text-cocoa-light"><Lock size={12} /> طلب آمن</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <PayChip icon={Banknote} text="الدفع عند الاستلام" />
              <PayChip icon={Smartphone} text="إنستاباي" />
            </div>
          </div>
        </div>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-12">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={18} className="text-rose" />
            <h3 className="font-display text-xl font-extrabold text-cocoa">منتجات قد تعجبك</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {related.map((r) => (
              <ProductCard key={r.id} p={r} unit={priceOf(r)} inCart={0} onOpen={() => onOpen(r.id)} onAdd={() => onAdd(r.id, 1)} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function Accordion({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3.5 text-right">
        <span className="font-bold text-cocoa">{title}</span>
        <ChevronDown size={18} className={cn('text-rose transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="px-4 pb-4 -mt-1 text-sm text-cocoa-light leading-relaxed">{children}</div>}
    </div>
  )
}

/* ───────────────────────── Checkout ───────────────────────── */

function Checkout({ lines, add, dec, remove, subtotal, discount, shipping, total, info, onBack, onPlaced }: {
  lines: { p: SP; qty: number; unit: number }[]
  add: (id: string) => void
  dec: (id: string) => void
  remove: (id: string) => void
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
      <div className="card p-12 text-center mt-6 max-w-lg mx-auto">
        <div className="w-20 h-20 rounded-full bg-blush grid place-items-center mx-auto mb-3"><ShoppingCart className="text-rose/50" size={40} /></div>
        <p className="font-bold text-cocoa text-lg">السلة فاضية</p>
        <p className="text-sm text-cocoa-light mt-1">ابدئي التسوّق وأضيفي منتجاتك المفضلة 🌸</p>
        <button onClick={onBack} className="btn-primary mt-5">تسوّقي دلوقتي</button>
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
    <div className="mt-2">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-cocoa-light hover:text-rose font-bold text-sm mb-4 transition">
        <ArrowRight size={16} /> مواصلة التسوّق
      </button>
      <h2 className="font-display text-2xl font-extrabold text-cocoa mb-4">إتمام الطلب</h2>

      <div className="grid lg:grid-cols-[1fr_360px] gap-5 items-start">
        {/* Left: items + form */}
        <div className="space-y-4">
          <div className="card p-3 sm:p-4 divide-y divide-pink/30">
            {lines.map((l) => (
              <div key={l.p.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="w-16 h-16 rounded-2xl bg-blush overflow-hidden grid place-items-center text-rose/40 shrink-0">
                  {l.p.image_url ? <img src={l.p.image_url} alt="" className="w-full h-full object-cover" /> : <ImageOff size={22} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-cocoa truncate">{l.p.name}</p>
                  <p className="text-xs text-cocoa-light mt-0.5">{egp(l.unit)} للقطعة</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <button onClick={() => dec(l.p.id)} className="w-7 h-7 rounded-full bg-blush grid place-items-center text-rose"><Minus size={13} /></button>
                    <span className="w-6 text-center font-bold text-sm">{l.qty}</span>
                    <button onClick={() => add(l.p.id)} className="w-7 h-7 rounded-full bg-blush grid place-items-center text-rose"><Plus size={13} /></button>
                    <button onClick={() => remove(l.p.id)} className="mr-1 text-cocoa-light hover:text-danger transition px-1 text-xs font-bold" aria-label="حذف">إزالة</button>
                  </div>
                </div>
                <span className="font-extrabold text-rose text-sm w-20 text-left shrink-0">{egp(l.unit * l.qty)}</span>
              </div>
            ))}
          </div>

          <div className="card p-4 space-y-3">
            <h3 className="font-bold text-cocoa">بيانات التوصيل</h3>
            <label className="block"><span className="label">الاسم</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="اسمك بالكامل" /></label>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block"><span className="label">رقم الموبايل</span><input className="input" dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" /></label>
              <label className="block"><span className="label">ملاحظة (اختياري)</span><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="أي تفاصيل إضافية" /></label>
            </div>
            <label className="block"><span className="label">عنوان التوصيل</span><textarea className="input min-h-[70px]" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="المحافظة، المدينة، الشارع، رقم العقار…" /></label>
            <div>
              <span className="label">طريقة الدفع</span>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setPayment('cod')} className={cn('rounded-2xl border-2 p-3 text-sm font-bold flex items-center justify-center gap-2 transition', payment === 'cod' ? 'border-rose bg-rose/5 text-rose' : 'border-pink text-cocoa-light')}><Banknote size={18} /> عند الاستلام</button>
                <button type="button" onClick={() => setPayment('instapay')} className={cn('rounded-2xl border-2 p-3 text-sm font-bold flex items-center justify-center gap-2 transition', payment === 'instapay' ? 'border-rose bg-rose/5 text-rose' : 'border-pink text-cocoa-light')}><Smartphone size={18} /> إنستاباي</button>
              </div>
              {payment === 'instapay' && info?.store_phone && <p className="text-xs text-cocoa-light mt-2">حوّلي على: <span className="font-bold" dir="ltr">{info.store_phone}</span> وابعتي الإيصال واتساب.</p>}
            </div>
          </div>
        </div>

        {/* Right: summary (sticky on desktop) */}
        <div className="lg:sticky lg:top-24 space-y-3">
          <div className="card p-4 space-y-2 text-sm">
            <h3 className="font-bold text-cocoa mb-1">ملخص الطلب</h3>
            <Row label="الإجمالي الفرعي" value={egp(subtotal)} />
            {discount > 0 && <Row label="الخصم" value={`- ${egp(discount)}`} />}
            <Row label="الشحن" value={shipping > 0 ? egp(shipping) : 'مجاني'} />
            <div className="border-t border-pink/40 pt-2.5 mt-1 flex justify-between text-lg"><span className="font-bold text-cocoa">الإجمالي</span><span className="font-extrabold text-rose">{egp(total)}</span></div>
            {err && <p className="text-danger text-sm font-semibold text-center bg-danger/10 rounded-xl py-2 mt-1">{err}</p>}
            <button onClick={place} disabled={busy} className="btn-primary w-full py-3.5 mt-1">{busy ? 'جاري الإرسال…' : 'تأكيد الطلب'}</button>
            <p className="text-[11px] text-cocoa-light text-center flex items-center justify-center gap-1"><Lock size={11} /> بياناتك آمنة ولن تُستخدم إلا للتوصيل</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ───────────────────────── small UI bits ───────────────────────── */

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={cn('shrink-0 rounded-full px-4 py-1.5 text-sm font-bold border transition', active ? 'bg-rose text-white border-rose shadow-soft' : 'bg-white text-cocoa-light border-pink hover:border-rose/40')}>{children}</button>
}

function HeroPill({ icon: Icon, text }: { icon: typeof Truck; text: string }) {
  return <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur rounded-full px-3 py-1.5 text-xs font-bold"><Icon size={14} /> {text}</span>
}

function Trust({ icon: Icon, text }: { icon: typeof Truck; text: string }) {
  return (
    <div className="rounded-2xl bg-blush/60 border border-pink/50 px-2 py-3 text-center">
      <Icon size={20} className="mx-auto text-rose mb-1" />
      <span className="text-[11px] font-bold text-cocoa leading-tight block">{text}</span>
    </div>
  )
}

function PayChip({ icon: Icon, text }: { icon: typeof Truck; text: string }) {
  return <span className="inline-flex items-center gap-1.5 rounded-xl border border-pink bg-white px-3 py-2 text-xs font-bold text-cocoa"><Icon size={16} className="text-rose" /> {text}</span>
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-cocoa-light">{label}</span><span className="text-cocoa font-semibold">{value}</span></div>
}

// best-effort map an Arabic/English color name to a CSS color for the swatch
function cssColor(name: string): string {
  const n = name.trim().toLowerCase()
  const map: Record<string, string> = {
    'أحمر': '#e5556e', red: '#e5556e',
    'وردي': '#f49abf', 'روز': '#f49abf', pink: '#f49abf', rose: '#f49abf',
    'ذهبي': '#d9a441', gold: '#d9a441',
    'فضي': '#c0c0c0', silver: '#c0c0c0',
    'أسود': '#2b2b2b', black: '#2b2b2b',
    'أبيض': '#f5f5f5', white: '#f5f5f5',
    'أزرق': '#4a78d6', blue: '#4a78d6',
    'أخضر': '#3fae78', green: '#3fae78',
    'بني': '#6b4630', brown: '#6b4630',
    'بيج': '#e8d6bf', beige: '#e8d6bf',
    'رمادي': '#9aa0a6', gray: '#9aa0a6', grey: '#9aa0a6',
    'أصفر': '#e9c877', yellow: '#e9c877',
    'بنفسجي': '#9b6bd1', purple: '#9b6bd1',
  }
  for (const k of Object.keys(map)) if (n.includes(k)) return map[k]
  return '#f4c0d6'
}
