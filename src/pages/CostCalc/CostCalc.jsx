import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import Topbar from '../../components/Topbar/Topbar';
import { supabase } from '../../lib/supabase';
import './CostCalc.css';

const UNITS = ['kg', 'ltr', 'g', 'ml', 'pieces', 'bags'];
const EMPTY_ITEM = { material_name: '', qty: '', unit: UNITS[0], rate: '' };
const EMPTY_LABOUR = { name: '', amount: '' };

export default function CostCalc() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [packSizes, setPackSizes]     = useState([]);
  const [formulas, setFormulas]       = useState([]);
  const [saving, setSaving]           = useState(false);
  const [toast, setToast]             = useState('');

  /* ── Calculator state ── */
  const [product, setProduct]         = useState('');
  const [packSize, setPackSize]       = useState('');
  const [batchWeightKg, setBatchWeightKg] = useState('');
  const [densityKgPerL, setDensityKgPerL] = useState('');
  const [unit, setUnit]               = useState('');
  const [items, setItems]             = useState([{ ...EMPTY_ITEM }]);
  const [labourEntries, setLabourEntries] = useState([{ ...EMPTY_LABOUR }]);
  const [overheadCost, setOverheadCost] = useState('');
  const [savedFormulaId, setSavedFormulaId] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    const [ps, f] = await Promise.all([
      supabase.from('pack_sizes').select('*').order('product'),
      supabase.from('cost_formulas').select('*, cost_formula_items(*)').order('product'),
    ]);
    setPackSizes(ps.data || []);
    setFormulas(f.data  || []);

    const firstProduct = (ps.data || [])[0]?.product || '';
    if (firstProduct) setProduct(current => current || firstProduct);
    const sizes = (ps.data || []).filter(p => p.product === firstProduct);
    if (sizes[0]) { setPackSize(sizes[0].size); setBatchWeightKg(''); setDensityKgPerL(''); setUnit(sizes[0].unit); }
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  function getSizesForProduct(p) { return packSizes.filter(ps => ps.product === p); }
  const products = [...new Set(packSizes.map(row => row.product).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  function handleProductChange(p) {
    setProduct(p);
    const sizes = getSizesForProduct(p);
    if (sizes[0]) { setPackSize(sizes[0].size); setBatchWeightKg(''); setDensityKgPerL(''); setUnit(sizes[0].unit); }
    else { setPackSize(''); setBatchWeightKg(''); setDensityKgPerL(''); setUnit(''); }
    setSavedFormulaId(null);
    setItems([{ ...EMPTY_ITEM }]);
    setLabourEntries([{ ...EMPTY_LABOUR }]); setOverheadCost('');
  }

  function handleSizeChange(sizeStr) {
    const [size, u] = sizeStr.split('__');
    setPackSize(size); setUnit(u);
    setBatchWeightKg(''); setDensityKgPerL('');
    loadFormula(product, size, u);
  }

  function loadFormula(p, ps, u) {
    const formula = formulas.find(f => f.product === p && f.pack_size === ps && f.unit === u);
    setBatchWeightKg(formula?.batch_weight_kg ? String(formula.batch_weight_kg) : '');
    setDensityKgPerL(formula?.density_kg_per_l ? String(formula.density_kg_per_l) : '');
    if (formula) {
      setSavedFormulaId(formula.id);
      setLabourEntries(Array.isArray(formula.labour_entries) && formula.labour_entries.length
        ? formula.labour_entries.map(entry => ({ name: entry.name || '', amount: String(entry.amount || '') }))
        : formula.labour_cost ? [{ name: 'Labour', amount: String(formula.labour_cost) }] : [{ ...EMPTY_LABOUR }]
      );
      setOverheadCost(String(formula.overhead_cost || ''));
      setItems(formula.cost_formula_items?.length > 0
        ? formula.cost_formula_items.map(i => ({ material_name: i.material_name, qty: String(i.qty), unit: i.unit, rate: String(i.rate) }))
        : [{ ...EMPTY_ITEM }]
      );
    } else {
      setSavedFormulaId(null);
      setItems([{ ...EMPTY_ITEM }]);
      setLabourEntries([{ ...EMPTY_LABOUR }]); setOverheadCost('');
    }
  }

  function updateItem(index, fields) { setItems(prev => prev.map((item, i) => i === index ? { ...item, ...fields } : item)); }
  function addItem() { setItems(prev => [...prev, { ...EMPTY_ITEM }]); }
  function removeItem(index) { if (items.length > 1) setItems(prev => prev.filter((_, i) => i !== index)); }
  function updateLabour(index, fields) { setLabourEntries(prev => prev.map((entry, i) => i === index ? { ...entry, ...fields } : entry)); }
  function addLabour() { setLabourEntries(prev => [...prev, { ...EMPTY_LABOUR }]); }
  function removeLabour(index) { if (labourEntries.length > 1) setLabourEntries(prev => prev.filter((_, i) => i !== index)); }

  /* ── Cost calculations ── */
  const rawMaterialCost = items.reduce((s, item) => s + (Number(item.qty || 0) * Number(item.rate || 0)), 0);
  const labour          = labourEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const overhead        = Number(overheadCost || 0);
  const yieldQuantity   = Number(batchWeightKg) > 0 && Number(densityKgPerL) > 0
    ? Number(batchWeightKg) / Number(densityKgPerL)
    : 0;
  const costPerUnit     = yieldQuantity > 0 ? rawMaterialCost / yieldQuantity : 0;

  /* ── Save formula ── */
  async function handleSaveFormula() {
    if (!packSize) { showToast('Select pack size first'); return; }
    if (!(Number(batchWeightKg) > 0) || !(Number(densityKgPerL) > 0)) { showToast('Enter finished batch weight and paint density'); return; }
    setSaving(true);

    const payload = {
      product, pack_size: packSize, unit,
      yield_quantity: yieldQuantity,
      batch_weight_kg: Number(batchWeightKg),
      density_kg_per_l: Number(densityKgPerL),
      labour_cost: labour,
      labour_entries: labourEntries.filter(entry => entry.name.trim()).map(entry => ({ name: entry.name.trim(), amount: Number(entry.amount || 0) })),
      overhead_cost: overhead,
      updated_at: new Date().toISOString(),
    };

    let formulaId = savedFormulaId;

    if (savedFormulaId) {
      const { error } = await supabase.from('cost_formulas').update(payload).eq('id', savedFormulaId);
      if (error) { showToast(`Could not update formula: ${error.message}`); setSaving(false); return; }
      const { error: deleteError } = await supabase.from('cost_formula_items').delete().eq('formula_id', savedFormulaId);
      if (deleteError) { showToast(`Could not update materials: ${deleteError.message}`); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from('cost_formulas').insert(payload).select().single();
      if (error) { showToast(`Could not save formula: ${error.message}`); setSaving(false); return; }
      formulaId = data?.id;
      setSavedFormulaId(formulaId);
    }

    if (formulaId) {
      const { error } = await supabase.from('cost_formula_items').insert(
        items.filter(i => i.material_name && i.qty && i.rate).map(i => ({
          formula_id:    formulaId,
          material_name: i.material_name,
          qty:           Number(i.qty),
          unit:          i.unit,
          rate:          Number(i.rate),
          amount:        Number(i.qty) * Number(i.rate),
        }))
      );
      if (error) { showToast(`Formula saved, but materials failed: ${error.message}`); setSaving(false); return; }
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
              <p className="costcalc-sub">Save the material formula and yield. Labour is recorded separately; no margin is added here.</p>
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
                      {products.map(p => <option key={p}>{p}</option>)}
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
                <div className="costcalc-yield-field">
                  <div className="costcalc-density-inputs">
                    <label className="costcalc-field">Finished batch weight (kg)<input type="number" min="0.01" step="any" value={batchWeightKg} onChange={e => setBatchWeightKg(e.target.value)} placeholder="e.g. 820.36" /></label>
                    <label className="costcalc-field">Paint density (kg per litre)<input type="number" min="0.01" step="0.01" value={densityKgPerL} onChange={e => setDensityKgPerL(e.target.value)} placeholder="e.g. 1.45" /></label>
                  </div>
                  <small className="costcalc-yield-help">Litres produced = batch weight ÷ density. Your {packSize || '—'} {unit} pack is only the selling size.</small>
                  <div className="costcalc-yield-result"><span>Calculated finished volume</span><strong>{yieldQuantity > 0 ? `${yieldQuantity.toLocaleString('en-IN', { maximumFractionDigits: 2 })} L` : 'Enter weight and density'}</strong></div>
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

              {/* Labour + Overhead, kept separate from material unit cost */}
              <div className="costcalc-card">
                <div className="costcalc-card-title"><i className="ti ti-tools" /> Labour payments — kept separate</div>
                <div className="costcalc-labour-head"><span>Worker name</span><span>Salary / payment (₹)</span><span /></div>
                {labourEntries.map((entry, index) => (
                  <div className="costcalc-labour-row" key={index}>
                    <input value={entry.name} onChange={e => updateLabour(index, { name: e.target.value })} placeholder="Worker name" />
                    <input type="number" min="0" step="any" value={entry.amount} onChange={e => updateLabour(index, { amount: e.target.value })} placeholder="Payment" />
                    {labourEntries.length > 1 && <button type="button" onClick={() => removeLabour(index)} aria-label="Remove worker"><i className="ti ti-x" /></button>}
                  </div>
                ))}
                <button type="button" className="costcalc-add-btn costcalc-labour-add" onClick={addLabour}><i className="ti ti-plus" /> Add worker</button>
                <div className="costcalc-subtotal"><span>Labour total (not included above):</span><strong>{fmtAmt(labour)}</strong></div>
                <div className="costcalc-field costcalc-overhead-field">
                  <label>Overhead / other cost (₹) — separate</label>
                  <div className="costcalc-input-wrap"><span className="costcalc-prefix">₹</span><input type="number" min="0" step="any" placeholder="0" value={overheadCost} onChange={e => setOverheadCost(e.target.value)} /></div>
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
                  {product} · Sale pack {packSize} {unit}
                </div>

                <div className="costcalc-breakdown">
                  <div className="costcalc-breakdown-row subtotal">
                    <span>Raw Material Total</span>
                    <span>{fmtAmt(rawMaterialCost)}</span>
                  </div>
                  <div className="costcalc-breakdown-row"><span>Finished batch volume</span><span>{yieldQuantity ? `${yieldQuantity.toLocaleString('en-IN', { maximumFractionDigits: 2 })} L` : 'Enter weight + density'}</span></div>
                  <div className="costcalc-breakdown-row"><span>Labour (separate)</span><span>{fmtAmt(labour)}</span></div>
                  <div className="costcalc-breakdown-row"><span>Other costs (separate)</span><span>{fmtAmt(overhead)}</span></div>
                </div>

                <div className="costcalc-final">
                  <div className="costcalc-final-label">Total material production cost</div>
                  <div className="costcalc-final-val">{fmtAmt(rawMaterialCost)}</div>
                  <div className="costcalc-final-sub">{yieldQuantity ? `for ${yieldQuantity.toLocaleString('en-IN', { maximumFractionDigits: 2 })} litres produced` : 'Enter batch weight and density to calculate cost per litre'}</div>
                </div>

                {Number(yieldQuantity) > 0 && (
                  <div className="costcalc-per-unit">
                    <div className="costcalc-per-unit-label">Material production cost per 1 litre</div>
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
                          setBatchWeightKg(f.batch_weight_kg ? String(f.batch_weight_kg) : '');
                          setDensityKgPerL(f.density_kg_per_l ? String(f.density_kg_per_l) : '');
                          setUnit(f.unit);
                          setSavedFormulaId(f.id);
                          setLabourEntries(Array.isArray(f.labour_entries) && f.labour_entries.length
                            ? f.labour_entries.map(entry => ({ name: entry.name || '', amount: String(entry.amount || '') }))
                            : f.labour_cost ? [{ name: 'Labour', amount: String(f.labour_cost) }] : [{ ...EMPTY_LABOUR }]
                          );
                          setOverheadCost(String(f.overhead_cost || ''));
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
                          {Number(f.batch_weight_kg) > 0 && Number(f.density_kg_per_l) > 0
                            ? `${fmtAmt((f.cost_formula_items || []).reduce((s, i) => s + Number(i.amount || 0), 0) / (Number(f.batch_weight_kg) / Number(f.density_kg_per_l)))} / L`
                            : 'Enter weight + density'}
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
