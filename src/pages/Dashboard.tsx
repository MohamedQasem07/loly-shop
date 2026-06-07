import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, Coins, Receipt, ShoppingBag, TrendingUp, Wallet,
} from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis,
} from 'recharts'
import { format, subDays } from 'date-fns'
import { ar } from 'date-fns/locale'
import { db } from '@/lib/db'
import { money, num, fmtDateTime } from '@/lib/format'
import { Empty } from '@/components/ui'
import { useAuth } from '@/store/auth'
import type { ReactNode } from 'react'

const isSameDay = (d: string, ref: Date) => format(new Date(d), 'yyyy-MM-dd') === format(ref, 'yyyy-MM-dd')

export default function Dashboard() {
  const { profile } = useAuth()
  const sales = useLiveQuery(() => db.sales.toArray(), []) ?? []
  const items = useLiveQuery(() => db.sale_items.toArray(), []) ?? []
  const expenses = useLiveQuery(() => db.expenses.toArray(), []) ?? []
  const products = useLiveQuery(() => db.products.toArray(), []) ?? []
  const methods = useLiveQuery(() => db.payment_methods.toArray(), []) ?? []
  const treasury = useLiveQuery(() => db.treasury_movements.toArray(), []) ?? []

  const stats = useMemo(() => {
    const today = new Date()
    const completed = sales.filter((s) => s.status === 'completed')
    const todaySales = completed.filter((s) => isSameDay(s.created_at, today))
    const todayTotal = todaySales.reduce((s, r) => s + r.total, 0)
    const todayProfit = todaySales.reduce((s, r) => s + (r.total - r.cost_total), 0)
    const todayExpenses = expenses.filter((e) => isSameDay(e.created_at, today)).reduce((s, e) => s + e.amount, 0)

    // treasury balance per method
    const balByMethod = new Map<string, number>()
    for (const t of treasury) {
      const cur = balByMethod.get(t.payment_method_id) ?? 0
      balByMethod.set(t.payment_method_id, cur + (t.direction === 'in' ? t.amount : -t.amount))
    }
    const balances = methods
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => ({ method: m, balance: balByMethod.get(m.id) ?? 0 }))

    // low stock
    const lowStock = products
      .filter((p) => p.is_active && p.low_stock_threshold > 0 && p.stock_qty <= p.low_stock_threshold)
      .sort((a, b) => a.stock_qty - b.stock_qty)

    // last 7 days chart
    const chart = Array.from({ length: 7 }).map((_, i) => {
      const d = subDays(today, 6 - i)
      const total = completed.filter((s) => isSameDay(s.created_at, d)).reduce((s, r) => s + r.total, 0)
      return { label: format(d, 'EEE', { locale: ar }), total: Math.round(total) }
    })

    // best sellers (completed only)
    const completedIds = new Set(completed.map((s) => s.id))
    const byProduct = new Map<string, { name: string; qty: number }>()
    for (const it of items) {
      if (!completedIds.has(it.sale_id)) continue
      const cur = byProduct.get(it.product_name) ?? { name: it.product_name, qty: 0 }
      cur.qty += it.qty
      byProduct.set(it.product_name, cur)
    }
    const best = [...byProduct.values()].sort((a, b) => b.qty - a.qty).slice(0, 5)

    const recent = completed
      .slice()
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
      .slice(0, 5)

    return { todayTotal, todayProfit, todayExpenses, count: todaySales.length, balances, lowStock, chart, best, recent }
  }, [sales, items, expenses, products, methods, treasury])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-cocoa">
          أهلاً {profile?.full_name?.split(' ')[0] ?? ''} 🌸
        </h1>
        <p className="text-sm text-cocoa-light mt-0.5">{format(new Date(), 'EEEE d MMMM yyyy', { locale: ar })}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={<ShoppingBag />} label="مبيعات اليوم" value={money(stats.todayTotal)} tone="rose" />
        <Stat icon={<TrendingUp />} label="ربح اليوم" value={money(stats.todayProfit)} tone="gold" />
        <Stat icon={<Receipt />} label="عدد الفواتير" value={num(stats.count)} tone="cocoa" />
        <Stat icon={<Coins />} label="مصاريف اليوم" value={money(stats.todayExpenses)} tone="danger" />
      </div>

      {/* Treasury balances */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3 text-cocoa">
          <Wallet size={18} className="text-rose" />
          <h2 className="font-bold">أرصدة الخزينة</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {stats.balances.map(({ method, balance }) => (
            <div key={method.id} className="rounded-2xl bg-blush/50 border border-pink/40 p-3">
              <p className="text-xs text-cocoa-light font-semibold">{method.name_ar ?? method.name}</p>
              <p className={`font-bold mt-1 ${balance < 0 ? 'text-danger' : 'text-cocoa'}`}>{money(balance)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* 7-day chart */}
        <div className="card p-4">
          <h2 className="font-bold text-cocoa mb-3">مبيعات آخر ٧ أيام</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chart} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F8C8DC" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#8A6A55' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => [money(v), 'مبيعات']}
                  contentStyle={{ borderRadius: 16, border: '1px solid #F8C8DC', fontSize: 13 }}
                  cursor={{ fill: '#FCE7F0' }}
                />
                <Bar dataKey="total" fill="#E85B9E" radius={[8, 8, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Best sellers */}
        <div className="card p-4">
          <h2 className="font-bold text-cocoa mb-3">الأكثر مبيعاً</h2>
          {stats.best.length === 0 ? (
            <Empty title="لسه مفيش مبيعات" hint="ابدأ البيع من نقطة البيع" />
          ) : (
            <ul className="space-y-2">
              {stats.best.map((b, i) => (
                <li key={b.name} className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-gold/15 text-gold-dark grid place-items-center text-sm font-bold">
                    {i + 1}
                  </span>
                  <span className="flex-1 font-semibold text-cocoa truncate">{b.name}</span>
                  <span className="chip bg-rose/10 text-rose">{num(b.qty)} قطعة</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Low stock */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-cocoa flex items-center gap-2">
              <AlertTriangle size={18} className="text-warn" /> منتجات قاربت تخلص
            </h2>
            <Link to="/products" className="text-rose text-sm font-semibold flex items-center gap-1">
              الكل <ArrowLeft size={14} />
            </Link>
          </div>
          {stats.lowStock.length === 0 ? (
            <Empty title="المخزون تمام 👌" hint="مفيش منتجات تحت حد التنبيه" />
          ) : (
            <ul className="space-y-2">
              {stats.lowStock.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center gap-3">
                  <span className="flex-1 font-semibold text-cocoa truncate">{p.name}</span>
                  <span className="chip bg-warn/15 text-warn">متبقي {num(p.stock_qty)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent sales */}
        <div className="card p-4">
          <h2 className="font-bold text-cocoa mb-3">آخر المبيعات</h2>
          {stats.recent.length === 0 ? (
            <Empty title="لسه مفيش فواتير" />
          ) : (
            <ul className="divide-y divide-pink/40">
              {stats.recent.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <p className="font-bold text-cocoa">{s.invoice_no}</p>
                    <p className="text-xs text-cocoa-light">{fmtDateTime(s.created_at)}</p>
                  </div>
                  <span className="font-bold text-rose">{money(s.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: 'rose' | 'gold' | 'cocoa' | 'danger' }) {
  const tones: Record<string, string> = {
    rose: 'bg-rose-grad text-white',
    gold: 'bg-gold-grad text-white',
    cocoa: 'bg-cocoa text-white',
    danger: 'bg-danger text-white',
  }
  return (
    <div className="card p-4 hover:shadow-soft transition">
      <div className={`w-10 h-10 rounded-2xl grid place-items-center mb-3 shadow-soft ${tones[tone]}`}>{icon}</div>
      <p className="text-xs text-cocoa-light font-semibold">{label}</p>
      <p className="font-display text-xl font-extrabold text-cocoa mt-0.5">{value}</p>
    </div>
  )
}
