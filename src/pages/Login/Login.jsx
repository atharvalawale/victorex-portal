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

  const rise = (d) => ({ style: { '--d': `${d}ms` } });

  return (
    <div className="lg-page">
      {/* ── Paint panel (decorative) ── */}
      <aside className="lg-art" aria-hidden="true">
        <div className="lg-wash lg-wash-a" />
        <div className="lg-wash lg-wash-b" />
        <div className="lg-wash lg-wash-c" />
        <svg className="lg-stroke" viewBox="0 0 600 200" preserveAspectRatio="none">
          <path d="M10 130 C 120 20, 230 210, 330 110 S 520 30, 590 95" />
        </svg>
        <div className="lg-brand"><span className="lg-mark">V</span>Victorex</div>
        <h2 className="lg-hero">
          <span className="lg-line"><span>Smooth finish,</span></span>
          <span className="lg-line"><span>every order.</span></span>
        </h2>
        <p className="lg-tag">Orders, dealers and ledgers in one calm place.</p>
      </aside>

      {/* ── Form panel ── */}
      <main className="lg-panel">
        <div className="lg-form-wrap">
          <p className="lg-eyebrow lg-rise" {...rise(500)}>Management Portal</p>
          <h1 className="lg-heading lg-rise" {...rise(620)}>Welcome back</h1>
          <p className="lg-sub lg-rise" {...rise(720)}>Sign in to your admin account</p>

          {alertMsg && (
            <div className="lg-alert" role="alert">
              <i className="ti ti-alert-circle" aria-hidden="true" />
              {alertMsg}
            </div>
          )}

          <form onSubmit={handleLogin} noValidate>
            <div className="lg-field lg-rise" {...rise(820)}>
              <label className="lg-label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className={`lg-input${errors.email ? ' has-error' : ''}`}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => handleChange('email', e.target.value)}
                autoComplete="email"
                autoFocus
              />
              {errors.email && <div className="lg-error">{errors.email}</div>}
            </div>

            <div className="lg-field lg-rise" {...rise(920)}>
              <label className="lg-label" htmlFor="password">Password</label>
              <div className="lg-pass">
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  className={`lg-input${errors.password ? ' has-error' : ''}`}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="lg-eye"
                  onClick={() => setShowPass((p) => !p)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  <i className={`ti ${showPass ? 'ti-eye-off' : 'ti-eye'}`} aria-hidden="true" />
                </button>
              </div>
              {errors.password && <div className="lg-error">{errors.password}</div>}
            </div>

            <button type="submit" className="lg-btn lg-rise" {...rise(1020)} disabled={loading}>
              {loading ? (
                <span className="lg-spinner" aria-label="Signing in..." />
              ) : (
                <span className="lg-btn-text">Sign in <i className="ti ti-arrow-right" aria-hidden="true" /></span>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}