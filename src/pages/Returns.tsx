import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Undo2 } from 'lucide-react'
import { db } from '@/lib/db'
import { money, num, fmtDate } from '@/lib/format'
import { Empty, Field, Modal, PageHeader } from '@/components/ui'
import { createReturn } from '@/data/repo'
import { useAuth } from '@/store/auth'
import { toast } from '@/store/ui'
import type { Sale, SaleItem } from '@/lib/types'

export default function Returns() {
  const { isAdmin, profile } = useAuth()
  const returns = useLiveQuery(() => db.returns.orderBy('created_at').reverse().toArray(), []) ?? []
  const [open, setOpen] = useState(false)

  if (!isAdmin) return <div className="card p-10 text-center"><p className="font-bold text-cocoa">المرتجعات للمالك والمدير فقط</p></div>

  return (
    <div>
      <PageHeader title="المرتجعات" subtitle={`${num(returns.length)} مرتجع`} action={<button className="btn-primary" onClick={() => setOpen(true)}><Plus size={18} /> مرتجع جديد</button>} />

      {returns.length === 0 ? (
        <div className="card"><Empty icon={<Undo2 size={40} />} title="مفيش مرتجعات" hint="اضغط «مرتجع جديد» لإرجاع صنف من فاتورة" /></div>
      ) : (
        <div className="space-y-2">
          {returns.map((r) => (
            <div key={r.id} className="card p-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-cocoa">{r.return_no}</p>
                <p className="text-xs text-cocoa-light">{fmtDate(r.created_at)}{r.reason ? ` · ${r.reason}` : ''}{r.restock ? ' · رجع للمخزون' : ''}</p>
              </div>
              <span className="font-bold text-danger">- {money(r.total)}</span>
            </div>
          ))}
        </div>
      )}

      {open && <ReturnModal onClose={() => setOpen(false)} userId={profile?.id ?? null} />}
    </div>
  )
}

function ReturnModal({ onClose, userId }: { onClose: () => void; userId: string | null }) {
  const sales = useLiveQuery(() => db.sales.where('status').equals('completed').reverse().sortBy('created_at'), []) ?? []
  const methods = useLiveQuery(() => db.payment_methods.toArray(), []) ?? []
  const [saleId, setSaleId] = useState<string>('')
  const items = useLiveQuery(
    () => (saleId ? db.sale_items.where('sale_id').equals(saleId).toArray() : Promise.resolve([] as SaleItem[])),
    [saleId],
  ) ?? []
  const [qtys, setQtys] = useState<Record<string, number>>({})
  const [methodId, setMethodId] = useState<string | null>(null)
  const [restock, setRestock] = useState(true)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const sale = sales.find((s) => s.id === saleId) as Sale | undefined
  const total = useMemo(() => items.reduce((s, it) => s + (qtys[it.id] || 0) * it.unit_price, 0), [items, qtys])

  function pickSale(id: string) {
    setSaleId(id)
    setQtys({})
  }

  async function save() {
    const lines = items
      .filter((it) => (qtys[it.id] || 0) > 0)
      .map((it) => ({ product_id: it.product_id ?? '', product_name: it.product_name, qty: qtys[it.id], unit_price: it.unit_price }))
    if (lines.length === 0) return toast('حدد كمية مرتجعة', 'error')
    setBusy(true)
    try {
      await createReturn({ sale_id: saleId || null, customer_id: sale?.customer_id ?? null, lines, refund_method_id: methodId, restock, reason: reason || null, created_by: userId })
      toast('تم تسجيل المرتجع 🌸')
      onClose()
    } catch { toast('حصل خطأ', 'error') } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title="مرتجع جديد" wide
      footer={<><button className="btn-ghost" onClick={onClose}>إلغاء</button><button className="btn-primary" onClick={save} disabled={busy || total <= 0}>حفظ ({money(total)})</button></>}>
      <div className="space-y-4">
        <Field label="اختر الفاتورة">
          <select className="input" value={saleId} onChange={(e) => pickSale(e.target.value)}>
            <option value="">— اختر فاتورة —</option>
            {sales.slice(0, 80).map((s) => (
              <option key={s.id} value={s.id}>{s.invoice_no} · {money(s.total)} · {fmtDate(s.created_at)}</option>
            ))}
          </select>
        </Field>

        {saleId && (
          <>
            <div>
              <p className="label">الأصناف المرتجعة</p>
              {items.length === 0 ? (
                <p className="text-sm text-cocoa-light">لا توجد أصناف</p>
              ) : (
                <div className="space-y-2">
                  {items.map((it) => (
                    <div key={it.id} className="flex items-center gap-3 bg-blush/40 rounded-2xl p-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-cocoa truncate">{it.product_name}</p>
                        <p className="text-xs text-cocoa-light">اتباع {num(it.qty)} · {money(it.unit_price)}</p>
                      </div>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={it.qty}
                        className="input w-24 py-1.5 text-center"
                        placeholder="0"
                        value={qtys[it.id] || ''}
                        onChange={(e) => setQtys((q) => ({ ...q, [it.id]: Math.min(it.qty, Math.max(0, +e.target.value || 0)) }))}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="طريقة استرجاع الفلوس">
                <select className="input" value={methodId ?? ''} onChange={(e) => setMethodId(e.target.value || null)}>
                  <option value="">— بدون استرجاع نقدي —</option>
                  {methods.map((m) => <option key={m.id} value={m.id}>{m.name_ar ?? m.name}</option>)}
                </select>
              </Field>
              <Field label="السبب">
                <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مقاس/عيب/تبديل…" />
              </Field>
            </div>

            <label className="flex items-center gap-2 text-sm font-semibold text-cocoa cursor-pointer">
              <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
              رجوع الأصناف للمخزون (لو سليمة)
            </label>
          </>
        )}
      </div>
    </Modal>
  )
}
