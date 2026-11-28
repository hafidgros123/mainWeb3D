import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

// What every page gets from useAuth().
export interface AuthState {
  session: Session | null
  user: User | null
  authReady: boolean // false until the first check of the saved session is done
  isAdmin: boolean | null // null = still checking
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth must be used inside AuthProvider.')
  return auth
}
