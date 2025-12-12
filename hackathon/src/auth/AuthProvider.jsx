import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../SupaBase.js'

export const AuthContext = createContext(null)

function getRoleFromSession(session) {
  // Check user_metadata first (where signup stores it), then app_metadata
  const role = session?.user?.user_metadata?.role || session?.user?.app_metadata?.role
  return typeof role === 'string' ? role : null
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null) // 'admin' | 'user' | null
  const [loading, setLoading] = useState(true)

  // Function to refresh role from user_details table
  const refreshRole = useCallback(async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession()
    if (currentSession?.user?.id) {
      const { data: userDetails } = await supabase
        .from('user_details')
        .select('role')
        .eq('auth_id', currentSession.user.id)
        .single()
      setRole(userDetails?.role ?? null)
      return userDetails?.role ?? null
    }
    return null
  }, [])

  useEffect(() => {
    let mounted = true

    async function bootstrap() {
      const { data, error } = await supabase.auth.getSession()
      if (!mounted) return
      if (error) {
        // If session retrieval fails, keep user logged out.
        setSession(null)
        setUser(null)
        setRole(null)
        setLoading(false)
        return
      }

      setSession(data.session)
      setUser(data.session?.user ?? null)

      const roleFromToken = getRoleFromSession(data.session)
      if (roleFromToken) {
        setRole(roleFromToken)
        setLoading(false)
        return
      }

      // Fallback: read role from `user_details` table (RLS should allow user to read their own row).
      if (data.session?.user?.id) {
        const { data: userDetails } = await supabase
          .from('user_details')
          .select('role')
          .eq('auth_id', data.session.user.id)
          .single()
        if (!mounted) return
        setRole(userDetails?.role ?? null)
      } else {
        setRole(null)
      }

      setLoading(false)
    }

    bootstrap()

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return
      setSession(newSession)
      setUser(newSession?.user ?? null)

      const roleFromToken = getRoleFromSession(newSession)
      if (roleFromToken) {
        setRole(roleFromToken)
        setLoading(false)
        return
      }

      if (newSession?.user?.id) {
        const { data: userDetails } = await supabase
          .from('user_details')
          .select('role')
          .eq('auth_id', newSession.user.id)
          .single()
        if (!mounted) return
        setRole(userDetails?.role ?? null)
      } else {
        setRole(null)
      }
      setLoading(false)
    })

    return () => {
      mounted = false
      sub?.subscription?.unsubscribe()
    }
  }, [])

  const value = useMemo(
    () => ({
      session,
      user,
      role,
      loading,
      isAdmin: role === 'admin',
      signOut: () => supabase.auth.signOut(),
      refreshRole,
    }),
    [session, user, role, loading, refreshRole],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}


