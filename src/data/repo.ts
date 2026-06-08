import { db } from '@/lib/db'
import { uuid } from '@/lib/ids'
import { syncNow, refreshPending } from './sync'
import { postSale, postPurchase, postExpense, postReturn, postVoidSale, postAdjust, recordOtherIncome } from './accounting'
import { docNumber } from '@/lib/counters'
import type {
  Product, Category, Supplier, Customer, Expense, Settings, Order, Discount,
} from '@/lib/types'

const nowISO = () => new Date().toISOString()

// ------------------------------------------------------------------
// Generic write helpers — write locally, then queue for sync
// ------------------------------------------------------------------
async function enqueue(table: string, op: 'upsert' | 'delete', rowId: string, payload: unknown) {
  await db.outbox.add({ table, op, rowId, payload, createdAt: Date.now(), tries: 0 })
}

/** Upsert a single row locally + queue it. */
export async function save<T extends { id: string }>(table: string, row: T): Promise<T> {
  // @ts-expect-error dynamic table access
  await db[table].put(row)
  await enqueue(table, 'upsert', row.id, row)
  await refreshPending()
  void syncNow()
  return row
}

/** Delete a row locally + queue it (admins only, enforced by RLS). */
export async function removeRow(table: string, id: string): Promise<void> {
  // @ts-expect-error dynamic table access
  await db[table].delete(id)
  await enqueue(table, 'delete', id, null)
  await refreshPending()
  void syncNow()
}

/** Local sequential counter for readable document numbers. */
async function nextSeq(key: string, tx = false): Promise<number> {
  const run = async () => {
    const row = await db.meta.get(key)
    const next = (((row?.value as number) ?? 0) + 1)
    await db.meta.put({ key, value: next })
    return next
  }
  return tx ? run() : db.transaction('rw', db.meta, run)
}

// ------------------------------------------------------------------
// Products / catalog
// ------------------------------------------------------------------
export interface ProductInput {
  id?: string
  name: string
  sku?: string | null
  barcode?: string | null
  category_id?: string | null
  image_url?: string | null
  price: number
  cost: number
  stock_qty?: number
  low_stock_threshold?: number
  color?: string | null
  supplier_id?: string | null
  is_active?: boolean
  notes?: string | null
  online?: boolean
  online_price?: number | null
}

export async function saveProduct(input: ProductInput): Promise<Product> {
  const existing = input.id ? await db.products.get(input.id) : undefined
  const product: Product = {
    id: input.id ?? uuid(),
    name: input.name,
    sku: input.sku ?? null,
    barcode: input.barcode ?? null,
    category_id: input.category_id ?? null,
    image_url: input.image_url ?? null,
    price: Number(input.price) || 0,
    cost: Number(input.cost) || 0,
    stock_qty: existing ? existing.stock_qty : Number(input.stock_qty) || 0,
    low_stock_threshold: Number(input.low_stock_threshold) || 0,
    color: input.color ?? null,
    supplier_id: input.supplier_id ?? null,
    is_active: input.is_active ?? true,
    notes: input.notes ?? null,
    online: input.online ?? existing?.online ?? false,
    online_price: input.online_price ?? existing?.online_price ?? null,
    created_at: existing?.created_at ?? nowISO(),
    updated_at: nowISO(),
  }
  // New product with opening stock -> record an initial stock movement
  if (!existing && product.stock_qty !== 0) {
    await save('products', product)
    await addInitialStock(product.id, product.stock_qty)
    return product
  }
  return save('products', product)
}

async function addInitialStock(productId: string, qty: number) {
  const mv = {
    id: uuid(), product_id: productId, type: 'initial' as const, qty,
    ref_table: null, ref_id: null, note: 'رصيد افتتاحي', created_by: null, created_at: nowISO(),
  }
  await save('stock_movements', mv)
}

export async function saveCategory(input: Partial<Category> & { name: string }): Promise<Category> {
  const existing = input.id ? await db.categories.get(input.id) : undefined
  const row: Category = {
    id: input.id ?? uuid(),
    name: input.name,
    name_ar: input.name_ar ?? input.name,
    sort_order: input.sort_order ?? existing?.sort_order ?? 99,
    is_active: input.is_active ?? true,
    created_at: existing?.created_at ?? nowISO(),
  }
  return save('categories', row)
}

