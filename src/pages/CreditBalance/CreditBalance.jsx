import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import Topbar from '../../components/Topbar/Topbar';
import { supabase } from '../../lib/supabase';
import './CreditBalance.css';

const fmtAmt  = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = d => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const EMPTY_FORM = {
  dealer_name: '', amount: '',
  date: new Date().toISOString().split('T')[0],
  type: 'received', notes: '',
};

export default function CreditBalance() {
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [dealers, setDealers]           = useState([]);
  const [advances, setAdvances]         = useState([]);
  const [diaryEntries, setDiaryEntries] = useState([]);
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
    const [d, a, de] = await Promise.all([
      supabase.from('dealers').select('*').eq('status', 'active').order('name'),
      supabase.from('dealer_advances').select('*').order('date', { ascending: false }),
      supabase.from('diary_entries').select('*').order('date', { ascending: false }),
    ]);
    setDealers(d.data  || []);
    setAdvances(a.data || []);
    setDiaryEntries(de.data || []);
    setLoading(false);
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  /* ── Calculate balance per dealer ── */
  function getDealerBalance(dealerName) {
    /* Total ordered from diary */
    const diaryOrders = diaryEntries.filter(e => e.dealer_name === dealerName);
    const totalOrdered = diaryOrders.reduce((s, e) => s + Number(e.amount || 0), 0);

    /* Total paid from diary (paid_amount) */
    const totalPaidDiary = diaryOrders.reduce((s, e) => s + Number(e.paid_amount || 0), 0);

    /* Total advance received */
    const totalAdvance = advances
      .filter(a => a.dealer_name === dealerName && a.type === 'received')
      .reduce((s, a) => s + Number(a.amount || 0), 0);

    /* Total advance used/adjusted */
    const totalUsed = advances
      .filter(a => a.dealer_name === dealerName && a.type === 'adjusted')
      .reduce((s, a) => s + Number(a.amount || 0), 0);

    const totalReceived  = totalPaidDiary + totalAdvance - totalUsed;
    const outstanding    = totalOrdered - totalReceived;
    const creditBalance  = outstanding < 0 ? Math.abs(outstanding) : 0;
    const actualDue      = outstanding > 0 ? outstanding : 0;

    return {
      totalOrdered,
      totalReceived,
      totalAdvance,
      outstanding,
      creditBalance,
      actualDue,
      isCredit: outstanding < 0,
      diaryOrders,
    };
  }

  /* ── All dealers with balances ── */
  const allDealerNames = [
    ...new Set([
      ...dealers.map(d => d.name),
      ...diaryEntries.map(e => e.dealer_name),
      ...advances.map(a => a.dealer_name),
    ])
  ];

  const dealerBalances = allDealerNames.map(name => {
    const dealer  = dealers.find(d => d.name === name);
    const balance = getDealerBalance(name);
    return { name, location: dealer?.location || diaryEntries.find(e => e.dealer_name === name)?.location || '', ...balance };
  }).sort((a, b) => b.totalOrdered - a.totalOrdered);

  const totalCreditBalance  = dealerBalances.reduce((s, d) => s + d.creditBalance, 0);
  const totalOutstanding    = dealerBalances.reduce((s, d) => s + d.actualDue, 0);
  const creditDealers       = dealerBalances.filter(d => d.isCredit);
  const outstandingDealers  = dealerBalances.filter(d => !d.isCredit && d.actualDue > 0);

  /* ── Validate ── */
  function validate() {
    const e = {};
    if (!form.dealer_name) e.dealer_name = 'Dealer required';
    if (!form.amount || Number(form.amount) <= 0) e.amount = 'Valid amount required';
    if (!form.date) e.date = 'Date required';
    return e;
  }

  /* ── Submit advance ── */
  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSaving(true);

    const { error } = await supabase.from('dealer_advances').insert({
      dealer_name: form.dealer_name,
      amount:      Number(form.amount),
      date:        form.date,
      type:        form.type,
      notes:       form.notes,
    });

    if (!error) { showToast('Advance recorded ✓'); fetchAll(); }
    else showToast('Error recording advance');

    setSaving(false);
    setShowModal(false);
    setForm(EMPTY_FORM);
  }

  async function handleDelete(id) {
    await supabase.from('dealer_advances').delete().eq('id', id);
    showToast('Entry deleted');
    fetchAll();
    setShowDeleteId(null);
  }

  const getInitials = n => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="credit-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="credit-main">
        <Topbar title="Credit Balance" onMenuClick={() => setSidebarOpen(true)} />

        <div className="credit-content">

          {/* Header */}
          <div className="credit-header">
            <div>
              <h2 className="credit-title">Credit Balance Tracker</h2>
              <p className="credit-sub">Track dealer advances, credit balances and outstanding dues</p>
            </div>
            <button
              className="credit-add-btn"
              onClick={() => { setForm(EMPTY_FORM); setErrors({}); setShowModal(true); }}
            >
              <i className="ti ti-plus" /> Record Advance
            </button>
          </div>

          {loading ? (
            <div className="credit-loading"><div className="credit-spinner" /> Loading...</div>
          ) : (
            <>
              {/* Summary KPIs */}
              <div className="credit-kpis">
                <div className="credit-kpi green">
                  <div className="credit-kpi-icon"><i className="ti ti-arrow-down-circle" /></div>
                  <div>
                    <div className="credit-kpi-val">{fmtAmt(totalCreditBalance)}</div>
                    <div className="credit-kpi-lbl">Total Credit Balance</div>
                    <div className="credit-kpi-sub">{creditDealers.length} dealers overpaid</div>
                  </div>
                </div>
                <div className="credit-kpi red">
                  <div className="credit-kpi-icon"><i className="ti ti-alert-circle" /></div>
                  <div>
                    <div className="credit-kpi-val">{fmtAmt(totalOutstanding)}</div>
                    <div className="credit-kpi-lbl">Total Outstanding</div>
                    <div className="credit-kpi-sub">{outstandingDealers.length} dealers owe you</div>
                  </div>
                </div>
                <div className="credit-kpi gold">
                  <div className="credit-kpi-icon"><i className="ti ti-users" /></div>
                  <div>
                    <div className="credit-kpi-val">{dealerBalances.length}</div>
                    <div className="credit-kpi-lbl">Total Dealers</div>
                    <div className="credit-kpi-sub">in diary records</div>
                  </div>
                </div>
                <div className="credit-kpi navy">
                  <div className="credit-kpi-icon"><i className="ti ti-currency-rupee" /></div>
                  <div>
                    <div className="credit-kpi-val">{fmtAmt(dealerBalances.reduce((s,d) => s+d.totalOrdered, 0))}</div>
                    <div className="credit-kpi-lbl">Total Business</div>
                    <div className="credit-kpi-sub">from diary entries</div>
                  </div>
                </div>
              </div>

              {/* Credit balance dealers */}
              {creditDealers.length > 0 && (
                <div className="credit-section">
                  <div className="credit-section-title green-title">
                    <i className="ti ti-arrow-down-circle" />
                    Dealers with Credit Balance — You owe them goods
                  </div>
                  <div className="credit-cards">
                    {creditDealers.map(d => (
                      <div key={d.name} className="credit-card credit-card-green" onClick={() => setSelectedDealer(selectedDealer?.name === d.name ? null : d)}>
                        <div className="credit-card-top">
                          <div className="credit-avatar green-avatar">{getInitials(d.name)}</div>
                          <div className="credit-dealer-info">
                            <div className="credit-dealer-name">{d.name}</div>
                            <div className="credit-dealer-loc">{d.location}</div>
                          </div>
                          <div className="credit-balance-badge green-badge">
                            <i className="ti ti-arrow-down-circle" />
                            Credit: {fmtAmt(d.creditBalance)}
                          </div>
                        </div>

                        <div className="credit-card-stats">
                          <div className="credit-stat">
                            <div className="credit-stat-val">{fmtAmt(d.totalOrdered)}</div>
                            <div className="credit-stat-lbl">Total Ordered</div>
                          </div>
                          <div className="credit-stat">
                            <div className="credit-stat-val" style={{ color:'#2D9D6E' }}>{fmtAmt(d.totalReceived)}</div>
                            <div className="credit-stat-lbl">Total Paid</div>
                          </div>
                          <div className="credit-stat">
                            <div className="credit-stat-val" style={{ color:'#2D9D6E', fontSize:20 }}>{fmtAmt(d.creditBalance)}</div>
                            <div className="credit-stat-lbl">Credit Balance</div>
                          </div>
                        </div>

                        <div className="credit-note green-note">
                          <i className="ti ti-info-circle" />
                          This dealer has paid more than ordered. Deliver goods worth {fmtAmt(d.creditBalance)} against their advance.
                        </div>

                        {/* Advance history */}
                        {selectedDealer?.name === d.name && (
                          <div className="credit-history">
                            <div className="credit-history-title">Advance History</div>
                            {advances.filter(a => a.dealer_name === d.name).map(a => (
                              <div key={a.id} className="credit-history-row">
                                <div>
                                  <div style={{ fontSize:12, fontWeight:600, color:'#0B1F3A' }}>
                                    {a.type === 'received' ? 'Advance Received' : 'Adjusted against order'}
                                  </div>
                                  <div style={{ fontSize:11, color:'#8A8FA3' }}>{fmtDate(a.date)} {a.notes && `· ${a.notes}`}</div>
                                </div>
                                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                  <span style={{ fontSize:13, fontWeight:700, color: a.type === 'received' ? '#2D9D6E' : '#D85A30' }}>
                                    {a.type === 'received' ? '+' : '-'}{fmtAmt(a.amount)}
                                  </span>
                                  <button className="credit-delete-btn" onClick={e => { e.stopPropagation(); setShowDeleteId(a.id); }}>
                                    <i className="ti ti-trash" />
                                  </button>
                                </div>
                              </div>
                            ))}
                            <button
                              className="credit-add-advance-btn"
                              onClick={e => { e.stopPropagation(); setForm({ ...EMPTY_FORM, dealer_name: d.name }); setShowModal(true); }}
                            >
                              <i className="ti ti-plus" /> Add Advance Entry
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Outstanding dealers */}
              {outstandingDealers.length > 0 && (
                <div className="credit-section">
                  <div className="credit-section-title red-title">
                    <i className="ti ti-alert-circle" />
                    Outstanding Dealers — They owe you money
                  </div>
                  <div className="credit-cards">
                    {outstandingDealers.map(d => (
                      <div key={d.name} className="credit-card credit-card-red" onClick={() => setSelectedDealer(selectedDealer?.name === d.name ? null : d)}>
                        <div className="credit-card-top">
                          <div className="credit-avatar red-avatar">{getInitials(d.name)}</div>
                          <div className="credit-dealer-info">
                            <div className="credit-dealer-name">{d.name}</div>
                            <div className="credit-dealer-loc">{d.location}</div>
                          </div>
                          <div className="credit-balance-badge red-badge">
                            <i className="ti ti-alert-circle" />
                            Due: {fmtAmt(d.actualDue)}
                          </div>
                        </div>

                        <div className="credit-card-stats">
                          <div className="credit-stat">
                            <div className="credit-stat-val">{fmtAmt(d.totalOrdered)}</div>
                            <div className="credit-stat-lbl">Total Ordered</div>
                          </div>
                          <div className="credit-stat">
                            <div className="credit-stat-val" style={{ color:'#2D9D6E' }}>{fmtAmt(d.totalReceived)}</div>
                            <div className="credit-stat-lbl">Total Paid</div>
                          </div>
                          <div className="credit-stat">
                            <div className="credit-stat-val" style={{ color:'#D85A30', fontSize:20 }}>{fmtAmt(d.actualDue)}</div>
                            <div className="credit-stat-lbl">Outstanding</div>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div style={{ marginTop:10 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#8A8FA3', marginBottom:4 }}>
                            <span>{fmtAmt(d.totalReceived)} collected</span>
                            <span>{d.totalOrdered > 0 ? Math.round((d.totalReceived/d.totalOrdered)*100) : 0}%</span>
                          </div>
                          <div className="credit-progress-track">
                            <div
                              className="credit-progress-fill"
                              style={{
                                width: `${d.totalOrdered > 0 ? Math.round((d.totalReceived/d.totalOrdered)*100) : 0}%`,
                                background: d.totalReceived/d.totalOrdered >= 0.8 ? '#2D9D6E' : d.totalReceived/d.totalOrdered >= 0.5 ? '#C9922A' : '#D85A30',
                              }}
                            />
                          </div>
                        </div>

                        {/* Advance history */}
                        {selectedDealer?.name === d.name && (
                          <div className="credit-history">
                            <div className="credit-history-title">Advance History</div>
                            {advances.filter(a => a.dealer_name === d.name).length === 0 ? (
                              <div style={{ fontSize:12, color:'#B0B5C8', padding:'8px 0' }}>No advance entries yet</div>
                            ) : advances.filter(a => a.dealer_name === d.name).map(a => (
                              <div key={a.id} className="credit-history-row">
                                <div>
                                  <div style={{ fontSize:12, fontWeight:600, color:'#0B1F3A' }}>
                                    {a.type === 'received' ? 'Advance Received' : 'Adjusted'}
                                  </div>
                                  <div style={{ fontSize:11, color:'#8A8FA3' }}>{fmtDate(a.date)} {a.notes && `· ${a.notes}`}</div>
                                </div>
                                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                  <span style={{ fontSize:13, fontWeight:700, color:'#2D9D6E' }}>{fmtAmt(a.amount)}</span>
                                  <button className="credit-delete-btn" onClick={e => { e.stopPropagation(); setShowDeleteId(a.id); }}>
                                    <i className="ti ti-trash" />
                                  </button>
                                </div>
                              </div>
                            ))}
                            <button
                              className="credit-add-advance-btn"
                              onClick={e => { e.stopPropagation(); setForm({ ...EMPTY_FORM, dealer_name: d.name }); setShowModal(true); }}
                            >
                              <i className="ti ti-plus" /> Record Advance Payment
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Full summary table */}
              <div className="credit-card-plain">
                <div className="credit-table-title">
                  <i className="ti ti-table" /> Complete Balance Summary
                </div>
                <div style={{ overflowX:'auto' }}>
                  <table className="credit-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Dealer</th>
                        <th>Total Ordered</th>
                        <th>Total Paid</th>
                        <th>Status</th>
                        <th>Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dealerBalances.map((d, i) => (
                        <tr key={d.name}>
                          <td style={{ color:'#8A8FA3', fontSize:12 }}>{i+1}</td>
                          <td>
                            <div style={{ fontWeight:600, color:'#0B1F3A' }}>{d.name}</div>
                            <div style={{ fontSize:11, color:'#8A8FA3' }}>{d.location}</div>
                          </td>
                          <td><strong>{fmtAmt(d.totalOrdered)}</strong></td>
                          <td style={{ color:'#2D9D6E', fontWeight:600 }}>{fmtAmt(d.totalReceived)}</td>
                          <td>
                            {d.isCredit ? (
                              <span className="credit-status-badge green-badge-sm">Credit</span>
                            ) : d.actualDue > 0 ? (
                              <span className="credit-status-badge red-badge-sm">Outstanding</span>
                            ) : (
                              <span className="credit-status-badge clear-badge-sm">Clear</span>
                            )}
                          </td>
                          <td>
                            <div style={{ fontWeight:800, fontSize:14, color: d.isCredit ? '#2D9D6E' : d.actualDue > 0 ? '#D85A30' : '#0B1F3A' }}>
                              {d.isCredit ? `+${fmtAmt(d.creditBalance)}` : d.actualDue > 0 ? `-${fmtAmt(d.actualDue)}` : '✓ Clear'}
                            </div>
                            <div style={{ fontSize:10, color:'#8A8FA3' }}>
                              {d.isCredit ? 'you owe goods' : d.actualDue > 0 ? 'they owe you' : ''}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </>
          )}
        </div>
      </div>

      {/* Record Advance Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Record Advance</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <i className="ti ti-x" />
              </button>
            </div>
            <form className="modal-form" onSubmit={handleSubmit}>
              <div className="modal-field">
                <label>Dealer *</label>
                <input
                  list="credit-dealers"
                  placeholder="Type or select dealer..."
                  value={form.dealer_name}
                  onChange={e => setForm({ ...form, dealer_name: e.target.value })}
                  className={errors.dealer_name ? 'error' : ''}
                />
                <datalist id="credit-dealers">
                  {allDealerNames.map(n => <option key={n} value={n} />)}
                </datalist>
                {errors.dealer_name && <span className="modal-error">{errors.dealer_name}</span>}
              </div>

              <div className="modal-field">
                <label>Type</label>
                <div className="credit-type-btns">
                  <button
                    type="button"
                    className={`credit-type-btn${form.type === 'received' ? ' active-green' : ''}`}
                    onClick={() => setForm({ ...form, type: 'received' })}
                  >
                    <i className="ti ti-arrow-down-circle" /> Advance Received
                  </button>
                  <button
                    type="button"
                    className={`credit-type-btn${form.type === 'adjusted' ? ' active-red' : ''}`}
                    onClick={() => setForm({ ...form, type: 'adjusted' })}
                  >
                    <i className="ti ti-adjustments" /> Adjusted Against Order
                  </button>
                </div>
              </div>

              <div className="modal-row">
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
                <label>Notes (optional)</label>
                <input
                  placeholder="e.g. Advance for June supply"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="modal-submit" disabled={saving}>
                  {saving ? <span className="btn-spinner" /> : <i className="ti ti-check" />}
                  Save
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
              <button className="modal-close" onClick={() => setShowDeleteId(null)}><i className="ti ti-x" /></button>
            </div>
            <p className="modal-confirm-text">This cannot be undone.</p>
            <div className="modal-footer">
              <button className="modal-cancel" onClick={() => setShowDeleteId(null)}>Cancel</button>
              <button className="modal-delete" onClick={() => handleDelete(showDeleteId)}><i className="ti ti-trash" /> Delete</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="credit-toast"><i className="ti ti-circle-check" />{toast}</div>}
    </div>
  );
}