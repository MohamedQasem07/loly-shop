import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  BarChart3, Boxes, Building2, Calculator, ClipboardList, Home, LogOut, MoreHorizontal, Package,
  ReceiptText, RefreshCw, Settings as SettingsIcon, ShoppingBag, Truck,
  Undo2, UserCog, Users, Wallet, Wifi, WifiOff, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '@/store/auth'
import { useSyncStatus } from '@/data/useSync'
import { syncNow } from '@/data/sync'
import type { UserRole } from '@/lib/types'
import { cn } from '@/lib/cn'
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
    <div className="min-h-full flex bg-cream">
      {/* Desktop sidebar (right in RTL) */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-white border-l border-pink/50 p-4 sticky top-0 h-screen">
        <Brand />
        <nav className="flex-1 mt-6 space-y-1 overflow-auto">
          {nav.map((n) => (
            <SideLink key={n.to} item={n} />
          ))}
        </nav>
        <UserBox onSignOut={signOut} name={profile?.full_name} role={role} />
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 p-4 sm:p-6 pb-28 lg:pb-6 max-w-6xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-pink/60 flex items-stretch justify-around px-1 pt-1 safe-bottom">
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
        <div className="lg:hidden fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-cocoa/40 backdrop-blur-sm" onClick={() => setMoreOpen(false)} />
          <div className="relative w-full bg-white rounded-t-3xl p-5 pb-8 safe-bottom">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-lg">كل الأقسام</h3>
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
                      isActive ? 'bg-rose text-white border-rose' : 'bg-blush/50 border-pink/50 text-cocoa',
                    )
                  }
                >
                  <n.icon size={22} />
                  <span className="text-xs font-bold leading-tight">{n.label}</span>
                </NavLink>
              ))}
            </div>
            <button onClick={signOut} className="btn-ghost w-full mt-4 text-danger border-danger/30">
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
      <img src={LOGO_URL} alt="Loly" className="w-11 h-11 rounded-2xl object-cover shadow-soft" />
      <div className="leading-tight">
        <p className="font-display font-extrabold text-rose text-lg">Loly Store</p>
        <p className="text-[11px] text-cocoa-light font-semibold">إدارة المحل</p>
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
          'flex items-center gap-3 rounded-2xl px-3.5 py-2.5 font-semibold transition',
          isActive ? 'bg-rose text-white shadow-soft' : 'text-cocoa-light hover:bg-blush hover:text-cocoa',
        )
      }
    >
      <item.icon size={20} />
      <span>{item.label}</span>
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
      <item.icon size={22} />
      <span className="text-[10px] font-bold">{item.label}</span>
    </NavLink>
  )
}

function UserBox({ name, role, onSignOut }: { name?: string | null; role?: UserRole; onSignOut: () => void }) {
  return (
    <div className="mt-4 pt-4 border-t border-pink/50">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-rose/15 text-rose grid place-items-center font-bold">
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
    <header className="sticky top-0 z-30 bg-cream/85 backdrop-blur border-b border-pink/40 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
      <div className="lg:hidden flex items-center gap-2" onClick={() => navigate('/')}>
        <img src={LOGO_URL} alt="Loly" className="w-9 h-9 rounded-xl object-cover" />
        <span className="font-display font-extrabold text-rose">Loly Store</span>
      </div>
      <div className="hidden lg:block" />
      <button
        onClick={() => syncNow({ pull: false })}
        className={cn(
          'chip border',
          sync.online ? 'bg-ok/10 text-ok border-ok/20' : 'bg-warn/10 text-warn border-warn/20',
        )}
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
