import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Store, Tags, Loader2, ShieldAlert, KeyRound, Globe, Copy, ExternalLink, Sparkles, Percent, Trash2, Ticket, Gift, Truck } from 'lucide-react'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { money, num } from '@/lib/format'
import { cn } from '@/lib/cn'
import { uuid } from '@/lib/ids'
import { Field, PageHeader } from '@/components/ui'
import { ImageUpload } from '@/components/ImageUpload'
import { saveSettings, saveCategory, save, removeRow, saveCoupon, saveShippingZone } from '@/data/repo'
import { useAuth } from '@/store/auth'
import { toast } from '@/store/ui'
import type { Category, Discount, Coupon, ShippingZone, Settings as SettingsT } from '@/lib/types'

const EG_GOVERNORATES = ['القاهرة', 'الجيزة', 'الإسكندرية', 'القليوبية', 'الدقهلية', 'الشرقية', 'الغربية', 'المنوفية', 'البحيرة', 'كفر الشيخ', 'دمياط', 'بورسعيد', 'الإسماعيلية', 'السويس', 'شمال سيناء', 'جنوب سيناء', 'بني سويف', 'الفيوم', 'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'البحر الأحمر', 'الوادي الجديد', 'مطروح']

export default function Settings() {
  const { isAdmin } = useAuth()
  const settings = useLiveQuery(() => db.settings.get(1), []) as SettingsT | undefined

  if (!isAdmin) {
    return (
      <div className="card p-10 text-center">
        <ShieldAlert className="mx-auto text-warn mb-3" size={40} />
        <p className="font-bold text-cocoa">الإعدادات للمالك والمدير فقط</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader title="الإعدادات" subtitle="بيانات المحل والنظام" />
      <StoreForm settings={settings} />
      <StoreIdentity settings={settings} />
      <DiscountsManager />
      <CouponsManager />
      <LoyaltyManager settings={settings} />
      <ShippingZonesManager />
      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <StoreSection settings={settings} />
        <CategoriesManager />
        <AccountSection />
      </div>
    </div>
  )
}

function AccountSection() {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)

  async function change() {
    if (pw.length < 6) return toast('كلمة المرور 6 حروف على الأقل', 'error')
    if (pw !== pw2) return toast('كلمتا المرور غير متطابقتين', 'error')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) return toast('تعذّر التغيير (لازم تكون متصل بالنت)', 'error')
    setPw('')
    setPw2('')
    toast('تم تغيير كلمة المرور 🌸')
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4 text-cocoa">
        <KeyRound size={18} className="text-rose" />
        <h2 className="font-bold">تغيير كلمة المرور</h2>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="كلمة المرور الجديدة">
          <input className="input" type="password" dir="ltr" value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
        <Field label="تأكيد كلمة المرور">
          <input className="input" type="password" dir="ltr" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end mt-4">
        <button className="btn-primary" onClick={change} disabled={busy}>{busy && <Loader2 size={18} className="animate-spin" />} تغيير</button>
      </div>
    </div>
  )
}

