/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile, Role } from '../types'

interface AuthState {
  session: Session | null
  profile: Profile | null
  /** Todos los roles de la persona (primario + adicionales de user_roles) */
  roles: Role[]
  isAdmin: boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (!newSession) {
        setProfile(null)
        setLoading(false)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const userId = session?.user.id
    if (!userId) return
    let cancelled = false
    Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('user_roles').select('role').eq('user_id', userId),
    ]).then(([p, r]) => {
      if (cancelled) return
      const prof = p.data as Profile | null
      setProfile(prof)
      const extra = ((r.data ?? []) as { role: Role }[]).map((x) => x.role)
      setRoles(Array.from(new Set([...(prof ? [prof.role] : []), ...extra])))
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [session?.user.id])

  async function signIn(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      return error.message === 'Invalid login credentials'
        ? 'Correo o contraseña incorrectos'
        : error.message
    }
    return null
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function refreshProfile() {
    const userId = session?.user.id
    if (!userId) return
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) setProfile(data as Profile)
  }

  return (
    <AuthContext.Provider value={{ session, profile, roles, isAdmin: roles.includes('admin'), loading, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
