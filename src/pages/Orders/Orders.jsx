import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import Topbar from '../../components/Topbar/Topbar';
import { supabase } from '../../lib/supabase'
import './Orders.css';

const PRODUCTS = ['WallVex Pro', 'Chromvex', 'Primvex'];
const STATUS_OPTIONS = ['pending', 'processing', 'delivered', 'cancelled'];

const STATUS_STYLE = {
  pending:    { background: 'rgba(232,184,75,0.12)',  color: '#8a5a00' },
  processing: { background: 'rgba(58,143,212,0.12)',  color: '#1a4a7a' },
  delivered:  { background: 'rgba(45,157,110,0.12)',  color: '#165c3a' },
  cancelled:  { background: 'rgba(216,90,48,0.12)',   color: '#7a2010' },
};

const EMPTY_FORM = {
  dealer_name: '', location: '', product: PRODUCTS[0],
  qty: '', rate: '', notes: '',
};

function generateOrderNumber(count) {
  return `ORD-${String(count + 1).padStart(3, '0')}`;
}

export default function Orders() {
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [orders, setOrders]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [showModal, setShowModal]       = useState(false);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [errors, setErrors]             = useState({});
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch]             = useState('');
  const [editId, setEditId]             = useState(null);
  const [showDeleteId, setShowDeleteId] = useState(null);
  const [toast, setToast]               = useState('');

  /* ── Fetch orders ── */
  useEffect(() => { fetchOrders(); }, []);

  async function fetchOrders() {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setOrders(data || []);
    setLoading(false);
  }

  /* ── Toast ── */
  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  /* ── Filtered ── */
  const filtered = orders.filter((o) => {
    const matchStatus = filterStatus === 'all' || o.status === filterStatus;
    const matchSearch =
      o.dealer_name.toLowerCase().includes(search.toLowerCase()) ||
      o.product.toLowerCase().includes(search.toLowerCase()) ||
      o.location.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const totalAmt = filtered.reduce((s, o) => s + Number(o.amount), 0);

  /* ── Validation ── */
  function validate() {
    const e = {};
    if (!form.dealer_name.trim()) e.dealer_name = 'Dealer name required';
    if (!form.location.trim())    e.location    = 'Location required';
    if (!form.qty || isNaN(form.qty) || Number(form.qty) <= 0)   e.qty  = 'Valid quantity required';
    if (!form.rate || isNaN(form.rate) || Number(form.rate) <= 0) e.rate = 'Valid rate required';
    return e;
  }

  /* ── Submit ── */
  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSaving(true);

    const amount = Number(form.qty) * Number(form.rate);

    if (editId) {
      const { error } = await supabase
        .from('orders')
        .update({
          dealer_name: form.dealer_name,
          location:    form.location,
          product:     form.product,
          qty:         Number(form.qty),
          rate:        Number(form.rate),
          amount,
          notes:       form.notes,
        })
        .eq('id', editId);

      if (!error) { showToast('Order updated ✓'); fetchOrders(); }
      else showToast('Error updating order');
    } else {
      const { error } = await supabase
        .from('orders')
        .insert({
          order_number: generateOrderNumber(orders.length),
          dealer_name:  form.dealer_name,
          location:     form.location,
          product:      form.product,
          qty:          Number(form.qty),
          rate:         Number(form.rate),
          amount,
          notes:        form.notes,
          status:       'pending',
          date:         new Date().toISOString().split('T')[0],
        });

      if (!error) { showToast('Order placed ✓'); fetchOrders(); }
      else showToast('Error placing order');
    }

    setSaving(false);
    setShowModal(false);
    setForm(EMPTY_FORM);
    setEditId(null);
  }

  /* ── Edit ── */
  function handleEdit(order) {
    setForm({
      dealer_name: order.dealer_name,
      location:    order.location,
      product:     order.product,
      qty:         String(order.qty),
      rate:        String(order.rate),
      notes:       order.notes || '',
    });
    setEditId(order.id);
    setShowModal(true);
  }

  /* ── Delete ── */
  async function handleDelete(id) {
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (!error) { showToast('Order deleted'); fetchOrders(); }
    setShowDeleteId(null);
  }

  /* ── Status change ── */
  async function handleStatusChange(id, status) {
    await supabase.from('orders').update({ status }).eq('id', id);
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status } : o));
  }

  const fmtAmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="orders-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="orders-main">
        <Topbar title="Orders" onMenuClick={() => setSidebarOpen(true)} />

        <div className="orders-content">

          {/* Header */}
          <div className="orders-header">
            <div>
              <h2 className="orders-title">Order Management</h2>
              <p className="orders-sub">
                {loading ? 'Loading...' : `${filtered.length} orders · Total ${fmtAmt(totalAmt)}`}
              </p>
            </div>
            <button
              className="orders-add-btn"
              onClick={() => { setForm(EMPTY_FORM); setEditId(null); setErrors({}); setShowModal(true); }}
            >
              <i className="ti ti-plus" />
              New Order
            </button>
          </div>

          {/* Filters */}
          <div className="orders-filters">
            <div className="orders-search-wrap">
              <i className="ti ti-search" />
              <input
                className="orders-search"
                placeholder="Search dealer, product, location..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="orders-status-filters">
              {['all', ...STATUS_OPTIONS].map((s) => (
                <button
                  key={s}
                  className={`orders-filter-btn${filterStatus === s ? ' active' : ''}`}
                  onClick={() => setFilterStatus(s)}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="orders-table-wrap">
            {loading ? (
              <div className="orders-loading">
                <div className="orders-spinner" />
                Loading orders...
              </div>
            ) : (
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Dealer</th>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Rate</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="orders-empty">
                        <i className="ti ti-inbox" />
                        <span>No orders yet — click New Order to add one</span>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((o) => (
                      <tr key={o.id}>
                        <td><span className="orders-id">{o.order_number}</span></td>
                        <td>
                          <div className="orders-dealer-name">{o.dealer_name}</div>
                          <div className="orders-dealer-loc">{o.location}</div>
                        </td>
                        <td>{o.product}</td>
                        <td>{o.qty} boxes</td>
                        <td>{fmtAmt(o.rate)}</td>
                        <td><strong>{fmtAmt(o.amount)}</strong></td>
                        <td className="orders-date">{fmtDate(o.date)}</td>
                        <td>
                          <select
                            className="orders-status-select"
                            value={o.status}
                            onChange={(e) => handleStatusChange(o.id, e.target.value)}
                            style={STATUS_STYLE[o.status]}
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <div className="orders-actions">
                            <button className="orders-action-btn edit" onClick={() => handleEdit(o)} title="Edit">
                              <i className="ti ti-pencil" />
                            </button>
                            <button className="orders-action-btn delete" onClick={() => setShowDeleteId(o.id)} title="Delete">
                              <i className="ti ti-trash" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editId ? 'Edit Order' : 'New Order'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <i className="ti ti-x" />
              </button>
            </div>

            <form className="modal-form" onSubmit={handleSubmit}>
              <div className="modal-row">
                <div className="modal-field">
                  <label>Dealer Name</label>
                  <input
                    placeholder="e.g. Sharma Paints"
                    value={form.dealer_name}
                    onChange={(e) => setForm({ ...form, dealer_name: e.target.value })}
                    className={errors.dealer_name ? 'error' : ''}
                  />
                  {errors.dealer_name && <span className="modal-error">{errors.dealer_name}</span>}
                </div>
                <div className="modal-field">
                  <label>Location</label>
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
                  <label>Product</label>
                  <select
                    value={form.product}
                    onChange={(e) => setForm({ ...form, product: e.target.value })}
                  >
                    {PRODUCTS.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="modal-field">
                  <label>Quantity (boxes)</label>
                  <input
                    type="number" min="1"
                    placeholder="e.g. 20"
                    value={form.qty}
                    onChange={(e) => setForm({ ...form, qty: e.target.value })}
                    className={errors.qty ? 'error' : ''}
                  />
                  {errors.qty && <span className="modal-error">{errors.qty}</span>}
                </div>
              </div>

              <div className="modal-row">
                <div className="modal-field">
                  <label>Rate per box (₹)</label>
                  <input
                    type="number" min="1"
                    placeholder="e.g. 920"
                    value={form.rate}
                    onChange={(e) => setForm({ ...form, rate: e.target.value })}
                    className={errors.rate ? 'error' : ''}
                  />
                  {errors.rate && <span className="modal-error">{errors.rate}</span>}
                </div>
                <div className="modal-field">
                  <label>Amount</label>
                  <input
                    readOnly
                    value={
                      form.qty && form.rate
                        ? `₹${(Number(form.qty) * Number(form.rate)).toLocaleString('en-IN')}`
                        : '—'
                    }
                    className="modal-readonly"
                  />
                </div>
              </div>

              <div className="modal-field">
                <label>Notes (optional)</label>
                <textarea
                  placeholder="Any special instructions..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="modal-cancel" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="modal-submit" disabled={saving}>
                  {saving ? (
                    <span className="btn-spinner" />
                  ) : (
                    <i className="ti ti-check" />
                  )}
                  {editId ? 'Save Changes' : 'Place Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {showDeleteId && (
        <div className="modal-overlay" onClick={() => setShowDeleteId(null)}>
          <div className="modal-card modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Delete Order?</h3>
              <button className="modal-close" onClick={() => setShowDeleteId(null)}>
                <i className="ti ti-x" />
              </button>
            </div>
            <p className="modal-confirm-text">This action cannot be undone.</p>
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
        <div className="orders-toast">
          <i className="ti ti-circle-check" />
          {toast}
        </div>
      )}

    </div>
  );
}