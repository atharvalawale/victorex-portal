import { useState } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import Topbar from '../../components/Topbar/Topbar';
import './Settings.css';

const DUMMY_USER = 'sanjay_admin';
const DUMMY_PASS = 'victorex@2025';

export default function Settings() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast]             = useState('');
  const [toastType, setToastType]     = useState('success');

  /* ── Business info ── */
  const [bizForm, setBizForm] = useState({
    name:    'Gayatri Metal Finishers',
    address: 'Satara, Maharashtra',
    phone:   '+91 XXXXXXXXXX',
    email:   'info@victorex.in',
    gst:     '27XXXXX1234X1ZX',
    brand:   'Victorex',
  });
  const [bizSaving, setBizSaving] = useState(false);

  /* ── Password change ── */
  const [passForm, setPassForm] = useState({
    current: '', newPass: '', confirm: '',
  });
  const [passErrors, setPassErrors]   = useState({});
  const [passSaving, setPassSaving]   = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  function showToast(msg, type = 'success') {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(''), 3000);
  }

  /* ── Save business info ── */
  async function handleSaveBiz(e) {
    e.preventDefault();
    setBizSaving(true);
    await new Promise(r => setTimeout(r, 600));
    localStorage.setItem('vx_biz', JSON.stringify(bizForm));
    showToast('Business info saved ✓');
    setBizSaving(false);
  }

  /* ── Change password ── */
  function validatePass() {
    const e = {};
    if (!passForm.current)              e.current = 'Current password required';
    else if (passForm.current !== DUMMY_PASS) e.current = 'Incorrect current password';
    if (!passForm.newPass)              e.newPass = 'New password required';
    else if (passForm.newPass.length < 8) e.newPass = 'Minimum 8 characters';
    if (!passForm.confirm)              e.confirm = 'Please confirm new password';
    else if (passForm.newPass !== passForm.confirm) e.confirm = 'Passwords do not match';
    return e;
  }

  async function handleChangePass(e) {
    e.preventDefault();
    const errs = validatePass();
    if (Object.keys(errs).length) { setPassErrors(errs); return; }
    setPassErrors({});
    setPassSaving(true);
    await new Promise(r => setTimeout(r, 800));
    showToast('Password changed ✓');
    setPassForm({ current: '', newPass: '', confirm: '' });
    setPassSaving(false);
  }

  return (
    <div className="settings-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="settings-main">
        <Topbar title="Settings" onMenuClick={() => setSidebarOpen(true)} />

        <div className="settings-content">

          <div className="settings-header">
            <h2 className="settings-title">Settings</h2>
            <p className="settings-sub">Manage your business info and account security</p>
          </div>

          <div className="settings-layout">

            {/* Left column */}
            <div className="settings-col">

              {/* Business Info */}
              <div className="settings-card">
                <div className="settings-card-hdr">
                  <div className="settings-card-icon" style={{ background:'rgba(201,146,42,0.1)', color:'#C9922A' }}>
                    <i className="ti ti-building" />
                  </div>
                  <div>
                    <div className="settings-card-title">Business Information</div>
                    <div className="settings-card-sub">Used in invoices and reports</div>
                  </div>
                </div>

                <form onSubmit={handleSaveBiz}>
                  <div className="settings-row">
                    <div className="settings-field">
                      <label>Business Name</label>
                      <input
                        value={bizForm.name}
                        onChange={e => setBizForm({ ...bizForm, name: e.target.value })}
                        placeholder="e.g. Gayatri Metal Finishers"
                      />
                    </div>
                    <div className="settings-field">
                      <label>Brand Name</label>
                      <input
                        value={bizForm.brand}
                        onChange={e => setBizForm({ ...bizForm, brand: e.target.value })}
                        placeholder="e.g. Victorex"
                      />
                    </div>
                  </div>

                  <div className="settings-field">
                    <label>Address</label>
                    <input
                      value={bizForm.address}
                      onChange={e => setBizForm({ ...bizForm, address: e.target.value })}
                      placeholder="e.g. Satara, Maharashtra"
                    />
                  </div>

                  <div className="settings-row">
                    <div className="settings-field">
                      <label>Phone</label>
                      <input
                        value={bizForm.phone}
                        onChange={e => setBizForm({ ...bizForm, phone: e.target.value })}
                        placeholder="+91 XXXXXXXXXX"
                      />
                    </div>
                    <div className="settings-field">
                      <label>Email</label>
                      <input
                        type="email"
                        value={bizForm.email}
                        onChange={e => setBizForm({ ...bizForm, email: e.target.value })}
                        placeholder="info@victorex.in"
                      />
                    </div>
                  </div>

                  <div className="settings-field">
                    <label>GST Number</label>
                    <input
                      value={bizForm.gst}
                      onChange={e => setBizForm({ ...bizForm, gst: e.target.value })}
                      placeholder="27XXXXX1234X1ZX"
                    />
                  </div>

                  <div className="settings-footer">
                    <button type="submit" className="settings-save-btn" disabled={bizSaving}>
                      {bizSaving ? <span className="btn-spinner" /> : <i className="ti ti-check" />}
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>

              {/* Portal info */}
              <div className="settings-card">
                <div className="settings-card-hdr">
                  <div className="settings-card-icon" style={{ background:'rgba(11,31,58,0.08)', color:'#0B1F3A' }}>
                    <i className="ti ti-info-circle" />
                  </div>
                  <div>
                    <div className="settings-card-title">Portal Information</div>
                    <div className="settings-card-sub">Current version and details</div>
                  </div>
                </div>

                <div className="settings-info-rows">
                  <div className="settings-info-row">
                    <span className="settings-info-label">Portal Name</span>
                    <span className="settings-info-val">Victorex Management Portal</span>
                  </div>
                  <div className="settings-info-row">
                    <span className="settings-info-label">Version</span>
                    <span className="settings-info-val">v1.0.0 — Wave 1</span>
                  </div>
                  <div className="settings-info-row">
                    <span className="settings-info-label">Database</span>
                    <span className="settings-info-val">Supabase (PostgreSQL)</span>
                  </div>
                  <div className="settings-info-row">
                    <span className="settings-info-label">Hosting</span>
                    <span className="settings-info-val">manage.victorex.in (coming soon)</span>
                  </div>
                  <div className="settings-info-row">
                    <span className="settings-info-label">Built by</span>
                    <span className="settings-info-val">Claude + Anthropic 🤝</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Right column */}
            <div className="settings-col">

              {/* Change Password */}
              <div className="settings-card">
                <div className="settings-card-hdr">
                  <div className="settings-card-icon" style={{ background:'rgba(45,157,110,0.1)', color:'#2D9D6E' }}>
                    <i className="ti ti-lock" />
                  </div>
                  <div>
                    <div className="settings-card-title">Change Password</div>
                    <div className="settings-card-sub">Keep your account secure</div>
                  </div>
                </div>

                <form onSubmit={handleChangePass}>
                  <div className="settings-field">
                    <label>Current Password</label>
                    <div className="settings-input-wrap">
                      <input
                        type={showCurrent ? 'text' : 'password'}
                        placeholder="Enter current password"
                        value={passForm.current}
                        onChange={e => setPassForm({ ...passForm, current: e.target.value })}
                        className={passErrors.current ? 'error' : ''}
                      />
                      <button type="button" className="settings-eye" onClick={() => setShowCurrent(p => !p)}>
                        <i className={`ti ${showCurrent ? 'ti-eye-off' : 'ti-eye'}`} />
                      </button>
                    </div>
                    {passErrors.current && <span className="settings-error">{passErrors.current}</span>}
                  </div>

                  <div className="settings-field">
                    <label>New Password</label>
                    <div className="settings-input-wrap">
                      <input
                        type={showNew ? 'text' : 'password'}
                        placeholder="Minimum 8 characters"
                        value={passForm.newPass}
                        onChange={e => setPassForm({ ...passForm, newPass: e.target.value })}
                        className={passErrors.newPass ? 'error' : ''}
                      />
                      <button type="button" className="settings-eye" onClick={() => setShowNew(p => !p)}>
                        <i className={`ti ${showNew ? 'ti-eye-off' : 'ti-eye'}`} />
                      </button>
                    </div>
                    {passErrors.newPass && <span className="settings-error">{passErrors.newPass}</span>}
                  </div>

                  <div className="settings-field">
                    <label>Confirm New Password</label>
                    <div className="settings-input-wrap">
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="Re-enter new password"
                        value={passForm.confirm}
                        onChange={e => setPassForm({ ...passForm, confirm: e.target.value })}
                        className={passErrors.confirm ? 'error' : ''}
                      />
                      <button type="button" className="settings-eye" onClick={() => setShowConfirm(p => !p)}>
                        <i className={`ti ${showConfirm ? 'ti-eye-off' : 'ti-eye'}`} />
                      </button>
                    </div>
                    {passErrors.confirm && <span className="settings-error">{passErrors.confirm}</span>}
                  </div>

                  {/* Password strength */}
                  {passForm.newPass && (
                    <div className="settings-strength">
                      <div className="settings-strength-bars">
                        {[1,2,3,4].map(i => (
                          <div
                            key={i}
                            className="settings-strength-bar"
                            style={{
                              background: passForm.newPass.length >= i * 3
                                ? passForm.newPass.length >= 12 ? '#2D9D6E'
                                : passForm.newPass.length >= 8  ? '#C9922A' : '#D85A30'
                                : '#E2E5EE'
                            }}
                          />
                        ))}
                      </div>
                      <span className="settings-strength-label">
                        {passForm.newPass.length < 8 ? 'Too short'
                          : passForm.newPass.length < 12 ? 'Good'
                          : 'Strong'}
                      </span>
                    </div>
                  )}

                  <div className="settings-footer">
                    <button type="submit" className="settings-save-btn" disabled={passSaving}>
                      {passSaving ? <span className="btn-spinner" /> : <i className="ti ti-lock" />}
                      Update Password
                    </button>
                  </div>
                </form>
              </div>

              {/* Admin info */}
              <div className="settings-card">
                <div className="settings-card-hdr">
                  <div className="settings-card-icon" style={{ background:'rgba(201,146,42,0.1)', color:'#C9922A' }}>
                    <i className="ti ti-user-shield" />
                  </div>
                  <div>
                    <div className="settings-card-title">Admin Account</div>
                    <div className="settings-card-sub">Your login credentials</div>
                  </div>
                </div>

                <div className="settings-info-rows">
                  <div className="settings-info-row">
                    <span className="settings-info-label">Name</span>
                    <span className="settings-info-val">Sanjay Lawale</span>
                  </div>
                  <div className="settings-info-row">
                    <span className="settings-info-label">Username</span>
                    <span className="settings-info-val" style={{ fontFamily:'monospace' }}>sanjay_admin</span>
                  </div>
                  <div className="settings-info-row">
                    <span className="settings-info-label">Role</span>
                    <span className="settings-info-val">
                      <span className="settings-role-badge">Administrator</span>
                    </span>
                  </div>
                  <div className="settings-info-row">
                    <span className="settings-info-label">Access</span>
                    <span className="settings-info-val">Full access — all pages</span>
                  </div>
                </div>

                <div style={{ marginTop: 14, padding: '12px 14px', background:'rgba(201,146,42,0.06)', borderRadius: 10, fontSize: 12, color:'#8a5a00' }}>
                  <i className="ti ti-info-circle" style={{ marginRight: 6 }} />
                  Multi-user support (sales rep, accountant) coming in Wave 3.
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`settings-toast ${toastType}`}>
          <i className={`ti ${toastType === 'success' ? 'ti-circle-check' : 'ti-alert-circle'}`} />
          {toast}
        </div>
      )}
    </div>
  );
}