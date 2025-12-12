import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../SupaBase.js'
import { useAuth } from '../auth/useAuth.js'

export function AdminLogin() {
  const navigate = useNavigate()
  const { session, role, loading } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (loading) return
    if (!session) return
    
    // STRICT: Non-admin must NEVER be on admin login page
    if (role !== 'admin') {
      // Sign them out and redirect to student login
      supabase.auth.signOut()
      setError('Students cannot use Admin Login. Redirecting to Student Login...')
      setTimeout(() => navigate('/login', { replace: true }), 1500)
      return
    }
    
    // Admin -> admin dashboard
    navigate('/admin', { replace: true })
  }, [session, role, loading, navigate])

  async function onSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setSubmitting(false)
      return
    }

    // Check role from user_metadata first
    let isAdmin = data.user?.user_metadata?.role === 'admin'
    
    // Fallback: check user_details table
    if (!isAdmin && data.user?.id) {
      const { data: userDetails } = await supabase
        .from('user_details')
        .select('role')
        .eq('auth_id', data.user.id)
        .single()
      
      isAdmin = userDetails?.role === 'admin'
    }

    if (!isAdmin) {
      // STRICT: Not an admin - sign out immediately
      setError('This account does not have admin privileges. Use Student Login instead.')
      await supabase.auth.signOut()
      setSubmitting(false)
      return
    }

    // Admin confirmed - redirect will happen via useEffect
    setSubmitting(false)
  }

  return (
    <div style={{ maxWidth: 420, margin: '64px auto', fontFamily: 'system-ui' }}>
      <h1>Admin Login</h1>
      <p style={{ color: '#555' }}>Sign in as administrator.</p>

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
        <label>
          Email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            required
            style={{ width: '100%', padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          Password
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            style={{ width: '100%', padding: 10, marginTop: 6 }}
          />
        </label>

        {error ? (
          <div style={{ color: '#b00020', background: '#ffeef0', padding: 10, borderRadius: 8 }}>
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          style={{ padding: 10, borderRadius: 8, cursor: 'pointer', background: '#06f', color: 'white' }}
        >
          {submitting ? 'Signing in…' : 'Sign in as Admin'}
        </button>
      </form>

      <p style={{ marginTop: 16 }}>
        Don't have an admin account? <Link to="/admin/signup">Admin Sign Up</Link>
      </p>
      <p style={{ marginTop: 8 }}>
        Student? <Link to="/login">Student Login</Link>
      </p>
    </div>
  )
}
