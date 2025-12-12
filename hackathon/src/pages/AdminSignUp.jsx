import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../SupaBase.js'
import { useAuth } from '../auth/useAuth.js'

export function AdminSignUp() {
  const navigate = useNavigate()
  const { session, role, loading, refreshRole } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)

  useEffect(() => {
    if (loading) return
    if (!session) return
    
    // STRICT: If already logged in as admin -> go to admin dashboard
    if (role === 'admin') {
      navigate('/admin', { replace: true })
      return
    }
    
    // STRICT: If already logged in as student -> sign out first
    if (role === 'user') {
      supabase.auth.signOut()
      setError('Already logged in as student. Please sign out first to create an admin account.')
      return
    }
  }, [session, role, loading, navigate])

  async function onSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setInfo(null)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          full_name: fullName.trim() || null,
          role: 'admin',
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setSubmitting(false)
      return
    }

    // Set admin role in user_details table
    const authId = data.session?.user?.id || data.user?.id
    
    if (authId) {
      // Wait a moment for trigger to create user_details
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Update user_details to set admin role
      const { error: updateError } = await supabase
        .from('user_details')
        .update({ 
          role: 'admin',
          name: fullName.trim() || null,
        })
        .eq('auth_id', authId)

      if (updateError) {
        console.warn('Could not set admin role:', updateError.message)
      }

      if (data.session) {
        // Refresh the role in AuthProvider then redirect
        await refreshRole()
        navigate('/admin', { replace: true })
      } else {
        setInfo('Check your email to confirm your account. After confirmation, log in via Admin Login.')
      }
    }

    setSubmitting(false)
  }

  return (
    <div style={{ maxWidth: 420, margin: '64px auto', fontFamily: 'system-ui' }}>
      <h1>Admin Sign Up</h1>
      <p style={{ color: '#555' }}>Create an admin account.</p>

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
        <label>
          Full name (optional)
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            type="text"
            autoComplete="name"
            style={{ width: '100%', padding: 10, marginTop: 6 }}
          />
        </label>

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
          Password (min 8 chars)
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
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

        {info ? (
          <div style={{ color: '#0b5', background: '#eefaf0', padding: 10, borderRadius: 8 }}>
            {info}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          style={{ padding: 10, borderRadius: 8, cursor: 'pointer', background: '#06f', color: 'white' }}
        >
          {submitting ? 'Creating admin account…' : 'Create admin account'}
        </button>
      </form>

      <p style={{ marginTop: 16 }}>
        Already have an admin account? <Link to="/admin/login">Admin Login</Link>
      </p>
      <p style={{ marginTop: 8 }}>
        Need a regular account? <Link to="/signup">User Sign Up</Link>
      </p>
    </div>
  )
}

