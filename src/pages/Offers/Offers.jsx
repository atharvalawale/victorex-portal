import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import Topbar from '../../components/Topbar/Topbar';
import { supabase } from '../../lib/supabase';
import './Offers.css';

const PRODUCTS = ['WallVex Pro', 'Chromvex', 'Primvex', 'All Products'];

const EMPTY_FORM = {
  title: '', product: PRODUCTS[0], discount_pct: '',
  valid_from: '', valid_to: '', notes: '', status: 'active',
};

export default function Offers() {
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [offers, setOffers]             = useState([]);
  const [dealers, setDealers]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [showModal, setShowModal]       = useState(false);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [errors, setErrors]             = useState({});
  const [editId, setEditId]             = useState(null);
  const [showDeleteId, setShowDeleteId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [toast, setToast]               = useState('');
  const [selectedDealers, setSelectedDealers] = useState([]);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [o, d] = await Promise.all([
      supabase.from('offers').select('*').order('created_at', { ascending: false }),
      supabase.from('dealers').select('id, name, location').eq('status', 'active').order('name'),
    ]);
    setOffers(o.data  || []);
    setDealers(d.data || []);
    setLoading(false);
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  const today = new Date().toISOString().split('T')[0];

  function getOfferStatus(offer) {
    if (offer.status === 'inactive') return 'inactive';
    if (offer.valid_to < today)      return 'expired';
    if (offer.valid_from > today)    return 'upcoming';
    return 'active';
  }

  const filtered = offers.filter(o => {
    if (filterStatus === 'all') return true;
    return getOfferStatus(o) === filterStatus;
  });

  const activeCount   = offers.filter(o => getOfferStatus(o) === 'active').length;
  const expiredCount  = offers.filter(o => getOfferStatus(o) === 'expired').length;
  const upcomingCount = offers.filter(o => getOfferStatus(o) === 'upcoming').length;

  function validate() {
    const e = {};
    if (!form.title.trim())    e.title        = 'Title required';
    if (!form.discount_pct || isNaN(form.discount_pct) || Number(form.discount_pct) <= 0 || Number(form.discount_pct) > 100)
      e.discount_pct = 'Valid discount % required (1-100)';
    if (!form.valid_from)      e.valid_from   = 'Start date required';
    if (!form.valid_to)        e.valid_to     = 'End date required';
    if (form.valid_from && form.valid_to && form.valid_from > form.valid_to)
      e.valid_to = 'End date must be after start date';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSaving(true);

    const payload = {
      title:        form.title,
      product:      form.product,
      discount_pct: Number(form.discount_pct),
      valid_from:   form.valid_from,
      valid_to:     form.valid_to,
      notes:        form.notes,
      status:       form.status,
      dealer_ids:   selectedDealers.length > 0 ? selectedDealers : null,
    };

    if (editId) {
      const { error } = await supabase.from('offers').update(payload).eq('id', editId);
      if (!error) { showToast('Offer updated ✓'); fetchAll(); }
      else showToast('Error updating offer');
    } else {
      const { error } = await supabase.from('offers').insert(payload);
      if (!error) { showToast('Offer created ✓'); fetchAll(); }
      else showToast('Error creating offer');
    }

    setSaving(false);
    setShowModal(false);
    setForm(EMPTY_FORM);
    setSelectedDealers([]);
    setEditId(null);
  }

  function handleEdit(offer) {
    setForm({
      title:        offer.title,
      product:      offer.product,
      discount_pct: String(offer.discount_pct),
      valid_from:   offer.valid_from,
      valid_to:     offer.valid_to,
      notes:        offer.notes || '',
      status:       offer.status,
    });
    setSelectedDealers(offer.dealer_ids || []);
    setEditId(offer.id);
    setShowModal(true);
  }

  async function handleDelete(id) {
    await supabase.from('offers').delete().eq('id', id);
    showToast('Offer deleted');
    fetchAll();
    setShowDeleteId(null);
  }

  async function handleToggleStatus(offer) {
    const newStatus = offer.status === 'active' ? 'inactive' : 'active';
    await supabase.from('offers').update({ status: newStatus }).eq('id', offer.id);
    setOffers(prev => prev.map(o => o.id === offer.id ? { ...o, status: newStatus } : o));
    showToast(`Offer ${newStatus === 'active' ? 'activated' : 'deactivated'} ✓`);
  }

  function toggleDealer(id) {
    setSelectedDealers(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  }

  const fmtDate = d => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });

  const STATUS_CONFIG = {
    active:   { label: 'Active',   bg: 'rgba(45,157,110,0.12)',  color: '#165c3a' },
    expired:  { label: 'Expired',  bg: 'rgba(216,90,48,0.12)',   color: '#7a2010' },
    upcoming: { label: 'Upcoming', bg: 'rgba(58,143,212,0.12)',  color: '#1a4a7a' },
    inactive: { label: 'Inactive', bg: 'rgba(176,181,200,0.15)', color: '#5A5F72' },
  };

  return (
    <div className="offers-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="offers-main">
        <Topbar title="Offers" onMenuClick={() => setSidebarOpen(true)} />

        <div className="offers-content">

          {/* Header */}
          <div className="offers-header">
            <div>
              <h2 className="offers-title">Offer Management</h2>
              <p className="offers-sub">
                {loading ? 'Loading...' : `${activeCount} active · ${upcomingCount} upcoming · ${expiredCount} expired`}
              </p>
            </div>
            <button
              className="offers-add-btn"
              onClick={() => { setForm(EMPTY_FORM); setSelectedDealers([]); setEditId(null); setErrors({}); setShowModal(true); }}
            >
              <i className="ti ti-plus" /> Create Offer
            </button>
          </div>

          {/* Summary */}
          <div className="offers-summary">
            <div className="offers-sum-card green">
              <div className="offers-sum-icon"><i className="ti ti-circle-check" /></div>
              <div>
                <div className="offers-sum-val">{activeCount}</div>
                <div className="offers-sum-lbl">Active Offers</div>
              </div>
            </div>
            <div className="offers-sum-card blue">
              <div className="offers-sum-icon"><i className="ti ti-clock" /></div>
              <div>
                <div className="offers-sum-val">{upcomingCount}</div>
                <div className="offers-sum-lbl">Upcoming</div>
              </div>
            </div>
            <div className="offers-sum-card red">
              <div className="offers-sum-icon"><i className="ti ti-calendar-x" /></div>
              <div>
                <div className="offers-sum-val">{expiredCount}</div>
                <div className="offers-sum-lbl">Expired</div>
              </div>
            </div>
            <div className="offers-sum-card gold">
              <div className="offers-sum-icon"><i className="ti ti-tag" /></div>
              <div>
                <div className="offers-sum-val">{offers.length}</div>
                <div className="offers-sum-lbl">Total Offers</div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="offers-filters">
            {['all', 'active', 'upcoming', 'expired', 'inactive'].map(s => (
              <button
                key={s}
                className={`offers-filter-btn${filterStatus === s ? ' active' : ''}`}
                onClick={() => setFilterStatus(s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* Offers grid */}
          {loading ? (
            <div className="offers-loading"><div className="offers-spinner" /> Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="offers-empty">
              <i className="ti ti-tag" />
              <span>No offers yet — create your first offer</span>
            </div>
          ) : (
            <div className="offers-grid">
              {filtered.map(offer => {
                const status = getOfferStatus(offer);
                const cfg    = STATUS_CONFIG[status];
                const dealerCount = offer.dealer_ids?.length || 0;

                return (
                  <div key={offer.id} className={`offer-card ${status}`}>
                    <div className="offer-card-top">
                      <div className="offer-discount-badge">
                        {offer.discount_pct}% OFF
                      </div>
                      <span
                        className="offer-status-badge"
                        style={{ background: cfg.bg, color: cfg.color }}
                      >
                        {cfg.label}
                      </span>
                    </div>

                    <div className="offer-title">{offer.title}</div>
                    <div className="offer-product">
                      <i className="ti ti-package" /> {offer.product}
                    </div>

                    <div className="offer-dates">
                      <div className="offer-date-row">
                        <i className="ti ti-calendar" />
                        <span>{fmtDate(offer.valid_from)} → {fmtDate(offer.valid_to)}</span>
                      </div>
                      {dealerCount > 0 && (
                        <div className="offer-date-row">
                          <i className="ti ti-users" />
                          <span>{dealerCount} selected dealer{dealerCount > 1 ? 's' : ''}</span>
                        </div>
                      )}
                      {dealerCount === 0 && (
                        <div className="offer-date-row">
                          <i className="ti ti-users" />
                          <span>All dealers</span>
                        </div>
                      )}
                    </div>

                    {offer.notes && (
                      <div className="offer-notes">{offer.notes}</div>
                    )}

                    <div className="offer-card-footer">
                      <button
                        className={`offer-toggle-btn ${offer.status}`}
                        onClick={() => handleToggleStatus(offer)}
                        title={offer.status === 'active' ? 'Deactivate' : 'Activate'}
                      >
                        <i className={`ti ${offer.status === 'active' ? 'ti-player-pause' : 'ti-player-play'}`} />
                        {offer.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                      <div className="offer-actions">
                        <button className="offer-action-btn edit" onClick={() => handleEdit(offer)}>
                          <i className="ti ti-pencil" />
                        </button>
                        <button className="offer-action-btn delete" onClick={() => setShowDeleteId(offer.id)}>
                          <i className="ti ti-trash" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editId ? 'Edit Offer' : 'Create Offer'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <i className="ti ti-x" />
              </button>
            </div>

            <form className="modal-form" onSubmit={handleSubmit}>
              <div className="modal-field">
                <label>Offer Title *</label>
                <input
                  placeholder="e.g. Monsoon Special — 10% off WallVex Pro"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  className={errors.title ? 'error' : ''}
                />
                {errors.title && <span className="modal-error">{errors.title}</span>}
              </div>

              <div className="modal-row">
                <div className="modal-field">
                  <label>Product</label>
                  <select value={form.product} onChange={e => setForm({ ...form, product: e.target.value })}>
                    {PRODUCTS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="modal-field">
                  <label>Discount % *</label>
                  <input
                    type="number" min="1" max="100"
                    placeholder="e.g. 10"
                    value={form.discount_pct}
                    onChange={e => setForm({ ...form, discount_pct: e.target.value })}
                    className={errors.discount_pct ? 'error' : ''}
                  />
                  {errors.discount_pct && <span className="modal-error">{errors.discount_pct}</span>}
                </div>
              </div>

              <div className="modal-row">
                <div className="modal-field">
                  <label>Valid From *</label>
                  <input
                    type="date"
                    value={form.valid_from}
                    onChange={e => setForm({ ...form, valid_from: e.target.value })}
                    className={errors.valid_from ? 'error' : ''}
                  />
                  {errors.valid_from && <span className="modal-error">{errors.valid_from}</span>}
                </div>
                <div className="modal-field">
                  <label>Valid To *</label>
                  <input
                    type="date"
                    value={form.valid_to}
                    onChange={e => setForm({ ...form, valid_to: e.target.value })}
                    className={errors.valid_to ? 'error' : ''}
                  />
                  {errors.valid_to && <span className="modal-error">{errors.valid_to}</span>}
                </div>
              </div>

              <div className="modal-field">
                <label>Notes (optional)</label>
                <input
                  placeholder="Any special conditions..."
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              {/* Dealer selection */}
              <div className="modal-field">
                <label>Apply to dealers (leave empty for all dealers)</label>
                <div className="offers-dealer-grid">
                  {dealers.map(d => (
                    <div
                      key={d.id}
                      className={`offers-dealer-chip${selectedDealers.includes(d.id) ? ' selected' : ''}`}
                      onClick={() => toggleDealer(d.id)}
                    >
                      <i className={`ti ${selectedDealers.includes(d.id) ? 'ti-circle-check' : 'ti-circle'}`} />
                      <span>{d.name}</span>
                      <span className="offers-dealer-loc">{d.location}</span>
                    </div>
                  ))}
                </div>
                {selectedDealers.length > 0 && (
                  <div style={{ fontSize:12, color:'#8A8FA3', marginTop:6 }}>
                    {selectedDealers.length} dealer{selectedDealers.length > 1 ? 's' : ''} selected
                    <button
                      type="button"
                      style={{ marginLeft:8, fontSize:11, color:'#D85A30', background:'none', border:'none', cursor:'pointer' }}
                      onClick={() => setSelectedDealers([])}
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="modal-submit" disabled={saving}>
                  {saving ? <span className="btn-spinner" /> : <i className="ti ti-check" />}
                  {editId ? 'Save Changes' : 'Create Offer'}
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
              <h3 className="modal-title">Delete Offer?</h3>
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
        <div className="offers-toast">
          <i className="ti ti-circle-check" />{toast}
        </div>
      )}
    </div>
  );
}