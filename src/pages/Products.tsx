import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Package, Pencil, Plus, Search, ImageOff, Store, Upload, Loader2, Trash2 } from 'lucide-react'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { uuid } from '@/lib/ids'
import { money, num } from '@/lib/format'
import { Empty, Field, Modal, PageHeader } from '@/components/ui'
import { saveProduct, save, type ProductInput } from '@/data/repo'
import { useAuth } from '@/store/auth'
import { toast } from '@/store/ui'
import type { Product } from '@/lib/types'
import { cn } from '@/lib/cn'

export default function Products() {
  const { isAdmin } = useAuth()
  const products = useLiveQuery(() => db.products.toArray(), []) ?? []
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('all')
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [adding, setAdding] = useState(false)

  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name_ar ?? '—'

  async function toggleOnline(p: Product) {
    await save('products', { ...p, online: !p.online })
    toast(p.online ? 'اتشال من المتجر' : 'اتنشر في المتجر 🛍️')
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return products
      .filter((p) => (showInactive ? true : p.is_active))
      .filter((p) => (cat === 'all' ? true : p.category_id === cat))
      .filter((p) =>
        !term
          ? true
          : p.name.toLowerCase().includes(term) ||
            (p.sku ?? '').toLowerCase().includes(term) ||
            (p.barcode ?? '').toLowerCase().includes(term),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
  }, [products, q, cat, showInactive])

  return (
    <div>
      <PageHeader
        title="المنتجات"
        subtitle={`${num(products.length)} منتج`}
        action={
          isAdmin && (
            <button className="btn-primary" onClick={() => setAdding(true)}>
              <Plus size={18} /> منتج جديد
            </button>
          )
        }
      />

      {/* Search & filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-cocoa-light" />
          <input
            className="input pr-10"
            placeholder="ابحث بالاسم أو الكود أو الباركود…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="input sm:w-52" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="all">كل التصنيفات</option>
          {categories
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_ar ?? c.name}
              </option>
            ))}
        </select>
      </div>

      {isAdmin && (
        <label className="flex items-center gap-2 text-sm text-cocoa-light mb-4 cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          عرض المنتجات الموقوفة
        </label>
      )}

      {filtered.length === 0 ? (
        <div className="card">
          <Empty
            icon={<Package size={40} />}
            title="مفيش منتجات"
            hint={isAdmin ? 'اضغط «منتج جديد» عشان تبدأ' : 'لسه مفيش منتجات مضافة'}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((p) => {
            const low = p.low_stock_threshold > 0 && p.stock_qty <= p.low_stock_threshold
            return (
              <div key={p.id} className={cn('card p-3 flex gap-3', !p.is_active && 'opacity-60')}>
                <Thumb url={p.image_url} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-cocoa truncate">{p.name}</p>
                    {isAdmin && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => toggleOnline(p)} title={p.online ? 'معروض في المتجر — اضغط للإخفاء' : 'مش في المتجر — اضغط للعرض'} className={p.online ? 'text-ok' : 'text-cocoa-light/40 hover:text-cocoa-light'}>
                          <Store size={16} />
                        </button>
                        <button onClick={() => setEditing(p)} className="text-cocoa-light hover:text-rose">
                          <Pencil size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-cocoa-light">{catName(p.category_id)}{p.color ? ` · ${p.color}` : ''}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-bold text-rose">{money(p.price)}</span>
                    <span className={cn('chip', low ? 'bg-warn/15 text-warn' : 'bg-blush text-cocoa-light')}>
                      متاح {num(p.stock_qty)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {(adding || editing) && (
        <ProductModal
          product={editing}
          onClose={() => {
            setAdding(false)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function Thumb({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div className="w-16 h-16 rounded-2xl bg-blush grid place-items-center text-rose/40 shrink-0">
        <ImageOff size={22} />
      </div>
    )
  }
  return <img src={url} alt="" className="w-16 h-16 rounded-2xl object-cover bg-blush shrink-0" />
}

function ImageUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')

  async function onFile(file: File) {
    if (file.size > 5 * 1024 * 1024) { setErr('الصورة كبيرة (أقصى حجم ٥ ميجا)'); return }
    setErr('')
    setUploading(true)
    try {
      const ext = ((file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')) || 'jpg'
      const path = `products/${uuid()}.${ext}`
      const { error } = await supabase.storage.from('product-images').upload(path, file, {
        cacheControl: '3600', upsert: false, contentType: file.type || undefined,
      })
      if (error) throw error
      const { data } = supabase.storage.from('product-images').getPublicUrl(path)
      onChange(data.publicUrl)
    } catch {
      setErr('تعذّر رفع الصورة — تأكد إنك متصل بالنت وحاول تاني')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex items-start gap-3">
      <div className="w-24 h-24 rounded-2xl bg-blush grid place-items-center overflow-hidden shrink-0 border border-pink/60">
        {value ? <img src={value} alt="" className="w-full h-full object-cover" /> : <ImageOff className="text-rose/40" size={28} />}
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-ghost text-sm py-2">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {value ? 'تغيير الصورة' : 'رفع صورة'}
          </button>
          {value && !uploading && (
            <button type="button" onClick={() => onChange('')} className="btn-ghost text-sm py-2 text-danger border-danger/30">
              <Trash2 size={15} /> إزالة
            </button>
          )}
        </div>
        <input className="input text-sm" dir="ltr" placeholder="أو الصق رابط صورة…" value={value} onChange={(e) => onChange(e.target.value)} />
        {err && <p className="text-danger text-xs font-semibold">{err}</p>}
        <p className="text-[11px] text-cocoa-light">JPG / PNG / WebP · حتى ٥ ميجا · بتظهر في المتجر الأونلاين</p>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
      </div>
    </div>
  )
}

function ProductModal({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const suppliers = useLiveQuery(() => db.suppliers.toArray(), []) ?? []
  const isNew = !product
  const [form, setForm] = useState<ProductInput>({
    id: product?.id,
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    barcode: product?.barcode ?? '',
    category_id: product?.category_id ?? null,
    image_url: product?.image_url ?? '',
    price: product?.price ?? 0,
    cost: product?.cost ?? 0,
    stock_qty: product?.stock_qty ?? 0,
    low_stock_threshold: product?.low_stock_threshold ?? 0,
    color: product?.color ?? '',
    supplier_id: product?.supplier_id ?? null,
    is_active: product?.is_active ?? true,
    notes: product?.notes ?? '',
    online: product?.online ?? false,
    online_price: product?.online_price ?? null,
  })
  const [busy, setBusy] = useState(false)

  const set = (patch: Partial<ProductInput>) => setForm((f) => ({ ...f, ...patch }))

  async function save() {
    if (!form.name.trim()) return toast('اكتب اسم المنتج', 'error')
    setBusy(true)
    try {
      await saveProduct({ ...form, name: form.name.trim() })
      toast(isNew ? 'تمت إضافة المنتج 🌸' : 'تم حفظ التعديلات')
      onClose()
    } catch {
      toast('حصل خطأ، حاول تاني', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'منتج جديد' : 'تعديل المنتج'}
      wide
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            إلغاء
          </button>
          <button className="btn-primary" onClick={save} disabled={busy}>
            حفظ
          </button>
        </>
      }
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Field label="اسم المنتج">
            <input className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="مثال: بروش فراشة" />
          </Field>
        </div>
        <Field label="التصنيف">
          <select className="input" value={form.category_id ?? ''} onChange={(e) => set({ category_id: e.target.value || null })}>
            <option value="">— بدون —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_ar ?? c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="اللون / النوع">
          <input className="input" value={form.color ?? ''} onChange={(e) => set({ color: e.target.value })} placeholder="Pink / Gold…" />
        </Field>
        <Field label="سعر البيع">
          <input className="input" type="number" inputMode="decimal" value={form.price || ''} onChange={(e) => set({ price: +e.target.value })} />
        </Field>
        <Field label="تكلفة الشراء">
          <input className="input" type="number" inputMode="decimal" value={form.cost || ''} onChange={(e) => set({ cost: +e.target.value })} />
        </Field>
        {isNew ? (
          <Field label="الكمية الافتتاحية">
            <input className="input" type="number" inputMode="decimal" value={form.stock_qty || ''} onChange={(e) => set({ stock_qty: +e.target.value })} />
          </Field>
        ) : (
          <Field label="المخزون الحالي" hint="يتغيّر من الاستلام/الجرد فقط">
            <input className="input bg-blush/40" value={num(product!.stock_qty)} readOnly />
          </Field>
        )}
        <Field label="حد التنبيه">
          <input className="input" type="number" inputMode="decimal" value={form.low_stock_threshold || ''} onChange={(e) => set({ low_stock_threshold: +e.target.value })} />
        </Field>
        <Field label="كود المنتج (SKU)">
          <input className="input" dir="ltr" value={form.sku ?? ''} onChange={(e) => set({ sku: e.target.value })} placeholder="LLY-BRC-001" />
        </Field>
        <Field label="الباركود">
          <input className="input" dir="ltr" value={form.barcode ?? ''} onChange={(e) => set({ barcode: e.target.value })} />
        </Field>
        <Field label="المورد">
          <select className="input" value={form.supplier_id ?? ''} onChange={(e) => set({ supplier_id: e.target.value || null })}>
            <option value="">— بدون —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <span className="label">صورة المنتج</span>
          <ImageUpload value={form.image_url ?? ''} onChange={(url) => set({ image_url: url })} />
        </div>
        <div className="sm:col-span-2">
          <Field label="ملاحظات">
            <textarea className="input min-h-[70px]" value={form.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </div>
        <label className="sm:col-span-2 flex items-center gap-2 text-sm font-semibold text-cocoa cursor-pointer">
          <input type="checkbox" checked={form.is_active} onChange={(e) => set({ is_active: e.target.checked })} />
          المنتج نشط (متاح للبيع)
        </label>
        <label className="sm:col-span-2 flex items-center gap-3 rounded-2xl bg-blush/40 p-3 cursor-pointer">
          <input type="checkbox" checked={form.online ?? false} onChange={(e) => set({ online: e.target.checked })} />
          <div>
            <p className="font-bold text-cocoa text-sm">🛍️ اعرضه في المتجر الأونلاين</p>
            <p className="text-xs text-cocoa-light">العملاء هيشوفوه ويطلبوه من لينك المتجر</p>
          </div>
        </label>
        {form.online && (
          <div className="sm:col-span-2">
            <Field label="سعر المتجر (اختياري — سيبه فاضي = نفس سعر البيع)">
              <input className="input" type="number" inputMode="decimal" value={form.online_price ?? ''} onChange={(e) => set({ online_price: e.target.value === '' ? null : +e.target.value })} />
            </Field>
          </div>
        )}
      </div>
    </Modal>
  )
}
