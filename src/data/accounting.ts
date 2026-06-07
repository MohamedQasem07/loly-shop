import { db } from '@/lib/db'
import { uuid } from '@/lib/ids'
import { refreshPending, syncNow } from './sync'
import type {
  JournalEntry, JournalLine, Sale, SaleItem, SalePayment,
  Purchase, PurchaseItem, ReturnDoc, ReturnItem, Expense,
} from '@/lib/types'

const nowISO = () => new Date().toISOString()

/** Stable account codes (match the seeded chart of accounts). */
export const ACC = {
  cash: '1010', ar: '1040', inventory: '1050',
  ap: '2010', tax: '2020', accrued: '2030',
  capital: '3010', drawings: '3020', retained: '3030',
  sales: '4010', salesReturns: '4020', otherIncome: '4040',
  cogs: '5010', shipping: '5070', damage: '5100', otherExpense: '5900',
}

async function maps() {
  const accounts = await db.accounts.toArray()
  const byCode: Record<string, string> = {}
  for (const a of accounts) byCode[a.code] = a.id
  const pms = await db.payment_methods.toArray()
  const pmAcc: Record<string, string | null> = {}
  for (const p of pms) pmAcc[p.id] = p.account_id
  return { byCode, pmAcc }
}

interface LineIn {
  account: string | null | undefined
  debit?: number
  credit?: number
  memo?: string | null
  partner_type?: string | null
  partner_id?: string | null
}

function build(
  source: string,
  source_id: string | null,
  date: string | null,
  memo: string | null,
  created_by: string | null,
  lines: LineIn[],
): { entry: JournalEntry; lines: JournalLine[] } {
  const id = uuid()
  const now = nowISO()
  const entry: JournalEntry = {
    id, entry_no: null, entry_date: (date ?? now).slice(0, 10),
    memo, source, source_id, created_by, created_at: now,
  }
  const jlines: JournalLine[] = lines
    .filter((l) => Math.abs(l.debit ?? 0) > 0.001 || Math.abs(l.credit ?? 0) > 0.001)
    .map((l) => ({
      id: uuid(), entry_id: id, account_id: l.account ?? null,
      debit: +(l.debit ?? 0).toFixed(2), credit: +(l.credit ?? 0).toFixed(2),
      memo: l.memo ?? null, partner_type: l.partner_type ?? null, partner_id: l.partner_id ?? null,
    }))
  return { entry, lines: jlines }
}

async function post(j: { entry: JournalEntry; lines: JournalLine[] }) {
  if (!j.lines.length) return
  await db.transaction('rw', [db.journal_entries, db.journal_lines, db.outbox], async () => {
    await db.journal_entries.put(j.entry)
    await db.outbox.add({ table: 'journal_entries', op: 'upsert', rowId: j.entry.id, payload: j.entry, createdAt: Date.now(), tries: 0 })
    for (const l of j.lines) {
      await db.journal_lines.put(l)
      await db.outbox.add({ table: 'journal_lines', op: 'upsert', rowId: l.id, payload: l, createdAt: Date.now(), tries: 0 })
    }
  })
  await refreshPending()
  void syncNow()
}

async function putRow(table: string, row: Record<string, unknown> & { id: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)[table].put(row)
  await db.outbox.add({ table, op: 'upsert', rowId: row.id, payload: row, createdAt: Date.now(), tries: 0 })
}

// ============================================================
// Automatic postings for business operations
// ============================================================

interface PayIn { payment_method_id: string; amount: number }

export async function postSale(sale: Sale, _items: SaleItem[], payments: PayIn[]) {
  const { byCode, pmAcc } = await maps()
  const taxable = +(sale.subtotal - sale.discount).toFixed(2)
  const lines: LineIn[] = []
  for (const p of payments) lines.push({ account: pmAcc[p.payment_method_id] ?? byCode[ACC.cash], debit: p.amount })
  lines.push({ account: byCode[ACC.sales], credit: taxable, memo: sale.invoice_no })
  if (sale.tax) lines.push({ account: byCode[ACC.tax], credit: sale.tax })
  if (sale.cost_total) {
    lines.push({ account: byCode[ACC.cogs], debit: sale.cost_total })
    lines.push({ account: byCode[ACC.inventory], credit: sale.cost_total })
  }
  await post(build('sale', sale.id, sale.created_at, `بيع ${sale.invoice_no}`, sale.cashier_id, lines))
}

