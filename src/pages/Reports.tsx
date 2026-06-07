import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BarChart3, Boxes, Coins, Receipt, TrendingUp, Wallet } from 'lucide-react'
import { startOfDay, startOfMonth, startOfWeek, subDays } from 'date-fns'
import { db } from '@/lib/db'
import { money, num } from '@/lib/format'
import { PageHeader, Empty } from '@/components/ui'
import { useAuth } from '@/store/auth'
import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

type RangeKey = 'today' | 'week' | 'month' | 'all'

export default function Reports() {
  const { profile } = useAuth()
  const allowed = ['owner', 'manager', 'viewer'].includes(profile?.role ?? '')
  const [range, setRange] = useState<RangeKey>('month')

  const sales = useLiveQuery(() => db.sales.toArray(), []) ?? []
  const items = useLiveQuery(() => db.sale_items.toArray(), []) ?? []
  const payments = useLiveQuery(() => db.sale_payments.toArray(), []) ?? []
  const expenses = useLiveQuery(() => db.expenses.toArray(), []) ?? []
  const products = useLiveQuery(() => db.products.toArray(), []) ?? []
  const methods = useLiveQuery(() => db.payment_methods.toArray(), []) ?? []
  const expCats = useLiveQuery(() => db.expense_categories.toArray(), []) ?? []

  const from = useMemo(() => {
    const now = new Date()
    if (range === 'today') return startOfDay(now)
    if (range === 'week') return startOfWeek(now, { weekStartsOn: 6 })
    if (range === 'month') return startOfMonth(now)
    return new Date(0)
  }, [range])

  const r = useMemo(() => {
    const inRange = (d: string) => new Date(d) >= from
    const completed = sales.filter((s) => s.status === 'completed' && inRange(s.created_at))
    const ids = new Set(completed.map((s) => s.id))

    const salesTotal = completed.reduce((s, x) => s + x.total, 0)
    const cogs = completed.reduce((s, x) => s + x.cost_total, 0)
    const expensesTotal = expenses.filter((e) => inRange(e.created_at)).reduce((s, e) => s + e.amount, 0)
    const grossProfit = salesTotal - cogs
    const netProfit = grossProfit - expensesTotal

    // payments by method
    const payMap = new Map<string, number>()
    for (const p of payments) if (ids.has(p.sale_id) && p.payment_method_id) payMap.set(p.payment_method_id, (payMap.get(p.payment_method_id) ?? 0) + p.amount)
    const payBreakdown = methods.slice().sort((a, b) => a.sort_order - b.sort_order).map((m) => ({ name: m.name_ar ?? m.name, amount: payMap.get(m.id) ?? 0 })).filter((x) => x.amount > 0)

    // best sellers
    const prodMap = new Map<string, { name: string; qty: number; revenue: number }>()
    for (const it of items) {
      if (!ids.has(it.sale_id)) continue
      const cur = prodMap.get(it.product_name) ?? { name: it.product_name, qty: 0, revenue: 0 }
      cur.qty += it.qty
      cur.revenue += it.line_total
      prodMap.set(it.product_name, cur)
    }
    const best = [...prodMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 8)

    // expenses by category
    const expMap = new Map<string, number>()
    for (const e of expenses.filter((e) => inRange(e.created_at))) expMap.set(e.category_id ?? '—', (expMap.get(e.category_id ?? '—') ?? 0) + e.amount)

    // inventory (not range dependent)
    const invValue = products.filter((p) => p.is_active).reduce((s, p) => s + p.cost * p.stock_qty, 0)
    const invRetail = products.filter((p) => p.is_active).reduce((s, p) => s + p.price * p.stock_qty, 0)
    const lowStock = products.filter((p) => p.is_active && p.low_stock_threshold > 0 && p.stock_qty <= p.low_stock_threshold)

    return { salesTotal, cogs, expensesTotal, grossProfit, netProfit, count: completed.length, avg: completed.length ? salesTotal / completed.length : 0, payBreakdown, best, invValue, invRetail, lowStock, expMap }
  }, [sales, items, payments, expenses, products, methods, from])

  const catName = (id: string) => (id === '—' ? 'بدون تصنيف' : expCats.find((c) => c.id === id)?.name_ar ?? '—')

  if (!allowed) return <div className="card p-10 text-center"><p className="font-bold text-cocoa">التقارير للمالك والمدير والمشاهد فقط</p></div>

  return (
    <div className="space-y-5">
      <PageHeader title="التقارير" />

      {/* Range tabs */}
      <div className="flex gap-2 flex-wrap">
        {([['today', 'اليوم'], ['week', 'الأسبوع'], ['month', 'الشهر'], ['all', 'الكل']] as [RangeKey, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setRange(k)} className={cn('rounded-full px-4 py-1.5 text-sm font-bold border transition', range === k ? 'bg-rose text-white border-rose' : 'bg-white text-cocoa-light border-pink')}>{label}</button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={<BarChart3 />} label="المبيعات" value={money(r.salesTotal)} tone="rose" />
        <Kpi icon={<TrendingUp />} label="صافي الربح" value={money(r.netProfit)} tone={r.netProfit >= 0 ? 'gold' : 'danger'} />
        <Kpi icon={<Receipt />} label="عدد الفواتير" value={num(r.count)} tone="cocoa" />
        <Kpi icon={<Coins />} label="متوسط الفاتورة" value={money(r.avg)} tone="cocoa" />
      </div>

      {/* P&L */}
      <div className="card p-5">
        <h2 className="font-bold text-cocoa mb-3">الأرباح والخسائر</h2>
        <div className="space-y-2 text-sm">
          <Row label="إجمالي المبيعات" value={money(r.salesTotal)} />
          <Row label="تكلفة البضاعة المباعة" value={`- ${money(r.cogs)}`} muted />
          <Row label="مجمل الربح" value={money(r.grossProfit)} bold />
          <Row label="المصاريف" value={`- ${money(r.expensesTotal)}`} muted />
          <div className="border-t border-pink/50 pt-2">
            <Row label="صافي الربح" value={money(r.netProfit)} bold tone={r.netProfit >= 0 ? 'ok' : 'danger'} />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Payment methods */}
        <div className="card p-4">
          <h2 className="font-bold text-cocoa mb-3 flex items-center gap-2"><Wallet size={18} className="text-rose" /> طرق الدفع</h2>
          {r.payBreakdown.length === 0 ? <Empty title="مفيش مبيعات في الفترة" /> : (
            <ul className="space-y-2">
              {r.payBreakdown.map((p) => (
                <li key={p.name} className="flex items-center justify-between"><span className="text-cocoa">{p.name}</span><span className="font-bold text-cocoa">{money(p.amount)}</span></li>
              ))}
            </ul>
          )}
        </div>

        {/* Best sellers */}
        <div className="card p-4">
          <h2 className="font-bold text-cocoa mb-3">أفضل المنتجات</h2>
          {r.best.length === 0 ? <Empty title="مفيش مبيعات في الفترة" /> : (
            <ul className="space-y-2">
              {r.best.map((b, i) => (
                <li key={b.name} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-gold/15 text-gold-dark grid place-items-center text-xs font-bold">{i + 1}</span>
                  <span className="flex-1 truncate text-cocoa font-semibold">{b.name}</span>
                  <span className="text-xs text-cocoa-light">{num(b.qty)} قطعة</span>
                  <span className="font-bold text-rose text-sm">{money(b.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Inventory */}
      <div className="card p-5">
        <h2 className="font-bold text-cocoa mb-3 flex items-center gap-2"><Boxes size={18} className="text-rose" /> المخزون الحالي</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Mini label="قيمة المخزون (تكلفة)" value={money(r.invValue)} />
          <Mini label="قيمة المخزون (بيع)" value={money(r.invRetail)} />
          <Mini label="منتجات ناقصة" value={num(r.lowStock.length)} tone={r.lowStock.length ? 'danger' : 'cocoa'} />
        </div>
        {r.lowStock.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {r.lowStock.map((p) => <li key={p.id} className="chip bg-warn/15 text-warn">{p.name}: {num(p.stock_qty)}</li>)}
          </ul>
        )}
      </div>

      {/* Expenses by category */}
      {r.expMap.size > 0 && (
        <div className="card p-4">
          <h2 className="font-bold text-cocoa mb-3">المصاريف حسب النوع</h2>
          <ul className="space-y-2">
            {[...r.expMap.entries()].sort((a, b) => b[1] - a[1]).map(([id, amt]) => (
              <li key={id} className="flex items-center justify-between"><span className="text-cocoa">{catName(id)}</span><span className="font-bold text-danger">{money(amt)}</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Kpi({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: 'rose' | 'gold' | 'cocoa' | 'danger' }) {
  const tones: Record<string, string> = { rose: 'bg-rose/10 text-rose', gold: 'bg-gold/15 text-gold-dark', cocoa: 'bg-cocoa/10 text-cocoa', danger: 'bg-danger/10 text-danger' }
  return (
    <div className="card p-4">
      <div className={`w-10 h-10 rounded-2xl grid place-items-center mb-2 ${tones[tone]}`}>{icon}</div>
      <p className="text-xs text-cocoa-light font-semibold">{label}</p>
      <p className="font-display text-lg font-extrabold text-cocoa mt-0.5">{value}</p>
    </div>
  )
}

function Row({ label, value, bold, muted, tone }: { label: string; value: string; bold?: boolean; muted?: boolean; tone?: 'ok' | 'danger' }) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn('text-cocoa-light', bold && 'font-bold text-cocoa')}>{label}</span>
      <span className={cn('text-cocoa', bold && 'font-extrabold', muted && 'text-cocoa-light', tone === 'ok' && 'text-ok', tone === 'danger' && 'text-danger')}>{value}</span>
    </div>
  )
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: 'danger' | 'cocoa' }) {
  return (
    <div className="rounded-2xl bg-blush/40 p-3 text-center">
      <p className="text-[11px] text-cocoa-light">{label}</p>
      <p className={cn('font-bold mt-0.5', tone === 'danger' ? 'text-danger' : 'text-cocoa')}>{value}</p>
    </div>
  )
}
