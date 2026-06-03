import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import Topbar from '../../components/Topbar/Topbar';
import { supabase } from '../../lib/supabase';
import './CostCalc.css';

const PRODUCTS = ['WallVex Pro', 'Chromvex', 'Primvex'];
const UNITS = ['kg', 'ltr', 'g', 'ml', 'pieces', 'bags'];
const EMPTY_ITEM = { material_name: '', qty: '', unit: UNITS[0], rate: '' };

export default function CostCalc() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [packSizes, setPackSizes]     = useState([]);
  const [formulas, setFormulas]       = useState([]);
  const [saving, setSaving]           = useState(false);
  const [toast, setToast]             = useState('');

  /* ── Calculator state ── */
  const [product, setProduct]         = useState(PRODUCTS[0]);
  const [packSize, setPackSize]       = useState('');
  const [unit, setUnit]               = useState('');
  const [items, setItems]             = useState([{ ...EMPTY_ITEM }]);
  const [labourCost, setLabourCost]   = useState('');
  const [overheadCost, setOverheadCost] = useState('');
  const [marginPct, setMarginPct]     = useState('20');
  const [savedFormulaId, setSavedFormulaId] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    const [ps, f] = await Promise.all([
      supabase.from('pack_sizes').select('*').order('product'),
      supabase.from('cost_formulas').select('*, cost_formula_items(*)').order('product'),
    ]);
    setPackSizes(ps.data || []);
    setFormulas(f.data  || []);

    const sizes = (ps.data || []).filter(p => p.product === PRODUCTS[0]);
    if (sizes[0]) { setPackSize(sizes[0].size); setUnit(sizes[0].unit); }
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  function getSizesForProduct(p) { return packSizes.filter(ps => ps.product === p); }

  function handleProductChange(p) {
    setProduct(p);
    const sizes = getSizesForProduct(p);
    if (sizes[0]) { setPackSize(sizes[0].size); setUnit(sizes[0].unit); }
    else { setPackSize(''); setUnit(''); }
    setSavedFormulaId(null);
    setItems([{ ...EMPTY_ITEM }]);
    setLabourCost(''); setOverheadCost(''); setMarginPct('20');
  }

  function handleSizeChange(sizeStr) {
    const [size, u] = sizeStr.split('__');
    setPackSize(size); setUnit(u);
    loadFormula(product, size, u);
  }

  function loadFormula(p, ps, u) {
    const formula = formulas.find(f => f.product === p && f.pack_size === ps && f.unit === u);
    if (formula) {
      setSavedFormulaId(formula.id);
      setLabourCost(String(formula.labour_cost || ''));
      setOverheadCost(String(formula.overhead_cost || ''));
      setMarginPct(String(formula.margin_pct || '20'));
      setItems(formula.cost_formula_items?.length > 0
        ? formula.cost_formula_items.map(i => ({ material_name: i.material_name, qty: String(i.qty), unit: i.unit, rate: String(i.rate) }))
        : [{ ...EMPTY_ITEM }]
      );
    } else {
      setSavedFormulaId(null);
      setItems([{ ...EMPTY_ITEM }]);
      setLabourCost(''); setOverheadCost(''); setMarginPct('20');
    }
  }

  function updateItem(index, fields) { setItems(prev => prev.map((item, i) => i === index ? { ...item, ...fields } : item)); }
  function addItem() { setItems(prev => [...prev, { ...EMPTY_ITEM }]); }
  function removeItem(index) { if (items.length > 1) setItems(prev => prev.filter((_, i) => i !== index)); }

  /* ── Cost calculations ── */
  const rawMaterialCost = items.reduce((s, item) => s + (Number(item.qty || 0) * Number(item.rate || 0)), 0);
  const labour          = Number(labourCost  || 0);
  const overhead        = Number(overheadCost || 0);
  const margin          = Number(marginPct   || 0);
  const totalCostBefore = rawMaterialCost + labour + overhead;
  const marginAmt       = totalCostBefore * margin / 100;
  const finalPrice      = totalCostBefore + marginAmt;
  const costPerUnit     = packSize ? finalPrice / Number(packSize) : 0;

  /* ── Save formula ── */
  async function handleSaveFormula() {
    if (!packSize) { showToast('Select pack size first'); return; }
    setSaving(true);

    const payload = {
      product, pack_size: packSize, unit,
      labour_cost: labour, overhead_cost: overhead,
      margin_pct: margin, updated_at: new Date().toISOString(),
    };

    let formulaId = savedFormulaId;

    if (savedFormulaId) {
      await supabase.from('cost_formulas').update(payload).eq('id', savedFormulaId);
      await supabase.from('cost_formula_items').delete().eq('formula_id', savedFormulaId);
    } else {
      const { data } = await supabase.from('cost_formulas').insert(payload).select().single();
      formulaId = data?.id;
      setSavedFormulaId(formulaId);
    }

    if (formulaId) {
      await supabase.from('cost_formula_items').insert(
        items.filter(i => i.material_name && i.qty && i.rate).map(i => ({
          formula_id:    formulaId,
          material_name: i.material_name,
          qty:           Number(i.qty),
          unit:          i.unit,
          rate:          Number(i.rate),
          amount:        Number(i.qty) * Number(i.rate),
        }))
      );
    }

    showToast('Formula saved ✓');
    setSaving(false);
    fetchAll();
  }

  const fmtAmt = n => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="costcalc-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="costcalc-main">
        <Topbar title="Cost Calculator" onMenuClick={() => setSidebarOpen(true)} />
        <div className="costcalc-content">

          <div className="costcalc-header">
            <div>
              <h2 className="costcalc-title">Cost Calculator</h2>
              <p className="costcalc-sub">Calculate cost per bucket and save formulas per product</p>
            </div>
          </div>

          <div className="costcalc-layout">

            {/* Left — inputs */}
            <div className="costcalc-left">

              {/* Product + Size selector */}
              <div className="costcalc-card">
                <div className="costcalc-card-title"><i className="ti ti-package" /> Product & Pack Size</div>
                <div className="costcalc-row">
                  <div className="costcalc-field">
                    <label>Product</label>
                    <select value={product} onChange={e => handleProductChange(e.target.value)}>
                      {PRODUCTS.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="costcalc-field">
                    <label>Pack Size</label>
                    <select value={`${packSize}__${unit}`} onChange={e => handleSizeChange(e.target.value)}>
                      <option value="__">Select...</option>
                      {getSizesForProduct(product).map(ps => (
                        <option key={`${ps.size}__${ps.unit}`} value={`${ps.size}__${ps.unit}`}>{ps.size} {ps.unit}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {savedFormulaId && (
                  <div className="costcalc-saved-note">
                    <i className="ti ti-circle-check" /> Saved formula loaded — edit and save to update
                  </div>
                )}
              </div>

              {/* Raw materials */}
              <div className="costcalc-card">
                <div className="costcalc-card-hdr">
                  <div className="costcalc-card-title"><i className="ti ti-flask" /> Raw Materials</div>
                  <button className="costcalc-add-btn" onClick={addItem}><i className="ti ti-plus" /> Add</button>
                </div>

                <div className="costcalc-item-header">
                  <div>Material</div><div>Qty</div><div>Unit</div><div>Rate (₹)</div><div>Amount</div><div></div>
                </div>

                {items.map((item, index) => (
                  <div key={index} className="costcalc-item-row">
                    <div className="costcalc-item-field">
                      <input placeholder="e.g. Titanium Dioxide" value={item.material_name} onChange={e => updateItem(index, { material_name: e.target.value })} />
                    </div>
                    <div className="costcalc-item-field">
                      <input type="number" min="0" placeholder="Qty" value={item.qty} onChange={e => updateItem(index, { qty: e.target.value })} />
                    </div>
                    <div className="costcalc-item-field">
                      <select value={item.unit} onChange={e => updateItem(index, { unit: e.target.value })}>
                        {UNITS.map(u => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                    <div className="costcalc-item-field">
                      <input type="number" min="0" placeholder="Rate" value={item.rate} onChange={e => updateItem(index, { rate: e.target.value })} />
                    </div>
                    <div className="costcalc-item-amount">
                      {item.qty && item.rate ? fmtAmt(Number(item.qty) * Number(item.rate)) : '—'}
                    </div>
                    <button className="costcalc-remove-btn" onClick={() => removeItem(index)} disabled={items.length === 1}>
                      <i className="ti ti-trash" />
                    </button>
                  </div>
                ))}

                <div className="costcalc-subtotal">
                  <span>Raw Material Total:</span>
                  <strong>{fmtAmt(rawMaterialCost)}</strong>
                </div>
              </div>

              {/* Labour + Overhead */}
              <div className="costcalc-card">
                <div className="costcalc-card-title"><i className="ti ti-tools" /> Other Costs (per batch / per unit)</div>
                <div className="costcalc-row">
                  <div className="costcalc-field">
                    <label>Labour Cost (₹)</label>
                    <div className="costcalc-input-wrap">
                      <span className="costcalc-prefix">₹</span>
                      <input type="number" min="0" placeholder="0" value={labourCost} onChange={e => setLabourCost(e.target.value)} />
                    </div>
                  </div>
                  <div className="costcalc-field">
                    <label>Overhead Cost (₹)</label>
                    <div className="costcalc-input-wrap">
                      <span className="costcalc-prefix">₹</span>
                      <input type="number" min="0" placeholder="0" value={overheadCost} onChange={e => setOverheadCost(e.target.value)} />
                    </div>
                  </div>
                  <div className="costcalc-field">
                    <label>Margin %</label>
                    <div className="costcalc-input-wrap">
                      <input type="number" min="0" max="100" placeholder="20" value={marginPct} onChange={e => setMarginPct(e.target.value)} />
                      <span className="costcalc-suffix">%</span>
                    </div>
                  </div>
                </div>
              </div>

              <button className="costcalc-save-btn" onClick={handleSaveFormula} disabled={saving}>
                {saving ? <span className="btn-spinner" /> : <i className="ti ti-device-floppy" />}
                {savedFormulaId ? 'Update Formula' : 'Save Formula'}
              </button>
            </div>

            {/* Right — result */}
            <div className="costcalc-right">
              <div className="costcalc-result-card">
                <div className="costcalc-result-title">Cost Breakdown</div>
                <div className="costcalc-result-product">
                  {product} — {packSize} {unit}
                </div>

                <div className="costcalc-breakdown">
                  <div className="costcalc-breakdown-row">
                    <span>Raw Materials</span>
                    <span>{fmtAmt(rawMaterialCost)}</span>
                  </div>
                  <div className="costcalc-breakdown-row">
                    <span>Labour</span>
                    <span>{fmtAmt(labour)}</span>
                  </div>
                  <div className="costcalc-breakdown-row">
                    <span>Overhead</span>
                    <span>{fmtAmt(overhead)}</span>
                  </div>
                  <div className="costcalc-breakdown-row subtotal">
                    <span>Cost Before Margin</span>
                    <span>{fmtAmt(totalCostBefore)}</span>
                  </div>
                  <div className="costcalc-breakdown-row">
                    <span>Margin ({margin}%)</span>
                    <span>{fmtAmt(marginAmt)}</span>
                  </div>
                </div>

                <div className="costcalc-final">
                  <div className="costcalc-final-label">Selling Price</div>
                  <div className="costcalc-final-val">{fmtAmt(finalPrice)}</div>
                  <div className="costcalc-final-sub">per {packSize} {unit} bucket</div>
                </div>

                {packSize && Number(packSize) > 1 && (
                  <div className="costcalc-per-unit">
                    <div className="costcalc-per-unit-label">Cost per 1 {unit}</div>
                    <div className="costcalc-per-unit-val">{fmtAmt(costPerUnit)}</div>
                  </div>
                )}

                {/* Saved formulas list */}
                {formulas.length > 0 && (
                  <div className="costcalc-saved-list">
                    <div className="costcalc-saved-title">Saved Formulas</div>
                    {formulas.map(f => (
                      <div
                        key={f.id}
                        className={`costcalc-saved-row${savedFormulaId === f.id ? ' active' : ''}`}
                        onClick={() => {
                          setProduct(f.product);
                          setPackSize(f.pack_size);
                          setUnit(f.unit);
                          setSavedFormulaId(f.id);
                          setLabourCost(String(f.labour_cost || ''));
                          setOverheadCost(String(f.overhead_cost || ''));
                          setMarginPct(String(f.margin_pct || '20'));
                          setItems(f.cost_formula_items?.length > 0
                            ? f.cost_formula_items.map(i => ({ material_name: i.material_name, qty: String(i.qty), unit: i.unit, rate: String(i.rate) }))
                            : [{ ...EMPTY_ITEM }]
                          );
                        }}
                      >
                        <div>
                          <div className="costcalc-saved-name">{f.product}</div>
                          <div className="costcalc-saved-size">{f.pack_size} {f.unit}</div>
                        </div>
                        <div className="costcalc-saved-price">
                          {fmtAmt(
                            (f.cost_formula_items || []).reduce((s, i) => s + i.amount, 0) +
                            Number(f.labour_cost || 0) + Number(f.overhead_cost || 0) +
                            ((f.cost_formula_items || []).reduce((s, i) => s + i.amount, 0) + Number(f.labour_cost || 0) + Number(f.overhead_cost || 0)) * Number(f.margin_pct || 0) / 100
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast && <div className="costcalc-toast"><i className="ti ti-circle-check" />{toast}</div>}
    </div>
  );
}