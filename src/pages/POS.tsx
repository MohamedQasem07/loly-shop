import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  CheckCircle2, ImageOff, Minus, Plus, Printer, Receipt, RotateCcw, ScanLine, ShoppingCart, Trash2, Undo2, X,
} from 'lucide-react'
import { db } from '@/lib/db'
import { money, num, fmtDateTime } from '@/lib/format'
import { useCart } from '@/store/cart'
import { useAuth } from '@/store/auth'
import { toast } from '@/store/ui'
import { createSale, createReturn, voidSale, type PaymentLine } from '@/data/repo'
import { printReceipt } from '@/lib/receipt'
import { Modal, Field, Empty } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { Product, Settings, Sale, SaleItem } from '@/lib/types'

export default function POS() {
  const { profile } = useAuth()
  const products = useLiveQuery(() => db.products.toArray(), []) ?? []
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const settings = useLiveQuery(() => db.settings.get(1), []) as Settings | undefined
  const cart = useCart()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [cartOpen, setCartOpen] = useState(false)
  const [checkout, setCheckout] = useState(false)
  const [recentOpen, setRecentOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const allowNegative = settings?.allow_negative_stock ?? false

  useEffect(() => { searchRef.current?.focus() }, [])

  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return products
      .filter((p) => p.is_active)
      .filter((p) => (cat === 'all' ? true : p.category_id === cat))
      .filter((p) =>
        !term ? true : p.name.toLowerCase().includes(term) || (p.sku ?? '').toLowerCase().includes(term) || (p.barcode ?? '').toLowerCase().includes(term),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
  }, [products, q, cat])

  function addToCart(p: Product) {
    const inCart = cart.items.find((i) => i.product_id === p.id)?.qty ?? 0
    if (!allowNegative && inCart + 1 > p.stock_qty) {
      toast(`المتاح من «${p.name}» هو ${num(p.stock_qty)} فقط`, 'error')
      return
    }
    cart.add({ product_id: p.id, name: p.name, price: p.price, cost: p.cost, stock: p.stock_qty, image_url: p.image_url })
    searchRef.current?.focus()
  }

  /** Barcode scan (gun ends with Enter) or quick name search → add the matching item. */
  function onSearchEnter() {
    const term = q.trim().toLowerCase()
    if (!term) return
    const exact = products.find(
      (p) => p.is_active && ((p.barcode ?? '').toLowerCase() === term || (p.sku ?? '').toLowerCase() === term),
    )
    const target = exact ?? (list.length === 1 ? list[0] : null)
    if (target) {
      addToCart(target)
      setQ('')
    } else if (list.length === 0) {
      toast('مفيش منتج بالباركود/الاسم ده', 'error')
    }
    searchRef.current?.focus()
  }

  return (
    <div className="lg:grid lg:grid-cols-[1fr_22rem] lg:gap-5">
      {/* Products */}
      <div>
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <ScanLine size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-rose" />
            <input
              ref={searchRef}
              className="input pr-10"
              placeholder="امسح باركود أو ابحث بالاسم…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSearchEnter() } }}
            />
          </div>
          <button onClick={() => setRecentOpen(true)} className="btn-ghost shrink-0" title="آخر الفواتير">
            <Receipt size={18} />
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
          <Chip active={cat === 'all'} onClick={() => setCat('all')}>الكل</Chip>
          {categories
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((c) => (
              <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>
                {c.name_ar ?? c.name}
              </Chip>
            ))}
        </div>

        {list.length === 0 ? (
          <div className="card">
            <Empty icon={<ShoppingCart size={40} />} title="مفيش منتجات" hint="أضف منتجات من صفحة المنتجات" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pb-24 lg:pb-0">
            {list.map((p) => {
              const out = !allowNegative && p.stock_qty <= 0
              return (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={out}
                  className={cn('card p-2.5 text-right transition active:scale-[.97] hover:shadow-soft', out && 'opacity-50')}
                >
                  <div className="aspect-square rounded-2xl bg-blush mb-2 overflow-hidden grid place-items-center text-rose/40">
                    {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <ImageOff size={28} />}
                  </div>
                  <p className="font-bold text-sm text-cocoa leading-tight line-clamp-2 min-h-[2.5rem]">{p.name}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-bold text-rose text-sm">{money(p.price)}</span>
                    <span className="text-[10px] text-cocoa-light">{num(p.stock_qty)}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Desktop cart */}
      <div className="hidden lg:block">
        <div className="card p-4 sticky top-20">
          <CartPanel onCheckout={() => setCheckout(true)} />
        </div>
      </div>

      {/* Mobile cart bar */}
      {cart.count() > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="lg:hidden fixed bottom-[72px] inset-x-3 z-30 btn-primary py-3 justify-between shadow-soft"
        >
          <span className="flex items-center gap-2">
            <ShoppingCart size={18} /> {num(cart.count())} صنف
          </span>
          <span>{money(cart.total())}</span>
        </button>
      )}

      {/* Mobile cart sheet */}
      <Modal open={cartOpen} onClose={() => setCartOpen(false)} title="السلة">
        <CartPanel
          onCheckout={() => {
            setCartOpen(false)
            setCheckout(true)
          }}
        />
      </Modal>

      {checkout && (
        <CheckoutModal
          settings={settings ?? null}
          cashierName={profile?.full_name ?? null}
          cashierId={profile?.id ?? null}
          onClose={() => setCheckout(false)}
        />
      )}

      {recentOpen && (
        <RecentSalesModal
          settings={settings ?? null}
          cashierName={profile?.full_name ?? null}
          userId={profile?.id ?? null}
          isAdmin={profile?.role === 'owner' || profile?.role === 'manager'}
          onClose={() => setRecentOpen(false)}
        />
      )}
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full px-4 py-1.5 text-sm font-bold border transition',
        active ? 'bg-rose text-white border-rose' : 'bg-white text-cocoa-light border-pink',
      )}
    >
      {children}
    </button>
  )
}

function CartQty({ id, qty }: { id: string; qty: number }) {
  const cart = useCart()
  const [v, setV] = useState(String(qty))
  useEffect(() => { setV(String(qty)) }, [qty])
  return (
    <input
      type="text"
      inputMode="numeric"
      className="w-11 text-center font-bold text-sm bg-white border border-pink rounded-lg py-0.5 outline-none focus:border-rose"
      value={v}
      onChange={(e) => {
        const s = e.target.value.replace(/[^0-9]/g, '')
        setV(s)
        const n = parseInt(s, 10)
        if (n > 0) cart.setQty(id, n)
      }}
      onBlur={() => { if (!v || parseInt(v, 10) < 1) setV(String(qty)) }}
    />
  )
}

function CartPanel({ onCheckout }: { onCheckout: () => void }) {
  const cart = useCart()
  if (cart.items.length === 0) {
    return <Empty icon={<ShoppingCart size={36} />} title="السلة فاضية" hint="اختر منتجات للبيع" />
  }
  return (
    <div className="flex flex-col max-h-[70vh] lg:max-h-[calc(100vh-7rem)]">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-cocoa">السلة ({num(cart.count())})</h3>
        <button onClick={cart.clear} className="text-xs text-danger font-semibold flex items-center gap-1">
          <Trash2 size={14} /> تفريغ
        </button>
      </div>
      <div className="flex-1 overflow-auto space-y-2 -mx-1 px-1">
        {cart.items.map((i) => (
          <div key={i.product_id} className="flex items-center gap-2 bg-blush/40 rounded-2xl p-2">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-cocoa truncate">{i.name}</p>
              <p className="text-xs text-cocoa-light">{money(i.price)} × {num(i.qty)} = {money(i.qty * i.price - i.discount)}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => cart.dec(i.product_id)} className="w-7 h-7 rounded-full bg-white border border-pink grid place-items-center text-rose">
                <Minus size={14} />
              </button>
              <CartQty id={i.product_id} qty={i.qty} />
              <button onClick={() => cart.inc(i.product_id)} className="w-7 h-7 rounded-full bg-white border border-pink grid place-items-center text-rose">
                <Plus size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="pt-3 mt-2 border-t border-pink/50 space-y-2">
        <label className="flex items-center justify-between gap-2 text-sm">
          <span className="text-cocoa-light font-semibold">خصم الفاتورة</span>
          <input
            type="number"
            inputMode="decimal"
            className="input w-28 py-1.5 text-left"
            value={cart.invoiceDiscount || ''}
            onChange={(e) => cart.setInvoiceDiscount(+e.target.value || 0)}
            placeholder="0"
          />
        </label>
        <div className="flex items-center justify-between">
          <span className="text-cocoa-light text-sm">الإجمالي الفرعي</span>
          <span className="font-semibold">{money(cart.subtotal())}</span>
        </div>
        <div className="flex items-center justify-between text-lg">
          <span className="font-bold text-cocoa">الإجمالي</span>
          <span className="font-extrabold text-rose">{money(cart.total())}</span>
        </div>
        <button onClick={onCheckout} className="btn-primary w-full py-3">
          الدفع
        </button>
      </div>
    </div>
  )
}

function CheckoutModal({
  settings,
  cashierName,
  cashierId,
  onClose,
}: {
  settings: Settings | null
  cashierName: string | null
  cashierId: string | null
  onClose: () => void
}) {
  const cart = useCart()
  const methods = useLiveQuery(() => db.payment_methods.toArray(), []) ?? []
  const total = cart.total()
  const [pays, setPays] = useState<Record<string, number>>({})
  const [custName, setCustName] = useState('')
  const [custPhone, setCustPhone] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ invoiceNo: string } | null>(null)

  const paid = Object.values(pays).reduce((s, v) => s + (v || 0), 0)
  const remaining = +(total - paid).toFixed(2)
  const change = paid > total ? +(paid - total).toFixed(2) : 0

  function setPay(id: string, val: number) {
    setPays((p) => ({ ...p, [id]: val }))
  }
  function quickFill(id: string) {
    setPays((p) => ({ ...p, [id]: +(remaining > 0 ? remaining + (p[id] || 0) : (p[id] || 0)).toFixed(2) }))
  }

  async function confirm() {
    if (cart.items.length === 0) return
    if (paid < total) {
      toast(`باقي ${money(remaining)} لسه`, 'error')
      return
    }
    setBusy(true)
    try {
      const payments: PaymentLine[] = methods
        .filter((m) => (pays[m.id] || 0) > 0)
        .map((m) => ({ payment_method_id: m.id, amount: m.id === cashChangeMethod(methods) && change > 0 ? +(pays[m.id] - change).toFixed(2) : pays[m.id] }))
      // ensure recorded payments sum to total (drop change from cash)
      const { sale, items } = await createSale({
        lines: cart.items.map((i) => ({
          product_id: i.product_id,
          product_name: i.name,
          qty: i.qty,
          unit_price: i.price,
          unit_cost: i.cost,
          discount: i.discount,
        })),
        payments,
        invoiceDiscount: cart.invoiceDiscount,
        taxPercent: settings?.tax_percent ?? 0,
        customer_id: null,
        customerName: custName || null,
        customerPhone: custPhone || null,
        cashier_id: cashierId,
        note: note || null,
      })
      setDone({ invoiceNo: sale.invoice_no })
      // keep data for printing
      ;(window as any).__lastSale = { sale, items }
      toast('تم حفظ الفاتورة 🌸')
    } catch (e) {
      toast('حصل خطأ في حفظ الفاتورة', 'error')
    } finally {
      setBusy(false)
    }
  }

  function finishNew() {
    cart.clear()
    onClose()
  }

  function doPrint() {
    const last = (window as any).__lastSale as { sale: any; items: any[] } | undefined
    if (!last) return
    printReceipt({
      invoiceNo: last.sale.invoice_no,
      date: new Date(last.sale.created_at),
      lines: last.items.map((i) => ({ name: i.product_name, qty: i.qty, unit_price: i.unit_price, line_total: i.line_total })),
      subtotal: last.sale.subtotal,
      discount: last.sale.discount,
      tax: last.sale.tax,
      total: last.sale.total,
      payments: methods.filter((m) => (pays[m.id] || 0) > 0).map((m) => ({ name: m.name_ar ?? m.name, amount: pays[m.id] })),
      paid,
      change,
      settings,
      cashier: cashierName,
    })
  }

  if (done) {
    return (
      <Modal open onClose={finishNew} title="تمت العملية">
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-full bg-ok/15 text-ok grid place-items-center mx-auto mb-3">
            <CheckCircle2 size={36} />
          </div>
          <p className="font-display text-xl font-bold text-cocoa">تم البيع بنجاح</p>
          <p className="text-cocoa-light mt-1">فاتورة {done.invoiceNo}</p>
          {change > 0 && <p className="mt-3 chip bg-gold/15 text-gold-dark text-base">الباقي: {money(change)}</p>}
          <div className="flex gap-2 mt-6">
            <button className="btn-ghost flex-1" onClick={doPrint}>
              <Printer size={18} /> طباعة
            </button>
            <button className="btn-primary flex-1" onClick={finishNew}>
              بيع جديد
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="الدفع"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            رجوع
          </button>
          <button className="btn-primary" onClick={confirm} disabled={busy || cart.items.length === 0}>
            تأكيد ({money(total)})
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl bg-blush/50 p-4 text-center">
          <p className="text-sm text-cocoa-light">الإجمالي المطلوب</p>
          <p className="font-display text-3xl font-extrabold text-rose">{money(total)}</p>
        </div>

        <div>
          <p className="label">طرق الدفع</p>
          <div className="space-y-2">
            {methods
              .slice()
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => quickFill(m.id)}
                    className={cn(
                      'shrink-0 rounded-2xl px-3 py-2 text-sm font-bold border transition w-32 text-right',
                      (pays[m.id] || 0) > 0 ? 'bg-rose/10 text-rose border-rose/30' : 'bg-white border-pink text-cocoa',
                    )}
                  >
                    {m.name_ar ?? m.name}
                  </button>
                  <input
                    type="number"
                    inputMode="decimal"
                    className="input text-left"
                    placeholder="0"
                    value={pays[m.id] || ''}
                    onChange={(e) => setPay(m.id, +e.target.value || 0)}
                  />
                </div>
              ))}
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-cocoa-light">مدفوع: <span className="font-bold text-cocoa">{money(paid)}</span></span>
          {remaining > 0 ? (
            <span className="text-danger font-bold">باقي {money(remaining)}</span>
          ) : change > 0 ? (
            <span className="text-gold-dark font-bold">الباقي للعميل {money(change)}</span>
          ) : (
            <span className="text-ok font-bold">مظبوط ✓</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="اسم العميل"><input className="input" value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="اختياري" /></Field>
          <Field label="رقم الموبايل"><input className="input" dir="ltr" inputMode="tel" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} placeholder="اختياري" /></Field>
        </div>

        <Field label="ملاحظة (اختياري)">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة على الفاتورة" />
        </Field>
      </div>
    </Modal>
  )
}

/** Heuristic: cash method carries the change. */
function cashChangeMethod(methods: { id: string; code: string }[]): string | null {
  return methods.find((m) => m.code === 'cash')?.id ?? null
}

function RecentSalesModal({ settings, cashierName, userId, isAdmin, onClose }: { settings: Settings | null; cashierName: string | null; userId: string | null; isAdmin: boolean; onClose: () => void }) {
  const sales = useLiveQuery(() => db.sales.orderBy('created_at').reverse().limit(40).toArray(), []) ?? []
  const methods = useLiveQuery(() => db.payment_methods.toArray(), []) ?? []
  const [returnSale, setReturnSale] = useState<Sale | null>(null)

  async function reprint(s: Sale) {
    const items = await db.sale_items.where('sale_id').equals(s.id).toArray()
    const pays = await db.sale_payments.where('sale_id').equals(s.id).toArray()
    printReceipt({
      invoiceNo: s.invoice_no, date: new Date(s.created_at),
      lines: items.map((i) => ({ name: i.product_name, qty: i.qty, unit_price: i.unit_price, line_total: i.line_total })),
      subtotal: s.subtotal, discount: s.discount, tax: s.tax, total: s.total,
      payments: pays.map((p) => ({ name: methods.find((m) => m.id === p.payment_method_id)?.name_ar ?? '', amount: p.amount })),
      paid: s.total, change: 0, settings, cashier: cashierName,
    })
  }

  async function doVoid(s: Sale) {
    if (!isAdmin) return toast('الإلغاء للمالك/المدير فقط', 'error')
    const reason = window.prompt(`سبب إلغاء فاتورة ${s.invoice_no}؟`)
    if (reason === null) return
    try {
      await voidSale(s.id, reason || 'بدون سبب', userId)
      toast('تم إلغاء الفاتورة')
    } catch {
      toast('حصل خطأ', 'error')
    }
  }

  return (
    <Modal open onClose={onClose} title="آخر الفواتير" wide>
      {sales.length === 0 ? (
        <Empty icon={<Receipt size={36} />} title="لسه مفيش فواتير" />
      ) : (
        <div className="space-y-2">
          {sales.map((s) => (
            <div key={s.id} className={cn('flex items-center gap-2 rounded-2xl p-3 border', s.status === 'voided' ? 'bg-danger/5 border-danger/20' : 'bg-blush/40 border-pink/40')}>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-cocoa">{s.invoice_no} {s.status === 'voided' && <span className="text-danger text-xs">(ملغاة)</span>}</p>
                <p className="text-[11px] text-cocoa-light">{fmtDateTime(s.created_at)}</p>
              </div>
              <span className="font-bold text-rose">{money(s.total)}</span>
              <button onClick={() => reprint(s)} className="w-8 h-8 grid place-items-center rounded-xl bg-white border border-pink text-cocoa" title="طباعة"><Printer size={16} /></button>
              {s.status !== 'voided' && <button onClick={() => setReturnSale(s)} className="w-8 h-8 grid place-items-center rounded-xl bg-white border border-pink text-rose" title="مرتجع"><Undo2 size={16} /></button>}
              {isAdmin && s.status !== 'voided' && <button onClick={() => doVoid(s)} className="w-8 h-8 grid place-items-center rounded-xl bg-white border border-danger/30 text-danger" title="إلغاء الفاتورة"><X size={16} /></button>}
            </div>
          ))}
        </div>
      )}
      {returnSale && <ReturnSaleModal sale={returnSale} userId={userId} onClose={() => setReturnSale(null)} onDone={() => setReturnSale(null)} />}
    </Modal>
  )
}

function ReturnSaleModal({ sale, userId, onClose, onDone }: { sale: Sale; userId: string | null; onClose: () => void; onDone: () => void }) {
  const items = (useLiveQuery(() => db.sale_items.where('sale_id').equals(sale.id).toArray(), [sale.id]) ?? []) as SaleItem[]
  const methods = useLiveQuery(() => db.payment_methods.toArray(), []) ?? []
  const [qtys, setQtys] = useState<Record<string, number>>({})
  const [methodId, setMethodId] = useState<string | null>(null)
  const [restock, setRestock] = useState(true)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const total = useMemo(() => items.reduce((s, it) => s + (qtys[it.id] || 0) * it.unit_price, 0), [items, qtys])

  function returnAll() {
    const all: Record<string, number> = {}
    for (const it of items) all[it.id] = it.qty
    setQtys(all)
  }

  async function save() {
    const lines = items.filter((it) => (qtys[it.id] || 0) > 0).map((it) => ({ product_id: it.product_id ?? '', product_name: it.product_name, qty: qtys[it.id], unit_price: it.unit_price }))
    if (!lines.length) return toast('حدد كمية مرتجعة', 'error')
    setBusy(true)
    try {
      await createReturn({ sale_id: sale.id, customer_id: sale.customer_id, lines, refund_method_id: methodId, restock, reason: reason || null, created_by: userId })
      toast('تم تسجيل المرتجع 🌸')
      onDone()
    } catch {
      toast('حصل خطأ', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`مرتجع فاتورة ${sale.invoice_no}`}
      footer={<><button className="btn-ghost" onClick={onClose}>رجوع</button><button className="btn-primary" onClick={save} disabled={busy || total <= 0}>حفظ ({money(total)})</button></>}>
      <div className="space-y-3">
        <button onClick={returnAll} className="btn-ghost w-full text-sm"><RotateCcw size={16} /> إرجاع الفاتورة بالكامل</button>
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-3 bg-blush/40 rounded-2xl p-2.5">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-cocoa truncate">{it.product_name}</p>
              <p className="text-xs text-cocoa-light">اتباع {num(it.qty)} · {money(it.unit_price)}</p>
            </div>
            <input type="number" inputMode="numeric" min={0} max={it.qty} className="input w-20 py-1.5 text-center" placeholder="0" value={qtys[it.id] || ''} onChange={(e) => setQtys((q) => ({ ...q, [it.id]: Math.min(it.qty, Math.max(0, +e.target.value || 0)) }))} />
          </div>
        ))}
        <Field label="استرجاع الفلوس عن طريق">
          <select className="input" value={methodId ?? ''} onChange={(e) => setMethodId(e.target.value || null)}>
            <option value="">— بدون استرجاع نقدي —</option>
            {methods.map((m) => <option key={m.id} value={m.id}>{m.name_ar ?? m.name}</option>)}
          </select>
        </Field>
        <Field label="السبب"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مقاس/عيب/تبديل…" /></Field>
        <label className="flex items-center gap-2 text-sm font-semibold text-cocoa cursor-pointer">
          <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} /> رجوع الأصناف للمخزون
        </label>
      </div>
    </Modal>
  )
}
