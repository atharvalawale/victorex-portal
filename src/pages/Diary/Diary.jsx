import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import Topbar from '../../components/Topbar/Topbar';
import { supabase } from '../../lib/supabase';
import './Diary.css';

const EMPTY_FORM = {
  dealer_name: '', location: '', amount: '',
  date: new Date().toISOString().split('T')[0],
  notes: '', payment_status: 'unpaid', paid_amount: '',
};

export default function Diary() {
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [entries, setEntries]           = useState([]);
  const [dealers, setDealers]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [showModal, setShowModal]       = useState(false);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [errors, setErrors]             = useState({});
  const [editId, setEditId]             = useState(null);
  const [showDeleteId, setShowDeleteId] = useState(null);
  const [search, setSearch]             = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [toast, setToast]               = useState('');

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);

    const { data: entriesData, error: entriesError } = await supabase
      .from('diary_entries')
      .select('*')
      .order('date', { ascending: false });

    if (entriesError) console.error('diary_entries fetch error:', JSON.stringify(entriesError));

    const { data: dealersData, error: dealersError } = await supabase
      .from('dealers')
      .select('name, location')
      .eq('status', 'active')
      .order('name');

    if (dealersError) console.warn('dealers fetch error (table may not exist):', JSON.stringify(dealersError));

    setEntries(entriesData || []);
    setDealers(dealersData || []);
    setLoading(false);
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  const filtered = entries.filter(e => {
    const matchStatus = filterStatus === 'all' || e.payment_status === filterStatus;
    const matchSearch =
      e.dealer_name.toLowerCase().includes(search.toLowerCase()) ||
      (e.notes || '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const totalAmt      = filtered.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalPaid     = filtered.filter(e => e.payment_status === 'paid').reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalUnpaid   = filtered.filter(e => e.payment_status === 'unpaid').reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalPartial  = filtered.filter(e => e.payment_status === 'partial').reduce((s, e) => s + Number(e.amount || 0) - Number(e.paid_amount || 0), 0);
  const outstanding   = totalUnpaid + totalPartial;

  function validate() {
    const e = {};
    if (!form.dealer_name.trim()) e.dealer_name = 'Dealer name required';
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0) e.amount = 'Valid amount required';
    if (!form.date) e.date = 'Date required';
    if (form.payment_status === 'partial') {
      if (!form.paid_amount || Number(form.paid_amount) <= 0) e.paid_amount = 'Enter amount paid';
      if (Number(form.paid_amount) >= Number(form.amount)) e.paid_amount = 'Must be less than total amount';
    }
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSaving(true);

    const payload = {
      dealer_name:    form.dealer_name.trim(),
      location:       form.location.trim() || null,
      amount:         Number(form.amount),
      date:           form.date,
      notes:          form.notes.trim() || null,
      payment_status: form.payment_status,
      paid_amount:    form.payment_status === 'paid'    ? Number(form.amount)
                    : form.payment_status === 'partial' ? Number(form.paid_amount)
                    : 0,
    };

    // ── DEBUG: remove these three lines once working ──
    console.log('📦 payload:', JSON.stringify(payload, null, 2));
    // ─────────────────────────────────────────────────

    if (editId) {
      const { data, error } = await supabase.from('diary_entries').update(payload).eq('id', editId);
      console.log('✏️ update error:', JSON.stringify(error));
      console.log('✏️ update data:', data);
      if (!error) { showToast('Entry updated ✓'); fetchAll(); }
      else showToast('Error updating entry');
    } else {
      const { data, error } = await supabase.from('diary_entries').insert(payload);
      console.log('➕ insert error:', JSON.stringify(error));
      console.log('➕ insert data:', data);
      if (!error) { showToast('Entry added ✓'); fetchAll(); }
      else showToast('Error adding entry');
    }

    setSaving(false);
    setShowModal(false);
    setForm(EMPTY_FORM);
    setEditId(null);
  }

  function handleEdit(entry) {
    setForm({
      dealer_name:    entry.dealer_name,
      location:       entry.location || '',
      amount:         String(entry.amount),
      date:           entry.date,
      notes:          entry.notes || '',
      payment_status: entry.payment_status,
      paid_amount:    String(entry.paid_amount || ''),
    });
    setEditId(entry.id);
    setShowModal(true);
  }

  async function handleDelete(id) {
    await supabase.from('diary_entries').delete().eq('id', id);
    showToast('Entry deleted');
    fetchAll();
    setShowDeleteId(null);
  }

  async function handleMarkPaid(entry) {
    await supabase.from('diary_entries').update({
      payment_status: 'paid',
      paid_amount: entry.amount,
    }).eq('id', entry.id);
    showToast('Marked as paid ✓');
    fetchAll();
  }

  const fmtAmt  = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;
  const fmtDate = d => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const STATUS_STYLE = {
    paid:    { background: 'rgba(45,157,110,0.12)',  color: '#165c3a' },
    unpaid:  { background: 'rgba(216,90,48,0.12)',   color: '#7a2010' },
    partial: { background: 'rgba(232,184,75,0.12)',  color: '#8a5a00' },
  };

  return (
    <div className="diary-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="diary-main">
        <Topbar title="Diary Entry" onMenuClick={() => setSidebarOpen(true)} />

        <div className="diary-content">

          {/* Header */}
          <div className="diary-header">
            <div>
              <h2 className="diary-title">Diary Entry</h2>
              <p className="diary-sub">Simple entries from your Dad's diary — dealer, date, amount</p>
            </div>
            <button
              className="diary-add-btn"
              onClick={() => { setForm(EMPTY_FORM); setEditId(null); setErrors({}); setShowModal(true); }}
            >
              <i className="ti ti-plus" /> Add Entry
            </button>
          </div>

          {/* Info banner */}
          <div className="diary-info-banner">
            <i className="ti ti-info-circle" />
            <span>This page is for migrating old diary data. Once all entries are added, you can delete this page and use the Orders page going forward.</span>
          </div>

          {/* Summary cards */}
          <div className="diary-summary">
            <div className="diary-sum-card gold">
              <div className="diary-sum-icon"><i className="ti ti-currency-rupee" /></div>
              <div>
                <div className="diary-sum-val">{fmtAmt(totalAmt)}</div>
                <div className="diary-sum-lbl">Total ({filtered.length} entries)</div>
              </div>
            </div>
            <div className="diary-sum-card green">
              <div className="diary-sum-icon"><i className="ti ti-circle-check" /></div>
              <div>
                <div className="diary-sum-val">{fmtAmt(totalPaid)}</div>
                <div className="diary-sum-lbl">Paid ({filtered.filter(e => e.payment_status === 'paid').length})</div>
              </div>
            </div>
            <div className="diary-sum-card red">
              <div className="diary-sum-icon"><i className="ti ti-alert-circle" /></div>
              <div>
                <div className="diary-sum-val">{fmtAmt(outstanding)}</div>
                <div className="diary-sum-lbl">Outstanding ({filtered.filter(e => e.payment_status !== 'paid').length})</div>
              </div>
            </div>
            <div className="diary-sum-card yellow">
              <div className="diary-sum-icon"><i className="ti ti-clock" /></div>
              <div>
                <div className="diary-sum-val">{filtered.filter(e => e.payment_status === 'partial').length}</div>
                <div className="diary-sum-lbl">Partial payments</div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="diary-filters">
            <div className="diary-search-wrap">
              <i className="ti ti-search" />
              <input
                className="diary-search"
                placeholder="Search dealer, notes..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="diary-filter-btns">
              {['all', 'unpaid', 'partial', 'paid'].map(s => (
                <button
                  key={s}
                  className={`diary-filter-btn${filterStatus === s ? ' active' : ''}`}
                  onClick={() => setFilterStatus(s)}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="diary-table-wrap">
            {loading ? (
              <div className="diary-loading"><div className="diary-spinner" /> Loading entries...</div>
            ) : filtered.length === 0 ? (
              <div className="diary-empty">
                <i className="ti ti-notebook" />
                <span>No entries yet — click Add Entry to start entering diary data</span>
              </div>
            ) : (
              <table className="diary-table">
                <thead>
                  <tr>
                    <th>Dealer</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Paid</th>
                    <th>Outstanding</th>
                    <th>Payment</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(entry => {
                    const entryOutstanding = Number(entry.amount) - Number(entry.paid_amount || 0);
                    return (
                      <tr key={entry.id}>
                        <td>
                          <div className="diary-dealer">{entry.dealer_name}</div>
                          {entry.location && <div className="diary-loc">{entry.location}</div>}
                        </td>
                        <td className="diary-date">{fmtDate(entry.date)}</td>
                        <td><strong>{fmtAmt(entry.amount)}</strong></td>
                        <td style={{ color: '#2D9D6E', fontWeight: 600 }}>
                          {entry.paid_amount > 0 ? fmtAmt(entry.paid_amount) : '—'}
                        </td>
                        <td style={{ color: entryOutstanding > 0 ? '#D85A30' : '#2D9D6E', fontWeight: 600 }}>
                          {entryOutstanding > 0 ? fmtAmt(entryOutstanding) : '✓ Clear'}
                        </td>
                        <td>
                          <span className="diary-status" style={STATUS_STYLE[entry.payment_status]}>
                            {entry.payment_status.charAt(0).toUpperCase() + entry.payment_status.slice(1)}
                          </span>
                        </td>
                        <td className="diary-notes">{entry.notes || '—'}</td>
                        <td>
                          <div className="diary-actions">
                            {entry.payment_status !== 'paid' && (
                              <button
                                className="diary-action-btn paid"
                                onClick={() => handleMarkPaid(entry)}
                                title="Mark as paid"
                              >
                                <i className="ti ti-circle-check" />
                              </button>
                            )}
                            <button className="diary-action-btn edit" onClick={() => handleEdit(entry)} title="Edit">
                              <i className="ti ti-pencil" />
                            </button>
                            <button className="diary-action-btn delete" onClick={() => setShowDeleteId(entry.id)} title="Delete">
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
              <h3 className="modal-title">{editId ? 'Edit Entry' : 'Add Diary Entry'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <i className="ti ti-x" />
              </button>
            </div>

            <form className="modal-form" onSubmit={handleSubmit}>

              {/* Dealer */}
              <div className="modal-field">
                <label>Dealer Name *</label>
                <input
                  list="diary-dealers"
                  placeholder="Type or select dealer..."
                  value={form.dealer_name}
                  onChange={e => {
                    const dealer = dealers.find(d => d.name === e.target.value);
                    setForm({ ...form, dealer_name: e.target.value, location: dealer?.location || form.location });
                  }}
                  className={errors.dealer_name ? 'error' : ''}
                />
                <datalist id="diary-dealers">
                  {dealers.map(d => <option key={d.name} value={d.name} />)}
                </datalist>
                {errors.dealer_name && <span className="modal-error">{errors.dealer_name}</span>}
              </div>

              <div className="modal-row">
                <div className="modal-field">
                  <label>Location</label>
                  <input
                    placeholder="e.g. Satara"
                    value={form.location}
                    onChange={e => setForm({ ...form, location: e.target.value })}
                  />
                </div>
                <div className="modal-field">
                  <label>Date *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                    className={errors.date ? 'error' : ''}
                  />
                  {errors.date && <span className="modal-error">{errors.date}</span>}
                </div>
              </div>

              <div className="modal-field">
                <label>Amount (₹) *</label>
                <input
                  type="number" min="1"
                  placeholder="e.g. 18400"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  className={errors.amount ? 'error' : ''}
                />
                {errors.amount && <span className="modal-error">{errors.amount}</span>}
              </div>

              {/* Payment status */}
              <div className="modal-field">
                <label>Payment Status</label>
                <div className="diary-status-btns">
                  {['unpaid', 'partial', 'paid'].map(s => (
                    <button
                      key={s}
                      type="button"
                      className={`diary-status-btn${form.payment_status === s ? ' active-' + s : ''}`}
                      onClick={() => setForm({ ...form, payment_status: s, paid_amount: s === 'paid' ? form.amount : '' })}
                    >
                      {s === 'unpaid'  && <i className="ti ti-x" />}
                      {s === 'partial' && <i className="ti ti-clock" />}
                      {s === 'paid'    && <i className="ti ti-check" />}
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Partial amount */}
              {form.payment_status === 'partial' && (
                <div className="modal-field">
                  <label>Amount Already Paid (₹) *</label>
                  <input
                    type="number" min="1"
                    placeholder="e.g. 10000"
                    value={form.paid_amount}
                    onChange={e => setForm({ ...form, paid_amount: e.target.value })}
                    className={errors.paid_amount ? 'error' : ''}
                  />
                  {errors.paid_amount && <span className="modal-error">{errors.paid_amount}</span>}
                  {form.paid_amount && form.amount && Number(form.paid_amount) < Number(form.amount) && (
                    <div className="diary-partial-preview">
                      Remaining: <strong>{fmtAmt(Number(form.amount) - Number(form.paid_amount))}</strong>
                    </div>
                  )}
                </div>
              )}

              <div className="modal-field">
                <label>Notes (optional)</label>
                <input
                  placeholder="e.g. WallVex Pro, exterior paint, bulk order..."
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="modal-submit" disabled={saving}>
                  {saving ? <span className="btn-spinner" /> : <i className="ti ti-check" />}
                  {editId ? 'Save Changes' : 'Add Entry'}
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
              <h3 className="modal-title">Delete Entry?</h3>
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
        <div className="diary-toast">
          <i className="ti ti-circle-check" />{toast}
        </div>
      )}
    </div>
  );
}