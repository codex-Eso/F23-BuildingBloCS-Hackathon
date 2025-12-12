import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../SupaBase.js'
import { useAuth } from '../auth/useAuth.js'

export function Login() {
  const navigate = useNavigate()
  const { session, role, loading } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (loading) return
    if (!session) return
    
    // STRICT: Admin must NEVER be on student login page
    if (role === 'admin') {
      // Sign them out and show error
      supabase.auth.signOut()
      setError('Admins cannot use Student Login. Redirecting to Admin Login...')
      setTimeout(() => navigate('/admin/login', { replace: true }), 1500)
      return
    }
    
    // Student -> student dashboard
    navigate('/app', { replace: true })
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

    // Check role from user_metadata
    const userRole = data.user?.user_metadata?.role
    
    if (userRole === 'admin') {
      setError('This is an admin account. Please use Admin Login instead.')
      await supabase.auth.signOut()
      setSubmitting(false)
      return
    }

    // Student - redirect will happen via useEffect
    setSubmitting(false)
  }

  return (
    <div style={{ maxWidth: 420, margin: '64px auto', fontFamily: 'system-ui' }}>
      <h1>Student Login</h1>
      <p style={{ color: '#555' }}>Sign in to continue.</p>

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
          style={{ padding: 10, borderRadius: 8, cursor: 'pointer' }}
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p style={{ marginTop: 16 }}>
        Don't have an account? <Link to="/signup">Sign up</Link>
      </p>
      <p style={{ marginTop: 8 }}>
        Admin? <Link to="/admin/login">Admin Login</Link>
      </p>
    </div>
  )
}