export async function saveSupplier(input: Partial<Supplier> & { name: string }): Promise<Supplier> {
  const existing = input.id ? await db.suppliers.get(input.id) : undefined
  const row: Supplier = {
    id: input.id ?? uuid(),
    name: input.name,
    phone: input.phone ?? null,
    address: input.address ?? null,
    notes: input.notes ?? null,
    balance: existing?.balance ?? input.balance ?? 0,
    is_active: input.is_active ?? true,
    created_at: existing?.created_at ?? nowISO(),
  }
  return save('suppliers', row)
}

export async function saveCustomer(input: Partial<Customer> & { name: string }): Promise<Customer> {
  const existing = input.id ? await db.customers.get(input.id) : undefined
  const row: Customer = {
    id: input.id ?? uuid(),
    name: input.name,
    phone: input.phone ?? null,
    whatsapp: input.whatsapp ?? null,
    notes: input.notes ?? null,
    is_active: input.is_active ?? true,
    created_at: existing?.created_at ?? nowISO(),
  }
  return save('customers', row)
}

// ------------------------------------------------------------------
// POS — create a sale (updates stock + treasury, records movements)
// ------------------------------------------------------------------
export interface CartLine {
  product_id: string
  product_name: string
  qty: number
  unit_price: number
  unit_cost: number
  discount?: number
}
export interface PaymentLine {
  payment_method_id: string
  amount: number
}
export interface CreateSaleInput {
  lines: CartLine[]
  payments: PaymentLine[]
  invoiceDiscount?: number
  taxPercent?: number
  customer_id?: string | null
  customerName?: string | null
  customerPhone?: string | null
  cashier_id?: string | null
  note?: string | null
  status?: 'completed' | 'held'
}

/** Find a customer by phone, or create one — so every invoice can carry name + phone. */
async function findOrCreateCustomer(name?: string | null, phone?: string | null): Promise<string | null> {
  const ph = (phone ?? '').trim()
  const nm = (name ?? '').trim()
  if (!ph && !nm) return null
  if (ph) {
    const existing = await db.customers.filter((c) => (c.phone ?? '').trim() === ph).first()
    if (existing) return existing.id
  }
  const cust = await saveCustomer({ name: nm || ph || 'عميل', phone: ph || null })
  return cust.id
}

