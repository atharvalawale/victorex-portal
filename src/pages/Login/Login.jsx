import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import './Login.css';

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPass, setShowPass]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [alertMsg, setAlertMsg]     = useState('');
  const [errors, setErrors]         = useState({});

  /* ── Validation ── */
  function validate() {
    const errs = {};
    if (!email.trim()) errs.email = 'Email is required';
    if (!password.trim()) errs.password = 'Password is required';
    return errs;
  }

  /* ── Submit ── */
  async function handleLogin(e) {
    e.preventDefault();
    setAlertMsg('');

    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      navigate('/dashboard');
    } catch {
      setAlertMsg('Unable to sign in with those details. Please check your email and password.');
      setLoading(false);
    }
  }

  /* ── Field change helper ── */
  function handleChange(field, value) {
    if (field === 'email') setEmail(value);
    if (field === 'password') setPassword(value);
    /* Clear error on type */
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  }

  return (
    <div className="login-page">
      <div className="login-card">

        {/* ── Logo ── */}
        <div className="login-logo-row">
          <div className="login-logo-mark">
            <span>V</span>
          </div>
          <div className="login-logo-text">
            <span className="login-logo-name">Victorex</span>
            <span className="login-logo-sub">Management Portal</span>
          </div>
        </div>

        <div className="login-divider" />

        {/* ── Heading ── */}
        <h1 className="login-heading">Welcome back</h1>
        <p className="login-subheading">Sign in to your admin account</p>

        {/* ── Alert banner ── */}
        {alertMsg && (
          <div className="login-alert">
            <i className="ti ti-alert-circle" aria-hidden="true" />
            {alertMsg}
          </div>
        )}

        {/* ── Form ── */}
        <form className="login-form" onSubmit={handleLogin} noValidate>

          {/* Email */}
          <div className="login-field">
            <label className="login-label" htmlFor="email">Email</label>
            <div className="login-input-wrap">
              <input
                id="email"
                type="email"
                className={`login-input${errors.email ? ' has-error' : ''}`}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => handleChange('email', e.target.value)}
                autoComplete="email"
                autoFocus
              />
              <span className="login-input-icon">
                <i className="ti ti-user" aria-hidden="true" />
              </span>
            </div>
            {errors.email && (
              <div className="login-error-msg">
                <i className="ti ti-info-circle" aria-hidden="true" />
                {errors.email}
              </div>
            )}
          </div>

          {/* Password */}
          <div className="login-field">
            <label className="login-label" htmlFor="password">Password</label>
            <div className="login-input-wrap">
              <input
                id="password"
                type={showPass ? 'text' : 'password'}
                className={`login-input${errors.password ? ' has-error' : ''}`}
                placeholder="••••••••"
                value={password}
                onChange={(e) => handleChange('password', e.target.value)}
                autoComplete="current-password"
              />
              <span className="login-input-icon">
                <i className="ti ti-lock" aria-hidden="true" />
              </span>
              <button
                type="button"
                className="login-eye-btn"
                onClick={() => setShowPass((p) => !p)}
                aria-label={showPass ? 'Hide password' : 'Show password'}
              >
                <i className={`ti ${showPass ? 'ti-eye-off' : 'ti-eye'}`} aria-hidden="true" />
              </button>
            </div>
            {errors.password && (
              <div className="login-error-msg">
                <i className="ti ti-info-circle" aria-hidden="true" />
                {errors.password}
              </div>
            )}
          </div>

          {/* Submit */}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? (
              <span className="login-spinner" aria-label="Signing in..." />
            ) : (
              <>
                <i className="ti ti-login" aria-hidden="true" />
                Sign in
              </>
            )}
          </button>

        </form>

        {/* ── Footer ── */}
        <div className="login-footer">
          <div className="login-user-pill">
            <div className="login-avatar">SL</div>
            <div className="login-user-info">
              <div className="name">Sanjay Lawale</div>
              <div className="role">Gayatri Metal Finishers, Satara</div>
            </div>
          </div>
          <span className="login-admin-badge">Admin</span>
        </div>

      </div>
    </div>
  );
}
