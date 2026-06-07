import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuth } from '@/store/auth'
import { Field } from '@/components/ui'
import { toast } from '@/store/ui'
import { LOGO_URL } from '@/lib/assets'

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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-blush via-cream to-pink/40">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="relative w-24 h-24 mx-auto">
            <div className="absolute inset-0 rounded-[2rem] bg-rose/30 blur-2xl" />
            <img src={LOGO_URL} alt="Loly Store" className="relative w-24 h-24 rounded-[2rem] shadow-soft object-cover animate-floaty" />
          </div>
          <h1 className="font-display text-2xl font-extrabold text-rose mt-4">Loly Store Manager</h1>
          <p className="text-cocoa-light text-sm mt-1">إدارة محلك بسهولة وأناقة</p>
        </div>

        <form onSubmit={submit} className="card p-6 space-y-4">
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
                className="absolute left-3 top-1/2 -translate-y-1/2 text-cocoa-light"
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>

          {error && <p className="text-danger text-sm font-semibold text-center bg-danger/10 rounded-xl py-2">{error}</p>}

          <button type="submit" disabled={busy} className="btn-primary w-full py-3">
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
  )
}