export async function createSale(input: CreateSaleInput) {
  const saleId = uuid()
  const invoiceNo = await docNumber('INV')
  const created = nowISO()
  const customerId = input.customer_id ?? (await findOrCreateCustomer(input.customerName, input.customerPhone))

  const lineRows = input.lines.map((l) => {
    const lineTotal = l.qty * l.unit_price - (l.discount ?? 0)
    return {
      id: uuid(), sale_id: saleId, product_id: l.product_id, product_name: l.product_name,
      qty: l.qty, unit_price: l.unit_price, unit_cost: l.unit_cost,
      discount: l.discount ?? 0, line_total: lineTotal,
    }
  })
  const subtotal = lineRows.reduce((s, r) => s + r.line_total, 0)
  const invoiceDiscount = input.invoiceDiscount ?? 0
  const taxable = Math.max(0, subtotal - invoiceDiscount)
  const tax = input.taxPercent ? +(taxable * (input.taxPercent / 100)).toFixed(2) : 0
  const total = +(taxable + tax).toFixed(2)
  const costTotal = lineRows.reduce((s, r) => s + r.unit_cost * r.qty, 0)

  const sale = {
    id: saleId, invoice_no: invoiceNo, customer_id: customerId,
    cashier_id: input.cashier_id ?? null, status: input.status ?? 'completed',
    subtotal, discount: invoiceDiscount, tax, total, cost_total: costTotal,
    note: input.note ?? null, voided_at: null, voided_by: null, void_reason: null,
    created_at: created,
  }

  const queued: Array<{ table: string; id: string; payload: unknown }> = []

  await db.transaction(
    'rw',
    [db.sales, db.sale_items, db.sale_payments, db.products, db.stock_movements, db.treasury_movements, db.outbox],
    async () => {
      await db.sales.put(sale)
      queued.push({ table: 'sales', id: sale.id, payload: sale })

      for (const r of lineRows) {
        await db.sale_items.put(r)
        queued.push({ table: 'sale_items', id: r.id, payload: r })
      }
      // Only completed sales affect stock & treasury
      if (sale.status === 'completed') {
        for (const r of lineRows) {
          if (!r.product_id) continue
          const p = await db.products.get(r.product_id)
          if (p) {
            const updated = { ...p, stock_qty: +(p.stock_qty - r.qty).toFixed(2), updated_at: created }
            await db.products.put(updated)
            queued.push({ table: 'products', id: updated.id, payload: updated })
          }
          const mv = {
            id: uuid(), product_id: r.product_id, type: 'sale' as const, qty: -r.qty,
            ref_table: 'sales', ref_id: sale.id, note: invoiceNo, created_by: sale.cashier_id, created_at: created,
          }
          await db.stock_movements.put(mv)
          queued.push({ table: 'stock_movements', id: mv.id, payload: mv })
        }
        for (const pay of input.payments) {
          const pid = uuid()
          const payRow = { id: pid, sale_id: sale.id, payment_method_id: pay.payment_method_id, amount: pay.amount }
          await db.sale_payments.put(payRow)
          queued.push({ table: 'sale_payments', id: pid, payload: payRow })

          const tm = {
            id: uuid(), payment_method_id: pay.payment_method_id, direction: 'in' as const, amount: pay.amount,
            ref_table: 'sales', ref_id: sale.id, note: invoiceNo, created_by: sale.cashier_id, created_at: created,
          }
          await db.treasury_movements.put(tm)
          queued.push({ table: 'treasury_movements', id: tm.id, payload: tm })
        }
      } else {
        // held sale: still store payment intents (optional). Keep simple: no payments yet.
      }

      for (const q of queued) {
        await db.outbox.add({ table: q.table, op: 'upsert', rowId: q.id, payload: q.payload, createdAt: Date.now(), tries: 0 })
      }
    },
  )

  await refreshPending()
  void syncNow()
  if (sale.status === 'completed') await postSale(sale, lineRows, input.payments)
  return { sale, items: lineRows }
}

// ------------------------------------------------------------------
// Purchases — receive stock (weighted-average cost), pay treasury
// ------------------------------------------------------------------
export interface PurchaseLineInput {
  product_id: string
  product_name: string
  qty: number
  unit_cost: number
}
export interface CreatePurchaseInput {
  supplier_id?: string | null
  ref_no?: string | null
  extra_costs?: number
  payment_method_id?: string | null
  paid_amount?: number
  note?: string | null
  lines: PurchaseLineInput[]
  created_by?: string | null
}

