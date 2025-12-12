import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth.js'
import { FullPageLoading } from '../components/FullPageLoading.jsx'

/**
 * StudentRoute - ONLY for students (role !== 'admin')
 * Admins are redirected to /admin, not allowed here
 */
export function ProtectedRoute({ children }) {
  const { loading, session, role, isAdmin } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageLoading />

  // Not logged in -> student login
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  // Admin trying to access student pages -> redirect to admin dashboard
  if (isAdmin) {
    return <Navigate to="/admin" replace />
  }

  // Student accessing student pages -> allowed
  return children
}
