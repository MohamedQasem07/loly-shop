import { money } from './format'
import type { Settings } from './types'

interface ReceiptLine {
  name: string
  qty: number
  unit_price: number
  line_total: number
}
interface ReceiptData {
  invoiceNo: string
  date: Date
  lines: ReceiptLine[]
  subtotal: number
  discount: number
  tax: number
  total: number
  payments: { name: string; amount: number }[]
  paid: number
  change: number
  settings?: Settings | null
  cashier?: string | null
}

/** Open a printable 80mm receipt in a new window and trigger print. */
export function printReceipt(d: ReceiptData) {
  const s = d.settings
  const rows = d.lines
    .map(
      (l) => `<tr>
        <td class="r">${money(l.line_total)}</td>
        <td class="c">${l.qty}</td>
        <td>${escapeHtml(l.name)}</td>
      </tr>`,
    )
    .join('')

  const pays = d.payments
    .map((p) => `<div class="row"><span>${money(p.amount)}</span><span>${escapeHtml(p.name)}</span></div>`)
    .join('')

  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${d.invoiceNo}</title>
  <style>
    * { font-family: 'Cairo', Tahoma, sans-serif; box-sizing: border-box; }
    body { width: 80mm; margin: 0 auto; padding: 8px; color: #1c1c1c; }
    h1 { font-size: 18px; text-align: center; margin: 4px 0; color: #D13B83; }
    .muted { color: #666; font-size: 11px; text-align: center; }
    .meta { font-size: 12px; margin: 8px 0; }
    .meta .row, .totals .row { display: flex; justify-content: space-between; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
    th, td { padding: 4px 2px; text-align: right; border-bottom: 1px dashed #ddd; }
    th { border-bottom: 1px solid #999; }
    td.r, th.r { text-align: left; } td.c, th.c { text-align: center; }
    .totals { font-size: 13px; margin-top: 8px; border-top: 1px solid #999; padding-top: 6px; }
    .totals .grand { font-weight: 800; font-size: 16px; color: #D13B83; }
    .foot { text-align: center; font-size: 12px; margin-top: 10px; }
    @media print { @page { margin: 0; } }
  </style></head><body>
    <h1>${escapeHtml(s?.store_name ?? 'Loly Store')}</h1>
    ${s?.store_phone ? `<div class="muted">${escapeHtml(s.store_phone)}</div>` : ''}
    ${s?.store_address ? `<div class="muted">${escapeHtml(s.store_address)}</div>` : ''}
    <div class="meta">
      <div class="row"><span>${d.invoiceNo}</span><span>فاتورة</span></div>
      <div class="row"><span>${d.date.toLocaleString('ar-EG')}</span><span>التاريخ</span></div>
      ${d.cashier ? `<div class="row"><span>${escapeHtml(d.cashier)}</span><span>الكاشير</span></div>` : ''}
    </div>
    <table>
      <thead><tr><th class="r">الإجمالي</th><th class="c">كمية</th><th>الصنف</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <div class="row"><span>${money(d.subtotal)}</span><span>الإجمالي الفرعي</span></div>
      ${d.discount ? `<div class="row"><span>- ${money(d.discount)}</span><span>خصم</span></div>` : ''}
      ${d.tax ? `<div class="row"><span>${money(d.tax)}</span><span>ضريبة</span></div>` : ''}
      <div class="row grand"><span>${money(d.total)}</span><span>الإجمالي</span></div>
      ${pays}
      ${d.change ? `<div class="row"><span>${money(d.change)}</span><span>الباقي</span></div>` : ''}
    </div>
    <div class="foot">${escapeHtml(s?.receipt_footer ?? 'شكراً لتسوقك 🌸')}</div>
    <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 300); }</script>
  </body></html>`

  const w = window.open('', '_blank', 'width=380,height=640')
  if (!w) return
  w.document.open()
  w.document.write(html)
  w.document.close()
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
