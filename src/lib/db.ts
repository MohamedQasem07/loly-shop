import Dexie, { type Table } from 'dexie'
import type {
  Product, Category, Supplier, Customer, PaymentMethod, ExpenseCategory,
  Sale, SaleItem, SalePayment, Purchase, PurchaseItem, ReturnDoc, ReturnItem,
  StockMovement, TreasuryMovement, CashSession, Expense, Settings, Profile,
  Account, JournalEntry, JournalLine, Order, OrderItem, Discount, Coupon, ShippingZone, Review,
} from './types'

/** A pending change waiting to be pushed to Supabase. */
export interface OutboxOp {
  id?: number
  table: string
  op: 'upsert' | 'delete'
  rowId: string
  payload: unknown | null
  createdAt: number
  tries: number
}

export interface MetaRow {
  key: string
  value: unknown
}

/**
 * Local-first store. The app reads/writes here (instant + offline);
 * a background syncer mirrors changes to/from Supabase.
 */
class LolyDB extends Dexie {
  products!: Table<Product, string>
  categories!: Table<Category, string>
  suppliers!: Table<Supplier, string>
  customers!: Table<Customer, string>
  payment_methods!: Table<PaymentMethod, string>
  expense_categories!: Table<ExpenseCategory, string>
  sales!: Table<Sale, string>
  sale_items!: Table<SaleItem, string>
  sale_payments!: Table<SalePayment, string>
  purchases!: Table<Purchase, string>
  purchase_items!: Table<PurchaseItem, string>
  returns!: Table<ReturnDoc, string>
  return_items!: Table<ReturnItem, string>
  stock_movements!: Table<StockMovement, string>
  treasury_movements!: Table<TreasuryMovement, string>
  cash_sessions!: Table<CashSession, string>
  expenses!: Table<Expense, string>
  settings!: Table<Settings, number>
  profiles!: Table<Profile, string>
  accounts!: Table<Account, string>
  journal_entries!: Table<JournalEntry, string>
  journal_lines!: Table<JournalLine, string>
  orders!: Table<Order, string>
  order_items!: Table<OrderItem, string>
  discounts!: Table<Discount, string>
  coupons!: Table<Coupon, string>
  shipping_zones!: Table<ShippingZone, string>
  reviews!: Table<Review, string>
  outbox!: Table<OutboxOp, number>
  meta!: Table<MetaRow, string>

  constructor() {
    super('loly_store')
    this.version(1).stores({
      products: 'id, category_id, supplier_id, is_active, sku, barcode, name',
      categories: 'id, sort_order, is_active',
      suppliers: 'id, is_active, name',
      customers: 'id, is_active, phone, name',
      payment_methods: 'id, code, sort_order',
      expense_categories: 'id, is_active',
      sales: 'id, invoice_no, created_at, status, customer_id, cashier_id',
      sale_items: 'id, sale_id, product_id',
      sale_payments: 'id, sale_id, payment_method_id',
      purchases: 'id, supplier_id, received_at',
      purchase_items: 'id, purchase_id, product_id',
      returns: 'id, sale_id, created_at',
      return_items: 'id, return_id',
      stock_movements: 'id, product_id, created_at, type',
      treasury_movements: 'id, payment_method_id, created_at, direction',
      cash_sessions: 'id, opened_at, closed_at',
      expenses: 'id, spent_at, category_id, payment_method_id',
      settings: 'id',
      profiles: 'id, role',
      outbox: '++id, table, createdAt',
      meta: 'key',
    })

    this.version(2).stores({
      accounts: 'id, code, type, parent_id',
      journal_entries: 'id, entry_date, source, created_at',
      journal_lines: 'id, entry_id, account_id, partner_id',
    })

    this.version(3).stores({
      orders: 'id, order_no, status, created_at',
      order_items: 'id, order_id, product_id',
      discounts: 'id, scope, is_active, category_id, product_id',
    })

    this.version(4).stores({
      coupons: 'id, code, is_active',
    })

    this.version(5).stores({
      shipping_zones: 'id, governorate, is_active, sort_order',
    })

    this.version(6).stores({
      reviews: 'id, product_id, is_approved, created_at',
    })
  }
}

export const db = new LolyDB()

/** Clear all local data (used on logout / fresh device). */
export async function clearLocalDb() {
  await Promise.all(db.tables.map((t) => t.clear()))
}