export async function postPurchase(purchase: Purchase, _items: PurchaseItem[]) {
  const { byCode, pmAcc } = await maps()
  const lines: LineIn[] = [{ account: byCode[ACC.inventory], debit: purchase.subtotal }]
  if (purchase.extra_costs) lines.push({ account: byCode[ACC.shipping], debit: purchase.extra_costs })
  if (purchase.paid_amount > 0 && purchase.payment_method_id)
    lines.push({ account: pmAcc[purchase.payment_method_id] ?? byCode[ACC.cash], credit: purchase.paid_amount })
  const credit = +(purchase.total - purchase.paid_amount).toFixed(2)
  if (credit > 0.001) lines.push({ account: byCode[ACC.ap], credit, partner_type: 'supplier', partner_id: purchase.supplier_id })
  await post(build('purchase', purchase.id, purchase.created_at, `شراء${purchase.ref_no ? ' ' + purchase.ref_no : ''}`, purchase.created_by, lines))
}

export async function postExpense(exp: Expense) {
  const { byCode, pmAcc } = await maps()
  const cat = exp.category_id ? await db.expense_categories.get(exp.category_id) : undefined
  const expAcc = cat?.account_id ?? byCode[ACC.otherExpense]
  const lines: LineIn[] = [{ account: expAcc, debit: exp.amount }]
  if (exp.payment_method_id) lines.push({ account: pmAcc[exp.payment_method_id] ?? byCode[ACC.cash], credit: exp.amount })
  else lines.push({ account: byCode[ACC.accrued], credit: exp.amount })
  await post(build('expense', exp.id, exp.created_at, exp.description ?? 'مصروف', exp.created_by, lines))
}

export async function postReturn(ret: ReturnDoc, items: ReturnItem[]) {
  const { byCode, pmAcc } = await maps()
  const lines: LineIn[] = [{ account: byCode[ACC.salesReturns], debit: ret.total }]
  if (ret.refund_method_id) {
    lines.push({ account: pmAcc[ret.refund_method_id] ?? byCode[ACC.cash], credit: ret.total })
  } else {
    lines.push({ account: byCode[ACC.ar], credit: ret.total, partner_type: ret.customer_id ? 'customer' : null, partner_id: ret.customer_id })
  }
  if (ret.restock) {
    let costBack = 0
    for (const it of items) {
      if (it.product_id) {
        const p = await db.products.get(it.product_id)
        if (p) costBack += it.qty * p.cost
      }
    }
    costBack = +costBack.toFixed(2)
    if (costBack > 0.001) {
      lines.push({ account: byCode[ACC.inventory], debit: costBack })
      lines.push({ account: byCode[ACC.cogs], credit: costBack })
    }
  }
  await post(build('return', ret.id, ret.created_at, `مرتجع ${ret.return_no}`, ret.created_by, lines))
}

export async function postVoidSale(sale: Sale, _items: SaleItem[], payments: SalePayment[]) {
  const { byCode, pmAcc } = await maps()
  const taxable = +(sale.subtotal - sale.discount).toFixed(2)
  const lines: LineIn[] = []
  for (const p of payments) if (p.payment_method_id) lines.push({ account: pmAcc[p.payment_method_id] ?? byCode[ACC.cash], credit: p.amount })
  lines.push({ account: byCode[ACC.sales], debit: taxable, memo: sale.invoice_no })
  if (sale.tax) lines.push({ account: byCode[ACC.tax], debit: sale.tax })
  if (sale.cost_total) {
    lines.push({ account: byCode[ACC.cogs], credit: sale.cost_total })
    lines.push({ account: byCode[ACC.inventory], debit: sale.cost_total })
  }
  await post(build('void', sale.id, null, `إلغاء فاتورة ${sale.invoice_no}`, sale.voided_by, lines))
}

export async function postAdjust(productId: string, deltaQty: number, note?: string | null, userId?: string | null) {
  const { byCode } = await maps()
  const p = await db.products.get(productId)
  const value = +(Math.abs(deltaQty) * (p?.cost ?? 0)).toFixed(2)
  if (value < 0.001) return
  const lines: LineIn[] =
    deltaQty < 0
      ? [{ account: byCode[ACC.damage], debit: value }, { account: byCode[ACC.inventory], credit: value }]
      : [{ account: byCode[ACC.inventory], debit: value }, { account: byCode[ACC.damage], credit: value }]
  await post(build('adjustment', productId, null, note ?? 'تسوية مخزون', userId ?? null, lines))
}

// ============================================================
// Manual financial operations
// ============================================================

export async function ownerCapital(amount: number, methodId: string, userId?: string | null) {
  const { byCode } = await maps()
  const created = nowISO()
  const method = await db.payment_methods.get(methodId)
  const acc = method?.account_id ?? byCode[ACC.cash]
  await putRow('treasury_movements', { id: uuid(), payment_method_id: methodId, direction: 'in', amount, ref_table: 'capital', ref_id: null, note: 'رأس مال', created_by: userId ?? null, created_at: created })
  await post(build('capital', null, created, 'إيداع رأس مال', userId ?? null, [
    { account: acc, debit: amount },
    { account: byCode[ACC.capital], credit: amount },
  ]))
}