export async function createPurchase(input: CreatePurchaseInput) {
  const purchaseId = uuid()
  const created = nowISO()
  const lineRows = input.lines.map((l) => ({
    id: uuid(), purchase_id: purchaseId, product_id: l.product_id, product_name: l.product_name,
    qty: l.qty, unit_cost: l.unit_cost, line_total: +(l.qty * l.unit_cost).toFixed(2),
  }))
  const subtotal = lineRows.reduce((s, r) => s + r.line_total, 0)
  const extra = input.extra_costs ?? 0
  const total = +(subtotal + extra).toFixed(2)
  const paid = input.paid_amount ?? 0

  const purchase = {
    id: purchaseId, ref_no: input.ref_no ?? null, supplier_id: input.supplier_id ?? null,
    status: 'received' as const, subtotal, extra_costs: extra, total,
    payment_method_id: input.payment_method_id ?? null, paid_amount: paid,
    note: input.note ?? null, received_at: created.slice(0, 10), created_by: input.created_by ?? null, created_at: created,
  }

  const queued: Array<{ table: string; id: string; payload: unknown }> = []

  await db.transaction(
    'rw',
    [db.purchases, db.purchase_items, db.products, db.stock_movements, db.treasury_movements, db.suppliers, db.outbox],
    async () => {
      await db.purchases.put(purchase)
      queued.push({ table: 'purchases', id: purchase.id, payload: purchase })

      for (const r of lineRows) {
        await db.purchase_items.put(r)
        queued.push({ table: 'purchase_items', id: r.id, payload: r })

        if (r.product_id) {
          const p = await db.products.get(r.product_id)
          if (p) {
            const oldQty = p.stock_qty
            const newQty = +(oldQty + r.qty).toFixed(2)
            // weighted average cost
            const wac = newQty > 0 ? +(((oldQty * p.cost) + (r.qty * r.unit_cost)) / newQty).toFixed(2) : r.unit_cost
            const updated = { ...p, stock_qty: newQty, cost: wac, updated_at: created }
            await db.products.put(updated)
            queued.push({ table: 'products', id: updated.id, payload: updated })
          }
          const mv = {
            id: uuid(), product_id: r.product_id, type: 'purchase' as const, qty: r.qty,
            ref_table: 'purchases', ref_id: purchase.id, note: input.ref_no ?? null, created_by: purchase.created_by, created_at: created,
          }
          await db.stock_movements.put(mv)
          queued.push({ table: 'stock_movements', id: mv.id, payload: mv })
        }
      }

      if (paid > 0 && purchase.payment_method_id) {
        const tm = {
          id: uuid(), payment_method_id: purchase.payment_method_id, direction: 'out' as const, amount: paid,
          ref_table: 'purchases', ref_id: purchase.id, note: input.ref_no ?? 'شراء بضاعة', created_by: purchase.created_by, created_at: created,
        }
        await db.treasury_movements.put(tm)
        queued.push({ table: 'treasury_movements', id: tm.id, payload: tm })
      }

      // supplier payable (credit portion)
      if (purchase.supplier_id) {
        const sup = await db.suppliers.get(purchase.supplier_id)
        if (sup) {
          const updated = { ...sup, balance: +(sup.balance + (total - paid)).toFixed(2) }
          await db.suppliers.put(updated)
          queued.push({ table: 'suppliers', id: updated.id, payload: updated })
        }
      }

      for (const q of queued) {
        await db.outbox.add({ table: q.table, op: 'upsert', rowId: q.id, payload: q.payload, createdAt: Date.now(), tries: 0 })
      }
    },
  )

  await refreshPending()
  void syncNow()
  await postPurchase(purchase, lineRows)
  return purchase
}

// ------------------------------------------------------------------
// Expenses
// ------------------------------------------------------------------
export interface ExpenseInput {
  category_id?: string | null
  amount: number
  payment_method_id?: string | null
  description?: string | null
  spent_at?: string
  created_by?: string | null
}

export async function addExpense(input: ExpenseInput): Promise<Expense> {
  const created = nowISO()
  const exp: Expense = {
    id: uuid(), category_id: input.category_id ?? null, amount: Number(input.amount) || 0,
    payment_method_id: input.payment_method_id ?? null, description: input.description ?? null,
    receipt_url: null, spent_at: input.spent_at ?? created.slice(0, 10),
    created_by: input.created_by ?? null, created_at: created,
  }
  const queued: Array<{ table: string; id: string; payload: unknown }> = [{ table: 'expenses', id: exp.id, payload: exp }]

  await db.transaction('rw', [db.expenses, db.treasury_movements, db.outbox], async () => {
    await db.expenses.put(exp)
    if (exp.payment_method_id && exp.amount > 0) {
      const tm = {
        id: uuid(), payment_method_id: exp.payment_method_id, direction: 'out' as const, amount: exp.amount,
        ref_table: 'expenses', ref_id: exp.id, note: exp.description, created_by: exp.created_by, created_at: created,
      }
      await db.treasury_movements.put(tm)
      queued.push({ table: 'treasury_movements', id: tm.id, payload: tm })
    }
    for (const q of queued) {
      await db.outbox.add({ table: q.table, op: 'upsert', rowId: q.id, payload: q.payload, createdAt: Date.now(), tries: 0 })
    }
  })

  await refreshPending()
  void syncNow()
  await postExpense(exp)
  return exp
}

