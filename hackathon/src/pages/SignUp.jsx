import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../SupaBase.js'
import { useAuth } from '../auth/useAuth.js'

export function SignUp() {
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
    
    // STRICT: Admin must NEVER be on student signup page
    if (role === 'admin') {
      supabase.auth.signOut()
      setError('Admins cannot use Student Sign Up. Redirecting to Admin area...')
      setTimeout(() => navigate('/admin', { replace: true }), 1500)
      return
    }
    
    // Student -> student dashboard
    navigate('/app', { replace: true })
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
          role: 'user',
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setSubmitting(false)
      return
    }

    // Set student role in user_details
    const authId = data.session?.user?.id || data.user?.id
    
    if (authId) {
      // Wait a moment for trigger to create user_details
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Update user_details to ensure user role
      const { error: updateError } = await supabase
        .from('user_details')
        .update({ 
          role: 'user',
          name: fullName.trim() || null,
        })
        .eq('auth_id', authId)

      if (updateError) {
        console.warn('Could not update user details:', updateError.message)
      }

      if (data.session) {
        await refreshRole()
        navigate('/app', { replace: true })
      } else {
        setInfo('Check your email to confirm your account, then log in via Student Login.')
      }
    }

    setSubmitting(false)
  }

  return (
    <div style={{ maxWidth: 420, margin: '64px auto', fontFamily: 'system-ui' }}>
      <h1>Student Sign Up</h1>
      <p style={{ color: '#555' }}>Create a student account.</p>

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
          style={{ padding: 10, borderRadius: 8, cursor: 'pointer' }}
        >
          {submitting ? 'Creating…' : 'Create account'}
        </button>
      </form>

      <p style={{ marginTop: 16 }}>
        Already have an account? <Link to="/login">Login</Link>
      </p>
      <p style={{ marginTop: 8 }}>
        Need an admin account? <Link to="/admin/signup">Admin Sign Up</Link>
      </p>
    </div>
  )
}


