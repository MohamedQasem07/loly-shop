import { format, isToday, isYesterday } from 'date-fns'
import { ar } from 'date-fns/locale'

/** Format a number as Egyptian Pounds. */
export function money(n: number | null | undefined): string {
  const v = Number(n || 0)
  return `${v.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م`
}

/** Plain localized number. */
export function num(n: number | null | undefined): string {
  return Number(n || 0).toLocaleString('ar-EG', { maximumFractionDigits: 2 })
}

export function fmtDate(d: string | number | Date): string {
  try {
    return format(new Date(d), 'd MMM yyyy', { locale: ar })
  } catch {
    return '-'
  }
}

export function fmtTime(d: string | number | Date): string {
  try {
    return format(new Date(d), 'hh:mm a', { locale: ar })
  } catch {
    return '-'
  }
}

export function fmtDateTime(d: string | number | Date): string {
  try {
    const date = new Date(d)
    if (isToday(date)) return `اليوم ${format(date, 'hh:mm a', { locale: ar })}`
    if (isYesterday(date)) return `أمس ${format(date, 'hh:mm a', { locale: ar })}`
    return format(date, 'd MMM، hh:mm a', { locale: ar })
  } catch {
    return '-'
  }
}

/** Today's date as yyyy-MM-dd (local). */
export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}
