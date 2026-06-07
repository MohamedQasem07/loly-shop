import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import { SYNC_TABLES } from '@/lib/types'

// Postgres `numeric` columns arrive as strings via PostgREST — coerce them back to numbers.
const NUMERIC_FIELDS: Record<string, string[]> = {
  products: ['price', 'cost', 'stock_qty', 'low_stock_threshold'],
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
  settings: ['tax_percent'],
  journal_lines: ['debit', 'credit'],
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

/** Push all queued local changes to Supabase, in insertion order (FK-safe). */
export async function pushOutbox() {
  const ops = await db.outbox.orderBy('id').toArray()
  for (const op of ops) {
    if (op.op === 'upsert') {
      const { error } = await supabase.from(op.table).upsert(op.payload as never)
      if (error) throw error
    } else if (op.op === 'delete') {
      const { error } = await supabase.from(op.table).delete().eq('id', op.rowId)
      if (error) throw error
    }
    await db.outbox.delete(op.id!)
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
    if (opts.pull) await pullAll()
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