// ------------------------------------------------------------------
// Manual stock adjustment / damage
// ------------------------------------------------------------------
export async function adjustStock(productId: string, deltaQty: number, type: 'adjustment' | 'damage', note?: string, userId?: string | null) {
  const created = nowISO()
  const queued: Array<{ table: string; id: string; payload: unknown }> = []
  await db.transaction('rw', [db.products, db.stock_movements, db.outbox], async () => {
    const p = await db.products.get(productId)
    if (p) {
      const updated = { ...p, stock_qty: +(p.stock_qty + deltaQty).toFixed(2), updated_at: created }
      await db.products.put(updated)
      queued.push({ table: 'products', id: updated.id, payload: updated })
    }
    const mv = {
      id: uuid(), product_id: productId, type, qty: deltaQty,
      ref_table: null, ref_id: null, note: note ?? null, created_by: userId ?? null, created_at: created,
    }
    await db.stock_movements.put(mv)
    queued.push({ table: 'stock_movements', id: mv.id, payload: mv })
    for (const q of queued) {
      await db.outbox.add({ table: q.table, op: 'upsert', rowId: q.id, payload: q.payload, createdAt: Date.now(), tries: 0 })
    }
  })
  await refreshPending()
  void syncNow()
  await postAdjust(productId, deltaQty, note, userId)
}

// ------------------------------------------------------------------
// Void a completed sale (reverse stock + treasury), admin only
// ------------------------------------------------------------------
export async function voidSale(saleId: string, reason: string, userId?: string | null) {
  const created = nowISO()
  const pre = await db.sales.get(saleId)
  if (!pre || pre.status === 'voided') return
  const queued: Array<{ table: string; id: string; payload: unknown }> = []
  await db.transaction(
    'rw',
    [db.sales, db.sale_items, db.sale_payments, db.products, db.stock_movements, db.treasury_movements, db.outbox],
    async () => {
      const sale = await db.sales.get(saleId)
      if (!sale || sale.status === 'voided') return
      const items = await db.sale_items.where('sale_id').equals(saleId).toArray()
      const pays = await db.sale_payments.where('sale_id').equals(saleId).toArray()

      // restore stock
      for (const it of items) {
        if (!it.product_id) continue
        const p = await db.products.get(it.product_id)
        if (p) {
          const updated = { ...p, stock_qty: +(p.stock_qty + it.qty).toFixed(2), updated_at: created }
          await db.products.put(updated)
          queued.push({ table: 'products', id: updated.id, payload: updated })
        }
        const mv = {
          id: uuid(), product_id: it.product_id, type: 'return_in' as const, qty: it.qty,
          ref_table: 'sales', ref_id: saleId, note: `إلغاء ${sale.invoice_no}`, created_by: userId ?? null, created_at: created,
        }
        await db.stock_movements.put(mv)
        queued.push({ table: 'stock_movements', id: mv.id, payload: mv })
      }
      // reverse treasury
      for (const pay of pays) {
        if (!pay.payment_method_id) continue
        const tm = {
          id: uuid(), payment_method_id: pay.payment_method_id, direction: 'out' as const, amount: pay.amount,
          ref_table: 'sales', ref_id: saleId, note: `إلغاء ${sale.invoice_no}`, created_by: userId ?? null, created_at: created,
        }
        await db.treasury_movements.put(tm)
        queued.push({ table: 'treasury_movements', id: tm.id, payload: tm })
      }
      const updatedSale = { ...sale, status: 'voided' as const, voided_at: created, voided_by: userId ?? null, void_reason: reason }
      await db.sales.put(updatedSale)
      queued.push({ table: 'sales', id: saleId, payload: updatedSale })

      for (const q of queued) {
        await db.outbox.add({ table: q.table, op: 'upsert', rowId: q.id, payload: q.payload, createdAt: Date.now(), tries: 0 })
      }
    },
  )
  await refreshPending()
  void syncNow()
  const vsale = await db.sales.get(saleId)
  const vitems = await db.sale_items.where('sale_id').equals(saleId).toArray()
  const vpays = await db.sale_payments.where('sale_id').equals(saleId).toArray()
  if (vsale) await postVoidSale(vsale, vitems, vpays)
}

// ------------------------------------------------------------------
// Returns / refunds (reverse stock + treasury)
// ------------------------------------------------------------------
export interface ReturnLineInput {
  product_id: string
  product_name: string
  qty: number
  unit_price: number
}
export interface CreateReturnInput {
  sale_id?: string | null
  customer_id?: string | null
  lines: ReturnLineInput[]
  refund_method_id?: string | null
  restock?: boolean
  reason?: string | null
  created_by?: string | null
}

