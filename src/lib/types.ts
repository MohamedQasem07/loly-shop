// ============================================================
// Domain types — mirror the Supabase schema (public.*)
// ============================================================

export type UserRole = 'owner' | 'manager' | 'cashier' | 'stock' | 'viewer'
export type StockMoveType =
  | 'initial' | 'purchase' | 'sale' | 'return_in' | 'return_out'
  | 'adjustment' | 'damage' | 'transfer'
export type MoneyDirection = 'in' | 'out'
export type SaleStatus = 'completed' | 'held' | 'voided'
export type PurchaseStatus = 'draft' | 'received'

export interface Profile {
  id: string
  full_name: string | null
  role: UserRole
  phone: string | null
  is_active: boolean
  created_at: string
}

export interface Category {
  id: string
  name: string
  name_ar: string | null
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface Supplier {
  id: string
  name: string
  phone: string | null
  address: string | null
  notes: string | null
  balance: number
  is_active: boolean
  created_at: string
}

export interface Customer {
  id: string
  name: string
  phone: string | null
  whatsapp: string | null
  notes: string | null
  is_active: boolean
  created_at: string
}

export interface PaymentMethod {
  id: string
  code: string
  name: string
  name_ar: string | null
  is_active: boolean
  sort_order: number
  account_id: string | null
}

export interface ExpenseCategory {
  id: string
  name: string
  name_ar: string | null
  is_active: boolean
  account_id: string | null
}

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'

export interface Account {
  id: string
  code: string
  name: string
  name_ar: string | null
  type: AccountType
  parent_id: string | null
  is_group: boolean
  is_system: boolean
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface JournalEntry {
  id: string
  entry_no: string | null
  entry_date: string
  memo: string | null
  source: string | null
  source_id: string | null
  created_by: string | null
  created_at: string
}

export interface JournalLine {
  id: string
  entry_id: string
  account_id: string | null
  debit: number
  credit: number
  memo: string | null
  partner_type: string | null
  partner_id: string | null
}

export interface Product {
  id: string
  sku: string | null
  barcode: string | null
  name: string
  category_id: string | null
  image_url: string | null
  price: number
  cost: number
  stock_qty: number
  low_stock_threshold: number
  color: string | null
  supplier_id: string | null
  is_active: boolean
  notes: string | null
  online: boolean
  online_price: number | null
  created_at: string
  updated_at: string
}

export interface Sale {
  id: string
  invoice_no: string
  customer_id: string | null
  cashier_id: string | null
  status: SaleStatus
  subtotal: number
  discount: number
  tax: number
  total: number
  cost_total: number
  note: string | null
  voided_at: string | null
  voided_by: string | null
  void_reason: string | null
  created_at: string
}

export interface SaleItem {
  id: string
  sale_id: string
  product_id: string | null
  product_name: string
  qty: number
  unit_price: number
  unit_cost: number
  discount: number
  line_total: number
}

export interface SalePayment {
  id: string
  sale_id: string
  payment_method_id: string | null
  amount: number
}

export interface Purchase {
  id: string
  ref_no: string | null
  supplier_id: string | null
  status: PurchaseStatus
  subtotal: number
  extra_costs: number
  total: number
  payment_method_id: string | null
  paid_amount: number
  note: string | null
  received_at: string
  created_by: string | null
  created_at: string
}

export interface PurchaseItem {
  id: string
  purchase_id: string
  product_id: string | null
  product_name: string
  qty: number
  unit_cost: number
  line_total: number
}

export interface ReturnDoc {
  id: string
  return_no: string
  sale_id: string | null
  customer_id: string | null
  total: number
  refund_method_id: string | null
  restock: boolean
  reason: string | null
  created_by: string | null
  created_at: string
}

export interface ReturnItem {
  id: string
  return_id: string
  product_id: string | null
  product_name: string
  qty: number
  unit_price: number
  line_total: number
}

export interface StockMovement {
  id: string
  product_id: string
  type: StockMoveType
  qty: number
  ref_table: string | null
  ref_id: string | null
  note: string | null
  created_by: string | null
  created_at: string
}

export interface TreasuryMovement {
  id: string
  payment_method_id: string
  direction: MoneyDirection
  amount: number
  ref_table: string | null
  ref_id: string | null
  note: string | null
  created_by: string | null
  created_at: string
}

export interface CashSession {
  id: string
  opened_by: string | null
  opening_cash: number
  closing_cash: number | null
  expected_cash: number | null
  difference: number | null
  opened_at: string
  closed_at: string | null
  note: string | null
}

export interface Expense {
  id: string
  category_id: string | null
  amount: number
  payment_method_id: string | null
  description: string | null
  receipt_url: string | null
  spent_at: string
  created_by: string | null
  created_at: string
}

export interface Settings {
  id: number
  store_name: string
  store_phone: string | null
  store_address: string | null
  logo_url: string | null
  currency: string
  tax_percent: number
  allow_negative_stock: boolean
  receipt_footer: string | null
  theme: Record<string, string> | null
  store_open: boolean
  shipping_fee: number
  store_whatsapp: string | null
  store_cover_url: string | null
  store_about: string | null
  store_instagram: string | null
  store_facebook: string | null
  store_tiktok: string | null
  store_hours: string | null
  updated_at: string
}

export type OrderStatus = 'new' | 'confirmed' | 'preparing' | 'shipped' | 'delivered' | 'cancelled'
export type OrderPayment = 'cod' | 'instapay' | 'other'

export interface Order {
  id: string
  order_no: string
  customer_name: string
  customer_phone: string
  address: string | null
  status: OrderStatus
  payment: OrderPayment
  paid: boolean
  subtotal: number
  discount: number
  shipping: number
  total: number
  note: string | null
  sale_id: string | null
  coupon_code: string | null
  coupon_discount: number
  created_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string | null
  product_name: string
  qty: number
  unit_price: number
  line_total: number
}

export type DiscountScope = 'all' | 'category' | 'product'

export interface Discount {
  id: string
  name: string
  type: 'percent' | 'amount'
  value: number
  scope: DiscountScope
  category_id: string | null
  product_id: string | null
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
  created_at: string
}

export interface Coupon {
  id: string
  code: string
  type: 'percent' | 'amount'
  value: number
  min_order: number
  max_discount: number | null
  max_uses: number | null
  used_count: number
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
  created_at: string
}

/** Names of all synced tables (order matters for FK-safe push). */
export const SYNC_TABLES = [
  'categories',
  'suppliers',
  'customers',
  'payment_methods',
  'expense_categories',
  'accounts',
  'products',
  'sales',
  'sale_items',
  'sale_payments',
  'purchases',
  'purchase_items',
  'returns',
  'return_items',
  'stock_movements',
  'treasury_movements',
  'cash_sessions',
  'expenses',
  'settings',
  'profiles',
  'journal_entries',
  'journal_lines',
  'discounts',
  'coupons',
  'orders',
  'order_items',
] as const

export type SyncTable = (typeof SYNC_TABLES)[number]
