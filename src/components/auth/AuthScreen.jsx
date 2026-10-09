import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import './AuthScreen.css'

function AuthScreen({ isRecovery }) {
  const [tab, setTab]           = useState('signin') // 'signin' | 'signup' | 'reset'
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [info, setInfo]         = useState('')

  function clearMessages() { setError(''); setInfo('') }

  function switchTab(t) {
    clearMessages()
    setTab(t)
    setPassword('')
    setConfirm('')
  }

  async function handleSignIn(e) {
    e.preventDefault()
    clearMessages()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
    // On success App.jsx onAuthStateChange fires SIGNED_IN → session set → planner shown
  }

  async function handleSignUp(e) {
    e.preventDefault()
    clearMessages()
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm)  { setError('Passwords do not match.'); return }
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
    } else if (!data.session) {
      // Email confirmation is enabled — no session yet
      setInfo('Account created. Check your email for a confirmation link before signing in.')
    }
    // If data.session is non-null, onAuthStateChange in App.jsx handles the transition
    setLoading(false)
  }

  async function handleReset(e) {
    e.preventDefault()
    clearMessages()
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    if (error) {
      setError(error.message)
    } else {
      setInfo('Reset link sent — check your email.')
    }
    setLoading(false)
  }

  async function handleUpdatePassword(e) {
    e.preventDefault()
    clearMessages()
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm)  { setError('Passwords do not match.'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
    } else {
      setInfo('Password updated. Signing you in…')
    }
    setLoading(false)
    // App.jsx onAuthStateChange fires USER_UPDATED → isRecovery cleared → planner shown
  }

  // ── Password-recovery mode ─────────────────────────────────────────────────
  if (isRecovery) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo">
            <span className="auth-logo-accent">J</span>ARVIS
          </div>
          <h2 className="auth-card-title">Set a new password</h2>
          <form className="auth-form" onSubmit={handleUpdatePassword}>
            <div className="auth-field">
              <label className="auth-label" htmlFor="up-password">New password</label>
              <input
                id="up-password"
                className="auth-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoFocus
                autoComplete="new-password"
              />
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="up-confirm">Confirm new password</label>
              <input
                id="up-confirm"
                className="auth-input"
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            {error && <p className="auth-error" role="alert">{error}</p>}
            {info  && <p className="auth-info"  role="status">{info}</p>}
            <button className="auth-btn" type="submit" disabled={loading}>
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── Normal auth screen ─────────────────────────────────────────────────────
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-accent">J</span>ARVIS
        </div>

        {tab !== 'reset' && (
          <div className="auth-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={tab === 'signin'}
              className={`auth-tab ${tab === 'signin' ? 'active' : ''}`}
              onClick={() => switchTab('signin')}
            >
              Sign in
            </button>
            <button
              role="tab"
              aria-selected={tab === 'signup'}
              className={`auth-tab ${tab === 'signup' ? 'active' : ''}`}
              onClick={() => switchTab('signup')}
            >
              Create account
            </button>
          </div>
        )}

        {tab === 'signin' && (
          <form className="auth-form" onSubmit={handleSignIn}>
            <div className="auth-field">
              <label className="auth-label" htmlFor="si-email">Email</label>
              <input
                id="si-email"
                className="auth-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
              />
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="si-password">Password</label>
              <input
                id="si-password"
                className="auth-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {error && <p className="auth-error" role="alert">{error}</p>}
            {info  && <p className="auth-info"  role="status">{info}</p>}
            <button className="auth-btn" type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
            <button type="button" className="auth-link" onClick={() => switchTab('reset')}>
              Forgot password?
            </button>
          </form>
        )}

        {tab === 'signup' && (
          <form className="auth-form" onSubmit={handleSignUp}>
            <div className="auth-field">
              <label className="auth-label" htmlFor="su-email">Email</label>
              <input
                id="su-email"
                className="auth-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
              />
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="su-password">Password</label>
              <input
                id="su-password"
                className="auth-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="su-confirm">Confirm password</label>
              <input
                id="su-confirm"
                className="auth-input"
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            {error && <p className="auth-error" role="alert">{error}</p>}
            {info  && <p className="auth-info"  role="status">{info}</p>}
            <button className="auth-btn" type="submit" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        )}

        {tab === 'reset' && (
          <form className="auth-form" onSubmit={handleReset}>
            <p className="auth-reset-desc">
              Enter your email and we'll send you a link to reset your password.
            </p>
            <div className="auth-field">
              <label className="auth-label" htmlFor="rs-email">Email</label>
              <input
                id="rs-email"
                className="auth-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
              />
            </div>
            {error && <p className="auth-error" role="alert">{error}</p>}
            {info  && <p className="auth-info"  role="status">{info}</p>}
            <button className="auth-btn" type="submit" disabled={loading}>
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
            <button type="button" className="auth-link" onClick={() => switchTab('signin')}>
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default AuthScreen
