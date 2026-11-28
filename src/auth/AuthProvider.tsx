import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { AuthContext, type AuthState } from './AuthContext'
import { supabase } from '../lib/supabaseClient'

const SESSION_MAX_AGE_MS = 48 * 60 * 60 * 1000
const SESSION_CHECK_EVERY_MS = 5 * 60 * 1000
function isSessionExpired(user: User | null | undefined): boolean {
  const lastSignIn = Date.parse(user?.last_sign_in_at ?? '')
  return Number.isFinite(lastSignIn) && Date.now() - lastSignIn > SESSION_MAX_AGE_MS
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  // null = still checking, true / false = known. Asked to the database (public.is_admin), never decided here.
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const expirySignOutTimerRef = useRef<number | undefined>(undefined)
  const userId = session?.user?.id ?? null

  useEffect(() => {
    if (!userId) {
      setIsAdmin(false)
      return undefined
    }
    let cancelled = false
    setIsAdmin(null)
    supabase.rpc('is_admin').then(({ data, error }) => {
      if (cancelled) return
      if (error) console.error('Could not check the admin status:', error)
      setIsAdmin(!error && data === true)
    })
    return () => { cancelled = true }
  }, [userId])

  useEffect(() => {
    const lifecycle = { active: true }
    const checkingSession = { current: false }

    const applySession = (nextSession: Session | null) => {
      if (!lifecycle.active) return
      const nextUser = nextSession?.user ?? null
      if (nextUser && isSessionExpired(nextUser)) {
        setSession(null)
        expirySignOutTimerRef.current = window.setTimeout(() => {
          if (lifecycle.active) void supabase.auth.signOut()
        }, 0)
      } else {
        setSession(nextSession ?? null)
      }
      setAuthReady(true)
    }

    const checkSession = async () => {
      if (checkingSession.current) return
      checkingSession.current = true
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError
        if (!sessionData.session) {
          applySession(null)
          return
        }

        const { data: userData, error: userError } = await supabase.auth.getUser()
        if (userError || !userData.user) {
          if (userError) console.error('Could not validate the current session:', userError)
          await supabase.auth.signOut()
          return
        }
        applySession(sessionData.session)
      } catch (error) {
        console.error('Could not restore the current session:', error)
        if (lifecycle.active) setAuthReady(true)
      } finally {
        checkingSession.current = false
      }
    }

    void checkSession()
    const { data: authSubscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (lifecycle.active) applySession(nextSession)
    })
    const timer = window.setInterval(() => void checkSession(), SESSION_CHECK_EVERY_MS)

    return () => {
      lifecycle.active = false
      window.clearTimeout(expirySignOutTimerRef.current)
      window.clearInterval(timer)
      authSubscription.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthState>(
    () => ({ session, user: session?.user ?? null, authReady, isAdmin }),
    [session, authReady, isAdmin],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
