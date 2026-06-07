import { useLiveQuery } from 'dexie-react-hooks'
import { ShieldCheck, UserCog } from 'lucide-react'
import { db } from '@/lib/db'
import { fmtDate } from '@/lib/format'
import { Empty, PageHeader } from '@/components/ui'
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

export default function Users() {
  const { profile, isAdmin } = useAuth()
  const isOwner = profile?.role === 'owner'
  const profiles = useLiveQuery(() => db.profiles.toArray(), []) ?? []

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
      <PageHeader title="المستخدمون والصلاحيات" subtitle={`${profiles.length} مستخدم`} />

      <div className="card p-4 mb-4 bg-blush/30 border-rose/20">
        <p className="text-sm text-cocoa flex items-start gap-2">
          <ShieldCheck size={18} className="text-rose shrink-0 mt-0.5" />
          <span>عشان تضيف موظف جديد: خلّيه يفتح التطبيق ويعمل «حساب جديد» — هيظهر هنا تلقائياً كـ«كاشير»، وانت تغيّر صلاحيته من القائمة.</span>
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
    </div>
  )
}
