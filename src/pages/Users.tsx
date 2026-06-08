import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { createClient } from '@supabase/supabase-js'
import { Eye, EyeOff, Loader2, ShieldCheck, UserCog, UserPlus } from 'lucide-react'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { syncNow } from '@/data/sync'
import { fmtDate } from '@/lib/format'
import { Empty, Field, Modal, PageHeader } from '@/components/ui'
import { save } from '@/data/repo'
import { useAuth } from '@/store/auth'
import { toast } from '@/store/ui'
import type { Profile, UserRole } from '@/lib/types'

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'owner', label: 'المالك' },
  { value: 'manager', label: 'مدير' },
  { value: 'cashier', label: 'كاشير' },
  { value: 'stock', label: 'أمين مخزن' },
  { value: 'viewer', label: 'مشاهدة' },
]

// roles an admin may assign to a new staff member (owner is never created here)
const NEW_ROLES: { value: UserRole; label: string; ownerOnly?: boolean }[] = [
  { value: 'cashier', label: 'كاشير' },
  { value: 'stock', label: 'أمين مخزن' },
  { value: 'viewer', label: 'مشاهدة' },
  { value: 'manager', label: 'مدير', ownerOnly: true },
]

export default function Users() {
  const { profile, isAdmin } = useAuth()
  const isOwner = profile?.role === 'owner'
  const profiles = useLiveQuery(() => db.profiles.toArray(), []) ?? []
  const [adding, setAdding] = useState(false)

  if (!isAdmin) return <div className="card p-10 text-center"><p className="font-bold text-cocoa">إدارة المستخدمين للمالك والمدير فقط</p></div>

  async function setRole(p: Profile, role: UserRole) {
    if (!isOwner) return toast('تغيير الأدوار للمالك فقط', 'error')
    await save('profiles', { ...p, role })
    toast('تم تحديث الصلاحية')
  }
  async function toggleActive(p: Profile) {
    if (!isOwner) return toast('للمالك فقط', 'error')
    await save('profiles', { ...p, is_active: !p.is_active })
  }

  return (
    <div>
      <PageHeader
        title="المستخدمون والصلاحيات"
        subtitle={`${profiles.length} مستخدم`}
        action={<button onClick={() => setAdding(true)} className="btn-primary"><UserPlus size={18} /> إضافة موظف</button>}
      />

      <div className="card p-4 mb-4 bg-blush/30 border-rose/20">
        <p className="text-sm text-cocoa flex items-start gap-2">
          <ShieldCheck size={18} className="text-rose shrink-0 mt-0.5" />
          <span>اضغط «إضافة موظف» عشان تنشئ حساب للموظف بإيميل وكلمة مرور على طول — هيقدر يسجّل دخوله فوراً من غير تأكيد بريد، وتحدّد صلاحيته من هنا.</span>
        </p>
      </div>

      {profiles.length === 0 ? (
        <div className="card"><Empty icon={<UserCog size={40} />} title="مفيش مستخدمين" /></div>
      ) : (
        <div className="space-y-2">
          {profiles.map((p) => (
            <div key={p.id} className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-full bg-rose/15 text-rose grid place-items-center font-bold shrink-0">{(p.full_name ?? 'U').slice(0, 1)}</div>
                <div className="min-w-0">
                  <p className="font-bold text-cocoa truncate">{p.full_name ?? 'مستخدم'}{p.id === profile?.id ? ' (أنت)' : ''}</p>
                  <p className="text-[11px] text-cocoa-light">انضم {fmtDate(p.created_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="input py-1.5 w-32"
                  value={p.role}
                  disabled={!isOwner}
                  onChange={(e) => setRole(p, e.target.value as UserRole)}
                >
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <button
                  onClick={() => toggleActive(p)}
                  disabled={!isOwner}
                  className={`chip border ${p.is_active ? 'bg-ok/10 text-ok border-ok/20' : 'bg-danger/10 text-danger border-danger/20'} disabled:opacity-60`}
                >
                  {p.is_active ? 'نشط' : 'موقوف'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddEmployee open={adding} onClose={() => setAdding(false)} isOwner={isOwner} />
    </div>
  )
}

function AddEmployee({ open, onClose, isOwner }: { open: boolean; onClose: () => void; isOwner: boolean }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<UserRole>('cashier')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  function reset() {
    setFullName(''); setEmail(''); setPassword(''); setPhone(''); setRole('cashier'); setErr(''); setShow(false)
  }

  async function submit() {
    setErr('')
    if (!fullName.trim()) return setErr('اكتب اسم الموظف')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setErr('الإيميل غير صحيح')
    if (password.length < 6) return setErr('كلمة المرور لازم 6 حروف على الأقل')
    setBusy(true)
    // Isolated auth client: signing up the new staff here must NOT replace the
    // admin's own session, so it runs on a throwaway in-memory client.
    const tmp = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'sb-staff-create' } },
    )
    try {
      const { data, error } = await tmp.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { full_name: fullName.trim() } },
      })
      if (error) {
        const m = error.message.toLowerCase()
        if (m.includes('registered') || m.includes('already')) setErr('الإيميل ده مسجّل بالفعل')
        else if (m.includes('invalid') || m.includes('confirm') || m.includes('sending') || m.includes('email')) setErr('لازم تطفّي «Confirm email» من لوحة Supabase الأول، وبعدها جرّب تاني.')
        else setErr(error.message)
        return
      }
      const uid = data.user?.id
      if (!uid) { setErr('تعذّر إنشاء الحساب'); return }
      // Set the chosen role/phone on the new profile (handle_new_user inserts it as cashier).
      // Done with the ADMIN session; if RLS blocks it the account is still created as cashier.
      const { error: upErr } = await supabase
        .from('profiles')
        .update({ role, phone: phone.trim() || null, full_name: fullName.trim() })
        .eq('id', uid)
      await tmp.auth.signOut().catch(() => {})
      await syncNow() // pull the new profile into the local list
      toast(upErr ? 'تم إنشاء الحساب — عدّل الصلاحية من القائمة' : 'تم إضافة الموظف بنجاح 🌸')
      reset()
      onClose()
    } catch {
      setErr('حصل خطأ، حاول تاني')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => { if (!busy) { reset(); onClose() } }}
      title="إضافة موظف جديد"
      footer={
        <>
          <button onClick={() => { reset(); onClose() }} disabled={busy} className="btn-ghost">إلغاء</button>
          <button onClick={submit} disabled={busy} className="btn-primary">{busy && <Loader2 size={18} className="animate-spin" />}إنشاء الحساب</button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="اسم الموظف"><input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="مثلاً: سارة محمد" /></Field>
        <Field label="البريد الإلكتروني"><input className="input" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@example.com" /></Field>
        <Field label="كلمة المرور" hint="الموظف هيستخدمها لتسجيل الدخول — قولها له.">
          <div className="relative">
            <input className="input pl-11" type={show ? 'text' : 'password'} dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6 حروف على الأقل" minLength={6} />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute left-3 top-1/2 -translate-y-1/2 text-cocoa-light">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
        </Field>
        <Field label="رقم الموبايل (اختياري)"><input className="input" dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" /></Field>
        <Field label="الصلاحية">
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            {NEW_ROLES.filter((r) => isOwner || !r.ownerOnly).map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </Field>
        {err && <p className="text-danger text-sm font-semibold text-center bg-danger/10 rounded-xl py-2">{err}</p>}
      </div>
    </Modal>
  )
}
