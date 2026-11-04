import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Sidebar from '../../components/Sidebar/Sidebar';
import Topbar from '../../components/Topbar/Topbar';
import './OrderProfit.css';

const OWNER_EMAIL = 'atharvalawale383@gmail.com';
const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const norm = value => String(value ?? '').trim().toLowerCase();
const formulaTotal = formula => (formula.cost_formula_items || []).reduce(
  (sum, item) => sum + Number(item.amount ?? Number(item.qty || 0) * Number(item.rate || 0)), 0
) + Number(formula.labour_cost || 0) + Number(formula.overhead_cost || 0);

export default function OrderProfit() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [access, setAccess] = useState('checking');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [orders, setOrders] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [formulas, setFormulas] = useState([]);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('all');

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      const email = data.session?.user?.email?.toLowerCase();
      const allowed = !sessionError && email === OWNER_EMAIL;
      setAccess(allowed ? 'allowed' : 'denied');
      if (allowed) loadData();
      else setLoading(false);
    }).catch(() => { if (active) { setAccess('denied'); setLoading(false); } });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const allowed = session?.user?.email?.toLowerCase() === OWNER_EMAIL;
      setAccess(allowed ? 'allowed' : 'denied');
      if (allowed) loadData();
      else { setOrders([]); setOrderItems([]); setFormulas([]); setLoading(false); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    const [ordersResult, itemsResult, formulasResult] = await Promise.all([
      supabase.from('orders').select('*').order('date', { ascending: false }),
      supabase.from('order_items').select('*'),
      supabase.from('cost_formulas').select('*, cost_formula_items(*)'),
    ]);
    const failure = ordersResult.error || itemsResult.error || formulasResult.error;
    if (failure) setError(`Could not load profit data: ${failure.message}`);
    setOrders(ordersResult.data || []);
    setOrderItems(itemsResult.data || []);
    setFormulas(formulasResult.data || []);
    setLoading(false);
  }

  const analyzedOrders = useMemo(() => orders
    .filter(order => order.status !== 'cancelled')
    .map(order => {
      const rows = orderItems.filter(item => String(item.order_id) === String(order.id));
      const lines = rows.length ? rows : (order.product ? [{
        product: order.product,
        pack_size: order.pack_size,
        unit: order.unit,
        qty: order.qty,
        amount: order.total_amount ?? order.amount,
      }] : []);
      let estimatedCost = 0;
      let missing = 0;
      const details = lines.map(line => {
        const formula = formulas.find(candidate =>
          norm(candidate.product) === norm(line.product) &&
          Number(candidate.pack_size) === Number(line.pack_size) &&
          norm(candidate.unit) === norm(line.unit)
        );
        if (!formula) { missing += 1; return { ...line, cost: null }; }
        const yieldQuantity = Number(formula.yield_quantity || formula.pack_size || 0);
        if (!yieldQuantity) { missing += 1; return { ...line, cost: null }; }
        const perOutputUnit = formulaTotal(formula) / yieldQuantity;
        const lineCost = perOutputUnit * Number(line.pack_size || 1) * Number(line.qty || 0);
        estimatedCost += lineCost;
        return { ...line, cost: lineCost, perUnitCost: perOutputUnit };
      });
      const revenue = Number(order.total_amount ?? order.amount ?? lines.reduce((sum, line) => sum + Number(line.amount || 0), 0));
      const profit = missing === 0 && lines.length ? revenue - estimatedCost : null;
      return { ...order, revenue, estimatedCost, profit, margin: profit !== null && revenue > 0 ? profit / revenue * 100 : null, missing, details };
    }), [orders, orderItems, formulas]);

  const visibleOrders = useMemo(() => {
    const now = new Date();
    const minDate = period === '30d' ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)
      : period === '90d' ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90)
      : period === 'month' ? new Date(now.getFullYear(), now.getMonth(), 1)
      : null;
    const term = search.trim().toLowerCase();
    return analyzedOrders.filter(order => {
      const date = new Date(`${order.date || order.created_at || ''}T00:00:00`);
      const dateMatches = !minDate || (Number.isFinite(date.getTime()) && date >= minDate);
      const textMatches = !term || [order.order_number, order.dealer_name, order.location]
        .some(value => String(value || '').toLowerCase().includes(term));
      return dateMatches && textMatches;
    });
  }, [analyzedOrders, period, search]);

  const stats = visibleOrders.reduce((sum, order) => ({
    revenue: sum.revenue + order.revenue,
    costedRevenue: sum.costedRevenue + (order.profit === null ? 0 : order.revenue),
    cost: sum.cost + (order.profit === null ? 0 : order.estimatedCost),
    profit: sum.profit + (order.profit ?? 0),
    count: sum.count + 1,
    missing: sum.missing + order.missing,
    pricedOrders: sum.pricedOrders + (order.profit === null ? 0 : 1),
  }), { revenue: 0, costedRevenue: 0, cost: 0, profit: 0, count: 0, missing: 0, pricedOrders: 0 });
  const margin = stats.costedRevenue > 0 ? stats.profit / stats.costedRevenue * 100 : 0;

  if (access === 'checking') return <div className="profit-access">Checking private access…</div>;
  if (access === 'denied') return <div className="profit-access"><h1>Private page</h1><p>Sign in with the authorized Victorex account to view order profit.</p></div>;

  return (
    <div className="profit-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="profit-main">
        <Topbar title="Private Order Profit" onMenuClick={() => setSidebarOpen(true)} />
        <div className="profit-content">
          <header className="profit-header">
            <div><span className="profit-eyebrow"><i className="ti ti-lock" /> PRIVATE · OWNER ONLY</span><h1>Order profit</h1><p>Estimated gross profit using saved product formulas and order selling prices.</p></div>
            <div className="profit-controls">
              <div className="profit-search"><i className="ti ti-search" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order or dealer" /></div>
              <select value={period} onChange={e => setPeriod(e.target.value)} aria-label="Select time period"><option value="all">All time</option><option value="month">This month</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option></select>
            </div>
          </header>

          {error && <div className="profit-error" role="alert">{error}</div>}
          {stats.missing > 0 && !loading && <div className="profit-note"><i className="ti ti-info-circle" /> {stats.missing} order line{stats.missing === 1 ? ' has' : 's have'} no matching saved formula. Profit is left blank for those orders until you save that product and pack formula in Cost Calculator.</div>}

          <section className="profit-kpis">
            <Kpi label="Order sales" value={money(stats.revenue)} icon="ti-receipt" />
            <Kpi label="Estimated production cost" value={money(stats.cost)} icon="ti-package" />
            <Kpi label="Estimated gross profit" value={money(stats.profit)} icon="ti-trending-up" tone={stats.profit < 0 ? 'negative' : 'positive'} />
            <Kpi label="Gross margin" value={`${margin.toFixed(1)}%`} icon="ti-chart-pie" note={`From ${stats.pricedOrders} costed orders`} />
          </section>

          <section className="profit-panel">
            <div className="profit-panel-head"><div><h2>Profit by order</h2><p>Cancelled orders are excluded. Orders without a saved formula are marked.</p></div><button type="button" onClick={loadData} className="profit-refresh"><i className="ti ti-refresh" /> Refresh</button></div>
            {loading ? <div className="profit-empty">Loading order profit…</div> : visibleOrders.length === 0 ? <div className="profit-empty">No orders match these filters.</div> : (
              <div className="profit-table-wrap"><table className="profit-table"><thead><tr><th>Order</th><th>Date</th><th>Dealer</th><th>Products</th><th>Sales</th><th>Est. cost</th><th>Est. profit</th><th>Margin</th></tr></thead><tbody>
                {visibleOrders.map(order => <tr key={order.id}>
                  <td><strong>{order.order_number || `Order ${String(order.id).slice(0, 8)}`}</strong><small className="profit-status">{order.status || '—'}</small></td>
                  <td>{order.date || '—'}</td>
                  <td><strong>{order.dealer_name || '—'}</strong><small>{order.location || ''}</small></td>
                  <td><div className="profit-products">{order.details.map((line, i) => <span key={`${line.product}-${i}`}>{line.product} · {line.qty} × {line.pack_size} {line.unit}{line.cost === null && <em>formula needed</em>}</span>)}</div></td>
                  <td>{money(order.revenue)}</td>
                  <td>{order.profit === null ? '—' : money(order.estimatedCost)}</td>
                  <td className={order.profit === null ? '' : order.profit < 0 ? 'profit-loss' : 'profit-gain'}>{order.profit === null ? '—' : money(order.profit)}</td>
                  <td>{order.margin === null ? '—' : `${order.margin.toFixed(1)}%`}</td>
                </tr>)}
              </tbody></table></div>
            )}
          </section>
          <p className="profit-footnote">This is estimated gross profit, not cash collected. It uses saved formula costs; update formulas in Cost Calculator when costs change.</p>
        </div>
      </main>
    </div>
  );
}

function Kpi({ label, value, icon, tone, note }) {
  return <article className={`profit-kpi${tone ? ` ${tone}` : ''}`}><div className="profit-kpi-icon"><i className={`ti ${icon}`} /></div><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</article>;
}
