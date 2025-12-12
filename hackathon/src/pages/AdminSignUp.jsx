import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../SupaBase.js'
import { useAuth } from '../auth/useAuth.js'
import { SITE_URL } from '../siteConfig.js'
import '../css/AuthPages.css'

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
        emailRedirectTo: `${SITE_URL}/auth/callback`,
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
    <div className="auth-page">
      <div className="auth-container">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c1.5 0 3-.3 4.3-.9" stroke="#22C55E" strokeWidth="2" strokeLinecap="round"/>
              <path d="M17 8c-4 0-6 3-6 6s3 6 6 6 6-3 6-6" stroke="#22C55E" strokeWidth="2" strokeLinecap="round"/>
              <path d="M20 5l-3 3" stroke="#22C55E" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="auth-logo-text">EcoQuest</span>
        </div>

        {/* Header */}
        <div className="auth-header">
          <span className="admin-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Admin Access
          </span>
          <h1 className="auth-title">Create Admin Account</h1>
          <p className="auth-subtitle">Set up your administrator account</p>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="auth-form">
          <div className="form-field">
            <label htmlFor="fullName">Full Name (optional)</label>
            <input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              type="text"
              autoComplete="name"
              placeholder="Enter your name"
            />
          </div>

          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              placeholder="Enter admin email"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="password">Password (min 8 characters)</label>
            <input
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="new-password"
              placeholder="Create a password"
              required
              minLength={8}
            />
          </div>

          {error && (
            <div className="auth-error">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          {info && (
            <div className="auth-info">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              {info}
            </div>
          )}

          <button type="submit" disabled={submitting} className="auth-submit-btn admin">
            {submitting ? 'Creating admin account...' : 'Create Admin Account'}
          </button>
        </form>

        {/* Links */}
        <div className="auth-links">
          <p>
            Already have an admin account? <Link to="/admin/login" className="admin-link">Admin Login</Link>
          </p>
          <div className="auth-divider"><span>or</span></div>
          <p>
            Need a regular account? <Link to="/signup">Student Sign Up</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
