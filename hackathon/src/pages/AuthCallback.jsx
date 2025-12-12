import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'
import { FullPageLoading } from '../components/FullPageLoading.jsx'

export function AuthCallback() {
  const navigate = useNavigate()
  const { session, role, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    if (!session) {
      navigate('/login', { replace: true })
      return
    }
    navigate(role === 'admin' ? '/admin' : '/app', { replace: true })
  }, [loading, session, role, navigate])

  return <FullPageLoading />
}


