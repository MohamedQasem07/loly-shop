import { create } from 'zustand'

export interface CartItem {
  product_id: string
  name: string
  price: number
  cost: number
  qty: number
  stock: number
  image_url: string | null
  discount: number
}

interface CartState {
  items: CartItem[]
  invoiceDiscount: number
  customerId: string | null
  note: string
  add: (p: { product_id: string; name: string; price: number; cost: number; stock: number; image_url: string | null }) => void
  setQty: (id: string, qty: number) => void
  inc: (id: string) => void
  dec: (id: string) => void
  setLineDiscount: (id: string, d: number) => void
  remove: (id: string) => void
  setInvoiceDiscount: (n: number) => void
  setCustomer: (id: string | null) => void
  setNote: (n: string) => void
  clear: () => void
  count: () => number
  subtotal: () => number
  total: () => number
}

export const useCart = create<CartState>((set, get) => ({
  items: [],
  invoiceDiscount: 0,
  customerId: null,
  note: '',
  add: (p) =>
    set((s) => {
      const existing = s.items.find((i) => i.product_id === p.product_id)
      if (existing) {
        return {
          items: s.items.map((i) =>
            i.product_id === p.product_id ? { ...i, qty: i.qty + 1 } : i,
          ),
        }
      }
      return { items: [...s.items, { ...p, qty: 1, discount: 0 }] }
    }),
  setQty: (id, qty) =>
    set((s) => ({
      items: s.items.map((i) => (i.product_id === id ? { ...i, qty: Math.max(0, qty) } : i)).filter((i) => i.qty > 0),
    })),
  inc: (id) => set((s) => ({ items: s.items.map((i) => (i.product_id === id ? { ...i, qty: i.qty + 1 } : i)) })),
  dec: (id) =>
    set((s) => ({
      items: s.items.map((i) => (i.product_id === id ? { ...i, qty: i.qty - 1 } : i)).filter((i) => i.qty > 0),
    })),
  setLineDiscount: (id, d) =>
    set((s) => ({ items: s.items.map((i) => (i.product_id === id ? { ...i, discount: Math.max(0, d) } : i)) })),
  remove: (id) => set((s) => ({ items: s.items.filter((i) => i.product_id !== id) })),
  setInvoiceDiscount: (n) => set({ invoiceDiscount: Math.max(0, n) }),
  setCustomer: (id) => set({ customerId: id }),
  setNote: (n) => set({ note: n }),
  clear: () => set({ items: [], invoiceDiscount: 0, customerId: null, note: '' }),
  count: () => get().items.reduce((s, i) => s + i.qty, 0),
  subtotal: () => get().items.reduce((s, i) => s + (i.qty * i.price - i.discount), 0),
  total: () => Math.max(0, get().subtotal() - get().invoiceDiscount),
}))
