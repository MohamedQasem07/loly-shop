import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2, Truck } from 'lucide-react'
import { db } from '@/lib/db'
import { money, num, fmtDate } from '@/lib/format'
import { Empty, Field, Modal, PageHeader } from '@/components/ui'
import { createPurchase, type PurchaseLineInput } from '@/data/repo'
import { useAuth } from '@/store/auth'
import { toast } from '@/store/ui'

export default function Purchases() {
  const { profile } = useAuth()
  const canManage = ['owner', 'manager', 'stock'].includes(profile?.role ?? '')
  const purchases = useLiveQuery(() => db.purchases.orderBy('received_at').reverse().toArray(), []) ?? []
  const suppliers = useLiveQuery(() => db.suppliers.toArray(), []) ?? []
  const items = useLiveQuery(() => db.purchase_items.toArray(), []) ?? []
  const [open, setOpen] = useState(false)

  const supplierName = (id: string | null) => suppliers.find((s) => s.id === id)?.name ?? '—'
  const itemCount = (pid: string) => items.filter((i) => i.purchase_id === pid).length

  return (
    <div>
      <PageHeader
        title="استلام البضاعة"
        subtitle={`${num(purchases.length)} عملية`}
        action={canManage && <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={18} /> استلام جديد</button>}
      />

      {purchases.length === 0 ? (
        <div className="card"><Empty icon={<Truck size={40} />} title="مفيش عمليات استلام" hint={canManage ? 'اضغط «استلام جديد» لما تشتري بضاعة' : undefined} /></div>
      ) : (
        <div className="space-y-2">
          {purchases.map((p) => (
            <div key={p.id} className="card p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-cocoa">{supplierName(p.supplier_id)}</p>
                <p className="text-xs text-cocoa-light">{fmtDate(p.received_at)} · {num(itemCount(p.id))} صنف{p.ref_no ? ` · ${p.ref_no}` : ''}</p>
              </div>
              <div className="text-left shrink-0">
                <p className="font-bold text-rose">{money(p.total)}</p>
                {p.total - p.paid_amount > 0 && <p className="text-[11px] text-danger">آجل {money(p.total - p.paid_amount)}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {open && <PurchaseModal onClose={() => setOpen(false)} cashierId={profile?.id ?? null} />}
    </div>
  )
}

interface DraftLine extends PurchaseLineInput { }

function PurchaseModal({ onClose, cashierId }: { onClose: () => void; cashierId: string | null }) {
  const products = useLiveQuery(() => db.products.filter((p) => p.is_active).toArray(), []) ?? []
  const suppliers = useLiveQuery(() => db.suppliers.toArray(), []) ?? []
  const methods = useLiveQuery(() => db.payment_methods.toArray(), []) ?? []
  const [lines, setLines] = useState<DraftLine[]>([])
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [refNo, setRefNo] = useState('')
  const [extra, setExtra] = useState(0)
  const [methodId, setMethodId] = useState<string | null>(null)
  const [paid, setPaid] = useState(0)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.qty * l.unit_cost, 0), [lines])
  const total = subtotal + (extra || 0)

  function addProduct(id: string) {
    const p = products.find((x) => x.id === id)
    if (!p || lines.some((l) => l.product_id === id)) return
    setLines((ls) => [...ls, { product_id: p.id, product_name: p.name, qty: 1, unit_cost: p.cost }])
  }
  function update(id: string, patch: Partial<DraftLine>) {
    setLines((ls) => ls.map((l) => (l.product_id === id ? { ...l, ...patch } : l)))
  }
  function removeLine(id: string) {
    setLines((ls) => ls.filter((l) => l.product_id !== id))
  }

  async function save() {
    if (lines.length === 0) return toast('أضف منتج واحد على الأقل', 'error')
    if (lines.some((l) => l.qty <= 0)) return toast('الكميات لازم تكون أكبر من صفر', 'error')
    setBusy(true)
    try {
      await createPurchase({
        supplier_id: supplierId,
        ref_no: refNo || null,
        extra_costs: extra || 0,
        payment_method_id: methodId,
        paid_amount: paid || 0,
        note: note || null,
        lines,
        created_by: cashierId,
      })
      toast('تم استلام البضاعة وتحديث المخزون 🌸')
      onClose()
    } catch { toast('حصل خطأ في الحفظ', 'error') } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title="استلام بضاعة" wide
      footer={<><button className="btn-ghost" onClick={onClose}>إلغاء</button><button className="btn-primary" onClick={save} disabled={busy}>حفظ ({money(total)})</button></>}>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="المورد">
            <select className="input" value={supplierId ?? ''} onChange={(e) => setSupplierId(e.target.value || null)}>
              <option value="">— بدون —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="رقم فاتورة المورد"><input className="input" dir="ltr" value={refNo} onChange={(e) => setRefNo(e.target.value)} /></Field>
        </div>

        <div>
          <p className="label">المنتجات</p>
          <select className="input mb-2" value="" onChange={(e) => { addProduct(e.target.value); e.target.value = '' }}>
            <option value="">+ أضف منتج للقائمة…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          {lines.length === 0 ? (
            <p className="text-sm text-cocoa-light text-center py-4 bg-blush/30 rounded-2xl">لسه مفيش منتجات — اختر من القائمة فوق</p>
          ) : (
            <div className="space-y-2">
              {lines.map((l) => (
                <div key={l.product_id} className="bg-blush/40 rounded-2xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-cocoa">{l.product_name}</span>
                    <button onClick={() => removeLine(l.product_id)} className="text-danger"><Trash2 size={16} /></button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-end">
                    <label className="text-xs text-cocoa-light">الكمية
                      <input type="number" inputMode="decimal" className="input mt-1 py-1.5" value={l.qty || ''} onChange={(e) => update(l.product_id, { qty: +e.target.value || 0 })} />
                    </label>
                    <label className="text-xs text-cocoa-light">تكلفة الوحدة
                      <input type="number" inputMode="decimal" className="input mt-1 py-1.5" value={l.unit_cost || ''} onChange={(e) => update(l.product_id, { unit_cost: +e.target.value || 0 })} />
                    </label>
                    <div className="text-left">
                      <p className="text-xs text-cocoa-light">الإجمالي</p>
                      <p className="font-bold text-cocoa">{money(l.qty * l.unit_cost)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="مصاريف إضافية (شحن/جمارك)"><input type="number" inputMode="decimal" className="input" value={extra || ''} onChange={(e) => setExtra(+e.target.value || 0)} /></Field>
          <Field label="طريقة الدفع">
            <select className="input" value={methodId ?? ''} onChange={(e) => setMethodId(e.target.value || null)}>
              <option value="">— آجل / بدون —</option>
              {methods.map((m) => <option key={m.id} value={m.id}>{m.name_ar ?? m.name}</option>)}
            </select>
          </Field>
        </div>

        <div className="flex items-end gap-2">
          <Field label="المدفوع"><input type="number" inputMode="decimal" className="input" value={paid || ''} onChange={(e) => setPaid(+e.target.value || 0)} /></Field>
          <button className="btn-ghost mb-0.5" onClick={() => setPaid(total)}>دفع الكل</button>
        </div>

        <Field label="ملاحظة"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>

        <div className="rounded-2xl bg-blush/50 p-3 flex items-center justify-between">
          <span className="text-cocoa-light text-sm">الإجمالي ({num(lines.length)} صنف)</span>
          <span className="font-display text-xl font-extrabold text-rose">{money(total)}</span>
        </div>
      </div>
    </Modal>
  )
}
