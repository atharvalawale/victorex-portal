import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import Topbar from '../../components/Topbar/Topbar';
import { supabase } from '../../lib/supabase';
import './Suppliers.css';

const EMPTY_FORM = {
  name: '', location: '', phone: '', email: '',
  gst_number: '', materials: '', notes: '', status: 'active',
};

export default function Suppliers() {
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [suppliers, setSuppliers]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [showModal, setShowModal]       = useState(false);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [errors, setErrors]             = useState({});
  const [editId, setEditId]             = useState(null);
  const [showDeleteId, setShowDeleteId] = useState(null);
  const [search, setSearch]             = useState('');
  const [toast, setToast]               = useState('');

  useEffect(() => { fetchSuppliers(); }, []);

  async function fetchSuppliers() {
    setLoading(true);
    const { data } = await supabase.from('suppliers').select('*').order('name');
    setSuppliers(data || []);
    setLoading(false);
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.location || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.materials || '').toLowerCase().includes(search.toLowerCase())
  );

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Supplier name required';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSaving(true);

    const payload = {
      name: form.name, location: form.location,
      phone: form.phone, email: form.email,
      gst_number: form.gst_number, materials: form.materials,
      notes: form.notes, status: form.status,
    };

    if (editId) {
      const { error } = await supabase.from('suppliers').update(payload).eq('id', editId);
      if (!error) { showToast('Supplier updated ✓'); fetchSuppliers(); }
    } else {
      const { error } = await supabase.from('suppliers').insert(payload);
      if (!error) { showToast('Supplier added ✓'); fetchSuppliers(); }
    }

    setSaving(false);
    setShowModal(false);
    setForm(EMPTY_FORM);
    setEditId(null);
  }

  function handleEdit(s) {
    setForm({
      name: s.name, location: s.location || '',
      phone: s.phone || '', email: s.email || '',
      gst_number: s.gst_number || '', materials: s.materials || '',
      notes: s.notes || '', status: s.status,
    });
    setEditId(s.id);
    setShowModal(true);
  }

  async function handleDelete(id) {
    await supabase.from('suppliers').delete().eq('id', id);
    showToast('Supplier deleted');
    fetchSuppliers();
    setShowDeleteId(null);
  }

  async function handleToggle(s) {
    const status = s.status === 'active' ? 'inactive' : 'active';
    await supabase.from('suppliers').update({ status }).eq('id', s.id);
    setSuppliers(prev => prev.map(x => x.id === s.id ? { ...x, status } : x));
  }

  const getInitials = n => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="suppliers-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="suppliers-main">
        <Topbar title="Suppliers" onMenuClick={() => setSidebarOpen(true)} />
        <div className="suppliers-content">

          <div className="suppliers-header">
            <div>
              <h2 className="suppliers-title">Supplier Management</h2>
              <p className="suppliers-sub">{loading ? 'Loading...' : `${filtered.length} suppliers · ${suppliers.filter(s => s.status === 'active').length} active`}</p>
            </div>
            <button className="suppliers-add-btn" onClick={() => { setForm(EMPTY_FORM); setEditId(null); setErrors({}); setShowModal(true); }}>
              <i className="ti ti-plus" /> Add Supplier
            </button>
          </div>

          <div className="suppliers-search-wrap">
            <i className="ti ti-search" />
            <input
              className="suppliers-search"
              placeholder="Search name, location, materials..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="suppliers-loading"><div className="suppliers-spinner" /> Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="suppliers-empty">
              <i className="ti ti-truck" />
              <span>No suppliers yet — add your first supplier</span>
            </div>
          ) : (
            <div className="suppliers-grid">
              {filtered.map(s => (
                <div key={s.id} className={`supplier-card${s.status === 'inactive' ? ' inactive' : ''}`}>
                  <div className="supplier-card-top">
                    <div className="supplier-avatar">{getInitials(s.name)}</div>
                    <div className="supplier-info">
                      <div className="supplier-name">{s.name}</div>
                      {s.location && <div className="supplier-loc"><i className="ti ti-map-pin" />{s.location}</div>}
                    </div>
                    <span className={`supplier-status ${s.status}`}>{s.status}</span>
                  </div>

                  {s.materials && (
                    <div className="supplier-materials">
                      <i className="ti ti-package" />
                      <span>{s.materials}</span>
                    </div>
                  )}

                  <div className="supplier-meta">
                    {s.phone && <div className="supplier-meta-row"><i className="ti ti-phone" />{s.phone}</div>}
                    {s.email && <div className="supplier-meta-row"><i className="ti ti-mail" />{s.email}</div>}
                    {s.gst_number && <div className="supplier-meta-row"><i className="ti ti-file-text" />GST: {s.gst_number}</div>}
                  </div>

                  {s.notes && <div className="supplier-notes">{s.notes}</div>}

                  <div className="supplier-footer">
                    <div className="supplier-actions">
                      <button className="supplier-btn edit" onClick={() => handleEdit(s)}><i className="ti ti-pencil" /></button>
                      <button className="supplier-btn toggle" onClick={() => handleToggle(s)}>
                        <i className={`ti ${s.status === 'active' ? 'ti-player-pause' : 'ti-player-play'}`} />
                      </button>
                      <button className="supplier-btn delete" onClick={() => setShowDeleteId(s.id)}><i className="ti ti-trash" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editId ? 'Edit Supplier' : 'Add Supplier'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><i className="ti ti-x" /></button>
            </div>
            <form className="modal-form" onSubmit={handleSubmit}>
              <div className="modal-row">
                <div className="modal-field">
                  <label>Supplier Name *</label>
                  <input placeholder="e.g. Raj Chemicals" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={errors.name ? 'error' : ''} />
                  {errors.name && <span className="modal-error">{errors.name}</span>}
                </div>
                <div className="modal-field">
                  <label>Location</label>
                  <input placeholder="e.g. Mumbai" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
                </div>
              </div>
              <div className="modal-row">
                <div className="modal-field">
                  <label>Phone</label>
                  <input placeholder="e.g. 9876543210" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="modal-field">
                  <label>Email</label>
                  <input type="email" placeholder="e.g. raj@chemicals.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div className="modal-field">
                <label>What do you buy from them?</label>
                <input placeholder="e.g. White Cement, Titanium Dioxide, Resin" value={form.materials} onChange={e => setForm({ ...form, materials: e.target.value })} />
              </div>
              <div className="modal-field">
                <label>GST Number</label>
                <input placeholder="e.g. 27XXXXX1234X1ZX" value={form.gst_number} onChange={e => setForm({ ...form, gst_number: e.target.value })} />
              </div>
              <div className="modal-field">
                <label>Notes</label>
                <input placeholder="Any notes about this supplier..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="modal-footer">
                <button type="button" className="modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="modal-submit" disabled={saving}>
                  {saving ? <span className="btn-spinner" /> : <i className="ti ti-check" />}
                  {editId ? 'Save Changes' : 'Add Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteId && (
        <div className="modal-overlay" onClick={() => setShowDeleteId(null)}>
          <div className="modal-card modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Delete Supplier?</h3>
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

      {toast && <div className="suppliers-toast"><i className="ti ti-circle-check" />{toast}</div>}
    </div>
  );
}