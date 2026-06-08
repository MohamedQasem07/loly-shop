import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight, Banknote, CheckCircle2, ChevronDown, Clock, ImageOff, Lock, MapPin, Minus, Plus,
  RefreshCcw, Search, Share2, ShieldCheck, ShoppingBag, ShoppingCart, Smartphone,
  Sparkles, Star, Truck, MessageCircle, Phone, Tag, Ticket,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { uuid } from '@/lib/ids'
import { cn } from '@/lib/cn'
import { LOGO_URL } from '@/lib/assets'
import { toast } from '@/store/ui'

interface SP { id: string; name: string; category_id: string | null; image_url: string | null; color: string | null; price: number; stock_qty: number; created_at?: string; images?: string[]; colors?: string[]; sizes?: string[] }
interface SC { id: string; name: string; name_ar: string | null; sort_order: number }
interface SD { id: string; type: string; value: number; scope: string; category_id: string | null; product_id: string | null }
interface SZ { governorate: string; fee: number; sort_order: number }
interface SRating { product_id: string; avg_rating: number; review_count: number }
interface SReview { id: string; product_id: string; customer_name: string; rating: number; comment: string | null; created_at: string }
interface SInfo {
  store_name: string; logo_url: string | null; store_cover_url: string | null; store_about: string | null
  store_phone: string | null; store_whatsapp: string | null
  store_instagram: string | null; store_facebook: string | null; store_tiktok: string | null
  store_hours: string | null; store_address: string | null
  currency: string; shipping_fee: number; store_open: boolean; receipt_footer: string | null
  loyalty_enabled?: boolean; loyalty_point_value?: number; loyalty_min_redeem?: number
}

const egp = (n: number) => `${(n || 0).toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ج.م`

function waLink(phone: string | null | undefined, text: string): string | null {
  const num = (phone ?? '').replace(/\D/g, '')
  return num ? `https://wa.me/${num}?text=${encodeURIComponent(text)}` : null
}

function orderMessage(
  storeName: string,
  lines: { name: string; qty: number; lineTotal: number }[],
  total: number,
  c?: { name?: string; phone?: string; address?: string },
  opts?: { couponCode?: string | null; couponDiscount?: number; shipping?: number },
): string {
  const items = lines.map((l) => `• ${l.name} × ${l.qty} = ${egp(l.lineTotal)}`).join('\n')
  let msg = `السلام عليكم 🌸\nعايزة أطلب من ${storeName}:\n${items}`
  if (opts?.couponCode && (opts.couponDiscount ?? 0) > 0) msg += `\nكوبون ${opts.couponCode}: - ${egp(opts.couponDiscount!)}`
  if ((opts?.shipping ?? 0) > 0) msg += `\nالشحن: ${egp(opts!.shipping!)}`
  msg += `\nالإجمالي: ${egp(total)}`
  if (c?.name) msg += `\nالاسم: ${c.name}`
  if (c?.phone) msg += `\nالموبايل: ${c.phone}`
  if (c?.address) msg += `\nالعنوان: ${c.address}`
  return msg
}

const ORDER_FLOW: { key: string; label: string }[] = [
  { key: 'new', label: 'تم استلام الطلب' },
  { key: 'confirmed', label: 'تم تأكيد الطلب' },
  { key: 'preparing', label: 'بيتجهّز' },
  { key: 'shipped', label: 'اتشحن' },
  { key: 'delivered', label: 'اتسلّم' },
]

