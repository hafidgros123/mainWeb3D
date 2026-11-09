import { useEffect, useMemo, useRef, useState } from 'react'
import { AuthContext } from './AuthContext'
import { supabase } from '../lib/supabaseClient'

const SESSION_MAX_AGE_MS = 48 * 60 * 60 * 1000
const SESSION_CHECK_EVERY_MS = 5 * 60 * 1000
function isSessionExpired(user) {
  const lastSignIn = Date.parse(user?.last_sign_in_at ?? '')
  return Number.isFinite(lastSignIn) && Date.now() - lastSignIn > SESSION_MAX_AGE_MS
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const expirySignOutTimerRef = useRef(null)

  useEffect(() => {
    const lifecycle = { active: true }
    const checkingSession = { current: false }

    const applySession = (nextSession) => {
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

  const value = useMemo(
    () => ({ session, user: session?.user ?? null, authReady }),
    [session, authReady],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
