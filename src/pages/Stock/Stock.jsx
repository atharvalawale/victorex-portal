import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import Topbar from '../../components/Topbar/Topbar';
import { supabase } from '../../lib/supabase';
import './Stock.css';

const PRODUCT_COLORS = { 'WallVex Pro': '#17877C', 'Chromvex': '#16353B', 'Primvex': '#E99268' };

export default function Stock() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stock, setStock]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [toast, setToast]             = useState('');
  const [showModal, setShowModal]     = useState(false);
  const [modalType, setModalType]     = useState('add');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [form, setForm]               = useState({ qty: '', notes: '' });
  const [errors, setErrors]           = useState({});
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [reorderForm, setReorderForm] = useState({});

  useEffect(() => { fetchStock(); }, []);

  async function fetchStock() {
    setLoading(true);
    const { data } = await supabase
      .from('stock')
      .select('*')
      .order('product');
    setStock(data || []);
    setLoading(false);
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  function openModal(type, product) {
    setModalType(type);
    setSelectedProduct(product);
    setForm({ qty: '', notes: '' });
    setErrors({});
    setShowModal(true);
  }

  function validate() {
    const e = {};
    if (!form.qty || isNaN(form.qty) || Number(form.qty) <= 0)
      e.qty = 'Valid quantity required';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSaving(true);

    const qty    = Number(form.qty);
    const newQty = modalType === 'add'
      ? selectedProduct.quantity + qty
      : Math.max(0, selectedProduct.quantity - qty);

    const { error } = await supabase
      .from('stock')
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq('id', selectedProduct.id);

    if (!error) {
      showToast(modalType === 'add' ? `Added ${qty} boxes ✓` : `Removed ${qty} boxes ✓`);
      fetchStock();
    } else {
      showToast('Error updating stock');
    }

    setSaving(false);
    setShowModal(false);
  }

  function openReorderModal() {
    const rf = {};
    stock.forEach(s => { rf[s.id] = String(s.reorder_level); });
    setReorderForm(rf);
    setShowReorderModal(true);
  }

  async function handleSaveReorder(e) {
    e.preventDefault();
    setSaving(true);
    for (const s of stock) {
      await supabase
        .from('stock')
        .update({ reorder_level: Number(reorderForm[s.id]) || 0 })
        .eq('id', s.id);
    }
    showToast('Reorder levels saved ✓');
    setSaving(false);
    setShowReorderModal(false);
    fetchStock();
  }

  const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  const totalBoxes    = stock.reduce((s, p) => s + p.quantity, 0);
  const lowStockCount = stock.filter(p => p.quantity <= p.reorder_level).length;

  return (
    <div className="stock-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="stock-main">
        <Topbar title="Stock" onMenuClick={() => setSidebarOpen(true)} />

        <div className="stock-content">

          {/* Header */}
          <div className="stock-header">
            <div>
              <h2 className="stock-title">Stock Management</h2>
              <p className="stock-sub">
                {loading ? 'Loading...' : `${totalBoxes} total boxes · ${lowStockCount} low stock alert${lowStockCount !== 1 ? 's' : ''}`}
              </p>
            </div>
            <button className="stock-reorder-btn" onClick={openReorderModal}>
              <i className="ti ti-settings" /> Set Reorder Levels
            </button>
          </div>

          {loading ? (
            <div className="stock-loading">
              <div className="stock-spinner" /> Loading stock...
            </div>
          ) : (
            <>
              {/* Low stock alert */}
              {lowStockCount > 0 && (
                <div className="stock-alert">
                  <i className="ti ti-alert-triangle" />
                  <span>
                    <strong>{lowStockCount} product{lowStockCount > 1 ? 's' : ''}</strong> at or below reorder level — consider restocking soon.
                  </span>
                </div>
              )}

              {/* Stock cards */}
              <div className="stock-grid">
                {stock.map((s) => {
                  const pct      = s.reorder_level > 0 ? Math.min(Math.round((s.quantity / (s.reorder_level * 4)) * 100), 100) : 50;
                  const isLow    = s.quantity <= s.reorder_level;
                  const isCritical = s.quantity === 0;
                  const barColor = isCritical ? '#D85A30' : isLow ? '#E99268' : '#2D9D6E';
                  const color    = PRODUCT_COLORS[s.product] || '#16353B';

                  return (
                    <div key={s.id} className={`stock-card${isLow ? ' low' : ''}`}>
                      <div className="stock-card-accent" style={{ background: color }} />

                      <div className="stock-card-top">
                        <div className="stock-product-icon" style={{ background: `${color}18`, color }}>
                          <i className="ti ti-package" />
                        </div>
                        <div>
                          <div className="stock-product-name">{s.product}</div>
                          <div className="stock-product-sub">Last updated: {fmtDate(s.updated_at)}</div>
                        </div>
                        {isLow && (
                          <span className={`stock-alert-badge ${isCritical ? 'critical' : 'low'}`}>
                            {isCritical ? 'Out of Stock' : 'Low Stock'}
                          </span>
                        )}
                      </div>

                      <div className="stock-qty-row">
                        <div>
                          <div className="stock-qty">{s.quantity}</div>
                          <div className="stock-qty-label">boxes in stock</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div className="stock-reorder-val">{s.reorder_level}</div>
                          <div className="stock-qty-label">reorder level</div>
                        </div>
                      </div>

                      {/* Stock level bar */}
                      <div className="stock-bar-wrap">
                        <div className="stock-bar-track">
                          <div
                            className="stock-bar-fill"
                            style={{ width: `${pct}%`, background: barColor }}
                          />
                        </div>
                        <span className="stock-bar-label" style={{ color: barColor }}>
                          {isCritical ? 'Empty' : isLow ? 'Low' : 'Good'}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="stock-card-actions">
                        <button
                          className="stock-btn add"
                          onClick={() => openModal('add', s)}
                        >
                          <i className="ti ti-plus" /> Add Stock
                        </button>
                        <button
                          className="stock-btn remove"
                          onClick={() => openModal('remove', s)}
                          disabled={s.quantity === 0}
                        >
                          <i className="ti ti-minus" /> Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Stock summary table */}
              <div className="stock-table-wrap">
                <div className="stock-table-hdr">
                  <span className="stock-table-title">
                    <i className="ti ti-table" /> Stock Summary
                  </span>
                </div>
                <table className="stock-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>In Stock</th>
                      <th>Reorder Level</th>
                      <th>Status</th>
                      <th>Last Updated</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stock.map((s) => {
                      const isLow      = s.quantity <= s.reorder_level;
                      const isCritical = s.quantity === 0;
                      return (
                        <tr key={s.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: PRODUCT_COLORS[s.product] || '#16353B' }} />
                              <strong>{s.product}</strong>
                            </div>
                          </td>
                          <td><strong>{s.quantity}</strong> boxes</td>
                          <td>{s.reorder_level} boxes</td>
                          <td>
                            <span className={`stock-status-badge ${isCritical ? 'critical' : isLow ? 'low' : 'good'}`}>
                              {isCritical ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                            </span>
                          </td>
                          <td style={{ fontSize: 12, color: '#8A8FA3' }}>{fmtDate(s.updated_at)}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="stock-tbl-btn add" onClick={() => openModal('add', s)}>
                                <i className="ti ti-plus" />
                              </button>
                              <button
                                className="stock-tbl-btn remove"
                                onClick={() => openModal('remove', s)}
                                disabled={s.quantity === 0}
                              >
                                <i className="ti ti-minus" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add/Remove Modal */}
      {showModal && selectedProduct && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {modalType === 'add' ? 'Add Stock' : 'Remove Stock'} — {selectedProduct.product}
              </h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <i className="ti ti-x" />
              </button>
            </div>
            <form className="modal-form" onSubmit={handleSubmit}>
              <div className="modal-field">
                <label>Current Stock</label>
                <input value={`${selectedProduct.quantity} boxes`} readOnly className="modal-readonly" />
              </div>
              <div className="modal-field">
                <label>{modalType === 'add' ? 'Boxes to Add' : 'Boxes to Remove'} *</label>
                <input
                  type="number" min="1"
                  placeholder="e.g. 50"
                  value={form.qty}
                  onChange={e => setForm({ ...form, qty: e.target.value })}
                  className={errors.qty ? 'error' : ''}
                  autoFocus
                />
                {errors.qty && <span className="modal-error">{errors.qty}</span>}
              </div>
              {form.qty && !isNaN(form.qty) && Number(form.qty) > 0 && (
                <div className="stock-preview">
                  New stock will be: <strong>
                    {modalType === 'add'
                      ? selectedProduct.quantity + Number(form.qty)
                      : Math.max(0, selectedProduct.quantity - Number(form.qty))
                    } boxes
                  </strong>
                </div>
              )}
              <div className="modal-footer">
                <button type="button" className="modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                <button
                  type="submit"
                  className={`modal-submit ${modalType === 'remove' ? 'danger' : ''}`}
                  disabled={saving}
                >
                  {saving ? <span className="btn-spinner" /> : <i className={`ti ${modalType === 'add' ? 'ti-plus' : 'ti-minus'}`} />}
                  {modalType === 'add' ? 'Add Stock' : 'Remove Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reorder levels modal */}
      {showReorderModal && (
        <div className="modal-overlay" onClick={() => setShowReorderModal(false)}>
          <div className="modal-card modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Set Reorder Levels</h3>
              <button className="modal-close" onClick={() => setShowReorderModal(false)}>
                <i className="ti ti-x" />
              </button>
            </div>
            <form className="modal-form" onSubmit={handleSaveReorder}>
              <p style={{ fontSize: 12, color: '#8A8FA3', marginBottom: 14 }}>
                You'll get a low stock alert when stock falls to or below this level.
              </p>
              {stock.map(s => (
                <div className="modal-field" key={s.id}>
                  <label>{s.product} (boxes)</label>
                  <input
                    type="number" min="0"
                    value={reorderForm[s.id] || ''}
                    onChange={e => setReorderForm({ ...reorderForm, [s.id]: e.target.value })}
                    placeholder="e.g. 50"
                  />
                </div>
              ))}
              <div className="modal-footer">
                <button type="button" className="modal-cancel" onClick={() => setShowReorderModal(false)}>Cancel</button>
                <button type="submit" className="modal-submit" disabled={saving}>
                  {saving ? <span className="btn-spinner" /> : <i className="ti ti-check" />}
                  Save Levels
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="stock-toast">
          <i className="ti ti-circle-check" />
          {toast}
        </div>
      )}
    </div>
  );
}
