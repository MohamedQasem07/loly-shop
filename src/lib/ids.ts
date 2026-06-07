/** Generate a UUID (used as primary key for all local-first rows). */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // Fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** Build a readable sequential document number, e.g. INV-000123. */
export function docNo(prefix: string, seq: number): string {
  return `${prefix}-${String(seq).padStart(6, '0')}`
}
