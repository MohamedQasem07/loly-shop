import { Suspense, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  BarChart3, Boxes, Building2, Calculator, CalendarDays, ChevronLeft, ClipboardList, Home, LogOut,
  MoreHorizontal, Package, ReceiptText, RefreshCw, Settings as SettingsIcon, ShoppingBag, Sparkles,
  Star, Truck, Undo2, UserCog, Users, Wallet, Wifi, WifiOff, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { useAuth } from '@/store/auth'
import { useSyncStatus } from '@/data/useSync'
import { syncNow } from '@/data/sync'
import type { UserRole } from '@/lib/types'
import { cn } from '@/lib/cn'
import { Spinner } from '@/components/ui'
import { LOGO_URL } from '@/lib/assets'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  roles?: UserRole[]
}

const NAV: NavItem[] = [
  { to: '/', label: 'الرئيسية', icon: Home },
  { to: '/pos', label: 'نقطة البيع', icon: ShoppingBag, roles: ['owner', 'manager', 'cashier'] },
  { to: '/orders', label: 'أوردرات المتجر', icon: ClipboardList, roles: ['owner', 'manager'] },
  { to: '/reviews', label: 'التقييمات', icon: Star, roles: ['owner', 'manager'] },
  { to: '/products', label: 'المنتجات', icon: Package },
  { to: '/purchases', label: 'استلام بضاعة', icon: Truck, roles: ['owner', 'manager', 'stock'] },
  { to: '/stock', label: 'حركات المخزون', icon: Boxes, roles: ['owner', 'manager', 'stock'] },
  { to: '/expenses', label: 'المصاريف', icon: ReceiptText, roles: ['owner', 'manager'] },
  { to: '/treasury', label: 'الخزينة', icon: Wallet, roles: ['owner', 'manager'] },
  { to: '/suppliers', label: 'الموردين', icon: Building2, roles: ['owner', 'manager', 'stock'] },
  { to: '/customers', label: 'العملاء', icon: Users, roles: ['owner', 'manager', 'cashier'] },
  { to: '/returns', label: 'المرتجعات', icon: Undo2, roles: ['owner', 'manager'] },
  { to: '/reports', label: 'التقارير', icon: BarChart3, roles: ['owner', 'manager', 'viewer'] },
  { to: '/accounting', label: 'الحسابات', icon: Calculator, roles: ['owner', 'manager'] },
  { to: '/users', label: 'المستخدمين', icon: UserCog, roles: ['owner'] },
  { to: '/settings', label: 'الإعدادات', icon: SettingsIcon, roles: ['owner', 'manager'] },
]

const BOTTOM = ['/', '/pos', '/products', '/reports']

function allowed(item: NavItem, role?: UserRole) {
  if (!item.roles) return true
  return role ? item.roles.includes(role) : false
}

export function Layout() {
  const { profile, signOut } = useAuth()
  const role = profile?.role
  const nav = NAV.filter((n) => allowed(n, role))
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <div className="min-h-full flex">
      {/* Desktop sidebar (right in RTL) */}
      <aside className="hidden lg:flex flex-col w-[270px] shrink-0 bg-white/80 backdrop-blur border-l border-pink/50 p-4 sticky top-0 h-screen shadow-[0_10px_40px_-24px_rgba(209,59,131,0.4)]">
        <Brand />
        <nav className="flex-1 mt-6 space-y-1 overflow-auto no-sb pe-0.5">
          {nav.map((n) => (
            <SideLink key={n.to} item={n} />
          ))}
        </nav>
        <Link
          to="/store"
          className="mt-3 rounded-2xl bg-rose-grad text-white p-3 shadow-soft hover:shadow-lift hover:-translate-y-0.5 transition flex items-center gap-2.5"
        >
          <span className="w-9 h-9 rounded-xl bg-white/20 grid place-items-center shrink-0"><Sparkles size={18} /></span>
          <span className="flex-1 leading-tight min-w-0">
            <span className="block font-extrabold text-sm">المتجر الأونلاين</span>
            <span className="block text-[11px] text-white/80">شوف متجرك للزباين</span>
          </span>
          <ChevronLeft size={18} className="shrink-0" />
        </Link>
        <UserBox onSignOut={signOut} name={profile?.full_name} role={role} />
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 p-4 sm:p-6 lg:px-8 pb-28 lg:pb-8 max-w-[1760px] w-full mx-auto">
          <Suspense fallback={<div className="grid place-items-center py-24"><Spinner className="w-7 h-7" /></div>}>
            <div className="animate-fadeIn">
              <Outlet />
            </div>
          </Suspense>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-pink/60 flex items-stretch justify-around px-1 pt-1 safe-bottom shadow-[0_-8px_24px_-12px_rgba(91,58,40,0.18)]">
        {NAV.filter((n) => BOTTOM.includes(n.to) && allowed(n, role)).map((n) => (
          <BottomLink key={n.to} item={n} />
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex-1 flex flex-col items-center gap-0.5 py-2 text-cocoa-light"
        >
          <MoreHorizontal size={22} />
          <span className="text-[10px] font-bold">المزيد</span>
        </button>
      </nav>

      {/* Mobile "more" sheet */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end animate-fadeIn">
          <div className="absolute inset-0 bg-cocoa/40 backdrop-blur-sm" onClick={() => setMoreOpen(false)} />
          <div className="relative w-full bg-white rounded-t-3xl p-5 pb-8 safe-bottom">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-extrabold text-lg">كل الأقسام</h3>
              <button onClick={() => setMoreOpen(false)} className="text-cocoa-light">
                <X />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {nav.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex flex-col items-center gap-1.5 rounded-2xl p-3 text-center border transition',
                      isActive ? 'bg-rose-grad text-white border-rose shadow-soft' : 'bg-blush/50 border-pink/50 text-cocoa',
                    )
                  }
                >
                  <n.icon size={22} />
                  <span className="text-xs font-bold leading-tight">{n.label}</span>
                </NavLink>
              ))}
            </div>
            <Link
              to="/store"
              onClick={() => setMoreOpen(false)}
              className="btn-gold w-full mt-4"
            >
              <Sparkles size={18} /> زيارة المتجر الأونلاين
            </Link>
            <button onClick={signOut} className="btn-ghost w-full mt-2 text-danger border-danger/30">
              <LogOut size={18} /> تسجيل الخروج
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0">
        <div className="absolute inset-0 rounded-2xl bg-rose/30 blur-lg" />
        <img src={LOGO_URL} alt="Loly" className="relative w-12 h-12 rounded-2xl object-cover shadow-soft ring-2 ring-white" />
      </div>
      <div className="leading-tight">
        <p className="font-display font-extrabold text-rose text-xl">Loly Store</p>
        <p className="text-[11px] text-cocoa-light font-bold flex items-center gap-1">
          <Sparkles size={11} className="text-gold" /> إدارة المحل
        </p>
      </div>
    </div>
  )
}

function SideLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn(
          'nav-link group',
          isActive
            ? 'bg-rose-grad text-white shadow-soft'
            : 'text-cocoa-light hover:bg-blush hover:text-cocoa',
        )
      }
    >
      {({ isActive }) => (
        <>
          <item.icon size={20} className={cn('shrink-0 transition-colors', !isActive && 'text-rose/70 group-hover:text-rose')} />
          <span className="flex-1">{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

function BottomLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn('flex-1 flex flex-col items-center gap-0.5 py-2', isActive ? 'text-rose' : 'text-cocoa-light')
      }
    >
      {({ isActive }) => (
        <>
          <span className={cn('grid place-items-center rounded-xl px-3 py-0.5 transition-colors', isActive && 'bg-blush')}>
            <item.icon size={22} />
          </span>
          <span className="text-[10px] font-bold">{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

function UserBox({ name, role, onSignOut }: { name?: string | null; role?: UserRole; onSignOut: () => void }) {
  return (
    <div className="mt-3 pt-3 border-t border-pink/50">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-rose-grad text-white grid place-items-center font-extrabold shadow-soft shrink-0">
          {(name ?? 'U').slice(0, 1)}
        </div>
        <div className="leading-tight min-w-0">
          <p className="font-bold text-sm truncate">{name ?? 'مستخدم'}</p>
          <p className="text-[11px] text-cocoa-light">{roleLabel(role)}</p>
        </div>
      </div>
      <button onClick={onSignOut} className="btn-ghost w-full text-danger border-danger/30 text-sm py-2">
        <LogOut size={16} /> خروج
      </button>
    </div>
  )
}

function Topbar() {
  const sync = useSyncStatus()
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-30 bg-cream/80 backdrop-blur-lg border-b border-pink/40 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
      <div className="lg:hidden flex items-center gap-2" onClick={() => navigate('/')}>
        <img src={LOGO_URL} alt="Loly" className="w-9 h-9 rounded-xl object-cover shadow-soft" />
        <span className="font-display font-extrabold text-rose">Loly Store</span>
      </div>
      <div className="hidden lg:flex items-center gap-2 text-cocoa-light">
        <CalendarDays size={16} className="text-rose" />
        <span className="text-sm font-bold first-letter:uppercase">{format(new Date(), 'EEEE، d MMMM yyyy', { locale: ar })}</span>
      </div>
      <div className="flex items-center gap-2">
        <Link to="/store" className="btn-soft !py-2 !px-3.5 text-sm hidden sm:inline-flex">
          <Sparkles size={16} /> المتجر الأونلاين
        </Link>
        <button
          onClick={() => syncNow({ pull: false })}
          className={cn('chip border', sync.online ? 'chip-ok border-ok/20' : 'chip-warn border-warn/20')}
          title="مزامنة الآن"
        >
          {sync.syncing ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : sync.online ? (
            <Wifi size={14} />
          ) : (
            <WifiOff size={14} />
          )}
          {sync.syncing ? 'مزامنة…' : sync.online ? 'متصل' : 'غير متصل'}
          {sync.pending > 0 && <span className="mr-1 rounded-full bg-rose text-white px-1.5 text-[10px]">{sync.pending}</span>}
        </button>
      </div>
    </header>
  )
}

function roleLabel(role?: UserRole) {
  switch (role) {
    case 'owner': return 'المالك'
    case 'manager': return 'مدير'
    case 'cashier': return 'كاشير'
    case 'stock': return 'أمين مخزن'
    case 'viewer': return 'مشاهدة'
    default: return ''
  }
}
