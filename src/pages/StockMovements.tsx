import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Boxes, Search } from 'lucide-react'
import { db } from '@/lib/db'
import { num, fmtDateTime } from '@/lib/format'
import { Empty, PageHeader } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { StockMoveType } from '@/lib/types'

const TYPE_LABEL: Record<StockMoveType, string> = {
  initial: 'رصيد افتتاحي',
  purchase: 'شراء',
  sale: 'بيع',
  return_in: 'مرتجع/إلغاء',
  return_out: 'مرتجع خارج',
  adjustment: 'تعديل',
  damage: 'تالف',
  transfer: 'تحويل',
}

export default function StockMovements() {
  const movements = useLiveQuery(() => db.stock_movements.orderBy('created_at').reverse().toArray(), []) ?? []
  const products = useLiveQuery(() => db.products.toArray(), []) ?? []
  const [q, setQ] = useState('')
  const [type, setType] = useState<string>('all')

  const prodName = (id: string) => products.find((p) => p.id === id)?.name ?? '—'

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return movements
      .filter((m) => (type === 'all' ? true : m.type === type))
      .filter((m) => (!term ? true : prodName(m.product_id).toLowerCase().includes(term)))
      .slice(0, 300)
  }, [movements, q, type, products])

  return (
    <div>
      <PageHeader title="حركات المخزون" subtitle={`${num(movements.length)} حركة`} />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-cocoa-light" />
          <input className="input pr-10" placeholder="ابحث باسم المنتج…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input sm:w-48" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="all">كل الأنواع</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card"><Empty icon={<Boxes size={40} />} title="مفيش حركات" hint="الحركات بتتسجل تلقائياً مع البيع والشراء والجرد" /></div>
      ) : (
        <div className="card divide-y divide-pink/40">
          {filtered.map((m) => (
            <div key={m.id} className="flex items-center gap-3 p-3.5">
              <span className={cn('chip shrink-0 w-24 justify-center', typeColor(m.type))}>{TYPE_LABEL[m.type]}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-cocoa truncate">{prodName(m.product_id)}</p>
                <p className="text-[11px] text-cocoa-light">{fmtDateTime(m.created_at)}{m.note ? ` · ${m.note}` : ''}</p>
              </div>
              <span className={cn('font-bold shrink-0', m.qty >= 0 ? 'text-ok' : 'text-danger')}>{m.qty >= 0 ? '+' : ''}{num(m.qty)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function typeColor(t: StockMoveType): string {
  switch (t) {
    case 'sale': return 'bg-rose/10 text-rose'
    case 'purchase': return 'bg-ok/15 text-ok'
    case 'initial': return 'bg-gold/15 text-gold-dark'
    case 'return_in': return 'bg-blush text-cocoa'
    case 'damage': return 'bg-danger/10 text-danger'
    case 'adjustment': return 'bg-warn/15 text-warn'
    default: return 'bg-blush text-cocoa-light'
  }
}
