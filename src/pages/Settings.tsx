import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Store, Tags, Loader2, ShieldAlert, KeyRound, Globe, Copy, ExternalLink, Sparkles } from 'lucide-react'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { Field, PageHeader } from '@/components/ui'
import { ImageUpload } from '@/components/ImageUpload'
import { saveSettings, saveCategory, save } from '@/data/repo'
import { useAuth } from '@/store/auth'
import { toast } from '@/store/ui'
import type { Category, Settings as SettingsT } from '@/lib/types'

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
