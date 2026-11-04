import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import Topbar from '../../components/Topbar/Topbar';
import { supabase } from '../../lib/supabase';
import './PriceList.css';

export default function PriceList() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dealers, setDealers]         = useState([]);
  const [packSizes, setPackSizes]     = useState([]);
  const [prices, setPrices]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [selectedDealer, setSelectedDealer] = useState(null);
  const [priceForm, setPriceForm]     = useState({});
  const [toast, setToast]             = useState('');
  const [search, setSearch]           = useState('');

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [d, ps, pr] = await Promise.all([
      supabase.from('dealers').select('*').eq('status', 'active').order('name'),
      supabase.from('pack_sizes').select('*').order('product'),
      supabase.from('dealer_prices').select('*'),
    ]);
    setDealers(d.data   || []);
    setPackSizes(ps.data || []);
    setPrices(pr.data   || []);
    setLoading(false);
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  function handleSelectDealer(dealer) {
    setSelectedDealer(dealer);
    const form = {};
    packSizes.forEach(ps => {
      const key      = `${ps.product}__${ps.size}__${ps.unit}`;
      const existing = prices.find(p =>
        p.dealer_name === dealer.name &&
        p.product     === ps.product &&
        p.pack_size   === ps.size &&
        p.unit        === ps.unit
      );
      form[key] = existing ? String(existing.rate) : '';
    });
    setPriceForm(form);
  }

  async function handleSavePrices(e) {
    e.preventDefault();
    if (!selectedDealer) return;
    setSaving(true);

    for (const [key, rate] of Object.entries(priceForm)) {
      if (!rate || isNaN(rate)) continue;
      const [product, pack_size, unit] = key.split('__');
      const existing = prices.find(p =>
        p.dealer_name === selectedDealer.name &&
        p.product     === product &&
        p.pack_size   === pack_size &&
        p.unit        === unit
      );

      if (existing) {
        await supabase.from('dealer_prices')
          .update({ rate: Number(rate) })
          .eq('id', existing.id);
      } else {
        await supabase.from('dealer_prices').insert({
          dealer_name: selectedDealer.name,
          product, pack_size, unit,
          rate: Number(rate),
        });
      }
    }

    showToast('Prices saved ✓');
    setSaving(false);
    fetchAll();
  }

  const filteredDealers = dealers.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.location.toLowerCase().includes(search.toLowerCase())
  );

  const fmtAmt = n => n ? `₹${Number(n).toLocaleString('en-IN')}` : '—';
  const getInitials = name => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  function getDealerPriceCount(dealerName) {
    return prices.filter(p => p.dealer_name === dealerName).length;
  }

  const products = [...new Set(packSizes.map(row => row.product).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  return (
    <div className="pricelist-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="pricelist-main">
        <Topbar title="Price List" onMenuClick={() => setSidebarOpen(true)} />

        <div className="pricelist-content">

          <div className="pricelist-header">
            <div>
              <h2 className="pricelist-title">Price List</h2>
              <p className="pricelist-sub">Set custom rates per dealer per product per pack size</p>
            </div>
          </div>

          <div className="pricelist-layout">

            {/* Dealer list */}
            <div className="pricelist-dealers">
              <div className="pricelist-dealers-hdr">
                <span className="pricelist-dealers-title">Select Dealer</span>
              </div>
              <div className="pricelist-search-wrap">
                <i className="ti ti-search" />
                <input
                  className="pricelist-search"
                  placeholder="Search dealer..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              {loading ? (
                <div className="pricelist-loading"><div className="pricelist-spinner" /></div>
              ) : filteredDealers.map(d => (
                <div
                  key={d.id}
                  className={`pricelist-dealer-row${selectedDealer?.id === d.id ? ' selected' : ''}`}
                  onClick={() => handleSelectDealer(d)}
                >
                  <div className="pricelist-dealer-avatar">{getInitials(d.name)}</div>
                  <div className="pricelist-dealer-info">
                    <div className="pricelist-dealer-name">{d.name}</div>
                    <div className="pricelist-dealer-loc">{d.location}</div>
                  </div>
                  <div className="pricelist-price-count">
                    {getDealerPriceCount(d.name) > 0
                      ? <span className="pricelist-count-badge">{getDealerPriceCount(d.name)} prices</span>
                      : <span className="pricelist-count-empty">No prices</span>
                    }
                  </div>
                </div>
              ))}
            </div>

            {/* Price form */}
            <div className="pricelist-form-wrap">
              {!selectedDealer ? (
                <div className="pricelist-empty">
                  <i className="ti ti-hand-click" />
                  <span>Select a dealer to set their prices</span>
                </div>
              ) : (
                <form onSubmit={handleSavePrices}>
                  <div className="pricelist-form-hdr">
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div className="pricelist-form-avatar">{getInitials(selectedDealer.name)}</div>
                      <div>
                        <div className="pricelist-form-name">{selectedDealer.name}</div>
                        <div className="pricelist-form-loc">{selectedDealer.location}</div>
                      </div>
                    </div>
                    <button type="submit" className="pricelist-save-btn" disabled={saving}>
                      {saving ? <span className="btn-spinner" /> : <i className="ti ti-check" />}
                      Save Prices
                    </button>
                  </div>

                  <div className="pricelist-note">
                    <i className="ti ti-info-circle" />
                    Leave blank to use order-time manual entry. Fill in to auto-populate rate when placing orders.
                  </div>

                  {products.map(product => {
                    const sizes = packSizes.filter(ps => ps.product === product);
                    return (
                      <div key={product} className="pricelist-product-section">
                        <div className="pricelist-product-title">
                          <div className="pricelist-product-dot" style={{
                            background: ['#17877C', '#16353B', '#E99268', '#5277C3', '#7A5DA8', '#CF8C35'][products.indexOf(product) % 6]
                          }} />
                          {product}
                        </div>
                        <div className="pricelist-sizes-grid">
                          {sizes.map(ps => {
                            const key = `${ps.product}__${ps.size}__${ps.unit}`;
                            return (
                              <div key={key} className="pricelist-size-field">
                                <label>{ps.size} {ps.unit}</label>
                                <div className="pricelist-input-wrap">
                                  <span className="pricelist-rupee">₹</span>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="Rate"
                                    value={priceForm[key] || ''}
                                    onChange={e => setPriceForm({ ...priceForm, [key]: e.target.value })}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                </form>
              )}
            </div>

          </div>
        </div>
      </div>

      {toast && (
        <div className="pricelist-toast">
          <i className="ti ti-circle-check" />{toast}
        </div>
      )}
    </div>
  );
}