function StoreForm({ settings }: { settings?: SettingsT }) {
  const [form, setForm] = useState({
    store_name: '',
    store_phone: '',
    store_address: '',
    currency: 'EGP',
    tax_percent: 0,
    allow_negative_stock: false,
    receipt_footer: '',
    logo_url: '',
  })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (settings) {
      setForm({
        store_name: settings.store_name ?? '',
        store_phone: settings.store_phone ?? '',
        store_address: settings.store_address ?? '',
        currency: settings.currency ?? 'EGP',
        tax_percent: settings.tax_percent ?? 0,
        allow_negative_stock: settings.allow_negative_stock ?? false,
        receipt_footer: settings.receipt_footer ?? '',
        logo_url: settings.logo_url ?? '',
      })
    }
  }, [settings])

  async function submit() {
    setBusy(true)
    try {
      await saveSettings(form)
      toast('تم حفظ الإعدادات 🌸')
    } catch {
      toast('حصل خطأ', 'error')
    } finally {
      setBusy(false)
    }
  }

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4 text-cocoa">
        <Store size={18} className="text-rose" />
        <h2 className="font-bold">بيانات المحل</h2>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="اسم المحل">
          <input className="input" value={form.store_name} onChange={(e) => set({ store_name: e.target.value })} />
        </Field>
        <Field label="رقم الهاتف">
          <input className="input" dir="ltr" value={form.store_phone} onChange={(e) => set({ store_phone: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="العنوان">
            <input className="input" value={form.store_address} onChange={(e) => set({ store_address: e.target.value })} />
          </Field>
        </div>
        <Field label="العملة">
          <input className="input" value={form.currency} onChange={(e) => set({ currency: e.target.value })} />
        </Field>
        <Field label="نسبة الضريبة %">
          <input className="input" type="number" inputMode="decimal" value={form.tax_percent || ''} onChange={(e) => set({ tax_percent: +e.target.value || 0 })} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="جملة آخر الإيصال">
            <input className="input" value={form.receipt_footer} onChange={(e) => set({ receipt_footer: e.target.value })} />
          </Field>
        </div>
        <label className="sm:col-span-2 flex items-center gap-3 rounded-2xl bg-blush/40 p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.allow_negative_stock}
            onChange={(e) => set({ allow_negative_stock: e.target.checked })}
          />
          <div>
            <p className="font-bold text-cocoa text-sm">السماح بالبيع بالسالب</p>
            <p className="text-xs text-cocoa-light">يسمح ببيع كمية أكبر من المتاح في المخزون</p>
          </div>
        </label>
      </div>
      <div className="flex justify-end mt-4">
        <button className="btn-primary" onClick={submit} disabled={busy}>
          {busy && <Loader2 size={18} className="animate-spin" />} حفظ
        </button>
      </div>
    </div>
  )
}

function DiscountsManager() {
  const discounts = (useLiveQuery(() => db.discounts.toArray(), []) ?? []) as Discount[]
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const products = useLiveQuery(() => db.products.filter((p) => p.is_active).toArray(), []) ?? []
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<'percent' | 'amount'>('percent')
  const [value, setValue] = useState(0)
  const [scope, setScope] = useState<'all' | 'category' | 'product'>('all')
  const [categoryId, setCategoryId] = useState('')
  const [productId, setProductId] = useState('')

  function resetForm() { setName(''); setType('percent'); setValue(0); setScope('all'); setCategoryId(''); setProductId('') }

  async function add() {
    if (!name.trim()) return toast('اكتب اسم العرض', 'error')
    if (value <= 0) return toast('اكتب قيمة الخصم', 'error')
    if (scope === 'category' && !categoryId) return toast('اختر التصنيف', 'error')
    if (scope === 'product' && !productId) return toast('اختر المنتج', 'error')
    await save('discounts', {
      id: uuid(), name: name.trim(), type, value: Number(value), scope,
      category_id: scope === 'category' ? categoryId : null,
      product_id: scope === 'product' ? productId : null,
      is_active: true, starts_at: null, ends_at: null, created_at: new Date().toISOString(),
    })
    toast('تمت إضافة العرض 🎉')
    resetForm(); setAdding(false)
  }
  async function toggle(d: Discount) { await save('discounts', { ...d, is_active: !d.is_active }) }
  async function remove(d: Discount) { if (window.confirm('حذف العرض؟')) await removeRow('discounts', d.id) }

  const scopeLabel = (d: Discount) =>
    d.scope === 'all' ? 'كل المنتجات'
      : d.scope === 'category' ? (categories.find((c) => c.id === d.category_id)?.name_ar ?? 'تصنيف')
        : (products.find((p) => p.id === d.product_id)?.name ?? 'منتج')

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-cocoa"><Percent size={18} className="text-rose" /><h2 className="font-bold">العروض والخصومات</h2><span className="text-xs text-cocoa-light">— تظهر في المتجر الأونلاين</span></div>
        <button onClick={() => setAdding((a) => !a)} className="btn-primary text-sm py-2"><Plus size={16} /> عرض جديد</button>
      </div>

      {adding && (
        <div className="rounded-2xl bg-blush/40 p-4 mb-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="اسم العرض"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="عرض الصيف 🌞" /></Field>
            <Field label="نوع الخصم">
              <div className="flex gap-2">
                <button type="button" onClick={() => setType('percent')} className={cn('flex-1 rounded-xl border-2 py-2 text-sm font-bold', type === 'percent' ? 'border-rose bg-rose/5 text-rose' : 'border-pink text-cocoa-light')}>نسبة %</button>
                <button type="button" onClick={() => setType('amount')} className={cn('flex-1 rounded-xl border-2 py-2 text-sm font-bold', type === 'amount' ? 'border-rose bg-rose/5 text-rose' : 'border-pink text-cocoa-light')}>مبلغ ثابت</button>
              </div>
            </Field>
            <Field label={type === 'percent' ? 'النسبة %' : 'المبلغ (ج.م)'}><input className="input" type="number" inputMode="decimal" value={value || ''} onChange={(e) => setValue(+e.target.value || 0)} /></Field>
            <Field label="يطبّق على">
              <select className="input" value={scope} onChange={(e) => setScope(e.target.value as 'all' | 'category' | 'product')}>
                <option value="all">كل المنتجات</option>
                <option value="category">تصنيف معيّن</option>
                <option value="product">منتج معيّن</option>
              </select>
            </Field>
            {scope === 'category' && <Field label="التصنيف"><select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">— اختر —</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name_ar ?? c.name}</option>)}</select></Field>}
            {scope === 'product' && <Field label="المنتج"><select className="input" value={productId} onChange={(e) => setProductId(e.target.value)}><option value="">— اختر —</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}
          </div>
          <div className="flex justify-end gap-2"><button onClick={() => { resetForm(); setAdding(false) }} className="btn-ghost text-sm">إلغاء</button><button onClick={add} className="btn-primary text-sm">إضافة العرض</button></div>
        </div>
      )}

      {discounts.length === 0 ? (
        <p className="text-sm text-cocoa-light text-center py-4">مفيش عروض لسه. اعمل أول عرض وهيظهر للعملاء في المتجر 🎉</p>
      ) : (
        <div className="space-y-2">
          {discounts.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-2xl border border-pink/40 p-3">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-cocoa truncate">{d.name} <span className="chip bg-rose/10 text-rose mr-1">{d.type === 'percent' ? `${num(d.value)}%` : money(d.value)}</span></p>
                <p className="text-xs text-cocoa-light">على: {scopeLabel(d)}</p>
              </div>
              <button onClick={() => toggle(d)} className={cn('chip border', d.is_active ? 'bg-ok/10 text-ok border-ok/20' : 'bg-blush text-cocoa-light border-pink')}>{d.is_active ? 'فعّال' : 'موقوف'}</button>
              <button onClick={() => remove(d)} className="text-cocoa-light hover:text-danger" title="حذف"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CouponsManager() {
  const coupons = (useLiveQuery(() => db.coupons.toArray(), []) ?? []) as Coupon[]
  const [adding, setAdding] = useState(false)
  const [code, setCode] = useState('')
  const [type, setType] = useState<'percent' | 'amount'>('percent')
  const [value, setValue] = useState(0)
  const [minOrder, setMinOrder] = useState(0)
  const [maxDiscount, setMaxDiscount] = useState(0)
  const [maxUses, setMaxUses] = useState(0)

  function resetForm() { setCode(''); setType('percent'); setValue(0); setMinOrder(0); setMaxDiscount(0); setMaxUses(0) }

  async function add() {
    const c = code.trim().toUpperCase()
    if (!c) return toast('اكتب كود الكوبون', 'error')
    if (value <= 0) return toast('اكتب قيمة الخصم', 'error')
    if (coupons.some((x) => x.code.toUpperCase() === c)) return toast('الكود موجود قبل كده', 'error')
    await saveCoupon({
      code: c, type, value: Number(value),
      min_order: Number(minOrder) || 0,
      max_discount: type === 'percent' && maxDiscount > 0 ? Number(maxDiscount) : null,
      max_uses: maxUses > 0 ? Math.floor(maxUses) : null,
    })
    toast('تمت إضافة الكوبون 🎟️')
    resetForm(); setAdding(false)
  }
  async function toggle(c: Coupon) { await saveCoupon({ ...c, is_active: !c.is_active }) }
  async function remove(c: Coupon) { if (window.confirm('حذف الكوبون؟')) await removeRow('coupons', c.id) }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-cocoa"><Ticket size={18} className="text-rose" /><h2 className="font-bold">أكواد الخصم (كوبونات)</h2><span className="text-xs text-cocoa-light">— يكتبها العميل عند الشراء</span></div>
        <button onClick={() => setAdding((a) => !a)} className="btn-primary text-sm py-2"><Plus size={16} /> كوبون جديد</button>
      </div>

      {adding && (
        <div className="rounded-2xl bg-blush/40 p-4 mb-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="الكود"><input className="input uppercase" dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} placeholder="LOLY10" /></Field>
            <Field label="نوع الخصم">
              <div className="flex gap-2">
                <button type="button" onClick={() => setType('percent')} className={cn('flex-1 rounded-xl border-2 py-2 text-sm font-bold', type === 'percent' ? 'border-rose bg-rose/5 text-rose' : 'border-pink text-cocoa-light')}>نسبة %</button>
                <button type="button" onClick={() => setType('amount')} className={cn('flex-1 rounded-xl border-2 py-2 text-sm font-bold', type === 'amount' ? 'border-rose bg-rose/5 text-rose' : 'border-pink text-cocoa-light')}>مبلغ ثابت</button>
              </div>
            </Field>
            <Field label={type === 'percent' ? 'النسبة %' : 'المبلغ (ج.م)'}><input className="input" type="number" inputMode="decimal" value={value || ''} onChange={(e) => setValue(+e.target.value || 0)} /></Field>
            <Field label="الحد الأدنى للطلب (ج.م)"><input className="input" type="number" inputMode="decimal" value={minOrder || ''} onChange={(e) => setMinOrder(+e.target.value || 0)} placeholder="0 = بدون حد" /></Field>
            {type === 'percent' && <Field label="أقصى خصم (ج.م) — اختياري"><input className="input" type="number" inputMode="decimal" value={maxDiscount || ''} onChange={(e) => setMaxDiscount(+e.target.value || 0)} placeholder="بدون حد" /></Field>}
            <Field label="عدد مرات الاستخدام — اختياري"><input className="input" type="number" inputMode="numeric" value={maxUses || ''} onChange={(e) => setMaxUses(+e.target.value || 0)} placeholder="بدون حد" /></Field>
          </div>
          <div className="flex justify-end gap-2"><button onClick={() => { resetForm(); setAdding(false) }} className="btn-ghost text-sm">إلغاء</button><button onClick={add} className="btn-primary text-sm">إضافة الكوبون</button></div>
        </div>
      )}

      {coupons.length === 0 ? (
        <p className="text-sm text-cocoa-light text-center py-4">مفيش كوبونات لسه. اعمل كود خصم والعميل يكتبه عند الشراء 🎟️</p>
      ) : (
        <div className="space-y-2">
          {coupons.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-pink/40 p-3">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-cocoa truncate" dir="ltr">{c.code} <span className="chip bg-rose/10 text-rose mr-1">{c.type === 'percent' ? `${num(c.value)}%${c.max_discount ? ` (حتى ${money(c.max_discount)})` : ''}` : money(c.value)}</span></p>
                <p className="text-xs text-cocoa-light">
                  {c.min_order > 0 ? `حد أدنى ${money(c.min_order)} · ` : ''}
                  استُخدم {num(c.used_count)}{c.max_uses ? ` / ${num(c.max_uses)}` : ''} مرة
                </p>
              </div>
              <button onClick={() => toggle(c)} className={cn('chip border', c.is_active ? 'bg-ok/10 text-ok border-ok/20' : 'bg-blush text-cocoa-light border-pink')}>{c.is_active ? 'فعّال' : 'موقوف'}</button>
              <button onClick={() => remove(c)} className="text-cocoa-light hover:text-danger" title="حذف"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ShippingZonesManager() {
  const zones = (useLiveQuery(() => db.shipping_zones.toArray(), []) ?? []) as ShippingZone[]
  const [adding, setAdding] = useState(false)
  const [gov, setGov] = useState('')
  const [fee, setFee] = useState(0)

  async function add() {
    const g = gov.trim()
    if (!g) return toast('اختر المحافظة', 'error')
    if (zones.some((z) => z.governorate.trim().toLowerCase() === g.toLowerCase())) return toast('المحافظة مضافة قبل كده', 'error')
    await saveShippingZone({ governorate: g, fee: Number(fee) || 0, sort_order: zones.length + 1 })
    toast('تمت إضافة المحافظة 🚚')
    setGov(''); setFee(0); setAdding(false)
  }
  async function toggle(z: ShippingZone) { await saveShippingZone({ ...z, is_active: !z.is_active }) }
  async function updateFee(z: ShippingZone, f: number) { if (f !== z.fee) await saveShippingZone({ ...z, fee: Number(f) || 0 }) }
  async function remove(z: ShippingZone) { if (window.confirm('حذف المحافظة؟')) await removeRow('shipping_zones', z.id) }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 text-cocoa"><Truck size={18} className="text-rose" /><h2 className="font-bold">الشحن حسب المحافظة</h2></div>
        <button onClick={() => setAdding((a) => !a)} className="btn-primary text-sm py-2"><Plus size={16} /> محافظة</button>
      </div>
      <p className="text-xs text-cocoa-light mb-4">حدّدي سعر شحن لكل محافظة. لو القائمة فاضية، بيتطبّق سعر الشحن الموحّد من «بيانات المحل».</p>

      {adding && (
        <div className="rounded-2xl bg-blush/40 p-4 mb-4">
          <div className="grid sm:grid-cols-[1fr_10rem_auto] gap-3 items-end">
            <Field label="المحافظة">
              <input className="input" list="eg-govs" value={gov} onChange={(e) => setGov(e.target.value)} placeholder="اكتبي أو اختاري" />
              <datalist id="eg-govs">{EG_GOVERNORATES.map((g) => <option key={g} value={g} />)}</datalist>
            </Field>
            <Field label="سعر الشحن (ج.م)"><input className="input" type="number" inputMode="decimal" value={fee || ''} onChange={(e) => setFee(+e.target.value || 0)} /></Field>
            <button onClick={add} className="btn-primary">إضافة</button>
          </div>
        </div>
      )}

      {zones.length === 0 ? (
        <p className="text-sm text-cocoa-light text-center py-4">مفيش محافظات لسه. ضيفي محافظات بأسعار شحنها وهتظهر للعميلة عند الطلب 🚚</p>
      ) : (
        <div className="space-y-2">
          {zones.slice().sort((a, b) => a.sort_order - b.sort_order).map((z) => (
            <div key={z.id} className="flex items-center gap-3 rounded-2xl border border-pink/40 p-3">
              <span className="flex-1 font-bold text-cocoa">{z.governorate}</span>
              <div className="flex items-center gap-1">
                <input type="number" inputMode="decimal" defaultValue={z.fee} onBlur={(e) => updateFee(z, +e.target.value || 0)} className="input w-24 py-1.5 text-center" />
                <span className="text-xs text-cocoa-light">ج.م</span>
              </div>
              <button onClick={() => toggle(z)} className={cn('chip border', z.is_active ? 'bg-ok/10 text-ok border-ok/20' : 'bg-blush text-cocoa-light border-pink')}>{z.is_active ? 'فعّال' : 'موقوف'}</button>
              <button onClick={() => remove(z)} className="text-cocoa-light hover:text-danger" title="حذف"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function LoyaltyManager({ settings }: { settings?: SettingsT }) {
  const [enabled, setEnabled] = useState(false)
  const [earn, setEarn] = useState(0)
  const [pointValue, setPointValue] = useState(1)
  const [minRedeem, setMinRedeem] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (settings) {
      setEnabled(settings.loyalty_enabled ?? false)
      setEarn(settings.loyalty_earn_egp ?? 0)
      setPointValue(settings.loyalty_point_value ?? 1)
      setMinRedeem(settings.loyalty_min_redeem ?? 0)
    }
  }, [settings])

  async function submit() {
    setBusy(true)
    try {
      await saveSettings({
        loyalty_enabled: enabled,
        loyalty_earn_egp: Number(earn) || 0,
        loyalty_point_value: Number(pointValue) || 0,
        loyalty_min_redeem: Math.floor(Number(minRedeem) || 0),
      })
      toast('تم حفظ إعدادات الولاء 🌸')
    } catch { toast('حصل خطأ', 'error') } finally { setBusy(false) }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-1 text-cocoa"><Gift size={18} className="text-rose" /><h2 className="font-bold">نقاط الولاء</h2></div>
      <p className="text-xs text-cocoa-light mb-4">كافئي عملاءك بنقاط على كل شراء، يستبدلوها خصم في الكاشير أو المتجر الأونلاين.</p>
      <label className="flex items-center gap-3 rounded-2xl bg-blush/40 p-3 cursor-pointer mb-4">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <div>
          <p className="font-bold text-cocoa text-sm">تفعيل نظام النقاط</p>
          <p className="text-xs text-cocoa-light">وهو مقفول مفيش نقاط بتتكسب أو تتستبدل</p>
        </div>
      </label>
      {enabled && (
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="كل كام جنيه = نقطة"><input className="input" type="number" inputMode="decimal" value={earn || ''} onChange={(e) => setEarn(+e.target.value || 0)} placeholder="مثلاً ١٠" /></Field>
          <Field label="قيمة النقطة (ج.م)"><input className="input" type="number" inputMode="decimal" value={pointValue || ''} onChange={(e) => setPointValue(+e.target.value || 0)} placeholder="مثلاً ١" /></Field>
          <Field label="أقل نقاط للاستبدال"><input className="input" type="number" inputMode="numeric" value={minRedeem || ''} onChange={(e) => setMinRedeem(+e.target.value || 0)} placeholder="مثلاً ٥٠" /></Field>
        </div>
      )}
      <div className="flex justify-end mt-4">
        <button className="btn-primary" onClick={submit} disabled={busy}>{busy && <Loader2 size={18} className="animate-spin" />} حفظ</button>
      </div>
    </div>
  )
}

function StoreIdentity({ settings }: { settings?: SettingsT }) {
  const [cover, setCover] = useState('')
  const [about, setAbout] = useState('')
  const [instagram, setInstagram] = useState('')
  const [facebook, setFacebook] = useState('')
  const [tiktok, setTiktok] = useState('')
  const [hours, setHours] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (settings) {
      setCover(settings.store_cover_url ?? '')
      setAbout(settings.store_about ?? '')
      setInstagram(settings.store_instagram ?? '')
      setFacebook(settings.store_facebook ?? '')
      setTiktok(settings.store_tiktok ?? '')
      setHours(settings.store_hours ?? '')
    }
  }, [settings])

  async function submit() {
    setBusy(true)
    try {
      await saveSettings({
        store_cover_url: cover || null, store_about: about || null,
        store_instagram: instagram || null, store_facebook: facebook || null,
        store_tiktok: tiktok || null, store_hours: hours || null,
      })
      toast('تم حفظ هوية المتجر 🌸')
    } catch {
      toast('حصل خطأ', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4 text-cocoa">
        <Sparkles size={18} className="text-rose" />
        <h2 className="font-bold">هوية المتجر</h2>
        <span className="text-xs text-cocoa-light">— بتظهر للعملاء في المتجر الأونلاين</span>
      </div>
      <div className="space-y-4">
        <div>
          <span className="label">صورة الغلاف (بانر المتجر)</span>
          <ImageUpload value={cover} onChange={setCover} folder="store" wide hint="صورة عريضة تظهر أعلى المتجر · حتى ٥ ميجا" />
        </div>
        <Field label="نبذة عن المتجر">
          <textarea className="input min-h-[70px]" value={about} onChange={(e) => setAbout(e.target.value)} placeholder="مثلاً: إكسسوارات حريمي مختارة بعناية — شحن لكل مصر 🌸" />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="إنستجرام"><input className="input" dir="ltr" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="https://instagram.com/yourstore" /></Field>
          <Field label="فيسبوك"><input className="input" dir="ltr" value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="https://facebook.com/yourstore" /></Field>
          <Field label="تيك توك"><input className="input" dir="ltr" value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="https://tiktok.com/@yourstore" /></Field>
          <Field label="مواعيد العمل"><input className="input" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="السبت–الخميس · ١٢ظ – ١٠م" /></Field>
        </div>
      </div>
      <div className="flex justify-end mt-4">
        <button className="btn-primary" onClick={submit} disabled={busy}>{busy && <Loader2 size={18} className="animate-spin" />} حفظ</button>
      </div>
    </div>
  )
}

function StoreSection({ settings }: { settings?: SettingsT }) {
  const [open, setOpen] = useState(true)
  const [shipping, setShipping] = useState(0)
  const [whatsapp, setWhatsapp] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (settings) {
      setOpen(settings.store_open ?? true)
      setShipping(settings.shipping_fee ?? 0)
      setWhatsapp(settings.store_whatsapp ?? '')
    }
  }, [settings])

  const link = `${window.location.origin}${import.meta.env.BASE_URL}#/store`

  async function submit() {
    setBusy(true)
    try {
      await saveSettings({ store_open: open, shipping_fee: shipping, store_whatsapp: whatsapp || null })
      toast('تم حفظ إعدادات المتجر 🌸')
    } catch {
      toast('حصل خطأ', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4 text-cocoa">
        <Globe size={18} className="text-rose" />
        <h2 className="font-bold">المتجر الأونلاين</h2>
      </div>
      <div className="rounded-2xl bg-blush/40 p-3 mb-4">
        <p className="text-xs text-cocoa-light mb-1">لينك المتجر — ابعته لعملائك:</p>
        <p className="text-sm font-bold text-rose break-all" dir="ltr">{link}</p>
        <div className="flex gap-2 mt-2">
          <button onClick={() => { navigator.clipboard?.writeText(link); toast('اتنسخ اللينك') }} className="btn-ghost text-sm py-1.5"><Copy size={14} /> نسخ</button>
          <a href={link} target="_blank" rel="noreferrer" className="btn-ghost text-sm py-1.5"><ExternalLink size={14} /> افتح المتجر</a>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="مصاريف الشحن"><input className="input" type="number" inputMode="decimal" value={shipping || ''} onChange={(e) => setShipping(+e.target.value || 0)} /></Field>
        <Field label="واتساب المتجر" hint="بكود الدولة مثلاً 201001234567"><input className="input" dir="ltr" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} /></Field>
      </div>
      <label className="flex items-center gap-3 rounded-2xl bg-blush/40 p-3 cursor-pointer mt-3">
        <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} />
        <div>
          <p className="font-bold text-cocoa text-sm">المتجر مفتوح للطلبات</p>
          <p className="text-xs text-cocoa-light">لو قفلته، العملاء مش هيقدروا يطلبوا</p>
        </div>
      </label>
      <div className="flex justify-end mt-4">
        <button className="btn-primary" onClick={submit} disabled={busy}>{busy && <Loader2 size={18} className="animate-spin" />} حفظ</button>
      </div>
    </div>
  )
}

function CategoriesManager() {
  const categories = useLiveQuery(() => db.categories.orderBy('sort_order').toArray(), []) ?? []
  const [name, setName] = useState('')

  async function add() {
    if (!name.trim()) return
    await saveCategory({ name: name.trim(), name_ar: name.trim(), sort_order: categories.length + 1 })
    setName('')
    toast('تمت إضافة التصنيف')
  }

  async function toggle(c: Category) {
    await save('categories', { ...c, is_active: !c.is_active })
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4 text-cocoa">
        <Tags size={18} className="text-rose" />
        <h2 className="font-bold">التصنيفات</h2>
      </div>
      <div className="flex gap-2 mb-4">
        <input
          className="input flex-1"
          placeholder="اسم تصنيف جديد"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="btn-primary" onClick={add}>
          <Plus size={18} /> إضافة
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => toggle(c)}
            className={`chip border ${c.is_active ? 'bg-rose/10 text-rose border-rose/20' : 'bg-blush/40 text-cocoa-light border-pink line-through'}`}
            title={c.is_active ? 'اضغط للإيقاف' : 'اضغط للتفعيل'}
          >
            {c.name_ar ?? c.name}
          </button>
        ))}
      </div>
    </div>
  )
}
