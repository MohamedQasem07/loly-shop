import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, ReceiptText } from 'lucide-react'
import { db } from '@/lib/db'
import { money, num, fmtDate, todayISO } from '@/lib/format'
import { Empty, Field, Modal, PageHeader } from '@/components/ui'
import { addExpense } from '@/data/repo'
import { useAuth } from '@/store/auth'
import { toast } from '@/store/ui'

export default function Expenses() {
  const { isAdmin, profile } = useAuth()
  const expenses = useLiveQuery(() => db.expenses.orderBy('spent_at').reverse().toArray(), []) ?? []
  const cats = useLiveQuery(() => db.expense_categories.toArray(), []) ?? []
  const methods = useLiveQuery(() => db.payment_methods.toArray(), []) ?? []
  const [open, setOpen] = useState(false)

  const catName = (id: string | null) => cats.find((c) => c.id === id)?.name_ar ?? '—'
  const methodName = (id: string | null) => methods.find((m) => m.id === id)?.name_ar ?? ''

  const totals = useMemo(() => {
    const today = todayISO()
    const all = expenses.reduce((s, e) => s + e.amount, 0)
    const todaySum = expenses.filter((e) => e.spent_at === today).reduce((s, e) => s + e.amount, 0)
    return { all, today: todaySum }
  }, [expenses])

  if (!isAdmin) return <NoAccess />

  return (
    <div>
      <PageHeader title="المصاريف" subtitle={`إجمالي ${money(totals.all)}`} action={<button className="btn-primary" onClick={() => setOpen(true)}><Plus size={18} /> مصروف</button>} />

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card p-4"><p className="text-xs text-cocoa-light font-semibold">مصاريف اليوم</p><p className="font-display text-xl font-extrabold text-danger mt-1">{money(totals.today)}</p></div>
        <div className="card p-4"><p className="text-xs text-cocoa-light font-semibold">الإجمالي</p><p className="font-display text-xl font-extrabold text-cocoa mt-1">{money(totals.all)}</p></div>
      </div>

      {expenses.length === 0 ? (
        <div className="card"><Empty icon={<ReceiptText size={40} />} title="مفيش مصاريف" hint="اضغط «مصروف» لتسجيل أول مصروف" /></div>
      ) : (
        <div className="space-y-2">
          {expenses.map((e) => (
            <div key={e.id} className="card p-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-cocoa">{catName(e.category_id)}</p>
                <p className="text-xs text-cocoa-light">{fmtDate(e.spent_at)}{e.description ? ` · ${e.description}` : ''}{methodName(e.payment_method_id) ? ` · ${methodName(e.payment_method_id)}` : ''}</p>
              </div>
              <span className="font-bold text-danger shrink-0">- {money(e.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {open && <ExpenseModal onClose={() => setOpen(false)} userId={profile?.id ?? null} />}
    </div>
  )
}

function ExpenseModal({ onClose, userId }: { onClose: () => void; userId: string | null }) {
  const cats = useLiveQuery(() => db.expense_categories.toArray(), []) ?? []
  const methods = useLiveQuery(() => db.payment_methods.toArray(), []) ?? []
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [amount, setAmount] = useState(0)
  const [methodId, setMethodId] = useState<string | null>(null)
  const [desc, setDesc] = useState('')
  const [date, setDate] = useState(todayISO())
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!amount || amount <= 0) return toast('اكتب المبلغ', 'error')
    setBusy(true)
    try {
      await addExpense({ category_id: categoryId, amount, payment_method_id: methodId, description: desc || null, spent_at: date, created_by: userId })
      toast('تم تسجيل المصروف')
      onClose()
    } catch { toast('حصل خطأ', 'error') } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title="مصروف جديد"
      footer={<><button className="btn-ghost" onClick={onClose}>إلغاء</button><button className="btn-primary" onClick={save} disabled={busy}>حفظ</button></>}>
      <div className="space-y-4">
        <Field label="نوع المصروف">
          <select className="input" value={categoryId ?? ''} onChange={(e) => setCategoryId(e.target.value || null)}>
            <option value="">— اختر —</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name_ar ?? c.name}</option>)}
          </select>
        </Field>
        <Field label="المبلغ"><input type="number" inputMode="decimal" className="input" value={amount || ''} onChange={(e) => setAmount(+e.target.value || 0)} /></Field>
        <Field label="طريقة الدفع">
          <select className="input" value={methodId ?? ''} onChange={(e) => setMethodId(e.target.value || null)}>
            <option value="">— بدون —</option>
            {methods.map((m) => <option key={m.id} value={m.id}>{m.name_ar ?? m.name}</option>)}
          </select>
        </Field>
        <Field label="البيان"><input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="تفاصيل المصروف" /></Field>
        <Field label="التاريخ"><input type="date" className="input" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

function NoAccess() {
  return <div className="card p-10 text-center text-cocoa-light"><p className="font-bold text-cocoa">الصفحة دي للمالك والمدير فقط</p></div>
}
