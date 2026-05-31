import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import Topbar from '../../components/Topbar/Topbar';
import { supabase } from '../../lib/supabase';
import './Khata.css';

const PAYMENT_MODES = ['cash', 'upi', 'cheque', 'neft', 'rtgs'];

const EMPTY_FORM = {
  dealer_name: '', amount: '', mode: 'cash', reference: '', notes: '', date: new Date().toISOString().split('T')[0],
};

export default function Khata() {
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [dealers, setDealers]           = useState([]);
  const [payments, setPayments]         = useState([]);
  const [orders, setOrders]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [showModal, setShowModal]       = useState(false);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [errors, setErrors]             = useState({});
  const [selectedDealer, setSelectedDealer] = useState(null);
  const [toast, setToast]               = useState('');
  const [showDeleteId, setShowDeleteId] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [d, p, o] = await Promise.all([
      supabase.from('dealers').select('*').order('name'),
      supabase.from('payments').select('*').order('created_at', { ascending: false }),
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
    ]);
    setDealers(d.data || []);
    setPayments(p.data || []);
    setOrders(o.data || []);
    setLoading(false);
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  /* ── Per dealer summary ── */
  function getDealerSummary(dealerName) {
    const dealerOrders   = orders.filter((o) => o.dealer_name === dealerName);
    const dealerPayments = payments.filter((p) => p.dealer_name === dealerName);
    const totalOrdered   = dealerOrders.reduce((s, o) => s + Number(o.amount), 0);
    const totalPaid      = dealerPayments.reduce((s, p) => s + Number(p.amount), 0);
    const outstanding    = totalOrdered - totalPaid;
    return { totalOrdered, totalPaid, outstanding, dealerOrders, dealerPayments };
  }

  /* ── Overall summary ── */
  const totalOutstanding = dealers.reduce((s, d) => {
    const { outstanding } = getDealerSummary(d.name);
    return s + outstanding;
  }, 0);

  const totalReceived = payments.reduce((s, p) => s + Number(p.amount), 0);

  /* ── Aging buckets ── */
  function getAgingBucket(days) {
    if (days <= 30)  return { label: '0-30 days', color: '#2D9D6E' };
    if (days <= 60)  return { label: '31-60 days', color: '#E8B84B' };
    if (days <= 90)  return { label: '61-90 days', color: '#D85A30' };
    return { label: '90+ days', color: '#7a2010' };
  }

  /* ── Validation ── */
  function validate() {
    const e = {};
    if (!form.dealer_name) e.dealer_name = 'Select a dealer';
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0) e.amount = 'Valid amount required';
    if (!form.date) e.date = 'Date required';
    return e;
  }

  /* ── Submit payment ── */
  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSaving(true);

    const { error } = await supabase.from('payments').insert({
      dealer_name: form.dealer_name,
      amount:      Number(form.amount),
      mode:        form.mode,
      reference:   form.reference,
      notes:       form.notes,
      date:        form.date,
    });

    if (!error) { showToast('Payment recorded ✓'); fetchAll(); }
    else showToast('Error recording payment');

    setSaving(false);
    setShowModal(false);
    setForm(EMPTY_FORM);
  }

  /* ── Delete payment ── */
  async function handleDelete(id) {
    const { error } = await supabase.from('payments').delete().eq('id', id);
    if (!error) { showToast('Payment deleted'); fetchAll(); }
    setShowDeleteId(null);
  }

  const fmtAmt  = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const getInitials = (name) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const activeDealers = dealers.filter((d) => d.status === 'active');

  return (
    <div className="khata-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="khata-main">
        <Topbar title="Khata / Ledger" onMenuClick={() => setSidebarOpen(true)} />

        <div className="khata-content">

          {/* Summary cards */}
          <div className="khata-summary">
            <div className="khata-sum-card red">
              <div className="khata-sum-icon">
                <i className="ti ti-alert-circle" />
              </div>
              <div>
                <div className="khata-sum-label">Total Outstanding</div>
                <div className="khata-sum-val">{fmtAmt(totalOutstanding)}</div>
                <div className="khata-sum-sub">{dealers.filter(d => getDealerSummary(d.name).outstanding > 0).length} dealers have dues</div>
              </div>
            </div>
            <div className="khata-sum-card green">
              <div className="khata-sum-icon">
                <i className="ti ti-circle-check" />
              </div>
              <div>
                <div className="khata-sum-label">Total Received</div>
                <div className="khata-sum-val">{fmtAmt(totalReceived)}</div>
                <div className="khata-sum-sub">{payments.length} payments recorded</div>
              </div>
            </div>
            <div className="khata-sum-card gold">
              <div className="khata-sum-icon">
                <i className="ti ti-users" />
              </div>
              <div>
                <div className="khata-sum-label">Active Dealers</div>
                <div className="khata-sum-val">{activeDealers.length}</div>
                <div className="khata-sum-sub">in your network</div>
              </div>
            </div>
          </div>

          <div className="khata-layout">

            {/* Dealer list */}
            <div className="khata-dealer-list">
              <div className="khata-list-hdr">
                <span className="khata-list-title">Dealers</span>
                <button
                  className="khata-add-btn"
                  onClick={() => { setForm(EMPTY_FORM); setErrors({}); setShowModal(true); }}
                >
                  <i className="ti ti-plus" /> Record Payment
                </button>
              </div>

              {loading ? (
                <div className="khata-loading"><div className="khata-spinner" /> Loading...</div>
              ) : activeDealers.length === 0 ? (
                <div className="khata-empty">
                  <i className="ti ti-users" />
                  <span>No dealers yet — add dealers first</span>
                </div>
              ) : (
                activeDealers.map((d) => {
                  const { totalOrdered, totalPaid, outstanding } = getDealerSummary(d.name);
                  const isSelected = selectedDealer?.id === d.id;
                  return (
                    <div
                      key={d.id}
                      className={`khata-dealer-row${isSelected ? ' selected' : ''}`}
                      onClick={() => setSelectedDealer(isSelected ? null : d)}
                    >
                      <div className="khata-dealer-avatar">{getInitials(d.name)}</div>
                      <div className="khata-dealer-info">
                        <div className="khata-dealer-name">{d.name}</div>
                        <div className="khata-dealer-loc">{d.location}</div>
                      </div>
                      <div className="khata-dealer-right">
                        <div className={`khata-due ${outstanding > 0 ? 'positive' : 'zero'}`}>
                          {fmtAmt(outstanding)}
                        </div>
                        <div className="khata-due-label">
                          {outstanding > 0 ? 'due' : 'clear'}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Dealer detail */}
            <div className="khata-detail">
              {!selectedDealer ? (
                <div className="khata-detail-empty">
                  <i className="ti ti-hand-click" />
                  <span>Select a dealer to view their khata</span>
                </div>
              ) : (() => {
                const { totalOrdered, totalPaid, outstanding, dealerOrders, dealerPayments } = getDealerSummary(selectedDealer.name);
                const paidPct = totalOrdered > 0 ? Math.round((totalPaid / totalOrdered) * 100) : 0;

                return (
                  <div>
                    {/* Dealer header */}
                    <div className="khata-detail-hdr">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="khata-detail-avatar">{getInitials(selectedDealer.name)}</div>
                        <div>
                          <div className="khata-detail-name">{selectedDealer.name}</div>
                          <div className="khata-detail-loc">{selectedDealer.location} · {selectedDealer.phone}</div>
                        </div>
                      </div>
                      <button
                        className="khata-add-btn"
                        onClick={() => {
                          setForm({ ...EMPTY_FORM, dealer_name: selectedDealer.name });
                          setErrors({});
                          setShowModal(true);
                        }}
                      >
                        <i className="ti ti-plus" /> Record Payment
                      </button>
                    </div>

                    {/* Stats */}
                    <div className="khata-stats">
                      <div className="khata-stat">
                        <div className="khata-stat-val">{fmtAmt(totalOrdered)}</div>
                        <div className="khata-stat-lbl">Total Ordered</div>
                      </div>
                      <div className="khata-stat">
                        <div className="khata-stat-val" style={{ color: '#2D9D6E' }}>{fmtAmt(totalPaid)}</div>
                        <div className="khata-stat-lbl">Total Paid</div>
                      </div>
                      <div className="khata-stat">
                        <div className="khata-stat-val" style={{ color: outstanding > 0 ? '#D85A30' : '#2D9D6E' }}>
                          {fmtAmt(outstanding)}
                        </div>
                        <div className="khata-stat-lbl">Outstanding</div>
                      </div>
                      <div className="khata-stat">
                        <div className="khata-stat-val">{paidPct}%</div>
                        <div className="khata-stat-lbl">Paid</div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="khata-progress-wrap">
                      <div className="khata-progress-bar">
                        <div
                          className="khata-progress-fill"
                          style={{ width: `${paidPct}%`, background: paidPct >= 80 ? '#2D9D6E' : paidPct >= 50 ? '#E8B84B' : '#D85A30' }}
                        />
                      </div>
                      <span className="khata-progress-label">{paidPct}% collected</span>
                    </div>

                    {/* Tabs — orders + payments */}
                    <div className="khata-tabs">

                      {/* Orders */}
                      <div className="khata-tab-section">
                        <div className="khata-tab-title">
                          <i className="ti ti-shopping-cart" /> Orders ({dealerOrders.length})
                        </div>
                        {dealerOrders.length === 0 ? (
                          <div className="khata-tab-empty">No orders yet</div>
                        ) : dealerOrders.map((o) => (
                          <div className="khata-entry-row" key={o.id}>
                            <div>
                              <div className="khata-entry-title">{o.product} · {o.qty} boxes</div>
                              <div className="khata-entry-sub">{fmtDate(o.date)} · {o.order_number}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div className="khata-entry-amt debit">{fmtAmt(o.amount)}</div>
                              <span className={`status-badge ${o.status}`}>
                                {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Payments */}
                      <div className="khata-tab-section">
                        <div className="khata-tab-title">
                          <i className="ti ti-circle-check" /> Payments ({dealerPayments.length})
                        </div>
                        {dealerPayments.length === 0 ? (
                          <div className="khata-tab-empty">No payments recorded yet</div>
                        ) : dealerPayments.map((p) => (
                          <div className="khata-entry-row" key={p.id}>
                            <div>
                              <div className="khata-entry-title">
                                {p.mode.toUpperCase()}
                                {p.reference && <span className="khata-ref"> · {p.reference}</span>}
                              </div>
                              <div className="khata-entry-sub">{fmtDate(p.date)}{p.notes && ` · ${p.notes}`}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div className="khata-entry-amt credit">{fmtAmt(p.amount)}</div>
                              <button
                                className="khata-delete-btn"
                                onClick={() => setShowDeleteId(p.id)}
                                title="Delete payment"
                              >
                                <i className="ti ti-trash" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                    </div>
                  </div>
                );
              })()}
            </div>

          </div>
        </div>
      </div>

      {/* Record Payment Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Record Payment</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <i className="ti ti-x" />
              </button>
            </div>

            <form className="modal-form" onSubmit={handleSubmit}>
              <div className="modal-field">
                <label>Dealer *</label>
                <select
                  value={form.dealer_name}
                  onChange={(e) => setForm({ ...form, dealer_name: e.target.value })}
                  className={errors.dealer_name ? 'error' : ''}
                >
                  <option value="">Select dealer...</option>
                  {activeDealers.map((d) => (
                    <option key={d.id} value={d.name}>{d.name} — {d.location}</option>
                  ))}
                </select>
                {errors.dealer_name && <span className="modal-error">{errors.dealer_name}</span>}
              </div>

              <div className="modal-row">
                <div className="modal-field">
                  <label>Amount (₹) *</label>
                  <input
                    type="number" min="1"
                    placeholder="e.g. 25000"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className={errors.amount ? 'error' : ''}
                  />
                  {errors.amount && <span className="modal-error">{errors.amount}</span>}
                </div>
                <div className="modal-field">
                  <label>Payment Mode</label>
                  <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                    {PAYMENT_MODES.map((m) => (
                      <option key={m} value={m}>{m.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="modal-row">
                <div className="modal-field">
                  <label>Date *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className={errors.date ? 'error' : ''}
                  />
                  {errors.date && <span className="modal-error">{errors.date}</span>}
                </div>
                <div className="modal-field">
                  <label>Reference / Cheque No.</label>
                  <input
                    placeholder="e.g. CHQ-001234"
                    value={form.reference}
                    onChange={(e) => setForm({ ...form, reference: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-field">
                <label>Notes (optional)</label>
                <input
                  placeholder="Any notes..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="modal-submit" disabled={saving}>
                  {saving ? <span className="btn-spinner" /> : <i className="ti ti-check" />}
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {showDeleteId && (
        <div className="modal-overlay" onClick={() => setShowDeleteId(null)}>
          <div className="modal-card modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Delete Payment?</h3>
              <button className="modal-close" onClick={() => setShowDeleteId(null)}>
                <i className="ti ti-x" />
              </button>
            </div>
            <p className="modal-confirm-text">This will permanently delete this payment record.</p>
            <div className="modal-footer">
              <button className="modal-cancel" onClick={() => setShowDeleteId(null)}>Cancel</button>
              <button className="modal-delete" onClick={() => handleDelete(showDeleteId)}>
                <i className="ti ti-trash" /> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="khata-toast">
          <i className="ti ti-circle-check" />
          {toast}
        </div>
      )}
    </div>
  );
}