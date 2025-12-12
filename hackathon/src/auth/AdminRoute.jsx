import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth.js'
import { FullPageLoading } from '../components/FullPageLoading.jsx'

/**
 * AdminRoute - ONLY for admins (role === 'admin')
 * Students are redirected to /app, not allowed here
 */
export function AdminRoute({ children }) {
  const { loading, session, isAdmin } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageLoading />

  // Not logged in -> admin login
  if (!session) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }

  // Student trying to access admin pages -> redirect to student dashboard
  if (!isAdmin) {
    return <Navigate to="/app" replace />
  }

  // Admin accessing admin pages -> allowed
  return children
}
