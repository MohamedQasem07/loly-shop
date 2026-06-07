import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { startOfMonth, startOfYear } from 'date-fns'
import { db } from '@/lib/db'
import { money } from '@/lib/format'
import { PageHeader, Empty } from '@/components/ui'
import { useAuth } from '@/store/auth'
import { cn } from '@/lib/cn'
import type { Account, AccountType } from '@/lib/types'

type Tab = 'trial' | 'income' | 'balance' | 'ledger' | 'coa'
type RangeKey = 'month' | 'year' | 'all'

const TABS: { key: Tab; label: string }[] = [
  { key: 'trial', label: 'ميزان المراجعة' },
  { key: 'income', label: 'قائمة الدخل' },
  { key: 'balance', label: 'الميزانية' },
  { key: 'ledger', label: 'دفتر الأستاذ' },
  { key: 'coa', label: 'شجرة الحسابات' },
]

export default function Accounting() {
  const { isAdmin } = useAuth()
  const accounts = useLiveQuery(() => db.accounts.toArray(), []) ?? []
  const lines = useLiveQuery(() => db.journal_lines.toArray(), []) ?? []
  const entries = useLiveQuery(() => db.journal_entries.toArray(), []) ?? []
  const [tab, setTab] = useState<Tab>('trial')
  const [range, setRange] = useState<RangeKey>('all')

  const byId = useMemo(() => {
    const m = new Map<string, Account>()
    for (const a of accounts) m.set(a.id, a)
    return m
  }, [accounts])

  const entryDate = useMemo(() => {
    const m = new Map<string, string>()
    for (const e of entries) m.set(e.id, e.entry_date)
    return m
  }, [entries])

  const from = useMemo(() => {
    const now = new Date()
    if (range === 'month') return startOfMonth(now)
    if (range === 'year') return startOfYear(now)
    return new Date(0)
  }, [range])

  // net (debit - credit) per account, cumulative and within-range
  const calc = useMemo(() => {
    const netAll = new Map<string, number>()
    const netRange = new Map<string, number>()
    for (const l of lines) {
      if (!l.account_id) continue
      const v = l.debit - l.credit
      netAll.set(l.account_id, (netAll.get(l.account_id) ?? 0) + v)
      const d = entryDate.get(l.entry_id)
      if (d && new Date(d) >= from) netRange.set(l.account_id, (netRange.get(l.account_id) ?? 0) + v)
    }
    return { netAll, netRange }
  }, [lines, entryDate, from])

  const sumByType = (net: Map<string, number>, type: AccountType, signCreditPositive: boolean) => {
    let total = 0
    for (const [id, v] of net) {
      const a = byId.get(id)
      if (a?.type === type) total += signCreditPositive ? -v : v
    }
    return total
  }

  if (!isAdmin) return <div className="card p-10 text-center"><p className="font-bold text-cocoa">الحسابات للمالك والمدير فقط</p></div>

  const revenue = sumByType(calc.netRange, 'revenue', true)
  const expenses = sumByType(calc.netRange, 'expense', false)
  const netProfitPeriod = revenue - expenses
  // for balance sheet (cumulative)
  const assets = sumByType(calc.netAll, 'asset', false)
  const liabilities = sumByType(calc.netAll, 'liability', true)
  const equityBase = sumByType(calc.netAll, 'equity', true)
  const profitAll = sumByType(calc.netAll, 'revenue', true) - sumByType(calc.netAll, 'expense', false)

  return (
    <div className="space-y-5">
      <PageHeader title="الحسابات" subtitle="القوائم المالية — قيد مزدوج" />

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('shrink-0 rounded-full px-4 py-1.5 text-sm font-bold border transition', tab === t.key ? 'bg-rose text-white border-rose' : 'bg-white text-cocoa-light border-pink')}>
            {t.label}
          </button>
        ))}
      </div>

      {(tab === 'income' || tab === 'trial') && (
        <div className="flex gap-2">
          {([['month', 'الشهر'], ['year', 'السنة'], ['all', 'الكل']] as [RangeKey, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setRange(k)} className={cn('rounded-full px-3 py-1 text-xs font-bold border', range === k ? 'bg-gold text-white border-gold' : 'bg-white text-cocoa-light border-pink')}>{l}</button>
          ))}
        </div>
      )}

      {tab === 'trial' && <TrialBalance net={range === 'all' ? calc.netAll : calc.netRange} byId={byId} />}
      {tab === 'income' && <IncomeStatement net={calc.netRange} byId={byId} revenue={revenue} expenses={expenses} profit={netProfitPeriod} />}
      {tab === 'balance' && <BalanceSheet net={calc.netAll} byId={byId} assets={assets} liabilities={liabilities} equity={equityBase} profit={profitAll} />}
      {tab === 'ledger' && <Ledger accounts={accounts} lines={lines} entryDate={entryDate} />}
      {tab === 'coa' && <ChartOfAccounts accounts={accounts} net={calc.netAll} />}
    </div>
  )
}