export async function createReturn(input: CreateReturnInput) {
  const returnId = uuid()
  const returnNo = await docNumber('RET')
  const created = nowISO()
  const restock = input.restock ?? true

  const lineRows = input.lines.map((l) => ({
    id: uuid(), return_id: returnId, product_id: l.product_id, product_name: l.product_name,
    qty: l.qty, unit_price: l.unit_price, line_total: +(l.qty * l.unit_price).toFixed(2),
  }))
  const total = lineRows.reduce((s, r) => s + r.line_total, 0)

  const ret = {
    id: returnId, return_no: returnNo, sale_id: input.sale_id ?? null, customer_id: input.customer_id ?? null,
    total, refund_method_id: input.refund_method_id ?? null, restock, reason: input.reason ?? null,
    created_by: input.created_by ?? null, created_at: created,
  }
  const queued: Array<{ table: string; id: string; payload: unknown }> = []

  await db.transaction(
    'rw',
    [db.returns, db.return_items, db.products, db.stock_movements, db.treasury_movements, db.outbox],
    async () => {
      await db.returns.put(ret)
      queued.push({ table: 'returns', id: ret.id, payload: ret })

      for (const r of lineRows) {
        await db.return_items.put(r)
        queued.push({ table: 'return_items', id: r.id, payload: r })
        if (restock && r.product_id) {
          const p = await db.products.get(r.product_id)
          if (p) {
            const u = { ...p, stock_qty: +(p.stock_qty + r.qty).toFixed(2), updated_at: created }
            await db.products.put(u)
            queued.push({ table: 'products', id: u.id, payload: u })
          }
          const mv = {
            id: uuid(), product_id: r.product_id, type: 'return_in' as const, qty: r.qty,
            ref_table: 'returns', ref_id: returnId, note: returnNo, created_by: ret.created_by, created_at: created,
          }
          await db.stock_movements.put(mv)
          queued.push({ table: 'stock_movements', id: mv.id, payload: mv })
        }
      }

      if (input.refund_method_id && total > 0) {
        const tm = {
          id: uuid(), payment_method_id: input.refund_method_id, direction: 'out' as const, amount: total,
          ref_table: 'returns', ref_id: returnId, note: returnNo, created_by: ret.created_by, created_at: created,
        }
        await db.treasury_movements.put(tm)
        queued.push({ table: 'treasury_movements', id: tm.id, payload: tm })
      }

      for (const q of queued) {
        await db.outbox.add({ table: q.table, op: 'upsert', rowId: q.id, payload: q.payload, createdAt: Date.now(), tries: 0 })
      }
    },
  )

  await refreshPending()
  void syncNow()
  await postReturn(ret, lineRows)
  return ret
}

// ------------------------------------------------------------------
// Settings
// ------------------------------------------------------------------
export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = (await db.settings.get(1)) as Settings | undefined
  const row: Settings = {
    id: 1,
    store_name: patch.store_name ?? current?.store_name ?? 'Loly Store',
    store_phone: patch.store_phone ?? current?.store_phone ?? null,
    store_address: patch.store_address ?? current?.store_address ?? null,
    logo_url: patch.logo_url ?? current?.logo_url ?? null,
    currency: patch.currency ?? current?.currency ?? 'EGP',
    tax_percent: patch.tax_percent ?? current?.tax_percent ?? 0,
    allow_negative_stock: patch.allow_negative_stock ?? current?.allow_negative_stock ?? false,
    receipt_footer: patch.receipt_footer ?? current?.receipt_footer ?? null,
    theme: patch.theme ?? current?.theme ?? null,
    store_open: patch.store_open ?? current?.store_open ?? true,
    shipping_fee: patch.shipping_fee ?? current?.shipping_fee ?? 0,
    store_whatsapp: patch.store_whatsapp ?? current?.store_whatsapp ?? null,
    store_cover_url: patch.store_cover_url ?? current?.store_cover_url ?? null,
    store_about: patch.store_about ?? current?.store_about ?? null,
    store_instagram: patch.store_instagram ?? current?.store_instagram ?? null,
    store_facebook: patch.store_facebook ?? current?.store_facebook ?? null,
    store_tiktok: patch.store_tiktok ?? current?.store_tiktok ?? null,
    store_hours: patch.store_hours ?? current?.store_hours ?? null,
    updated_at: nowISO(),
  }
  await db.settings.put(row)
  await enqueue('settings', 'upsert', '1', row)
  await refreshPending()
  void syncNow()
  return row
}

