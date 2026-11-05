import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import Topbar from '../../components/Topbar/Topbar';
import { supabase } from '../../lib/supabase';
import './Products.css';

export default function Products() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editPackId, setEditPackId] = useState(null);
  const [notice, setNotice] = useState({ type: '', text: '' });
  const [form, setForm] = useState({ product: '', size: '', unit: 'ltr' });
  const products = useMemo(() => [...new Set(catalog.map(row => row.product).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [catalog]);

  useEffect(() => { loadCatalog(); }, []);

  async function loadCatalog() {
    setLoading(true);
    const { data, error } = await supabase.from('pack_sizes').select('*').order('product').order('size');
    if (error) setNotice({ type: 'error', text: `Could not load products: ${error.message}` });
    else setCatalog(data || []);
    setLoading(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const name = form.product.trim();
    const size = Number(form.size);
    if (!name || !Number.isFinite(size) || size <= 0 || !form.unit.trim()) {
      setNotice({ type: 'error', text: 'Enter a product name, a pack size above zero, and its unit.' });
      return;
    }
    const duplicate = catalog.some(row => row.id !== editPackId && row.product.toLowerCase() === name.toLowerCase() && Number(row.size) === size && row.unit.toLowerCase() === form.unit.trim().toLowerCase());
    if (duplicate) {
      setNotice({ type: 'error', text: 'That product and pack size already exist.' });
      return;
    }
    setSaving(true);
    const query = editPackId
      ? supabase.from('pack_sizes').update({ product: name, size, unit: form.unit.trim() }).eq('id', editPackId).select().single()
      : supabase.from('pack_sizes').insert({ product: name, size, unit: form.unit.trim() }).select().single();
    const { data, error } = await query;
    if (error) setNotice({ type: 'error', text: `Could not save: ${error.message}` });
    else {
      setCatalog(current => [...current.filter(row => row.id !== data.id), data].sort((a, b) => a.product.localeCompare(b.product) || Number(a.size) - Number(b.size)));
      setForm({ product: '', size: '', unit: 'ltr' });
      setEditPackId(null);
      setNotice({ type: 'success', text: editPackId ? `${name} · ${size} ${form.unit} updated.` : `${name} · ${size} ${form.unit} added to the catalog.` });
    }
    setSaving(false);
  }

  function startEdit(pack) {
    setEditPackId(pack.id);
    setForm({ product: pack.product, size: String(pack.size), unit: pack.unit });
    setNotice({ type: '', text: '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deletePack(pack) {
    if (!window.confirm(`Remove ${pack.product} · ${pack.size} ${pack.unit} from the product catalog? Existing orders will remain.`)) return;
    const { error } = await supabase.from('pack_sizes').delete().eq('id', pack.id);
    if (error) setNotice({ type: 'error', text: `Could not remove pack size: ${error.message}` });
    else {
      setCatalog(current => current.filter(row => row.id !== pack.id));
      if (editPackId === pack.id) { setEditPackId(null); setForm({ product: '', size: '', unit: 'ltr' }); }
      setNotice({ type: 'success', text: `${pack.product} · ${pack.size} ${pack.unit} removed from the catalog.` });
    }
  }

  return (
    <div className="products-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="products-main">
        <Topbar title="Products" onMenuClick={() => setSidebarOpen(true)} />
        <div className="products-content">
          <header className="products-heading">
            <div><span className="products-eyebrow">CATALOG</span><h1>Products & pack sizes</h1><p>Add every product and its available pack sizes here. They will appear in order entry and pricing.</p></div>
            <div className="products-count"><strong>{products.length}</strong><span>products</span></div>
          </header>

          <section className="products-panel products-form-panel">
            <div className="products-panel-heading"><div className="products-icon"><i className="ti ti-package" /></div><div><h2>{editPackId ? 'Edit pack size' : 'Add to catalog'}</h2><p>A product needs at least one pack size before it can be ordered.</p></div></div>
            <form className="products-form" onSubmit={handleSubmit}>
              <label>Product name<input list="existing-products" value={form.product} onChange={e => setForm({ ...form, product: e.target.value })} placeholder="For example, WallVex Pro" required /></label>
              <datalist id="existing-products">{products.map(product => <option key={product} value={product} />)}</datalist>
              <label>Pack size<input type="number" min="0.01" step="any" value={form.size} onChange={e => setForm({ ...form, size: e.target.value })} placeholder="20" required /></label>
              <label>Unit<select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}><option>ltr</option><option>kg</option><option>g</option><option>ml</option><option>pieces</option><option>bags</option></select></label>
              <div className="products-form-actions"><button type="submit" disabled={saving}><i className={editPackId ? 'ti ti-device-floppy' : 'ti ti-plus'} />{saving ? 'Saving…' : editPackId ? 'Update pack size' : 'Add pack size'}</button>{editPackId && <button type="button" className="products-cancel-edit" onClick={() => { setEditPackId(null); setForm({ product: '', size: '', unit: 'ltr' }); setNotice({ type: '', text: '' }); }}>Cancel edit</button>}</div>
            </form>
            {notice.text && <div className={`products-notice ${notice.type}`} role="status">{notice.text}</div>}
          </section>

          <section className="products-panel">
            <div className="products-list-heading"><div><h2>Your catalog</h2><p>{catalog.length} pack size{catalog.length === 1 ? '' : 's'} available</p></div><button type="button" className="products-refresh" onClick={loadCatalog} aria-label="Refresh catalog"><i className="ti ti-refresh" /> Refresh</button></div>
            {loading ? <div className="products-empty">Loading catalog…</div> : catalog.length === 0 ? <div className="products-empty"><i className="ti ti-package-off" /><strong>No products yet</strong><span>Add the first product and pack size above.</span></div> : (
              <div className="products-grid">{products.map(product => {
                const packs = catalog.filter(row => row.product === product);
                return <article className="products-card" key={product}><div className="products-card-top"><div className="products-card-mark">{product.slice(0, 1).toUpperCase()}</div><div><h3>{product}</h3><span>{packs.length} pack size{packs.length === 1 ? '' : 's'}</span></div></div><div className="products-pack-list">{packs.map(pack => <div className="products-pack-row" key={pack.id || `${pack.size}-${pack.unit}`}><span className="products-pack">{pack.size} <small>{pack.unit}</small></span><button type="button" onClick={() => startEdit(pack)} aria-label={`Edit ${pack.product} ${pack.size} ${pack.unit}`} title="Edit pack size"><i className="ti ti-pencil" /></button><button type="button" className="delete" onClick={() => deletePack(pack)} aria-label={`Remove ${pack.product} ${pack.size} ${pack.unit}`} title="Remove pack size"><i className="ti ti-trash" /></button></div>)}</div></article>;
              })}</div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
