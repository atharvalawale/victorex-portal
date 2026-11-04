import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import Topbar from '../../components/Topbar/Topbar';
import { supabase } from '../../lib/supabase';
import './Orders.css';

const STATUS_OPTIONS = ['pending', 'processing', 'delivered', 'cancelled'];

const STATUS_STYLE = {
  pending:    { background: 'rgba(233,146,104,0.12)',  color: '#126B64' },
  processing: { background: 'rgba(58,143,212,0.12)',  color: '#1a4a7a' },
  delivered:  { background: 'rgba(45,157,110,0.12)',  color: '#165c3a' },
  cancelled:  { background: 'rgba(216,90,48,0.12)',   color: '#7a2010' },
};

const EMPTY_ITEM = {
  product: '', pack_size: '', unit: '', qty: '', rate: '',
};

export default function Orders() {
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [orders, setOrders]             = useState([]);
  const [payments, setPayments]         = useState([]);
  const [dealers, setDealers]           = useState([]);
  const [packSizes, setPackSizes]       = useState([]);
  const [dealerPrices, setDealerPrices] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [showModal, setShowModal]       = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewOrder, setViewOrder]       = useState(null);
  const [viewItems, setViewItems]       = useState([]);
  const [dealerName, setDealerName]     = useState('');
  const [location, setLocation]         = useState('');
  const [orderDate, setOrderDate]       = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes]               = useState('');
  const [items, setItems]               = useState([{ ...EMPTY_ITEM }]);
  const [errors, setErrors]             = useState({});
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch]             = useState('');
  const [editId, setEditId]             = useState(null);
  const [showDeleteId, setShowDeleteId] = useState(null);
  const [toast, setToast]               = useState('');

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [o, d, ps, dp, p] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('dealers').select('name, location').eq('status', 'active').order('name'),
      supabase.from('pack_sizes').select('*').order('product'),
      supabase.from('dealer_prices').select('*'),
      supabase.from('payments').select('id, order_id, amount, date').not('order_id', 'is', null),
    ]);
    setOrders(o.data        || []);
    setDealers(d.data       || []);
    setPackSizes(ps.data    || []);
    const firstProduct = (ps.data || [])[0]?.product || '';
    if (firstProduct) setItems(current => current[0]?.product ? current : [{ ...EMPTY_ITEM, product: firstProduct }]);
    setDealerPrices(dp.data || []);
    setPayments(p.data || []);
    setLoading(false);
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  function getSizesForProduct(product) {
    return packSizes.filter(ps => ps.product === product);
  }

  const productOptions = [...new Set(packSizes.map(row => row.product).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  function getAutoRate(dealer, product, pack_size, unit) {
    const price = dealerPrices.find(dp =>
      dp.dealer_name === dealer &&
      dp.product     === product &&
      dp.pack_size   === pack_size &&
      dp.unit        === unit
    );
    return price ? String(price.rate) : '';
  }

  /* ── Item helpers ── */
  function handleItemProductChange(index, product) {
    const sizes   = getSizesForProduct(product);
    const first   = sizes[0] || null;
    const pack_size = first?.size || '';
    const unit      = first?.unit || '';
    const rate      = dealerName ? getAutoRate(dealerName, product, pack_size, unit) : '';
    updateItem(index, { product, pack_size, unit, rate });
  }

  function handleItemSizeChange(index, sizeStr) {
    const [pack_size, unit] = sizeStr.split('__');
    const rate = dealerName ? getAutoRate(dealerName, items[index].product, pack_size, unit) : '';
    updateItem(index, { pack_size, unit, rate });
  }

  function updateItem(index, fields) {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, ...fields } : item));
  }

  function addItem() {
    const firstProduct = productOptions[0] || '';
    const sizes = getSizesForProduct(firstProduct);
    const first = sizes[0] || null;
    setItems(prev => [...prev, {
      ...EMPTY_ITEM,
      product: firstProduct,
      pack_size: first?.size || '',
      unit:      first?.unit || '',
    }]);
  }

  function removeItem(index) {
    if (items.length === 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  }

  /* ── Handle dealer change ── */
  function handleDealerChange(name) {
    const dealer = dealers.find(d => d.name === name);
    setDealerName(name);
    setLocation(dealer?.location || '');
    setItems(prev => prev.map(item => ({
      ...item,
      rate: item.pack_size ? getAutoRate(name, item.product, item.pack_size, item.unit) : '',
    })));
  }

  /* ── Total ── */
  const orderTotal = items.reduce((s, item) => {
    const amt = Number(item.qty || 0) * Number(item.rate || 0);
    return s + amt;
  }, 0);

  /* ── Filtered orders ── */
  const filtered = orders.filter(o => {
    const matchStatus = filterStatus === 'all' || o.status === filterStatus;
    const matchSearch =
      (o.dealer_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (o.location || '').toLowerCase().includes(search.toLowerCase()) ||
      (o.order_number || '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  /* ── Validate ── */
  function validate() {
    const e = {};
    if (!dealerName) e.dealer = 'Dealer required';
    items.forEach((item, i) => {
      if (!item.pack_size) e[`pack_size_${i}`] = 'Select pack size';
      if (!item.qty || Number(item.qty) <= 0) e[`qty_${i}`] = 'Valid qty required';
      if (!item.rate || Number(item.rate) <= 0) e[`rate_${i}`] = 'Valid rate required';
    });
    return e;
  }

  /* ── Submit ── */
  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSaving(true);

    const total = items.reduce((s, item) => s + Number(item.qty) * Number(item.rate), 0);

    if (editId) {
      const { error: orderError } = await supabase.from('orders').update({
        dealer_name:   dealerName,
        location,
        notes,
        total_amount:  total,
        date:          orderDate,
        product:       items[0].product,
        pack_size:     items[0].pack_size,
        unit:          items[0].unit,
        qty:           Number(items[0].qty),
        rate:          Number(items[0].rate),
        amount:        Number(items[0].qty) * Number(items[0].rate),
      }).eq('id', editId);
      if (orderError) {
        setSaving(false);
        showToast(`Could not update order: ${orderError.message}`);
        return;
      }

      await supabase.from('order_items').delete().eq('order_id', editId);
      const { error: itemsError } = await supabase.from('order_items').insert(
        items.map(item => ({
          order_id:  editId,
          product:   item.product,
          pack_size: item.pack_size,
          unit:      item.unit,
          qty:       Number(item.qty),
          rate:      Number(item.rate),
          amount:    Number(item.qty) * Number(item.rate),
        }))
      );
      if (itemsError) {
        setSaving(false);
        showToast(`Order saved, but items could not be saved: ${itemsError.message}`);
        return;
      }

      showToast('Order updated ✓');
    } else {
      const orderNumber = `ORD-${String(orders.length + 1).padStart(3, '0')}`;
      const { data: newOrder, error: orderError } = await supabase.from('orders').insert({
        order_number:  orderNumber,
        dealer_name:   dealerName,
        location,
        notes,
        status:        'pending',
        date:          orderDate,
        total_amount:  total,
        product:       items[0].product,
        pack_size:     items[0].pack_size,
        unit:          items[0].unit,
        qty:           Number(items[0].qty),
        rate:          Number(items[0].rate),
        amount:        Number(items[0].qty) * Number(items[0].rate),
      }).select().single();

      if (orderError || !newOrder) {
        setSaving(false);
        showToast(`Could not place order: ${orderError?.message || 'Order was not created'}`);
        return;
      }

      if (newOrder) {
        const { error: itemsError } = await supabase.from('order_items').insert(
          items.map(item => ({
            order_id:  newOrder.id,
            product:   item.product,
            pack_size: item.pack_size,
            unit:      item.unit,
            qty:       Number(item.qty),
            rate:      Number(item.rate),
            amount:    Number(item.qty) * Number(item.rate),
          }))
        );
        if (itemsError) {
          setSaving(false);
          showToast(`Order created, but its items could not be saved: ${itemsError.message}`);
          return;
        }
      }

      showToast('Order placed ✓');
    }

    setSaving(false);
    setShowModal(false);
    resetForm();
    fetchAll();
  }

  function resetForm() {
    setDealerName('');
    setLocation('');
    setNotes('');
    setOrderDate(new Date().toISOString().split('T')[0]);
    const firstProduct = productOptions[0] || '';
    const sizes = getSizesForProduct(firstProduct);
    const first = sizes[0] || null;
    setItems([{ ...EMPTY_ITEM, product: firstProduct, pack_size: first?.size || '', unit: first?.unit || '' }]);
    setEditId(null);
    setErrors({});
  }

  /* ── View order details ── */
  async function handleView(order) {
    setViewOrder(order);
    const { data } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);
    setViewItems(data || []);
    setShowViewModal(true);
  }

  /* ── Edit ── */
  async function handleEdit(order) {
    const { data: existingItems } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);

    setDealerName(order.dealer_name);
    setLocation(order.location || '');
    setNotes(order.notes || '');
    setOrderDate(order.date || new Date().toISOString().split('T')[0]);
    setEditId(order.id);

    if (existingItems && existingItems.length > 0) {
      setItems(existingItems.map(item => ({
        product:   item.product,
        pack_size: item.pack_size,
        unit:      item.unit,
        qty:       String(item.qty),
        rate:      String(item.rate),
      })));
    } else {
      setItems([{
        product:   order.product,
        pack_size: order.pack_size || '',
        unit:      order.unit || '',
        qty:       String(order.qty),
        rate:      String(order.rate),
      }]);
    }

    setErrors({});
    setShowModal(true);
  }

  /* ── Delete ── */
  async function handleDelete(id) {
    await supabase.from('order_items').delete().eq('order_id', id);
    await supabase.from('orders').delete().eq('id', id);
    showToast('Order deleted');
    fetchAll();
    setShowDeleteId(null);
  }

  /* ── Status change ── */
  async function handleStatusChange(id, status) {
    await supabase.from('orders').update({ status }).eq('id', id);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
  }

  const fmtAmt  = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;
  const fmtDate = d => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  function getPaymentSummary(order) {
    const total = Number(order.total_amount || order.amount || 0);
    const received = payments.filter(payment => payment.order_id === order.id)
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const due = Math.max(total - received, 0);
    return { total, received, due, status: received <= 0 ? 'unpaid' : due <= 0 ? 'paid' : 'part-paid' };
  }
  const totalAmt = filtered.reduce((s, o) => s + Number(o.total_amount || o.amount || 0), 0);

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
            <button type="button" className="orders-add-btn" onClick={() => { resetForm(); setShowModal(true); }}>
              <i className="ti ti-plus" /> New Order
            </button>
          </div>

          {/* Filters */}
          <div className="orders-filters">
            <div className="orders-search-wrap">
              <i className="ti ti-search" />
              <input
                className="orders-search"
                placeholder="Search dealer, order ID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="orders-status-filters">
              {['all', ...STATUS_OPTIONS].map(s => (
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
              <div className="orders-loading"><div className="orders-spinner" /> Loading orders...</div>
            ) : (
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Dealer</th>
                    <th>Items</th>
                    <th>Total Amount</th>
                    <th>Payment</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="orders-empty">
                        <i className="ti ti-inbox" />
                        <span>No orders yet — click New Order to add one</span>
                      </td>
                    </tr>
                  ) : filtered.map(o => {
                    const payment = getPaymentSummary(o);
                    return (
                    <tr key={o.id}>
                      <td><span className="orders-id">{o.order_number}</span></td>
                      <td>
                        <div className="orders-dealer-name">{o.dealer_name}</div>
                        <div className="orders-dealer-loc">{o.location}</div>
                      </td>
                      <td>
                        <div className="orders-items-preview">
                          <span className="orders-pack-badge">{o.product}</span>
                          <span style={{ fontSize:11, color:'#8A8FA3' }}>+ more</span>
                        </div>
                      </td>
                      <td><strong>{fmtAmt(o.total_amount || o.amount)}</strong></td>
                      <td>
                        <span className={`orders-payment-badge ${payment.status}`}>
                          <i className={`ti ${payment.status === 'paid' ? 'ti-circle-check' : payment.status === 'part-paid' ? 'ti-clock' : 'ti-circle-dashed'}`} />
                          {payment.status === 'paid' ? 'Paid' : payment.status === 'part-paid' ? 'Part-paid' : 'Unpaid'}
                        </span>
                        {payment.received > 0 && payment.status !== 'paid' && (
                          <div className="orders-payment-detail">{fmtAmt(payment.received)} received</div>
                        )}
                      </td>
                      <td className="orders-date">{fmtDate(o.date)}</td>
                      <td>
                        <select
                          className="orders-status-select"
                          value={o.status}
                          onChange={e => handleStatusChange(o.id, e.target.value)}
                          style={STATUS_STYLE[o.status]}
                        >
                          {STATUS_OPTIONS.map(s => (
                            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div className="orders-actions">
                          <button className="orders-action-btn view" onClick={() => handleView(o)} title="View items">
                            <i className="ti ti-eye" />
                          </button>
                          <button className="orders-action-btn edit" onClick={() => handleEdit(o)} title="Edit">
                            <i className="ti ti-pencil" />
                          </button>
                          <button className="orders-action-btn delete" onClick={() => setShowDeleteId(o.id)} title="Delete">
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

      {/* New/Edit Order Modal */}
      {showModal && (
        <div className="modal-overlay orders-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card modal-xl orders-modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editId ? 'Edit Order' : 'New Order'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <i className="ti ti-x" />
              </button>
            </div>

            <form className="modal-form" onSubmit={handleSubmit}>

              {/* Dealer + Date */}
              <div className="modal-row">
                <div className="modal-field">
                  <label>Dealer *</label>
                  <select
                    value={dealerName}
                    onChange={e => handleDealerChange(e.target.value)}
                    className={errors.dealer ? 'error' : ''}
                  >
                    <option value="">Select dealer...</option>
                    {dealers.map(d => (
                      <option key={d.name} value={d.name}>{d.name} — {d.location}</option>
                    ))}
                  </select>
                  {errors.dealer && <span className="modal-error">{errors.dealer}</span>}
                </div>
                <div className="modal-field">
                  <label>Order Date</label>
                  <input
                    type="date"
                    value={orderDate}
                    onChange={e => setOrderDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Items */}
              <div className="orders-items-section">
                <div className="orders-items-hdr">
                  <span className="orders-items-title">Order Items</span>
                  <button type="button" className="orders-add-item-btn" onClick={addItem}>
                    <i className="ti ti-plus" /> Add Item
                  </button>
                </div>

                {/* Header row */}
                <div className="orders-item-header">
                  <div>Product</div>
                  <div>Pack Size</div>
                  <div>Qty</div>
                  <div>Rate (₹)</div>
                  <div>Amount</div>
                  <div></div>
                </div>

                {items.map((item, index) => (
                  <div key={index} className="orders-item-row">
                    {/* Product */}
                    <div className="orders-item-field">
                      <select
                        value={item.product}
                        onChange={e => handleItemProductChange(index, e.target.value)}
                      >
                        {productOptions.map(p => <option key={p}>{p}</option>)}
                      </select>
                    </div>

                    {/* Pack size */}
                    <div className="orders-item-field">
                      <select
                        value={`${item.pack_size}__${item.unit}`}
                        onChange={e => handleItemSizeChange(index, e.target.value)}
                        className={errors[`pack_size_${index}`] ? 'error' : ''}
                      >
                        <option value="__">Size...</option>
                        {getSizesForProduct(item.product).map(ps => (
                          <option key={`${ps.size}__${ps.unit}`} value={`${ps.size}__${ps.unit}`}>
                            {ps.size} {ps.unit}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Qty */}
                    <div className="orders-item-field">
                      <input
                        type="number" min="1"
                        placeholder="Qty"
                        value={item.qty}
                        onChange={e => updateItem(index, { qty: e.target.value })}
                        className={errors[`qty_${index}`] ? 'error' : ''}
                      />
                    </div>

                    {/* Rate */}
                    <div className="orders-item-field">
                      <input
                        type="number" min="0"
                        placeholder="Rate"
                        value={item.rate}
                        onChange={e => updateItem(index, { rate: e.target.value })}
                        className={errors[`rate_${index}`] ? 'error' : ''}
                      />
                      {item.rate && dealerName && (
                        <span className="orders-auto-rate">✓ auto</span>
                      )}
                    </div>

                    {/* Amount */}
                    <div className="orders-item-amount">
                      {item.qty && item.rate
                        ? fmtAmt(Number(item.qty) * Number(item.rate))
                        : '—'
                      }
                    </div>

                    {/* Remove */}
                    <div>
                      <button
                        type="button"
                        className="orders-remove-item-btn"
                        onClick={() => removeItem(index)}
                        disabled={items.length === 1}
                      >
                        <i className="ti ti-trash" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Total row */}
                <div className="orders-items-total">
                  <span>Order Total:</span>
                  <strong>{fmtAmt(orderTotal)}</strong>
                </div>
              </div>

              {/* Notes */}
              <div className="modal-field" style={{ marginTop: 14 }}>
                <label>Notes (optional)</label>
                <input
                  placeholder="Any special instructions..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="modal-submit" disabled={saving}>
                  {saving ? <span className="btn-spinner" /> : <i className="ti ti-check" />}
                  {editId ? 'Save Changes' : 'Place Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Order Modal */}
      {showViewModal && viewOrder && (
        <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="modal-card modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Order — {viewOrder.order_number}</h3>
              <button className="modal-close" onClick={() => setShowViewModal(false)}>
                <i className="ti ti-x" />
              </button>
            </div>

            <div style={{ padding: '16px 20px' }}>
              <div style={{ display:'flex', gap:20, marginBottom:16, fontSize:13 }}>
                <div>
                  <div style={{ color:'#8A8FA3', fontSize:11, marginBottom:2 }}>DEALER</div>
                  <div style={{ fontWeight:700, color:'#16353B' }}>{viewOrder.dealer_name}</div>
                  <div style={{ color:'#8A8FA3', fontSize:12 }}>{viewOrder.location}</div>
                </div>
                <div>
                  <div style={{ color:'#8A8FA3', fontSize:11, marginBottom:2 }}>DATE</div>
                  <div style={{ fontWeight:600, color:'#16353B' }}>{fmtDate(viewOrder.date)}</div>
                </div>
                <div>
                  <div style={{ color:'#8A8FA3', fontSize:11, marginBottom:2 }}>STATUS</div>
                  <span className="status-badge" style={STATUS_STYLE[viewOrder.status]}>
                    {viewOrder.status.charAt(0).toUpperCase() + viewOrder.status.slice(1)}
                  </span>
                </div>
              </div>

              {(() => {
                const payment = getPaymentSummary(viewOrder);
                return (
                  <div className={`orders-payment-summary ${payment.status}`}>
                    <div>
                      <span className="orders-payment-summary-title">Payment received</span>
                      <strong>{fmtAmt(payment.received)} <small>of {fmtAmt(payment.total)}</small></strong>
                    </div>
                    <div className="orders-payment-summary-right">
                      <span className={`orders-payment-badge ${payment.status}`}>
                        {payment.status === 'paid' ? 'Paid' : payment.status === 'part-paid' ? 'Part-paid' : 'Unpaid'}
                      </span>
                      {payment.due > 0 && <small>{fmtAmt(payment.due)} remaining</small>}
                    </div>
                  </div>
                );
              })()}

              <table className="orders-view-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th>Pack Size</th>
                    <th>Qty</th>
                    <th>Rate</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {viewItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign:'center', padding:'20px', color:'#8A8FA3', fontSize:13 }}>
                        No items found
                      </td>
                    </tr>
                  ) : viewItems.map((item, i) => (
                    <tr key={item.id}>
                      <td>{i + 1}</td>
                      <td>{item.product}</td>
                      <td><span className="orders-pack-badge">{item.pack_size} {item.unit}</span></td>
                      <td>{item.qty} units</td>
                      <td>{fmtAmt(item.rate)}</td>
                      <td><strong>{fmtAmt(item.amount)}</strong></td>
                    </tr>
                  ))}
                  <tr className="orders-view-total">
                    <td colSpan={5} style={{ textAlign:'right', fontWeight:700 }}>Total</td>
                    <td><strong style={{ color:'#17877C', fontSize:15 }}>{fmtAmt(viewOrder.total_amount || viewOrder.amount)}</strong></td>
                  </tr>
                </tbody>
              </table>

              {viewOrder.notes && (
                <div style={{ marginTop:12, padding:'10px 14px', background:'#F4F5F9', borderRadius:8, fontSize:13, color:'#5A5F72' }}>
                  <strong>Notes:</strong> {viewOrder.notes}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {showDeleteId && (
        <div className="modal-overlay" onClick={() => setShowDeleteId(null)}>
          <div className="modal-card modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Delete Order?</h3>
              <button className="modal-close" onClick={() => setShowDeleteId(null)}>
                <i className="ti ti-x" />
              </button>
            </div>
            <p className="modal-confirm-text">This will delete the order and all its items. Cannot be undone.</p>
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
        <div className="orders-toast">
          <i className="ti ti-circle-check" />{toast}
        </div>
      )}
    </div>
  );
}
