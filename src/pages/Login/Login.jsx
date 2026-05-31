import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

/* ─── Dummy credentials (replace with real auth later) ─── */
const ADMIN_USER = 'sanjay_admin';
const ADMIN_PASS = 'victorex@2025';

export default function Login() {
  const navigate = useNavigate();

  const [username, setUsername]     = useState('');
  const [password, setPassword]     = useState('');
  const [showPass, setShowPass]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [alertMsg, setAlertMsg]     = useState('');
  const [errors, setErrors]         = useState({});

  /* ── Validation ── */
  function validate() {
    const errs = {};
    if (!username.trim()) errs.username = 'Username is required';
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

    /* Simulate network delay */
    await new Promise((r) => setTimeout(r, 900));

    if (username === ADMIN_USER && password === ADMIN_PASS) {
      /* Store session (dummy — replace with JWT later) */
      sessionStorage.setItem('vx_auth', JSON.stringify({ user: username, role: 'admin' }));
      navigate('/dashboard');
    } else {
      setAlertMsg('Invalid username or password. Please try again.');
      setLoading(false);
    }
  }

  /* ── Field change helper ── */
  function handleChange(field, value) {
    if (field === 'username') setUsername(value);
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

          {/* Username */}
          <div className="login-field">
            <label className="login-label" htmlFor="username">Username</label>
            <div className="login-input-wrap">
              <input
                id="username"
                type="text"
                className={`login-input${errors.username ? ' has-error' : ''}`}
                placeholder="e.g. sanjay_admin"
                value={username}
                onChange={(e) => handleChange('username', e.target.value)}
                autoComplete="username"
                autoFocus
              />
              <span className="login-input-icon">
                <i className="ti ti-user" aria-hidden="true" />
              </span>
            </div>
            {errors.username && (
              <div className="login-error-msg">
                <i className="ti ti-info-circle" aria-hidden="true" />
                {errors.username}
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

          {/* Forgot password */}
          <div className="login-forgot-row">
            <button type="button" className="login-forgot">
              Forgot password?
            </button>
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