function leafRows(net: Map<string, number>, byId: Map<string, Account>) {
  return [...net.entries()]
    .map(([id, v]) => ({ acc: byId.get(id), net: v }))
    .filter((r) => r.acc && !r.acc.is_group && Math.abs(r.net) > 0.001)
    .sort((a, b) => (a.acc!.code).localeCompare(b.acc!.code))
}

function TrialBalance({ net, byId }: { net: Map<string, number>; byId: Map<string, Account> }) {
  const rows = leafRows(net, byId)
  const totalDr = rows.reduce((s, r) => s + (r.net > 0 ? r.net : 0), 0)
  const totalCr = rows.reduce((s, r) => s + (r.net < 0 ? -r.net : 0), 0)
  if (!rows.length) return <div className="card"><Empty title="لسه مفيش حركات محاسبية" hint="هتظهر تلقائياً مع أول بيع/شراء/مصروف" /></div>
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-blush/50 text-cocoa-light">
          <tr><th className="text-right p-3">الحساب</th><th className="text-left p-3">مدين</th><th className="text-left p-3">دائن</th></tr>
        </thead>
        <tbody className="divide-y divide-pink/30">
          {rows.map((r) => (
            <tr key={r.acc!.id}>
              <td className="p-3 text-cocoa font-semibold">{r.acc!.name_ar ?? r.acc!.name}</td>
              <td className="p-3 text-left">{r.net > 0 ? money(r.net) : ''}</td>
              <td className="p-3 text-left">{r.net < 0 ? money(-r.net) : ''}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-blush/40 font-extrabold text-cocoa">
            <td className="p-3">الإجمالي</td>
            <td className="p-3 text-left">{money(totalDr)}</td>
            <td className="p-3 text-left">{money(totalCr)}</td>
          </tr>
        </tfoot>
      </table>
      <p className={cn('text-center text-xs py-2', Math.abs(totalDr - totalCr) < 0.01 ? 'text-ok' : 'text-danger')}>
        {Math.abs(totalDr - totalCr) < 0.01 ? '✓ الميزان متوازن' : '⚠ الميزان غير متوازن'}
      </p>
    </div>
  )
}

function IncomeStatement({ net, byId, revenue, expenses, profit }: { net: Map<string, number>; byId: Map<string, Account>; revenue: number; expenses: number; profit: number }) {
  const rows = leafRows(net, byId)
  const rev = rows.filter((r) => r.acc!.type === 'revenue')
  const exp = rows.filter((r) => r.acc!.type === 'expense')
  return (
    <div className="space-y-4">
      <Section title="الإيرادات" rows={rev.map((r) => ({ name: r.acc!.name_ar ?? r.acc!.name, value: -r.net }))} total={revenue} tone="ok" />
      <Section title="المصروفات (شاملة تكلفة البضاعة)" rows={exp.map((r) => ({ name: r.acc!.name_ar ?? r.acc!.name, value: r.net }))} total={expenses} tone="danger" />
      <div className="card p-5 flex items-center justify-between">
        <span className="font-display text-lg font-extrabold text-cocoa">صافي الربح / الخسارة</span>
        <span className={cn('font-display text-2xl font-extrabold', profit >= 0 ? 'text-ok' : 'text-danger')}>{money(profit)}</span>
      </div>
    </div>
  )
}

function BalanceSheet({ net, byId, assets, liabilities, equity, profit }: { net: Map<string, number>; byId: Map<string, Account>; assets: number; liabilities: number; equity: number; profit: number }) {
  const rows = leafRows(net, byId)
  const a = rows.filter((r) => r.acc!.type === 'asset').map((r) => ({ name: r.acc!.name_ar ?? r.acc!.name, value: r.net }))
  const l = rows.filter((r) => r.acc!.type === 'liability').map((r) => ({ name: r.acc!.name_ar ?? r.acc!.name, value: -r.net }))
  const e = rows.filter((r) => r.acc!.type === 'equity').map((r) => ({ name: r.acc!.name_ar ?? r.acc!.name, value: -r.net }))
  e.push({ name: 'أرباح الفترة الحالية', value: profit })
  const totalEq = equity + profit
  const balanced = Math.abs(assets - (liabilities + totalEq)) < 0.01
  return (
    <div className="space-y-4">
      <Section title="الأصول" rows={a} total={assets} tone="ok" />
      <Section title="الخصوم" rows={l} total={liabilities} tone="danger" />
      <Section title="حقوق الملكية" rows={e} total={totalEq} tone="gold" />
      <div className={cn('card p-4 text-center font-bold', balanced ? 'text-ok' : 'text-danger')}>
        {balanced ? '✓ الميزانية متوازنة' : '⚠ غير متوازنة'} — الأصول {money(assets)} = الخصوم + حقوق الملكية {money(liabilities + totalEq)}
      </div>
    </div>
  )
}

function Section({ title, rows, total, tone }: { title: string; rows: { name: string; value: number }[]; total: number; tone: 'ok' | 'danger' | 'gold' }) {
  return (
    <div className="card p-4">
      <h3 className="font-bold text-cocoa mb-2">{title}</h3>
      {rows.length === 0 ? <p className="text-sm text-cocoa-light">—</p> : (
        <ul className="space-y-1.5 text-sm">
          {rows.map((r, i) => (
            <li key={i} className="flex justify-between"><span className="text-cocoa-light">{r.name}</span><span className="text-cocoa font-semibold">{money(r.value)}</span></li>
          ))}
        </ul>
      )}
      <div className="border-t border-pink/40 mt-2 pt-2 flex justify-between font-bold">
        <span className="text-cocoa">الإجمالي</span>
        <span className={cn(tone === 'ok' && 'text-ok', tone === 'danger' && 'text-danger', tone === 'gold' && 'text-gold-dark')}>{money(total)}</span>
      </div>
    </div>
  )
}

function Ledger({ accounts, lines, entryDate }: { accounts: Account[]; lines: { account_id: string | null; entry_id: string; debit: number; credit: number; memo: string | null }[]; entryDate: Map<string, string> }) {
  const [accId, setAccId] = useState('')
  const postable = accounts.filter((a) => !a.is_group).sort((a, b) => a.code.localeCompare(b.code))
  const rows = useMemo(() => {
    const ls = lines.filter((l) => l.account_id === accId)
      .map((l) => ({ ...l, date: entryDate.get(l.entry_id) ?? '' }))
      .sort((a, b) => a.date.localeCompare(b.date))
    let bal = 0
    return ls.map((l) => { bal += l.debit - l.credit; return { ...l, bal } })
  }, [lines, accId, entryDate])
  return (
    <div className="space-y-3">
      <select className="input" value={accId} onChange={(e) => setAccId(e.target.value)}>
        <option value="">— اختر حساب —</option>
        {postable.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name_ar ?? a.name}</option>)}
      </select>
      {!accId ? <div className="card"><Empty title="اختر حساب لعرض حركته" /></div> : rows.length === 0 ? <div className="card"><Empty title="مفيش حركات على الحساب ده" /></div> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-blush/50 text-cocoa-light"><tr><th className="p-2 text-right">التاريخ</th><th className="p-2">البيان</th><th className="p-2 text-left">مدين</th><th className="p-2 text-left">دائن</th><th className="p-2 text-left">الرصيد</th></tr></thead>
            <tbody className="divide-y divide-pink/30">
              {rows.map((r, i) => (
                <tr key={i}><td className="p-2 text-cocoa-light whitespace-nowrap">{r.date}</td><td className="p-2 text-cocoa">{r.memo ?? ''}</td><td className="p-2 text-left">{r.debit ? money(r.debit) : ''}</td><td className="p-2 text-left">{r.credit ? money(r.credit) : ''}</td><td className="p-2 text-left font-semibold">{money(r.bal)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ChartOfAccounts({ accounts, net }: { accounts: Account[]; net: Map<string, number> }) {
  const groups = accounts.filter((a) => a.is_group).sort((a, b) => a.code.localeCompare(b.code))
  const childrenOf = (id: string) => accounts.filter((a) => a.parent_id === id).sort((x, y) => x.code.localeCompare(y.code))
  const bal = (a: Account) => {
    const v = net.get(a.id) ?? 0
    return (a.type === 'asset' || a.type === 'expense') ? v : -v
  }
  return (
    <div className="card p-4 space-y-3">
      {groups.filter((g) => !g.parent_id).map((g) => (
        <div key={g.id}>
          <p className="font-extrabold text-rose">{g.code} · {g.name_ar ?? g.name}</p>
          <ul className="mr-3 mt-1 space-y-1">
            {childrenOf(g.id).map((c) => (
              <li key={c.id}>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-cocoa">{c.code} · {c.name_ar ?? c.name}{c.is_group ? '' : ''}</span>
                  {!c.is_group && <span className="text-cocoa-light">{money(bal(c))}</span>}
                </div>
                {c.is_group && (
                  <ul className="mr-4 mt-1 space-y-0.5">
                    {childrenOf(c.id).map((gc) => (
                      <li key={gc.id} className="flex justify-between text-xs text-cocoa-light"><span>{gc.code} · {gc.name_ar ?? gc.name}</span><span>{money(bal(gc))}</span></li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