// ------------------------------------------------------------------
// Cash sessions (shift open/close)
// ------------------------------------------------------------------
export async function openCashSession(openingCash: number, userId?: string | null) {
  const session = {
    id: uuid(), opened_by: userId ?? null, opening_cash: Number(openingCash) || 0,
    closing_cash: null, expected_cash: null, difference: null,
    opened_at: nowISO(), closed_at: null, note: null,
  }
  return save('cash_sessions', session)
}

export async function closeCashSession(sessionId: string, closingCash: number, note?: string | null) {
  const s = await db.cash_sessions.get(sessionId)
  if (!s) return
  const cash = await db.payment_methods.where('code').equals('cash').first()
  let net = 0
  if (cash) {
    const moves = await db.treasury_movements.where('payment_method_id').equals(cash.id).toArray()
    net = moves
      .filter((m) => m.created_at >= s.opened_at)
      .reduce((acc, m) => acc + (m.direction === 'in' ? m.amount : -m.amount), 0)
  }
  const expected = +(s.opening_cash + net).toFixed(2)
  const diff = +((Number(closingCash) || 0) - expected).toFixed(2)
  const updated = {
    ...s, closing_cash: Number(closingCash) || 0, expected_cash: expected,
    difference: diff, closed_at: nowISO(), note: note ?? s.note,
  }
  return save('cash_sessions', updated)
}

// ------------------------------------------------------------------
// Online orders & discounts (admin side)
// ------------------------------------------------------------------
export async function updateOrderStatus(orderId: string, patch: Partial<Order>) {
  const o = await db.orders.get(orderId)
  if (!o) return
  return save('orders', { ...o, ...patch })
}

/** Confirm an online order → create a real sale (stock + treasury + accounting) and mark delivered. */
export async function convertOrderToSale(orderId: string, cashierId?: string | null) {
  const order = await db.orders.get(orderId)
  if (!order || order.sale_id) return
  const items = await db.order_items.where('order_id').equals(orderId).toArray()
  const methods = await db.payment_methods.toArray()
  const code = order.payment === 'instapay' ? 'instapay' : 'cash'
  const method = methods.find((m) => m.code === code) ?? methods.find((m) => m.code === 'cash')
  const lines: CartLine[] = []
  for (const it of items) {
    const p = it.product_id ? await db.products.get(it.product_id) : undefined
    lines.push({ product_id: it.product_id ?? '', product_name: it.product_name, qty: it.qty, unit_price: it.unit_price, unit_cost: p?.cost ?? 0 })
  }
  const goodsTotal = +(order.subtotal - order.discount).toFixed(2)
  const { sale } = await createSale({
    lines,
    payments: method ? [{ payment_method_id: method.id, amount: goodsTotal }] : [],
    invoiceDiscount: order.discount,
    customer_id: null,
    cashier_id: cashierId ?? null,
    note: `أوردر أونلاين ${order.order_no} — ${order.customer_name}`,
  })
  if (order.shipping > 0 && method) await recordOtherIncome(order.shipping, method.id, `شحن ${order.order_no}`, cashierId)
  await save('orders', { ...order, sale_id: sale.id, status: 'delivered', paid: true })
  return sale
}

export async function saveDiscount(input: Partial<Discount> & { name: string; value: number }) {
  const existing = input.id ? await db.discounts.get(input.id) : undefined
  const row: Discount = {
    id: input.id ?? uuid(),
    name: input.name,
    type: input.type ?? 'percent',
    value: input.value,
    scope: input.scope ?? 'all',
    category_id: input.category_id ?? null,
    product_id: input.product_id ?? null,
    is_active: input.is_active ?? true,
    starts_at: input.starts_at ?? null,
    ends_at: input.ends_at ?? null,
    created_at: existing?.created_at ?? nowISO(),
  }
  return save('discounts', row)
}
