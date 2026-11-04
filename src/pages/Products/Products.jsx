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
  const [notice, setNotice] = useState({ type: '', text: '' });
  const [form, setForm] = useState({ product: '', size: '', unit: 'kg' });

  const products = useMemo(
    () => [...new Set(catalog.map(row => row.product).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b)),
    [catalog]
  );

  useEffect(() => {
    loadCatalog();
  }, []);

  async function loadCatalog() {
    setLoading(true);

    const { data, error } = await supabase
      .from('pack_sizes')
      .select('*')
      .order('product')
      .order('size');

    if (error) {
      setNotice({ type: 'error', text: `Could not load products: ${error.message}` });
    } else {
      setCatalog(data || []);
    }

    setLoading(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const name = form.product.trim();
    const size = Number(form.size);
    const unit = form.unit.trim();

    if (!name || !Number.isFinite(size) || size <= 0 || !unit) {
      setNotice({
        type: 'error',
        text: 'Enter a product name, a pack size above zero, and its unit.',
      });
      return;
    }

    const duplicate = catalog.some(row =>
      row.product.toLowerCase() === name.toLowerCase() &&
      Number(row.size) === size &&
      row.unit.toLowerCase() === unit.toLowerCase()
    );

    if (duplicate) {
      setNotice({ type: 'error', text: 'That product and pack size already exist.' });
      return;
    }

    setSaving(true);

    const { data, error } = await supabase
      .from('pack_sizes')
      .insert({ product: name, size, unit })
      .select()
      .single();

    if (error) {
      setNotice({ type: 'error', text: `Could not save: ${error.message}` });
    } else {
      setCatalog(current =>
        [...current, data].sort(
          (a, b) => a.product.localeCompare(b.product) || Number(a.size) - Number(b.size)
        )
      );
      setForm({ product: '', size: '', unit: 'kg' });
      setNotice({
        type: 'success',
        text: `${name} · ${size} ${unit} added to the catalog.`,
      });
    }

    setSaving(false);
  }

  return (
    <div className="products-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="products-main">
        <Topbar title="Products" onMenuClick={() => setSidebarOpen(true)} />

        <div className="products-content">
          <header className="products-heading">
            <div>
              <span className="products-eyebrow">CATALOG</span>
              <h1>Products &amp; pack sizes</h1>
              <p>
                Add every product and its available pack sizes here.
                They will appear in order entry and pricing.
              </p>
            </div>

            <div className="products-count">
              <strong>{products.length}</strong>
              <span>products</span>
            </div>
          </header>

          <section className="products-panel products-form-panel">
            <div className="products-panel-heading">
              <div className="products-icon">
                <i className="ti ti-package" />
              </div>
              <div>
                <h2>Add to catalog</h2>
                <p>A product needs at least one pack size before it can be ordered.</p>
              </div>
            </div>

            <form className="products-form" onSubmit={handleSubmit}>
              <label>
                Product name
                <input
                  list="existing-products"
                  value={form.product}
                  onChange={event => setForm({ ...form, product: event.target.value })}
                  placeholder="For example, WallVex Pro"
                  required
                />
              </label>

              <datalist id="existing-products">
                {products.map(product => (
                  <option key={product} value={product} />
                ))}
              </datalist>

              <label>
                Pack size
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={form.size}
                  onChange={event => setForm({ ...form, size: event.target.value })}
                  placeholder="20"
                  required
                />
              </label>

              <label>
                Unit
                <select
                  value={form.unit}
                  onChange={event => setForm({ ...form, unit: event.target.value })}
                >
                  <option>kg</option>
                  <option>ltr</option>
                  <option>g</option>
                  <option>ml</option>
                  <option>pieces</option>
                  <option>bags</option>
                </select>
              </label>

              <button type="submit" disabled={saving}>
                <i className="ti ti-plus" />
                {saving ? 'Saving…' : 'Add pack size'}
              </button>
            </form>

            {notice.text && (
              <div className={`products-notice ${notice.type}`} role="status">
                {notice.text}
              </div>
            )}
          </section>

          <section className="products-panel">
            <div className="products-list-heading">
              <div>
                <h2>Your catalog</h2>
                <p>
                  {catalog.length} pack size{catalog.length === 1 ? '' : 's'} available
                </p>
              </div>
              <button
                type="button"
                className="products-refresh"
                onClick={loadCatalog}
                aria-label="Refresh catalog"
              >
                <i className="ti ti-refresh" /> Refresh
              </button>
            </div>

            {loading ? (
              <div className="products-empty">Loading catalog…</div>
            ) : catalog.length === 0 ? (
              <div className="products-empty">
                <i className="ti ti-package-off" />
                <strong>No products yet</strong>
                <span>Add the first product and pack size above.</span>
              </div>
            ) : (
              <div className="products-grid">
                {products.map(product => {
                  const packs = catalog.filter(row => row.product === product);

                  return (
                    <article className="products-card" key={product}>
                      <div className="products-card-top">
                        <div className="products-card-mark">
                          {product.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <h3>{product}</h3>
                          <span>
                            {packs.length} pack size{packs.length === 1 ? '' : 's'}
                          </span>
                        </div>
                      </div>

                      <div className="products-pack-list">
                        {packs.map(pack => (
                          <span
                            className="products-pack"
                            key={pack.id || `${pack.size}-${pack.unit}`}
                          >
                            {pack.size} <small>{pack.unit}</small>
                          </span>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}