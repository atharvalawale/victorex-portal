import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import Topbar from '../../components/Topbar/Topbar';
import { supabase } from '../../lib/supabase';
import './Purchases.css';

const UNITS = ['kg', 'ltr', 'g', 'ml', 'pieces', 'bags', 'drums', 'boxes'];
const STATUS_OPTIONS = ['received', 'pending', 'partial'];
const STATUS_STYLE = {
  received: { background: 'rgba(45,157,110,0.12)',  color: '#165c3a' },
  pending:  { background: 'rgba(232,184,75,0.12)',  color: '#8a5a00' },
  partial:  { background: 'rgba(58,143,212,0.12)',  color: '#1a4a7a' },
};

const EMPTY_ITEM = { material_name: '', qty: '', unit: UNITS[0], rate: '' };

export default function Purchases() {
  const [sidebarOpen, setSidebarOpen]     = useState(false);
  const [purchases, setPurchases]         = useState([]);
  const [suppliers, setSuppliers]         = useState([]);
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [showModal, setShowModal]         = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewPurchase, setViewPurchase]   = useState(null);
  const [viewItems, setViewItems]         = useState([]);
  const [supplierName, setSupplierName]   = useState('');
  const [purchaseDate, setPurchaseDate]   = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes]                 = useState('');
  const [status, setStatus]               = useState('received');
  const [items, setItems]                 = useState([{ ...EMPTY_ITEM }]);
  const [errors, setErrors]               = useState({});
  const [editId, setEditId]               = useState(null);
  const [showDeleteId, setShowDeleteId]   = useState(null);
  const [search, setSearch]               = useState('');
  const [toast, setToast]                 = useState('');

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [p, s] = await Promise.all([
      supabase.from('purchases').select('*').order('created_at', { ascending: false }),
      supabase.from('suppliers').select('name, location').eq('status', 'active').order('name'),
    ]);
    setPurchases(p.data || []);
    setSuppliers(s.data || []);
    setLoading(false);
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  const filtered = purchases.filter(p =>
    (p.supplier_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.purchase_number || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalAmt = filtered.reduce((s, p) => s + Number(p.total_amount || 0), 0);

  function updateItem(index, fields) {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, ...fields } : item));
  }

  function addItem() { setItems(prev => [...prev, { ...EMPTY_ITEM }]); }
  function removeItem(index) { if (items.length > 1) setItems(prev => prev.filter((_, i) => i !== index)); }

  const orderTotal = items.reduce((s, item) => s + (Number(item.qty || 0) * Number(item.rate || 0)), 0);

  function validate() {
    const e = {};
    if (!supplierName) e.supplier = 'Supplier required';
    items.forEach((item, i) => {
      if (!item.material_name.trim()) e[`name_${i}`] = 'Material name required';
      if (!item.qty || Number(item.qty) <= 0) e[`qty_${i}`] = 'Valid qty required';
      if (!item.rate || Number(item.rate) <= 0) e[`rate_${i}`] = 'Valid rate required';
    });
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSaving(true);

    const total = items.reduce((s, item) => s + Number(item.qty) * Number(item.rate), 0);

    if (editId) {
      await supabase.from('purchases').update({ supplier_name: supplierName, date: purchaseDate, notes, status, total_amount: total }).eq('id', editId);
      await supabase.from('purchase_items').delete().eq('purchase_id', editId);
      await supabase.from('purchase_items').insert(items.map(item => ({ purchase_id: editId, material_name: item.material_name, qty: Number(item.qty), unit: item.unit, rate: Number(item.rate), amount: Number(item.qty) * Number(item.rate) })));
      showToast('Purchase updated ✓');
    } else {
      const purchaseNumber = `PUR-${String(purchases.length + 1).padStart(3, '0')}`;
      const { data: newPurchase } = await supabase.from('purchases').insert({ purchase_number: purchaseNumber, supplier_name: supplierName, date: purchaseDate, notes, status, total_amount: total }).select().single();
      if (newPurchase) {
        await supabase.from('purchase_items').insert(items.map(item => ({ purchase_id: newPurchase.id, material_name: item.material_name, qty: Number(item.qty), unit: item.unit, rate: Number(item.rate), amount: Number(item.qty) * Number(item.rate) })));
      }
      showToast('Purchase added ✓');
    }

    setSaving(false);
    setShowModal(false);
    resetForm();
    fetchAll();
  }

  function resetForm() {
    setSupplierName(''); setPurchaseDate(new Date().toISOString().split('T')[0]);
    setNotes(''); setStatus('received'); setItems([{ ...EMPTY_ITEM }]);
    setEditId(null); setErrors({});
  }

  async function handleView(purchase) {
    setViewPurchase(purchase);
    const { data } = await supabase.from('purchase_items').select('*').eq('purchase_id', purchase.id);
    setViewItems(data || []);
    setShowViewModal(true);
  }

  async function handleEdit(purchase) {
    const { data: existingItems } = await supabase.from('purchase_items').select('*').eq('purchase_id', purchase.id);
    setSupplierName(purchase.supplier_name);
    setPurchaseDate(purchase.date);
    setNotes(purchase.notes || '');
    setStatus(purchase.status);
    setEditId(purchase.id);
    setItems(existingItems?.length > 0 ? existingItems.map(item => ({ material_name: item.material_name, qty: String(item.qty), unit: item.unit, rate: String(item.rate) })) : [{ ...EMPTY_ITEM }]);
    setErrors({});
    setShowModal(true);
  }

  async function handleDelete(id) {
    await supabase.from('purchase_items').delete().eq('purchase_id', id);
    await supabase.from('purchases').delete().eq('id', id);
    showToast('Purchase deleted'); fetchAll(); setShowDeleteId(null);
  }

  const fmtAmt  = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;
  const fmtDate = d => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });

  return (
    <div className="purchases-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="purchases-main">
        <Topbar title="Purchases" onMenuClick={() => setSidebarOpen(true)} />
        <div className="purchases-content">

          <div className="purchases-header">
            <div>
              <h2 className="purchases-title">Purchase Management</h2>
              <p className="purchases-sub">{loading ? 'Loading...' : `${filtered.length} purchases · Total ${fmtAmt(totalAmt)}`}</p>
            </div>
            <button className="purchases-add-btn" onClick={() => { resetForm(); setShowModal(true); }}>
              <i className="ti ti-plus" /> New Purchase
            </button>
          </div>

          <div className="purchases-search-wrap">
            <i className="ti ti-search" />
            <input className="purchases-search" placeholder="Search supplier, purchase ID..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div className="purchases-table-wrap">
            {loading ? (
              <div className="purchases-loading"><div className="purchases-spinner" /> Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="purchases-empty"><i className="ti ti-shopping-bag" /><span>No purchases yet</span></div>
            ) : (
              <table className="purchases-table">
                <thead>
                  <tr>
                    <th>Purchase ID</th>
                    <th>Supplier</th>
                    <th>Total Amount</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id}>
                      <td><span className="purchases-id">{p.purchase_number}</span></td>
                      <td><div className="purchases-supplier">{p.supplier_name}</div></td>
                      <td><strong>{fmtAmt(p.total_amount)}</strong></td>
                      <td className="purchases-date">{fmtDate(p.date)}</td>
                      <td><span className="purchases-status" style={STATUS_STYLE[p.status]}>{p.status.charAt(0).toUpperCase() + p.status.slice(1)}</span></td>
                      <td>
                        <div className="purchases-actions">
                          <button className="purchases-action-btn view" onClick={() => handleView(p)}><i className="ti ti-eye" /></button>
                          <button className="purchases-action-btn edit" onClick={() => handleEdit(p)}><i className="ti ti-pencil" /></button>
                          <button className="purchases-action-btn delete" onClick={() => setShowDeleteId(p.id)}><i className="ti ti-trash" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* New/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card modal-xl" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editId ? 'Edit Purchase' : 'New Purchase'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><i className="ti ti-x" /></button>
            </div>
            <form className="modal-form" onSubmit={handleSubmit}>
              <div className="modal-row">
                <div className="modal-field">
                  <label>Supplier *</label>
                  <select value={supplierName} onChange={e => setSupplierName(e.target.value)} className={errors.supplier ? 'error' : ''}>
                    <option value="">Select supplier...</option>
                    {suppliers.map(s => <option key={s.name} value={s.name}>{s.name} — {s.location}</option>)}
                  </select>
                  {errors.supplier && <span className="modal-error">{errors.supplier}</span>}
                </div>
                <div className="modal-row" style={{ gap:8 }}>
                  <div className="modal-field">
                    <label>Date</label>
                    <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
                  </div>
                  <div className="modal-field">
                    <label>Status</label>
                    <select value={status} onChange={e => setStatus(e.target.value)}>
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="purchases-items-section">
                <div className="purchases-items-hdr">
                  <span className="purchases-items-title">Materials Purchased</span>
                  <button type="button" className="purchases-add-item-btn" onClick={addItem}><i className="ti ti-plus" /> Add Item</button>
                </div>
                <div className="purchases-item-header">
                  <div>Material Name</div>
                  <div>Qty</div>
                  <div>Unit</div>
                  <div>Rate (₹)</div>
                  <div>Amount</div>
                  <div></div>
                </div>
                {items.map((item, index) => (
                  <div key={index} className="purchases-item-row">
                    <div className="purchases-item-field">
                      <input placeholder="e.g. Titanium Dioxide" value={item.material_name} onChange={e => updateItem(index, { material_name: e.target.value })} className={errors[`name_${index}`] ? 'error' : ''} />
                    </div>
                    <div className="purchases-item-field">
                      <input type="number" min="0" placeholder="Qty" value={item.qty} onChange={e => updateItem(index, { qty: e.target.value })} className={errors[`qty_${index}`] ? 'error' : ''} />
                    </div>
                    <div className="purchases-item-field">
                      <select value={item.unit} onChange={e => updateItem(index, { unit: e.target.value })}>
                        {UNITS.map(u => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                    <div className="purchases-item-field">
                      <input type="number" min="0" placeholder="Rate" value={item.rate} onChange={e => updateItem(index, { rate: e.target.value })} className={errors[`rate_${index}`] ? 'error' : ''} />
                    </div>
                    <div className="purchases-item-amount">
                      {item.qty && item.rate ? fmtAmt(Number(item.qty) * Number(item.rate)) : '—'}
                    </div>
                    <button type="button" className="purchases-remove-btn" onClick={() => removeItem(index)} disabled={items.length === 1}><i className="ti ti-trash" /></button>
                  </div>
                ))}
                <div className="purchases-items-total">
                  <span>Total:</span>
                  <strong>{fmtAmt(orderTotal)}</strong>
                </div>
              </div>

              <div className="modal-field" style={{ marginTop:14 }}>
                <label>Notes</label>
                <input placeholder="Any notes..." value={notes} onChange={e => setNotes(e.target.value)} />
              </div>

              <div className="modal-footer">
                <button type="button" className="modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="modal-submit" disabled={saving}>
                  {saving ? <span className="btn-spinner" /> : <i className="ti ti-check" />}
                  {editId ? 'Save Changes' : 'Save Purchase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && viewPurchase && (
        <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="modal-card modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Purchase — {viewPurchase.purchase_number}</h3>
              <button className="modal-close" onClick={() => setShowViewModal(false)}><i className="ti ti-x" /></button>
            </div>
            <div style={{ padding:'16px 20px' }}>
              <div style={{ display:'flex', gap:20, marginBottom:16, fontSize:13 }}>
                <div><div style={{ color:'#8A8FA3', fontSize:11, marginBottom:2 }}>SUPPLIER</div><div style={{ fontWeight:700, color:'#0B1F3A' }}>{viewPurchase.supplier_name}</div></div>
                <div><div style={{ color:'#8A8FA3', fontSize:11, marginBottom:2 }}>DATE</div><div style={{ fontWeight:600, color:'#0B1F3A' }}>{fmtDate(viewPurchase.date)}</div></div>
                <div><div style={{ color:'#8A8FA3', fontSize:11, marginBottom:2 }}>STATUS</div><span className="purchases-status" style={STATUS_STYLE[viewPurchase.status]}>{viewPurchase.status}</span></div>
              </div>
              <table className="purchases-view-table">
                <thead><tr><th>#</th><th>Material</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th></tr></thead>
                <tbody>
                  {viewItems.map((item, i) => (
                    <tr key={item.id}>
                      <td>{i+1}</td><td>{item.material_name}</td><td>{item.qty}</td><td>{item.unit}</td><td>{fmtAmt(item.rate)}</td><td><strong>{fmtAmt(item.amount)}</strong></td>
                    </tr>
                  ))}
                  <tr style={{ background:'#F4F5F9' }}>
                    <td colSpan={5} style={{ textAlign:'right', fontWeight:700, padding:'10px 12px' }}>Total</td>
                    <td style={{ padding:'10px 12px' }}><strong style={{ color:'#C9922A', fontSize:15 }}>{fmtAmt(viewPurchase.total_amount)}</strong></td>
                  </tr>
                </tbody>
              </table>
              {viewPurchase.notes && <div style={{ marginTop:12, padding:'10px 14px', background:'#F4F5F9', borderRadius:8, fontSize:13, color:'#5A5F72' }}><strong>Notes:</strong> {viewPurchase.notes}</div>}
            </div>
          </div>
        </div>
      )}

      {showDeleteId && (
        <div className="modal-overlay" onClick={() => setShowDeleteId(null)}>
          <div className="modal-card modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3 className="modal-title">Delete Purchase?</h3><button className="modal-close" onClick={() => setShowDeleteId(null)}><i className="ti ti-x" /></button></div>
            <p className="modal-confirm-text">This will delete the purchase and all its items.</p>
            <div className="modal-footer">
              <button className="modal-cancel" onClick={() => setShowDeleteId(null)}>Cancel</button>
              <button className="modal-delete" onClick={() => handleDelete(showDeleteId)}><i className="ti ti-trash" /> Delete</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="purchases-toast"><i className="ti ti-circle-check" />{toast}</div>}
    </div>
  );
}