export default function Store() {
  const [info, setInfo] = useState<SInfo | null>(null)
  const [products, setProducts] = useState<SP[]>([])
  const [cats, setCats] = useState<SC[]>([])
  const [discounts, setDiscounts] = useState<SD[]>([])
  const [zones, setZones] = useState<SZ[]>([])
  const [bestSellerIds, setBestSellerIds] = useState<string[]>([])
  const [ratings, setRatings] = useState<Record<string, SRating>>({})
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [variants, setVariants] = useState<Record<string, string>>({})
  const setVariant = (id: string, v: string) => setVariants((m) => ({ ...m, [id]: v }))
  const [view, setView] = useState<'shop' | 'product' | 'checkout' | 'done' | 'track'>('shop')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [doneNo, setDoneNo] = useState('')

  useEffect(() => {
    ;(async () => {
      const [pi, pp, pc, pd, pz, pb, pr] = await Promise.all([
        supabase.from('store_info').select('*').maybeSingle(),
        supabase.from('store_products').select('*'),
        supabase.from('store_categories').select('*'),
        supabase.from('store_discounts').select('*'),
        supabase.from('store_shipping').select('*'),
        supabase.rpc('store_bestsellers', { p_limit: 12 }),
        supabase.from('store_product_ratings').select('*'),
      ])
      setInfo((pi.data as SInfo) ?? null)
      setProducts(((pp.data as SP[]) ?? []).map((p) => ({ ...p, price: Number(p.price), stock_qty: Number(p.stock_qty) })))
      setCats((pc.data as SC[]) ?? [])
      setDiscounts(((pd.data as SD[]) ?? []).map((d) => ({ ...d, value: Number(d.value) })))
      setZones(((pz.data as SZ[]) ?? []).map((z) => ({ ...z, fee: Number(z.fee), sort_order: Number(z.sort_order) })).sort((a, b) => a.sort_order - b.sort_order))
      setBestSellerIds(((pb.data as { product_id: string }[]) ?? []).map((r) => r.product_id))
      setRatings(Object.fromEntries(((pr.data as SRating[]) ?? []).map((r) => [r.product_id, { ...r, avg_rating: Number(r.avg_rating), review_count: Number(r.review_count) }])))
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
      .filter((p) => (cat === 'all' ? true : cat === 'offers' ? priceOf(p) < p.price : p.category_id === cat))
      .filter((p) => (!term ? true : p.name.toLowerCase().includes(term)))
  }, [products, q, cat, priceOf])

  const hasOffers = useMemo(() => products.some((p) => priceOf(p) < p.price), [products, priceOf])

  const newArrivals = useMemo(
    () => products.slice().sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')).slice(0, 10),
    [products],
  )
  const bestSellers = useMemo(
    () => bestSellerIds.map((id) => products.find((p) => p.id === id)).filter((p): p is SP => !!p),
    [bestSellerIds, products],
  )

  const cartLines = useMemo(
    () => Object.entries(cart).map(([id, qty]) => ({ p: products.find((x) => x.id === id)!, qty, variant: variants[id] ?? null })).filter((l) => l.p),
    [cart, products, variants],
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
            info={info} products={list} allCount={products.length} cats={cats} hasOffers={hasOffers}
            newArrivals={newArrivals} bestSellers={bestSellers} ratings={ratings}
            q={q} setQ={setQ} cat={cat} setCat={setCat}
            priceOf={priceOf} onOpen={openProduct} onAdd={(id) => add(id)} cart={cart}
          />
        )}

        {view === 'product' && selected && (
          <ProductDetail
            key={selected.id} p={selected} info={info} catName={catName(selected.category_id)}
            unit={priceOf(selected)} inCart={cart[selected.id] ?? 0}
            related={products.filter((x) => x.id !== selected.id).sort((a, b) => (b.category_id === selected.category_id ? 1 : 0) - (a.category_id === selected.category_id ? 1 : 0)).slice(0, 8)}
            priceOf={priceOf} ratings={ratings} setVariant={setVariant}
            onAdd={add} onBuy={buyNow} onOpen={openProduct} onBack={() => setView('shop')}
          />
        )}

        {view === 'checkout' && (
          <Checkout
            lines={cartLines.map((l) => ({ ...l, unit: priceOf(l.p) }))}
            add={(id) => add(id, 1, true)} dec={dec} remove={removeLine}
            subtotal={subtotalDisc} discount={discountTotal} zones={zones}
            info={info}
            onBack={() => setView('shop')}
            onPlaced={(no) => { setDoneNo(no); setCart({}); setVariants({}); setView('done') }}
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
            <button onClick={() => setView('track')} className="btn-ghost w-full mt-2">تتبّع طلبك</button>
          </div>
        )}

        {view === 'track' && <TrackOrder onBack={() => setView('shop')} />}
      </main>

      <StoreFooter info={info} onTrack={() => setView('track')} />

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

function Catalog({ info, products, allCount, cats, hasOffers, newArrivals, bestSellers, ratings, q, setQ, cat, setCat, priceOf, onOpen, onAdd, cart }: {
  info: SInfo | null
  products: SP[]; allCount: number; cats: SC[]; hasOffers: boolean
  newArrivals: SP[]; bestSellers: SP[]; ratings: Record<string, SRating>
  q: string; setQ: (v: string) => void; cat: string; setCat: (v: string) => void
  priceOf: (p: SP) => number; onOpen: (id: string) => void; onAdd: (id: string) => void; cart: Record<string, number>
}) {
  const showSections = cat === 'all' && !q.trim() && allCount >= 6
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl text-white p-6 sm:p-9 mb-5 shadow-soft">
        {info?.store_cover_url ? (
          <>
            <img src={info.store_cover_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-l from-rose-dark/90 via-rose-dark/70 to-rose/55" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-rose-grad" />
            <div className="absolute -top-10 -left-10 w-44 h-44 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-12 right-10 w-52 h-52 rounded-full bg-white/10 blur-2xl" />
          </>
        )}
        <div className="relative max-w-xl">
          <span className="inline-flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1 text-xs font-bold"><Sparkles size={14} /> {info?.store_name ?? 'Loly Store'}</span>
          <h2 className="font-display text-2xl sm:text-4xl font-extrabold mt-3 leading-tight drop-shadow">{info?.store_about ? info.store_name : 'إكسسوارات تكمّل أناقتك ✨'}</h2>
          <p className="opacity-95 mt-2 text-sm sm:text-base drop-shadow">{info?.store_about ?? 'تشكيلة مختارة من أحلى الإكسسوارات — اطلبي أونلاين والدفع عند الاستلام.'}</p>
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
        {hasOffers && <Chip active={cat === 'offers'} onClick={() => setCat('offers')}>🔥 عروض</Chip>}
        {cats.slice().sort((a, b) => a.sort_order - b.sort_order).map((c) => (
          <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.name_ar ?? c.name}</Chip>
        ))}
      </div>

      {showSections && (
        <div className="space-y-6 mb-6">
          {bestSellers.length >= 2 && <ProductRow title="الأكثر مبيعًا 🔥" items={bestSellers} priceOf={priceOf} ratings={ratings} onOpen={onOpen} onAdd={onAdd} cart={cart} />}
          {newArrivals.length > 0 && <ProductRow title="وصل حديثًا 🆕" items={newArrivals} priceOf={priceOf} ratings={ratings} onOpen={onOpen} onAdd={onAdd} cart={cart} />}
          <h3 className="font-display text-lg font-extrabold text-cocoa pt-1">كل المنتجات</h3>
        </div>
      )}

      {allCount === 0 || products.length === 0 ? (
        <div className="card"><div className="py-20 text-center text-cocoa-light"><ShoppingBag className="mx-auto mb-2 text-rose/50" size={44} /><p className="font-semibold">مفيش منتجات متاحة دلوقتي</p><p className="text-sm mt-1">تابعينا، هنضيف تشكيلة جديدة قريب 🌸</p></div></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {products.map((p) => (
            <ProductCard key={p.id} p={p} unit={priceOf(p)} inCart={cart[p.id] ?? 0} rating={ratings[p.id]} onOpen={() => onOpen(p.id)} onAdd={() => onAdd(p.id)} />
          ))}
        </div>
      )}
    </>
  )
}

function ProductCard({ p, unit, inCart, rating, onOpen, onAdd }: { p: SP; unit: number; inCart: number; rating?: SRating; onOpen: () => void; onAdd: () => void }) {
  const hasDisc = unit < p.price
  const off = hasDisc ? Math.round((1 - unit / p.price) * 100) : 0
  const out = p.stock_qty <= 0
  const hasVariants = (p.colors?.length ?? 0) > 0 || (p.sizes?.length ?? 0) > 0
  return (
    <div onClick={onOpen} className="card p-2.5 sm:p-3 flex flex-col text-right cursor-pointer group hover:shadow-lift hover:-translate-y-1 transition-all">
      <div className="aspect-square rounded-2xl bg-blush mb-2.5 overflow-hidden grid place-items-center text-rose/40 relative">
        {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" /> : <ImageOff size={30} />}
        {hasDisc && <span className="absolute top-2 right-2 bg-rose text-white text-[10px] font-extrabold rounded-full px-2 py-0.5 shadow">-{off}%</span>}
        {out && <span className="absolute inset-0 bg-white/55 grid place-items-center text-cocoa font-bold text-sm">نفد المخزون</span>}
      </div>
      <p className="font-bold text-sm text-cocoa leading-tight line-clamp-2 min-h-[2.5rem]">{p.name}</p>
      {rating && rating.review_count > 0 && (
        <div className="flex items-center gap-1 mt-0.5"><Stars n={rating.avg_rating} size={11} /><span className="text-[10px] text-cocoa-light">({rating.review_count})</span></div>
      )}
      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
        <span className="font-extrabold text-rose">{egp(unit)}</span>
        {hasDisc && <span className="text-[11px] text-cocoa-light line-through">{egp(p.price)}</span>}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); if (hasVariants) onOpen(); else onAdd() }}
        disabled={out}
        className={cn('btn-primary w-full mt-2.5 py-2 text-sm', out && 'opacity-50')}
      >
        {out ? 'غير متاح' : hasVariants ? 'اختاري' : inCart ? `في السلة (${inCart})` : 'أضف للسلة'}
      </button>
    </div>
  )
}

