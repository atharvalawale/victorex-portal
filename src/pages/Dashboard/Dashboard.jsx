import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import Sidebar from '../../components/Sidebar/Sidebar';
import Topbar from '../../components/Topbar/Topbar';
import { supabase } from '../../lib/supabase';
import './Dashboard.css';

const PRODUCT_COLORS = { 'WallVex Pro': '#17877C', Chromvex: '#426F83', Primvex: '#E99268' };
const FALLBACK_PRODUCT_COLORS = ['#7B8E99', '#9A7DA8', '#C18E52'];
const productKey = (name) => `product_${[...String(name)].map(char => char.codePointAt(0).toString(16)).join('_') || 'unknown'}`;
const productColor = (name) => {
  if (PRODUCT_COLORS[name]) return PRODUCT_COLORS[name];
  const hash = [...String(name)].reduce((sum, char) => sum + char.codePointAt(0), 0);
  return FALLBACK_PRODUCT_COLORS[hash % FALLBACK_PRODUCT_COLORS.length];
};
const STATUS_META = {
  pending: { label: 'Pending', color: '#D28B3C' },
  processing: { label: 'Processing', color: '#4387A0' },
  delivered: { label: 'Delivered', color: '#21856C' },
  cancelled: { label: 'Cancelled', color: '#C65C50' },
};

const localDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const amountOf = (row) => Number(row?.total_amount ?? row?.amount ?? 0) || 0;
const fmtFull = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmtCompact = (n) => {
  const value = Number(n || 0);
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
  return `₹${value.toLocaleString('en-IN')}`;
};
const shortDate = (key) => key ? new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—';

