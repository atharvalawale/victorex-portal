import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import Topbar from '../../components/Topbar/Topbar';
import { supabase } from '../../lib/supabase';
import './BatchCosting.css';

const OWNER_EMAIL = 'atharvalawale383@gmail.com';
const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = () => ({ name: '', amount: '' });
const emptyForm = () => ({
  product: '',
  batch_reference: '',
  batch_date: today(),
  quantity_produced: '',
  unit: 'kg',
  selling_price_per_unit: '',
  transport_cost: '',
  electricity_cost: '',
  notes: '',
  materials: [emptyLine()],
  labour: [emptyLine()],
  other_expenses: [emptyLine()],
});
const money = value =>
  `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function BatchCosting() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [auth, setAuth] = useState('checking');
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;

      const email = data.session?.user?.email?.toLowerCase();
      setAuth(email === OWNER_EMAIL ? 'allowed' : 'denied');

      if (email === OWNER_EMAIL) loadData();
      else setLoading(false);
    }).catch(() => {
      if (active) {
        setAuth('denied');
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      const email = session?.user?.email?.toLowerCase();
      setAuth(email === OWNER_EMAIL ? 'allowed' : 'denied');

      if (email === OWNER_EMAIL) loadData();
      else {
        setRows([]);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function loadData() {
    setLoading(true);

    const [batchResult, productResult] = await Promise.all([
      supabase
        .from('production_batches')
        .select('*')
        .order('batch_date', { ascending: false }),
      supabase.from('pack_sizes').select('product').order('product'),
    ]);

    if (batchResult.error) {
      setNotice(
        `Could not load batches: ${batchResult.error.message}. Run the Batch Costing SQL setup first.`
      );
    } else {
      setRows(batchResult.data || []);
    }

    setProducts(
      [...new Set((productResult.data || []).map(item => item.product).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b))
    );
    setLoading(false);
  }

  const lineTotal = lines =>
    lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);

  const materialTotal = lineTotal(form.materials);
  const labourTotal = lineTotal(form.labour);
  const otherTotal = lineTotal(form.other_expenses);

  const totalCost =
    materialTotal +
    labourTotal +
    otherTotal +
    Number(form.transport_cost || 0) +
    Number(form.electricity_cost || 0);

  const quantity = Number(form.quantity_produced || 0);
  const unitCost = quantity > 0 ? totalCost / quantity : 0;
  const revenue = quantity * Number(form.selling_price_per_unit || 0);
  const estimatedProfit = revenue - totalCost;

  function editLine(group, index, field, value) {
    setForm(current => ({
      ...current,
      [group]: current[group].map((line, i) =>
        i === index ? { ...line, [field]: value } : line
      ),
    }));
  }

  function addLine(group) {
    setForm(current => ({
      ...current,
      [group]: [...current[group], emptyLine()],
    }));
  }

  function removeLine(group, index) {
    setForm(current => ({
      ...current,
      [group]: current[group].filter((_, i) => i !== index),
    }));
  }

  async function saveBatch(event) {
    event.preventDefault();

    if (auth !== 'allowed') return;

    if (!form.product || quantity <= 0) {
      setNotice('Choose a product and enter the quantity produced.');
      return;
    }

    setSaving(true);
    setNotice('');

    const payload = {
      product: form.product,
      batch_reference: form.batch_reference.trim() || null,
      batch_date: form.batch_date,
      quantity_produced: quantity,
      unit: form.unit,
      selling_price_per_unit: Number(form.selling_price_per_unit || 0),
      materials: form.materials
        .filter(line => line.name.trim())
        .map(line => ({
          name: line.name.trim(),
          amount: Number(line.amount || 0),
        })),
      labour: form.labour
        .filter(line => line.name.trim())
        .map(line => ({
          name: line.name.trim(),
          amount: Number(line.amount || 0),
        })),
      other_expenses: form.other_expenses
        .filter(line => line.name.trim())
        .map(line => ({
          name: line.name.trim(),
          amount: Number(line.amount || 0),
        })),
      transport_cost: Number(form.transport_cost || 0),
      electricity_cost: Number(form.electricity_cost || 0),
      notes: form.notes.trim() || null,
    };

    const { error } = await supabase
      .from('production_batches')
      .insert(payload);

    if (error) {
      setNotice(`Could not save batch: ${error.message}`);
    } else {
      setNotice('Batch saved. Cost and estimated profit are recorded.');
      setForm(emptyForm());
      await loadData();
    }

    setSaving(false);
  }

  const totals = useMemo(
    () =>
      rows.reduce(
        (sum, row) => {
          const materials = lineTotal(row.materials || []);
          const labour = lineTotal(row.labour || []);
          const other = lineTotal(row.other_expenses || []);
          const cost =
            materials +
            labour +
            other +
            Number(row.transport_cost || 0) +
            Number(row.electricity_cost || 0);
          const sales =
            Number(row.quantity_produced || 0) *
            Number(row.selling_price_per_unit || 0);

          return {
            cost: sum.cost + cost,
            profit: sum.profit + sales - cost,
          };
        },
        { cost: 0, profit: 0 }
      ),
    [rows]
  );

  if (auth === 'checking') {
    return <div className="batch-access-message">Checking private access…</div>;
  }

  if (auth === 'denied') {
    return (
      <div className="batch-access-message">
        <h1>Private page</h1>
        <p>This page is only available to the authorized Victorex account.</p>
        <button onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    );
  }

  return (
    <div className="batch-shell">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="batch-main">
        <Topbar
          title="Private Batch Costing"
          onMenuClick={() => setSidebarOpen(true)}
        />

        <div className="batch-content">
          <header className="batch-heading">
            <div>
              <span className="batch-eyebrow">OWNER ONLY · PRODUCTION</span>
              <h1>Batch costing &amp; profit</h1>
              <p>
                Record production expenses to see cost per unit and expected
                batch profit.
              </p>
            </div>
            <span className="batch-lock">
              <i className="ti ti-lock" /> Private
            </span>
          </header>

          {notice && (
            <div className="batch-notice" role="status">
              {notice}
            </div>
          )}

          <form className="batch-panel" onSubmit={saveBatch}>
            <div className="batch-panel-title">
              <h2>New production batch</h2>
              <p>
                Enter this batch’s share of the monthly electricity bill.
              </p>
            </div>

            <div className="batch-fields">
              <label>
                Product
                <select
                  value={form.product}
                  onChange={e => setForm({ ...form, product: e.target.value })}
                  required
                >
                  <option value="">Select a product</option>
                  {products.map(product => (
                    <option key={product}>{product}</option>
                  ))}
                </select>
              </label>

              <label>
                Batch name / reference
                <input
                  value={form.batch_reference}
                  onChange={e =>
                    setForm({ ...form, batch_reference: e.target.value })
                  }
                  placeholder="e.g. November batch 1"
                />
              </label>

              <label>
                Production date
                <input
                  type="date"
                  value={form.batch_date}
                  onChange={e =>
                    setForm({ ...form, batch_date: e.target.value })
                  }
                  required
                />
              </label>

              <label>
                Quantity produced
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={form.quantity_produced}
                  onChange={e =>
                    setForm({ ...form, quantity_produced: e.target.value })
                  }
                  required
                />
              </label>

              <label>
                Unit
                <select
                  value={form.unit}
                  onChange={e => setForm({ ...form, unit: e.target.value })}
                >
                  <option>kg</option>
                  <option>ltr</option>
                  <option>g</option>
                  <option>ml</option>
                  <option>pieces</option>
                  <option>buckets</option>
                  <option>bags</option>
                </select>
              </label>

              <label>
                Selling price per unit (₹)
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.selling_price_per_unit}
                  onChange={e =>
                    setForm({
                      ...form,
                      selling_price_per_unit: e.target.value,
                    })
                  }
                />
              </label>
            </div>

            <div className="batch-cost-columns">
              <CostLines
                title="Raw materials"
                lines={form.materials}
                total={materialTotal}
                onAdd={() => addLine('materials')}
                onChange={(i, field, value) =>
                  editLine('materials', i, field, value)
                }
                onRemove={i => removeLine('materials', i)}
              />

              <CostLines
                title="Labour & payments"
                lines={form.labour}
                total={labourTotal}
                namePlaceholder="Worker name"
                onAdd={() => addLine('labour')}
                onChange={(i, field, value) =>
                  editLine('labour', i, field, value)
                }
                onRemove={i => removeLine('labour', i)}
              />

              <CostLines
                title="Other expenses"
                lines={form.other_expenses}
                total={otherTotal}
                namePlaceholder="e.g. Packaging"
                onAdd={() => addLine('other_expenses')}
                onChange={(i, field, value) =>
                  editLine('other_expenses', i, field, value)
                }
                onRemove={i => removeLine('other_expenses', i)}
              />
            </div>

            <div className="batch-fields batch-overheads">
              <label>
                Transport for this batch (₹)
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.transport_cost}
                  onChange={e =>
                    setForm({ ...form, transport_cost: e.target.value })
                  }
                />
              </label>

              <label>
                Electricity share for this batch (₹)
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.electricity_cost}
                  onChange={e =>
                    setForm({ ...form, electricity_cost: e.target.value })
                  }
                />
              </label>

              <label className="batch-notes-field">
                Notes
                <textarea
                  rows="2"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Optional batch notes"
                />
              </label>
            </div>

            <div className="batch-summary">
              <Summary label="Total batch cost" value={money(totalCost)} />
              <Summary
                label="Production cost / unit"
                value={money(unitCost)}
                note={quantity ? `per ${form.unit}` : 'Enter quantity'}
              />
              <Summary
                label="Expected sales value"
                value={money(revenue)}
                note="if all produced units sell"
              />
              <Summary
                label="Estimated profit"
                value={money(estimatedProfit)}
                positive={estimatedProfit >= 0}
              />
            </div>

            <button
              className="batch-save"
              type="submit"
              disabled={saving || !products.length}
            >
              <i className="ti ti-device-floppy" />
              {saving ? 'Saving batch…' : 'Save private batch record'}
            </button>
          </form>

          <section className="batch-panel batch-history">
            <div className="batch-history-heading">
              <div>
                <h2>Saved batches</h2>
                <p>Visible only to the authorized account</p>
              </div>
              <div className="batch-history-totals">
                <span>
                  Total recorded cost <strong>{money(totals.cost)}</strong>
                </span>
                <span>
                  Estimated profit <strong>{money(totals.profit)}</strong>
                </span>
              </div>
            </div>

            {loading ? (
              <div className="batch-empty">Loading batch records…</div>
            ) : rows.length === 0 ? (
              <div className="batch-empty">No batches saved yet.</div>
            ) : (
              <div className="batch-table-wrap">
                <table className="batch-table">
                  <thead>
                    <tr>
                      <th>Batch</th>
                      <th>Date</th>
                      <th>Quantity</th>
                      <th>Total cost</th>
                      <th>Cost / unit</th>
                      <th>Est. profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => {
                      const cost =
                        lineTotal(row.materials || []) +
                        lineTotal(row.labour || []) +
                        lineTotal(row.other_expenses || []) +
                        Number(row.transport_cost || 0) +
                        Number(row.electricity_cost || 0);
                      const qty = Number(row.quantity_produced || 0);
                      const profit =
                        qty * Number(row.selling_price_per_unit || 0) - cost;

                      return (
                        <tr key={row.id}>
                          <td>
                            <strong>{row.product}</strong>
                            <small>
                              {row.batch_reference || 'Production batch'}
                            </small>
                          </td>
                          <td>{row.batch_date}</td>
                          <td>
                            {qty.toLocaleString('en-IN')} {row.unit}
                          </td>
                          <td>{money(cost)}</td>
                          <td>{money(qty ? cost / qty : 0)}</td>
                          <td className={profit < 0 ? 'batch-loss' : 'batch-profit'}>
                            {money(profit)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function Summary({ label, value, note, positive }) {
  const className =
    positive === undefined
      ? 'batch-summary-card'
      : `batch-summary-card ${positive ? 'is-positive' : 'is-negative'}`;

  return (
    <div className={className}>
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}

function CostLines({
  title,
  lines,
  onAdd,
  onChange,
  onRemove,
  total,
  namePlaceholder = 'Material name',
}) {
  return (
    <section className="batch-cost-card">
      <header>
        <h3>{title}</h3>
        <strong>{money(total)}</strong>
      </header>

      {lines.map((line, index) => (
        <div className="batch-line" key={index}>
          <input
            aria-label={`${title} name ${index + 1}`}
            value={line.name}
            onChange={e => onChange(index, 'name', e.target.value)}
            placeholder={namePlaceholder}
          />
          <input
            aria-label={`${title} cost ${index + 1}`}
            type="number"
            min="0"
            step="any"
            value={line.amount}
            onChange={e => onChange(index, 'amount', e.target.value)}
            placeholder="Cost ₹"
          />
          {lines.length > 1 && (
            <button
              type="button"
              onClick={() => onRemove(index)}
              aria-label="Remove row"
            >
              <i className="ti ti-x" />
            </button>
          )}
        </div>
      ))}

      <button className="batch-add-line" type="button" onClick={onAdd}>
        <i className="ti ti-plus" /> Add line
      </button>
    </section>
  );
}