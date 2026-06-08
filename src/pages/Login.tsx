import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, Sparkles, Heart, ShoppingBag, Boxes, BarChart3 } from 'lucide-react'
import { useAuth } from '@/store/auth'
import { Field } from '@/components/ui'
import { toast } from '@/store/ui'
import { LOGO_URL } from '@/lib/assets'

const FEATURES = [
  { icon: ShoppingBag, label: 'نقطة بيع سريعة' },
  { icon: Boxes, label: 'إدارة مخزون' },
  { icon: BarChart3, label: 'تقارير لحظية' },
]

export default function Login() {
  const { session, signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (session) return <Navigate to="/" replace />

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = mode === 'in' ? await signIn(email.trim(), password) : await signUp(email.trim(), password, fullName.trim())
    setBusy(false)
    if (res.error) {
      setError(res.error)
    } else if (mode === 'up') {
      toast('تم إنشاء الحساب بنجاح 🌸')
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel (desktop only) */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden bg-rose-grad text-white">
        <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-8 -left-10 w-80 h-80 rounded-full bg-white/10 blur-3xl" />
        <Sparkles className="absolute top-1/3 right-1/4 w-10 h-10 opacity-30 animate-floaty" />
        <Heart className="absolute bottom-1/3 left-1/3 w-8 h-8 opacity-20 animate-floaty" style={{ animationDelay: '1s' }} />

        <div className="relative flex items-center gap-3">
          <img src={LOGO_URL} alt="Loly Store" className="w-12 h-12 rounded-2xl object-cover shadow-lift ring-2 ring-white/30" />
          <div className="leading-none">
            <p className="font-display text-2xl font-extrabold">Loly Store</p>
            <p className="text-white/70 text-xs mt-1.5 font-bold">نظام إدارة المحل</p>
          </div>
        </div>

        <div className="relative">
          <span className="inline-flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" /> يشتغل أوفلاين · يزامن تلقائيًا
          </span>
          <h2 className="font-display text-4xl leading-snug font-extrabold mt-4 drop-shadow">
            أهلًا بعودتك 🌸<br />إدارة محلّك<br />من أي مكان
          </h2>
          <p className="text-white/80 mt-3 max-w-sm leading-relaxed">
            نقطة بيع، مخزون، وتقارير — كله في مكان واحد، من اللابتوب أو الموبايل.
          </p>
        </div>

        <div className="relative flex gap-2.5 flex-wrap">
          {FEATURES.map(({ icon: Icon, label }) => (
            <span key={label} className="inline-flex items-center gap-2 bg-white/12 rounded-2xl px-3.5 py-2 text-sm font-bold">
              <Icon className="w-4 h-4" /> {label}
            </span>
          ))}
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10 bg-gradient-to-b from-blush via-cream to-pink/40 lg:bg-none">
        <div className="w-full max-w-sm animate-pop">
          {/* Mobile brand */}
          <div className="lg:hidden flex flex-col items-center text-center mb-8">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 rounded-[1.75rem] bg-rose/30 blur-2xl" />
              <img src={LOGO_URL} alt="Loly Store" className="relative w-20 h-20 rounded-[1.75rem] shadow-soft object-cover animate-floaty" />
            </div>
            <h1 className="font-display text-xl font-extrabold text-rose mt-4">Loly Store Manager</h1>
            <p className="text-cocoa-light text-sm mt-1">إدارة محلك بسهولة وأناقة</p>
          </div>

          <h1 className="hidden lg:block font-display text-[26px] font-extrabold text-cocoa">
            {mode === 'in' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
          </h1>
          <p className="hidden lg:block text-cocoa-light text-sm mt-1">
            {mode === 'in' ? 'سجّل دخولك للوصول إلى لوحة التحكم.' : 'أنشئ حسابك للبدء في إدارة المحل.'}
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <div className="flex bg-blush rounded-2xl p-1">
              <button
                type="button"
                onClick={() => { setMode('in'); setError(null) }}
                className={`flex-1 rounded-xl py-2 text-sm font-bold transition ${mode === 'in' ? 'bg-white text-rose shadow-sm' : 'text-cocoa-light'}`}
              >
                تسجيل الدخول
              </button>
              <button
                type="button"
                onClick={() => { setMode('up'); setError(null) }}
                className={`flex-1 rounded-xl py-2 text-sm font-bold transition ${mode === 'up' ? 'bg-white text-rose shadow-sm' : 'text-cocoa-light'}`}
              >
                حساب جديد
              </button>
            </div>

            {mode === 'up' && (
              <Field label="الاسم">
                <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="اسمك" required />
              </Field>
            )}

            <Field label="البريد الإلكتروني">
              <input
                className="input"
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </Field>

            <Field label="كلمة المرور">
              <div className="relative">
                <input
                  className="input pl-11"
                  type={show ? 'text' : 'password'}
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-cocoa-light hover:text-rose transition"
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>

            {error && <p className="text-danger text-sm font-semibold text-center bg-danger/10 rounded-xl py-2">{error}</p>}

            <button type="submit" disabled={busy} className="btn-primary w-full py-3.5 text-[15px]">
              {busy && <Loader2 size={18} className="animate-spin" />}
              {mode === 'in' ? 'دخول' : 'إنشاء الحساب'}
            </button>

            {mode === 'up' && (
              <p className="text-[11px] text-cocoa-light text-center leading-relaxed">
                أول حساب يتسجّل بيكون <span className="font-bold text-rose">المالك (Owner)</span> بكل الصلاحيات.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