function makeDateRange(preset, customFrom, customTo) {
  const today = new Date();
  const todayKey = localDateKey(today);
  if (preset === 'custom') return { from: customFrom || todayKey, to: customTo || todayKey, label: 'Selected dates' };
  if (preset === 'all') return { from: '0001-01-01', to: todayKey, label: 'All time' };
  if (preset === 'month') return { from: localDateKey(new Date(today.getFullYear(), today.getMonth(), 1)), to: todayKey, label: 'This month' };
  if (preset === 'lastMonth') {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: localDateKey(first), to: localDateKey(last), label: 'Last month' };
  }
  if (preset === 'year') return { from: `${today.getFullYear()}-01-01`, to: todayKey, label: 'This year' };
  const start = new Date(today);
  start.setDate(start.getDate() - (preset === '90d' ? 89 : 29));
  return { from: localDateKey(start), to: todayKey, label: preset === '90d' ? 'Last 90 days' : 'Last 30 days' };
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="dash-chart-tooltip">
      <strong>{label}</strong>
      {payload.map((item) => (
        <div key={item.dataKey} style={{ color: item.color }}>
          <span>{item.name}</span><b>{typeof item.value === 'number' ? fmtFull(item.value) : item.value}</b>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [dataNotice, setDataNotice] = useState('');
  const [orders, setOrders] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [payments, setPayments] = useState([]);
  const [dealers, setDealers] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [period, setPeriod] = useState('month');
  const [customFrom, setCustomFrom] = useState(localDateKey());
  const [customTo, setCustomTo] = useState(localDateKey());
  const [productFilter, setProductFilter] = useState('all');
  const [dealerFilter, setDealerFilter] = useState('all');

  useEffect(() => { fetchDashboard(); }, []);

  async function fetchDashboard() {
    setLoading(true);
    setLoadError('');
    setDataNotice('');
    try {
      const [ordersRes, itemsRes, paymentsRes, dealersRes, catalogRes] = await Promise.all([
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('order_items').select('*'),
        supabase.from('payments').select('*'),
        supabase.from('dealers').select('id, name, location, status'),
        supabase.from('pack_sizes').select('product'),
      ]);
      if (ordersRes.error) throw ordersRes.error;
      setOrders(ordersRes.data || []);
      setOrderItems(itemsRes.error ? [] : (itemsRes.data || []));
      setPayments(paymentsRes.error ? [] : (paymentsRes.data || []));
      setDealers(dealersRes.data || []);
      setCatalogProducts(catalogRes.error ? [] : [...new Set((catalogRes.data || []).map(row => String(row.product || '').trim()).filter(Boolean))]);
      const notices = [];
      if (itemsRes.error) notices.push('Product detail is unavailable, so product charts use the order-level product field.');
      if (paymentsRes.error) notices.push('Payment data could not be loaded; check payment table access in Supabase.');
      if (catalogRes.error) notices.push('The product catalog could not be loaded; filters include products already present in orders.');
      setDataNotice(notices.join(' '));
      if (itemsRes.error) console.info('Product detail unavailable; dashboard is using order totals.', itemsRes.error.message);
    } catch (error) {
      setLoadError(error.message || 'Could not load dashboard data.');
    } finally {
      setLoading(false);
    }
  }

  const dateRange = makeDateRange(period, customFrom, customTo);
  const normalized = useMemo(() => {
    const orderById = new Map(orders.map(order => [String(order.id), order]));
    const itemsByOrder = new Map();
    orderItems.forEach(item => {
      const key = String(item.order_id);
      if (!itemsByOrder.has(key)) itemsByOrder.set(key, []);
      itemsByOrder.get(key).push(item);
    });
    const lines = [];
    orders.forEach(order => {
      const key = String(order.id);
      const linesForOrder = itemsByOrder.get(key);
      const date = String(order.date || order.created_at || '').slice(0, 10);
      if (linesForOrder?.length) {
        linesForOrder.forEach((item, index) => lines.push({
          key: `${key}-${item.id || index}`,
          orderId: key,
          date,
          dealer: order.dealer_name || 'Unknown dealer',
          product: String(item.product || order.product || 'Other').trim() || 'Other',
          amount: Number(item.amount) || Number(item.qty || 0) * Number(item.rate || 0),
          status: order.status || 'pending',
        }));
      } else {
        lines.push({
          key,
          orderId: key,
          date,
          dealer: order.dealer_name || 'Unknown dealer',
          product: String(order.product || 'Other').trim() || 'Other',
          amount: amountOf(order),
          status: order.status || 'pending',
        });
      }
    });
    return { orderById, lines };
  }, [orders, orderItems]);

  const sliceLines = (from, to, applyProduct = true) => normalized.lines.filter(line =>
    line.date >= from && line.date <= to &&
    (dealerFilter === 'all' || line.dealer === dealerFilter) &&
    (!applyProduct || productFilter === 'all' || line.product === productFilter)
  );
  const selectedLines = sliceLines(dateRange.from, dateRange.to);
  const salesLines = selectedLines.filter(line => line.status !== 'cancelled');
  const selectedOrderIds = new Set(selectedLines.map(line => line.orderId));
  const productsByOrder = new Map();
  normalized.lines.forEach(line => {
    if (!productsByOrder.has(line.orderId)) productsByOrder.set(line.orderId, new Set());
    productsByOrder.get(line.orderId).add(line.product);
  });
  const matchingProductDealerOrderIds = new Set(normalized.lines.filter(line =>
    (dealerFilter === 'all' || line.dealer === dealerFilter) &&
    (productFilter === 'all' || line.product === productFilter)
  ).map(line => line.orderId));
  const salesOrderIds = new Set(salesLines.map(line => line.orderId));
  const salesTotal = salesLines.reduce((sum, line) => sum + line.amount, 0);
  const averageOrder = salesOrderIds.size ? salesTotal / salesOrderIds.size : 0;
  const selectedOrders = orders.filter(order => selectedOrderIds.has(String(order.id)));
  const currentPayments = payments.filter(payment => {
    const date = String(payment.date || payment.created_at || '').slice(0, 10);
    const linkedOrder = payment.order_id ? normalized.orderById.get(String(payment.order_id)) : null;
    const dealerName = payment.dealer_name || linkedOrder?.dealer_name;
    const linkedOrderId = String(payment.order_id || '');
    const linkedProducts = productsByOrder.get(linkedOrderId);
    const linkedProductMatch = productFilter === 'all' || (
      payment.order_id && matchingProductDealerOrderIds.has(linkedOrderId) &&
      linkedProducts?.size === 1 && linkedProducts.has(productFilter)
    );
    return date >= dateRange.from && date <= dateRange.to &&
      (dealerFilter === 'all' || dealerName === dealerFilter) && linkedProductMatch;
  });
  const collectedTotal = currentPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const rangeDays = Math.max(1, Math.round((new Date(`${dateRange.to}T00:00:00`) - new Date(`${dateRange.from}T00:00:00`)) / 86400000) + 1);
  const compareEndDate = new Date(`${dateRange.from}T00:00:00`);
  compareEndDate.setDate(compareEndDate.getDate() - 1);
  const compareStartDate = new Date(compareEndDate);
  compareStartDate.setDate(compareStartDate.getDate() - rangeDays + 1);
  const previousLines = period === 'all' ? [] : sliceLines(localDateKey(compareStartDate), localDateKey(compareEndDate)).filter(line => line.status !== 'cancelled');
  const previousSales = previousLines.reduce((sum, line) => sum + line.amount, 0);
  const salesChange = previousSales > 0 ? ((salesTotal - previousSales) / previousSales) * 100 : null;

  const availableProducts = [...new Set([...catalogProducts, ...normalized.lines.map(line => line.product)])]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const productSummary = availableProducts.map((name, index) => ({
    name,
    value: salesLines.filter(line => line.product === name).reduce((sum, line) => sum + line.amount, 0),
    color: productColor(name, index),
  })).filter(item => item.value > 0);
  const productRevenueTotal = productSummary.reduce((sum, item) => sum + item.value, 0);
  const topProduct = [...productSummary].sort((a, b) => b.value - a.value)[0];

  const dealerSummary = [...salesLines.reduce((map, line) => {
    const current = map.get(line.dealer) || { name: line.dealer, revenue: 0, orderIds: new Set() };
    current.revenue += line.amount;
    current.orderIds.add(line.orderId);
    map.set(line.dealer, current);
    return map;
  }, new Map()).values()]
    .map(dealer => ({ ...dealer, orderCount: dealer.orderIds.size }))
    .sort((a, b) => b.revenue - a.revenue);
  const topDealers = dealerSummary.slice(0, 5);
  const topDealer = topDealers[0];

  const statusCounts = Object.keys(STATUS_META).map(status => ({
    status,
    ...STATUS_META[status],
    count: selectedOrders.filter(order => (order.status || 'pending') === status).length,
  }));
  const statusTotal = statusCounts.reduce((sum, status) => sum + status.count, 0);
  const pendingCount = statusCounts.find(status => status.status === 'pending')?.count || 0;
  const deliveredCount = statusCounts.find(status => status.status === 'delivered')?.count || 0;

  const trendData = [...salesLines.reduce((map, line) => {
    const key = rangeDays <= 45 ? line.date : `${line.date.slice(0, 7)}-01`;
    if (!key || key.length < 10) return map;
    if (!map.has(key)) map.set(key, { key, label: rangeDays <= 45 ? shortDate(key) : new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) });
    const row = map.get(key);
    const keyName = productKey(line.product);
    row[keyName] = (row[keyName] || 0) + line.amount;
    return map;
  }, new Map()).values()].sort((a, b) => a.key.localeCompare(b.key));
  const visibleProducts = productFilter === 'all' ? availableProducts : [productFilter];
  const recentOrders = [...selectedOrders].sort((a, b) => String(b.date || b.created_at || '').localeCompare(String(a.date || a.created_at || ''))).slice(0, 6);
  const periodLabel = period === 'all' ? 'All recorded dates' : `${shortDate(dateRange.from)} – ${shortDate(dateRange.to)}`;
  const productFilterNote = productFilter === 'all' ? 'for selected dates and dealer' : 'single-product linked receipts only';

  if (loading) return (
    <div className="dashboard-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="dashboard-main"><Topbar onMenuClick={() => setSidebarOpen(true)} />
        <div className="dashboard-loading"><span className="dashboard-loader" />Preparing your business overview…</div>
      </div>
    </div>
  );

  return (
    <div className="dashboard-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="dashboard-main">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="dashboard-content">
          <section className="dashboard-welcome">
            <div className="dashboard-welcome-copy">
              <span className="dashboard-eyebrow">VICTOREX · BUSINESS INTELLIGENCE</span>
              <h2>Business overview</h2>
              <p>Explore sales, products, dealers and collections.</p>
            </div>
            <div className="dashboard-header-actions">
              <button className="dashboard-secondary-action" onClick={() => navigate('/analytics')}><i className="ti ti-target-arrow" /> Set a goal</button>
              <button className="dashboard-quick-order" onClick={() => navigate('/orders')}><i className="ti ti-plus" /> New order</button>
            </div>
          </section>

          {loadError && <div className="dashboard-error" role="alert">{loadError} <button onClick={fetchDashboard}>Try again</button></div>}
          {dataNotice && <div className="dashboard-data-warning" role="status"><i className="ti ti-info-circle" />{dataNotice}</div>}

          <section className="dashboard-filters" aria-label="Dashboard filters">
            <div className="dashboard-filter-heading"><i className="ti ti-adjustments-horizontal" /><span>Slice your data</span></div>
            <label className="dashboard-filter">
              <span>Period</span>
              <select value={period} onChange={event => setPeriod(event.target.value)}>
                <option value="month">This month</option>
                <option value="lastMonth">Last month</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="year">This year</option>
                <option value="all">All time</option>
                <option value="custom">Custom range</option>
              </select>
            </label>
            {period === 'custom' && <>
              <label className="dashboard-filter"><span>From</span><input type="date" value={customFrom} max={localDateKey()} onChange={event => { const value = event.target.value; setCustomFrom(value); if (value > customTo) setCustomTo(value); }} /></label>
              <label className="dashboard-filter"><span>To</span><input type="date" value={customTo} max={localDateKey()} onChange={event => { const value = event.target.value; setCustomTo(value); if (value < customFrom) setCustomFrom(value); }} /></label>
            </>}
            <label className="dashboard-filter">
              <span>Product</span>
              <select value={productFilter} onChange={event => setProductFilter(event.target.value)}>
                <option value="all">All products</option>
                {availableProducts.map(product => <option key={product} value={product}>{product}</option>)}
              </select>
            </label>
            <label className="dashboard-filter">
              <span>Dealer</span>
              <select value={dealerFilter} onChange={event => setDealerFilter(event.target.value)}>
                <option value="all">All dealers</option>
                {dealers.map(dealer => <option key={dealer.id || dealer.name} value={dealer.name}>{dealer.name}</option>)}
              </select>
            </label>
            {(productFilter !== 'all' || dealerFilter !== 'all' || period !== 'month') && (
              <button className="dashboard-reset-filter" onClick={() => { setPeriod('month'); setProductFilter('all'); setDealerFilter('all'); setCustomFrom(localDateKey()); setCustomTo(localDateKey()); }}>Reset</button>
            )}
          </section>

          <div className="dashboard-slice-caption"><span>{dateRange.label}</span><span>{periodLabel}</span></div>

          <section className="kpi-grid dashboard-kpis" aria-label="Key performance indicators">
            <article className="kpi-card kpi-revenue">
              <div className="kpi-accent" /><div className="kpi-icon-wrap"><i className="ti ti-chart-line" /></div>
              <div className="kpi-label">Sales revenue</div><div className="kpi-value">{fmtFull(salesTotal)}</div>
              <div className={`kpi-trend ${salesChange === null ? 'info' : salesChange >= 0 ? 'up' : 'down'}`}>
                <i className={`ti ${salesChange === null ? 'ti-minus' : salesChange >= 0 ? 'ti-trending-up' : 'ti-trending-down'}`} />
                {salesChange === null ? (period === 'all' ? 'All recorded sales' : 'No previous period sales') : `${salesChange >= 0 ? '+' : ''}${salesChange.toFixed(1)}% vs prior period`}
              </div>
            </article>
            <article className="kpi-card kpi-orders">
              <div className="kpi-accent" /><div className="kpi-icon-wrap"><i className="ti ti-shopping-bag" /></div>
              <div className="kpi-label">Sales orders</div><div className="kpi-value">{salesOrderIds.size.toLocaleString('en-IN')}</div>
              <div className="kpi-trend info"><i className="ti ti-calendar-stats" />{pendingCount} pending · {deliveredCount} delivered</div>
            </article>
            <article className="kpi-card kpi-average">
              <div className="kpi-accent" /><div className="kpi-icon-wrap"><i className="ti ti-receipt-2" /></div>
              <div className="kpi-label">Average sales per order</div><div className="kpi-value">{fmtFull(averageOrder)}</div>
              <div className="kpi-trend info"><i className="ti ti-math-average" />Selected sales ÷ matching orders</div>
            </article>
            <article className="kpi-card kpi-collected">
              <div className="kpi-accent" /><div className="kpi-icon-wrap"><i className="ti ti-wallet" /></div>
              <div className="kpi-label">Payments received</div><div className="kpi-value">{fmtFull(collectedTotal)}</div>
              <div className="kpi-trend info"><i className="ti ti-info-circle" />{productFilterNote}</div>
            </article>
          </section>

          <section className="dashboard-insight-strip" aria-label="Business insights">
            <div className="dashboard-insight-icon"><i className="ti ti-bulb" /></div>
            <div><span>Period insight</span><strong>
              {salesLines.length === 0 ? 'No sales match these filters yet.' : <>
                {topProduct ? `${topProduct.name} leads with ${Math.round((topProduct.value / Math.max(salesTotal, 1)) * 100)}% of sales` : 'Sales are recorded'}
                {topDealer ? ` · ${topDealer.name} is the top dealer` : ''}
              </>}
            </strong></div>
            <span className="dashboard-insight-range">{periodLabel}</span>
          </section>

          <section className="dashboard-chart-grid">
            <article className="dash-card dashboard-chart-card dashboard-trend-card">
              <div className="dash-section-hdr">
                <div><span className="dashboard-chart-kicker">PERFORMANCE OVER TIME</span><h3 className="dash-section-title">Sales trend</h3></div>
                <span className="dashboard-chart-period">{dateRange.label}</span>
              </div>
              {trendData.length ? <div className="chart-wrap dashboard-trend-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                    <defs>{visibleProducts.map((name, index) => <linearGradient key={name} id={`fill-${productKey(name)}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={productColor(name, index)} stopOpacity={.2} /><stop offset="95%" stopColor={productColor(name, index)} stopOpacity={0} /></linearGradient>)}</defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 5" stroke="#EAF0EF" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#839294' }} axisLine={false} tickLine={false} minTickGap={18} />
                    <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 10, fill: '#839294' }} axisLine={false} tickLine={false} width={58} />
                    <Tooltip content={<ChartTooltip />} />
                    {visibleProducts.map((name, index) => <Area key={name} type="monotone" dataKey={productKey(name)} name={name} stroke={productColor(name, index)} fill={`url(#fill-${productKey(name)})`} strokeWidth={2.5} activeDot={{ r: 4, strokeWidth: 0 }} />)}
                  </AreaChart>
                </ResponsiveContainer>
              </div> : <div className="dashboard-chart-empty">No sales in this period. Try another filter.</div>}
            </article>

            <article className="dash-card dashboard-chart-card dashboard-mix-card">
              <div className="dash-section-hdr"><div><span className="dashboard-chart-kicker">REVENUE CONTRIBUTION</span><h3 className="dash-section-title">Product mix</h3></div></div>
              {productSummary.length ? <>
                <div className="dashboard-donut-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart><Pie data={productSummary} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="88%" paddingAngle={3} stroke="none">
                      {productSummary.map(item => <Cell key={item.name} fill={item.color} />)}
                    </Pie><Tooltip content={<ChartTooltip />} /></PieChart>
                  </ResponsiveContainer>
                  <div className="dashboard-donut-center"><strong>{fmtCompact(productRevenueTotal)}</strong><span>Total sales</span></div>
                </div>
                <div className="dashboard-legend-list">{productSummary.map(item => (
                  <div className="dashboard-legend-row" key={item.name}><span className="dashboard-legend-name"><i style={{ background: item.color }} />{item.name}</span><strong>{Math.round(item.value / Math.max(productRevenueTotal, 1) * 100)}%</strong></div>
                ))}</div>
              </> : <div className="dashboard-chart-empty">Product sales will appear here.</div>}
            </article>
          </section>

          <section className="dashboard-analysis-grid">
            <article className="dash-card dashboard-chart-card dashboard-dealers-card">
              <div className="dash-section-hdr"><div><span className="dashboard-chart-kicker">CUSTOMER CONTRIBUTION</span><h3 className="dash-section-title">Top dealers</h3></div><button className="dash-link" onClick={() => navigate('/dealers')}>All dealers <i className="ti ti-arrow-up-right" /></button></div>
              {topDealers.length ? <div className="dashboard-rank-list">{topDealers.map((dealer, index) => {
                const share = Math.round(dealer.revenue / Math.max(salesTotal, 1) * 100);
                return <div className="dashboard-rank-row" key={dealer.name}>
                  <span className="dashboard-rank-number">{String(index + 1).padStart(2, '0')}</span>
                  <div className="dashboard-rank-main"><div className="dashboard-rank-meta"><strong>{dealer.name}</strong><span>{dealer.orderCount} {dealer.orderCount === 1 ? 'order' : 'orders'}</span></div><div className="dashboard-rank-track"><i style={{ width: `${share}%` }} /></div></div>
                  <div className="dashboard-rank-value"><strong>{fmtCompact(dealer.revenue)}</strong><span>{share}%</span></div>
                </div>;
              })}</div> : <div className="dashboard-chart-empty">No dealer sales match these filters.</div>}
            </article>

            <article className="dash-card dashboard-chart-card dashboard-status-card">
              <div className="dash-section-hdr"><div><span className="dashboard-chart-kicker">FULFILMENT PIPELINE</span><h3 className="dash-section-title">Order status</h3></div></div>
              {statusTotal ? <>
                <div className="dashboard-status-summary"><strong>{statusTotal}</strong><span>orders in view</span></div>
                <div className="dashboard-status-stack">{statusCounts.filter(item => item.count > 0).map(item => <i key={item.status} title={`${item.label}: ${item.count}`} style={{ width: `${item.count / statusTotal * 100}%`, background: item.color }} />)}</div>
                <div className="dashboard-status-list">{statusCounts.map(item => <div className="dashboard-status-row" key={item.status}><span><i style={{ background: item.color }} />{item.label}</span><strong>{item.count}</strong></div>)}</div>
              </> : <div className="dashboard-chart-empty">No orders match these filters.</div>}
            </article>
          </section>

          <section className="dash-card dashboard-recent-card">
            <div className="dash-section-hdr"><div><span className="dashboard-chart-kicker">LATEST ACTIVITY</span><h3 className="dash-section-title">Recent orders</h3></div><button className="dash-link" onClick={() => navigate('/orders')}>View all <i className="ti ti-arrow-up-right" /></button></div>
            {recentOrders.length ? <div className="dashboard-recent-list">{recentOrders.map(order => (
              <div className="dashboard-recent-row" key={order.id}>
                <div className="dashboard-recent-date"><strong>{shortDate(String(order.date || order.created_at || '').slice(0, 10))}</strong><span>{order.order_number || 'Order'}</span></div>
                <div className="dashboard-recent-dealer"><strong>{order.dealer_name}</strong><span>{order.location || '—'}</span></div>
                <div className="dashboard-recent-product"><strong>{[...new Set(normalized.lines.filter(line => line.orderId === String(order.id)).map(line => line.product))].length > 1 ? 'Multiple products' : (order.product || 'Order')}</strong><span>{order.qty ? `${order.qty} ${order.unit || 'units'}` : ''}</span></div>
                <strong className="dashboard-recent-amount">{fmtFull(amountOf(order))}</strong>
                <span className={`status-badge ${order.status || 'pending'}`}>{(order.status || 'pending').replace(/^./, letter => letter.toUpperCase())}</span>
              </div>
            ))}</div> : <div className="dashboard-chart-empty">No orders match these filters.</div>}
          </section>
          <p className="dashboard-data-note">Sales exclude cancelled orders. Payments follow the selected dates and dealer. Product filtered payment totals include linked, single-product orders only; multi-product receipts cannot be split by product. {dataNotice}</p>
        </main>
      </div>
    </div>
  );
}
