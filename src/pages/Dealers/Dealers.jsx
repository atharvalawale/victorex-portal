import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import Topbar from '../../components/Topbar/Topbar';
import { supabase } from '../../lib/supabase';
import './Dealers.css';

const EMPTY_FORM = {
  name: '', location: '', phone: '', email: '',
  gst_number: '', credit_limit: '', status: 'active',
};

export default function Dealers() {
  const [sidebarOpen, setSidebarOpen]   = useState(false);
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
  const [viewDealer, setViewDealer]     = useState(null);
  const [dealerOrders, setDealerOrders] = useState([]);

  useEffect(() => { fetchDealers(); }, []);

  async function fetchDealers() {
    setLoading(true);
    const { data, error } = await supabase
      .from('dealers')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setDealers(data || []);
    setLoading(false);
  }

  async function fetchDealerOrders(dealerName) {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('dealer_name', dealerName)
      .order('created_at', { ascending: false });
    setDealerOrders(data || []);
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  const filtered = dealers.filter((d) => {
    const matchStatus = filterStatus === 'all' || d.status === filterStatus;
    const matchSearch =
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.location.toLowerCase().includes(search.toLowerCase()) ||
      (d.phone || '').includes(search);
    return matchStatus && matchSearch;
  });

  function validate() {
    const e = {};
    if (!form.name.trim())     e.name     = 'Dealer name required';
    if (!form.location.trim()) e.location = 'Location required';
    if (!form.phone.trim())    e.phone    = 'Phone required';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSaving(true);

    const payload = {
      name:         form.name,
      location:     form.location,
      phone:        form.phone,
      email:        form.email,
      gst_number:   form.gst_number,
      credit_limit: Number(form.credit_limit) || 0,
      status:       form.status,
    };

    if (editId) {
      const { error } = await supabase.from('dealers').update(payload).eq('id', editId);
      if (!error) { showToast('Dealer updated ✓'); fetchDealers(); }
      else showToast('Error updating dealer');
    } else {
      const { error } = await supabase.from('dealers').insert(payload);
      if (!error) { showToast('Dealer added ✓'); fetchDealers(); }
      else showToast('Error adding dealer');
    }

    setSaving(false);
    setShowModal(false);
    setForm(EMPTY_FORM);
    setEditId(null);
  }

  function handleEdit(dealer) {
    setForm({
      name:         dealer.name,
      location:     dealer.location,
      phone:        dealer.phone || '',
      email:        dealer.email || '',
      gst_number:   dealer.gst_number || '',
      credit_limit: String(dealer.credit_limit || ''),
      status:       dealer.status,
    });
    setEditId(dealer.id);
    setShowModal(true);
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('dealers').delete().eq('id', id);
    if (!error) { showToast('Dealer deleted'); fetchDealers(); }
    setShowDeleteId(null);
  }

  async function handleStatusToggle(dealer) {
    const newStatus = dealer.status === 'active' ? 'inactive' : 'active';
    await supabase.from('dealers').update({ status: newStatus }).eq('id', dealer.id);
    setDealers((prev) => prev.map((d) => d.id === dealer.id ? { ...d, status: newStatus } : d));
  }

  async function handleView(dealer) {
    setViewDealer(dealer);
    await fetchDealerOrders(dealer.name);
  }

  const fmtAmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const getInitials = (name) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="dealers-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="dealers-main">
        <Topbar title="Dealers" onMenuClick={() => setSidebarOpen(true)} />

        <div className="dealers-content">

          {/* Header */}
          <div className="dealers-header">
            <div>
              <h2 className="dealers-title">Dealer Management</h2>
              <p className="dealers-sub">
                {loading ? 'Loading...' : `${filtered.length} dealers · ${dealers.filter(d => d.status === 'active').length} active`}
              </p>
            </div>
            <button
              className="dealers-add-btn"
              onClick={() => { setForm(EMPTY_FORM); setEditId(null); setErrors({}); setShowModal(true); }}
            >
              <i className="ti ti-plus" />
              Add Dealer
            </button>
          </div>

          {/* Filters */}
          <div className="dealers-filters">
            <div className="dealers-search-wrap">
              <i className="ti ti-search" />
              <input
                className="dealers-search"
                placeholder="Search name, location, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="dealers-status-filters">
              {['all', 'active', 'inactive'].map((s) => (
                <button
                  key={s}
                  className={`dealers-filter-btn${filterStatus === s ? ' active' : ''}`}
                  onClick={() => setFilterStatus(s)}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Cards grid */}
          {loading ? (
            <div className="dealers-loading">
              <div className="dealers-spinner" />
              Loading dealers...
            </div>
          ) : filtered.length === 0 ? (
            <div className="dealers-empty">
              <i className="ti ti-users" />
              <span>No dealers yet — click Add Dealer to get started</span>
            </div>
          ) : (
            <div className="dealers-grid">
              {filtered.map((d) => (
                <div className="dealer-card" key={d.id}>
                  <div className="dealer-card-top">
                    <div className="dealer-avatar">{getInitials(d.name)}</div>
                    <div className="dealer-info">
                      <div className="dealer-name">{d.name}</div>
                      <div className="dealer-location">
                        <i className="ti ti-map-pin" />
                        {d.location}
                      </div>
                    </div>
                    <span className={`dealer-status-badge ${d.status}`}>
                      {d.status}
                    </span>
                  </div>

                  <div className="dealer-card-meta">
                    {d.phone && (
                      <div className="dealer-meta-row">
                        <i className="ti ti-phone" />
                        {d.phone}
                      </div>
                    )}
                    {d.email && (
                      <div className="dealer-meta-row">
                        <i className="ti ti-mail" />
                        {d.email}
                      </div>
                    )}
                    {d.gst_number && (
                      <div className="dealer-meta-row">
                        <i className="ti ti-file-text" />
                        GST: {d.gst_number}
                      </div>
                    )}
                    {d.credit_limit > 0 && (
                      <div className="dealer-meta-row">
                        <i className="ti ti-credit-card" />
                        Credit limit: {fmtAmt(d.credit_limit)}
                      </div>
                    )}
                  </div>

                  <div className="dealer-card-footer">
                    <div className="dealer-since">
                      Since {fmtDate(d.created_at)}
                    </div>
                    <div className="dealer-actions">
                      <button className="dealer-action-btn view" onClick={() => handleView(d)} title="View scorecard">
                        <i className="ti ti-eye" />
                      </button>
                      <button className="dealer-action-btn edit" onClick={() => handleEdit(d)} title="Edit">
                        <i className="ti ti-pencil" />
                      </button>
                      <button
                        className={`dealer-action-btn toggle ${d.status}`}
                        onClick={() => handleStatusToggle(d)}
                        title={d.status === 'active' ? 'Deactivate' : 'Activate'}
                      >
                        <i className={`ti ${d.status === 'active' ? 'ti-player-pause' : 'ti-player-play'}`} />
                      </button>
                      <button className="dealer-action-btn delete" onClick={() => setShowDeleteId(d.id)} title="Delete">
                        <i className="ti ti-trash" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editId ? 'Edit Dealer' : 'Add Dealer'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <i className="ti ti-x" />
              </button>
            </div>

            <form className="modal-form" onSubmit={handleSubmit}>
              <div className="modal-row">
                <div className="modal-field">
                  <label>Dealer Name *</label>
                  <input
                    placeholder="e.g. Sharma Paints"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={errors.name ? 'error' : ''}
                  />
                  {errors.name && <span className="modal-error">{errors.name}</span>}
                </div>
                <div className="modal-field">
                  <label>Location *</label>
                  <input
                    placeholder="e.g. Satara"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className={errors.location ? 'error' : ''}
                  />
                  {errors.location && <span className="modal-error">{errors.location}</span>}
                </div>
              </div>

              <div className="modal-row">
                <div className="modal-field">
                  <label>Phone *</label>
                  <input
                    placeholder="e.g. 9876543210"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className={errors.phone ? 'error' : ''}
                  />
                  {errors.phone && <span className="modal-error">{errors.phone}</span>}
                </div>
                <div className="modal-field">
                  <label>Email</label>
                  <input
                    type="email"
                    placeholder="e.g. sharma@gmail.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-row">
                <div className="modal-field">
                  <label>GST Number</label>
                  <input
                    placeholder="e.g. 27XXXXX1234X1ZX"
                    value={form.gst_number}
                    onChange={(e) => setForm({ ...form, gst_number: e.target.value })}
                  />
                </div>
                <div className="modal-field">
                  <label>Credit Limit (₹)</label>
                  <input
                    type="number" min="0"
                    placeholder="e.g. 100000"
                    value={form.credit_limit}
                    onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-field">
                <label>Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="modal-footer">
                <button type="button" className="modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="modal-submit" disabled={saving}>
                  {saving ? <span className="btn-spinner" /> : <i className="ti ti-check" />}
                  {editId ? 'Save Changes' : 'Add Dealer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dealer Scorecard */}
      {viewDealer && (
        <div className="modal-overlay" onClick={() => setViewDealer(null)}>
          <div className="modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="dealer-avatar-lg">{getInitials(viewDealer.name)}</div>
                <div>
                  <h3 className="modal-title">{viewDealer.name}</h3>
                  <div style={{ fontSize: 12, color: '#8A8FA3' }}>{viewDealer.location} · {viewDealer.phone}</div>
                </div>
              </div>
              <button className="modal-close" onClick={() => setViewDealer(null)}>
                <i className="ti ti-x" />
              </button>
            </div>

            <div className="scorecard-body">
              <div className="scorecard-stats">
                <div className="scorecard-stat">
                  <div className="scorecard-stat-val">{dealerOrders.length}</div>
                  <div className="scorecard-stat-lbl">Total Orders</div>
                </div>
                <div className="scorecard-stat">
                  <div className="scorecard-stat-val">
                    {fmtAmt(dealerOrders.reduce((s, o) => s + Number(o.total_amount || o.amount || 0), 0))}
                  </div>
                  <div className="scorecard-stat-lbl">Total Value</div>
                </div>
                <div className="scorecard-stat">
                  <div className="scorecard-stat-val">
                    {dealerOrders.filter(o => o.status === 'delivered').length}
                  </div>
                  <div className="scorecard-stat-lbl">Delivered</div>
                </div>
                <div className="scorecard-stat">
                  <div className="scorecard-stat-val">
                    {dealerOrders.filter(o => o.status === 'pending').length}
                  </div>
                  <div className="scorecard-stat-lbl">Pending</div>
                </div>
              </div>

              <div style={{ padding: '0 20px 20px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0B1F3A', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Order History
                </div>
                {dealerOrders.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: '#8A8FA3', fontSize: 13 }}>
                    No orders yet for this dealer
                  </div>
                ) : (
                  <div className="scorecard-orders">
                    {dealerOrders.map((o) => (
                      <div className="scorecard-order-row" key={o.id}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0B1F3A' }}>{o.product}</div>
                          <div style={{ fontSize: 11, color: '#8A8FA3' }}>{o.qty} boxes · {fmtDate(o.date)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{fmtAmt(o.amount)}</div>
                          <span className={`status-badge ${o.status}`}>
                            {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {showDeleteId && (
        <div className="modal-overlay" onClick={() => setShowDeleteId(null)}>
          <div className="modal-card modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Delete Dealer?</h3>
              <button className="modal-close" onClick={() => setShowDeleteId(null)}>
                <i className="ti ti-x" />
              </button>
            </div>
            <p className="modal-confirm-text">This will permanently delete the dealer and cannot be undone.</p>
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
        <div className="dealers-toast">
          <i className="ti ti-circle-check" />
          {toast}
        </div>
      )}
    </div>
  );
}
