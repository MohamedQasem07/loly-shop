import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { MessageCircle, Pencil, Phone, Plus, Search, Star, Users } from 'lucide-react'
import { db } from '@/lib/db'
import { money, num, fmtDate } from '@/lib/format'
import { Empty, Field, Modal, PageHeader } from '@/components/ui'
import { saveCustomer } from '@/data/repo'
import { useAuth } from '@/store/auth'
import { toast } from '@/store/ui'
import { cn } from '@/lib/cn'
import type { Customer, Settings } from '@/lib/types'

export default function Customers() {
  const { profile } = useAuth()
  const canManage = ['owner', 'manager', 'cashier'].includes(profile?.role ?? '')
  const customers = useLiveQuery(() => db.customers.toArray(), []) ?? []
  const sales = useLiveQuery(() => db.sales.toArray(), []) ?? []
  const settings = useLiveQuery(() => db.settings.get(1), []) as Settings | undefined
  const storeName = settings?.store_name ?? 'Loly Store'
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Customer | null>(null)
  const [viewing, setViewing] = useState<Customer | null>(null)
  const [adding, setAdding] = useState(false)

  const stats = useMemo(() => {
    const m = new Map<string, { total: number; count: number; last: string | null }>()
    for (const s of sales) {
      if (!s.customer_id || s.status !== 'completed') continue
      const cur = m.get(s.customer_id) ?? { total: 0, count: 0, last: null }
      cur.total += s.total
      cur.count += 1
      if (!cur.last || s.created_at > cur.last) cur.last = s.created_at
      m.set(s.customer_id, cur)
    }
    return m
  }, [sales])

  const filtered = customers
    .filter((c) => (q ? c.name.toLowerCase().includes(q.toLowerCase()) || (c.phone ?? '').includes(q) : true))
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'))

  return (
    <div>
      <PageHeader title="العملاء" subtitle={`${num(customers.length)} عميل`} action={canManage && <button className="btn-primary" onClick={() => setAdding(true)}><Plus size={18} /> عميل جديد</button>} />

      <div className="relative mb-4">
        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-cocoa-light" />
        <input className="input pr-10" placeholder="ابحث بالاسم أو الهاتف…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="card"><Empty icon={<Users size={40} />} title="مفيش عملاء" hint={canManage ? 'اضغط «عميل جديد»' : undefined} /></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => {
            const st = stats.get(c.id)
            const vip = (st?.count ?? 0) >= 5 || (st?.total ?? 0) >= 2000
            const wa = (c.whatsapp || c.phone || '').replace(/\D/g, '')
            return (
              <div key={c.id} onClick={() => setViewing(c)} className="card p-4 cursor-pointer hover:shadow-soft hover:-translate-y-0.5 transition">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn('w-10 h-10 rounded-full grid place-items-center font-bold shrink-0', vip ? 'bg-gold-grad text-white' : 'bg-rose/15 text-rose')}>{c.name.slice(0, 1)}</div>
                    <div className="min-w-0">
                      <p className="font-bold text-cocoa truncate flex items-center gap-1">{c.name}{vip && <Star size={13} className="text-gold fill-gold shrink-0" />}</p>
                      {c.phone && <p className="text-xs text-cocoa-light flex items-center gap-1"><Phone size={12} /> {c.phone}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {wa && (
                      <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-ok"><MessageCircle size={18} /></a>
                    )}
                    {canManage && <button onClick={(e) => { e.stopPropagation(); setEditing(c) }} className="text-cocoa-light hover:text-rose"><Pencil size={16} /></button>}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <Mini label="مشتريات" value={money(st?.total ?? 0)} />
                  <Mini label="فواتير" value={num(st?.count ?? 0)} />
                  <Mini label="آخر شراء" value={st?.last ? fmtDate(st.last) : '—'} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {(adding || editing) && <CustomerModal customer={editing} onClose={() => { setAdding(false); setEditing(null) }} />}
      {viewing && <CustomerDetail customer={viewing} storeName={storeName} onClose={() => setViewing(null)} onEdit={() => { setEditing(viewing); setViewing(null) }} />}
    </div>
  )
}

function CustomerDetail({ customer, storeName, onClose, onEdit }: { customer: Customer; storeName: string; onClose: () => void; onEdit: () => void }) {
  const allSales = useLiveQuery(() => db.sales.toArray(), []) ?? []
  const allOrders = useLiveQuery(() => db.orders.toArray(), []) ?? []
  const sales = allSales
    .filter((s) => s.customer_id === customer.id && s.status !== 'voided')
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
  const phoneDigits = (customer.phone ?? '').replace(/\D/g, '')
  const orders = phoneDigits
    ? allOrders.filter((o) => o.customer_phone.replace(/\D/g, '') === phoneDigits).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    : []
  const totalSpent = sales.reduce((s, x) => s + x.total, 0) + orders.filter((o) => o.status === 'delivered').reduce((s, x) => s + x.total, 0)
  const lastDate = sales[0]?.created_at ?? orders[0]?.created_at ?? null
  const waNum = (customer.whatsapp || customer.phone || '').replace(/\D/g, '')
  const waHref = waNum ? `https://wa.me/${waNum}?text=${encodeURIComponent(`أهلاً ${customer.name} 🌸 معاكي ${storeName}`)}` : null

  return (
    <Modal open onClose={onClose} title={customer.name} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {customer.phone && <a href={`tel:${customer.phone}`} className="chip bg-blush text-cocoa" dir="ltr"><Phone size={13} /> {customer.phone}</a>}
          {waHref && <a href={waHref} target="_blank" rel="noreferrer" className="chip bg-ok/15 text-ok"><MessageCircle size={14} /> محادثة واتساب</a>}
          <button onClick={onEdit} className="chip bg-blush text-cocoa-light"><Pencil size={13} /> تعديل البيانات</button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <Mini label="إجمالي الشراء" value={money(totalSpent)} />
          <Mini label="فواتير الكاشير" value={num(sales.length)} />
          <Mini label="طلبات أونلاين" value={num(orders.length)} />
          <Mini label="آخر تعامل" value={lastDate ? fmtDate(lastDate) : '—'} />
        </div>

        {customer.notes && <div className="rounded-2xl bg-blush/40 p-3 text-sm text-cocoa">📝 {customer.notes}</div>}

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <h4 className="font-bold text-cocoa mb-2 text-sm">فواتير الكاشير ({num(sales.length)})</h4>
            {sales.length === 0 ? <p className="text-xs text-cocoa-light">مفيش فواتير لسه</p> : (
              <ul className="space-y-1.5 max-h-72 overflow-auto pl-1">
                {sales.map((s) => <li key={s.id} className="flex justify-between items-center text-sm bg-blush/30 rounded-xl px-3 py-2"><span className="text-cocoa-light">{s.invoice_no} · {fmtDate(s.created_at)}</span><span className="font-bold text-rose">{money(s.total)}</span></li>)}
              </ul>
            )}
          </div>
          <div>
            <h4 className="font-bold text-cocoa mb-2 text-sm">طلبات المتجر ({num(orders.length)})</h4>
            {orders.length === 0 ? <p className="text-xs text-cocoa-light">مفيش طلبات أونلاين</p> : (
              <ul className="space-y-1.5 max-h-72 overflow-auto pl-1">
                {orders.map((o) => <li key={o.id} className="flex justify-between items-center text-sm bg-blush/30 rounded-xl px-3 py-2"><span className="text-cocoa-light">{o.order_no} · {fmtDate(o.created_at)}</span><span className="font-bold text-rose">{money(o.total)}</span></li>)}
              </ul>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-blush/40 py-1.5"><p className="text-[10px] text-cocoa-light">{label}</p><p className="text-xs font-bold text-cocoa">{value}</p></div>
}

function CustomerModal({ customer, onClose }: { customer: Customer | null; onClose: () => void }) {
  const isNew = !customer
  const [form, setForm] = useState({ name: customer?.name ?? '', phone: customer?.phone ?? '', whatsapp: customer?.whatsapp ?? '', notes: customer?.notes ?? '' })
  const [busy, setBusy] = useState(false)
  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }))

  async function submit() {
    if (!form.name.trim()) return toast('اكتب اسم العميل', 'error')
    setBusy(true)
    try { await saveCustomer({ id: customer?.id, ...form, name: form.name.trim() }); toast(isNew ? 'تمت إضافة العميل' : 'تم الحفظ'); onClose() }
    catch { toast('حصل خطأ', 'error') } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'عميل جديد' : 'تعديل العميل'}
      footer={<><button className="btn-ghost" onClick={onClose}>إلغاء</button><button className="btn-primary" onClick={submit} disabled={busy}>حفظ</button></>}>
      <div className="space-y-4">
        <Field label="الاسم"><input className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="رقم الهاتف"><input className="input" dir="ltr" value={form.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
        <Field label="واتساب" hint="بكود الدولة بدون + مثلاً 201001234567"><input className="input" dir="ltr" value={form.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} /></Field>
        <Field label="ملاحظات"><textarea className="input min-h-[70px]" value={form.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}
