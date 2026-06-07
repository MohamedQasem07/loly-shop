import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import { SYNC_TABLES } from '@/lib/types'
import { docNumber } from '@/lib/counters'

// Postgres `numeric` columns arrive as strings via PostgREST — coerce them back to numbers.
const NUMERIC_FIELDS: Record<string, string[]> = {
  products: ['price', 'cost', 'stock_qty', 'low_stock_threshold', 'online_price'],
  suppliers: ['balance'],
  sales: ['subtotal', 'discount', 'tax', 'total', 'cost_total'],
  sale_items: ['qty', 'unit_price', 'unit_cost', 'discount', 'line_total'],
  sale_payments: ['amount'],
  purchases: ['subtotal', 'extra_costs', 'total', 'paid_amount'],
  purchase_items: ['qty', 'unit_cost', 'line_total'],
  returns: ['total'],
  return_items: ['qty', 'unit_price', 'line_total'],
  stock_movements: ['qty'],
  treasury_movements: ['amount'],
  cash_sessions: ['opening_cash', 'closing_cash', 'expected_cash', 'difference'],
  expenses: ['amount'],
  settings: ['tax_percent', 'shipping_fee'],
  journal_lines: ['debit', 'credit'],
  orders: ['subtotal', 'discount', 'shipping', 'total'],
  order_items: ['qty', 'unit_price', 'line_total'],
  discounts: ['value'],
}

function coerce(table: string, row: Record<string, unknown>) {
  const fields = NUMERIC_FIELDS[table]
  if (fields) {
    for (const f of fields) {
      if (row[f] != null) row[f] = Number(row[f])
    }
  }
  return row
}

// ---------- status (subscribable, no external store needed) ----------
type Listener = () => void
class SyncStatus {
  online = typeof navigator !== 'undefined' ? navigator.onLine : true
  syncing = false
  pending = 0
  lastSyncAt: number | null = null
  error: string | null = null
  private listeners = new Set<Listener>()
  subscribe(l: Listener) {
    this.listeners.add(l)
    return () => { this.listeners.delete(l) }
  }
  private emit() { this.listeners.forEach((l) => l()) }
  set(patch: Partial<SyncStatus>) {
    Object.assign(this, patch)
    this.emit()
  }
  snapshot() {
    return { online: this.online, syncing: this.syncing, pending: this.pending, lastSyncAt: this.lastSyncAt, error: this.error }
  }
}
export const syncStatus = new SyncStatus()

export async function refreshPending() {
  syncStatus.set({ pending: await db.outbox.count() })
}

/** Download everything from Supabase into the local DB (first login / fresh device). */
export async function pullAll() {
  for (const table of SYNC_TABLES) {
    const { data, error } = await supabase.from(table).select('*')
    if (error) throw error
    if (data && data.length) {
      const rows = data.map((r) => coerce(table, r as Record<string, unknown>))
      // @ts-expect-error dynamic table access
      await db[table].bulkPut(rows)
    }
  }
  await db.meta.put({ key: 'lastPull', value: Date.now() })
}

function isDuplicateKey(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === '23505' || /duplicate key|already exists/i.test(error.message ?? '')
}

/** Regenerate a colliding invoice/return number (multi-device) and fix the local row. */
async function renumber(table: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (table === 'sales') {
    const no = await docNumber('INV')
    payload.invoice_no = no
    await db.sales.update(payload.id as string, { invoice_no: no })
  } else {
    const no = await docNumber('RET')
    payload.return_no = no
    await db.returns.update(payload.id as string, { return_no: no })
  }
  return payload
}

/**
 * Push queued local changes to Supabase, in insertion order (FK-safe).
 * Resilient: one failing op never blocks the rest; invoice/return number
 * collisions across devices are auto-renumbered and retried.
 */
export async function pushOutbox() {
  const ops = await db.outbox.orderBy('id').toArray()
  for (const op of ops) {
    try {
      if (op.op === 'delete') {
        const { error } = await supabase.from(op.table).delete().eq('id', op.rowId)
        if (error) throw error
      } else {
        let payload = op.payload as Record<string, unknown>
        let { error } = await supabase.from(op.table).upsert(payload)
        if (error && isDuplicateKey(error) && (op.table === 'sales' || op.table === 'returns')) {
          payload = await renumber(op.table, payload)
          const retry = await supabase.from(op.table).upsert(payload)
          error = retry.error
        }
        if (error) throw error
      }
      await db.outbox.delete(op.id!)
    } catch {
      await db.outbox.update(op.id!, { tries: (op.tries ?? 0) + 1 })
    }
  }
}

let running = false
export async function syncNow(opts: { pull?: boolean } = {}) {
  if (running) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    syncStatus.set({ online: false })
    await refreshPending()
    return
  }
  running = true
  syncStatus.set({ syncing: true, error: null })
  try {
    await pushOutbox()
    // converge across devices only when everything local has been pushed
    if ((await db.outbox.count()) === 0) await pullAll()
    syncStatus.set({ lastSyncAt: Date.now(), online: true })
  } catch (e) {
    syncStatus.set({ error: e instanceof Error ? e.message : 'خطأ في المزامنة' })
  } finally {
    running = false
    await refreshPending()
    syncStatus.set({ syncing: false })
  }
}

let timer: ReturnType<typeof setInterval> | undefined

export function startSync() {
  if (typeof window === 'undefined') return
  window.addEventListener('online', () => { syncStatus.set({ online: true }); void syncNow() })
  window.addEventListener('offline', () => syncStatus.set({ online: false }))
  timer = setInterval(() => { void syncNow() }, 30_000)
  void refreshPending()
}

export function stopSync() {
  if (timer) clearInterval(timer)
}
