import { db } from './db'
import { uuid } from './ids'

/**
 * Per-device short code so invoice/return numbers never collide across devices
 * (the shop runs on more than one device — phone + web — each offline-first).
 */
export async function deviceCode(): Promise<string> {
  const row = await db.meta.get('deviceCode')
  if (row?.value) return row.value as string
  const code = uuid().replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase() || 'X1'
  await db.meta.put({ key: 'deviceCode', value: code })
  return code
}

/** Atomic local counter (per device). */
export async function nextSeq(key: string): Promise<number> {
  return db.transaction('rw', db.meta, async () => {
    const r = await db.meta.get(key)
    const next = (((r?.value as number) ?? 0) + 1)
    await db.meta.put({ key, value: next })
    return next
  })
}

/** Readable, globally-unique document number, e.g. INV-7AF-0012. */
export async function docNumber(prefix: 'INV' | 'RET'): Promise<string> {
  const code = await deviceCode()
  const seq = await nextSeq(prefix === 'INV' ? 'invoiceSeq' : 'returnSeq')
  return `${prefix}-${code}-${String(seq).padStart(4, '0')}`
}
