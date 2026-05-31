import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import Topbar from '../../components/Topbar/Topbar';
import { supabase } from '../../lib/supabase';
import './Cheques.css';

const STATUS_OPTIONS = ['pending', 'cleared', 'bounced'];

const STATUS_STYLE = {
  pending: { background: 'rgba(232,184,75,0.12)', color: '#8a5a00' },
  cleared: { background: 'rgba(45,157,110,0.12)', color: '#165c3a' },
  bounced: { background: 'rgba(216,90,48,0.12)',  color: '#7a2010' },
};

const EMPTY_FORM = {
  dealer_name: '', amount: '', cheque_number: '',
  bank: '', due_date: '', notes: '',
};

export default function Cheques() {
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [cheques, setCheques]           = useState([]);
  const [dealers, setDealers]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [showModal, setShowModal]       = useState(false);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [errors, setErrors]             = useState({});
  const [editId, setEditId]             = useState(null);
  const [showDeleteId, setShowDeleteId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch]             = useState('');
  const [toast, setToast]               = useState('');

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [c, d] = await Promise.all([
      supabase.from('cheques').select('*').order('due_date'),
      supabase.from('dealers').select('name, location').eq('status', 'active').order('name'),
    ]);
    setCheques(c.data || []);
    setDealers(d.data || []);
    setLoading(false);
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  const today = new Date().toISOString().split('T')[0];

  const filtered = cheques.filter(c => {
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    const matchSearch =
      c.dealer_name.toLowerCase().includes(search.toLowerCase()) ||
      c.cheque_number.toLowerCase().includes(search.toLowerCase()) ||
      c.bank.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  /* ── Summary ── */
  const pendingAmt  = cheques.filter(c => c.status === 'pending').reduce((s,c) => s + Number(c.amount), 0);
  const clearedAmt  = cheques.filter(c => c.status === 'cleared').reduce((s,c) => s + Number(c.amount), 0);
  const bouncedAmt  = cheques.filter(c => c.status === 'bounced').reduce((s,c) => s + Number(c.amount), 0);
  const dueSoon     = cheques.filter(c => c.status === 'pending' && c.due_date <= new Date(Date.now() + 7*86400000).toISOString().split('T')[0]).length;

  function validate() {
    const e = {};
    if (!form.dealer_name)   e.dealer_name   = 'Dealer required';
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0) e.amount = 'Valid amount required';
    if (!form.cheque_number.trim()) e.cheque_number = 'Cheque number required';
    if (!form.bank.trim())   e.bank     = 'Bank name required';
    if (!form.due_date)      e.due_date = 'Due date required';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSaving(true);

    const payload = {
      dealer_name:    form.dealer_name,
      amount:         Number(form.amount),
      cheque_number:  form.cheque_number,
      bank:           form.bank,
      due_date:       form.due_date,
      notes:          form.notes,
    };

    if (editId) {
      const { error } = await supabase.from('cheques').update(payload).eq('id', editId);
      if (!error) { showToast('Cheque updated ✓'); fetchAll(); }
    } else {
      const { error } = await supabase.from('cheques').insert({ ...payload, status: 'pending' });
      if (!error) { showToast('Cheque added ✓'); fetchAll(); }
    }

    setSaving(false);
    setShowModal(false);
    setForm(EMPTY_FORM);
    setEditId(null);
  }

  function handleEdit(c) {
    setForm({
      dealer_name:   c.dealer_name,
      amount:        String(c.amount),
      cheque_number: c.cheque_number,
      bank:          c.bank,
      due_date:      c.due_date,
      notes:         c.notes || '',
    });
    setEditId(c.id);
    setShowModal(true);
  }

  async function handleDelete(id) {
    await supabase.from('cheques').delete().eq('id', id);
    showToast('Cheque deleted');
    fetchAll();
    setShowDeleteId(null);
  }

  async function handleStatusChange(id, status) {
    await supabase.from('cheques').update({ status }).eq('id', id);
    setCheques(prev => prev.map(c => c.id === id ? { ...c, status } : c));
    showToast(`Marked as ${status} ✓`);
  }

  const fmtAmt  = n => `₹${Number(n||0).toLocaleString('en-IN')}`;
  const fmtDate = d => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });

  function getDaysLabel(due) {
    const diff = Math.ceil((new Date(due) - new Date(today)) / 86400000);
    if (diff < 0)  return { label: `${Math.abs(diff)}d overdue`, color: '#D85A30' };
    if (diff === 0) return { label: 'Due today', color: '#D85A30' };
    if (diff <= 7)  return { label: `Due in ${diff}d`, color: '#E8B84B' };
    return { label: `Due in ${diff}d`, color: '#2D9D6E' };
  }

  return (
    <div className="cheques-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="cheques-main">
        <Topbar title="Cheque Tracker" onMenuClick={() => setSidebarOpen(true)} />

        <div className="cheques-content">

          {/* Header */}
          <div className="cheques-header">
            <div>
              <h2 className="cheques-title">Cheque Tracker</h2>
              <p className="cheques-sub">
                {loading ? 'Loading...' : `${cheques.length} cheques · ${dueSoon > 0 ? `${dueSoon} due within 7 days` : 'all clear'}`}
              </p>
            </div>
            <button className="cheques-add-btn" onClick={() => { setForm(EMPTY_FORM); setEditId(null); setErrors({}); setShowModal(true); }}>
              <i className="ti ti-plus" /> Add Cheque
            </button>
          </div>

          {/* Summary cards */}
          <div className="cheques-summary">
            <div className="cheques-sum-card yellow">
              <div className="cheques-sum-icon"><i className="ti ti-clock" /></div>
              <div>
                <div className="cheques-sum-val">{fmtAmt(pendingAmt)}</div>
                <div className="cheques-sum-lbl">Pending ({cheques.filter(c=>c.status==='pending').length})</div>
              </div>
            </div>
            <div className="cheques-sum-card green">
              <div className="cheques-sum-icon"><i className="ti ti-circle-check" /></div>
              <div>
                <div className="cheques-sum-val">{fmtAmt(clearedAmt)}</div>
                <div className="cheques-sum-lbl">Cleared ({cheques.filter(c=>c.status==='cleared').length})</div>
              </div>
            </div>
            <div className="cheques-sum-card red">
              <div className="cheques-sum-icon"><i className="ti ti-alert-circle" /></div>
              <div>
                <div className="cheques-sum-val">{fmtAmt(bouncedAmt)}</div>
                <div className="cheques-sum-lbl">Bounced ({cheques.filter(c=>c.status==='bounced').length})</div>
              </div>
            </div>
            <div className="cheques-sum-card navy">
              <div className="cheques-sum-icon"><i className="ti ti-calendar-due" /></div>
              <div>
                <div className="cheques-sum-val">{dueSoon}</div>
                <div className="cheques-sum-lbl">Due within 7 days</div>
              </div>
            </div>
          </div>

          {/* Due soon alert */}
          {dueSoon > 0 && (
            <div className="cheques-alert">
              <i className="ti ti-bell" />
              <span><strong>{dueSoon} cheque{dueSoon > 1 ? 's' : ''}</strong> due within 7 days — follow up with dealers.</span>
            </div>
          )}

          {/* Filters */}
          <div className="cheques-filters">
            <div className="cheques-search-wrap">
              <i className="ti ti-search" />
              <input
                className="cheques-search"
                placeholder="Search dealer, cheque no, bank..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="cheques-filter-btns">
              {['all', ...STATUS_OPTIONS].map(s => (
                <button
                  key={s}
                  className={`cheques-filter-btn${filterStatus === s ? ' active' : ''}`}
                  onClick={() => setFilterStatus(s)}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="cheques-table-wrap">
            {loading ? (
              <div className="cheques-loading"><div className="cheques-spinner" /> Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="cheques-empty">
                <i className="ti ti-writing" />
                <span>No cheques yet — click Add Cheque to get started</span>
              </div>
            ) : (
              <table className="cheques-table">
                <thead>
                  <tr>
                    <th>Dealer</th>
                    <th>Cheque No</th>
                    <th>Bank</th>
                    <th>Amount</th>
                    <th>Due Date</th>
                    <th>Days</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => {
                    const { label, color } = getDaysLabel(c.due_date);
                    return (
                      <tr key={c.id}>
                        <td>
                          <div className="cheques-dealer">{c.dealer_name}</div>
                          {c.notes && <div className="cheques-notes">{c.notes}</div>}
                        </td>
                        <td><span className="cheques-num">{c.cheque_number}</span></td>
                        <td>{c.bank}</td>
                        <td><strong>{fmtAmt(c.amount)}</strong></td>
                        <td className="cheques-date">{fmtDate(c.due_date)}</td>
                        <td>
                          {c.status === 'pending' && (
                            <span className="cheques-days-badge" style={{ color, background: `${color}18` }}>
                              {label}
                            </span>
                          )}
                        </td>
                        <td>
                          <select
                            className="cheques-status-select"
                            value={c.status}
                            onChange={e => handleStatusChange(c.id, e.target.value)}
                            style={STATUS_STYLE[c.status]}
                          >
                            {STATUS_OPTIONS.map(s => (
                              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <div className="cheques-actions">
                            <button className="cheques-action-btn edit" onClick={() => handleEdit(c)}>
                              <i className="ti ti-pencil" />
                            </button>
                            <button className="cheques-action-btn delete" onClick={() => setShowDeleteId(c.id)}>
                              <i className="ti ti-trash" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editId ? 'Edit Cheque' : 'Add Cheque'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <i className="ti ti-x" />
              </button>
            </div>
            <form className="modal-form" onSubmit={handleSubmit}>
              <div className="modal-row">
                <div className="modal-field">
                  <label>Dealer *</label>
                  <select
                    value={form.dealer_name}
                    onChange={e => setForm({ ...form, dealer_name: e.target.value })}
                    className={errors.dealer_name ? 'error' : ''}
                  >
                    <option value="">Select dealer...</option>
                    {dealers.map(d => (
                      <option key={d.name} value={d.name}>{d.name} — {d.location}</option>
                    ))}
                  </select>
                  {errors.dealer_name && <span className="modal-error">{errors.dealer_name}</span>}
                </div>
                <div className="modal-field">
                  <label>Amount (₹) *</label>
                  <input
                    type="number" min="1"
                    placeholder="e.g. 50000"
                    value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                    className={errors.amount ? 'error' : ''}
                  />
                  {errors.amount && <span className="modal-error">{errors.amount}</span>}
                </div>
              </div>
              <div className="modal-row">
                <div className="modal-field">
                  <label>Cheque Number *</label>
                  <input
                    placeholder="e.g. 001234"
                    value={form.cheque_number}
                    onChange={e => setForm({ ...form, cheque_number: e.target.value })}
                    className={errors.cheque_number ? 'error' : ''}
                  />
                  {errors.cheque_number && <span className="modal-error">{errors.cheque_number}</span>}
                </div>
                <div className="modal-field">
                  <label>Bank *</label>
                  <input
                    placeholder="e.g. SBI, HDFC"
                    value={form.bank}
                    onChange={e => setForm({ ...form, bank: e.target.value })}
                    className={errors.bank ? 'error' : ''}
                  />
                  {errors.bank && <span className="modal-error">{errors.bank}</span>}
                </div>
              </div>
              <div className="modal-row">
                <div className="modal-field">
                  <label>Due Date *</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={e => setForm({ ...form, due_date: e.target.value })}
                    className={errors.due_date ? 'error' : ''}
                  />
                  {errors.due_date && <span className="modal-error">{errors.due_date}</span>}
                </div>
                <div className="modal-field">
                  <label>Notes (optional)</label>
                  <input
                    placeholder="Any notes..."
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="modal-submit" disabled={saving}>
                  {saving ? <span className="btn-spinner" /> : <i className="ti ti-check" />}
                  {editId ? 'Save Changes' : 'Add Cheque'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {showDeleteId && (
        <div className="modal-overlay" onClick={() => setShowDeleteId(null)}>
          <div className="modal-card modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Delete Cheque?</h3>
              <button className="modal-close" onClick={() => setShowDeleteId(null)}>
                <i className="ti ti-x" />
              </button>
            </div>
            <p className="modal-confirm-text">This cannot be undone.</p>
            <div className="modal-footer">
              <button className="modal-cancel" onClick={() => setShowDeleteId(null)}>Cancel</button>
              <button className="modal-delete" onClick={() => handleDelete(showDeleteId)}>
                <i className="ti ti-trash" /> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="cheques-toast">
          <i className="ti ti-circle-check" />{toast}
        </div>
      )}
    </div>
  );
}