import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowDownCircle, ArrowUpCircle, Lock, Unlock, Wallet } from 'lucide-react'
import { db } from '@/lib/db'
import { money, fmtDateTime, fmtDate } from '@/lib/format'
import { Field, Modal, PageHeader, Empty } from '@/components/ui'
import { openCashSession, closeCashSession } from '@/data/repo'
import { useAuth } from '@/store/auth'
import { toast } from '@/store/ui'

export default function Treasury() {
  const { isAdmin, profile } = useAuth()
  const methods = useLiveQuery(() => db.payment_methods.toArray(), []) ?? []
  const treasury = useLiveQuery(() => db.treasury_movements.toArray(), []) ?? []
  const sessions = useLiveQuery(() => db.cash_sessions.orderBy('opened_at').reverse().toArray(), []) ?? []
  const [openSess, setOpenSess] = useState(false)
  const [closeSess, setCloseSess] = useState(false)

  const balances = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of treasury) m.set(t.payment_method_id, (m.get(t.payment_method_id) ?? 0) + (t.direction === 'in' ? t.amount : -t.amount))
    return methods.slice().sort((a, b) => a.sort_order - b.sort_order).map((mm) => ({ method: mm, bal: m.get(mm.id) ?? 0 }))
  }, [treasury, methods])

  const active = sessions.find((s) => !s.closed_at) ?? null
  const methodName = (id: string) => methods.find((m) => m.id === id)?.name_ar ?? ''
  const recent = treasury.slice().sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 40)

  if (!isAdmin) return <div className="card p-10 text-center"><p className="font-bold text-cocoa">الخزينة للمالك والمدير فقط</p></div>

  return (
    <div className="space-y-5">
      <PageHeader title="الخزينة" subtitle="أرصدة طرق الدفع وجلسة الكاشير" />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {balances.map(({ method, bal }) => (
          <div key={method.id} className="card p-4">
            <div className="w-9 h-9 rounded-2xl bg-rose/10 text-rose grid place-items-center mb-2"><Wallet size={18} /></div>
            <p className="text-xs text-cocoa-light font-semibold">{method.name_ar ?? method.name}</p>
            <p className={`font-bold mt-0.5 ${bal < 0 ? 'text-danger' : 'text-cocoa'}`}>{money(bal)}</p>
          </div>
        ))}
      </div>

      {/* Cash session */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-cocoa">جلسة الكاشير</h2>
          {active ? (
            <button className="btn-danger text-sm py-2" onClick={() => setCloseSess(true)}><Lock size={16} /> إقفال الجلسة</button>
          ) : (
            <button className="btn-primary text-sm py-2" onClick={() => setOpenSess(true)}><Unlock size={16} /> فتح جلسة</button>
          )}
        </div>
        {active ? (
          <div className="rounded-2xl bg-blush/40 p-4">
            <p className="text-sm text-cocoa">جلسة مفتوحة منذ <span className="font-bold">{fmtDateTime(active.opened_at)}</span></p>
            <p className="text-sm text-cocoa-light mt-1">رصيد افتتاحي: <span className="font-bold text-cocoa">{money(active.opening_cash)}</span></p>
          </div>
        ) : (
          <p className="text-sm text-cocoa-light">مفيش جلسة مفتوحة. افتح جلسة في بداية الوردية وأقفلها في الآخر عشان تطابق الكاش.</p>
        )}
      </div>

      {/* Recent movements */}
      <div className="card p-4">
        <h2 className="font-bold text-cocoa mb-3">آخر الحركات</h2>
        {recent.length === 0 ? (
          <Empty title="مفيش حركات خزينة بعد" />
        ) : (
          <ul className="divide-y divide-pink/40">
            {recent.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                {t.direction === 'in' ? <ArrowDownCircle className="text-ok shrink-0" size={20} /> : <ArrowUpCircle className="text-danger shrink-0" size={20} />}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-cocoa text-sm">{methodName(t.payment_method_id)}{t.note ? ` · ${t.note}` : ''}</p>
                  <p className="text-[11px] text-cocoa-light">{fmtDateTime(t.created_at)}</p>
                </div>
                <span className={`font-bold ${t.direction === 'in' ? 'text-ok' : 'text-danger'}`}>{t.direction === 'in' ? '+' : '-'} {money(t.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Closed sessions history */}
      {sessions.filter((s) => s.closed_at).length > 0 && (
        <div className="card p-4">
          <h2 className="font-bold text-cocoa mb-3">جلسات سابقة</h2>
          <ul className="divide-y divide-pink/40">
            {sessions.filter((s) => s.closed_at).slice(0, 10).map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-cocoa-light">{fmtDate(s.opened_at)}</span>
                <span className="text-cocoa">متوقع {money(s.expected_cash ?? 0)} · فعلي {money(s.closing_cash ?? 0)}</span>
                <span className={`font-bold ${(s.difference ?? 0) === 0 ? 'text-ok' : 'text-danger'}`}>{(s.difference ?? 0) >= 0 ? '+' : ''}{money(s.difference ?? 0)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {openSess && <OpenModal onClose={() => setOpenSess(false)} userId={profile?.id ?? null} />}
      {closeSess && active && <CloseModal session={active} onClose={() => setCloseSess(false)} />}
    </div>
  )
}

function OpenModal({ onClose, userId }: { onClose: () => void; userId: string | null }) {
  const [amount, setAmount] = useState(0)
  const [busy, setBusy] = useState(false)
  async function go() {
    setBusy(true)
    try { await openCashSession(amount, userId); toast('تم فتح الجلسة'); onClose() }
    catch { toast('حصل خطأ', 'error') } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="فتح جلسة كاشير"
      footer={<><button className="btn-ghost" onClick={onClose}>إلغاء</button><button className="btn-primary" onClick={go} disabled={busy}>فتح</button></>}>
      <Field label="الرصيد الافتتاحي في الدرج (كاش)"><input type="number" inputMode="decimal" className="input" value={amount || ''} onChange={(e) => setAmount(+e.target.value || 0)} autoFocus /></Field>
    </Modal>
  )
}

function CloseModal({ session, onClose }: { session: { id: string; opening_cash: number }; onClose: () => void }) {
  const [actual, setActual] = useState(0)
  const [busy, setBusy] = useState(false)
  async function go() {
    setBusy(true)
    try { await closeCashSession(session.id, actual); toast('تم إقفال الجلسة'); onClose() }
    catch { toast('حصل خطأ', 'error') } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="إقفال الجلسة"
      footer={<><button className="btn-ghost" onClick={onClose}>إلغاء</button><button className="btn-primary" onClick={go} disabled={busy}>إقفال</button></>}>
      <p className="text-sm text-cocoa-light mb-3">عُد الكاش الفعلي في الدرج واكتبه، والنظام هيحسب الفرق مع المتوقع.</p>
      <Field label="الكاش الفعلي في الدرج"><input type="number" inputMode="decimal" className="input" value={actual || ''} onChange={(e) => setActual(+e.target.value || 0)} autoFocus /></Field>
    </Modal>
  )
}
