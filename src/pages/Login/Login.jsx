import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import './Login.css';

const CHIPS = [
  { name: 'WallVex Pro', color: '#C9922A' },
  { name: 'Chromvex',    color: '#0B1F3A' },
  { name: 'Primvex',     color: '#E8B84B' },
];

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPass, setShowPass]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [alertMsg, setAlertMsg]     = useState('');
  const [errors, setErrors]         = useState({});
  const [capsOn, setCapsOn]         = useState(false);
  const artRef = useRef(null);

  /* Soft mouse parallax on the paint panel (skipped on touch / reduced motion) */
  useEffect(() => {
    const el = artRef.current;
    const quiet = window.matchMedia('(prefers-reduced-motion: reduce), (pointer: coarse)').matches;
    if (!el || quiet) return undefined;
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
    const tick = () => {
      x += (tx - x) * 0.06; y += (ty - y) * 0.06;
      el.style.setProperty('--mx', x.toFixed(3));
      el.style.setProperty('--my', y.toFixed(3));
      raf = Math.abs(tx - x) > 0.002 || Math.abs(ty - y) > 0.002 ? requestAnimationFrame(tick) : 0;
    };
    const move = (e) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    window.addEventListener('pointermove', move);
    return () => { window.removeEventListener('pointermove', move); cancelAnimationFrame(raf); };
  }, []);

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
  const checkCaps = (e) => setCapsOn(!!e.getModifierState?.('CapsLock'));

  return (
    <div className="lg-page">
      {/* ── Paint panel (decorative) ── */}
      <aside className="lg-art" ref={artRef} aria-hidden="true">
        <div className="lg-layer">
          <div className="lg-wash lg-wash-a" />
          <div className="lg-wash lg-wash-b" />
          <div className="lg-wash lg-wash-c" />
        </div>
        <svg className="lg-stroke" viewBox="0 0 600 200" preserveAspectRatio="none">
          <defs>
            <filter id="lg-dry" x="-5%" y="-40%" width="110%" height="180%">
              <feTurbulence type="fractalNoise" baseFrequency="0.03 0.55" numOctaves="2" seed="4" result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale="10" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
          <g filter="url(#lg-dry)">
            <path className="lg-p1" d="M10 130 C 120 20, 230 210, 330 110 S 520 30, 590 95" />
            <path className="lg-p2" d="M10 142 C 130 40, 240 215, 335 124 S 525 48, 590 108" />
          </g>
        </svg>

        <div className="lg-brand"><span className="lg-mark">V</span>Victorex</div>
        <div className="lg-copy">
          <h2 className="lg-hero">
            <span className="lg-line"><span>Smooth finish,</span></span>
            <span className="lg-line"><span>every order.</span></span>
          </h2>
          <p className="lg-tag">Orders, dealers and ledgers in one calm place.</p>
          <ul className="lg-chips">
            {CHIPS.map((c, i) => (
              <li key={c.name} style={{ '--c': c.color, '--i': i }}>
                <span className="lg-chip" />{c.name}
              </li>
            ))}
          </ul>
          <p className="lg-co">Gayatri Metal Finishers</p>
        </div>
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
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-err' : undefined}
                autoFocus
              />
              {errors.email && <div className="lg-error" id="email-err">{errors.email}</div>}
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
                  onKeyDown={checkCaps}
                  onKeyUp={checkCaps}
                  onBlur={() => setCapsOn(false)}
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'password-err' : undefined}
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
              {capsOn && <div className="lg-hint" role="status">Caps Lock is on</div>}
              {errors.password && <div className="lg-error" id="password-err">{errors.password}</div>}
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