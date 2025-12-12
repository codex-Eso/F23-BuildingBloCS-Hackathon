import { Navigate } from 'react-router-dom'
import { useAuth } from './useAuth.js'
import { FullPageLoading } from '../components/FullPageLoading.jsx'

/**
 * RoleRedirect - Redirects to the correct dashboard based on role
 * Admin -> /admin
 * Student -> /app
 * Not logged in -> /login
 */
export function RoleRedirect() {
  const { loading, session, isAdmin } = useAuth()

  if (loading) return <FullPageLoading />

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (isAdmin) {
    return <Navigate to="/admin" replace />
  }

  return <Navigate to="/app" replace />
}

