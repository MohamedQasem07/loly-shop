import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Building2, Phone, Pencil, Plus, Search } from 'lucide-react'
import { db } from '@/lib/db'
import { money, fmtDate, num } from '@/lib/format'
import { Empty, Field, Modal, PageHeader } from '@/components/ui'
import { saveSupplier } from '@/data/repo'
import { useAuth } from '@/store/auth'
import { toast } from '@/store/ui'
import type { Supplier } from '@/lib/types'

export default function Suppliers() {
  const { profile } = useAuth()
  const canManage = ['owner', 'manager', 'stock'].includes(profile?.role ?? '')
  const suppliers = useLiveQuery(() => db.suppliers.toArray(), []) ?? []
  const purchases = useLiveQuery(() => db.purchases.toArray(), []) ?? []
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [adding, setAdding] = useState(false)

  const stats = useMemo(() => {
    const m = new Map<string, { total: number; count: number; last: string | null }>()
    for (const p of purchases) {
      if (!p.supplier_id) continue
      const cur = m.get(p.supplier_id) ?? { total: 0, count: 0, last: null }
      cur.total += p.total
      cur.count += 1
      if (!cur.last || p.received_at > cur.last) cur.last = p.received_at
      m.set(p.supplier_id, cur)
    }
    return m
  }, [purchases])

  const filtered = suppliers
    .filter((s) => (q ? s.name.toLowerCase().includes(q.toLowerCase()) || (s.phone ?? '').includes(q) : true))
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'))

  return (
    <div>
      <PageHeader
        title="الموردين"
        subtitle={`${num(suppliers.length)} مورد`}
        action={canManage && <button className="btn-primary" onClick={() => setAdding(true)}><Plus size={18} /> مورد جديد</button>}
      />

      <div className="relative mb-4">
        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-cocoa-light" />
        <input className="input pr-10" placeholder="ابحث بالاسم أو الهاتف…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="card"><Empty icon={<Building2 size={40} />} title="مفيش موردين" hint={canManage ? 'اضغط «مورد جديد»' : undefined} /></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((s) => {
            const st = stats.get(s.id)
            return (
              <div key={s.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-blush grid place-items-center text-rose shrink-0"><Building2 size={20} /></div>
                    <div className="min-w-0">
                      <p className="font-bold text-cocoa truncate">{s.name}</p>
                      {s.phone && <p className="text-xs text-cocoa-light flex items-center gap-1"><Phone size={12} /> {s.phone}</p>}
                    </div>
                  </div>
                  {canManage && <button onClick={() => setEditing(s)} className="text-cocoa-light hover:text-rose"><Pencil size={16} /></button>}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <Mini label="مشتريات" value={money(st?.total ?? 0)} />
                  <Mini label="عمليات" value={num(st?.count ?? 0)} />
                  <Mini label="مستحق" value={money(s.balance)} danger={s.balance > 0} />
                </div>
                {st?.last && <p className="text-[11px] text-cocoa-light mt-2 text-center">آخر شراء: {fmtDate(st.last)}</p>}
              </div>
            )
          })}
        </div>
      )}

      {(adding || editing) && <SupplierModal supplier={editing} onClose={() => { setAdding(false); setEditing(null) }} />}
    </div>
  )
}

function Mini({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-xl bg-blush/40 py-1.5">
      <p className="text-[10px] text-cocoa-light">{label}</p>
      <p className={`text-xs font-bold ${danger ? 'text-danger' : 'text-cocoa'}`}>{value}</p>
    </div>
  )
}

function SupplierModal({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const isNew = !supplier
  const [form, setForm] = useState({
    name: supplier?.name ?? '',
    phone: supplier?.phone ?? '',
    address: supplier?.address ?? '',
    notes: supplier?.notes ?? '',
  })
  const [busy, setBusy] = useState(false)
  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }))

  async function submit() {
    if (!form.name.trim()) return toast('اكتب اسم المورد', 'error')
    setBusy(true)
    try {
      await saveSupplier({ id: supplier?.id, ...form, name: form.name.trim() })
      toast(isNew ? 'تمت إضافة المورد' : 'تم الحفظ')
      onClose()
    } catch { toast('حصل خطأ', 'error') } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'مورد جديد' : 'تعديل المورد'}
      footer={<><button className="btn-ghost" onClick={onClose}>إلغاء</button><button className="btn-primary" onClick={submit} disabled={busy}>حفظ</button></>}>
      <div className="space-y-4">
        <Field label="اسم المورد"><input className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="رقم الهاتف"><input className="input" dir="ltr" value={form.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
        <Field label="العنوان"><input className="input" value={form.address} onChange={(e) => set({ address: e.target.value })} /></Field>
        <Field label="ملاحظات"><textarea className="input min-h-[70px]" value={form.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}