export async function ownerDrawings(amount: number, methodId: string, userId?: string | null) {
  const { byCode } = await maps()
  const created = nowISO()
  const method = await db.payment_methods.get(methodId)
  const acc = method?.account_id ?? byCode[ACC.cash]
  await putRow('treasury_movements', { id: uuid(), payment_method_id: methodId, direction: 'out', amount, ref_table: 'drawings', ref_id: null, note: 'مسحوبات شخصية', created_by: userId ?? null, created_at: created })
  await post(build('drawings', null, created, 'مسحوبات صاحب المحل', userId ?? null, [
    { account: byCode[ACC.drawings], debit: amount },
    { account: acc, credit: amount },
  ]))
}

export async function paySupplier(supplierId: string, amount: number, methodId: string, userId?: string | null) {
  const { byCode } = await maps()
  const created = nowISO()
  const method = await db.payment_methods.get(methodId)
  const acc = method?.account_id ?? byCode[ACC.cash]
  await putRow('treasury_movements', { id: uuid(), payment_method_id: methodId, direction: 'out', amount, ref_table: 'supplier_payment', ref_id: supplierId, note: 'سداد لمورد', created_by: userId ?? null, created_at: created })
  const sup = await db.suppliers.get(supplierId)
  if (sup) await putRow('suppliers', { ...sup, balance: +(sup.balance - amount).toFixed(2) })
  await post(build('payment_out', supplierId, created, 'سداد لمورد', userId ?? null, [
    { account: byCode[ACC.ap], debit: amount, partner_type: 'supplier', partner_id: supplierId },
    { account: acc, credit: amount },
  ]))
}

export async function receiveFromCustomer(customerId: string, amount: number, methodId: string, userId?: string | null) {
  const { byCode } = await maps()
  const created = nowISO()
  const method = await db.payment_methods.get(methodId)
  const acc = method?.account_id ?? byCode[ACC.cash]
  await putRow('treasury_movements', { id: uuid(), payment_method_id: methodId, direction: 'in', amount, ref_table: 'customer_receipt', ref_id: customerId, note: 'تحصيل من عميل', created_by: userId ?? null, created_at: created })
  await post(build('payment_in', customerId, created, 'تحصيل من عميل', userId ?? null, [
    { account: acc, debit: amount },
    { account: byCode[ACC.ar], credit: amount, partner_type: 'customer', partner_id: customerId },
  ]))
}

export async function transferFunds(fromMethodId: string, toMethodId: string, amount: number, userId?: string | null) {
  const { byCode } = await maps()
  const created = nowISO()
  const from = await db.payment_methods.get(fromMethodId)
  const to = await db.payment_methods.get(toMethodId)
  const fromAcc = from?.account_id ?? byCode[ACC.cash]
  const toAcc = to?.account_id ?? byCode[ACC.cash]
  await putRow('treasury_movements', { id: uuid(), payment_method_id: fromMethodId, direction: 'out', amount, ref_table: 'transfer', ref_id: null, note: 'تحويل', created_by: userId ?? null, created_at: created })
  await putRow('treasury_movements', { id: uuid(), payment_method_id: toMethodId, direction: 'in', amount, ref_table: 'transfer', ref_id: null, note: 'تحويل', created_by: userId ?? null, created_at: created })
  await post(build('transfer', null, created, 'تحويل بين الخزائن', userId ?? null, [
    { account: toAcc, debit: amount },
    { account: fromAcc, credit: amount },
  ]))
}

/** One-time opening balances: cash + inventory value against capital. */
export async function postOpeningBalances(cash: number, inventoryValue: number, userId?: string | null) {
  const { byCode } = await maps()
  const created = nowISO()
  const lines: LineIn[] = []
  if (cash > 0) lines.push({ account: byCode[ACC.cash], debit: cash })
  if (inventoryValue > 0) lines.push({ account: byCode[ACC.inventory], debit: inventoryValue })
  const total = (cash > 0 ? cash : 0) + (inventoryValue > 0 ? inventoryValue : 0)
  if (total <= 0) return
  if (cash > 0) await putRow('treasury_movements', { id: uuid(), payment_method_id: (await db.payment_methods.where('code').equals('cash').first())?.id, direction: 'in', amount: cash, ref_table: 'opening', ref_id: null, note: 'رصيد افتتاحي', created_by: userId ?? null, created_at: created })
  lines.push({ account: byCode[ACC.capital], credit: total })
  await post(build('opening', null, created, 'الأرصدة الافتتاحية / رأس المال', userId ?? null, lines))
}
