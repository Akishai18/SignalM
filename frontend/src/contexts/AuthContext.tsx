import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  isGuest: boolean
  isDemoMode: boolean
  enterGuestMode: () => void
  exitGuestMode: () => void
  enterDemoMode: () => Promise<void>
  signIn: (email: string, password: string) => Promise<AuthError | null>
  signUp: (email: string, password: string) => Promise<AuthError | null>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  sendPasswordReset: (email: string) => Promise<AuthError | null>
  updatePassword: (password: string) => Promise<AuthError | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const GUEST_KEY = 'signalm_guest'
const DEMO_KEY = 'signalm_demo'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isGuest, setIsGuest] = useState(() => localStorage.getItem(GUEST_KEY) === 'true')
  const [isDemoMode, setIsDemoMode] = useState(() => sessionStorage.getItem(DEMO_KEY) === 'true')

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => {
        setSession(data.session)
        setUser(data.session?.user ?? null)
      })
      .catch(() => {
        // Config error or network failure — treat as unauthenticated
      })
      .finally(() => {
        setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        // Clear guest mode on any real sign-in
        setIsGuest(false)
        localStorage.removeItem(GUEST_KEY)
        // Clear demo mode if this is a real user (not the demo account)
        const demoEmail = (import.meta.env.VITE_DEMO_EMAIL as string | undefined)?.trim()
        if (session.user.email !== demoEmail) {
          sessionStorage.removeItem(DEMO_KEY)
          setIsDemoMode(false)
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string): Promise<AuthError | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error
  }

  const signUp = async (email: string, password: string): Promise<AuthError | null> => {
    const { error } = await supabase.auth.signUp({ email, password })
    return error
  }

  const signInWithGoogle = async (): Promise<void> => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  const enterDemoMode = async () => {
    const email = import.meta.env.VITE_DEMO_EMAIL as string
    const password = import.meta.env.VITE_DEMO_PASSWORD as string
    await supabase.auth.signInWithPassword({ email, password })
    sessionStorage.setItem(DEMO_KEY, 'true')
    setIsDemoMode(true)
  }

  const enterGuestMode = () => {
    localStorage.setItem(GUEST_KEY, 'true')
    setIsGuest(true)
  }

  const exitGuestMode = () => {
    localStorage.removeItem(GUEST_KEY)
    setIsGuest(false)
  }

  const signOut = async (): Promise<void> => {
    exitGuestMode()
    await supabase.auth.signOut()
  }

  const sendPasswordReset = async (email: string): Promise<AuthError | null> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return error
  }

  const updatePassword = async (password: string): Promise<AuthError | null> => {
    const { error } = await supabase.auth.updateUser({ password })
    return error
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, isGuest, isDemoMode, enterGuestMode, exitGuestMode, enterDemoMode, signIn, signUp, signInWithGoogle, signOut, sendPasswordReset, updatePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
