import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { db, clearLocalDb } from '@/lib/db'
import { pullAll, startSync, stopSync, syncNow } from '@/data/sync'
import type { Profile } from '@/lib/types'

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  initializing: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  isAdmin: boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [initializing, setInitializing] = useState(true)

  async function loadProfile(userId: string): Promise<Profile | null> {
    let p = (await db.profiles.get(userId)) ?? null
    if (!p && navigator.onLine) {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
      if (data) {
        p = data as Profile
        await db.profiles.put(p)
      }
    }
    return p
  }

  async function bootstrap(s: Session) {
    try {
      const localEmpty = (await db.settings.count()) === 0
      if (navigator.onLine && localEmpty) {
        await pullAll()
      }
      const p = await loadProfile(s.user.id)
      setProfile(p)
      startSync()
      void syncNow({ pull: !localEmpty ? false : false })
    } catch (e) {
      // offline or pull failed — keep going with whatever is local
      const p = await loadProfile(s.user.id)
      setProfile(p)
      startSync()
    }
  }

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      if (data.session) await bootstrap(data.session)
      setInitializing(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (!s) {
        setProfile(null)
        stopSync()
      }
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: translateAuthError(error.message) }
    if (data.session) await bootstrap(data.session)
    return {}
  }

  async function signUp(email: string, password: string, fullName: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) return { error: translateAuthError(error.message) }
    if (data.session) await bootstrap(data.session)
    return {}
  }

  async function signOut() {
    stopSync()
    await supabase.auth.signOut()
    await clearLocalDb()
    setProfile(null)
    setSession(null)
  }

  async function refreshProfile() {
    if (session) setProfile(await loadProfile(session.user.id))
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      initializing,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      isAdmin: profile?.role === 'owner' || profile?.role === 'manager',
    }),
    [session, profile, initializing],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login')) return 'البريد أو كلمة المرور غير صحيحة'
  if (m.includes('already registered')) return 'هذا البريد مسجّل بالفعل'
  if (m.includes('password')) return 'كلمة المرور لازم تكون 6 حروف على الأقل'
  if (m.includes('email')) return 'البريد الإلكتروني غير صالح'
  return msg
}