function ProductRow({ title, items, priceOf, ratings, onOpen, onAdd, cart }: {
  title: string; items: SP[]; ratings: Record<string, SRating>
  priceOf: (p: SP) => number; onOpen: (id: string) => void; onAdd: (id: string) => void; cart: Record<string, number>
}) {
  return (
    <section>
      <h3 className="font-display text-lg font-extrabold text-cocoa mb-3">{title}</h3>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {items.map((p) => (
          <div key={p.id} className="w-40 sm:w-44 shrink-0 snap-start">
            <ProductCard p={p} unit={priceOf(p)} inCart={cart[p.id] ?? 0} rating={ratings[p.id]} onOpen={() => onOpen(p.id)} onAdd={() => onAdd(p.id)} />
          </div>
        ))}
      </div>
    </section>
  )
}

/* ───────────────────────── Product detail ───────────────────────── */

function ProductDetail({ p, info, catName, unit, inCart, related, priceOf, ratings, setVariant, onAdd, onBuy, onOpen, onBack }: {
  p: SP; info: SInfo | null; catName: string | null
  unit: number; inCart: number
  related: SP[]; priceOf: (p: SP) => number; ratings: Record<string, SRating>
  setVariant: (id: string, v: string) => void
  onAdd: (id: string, n: number) => void; onBuy: (id: string, n: number) => void
  onOpen: (id: string) => void; onBack: () => void
}) {
  const rating = ratings[p.id]
  const [qty, setQty] = useState(1)
  const colors = p.colors ?? []
  const sizes = p.sizes ?? []
  const [selColor, setSelColor] = useState(colors.length === 1 ? colors[0] : '')
  const [selSize, setSelSize] = useState(sizes.length === 1 ? sizes[0] : '')
  const variantStr = [selColor, selSize].filter(Boolean).join(' / ')
  const variantMissing = (colors.length > 0 && !selColor) || (sizes.length > 0 && !selSize)
  const doAdd = () => { setVariant(p.id, variantStr); onAdd(p.id, qty) }
  const doBuy = () => { setVariant(p.id, variantStr); onBuy(p.id, qty) }
  const gallery = [p.image_url, ...(p.images ?? [])].filter(Boolean) as string[]
  const [mainImg, setMainImg] = useState(gallery[0] ?? '')
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
              {mainImg ? <img src={mainImg} alt={p.name} className="w-full h-full object-cover" /> : <ImageOff size={56} />}
              {hasDisc && <span className="absolute top-3 right-3 bg-rose text-white text-xs font-extrabold rounded-full px-3 py-1 shadow">خصم {off}%</span>}
              <button onClick={share} className="absolute top-3 left-3 bg-white/90 hover:bg-white text-cocoa rounded-full p-2 shadow transition" aria-label="مشاركة"><Share2 size={16} /></button>
            </div>
            {gallery.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                {gallery.map((url, i) => (
                  <button key={i} onClick={() => setMainImg(url)} className={cn('w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 transition', mainImg === url ? 'border-rose' : 'border-pink/40 hover:border-rose/50')}>
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div>
          {catName && <span className="chip bg-blush text-rose"><Tag size={12} /> {catName}</span>}
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-cocoa mt-2 leading-tight">{p.name}</h1>
          {rating && rating.review_count > 0 && (
            <a href="#reviews" className="inline-flex items-center gap-1.5 mt-2"><Stars n={rating.avg_rating} size={15} /><span className="text-sm text-cocoa-light">{rating.avg_rating} · {rating.review_count} تقييم</span></a>
          )}

          <div className="flex items-end gap-3 mt-4">
            <span className="font-extrabold text-rose text-3xl">{egp(unit)}</span>
            {hasDisc && <span className="text-cocoa-light line-through text-lg mb-1">{egp(p.price)}</span>}
            {hasDisc && <span className="chip bg-ok/15 text-ok mb-1.5">وفّرتي {off}%</span>}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            {out ? <span className="chip bg-danger/10 text-danger">نفد المخزون</span>
              : low ? <span className="chip bg-warn/15 text-warn">باقي {p.stock_qty} قطع بس!</span>
                : <span className="chip bg-ok/15 text-ok"><CheckCircle2 size={12} /> متوفر</span>}
            {p.color && colors.length === 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm text-cocoa-light">
                <span className="w-4 h-4 rounded-full border border-pink shadow-sm" style={{ background: cssColor(p.color) }} />
                اللون: <span className="font-semibold text-cocoa">{p.color}</span>
              </span>
            )}
          </div>

          {/* Variant options */}
          {colors.length > 0 && (
            <div className="mt-4">
              <span className="label">اللون {!selColor && <span className="text-rose">— اختاري</span>}</span>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => (
                  <button key={c} type="button" onClick={() => setSelColor(c)} className={cn('inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm font-bold transition', selColor === c ? 'border-rose bg-rose/5 text-rose' : 'border-pink text-cocoa-light hover:border-rose/40')}>
                    <span className="w-4 h-4 rounded-full border border-pink/60" style={{ background: cssColor(c) }} /> {c}
                  </button>
                ))}
              </div>
            </div>
          )}
          {sizes.length > 0 && (
            <div className="mt-3">
              <span className="label">المقاس {!selSize && <span className="text-rose">— اختاري</span>}</span>
              <div className="flex flex-wrap gap-2">
                {sizes.map((s) => (
                  <button key={s} type="button" onClick={() => setSelSize(s)} className={cn('rounded-xl border-2 px-3.5 py-1.5 text-sm font-bold min-w-[2.75rem] transition', selSize === s ? 'border-rose bg-rose/5 text-rose' : 'border-pink text-cocoa-light hover:border-rose/40')}>{s}</button>
                ))}
              </div>
            </div>
          )}

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
            <button onClick={doAdd} disabled={out || variantMissing} className={cn('btn-ghost py-3.5 text-base border-2 border-rose text-rose hover:bg-rose/5', (out || variantMissing) && 'opacity-50')}>
              <ShoppingCart size={18} /> أضف إلى السلة
            </button>
            <button onClick={doBuy} disabled={out || variantMissing} className={cn('btn-primary py-3.5 text-base', (out || variantMissing) && 'opacity-50')}>
              اشتري الآن
            </button>
          </div>
          {variantMissing && <p className="text-xs text-rose font-semibold mt-2 text-center">اختاري {colors.length > 0 && !selColor ? 'اللون' : ''}{colors.length > 0 && !selColor && sizes.length > 0 && !selSize ? ' و' : ''}{sizes.length > 0 && !selSize ? 'المقاس' : ''} قبل الإضافة</p>}

          {info?.store_whatsapp && (
            <a
              href={waLink(info.store_whatsapp, orderMessage(info.store_name ?? 'Loly Store', [{ name: p.name + (variantStr ? ` — ${variantStr}` : ''), qty, lineTotal: unit * qty }], unit * qty)) ?? '#'}
              target="_blank" rel="noreferrer"
              className={cn('btn w-full mt-3 bg-[#25D366] text-white hover:brightness-95', out && 'opacity-50 pointer-events-none')}
            >
              <MessageCircle size={18} /> اطلب على واتساب
            </a>
          )}

          {info?.store_whatsapp && (
            <a href={`https://wa.me/${info.store_whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent('عايزة أستفسر عن: ' + p.name)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-bold text-cocoa-light hover:text-rose mt-3 transition">
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

      {/* Reviews */}
      <div id="reviews"><ProductReviews productId={p.id} rating={rating} /></div>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-12">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={18} className="text-rose" />
            <h3 className="font-display text-xl font-extrabold text-cocoa">منتجات قد تعجبك</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {related.map((r) => (
              <ProductCard key={r.id} p={r} unit={priceOf(r)} inCart={0} rating={ratings[r.id]} onOpen={() => onOpen(r.id)} onAdd={() => onAdd(r.id, 1)} />
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

function ProductReviews({ productId, rating }: { productId: string; rating?: SRating }) {
  const [reviews, setReviews] = useState<SReview[]>([])
  const [name, setName] = useState('')
  const [stars, setStars] = useState(5)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from('store_reviews').select('*').eq('product_id', productId).order('created_at', { ascending: false })
      if (!cancelled) setReviews(((data as SReview[]) ?? []).map((r) => ({ ...r, rating: Number(r.rating) })))
    })()
    return () => { cancelled = true }
  }, [productId])

  async function submit() {
    if (!name.trim()) { toast('اكتبي اسمك'); return }
    setBusy(true)
    try {
      const { error } = await supabase.from('reviews').insert({ product_id: productId, customer_name: name.trim(), rating: stars, comment: comment.trim() || null })
      if (error) throw error
      setDone(true); setName(''); setComment(''); setStars(5); setOpen(false)
    } catch { toast('حصل خطأ، حاولي تاني') } finally { setBusy(false) }
  }

  return (
    <section className="mt-10 scroll-mt-24">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <h3 className="font-display text-xl font-extrabold text-cocoa flex items-center gap-2">
          تقييمات العملاء
          {rating && rating.review_count > 0 && <span className="inline-flex items-center gap-1.5 text-base font-normal"><Stars n={rating.avg_rating} /><span className="text-cocoa-light">{rating.avg_rating} ({rating.review_count})</span></span>}
        </h3>
        <button onClick={() => setOpen((o) => !o)} className="btn-ghost text-sm py-2 border-2 border-rose text-rose hover:bg-rose/5">اكتبي تقييمك</button>
      </div>

      {done && <div className="rounded-2xl bg-ok/10 text-ok font-bold text-center py-3 mb-4">شكراً لتقييمك 🌸 هيظهر بعد مراجعته</div>}

      {open && (
        <div className="card p-4 mb-4 space-y-3">
          <label className="block"><span className="label">اسمك</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="اسمك" /></label>
          <div>
            <span className="label">تقييمك</span>
            <div className="flex gap-1">{[1, 2, 3, 4, 5].map((i) => <button key={i} type="button" onClick={() => setStars(i)} aria-label={`${i} نجوم`}><Star size={30} className={i <= stars ? 'text-gold fill-gold' : 'text-pink'} /></button>)}</div>
          </div>
          <label className="block"><span className="label">رأيك (اختياري)</span><textarea className="input min-h-[70px]" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="إيه رأيك في المنتج؟" /></label>
          <div className="flex justify-end gap-2"><button onClick={() => setOpen(false)} className="btn-ghost text-sm">إلغاء</button><button onClick={submit} disabled={busy} className="btn-primary">{busy ? 'جاري الإرسال…' : 'إرسال التقييم'}</button></div>
        </div>
      )}

      {reviews.length === 0 ? (
        <p className="text-sm text-cocoa-light">لسه مفيش تقييمات للمنتج ده — كوني أول واحدة تقيّمه 🌟</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-cocoa">{r.customer_name}</span>
                <Stars n={r.rating} size={13} />
                <span className="text-[11px] text-cocoa-light">{new Date(r.created_at).toLocaleDateString('ar-EG')}</span>
              </div>
              {r.comment && <p className="text-sm text-cocoa mt-1.5 leading-relaxed">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/* ───────────────────────── Checkout ───────────────────────── */

function Checkout({ lines, add, dec, remove, subtotal, discount, zones, info, onBack, onPlaced }: {
  lines: { p: SP; qty: number; unit: number; variant: string | null }[]
  add: (id: string) => void
  dec: (id: string) => void
  remove: (id: string) => void
  subtotal: number; discount: number; zones: SZ[]
  info: SInfo | null
  onBack: () => void
  onPlaced: (orderNo: string) => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [governorate, setGovernorate] = useState('')
  const [payment, setPayment] = useState<'cod' | 'instapay'>('cod')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // coupon
  const [coupon, setCoupon] = useState('')
  const [appliedCode, setAppliedCode] = useState<string | null>(null)
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [couponBusy, setCouponBusy] = useState(false)

  // loyalty points (balance looked up by phone; redeemed value realized when the shop confirms the order)
  const loyaltyOn = !!info?.loyalty_enabled && (info?.loyalty_point_value ?? 0) > 0
  const pointValue = info?.loyalty_point_value ?? 1
  const minRedeem = info?.loyalty_min_redeem ?? 0
  const [pointsBalance, setPointsBalance] = useState(0)
  const [redeemPointsOn, setRedeemPointsOn] = useState(false)

  const goodsAfterCoupon = Math.max(0, +(subtotal - couponDiscount).toFixed(2))
  const canRedeemPoints = loyaltyOn && pointsBalance > 0 && pointsBalance >= minRedeem
  const maxUsablePoints = canRedeemPoints ? Math.min(pointsBalance, Math.floor(goodsAfterCoupon / pointValue)) : 0
  const effPoints = redeemPointsOn ? maxUsablePoints : 0
  const pointsDiscount = +(effPoints * pointValue).toFixed(2)

  // shipping by governorate; falls back to the flat store fee when the shop set no zones
  const hasZones = zones.length > 0
  const selectedZone = zones.find((z) => z.governorate === governorate)
  const shipping = hasZones ? (selectedZone?.fee ?? 0) : (info?.shipping_fee ?? 0)
  const shippingKnown = !hasZones || !!selectedZone

  const grandTotal = Math.max(0, +(subtotal - couponDiscount - pointsDiscount + shipping).toFixed(2))

  // (re)validate the applied coupon server-side whenever it changes or the cart total shifts
  useEffect(() => {
    if (!appliedCode) { setCouponDiscount(0); return }
    let cancelled = false
    setCouponBusy(true)
    ;(async () => {
      const { data, error } = await supabase.rpc('validate_coupon', { p_code: appliedCode, p_subtotal: subtotal })
      if (cancelled) return
      const row = (Array.isArray(data) ? data[0] : data) as { valid: boolean; reason: string | null; discount: number } | null
      if (error || !row) { setCouponDiscount(0); setAppliedCode(null); setCouponMsg({ ok: false, text: 'تعذّر التحقق من الكوبون' }) }
      else if (row.valid) { setCouponDiscount(Number(row.discount) || 0); setCouponMsg({ ok: true, text: `تم تطبيق كوبون ${appliedCode} 🎉` }) }
      else { setCouponDiscount(0); setAppliedCode(null); setCouponMsg({ ok: false, text: row.reason ?? 'كوبون غير صالح' }) }
      setCouponBusy(false)
    })()
    return () => { cancelled = true }
  }, [appliedCode, subtotal])

  function applyCoupon() {
    const code = coupon.trim().toUpperCase()
    if (!code) return
    setCouponMsg(null)
    setAppliedCode(code)
  }
  function removeCoupon() { setAppliedCode(null); setCoupon(''); setCouponDiscount(0); setCouponMsg(null) }

  // look up the customer's points balance once a full phone number is entered
  useEffect(() => {
    if (!loyaltyOn) { setPointsBalance(0); return }
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10) { setPointsBalance(0); setRedeemPointsOn(false); return }
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.rpc('customer_points', { p_phone: digits })
      if (!cancelled) setPointsBalance(error ? 0 : Number(data) || 0)
    })()
    return () => { cancelled = true }
  }, [phone, loyaltyOn])

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
    if (hasZones && !governorate) { setErr('اختاري المحافظة'); return }
    if (!address.trim()) { setErr('اكتبي عنوان التوصيل'); return }
    setBusy(true); setErr('')
    try {
      const orderId = uuid()
      const orderNo = 'ORD-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 90 + 10)
      const { error: e1 } = await supabase.from('orders').insert({
        id: orderId, order_no: orderNo, customer_name: name.trim(), customer_phone: phone.trim(), address: address.trim(),
        status: 'new', payment, paid: false, subtotal, discount, shipping, total: grandTotal, note: note || null,
        coupon_code: appliedCode, coupon_discount: couponDiscount, points_used: effPoints, governorate: governorate || null,
      })
      if (e1) throw e1
      const { error: e2 } = await supabase.from('order_items').insert(
        lines.map((l) => ({ id: uuid(), order_id: orderId, product_id: l.p.id, product_name: l.p.name, qty: l.qty, unit_price: l.unit, line_total: +(l.unit * l.qty).toFixed(2), variant: l.variant })),
      )
      if (e2) throw e2
      // mark the coupon used (best effort — tied to this order, idempotent server-side)
      if (appliedCode) { try { await supabase.rpc('redeem_coupon', { p_order_no: orderNo }) } catch { /* ignore */ } }
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
                  {l.variant && <p className="text-[11px] text-rose font-semibold">{l.variant}</p>}
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
            {hasZones && (
              <label className="block">
                <span className="label">المحافظة (لتحديد الشحن)</span>
                <select className="input" value={governorate} onChange={(e) => setGovernorate(e.target.value)}>
                  <option value="">— اختاري المحافظة —</option>
                  {zones.map((z) => <option key={z.governorate} value={z.governorate}>{z.governorate} — {z.fee > 0 ? egp(z.fee) : 'شحن مجاني'}</option>)}
                </select>
              </label>
            )}
            <label className="block"><span className="label">عنوان التوصيل</span><textarea className="input min-h-[70px]" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="المدينة، الشارع، رقم العقار…" /></label>
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
            {discount > 0 && <Row label="خصم العروض" value={`- ${egp(discount)}`} />}

            {/* Coupon */}
            <div className="py-1">
              {appliedCode && couponDiscount > 0 ? (
                <div className="flex items-center justify-between rounded-xl bg-ok/10 px-3 py-2">
                  <span className="inline-flex items-center gap-1.5 text-ok font-extrabold text-xs" dir="ltr"><Ticket size={14} /> {appliedCode}</span>
                  <span className="flex items-center gap-2.5">
                    <span className="text-ok font-bold">- {egp(couponDiscount)}</span>
                    <button type="button" onClick={removeCoupon} className="text-cocoa-light hover:text-danger text-xs font-bold">إزالة</button>
                  </span>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    className="input flex-1 py-2 text-sm" placeholder="كود الخصم (اختياري)" dir="ltr"
                    value={coupon} onChange={(e) => setCoupon(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon() } }}
                  />
                  <button type="button" onClick={applyCoupon} disabled={couponBusy || !coupon.trim()} className="btn-ghost text-sm py-2 px-4 border-2 border-rose text-rose hover:bg-rose/5 disabled:opacity-50">{couponBusy ? '…' : 'تطبيق'}</button>
                </div>
              )}
              {couponMsg && <p className={cn('text-[11px] mt-1.5 font-semibold', couponMsg.ok ? 'text-ok' : 'text-danger')}>{couponMsg.text}</p>}
            </div>

            {/* Loyalty points */}
            {canRedeemPoints && (
              <div className="rounded-xl border border-gold/40 bg-gold/5 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-cocoa flex items-center gap-1.5"><Sparkles size={13} className="text-gold-dark" /> نقاطك: {pointsBalance} <span className="text-cocoa-light font-normal">(= {egp(pointsBalance * pointValue)})</span></span>
                  <label className={cn('flex items-center gap-1.5 text-xs font-bold cursor-pointer', maxUsablePoints <= 0 ? 'text-cocoa-light' : 'text-cocoa')}>
                    <input type="checkbox" checked={redeemPointsOn} onChange={(e) => setRedeemPointsOn(e.target.checked)} disabled={maxUsablePoints <= 0} />
                    استخدميها
                  </label>
                </div>
                {effPoints > 0 && <p className="text-[11px] text-ok font-bold mt-1">خصم {egp(pointsDiscount)} ({effPoints} نقطة)</p>}
              </div>
            )}

            <Row label="الشحن" value={!shippingKnown ? 'اختاري المحافظة' : shipping > 0 ? egp(shipping) : 'مجاني'} />
            <div className="border-t border-pink/40 pt-2.5 mt-1 flex justify-between text-lg"><span className="font-bold text-cocoa">الإجمالي</span><span className="font-extrabold text-rose">{egp(grandTotal)}</span></div>
            {err && <p className="text-danger text-sm font-semibold text-center bg-danger/10 rounded-xl py-2 mt-1">{err}</p>}
            <button onClick={place} disabled={busy} className="btn-primary w-full py-3.5 mt-1">{busy ? 'جاري الإرسال…' : 'تأكيد الطلب'}</button>
            {info?.store_whatsapp && (
              <a
                href={waLink(info.store_whatsapp, orderMessage(info.store_name ?? 'Loly Store', lines.map((l) => ({ name: l.p.name + (l.variant ? ` — ${l.variant}` : ''), qty: l.qty, lineTotal: l.unit * l.qty })), grandTotal, { name, phone, address }, { couponCode: appliedCode, couponDiscount, shipping })) ?? '#'}
                target="_blank" rel="noreferrer"
                className="btn w-full bg-[#25D366] text-white hover:brightness-95"
              >
                <MessageCircle size={18} /> أو اطلبي على واتساب
              </a>
            )}
            <p className="text-[11px] text-cocoa-light text-center flex items-center justify-center gap-1"><Lock size={11} /> بياناتك آمنة ولن تُستخدم إلا للتوصيل</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ───────────────────────── small UI bits ───────────────────────── */

function StoreFooter({ info, onTrack }: { info: SInfo | null; onTrack: () => void }) {
  if (!info) return null
  const wa = info.store_whatsapp ? `https://wa.me/${info.store_whatsapp.replace(/\D/g, '')}` : null
  const socials = [
    info.store_instagram && { href: info.store_instagram, label: 'إنستجرام', Icon: IgIcon, color: 'bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5]' },
    info.store_facebook && { href: info.store_facebook, label: 'فيسبوك', Icon: FbIcon, color: 'bg-[#1877F2]' },
    info.store_tiktok && { href: info.store_tiktok, label: 'تيك توك', Icon: TtIcon, color: 'bg-cocoa' },
  ].filter(Boolean) as { href: string; label: string; Icon: () => JSX.Element; color: string }[]

  return (
    <footer className="border-t border-pink/40 bg-white mt-10">
      <div className="max-w-6xl mx-auto px-4 py-9 grid sm:grid-cols-3 gap-7 text-sm">
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <img src={info.logo_url || LOGO_URL} className="w-10 h-10 rounded-xl object-cover" />
            <span className="font-display font-extrabold text-rose text-lg">{info.store_name}</span>
          </div>
          {info.store_about && <p className="text-cocoa-light leading-relaxed">{info.store_about}</p>}
        </div>
        <div>
          <h4 className="font-bold text-cocoa mb-2.5">تواصلي معنا</h4>
          <ul className="space-y-2 text-cocoa-light">
            {wa && <li><a href={wa} target="_blank" rel="noreferrer" className="hover:text-rose inline-flex items-center gap-2"><MessageCircle size={15} /> واتساب</a></li>}
            {info.store_phone && <li className="inline-flex items-center gap-2" dir="ltr"><Phone size={15} /> {info.store_phone}</li>}
            {info.store_hours && <li className="inline-flex items-center gap-2"><Clock size={15} /> {info.store_hours}</li>}
            {info.store_address && <li className="inline-flex items-center gap-2"><MapPin size={15} /> {info.store_address}</li>}
            <li><button onClick={onTrack} className="hover:text-rose inline-flex items-center gap-2"><Search size={15} /> تتبّعي طلبك</button></li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-cocoa mb-2.5">تابعينا</h4>
          {socials.length > 0 ? (
            <div className="flex gap-2.5">
              {socials.map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noreferrer" title={s.label} className={cn('w-10 h-10 rounded-full grid place-items-center text-white shadow-soft hover:-translate-y-0.5 transition', s.color)}>
                  <s.Icon />
                </a>
              ))}
            </div>
          ) : (
            <p className="text-cocoa-light">تابعينا قريباً 🌸</p>
          )}
        </div>
      </div>
      <div className="text-center text-[11px] text-cocoa-light pb-6">© {info.store_name} — كل الحقوق محفوظة</div>
    </footer>
  )
}

function IgIcon() {
  return (<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2.2c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 01-1.38-.9 3.7 3.7 0 01-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.21 15.58 2.2 15.2 2.2 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.21 8.8 2.2 12 2.2zm0 1.8c-3.15 0-3.5.01-4.74.07-.9.04-1.39.19-1.71.32-.43.17-.74.37-1.06.69-.32.32-.52.63-.69 1.06-.13.32-.28.81-.32 1.71-.06 1.24-.07 1.59-.07 4.74s.01 3.5.07 4.74c.04.9.19 1.39.32 1.71.17.43.37.74.69 1.06.32.32.63.52 1.06.69.32.13.81.28 1.71.32 1.24.06 1.59.07 4.74.07s3.5-.01 4.74-.07c.9-.04 1.39-.19 1.71-.32.43-.17.74-.37 1.06-.69.32-.32.52-.63.69-1.06.13-.32.28-.81.32-1.71.06-1.24.07-1.59.07-4.74s-.01-3.5-.07-4.74c-.04-.9-.19-1.39-.32-1.71a2.86 2.86 0 00-.69-1.06 2.86 2.86 0 00-1.06-.69c-.32-.13-.81-.28-1.71-.32C15.5 4.01 15.15 4 12 4zm0 3.06A4.94 4.94 0 1012 16.94 4.94 4.94 0 0012 7.06zm0 1.8a3.14 3.14 0 110 6.28 3.14 3.14 0 010-6.28zm5.13-.93a1.15 1.15 0 11-2.3 0 1.15 1.15 0 012.3 0z"/></svg>)
}
function FbIcon() {
  return (<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M22 12a10 10 0 10-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0022 12z"/></svg>)
}
function TtIcon() {
  return (<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M16.6 5.82a4.28 4.28 0 01-1.06-2.82h-3.2v12.85a2.59 2.59 0 01-2.59 2.5 2.59 2.59 0 01-2.59-2.59 2.59 2.59 0 013.37-2.47v-3.3a5.9 5.9 0 00-.78-.05A5.89 5.89 0 003.46 16a5.89 5.89 0 0010.06 4.16 5.86 5.86 0 001.72-4.16V9.43a7.55 7.55 0 004.42 1.42V7.6a4.28 4.28 0 01-3.06-1.78z"/></svg>)
}

function TrackOrder({ onBack }: { onBack: () => void }) {
  const [orderNo, setOrderNo] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [result, setResult] = useState<{ order_no: string; status: string; total: number; created_at: string; items: { name: string; qty: number; price: number }[] } | null>(null)

  async function track() {
    if (!orderNo.trim() || !phone.trim()) { setErr('اكتبي رقم الطلب ورقم الموبايل'); return }
    setBusy(true); setErr(''); setResult(null)
    try {
      const { data, error } = await supabase.rpc('track_order', { p_order_no: orderNo.trim(), p_phone: phone.trim() })
      if (error) throw error
      const row = Array.isArray(data) ? data[0] : null
      if (!row) { setErr('مفيش طلب بالبيانات دي — تأكدي من رقم الطلب والموبايل'); return }
      setResult({ order_no: row.order_no, status: row.status, total: Number(row.total), created_at: row.created_at, items: (row.items ?? []) as { name: string; qty: number; price: number }[] })
    } catch {
      setErr('حصل خطأ، حاولي تاني')
    } finally {
      setBusy(false)
    }
  }

  const cancelled = result?.status === 'cancelled'
  const currentIdx = result ? ORDER_FLOW.findIndex((s) => s.key === result.status) : -1

  return (
    <div className="max-w-lg mx-auto mt-2 animate-fadeIn">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-cocoa-light hover:text-rose font-bold text-sm mb-4 transition"><ArrowRight size={16} /> رجوع للمتجر</button>
      <h2 className="font-display text-2xl font-extrabold text-cocoa mb-4">تتبّعي طلبك</h2>
      <div className="card p-4 space-y-3">
        <label className="block"><span className="label">رقم الطلب</span><input className="input" dir="ltr" value={orderNo} onChange={(e) => setOrderNo(e.target.value)} placeholder="ORD-XXXXXX" /></label>
        <label className="block"><span className="label">رقم الموبايل</span><input className="input" dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" /></label>
        {err && <p className="text-danger text-sm font-semibold text-center bg-danger/10 rounded-xl py-2">{err}</p>}
        <button onClick={track} disabled={busy} className="btn-primary w-full">{busy ? 'جاري البحث…' : 'تتبّع'}</button>
      </div>

      {result && (
        <div className="card p-5 mt-4 animate-pop">
          <div className="flex items-center justify-between mb-4">
            <div><p className="font-bold text-cocoa">{result.order_no}</p><p className="text-xs text-cocoa-light">{new Date(result.created_at).toLocaleDateString('ar-EG')}</p></div>
            <span className="font-extrabold text-rose">{egp(result.total)}</span>
          </div>
          {cancelled ? (
            <div className="rounded-2xl bg-danger/10 text-danger text-center font-bold py-4">الطلب ملغي</div>
          ) : (
            <ol>
              {ORDER_FLOW.map((s, i) => {
                const done = i <= currentIdx
                return (
                  <li key={s.key} className="flex items-center gap-3 pb-4 last:pb-0">
                    <span className={cn('w-7 h-7 rounded-full grid place-items-center shrink-0', done ? 'bg-ok text-white' : 'bg-blush text-cocoa-light')}>
                      {done ? <CheckCircle2 size={16} /> : <span className="w-2 h-2 rounded-full bg-current" />}
                    </span>
                    <span className={cn('font-semibold', done ? 'text-cocoa' : 'text-cocoa-light')}>{s.label}</span>
                  </li>
                )
              })}
            </ol>
          )}
          {result.items.length > 0 && (
            <div className="border-t border-pink/40 mt-2 pt-3 space-y-1.5 text-sm">
              {result.items.map((it, i) => <div key={i} className="flex justify-between text-cocoa-light"><span>{it.name} × {it.qty}</span><span>{egp(Number(it.price) * it.qty)}</span></div>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

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

function Stars({ n, size = 14 }: { n: number; size?: number }) {
  return <span className="inline-flex">{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={size} className={i <= Math.round(n) ? 'text-gold fill-gold' : 'text-pink/50'} />)}</span>
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
