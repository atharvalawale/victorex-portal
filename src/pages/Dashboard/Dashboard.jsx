import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import Sidebar from '../../components/Sidebar/Sidebar';
import Topbar  from '../../components/Topbar/Topbar';
import { supabase } from '../../lib/supabase';
import './Dashboard.css';

const fmtRupee = (n) => {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
};

const fmtFull = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PRODUCTS = ['WallVex Pro','Chromvex','Primvex'];
const localDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function TargetRing({ pct }) {
  const R = 54, C = 2 * Math.PI * R;
  const dash = (Math.min(pct, 100) / 100) * C;
  const color = pct >= 80 ? '#2D9D6E' : pct >= 50 ? '#17877C' : '#D85A30';
  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={R} fill="none" stroke="#F4F5F9" strokeWidth="10" />
      <circle cx="70" cy="70" r={R} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${dash} ${C}`} strokeLinecap="round"
        transform="rotate(-90 70 70)"
        style={{ transition: 'stroke-dasharray 1s cubic-bezier(.4,0,.2,1)' }}
      />
    </svg>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#fff', border:'0.5px solid #E2E5EE', borderRadius:8, padding:'10px 14px', fontSize:12, boxShadow:'0 4px 16px rgba(22,53,59,0.08)' }}>
      <div style={{ fontWeight:700, color:'#16353B', marginBottom:6 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color:p.color, fontWeight:600, marginBottom:2 }}>
          {p.name}: {fmtFull(p.value)}
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading]         = useState(true);

  /* ── Real data state ── */
  const [todaySales, setTodaySales]           = useState(0);
  const [yesterdaySales, setYesterdaySales]   = useState(0);
  const [pendingOrders, setPendingOrders]     = useState(0);
  const [dueTodayOrders, setDueTodayOrders]   = useState(0);
  const [outstanding, setOutstanding]         = useState(0);
  const [outstandingDealers, setOutstandingDealers] = useState(0);
  const [activeDealers, setActiveDealers]     = useState(0);
  const [newDealers, setNewDealers]           = useState(0);
  const [recentOrders, setRecentOrders]       = useState([]);
  const [dues, setDues]                       = useState([]);
  const [monthlySales, setMonthlySales]       = useState([]);
  const [productRevenue, setProductRevenue]   = useState([]);
  const [monthTarget, setMonthTarget]         = useState(0);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const now = new Date();
    const today = localDateKey(now);
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = localDateKey(yesterdayDate);
    const thisMonth = today.slice(0, 7);

    const [ordersRes, dealersRes, paymentsRes, targetsRes] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('dealers').select('*'),
      supabase.from('payments').select('*'),
      supabase.from('targets').select('*').eq('month', MONTHS[new Date().getMonth()]).eq('year', new Date().getFullYear()),
    ]);

    const orders   = ordersRes.data   || [];
    const dealers  = dealersRes.data  || [];
    const payments = paymentsRes.data || [];
    const targets  = targetsRes.data  || [];

    /* ── KPIs ── */
    const todayOrders     = orders.filter(o => o.date === today);
    const yesterdayOrders = orders.filter(o => o.date === yesterday);

    setTodaySales(todayOrders.reduce((s, o) => s + Number(o.total_amount || o.amount || 0), 0));
    setYesterdaySales(yesterdayOrders.reduce((s, o) => s + Number(o.total_amount || o.amount || 0), 0));
    setPendingOrders(orders.filter(o => o.status === 'pending').length);
    setDueTodayOrders(orders.filter(o => o.status === 'pending' && o.date === today).length);
    setActiveDealers(dealers.filter(d => d.status === 'active').length);

    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    const newThisMonth = dealers.filter(d => new Date(d.created_at) >= thisMonthStart);
    setNewDealers(newThisMonth.length);

    /* ── Outstanding dues ── */
    const dealerDues = dealers
      .filter(d => d.status === 'active')
      .map(d => {
        const totalOrdered = orders.filter(o => o.dealer_name === d.name).reduce((s, o) => s + Number(o.total_amount || o.amount || 0), 0);
        const totalPaid    = payments.filter(p => p.dealer_name === d.name).reduce((s, p) => s + Number(p.amount), 0);
        return { ...d, outstanding: totalOrdered - totalPaid };
      })
      .filter(d => d.outstanding > 0)
      .sort((a, b) => b.outstanding - a.outstanding);

    setOutstanding(dealerDues.reduce((s, d) => s + d.outstanding, 0));
    setOutstandingDealers(dealerDues.length);
    setDues(dealerDues.slice(0, 4).map(d => ({
      id: d.id,
      dealer: d.name,
      location: d.location,
      amount: d.outstanding,
      initials: d.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
    })));

    /* ── Recent orders ── */
    setRecentOrders(orders.slice(0, 5));

    /* ── Monthly sales last 6 months ── */
    const last6 = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      return { month: MONTHS[d.getMonth()], year: d.getFullYear(), key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` };
    });

    const monthly = last6.map(({ month, key }) => {
      const monthOrders = orders.filter(o => o.date?.startsWith(key));
      const row = { month };
      PRODUCTS.forEach(p => {
        row[p.toLowerCase().replace(' ', '_')] = monthOrders
          .filter(o => o.product === p)
          .reduce((s, o) => s + Number(o.total_amount || o.amount || 0), 0);
      });
      return row;
    });

    setMonthlySales(monthly);

    /* ── Product revenue this month ── */
    const thisMonthOrders = orders.filter(o => o.date?.startsWith(thisMonth));
    const prodRevenue = PRODUCTS.map((p, i) => {
      const achieved = thisMonthOrders.filter(o => o.product === p).reduce((s, o) => s + Number(o.total_amount || o.amount || 0), 0);
      const target   = targets.find(t => t.product === p)?.target_amount || 0;
      return {
        id: p.toLowerCase().replace(' ', '_'),
        name: p,
        achieved,
        target,
        color: ['#17877C', '#16353B', '#E99268'][i],
      };
    });

    setProductRevenue(prodRevenue);

    /* ── Month target ── */
    const totalTarget = targets.reduce((s, t) => s + Number(t.target_amount), 0);
    if (totalTarget > 0) setMonthTarget(totalTarget);

    setLoading(false);
  }

  const thisMonthAchieved = productRevenue.reduce((s, p) => s + p.achieved, 0);
  const targetPct         = monthTarget > 0 ? Math.round((thisMonthAchieved / monthTarget) * 100) : 0;
  const daysInMonth       = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const daysPassed        = new Date().getDate();
  const daysLeft          = daysInMonth - daysPassed;
  const dailyNeeded       = daysLeft > 0 ? Math.max(0, Math.round((monthTarget - thisMonthAchieved) / daysLeft)) : 0;
  const todayVsYest       = yesterdaySales > 0 ? Math.round(((todaySales - yesterdaySales) / yesterdaySales) * 100) : 0;

  if (loading) return (
    <div className="dashboard-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="dashboard-main">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', gap:12, color:'#8A8FA3', fontSize:14 }}>
          <div style={{ width:24, height:24, border:'2px solid #E2E5EE', borderTopColor:'#17877C', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
          Loading dashboard...
        </div>
      </div>
    </div>
  );

  return (
    <div className="dashboard-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="dashboard-main">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />

        <div className="dashboard-content">

          {/* KPI Cards */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-accent" style={{ background:'#17877C' }} />
              <div className="kpi-icon-wrap" style={{ background:'rgba(23,135,124,0.1)' }}>
                <i className="ti ti-currency-rupee" style={{ color:'#17877C' }} />
              </div>
              <div className="kpi-label">Today's Sales</div>
              <div className="kpi-value" style={{ color:'#17877C' }}>{fmtFull(todaySales)}</div>
              <div className={`kpi-trend ${yesterdaySales > 0 ? (todayVsYest >= 0 ? 'up' : 'down') : 'info'}`}>
                <i className={`ti ${yesterdaySales > 0 ? `ti-trending-${todayVsYest >= 0 ? 'up' : 'down'}` : 'ti-info-circle'}`} />
                {yesterdaySales > 0 ? `${todayVsYest >= 0 ? '+' : ''}${todayVsYest}% vs yesterday` : 'No sales yesterday'}
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-accent" style={{ background:'#2D9D6E' }} />
              <div className="kpi-icon-wrap" style={{ background:'rgba(45,157,110,0.1)' }}>
                <i className="ti ti-shopping-cart" style={{ color:'#2D9D6E' }} />
              </div>
              <div className="kpi-label">Pending Orders</div>
              <div className="kpi-value">{pendingOrders}</div>
              <div className="kpi-trend warn">
                <i className="ti ti-clock" />{dueTodayOrders} due today
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-accent" style={{ background:'#D85A30' }} />
              <div className="kpi-icon-wrap" style={{ background:'rgba(216,90,48,0.1)' }}>
                <i className="ti ti-alert-circle" style={{ color:'#D85A30' }} />
              </div>
              <div className="kpi-label">Outstanding Dues</div>
              <div className="kpi-value">{fmtRupee(outstanding)}</div>
              <div className="kpi-trend down">
                <i className="ti ti-users" />{outstandingDealers} dealers pending
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-accent" style={{ background:'#16353B' }} />
              <div className="kpi-icon-wrap" style={{ background:'rgba(22,53,59,0.08)' }}>
                <i className="ti ti-users" style={{ color:'#16353B' }} />
              </div>
              <div className="kpi-label">Active Dealers</div>
              <div className="kpi-value">{activeDealers}</div>
              <div className="kpi-trend up">
                <i className="ti ti-plus" />{newDealers} new this month
              </div>
            </div>
          </div>

          {/* Product Hero + Target Ring */}
          <div className="dash-row col-3-1">
            <div className="product-hero-card">
              <div className="product-hero-label">This month's revenue</div>
              <div className="product-hero-val">{fmtFull(thisMonthAchieved)}</div>
              <div className="product-hero-sub">Sales captured from website orders this month</div>
              {productRevenue.map((p) => {
                const barPct = thisMonthAchieved > 0 ? Math.round((p.achieved / thisMonthAchieved) * 100) : 0;
                const tgtPct = p.target > 0 ? Math.round((p.achieved / p.target) * 100) : 0;
                return (
                  <div className="product-bar-row" key={p.id}>
                    <div className="product-bar-meta">
                      <span className="product-bar-name">{p.name}</span>
                      <span>
                        <span className="product-bar-amt">{fmtFull(p.achieved)}</span>
                        {p.target > 0 && <span className="product-bar-pct">({tgtPct}% of target)</span>}
                      </span>
                    </div>
                    <div className="product-bar-track">
                      <div className="product-bar-fill" style={{ width:`${barPct}%`, background:p.color }} />
                    </div>
                  </div>
                );
              })}

              {productRevenue.every(p => p.achieved === 0) && (
                <div style={{ color:'rgba(255,255,255,0.3)', fontSize:13, marginTop:16, textAlign:'center' }}>
                  No sales this month yet — start adding orders!
                </div>
              )}
            </div>

            <div className="dash-card target-card">
              <div className="dash-section-hdr">
                <span className="dash-section-title">
                  <i className="ti ti-target" />Monthly Target
                </span>
              </div>
              {monthTarget > 0 ? (
                <>
                  <div className="target-ring-wrap">
                    <TargetRing pct={targetPct} />
                    <div className="target-ring-label">
                      <div className="target-ring-pct">{targetPct}%</div>
                      <div className="target-ring-sub">achieved</div>
                    </div>
                  </div>
                  <div className="target-product-rows">
                    {productRevenue.map((p) => (
                      <div className="target-product-row" key={p.id}>
                        <div className="target-dot" style={{ background:p.color }} />
                        <span className="target-product-name">{p.name}</span>
                        <span className="target-product-pct">
                          {p.target > 0 ? `${Math.round((p.achieved / p.target) * 100)}%` : 'No product target'}
                        </span>
                      </div>
                    ))}
                  </div>
                  {daysLeft > 0 && (
                    <div className="target-days-note">
                      {daysLeft} days left · Need {fmtRupee(dailyNeeded)}/day
                    </div>
                  )}
                </>
              ) : (
                <div className="target-empty-state">
                  <div className="target-empty-icon"><i className="ti ti-target-arrow" /></div>
                  <strong>No monthly target set</strong>
                  <span>Add a target to track progress against this month’s sales.</span>
                  <button className="target-setup-link" onClick={() => navigate('/analytics')}>
                    Set target in Analytics <i className="ti ti-arrow-right" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Monthly Trend */}
          <div className="dash-card">
            <div className="dash-section-hdr">
              <span className="dash-section-title"><i className="ti ti-chart-line" />Monthly Sales Trend</span>
              <button className="dash-link" onClick={() => navigate('/analytics')}>Full report →</button>
            </div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlySales} margin={{ top:4, right:4, left:0, bottom:0 }}>
                  <defs>
                    <linearGradient id="gW" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#17877C" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#17877C" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#16353B" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#16353B" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#E99268" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#E99268" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F5" />
                  <XAxis dataKey="month" tick={{ fontSize:11, fill:'#8A8FA3' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtRupee} tick={{ fontSize:11, fill:'#8A8FA3' }} axisLine={false} tickLine={false} width={52} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize:11, paddingTop:8 }} />
                  <Area type="monotone" dataKey="wallvex_pro" name="WallVex Pro" stroke="#17877C" fill="url(#gW)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="chromvex"    name="Chromvex"    stroke="#16353B" fill="url(#gC)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="primvex"     name="Primvex"     stroke="#E99268" fill="url(#gP)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Orders + Dues */}
          <div className="dash-row col-2">
            <div className="dash-card">
              <div className="dash-section-hdr">
                <span className="dash-section-title"><i className="ti ti-shopping-cart" />Recent Orders</span>
                <button className="dash-link" onClick={() => navigate('/orders')}>View all →</button>
              </div>
              {recentOrders.length === 0 ? (
                <div style={{ textAlign:'center', padding:'24px', color:'#B0B5C8', fontSize:13 }}>
                  No orders yet — <span style={{ color:'#17877C', cursor:'pointer' }} onClick={() => navigate('/orders')}>add your first order</span>
                </div>
              ) : recentOrders.map((o) => (
                <div className="order-row" key={o.id}>
                  <div className="order-status-dot" style={{
                    background: o.status === 'delivered' ? '#2D9D6E' : o.status === 'processing' ? '#3A8FD4' : '#E99268'
                  }} />
                  <div className="order-info">
                    <div className="order-dealer">{o.dealer_name} · {o.location}</div>
                    <div className="order-meta">{o.product} · {o.qty} boxes</div>
                  </div>
                  <div className="order-right">
                    <div className="order-amount">{fmtFull(o.total_amount || o.amount)}</div>
                    <span className={`status-badge ${o.status}`}>
                      {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="dash-card">
              <div className="dash-section-hdr">
                <span className="dash-section-title"><i className="ti ti-alert-triangle" />Outstanding Dues</span>
                <button className="dash-link" onClick={() => navigate('/khata')}>View khata →</button>
              </div>
              {dues.length === 0 ? (
                <div style={{ textAlign:'center', padding:'24px', color:'#2D9D6E', fontSize:13, fontWeight:600 }}>
                  🎉 All dealers are clear!
                </div>
              ) : dues.map((d) => (
                <div className="due-row" key={d.id}>
                  <div className="due-avatar">{d.initials}</div>
                  <div className="due-info">
                    <div className="due-name">{d.dealer}</div>
                    <div className="due-loc">{d.location}</div>
                  </div>
                  <div className="due-right">
                    <div className={`due-amount ${d.amount > 20000 ? 'high' : 'low'}`}>{fmtFull(d.amount)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Product Bar Chart */}
          <div className="dash-card">
            <div className="dash-section-hdr">
              <span className="dash-section-title"><i className="ti ti-chart-bar" />Product-wise Sales — Last 6 Months</span>
            </div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlySales} margin={{ top:4, right:4, left:0, bottom:0 }} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F5" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize:11, fill:'#8A8FA3' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtRupee} tick={{ fontSize:11, fill:'#8A8FA3' }} axisLine={false} tickLine={false} width={52} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize:11, paddingTop:8 }} />
                  <Bar dataKey="wallvex_pro" name="WallVex Pro" fill="#17877C" radius={[4,4,0,0]} maxBarSize={28} />
                  <Bar dataKey="chromvex"    name="Chromvex"    fill="#16353B" radius={[4,4,0,0]} maxBarSize={28} />
                  <Bar dataKey="primvex"     name="Primvex"     fill="#E99268" radius={[4,4,0,0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
