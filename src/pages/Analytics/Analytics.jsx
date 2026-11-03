import { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import Sidebar from '../../components/Sidebar/Sidebar';
import Topbar from '../../components/Topbar/Topbar';
import { supabase } from '../../lib/supabase';
import './Analytics.css';

const MONTHS   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PRODUCTS = ['WallVex Pro','Chromvex','Primvex'];
const COLORS   = { 'WallVex Pro':'#C9922A', 'Chromvex':'#0B1F3A', 'Primvex':'#E8B84B' };

const fmtRupee = (n) => {
  if (n >= 100000) return `₹${(n/100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n/1000).toFixed(0)}K`;
  return `₹${n}`;
};
const fmtFull = (n) => `₹${Number(n||0).toLocaleString('en-IN')}`;

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#fff', border:'0.5px solid #E2E5EE', borderRadius:8, padding:'10px 14px', fontSize:12, boxShadow:'0 4px 16px rgba(11,31,58,0.08)' }}>
      <div style={{ fontWeight:700, color:'#0B1F3A', marginBottom:6 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color:p.color, fontWeight:600, marginBottom:2 }}>
          {p.name}: {fmtFull(p.value)}
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading]         = useState(true);
  const [orders, setOrders]           = useState([]);
  const [payments, setPayments]       = useState([]);
  const [dealers, setDealers]         = useState([]);
  const [targets, setTargets]         = useState([]);
  const [range, setRange]             = useState('6m');
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [targetForm, setTargetForm]   = useState({ wallvex: '', chromvex: '', primvex: '' });
  const [savingTarget, setSavingTarget] = useState(false);
  const [toast, setToast]             = useState('');

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [o, p, d, t] = await Promise.all([
      supabase.from('orders').select('*').order('date'),
      supabase.from('payments').select('*').order('date'),
      supabase.from('dealers').select('*'),
      supabase.from('targets').select('*'),
    ]);
    setOrders(o.data   || []);
    setPayments(p.data || []);
    setDealers(d.data  || []);
    setTargets(t.data  || []);
    setLoading(false);
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  /* ── Monthly data ── */
  const monthCount = range === '3m' ? 3 : range === '6m' ? 6 : 12;
  const now        = new Date();

  const monthlyData = Array.from({ length: monthCount }, (_, i) => {
    const d   = new Date(now.getFullYear(), now.getMonth() - (monthCount - 1) + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const mo  = orders.filter(o => o.date?.startsWith(key));
    const row = { month: MONTHS[d.getMonth()], total: 0 };
    PRODUCTS.forEach(p => {
      const amt = mo.filter(o => o.product === p).reduce((s,o) => s+Number(o.total_amount || o.amount || 0),0);
      row[p] = amt;
      row.total += amt;
    });
    return row;
  });

  /* ── Product share (pie) ── */
  const productShare = PRODUCTS.map(p => ({
    name: p,
    value: orders.reduce((s,o) => o.product === p ? s+Number(o.total_amount || o.amount || 0) : s, 0),
    color: COLORS[p],
  })).filter(p => p.value > 0);

  /* ── Dealer ranking ── */
  const dealerRanking = dealers
    .filter(d => d.status === 'active')
    .map(d => ({
      name:     d.name,
      location: d.location,
      orders:   orders.filter(o => o.dealer_name === d.name).length,
      revenue:  orders.filter(o => o.dealer_name === d.name).reduce((s,o) => s+Number(o.total_amount || o.amount || 0),0),
      paid:     payments.filter(p => p.dealer_name === d.name).reduce((s,p) => s+Number(p.amount),0),
    }))
    .map(d => ({ ...d, outstanding: d.revenue - d.paid }))
    .sort((a,b) => b.revenue - a.revenue)
    .slice(0, 10);

  /* ── Payment behavior ── */
  const paymentBehavior = dealerRanking.map(d => {
    const pct   = d.revenue > 0 ? Math.round((d.paid / d.revenue) * 100) : 0;
    const score = pct >= 90 ? 'Excellent' : pct >= 70 ? 'Good' : pct >= 50 ? 'Average' : 'Poor';
    const color = pct >= 90 ? '#2D9D6E' : pct >= 70 ? '#C9922A' : pct >= 50 ? '#E8B84B' : '#D85A30';
    return { ...d, pct, score, color };
  });

  /* ── Summary KPIs ── */
  const totalRevenue    = orders.reduce((s,o) => s+Number(o.total_amount || o.amount || 0),0);
  const totalCollected  = payments.reduce((s,p) => s+Number(p.amount),0);
  const totalOutstanding = totalRevenue - totalCollected;
  const totalOrders     = orders.length;
  const avgOrderValue   = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

  /* ── Best month ── */
  const bestMonth = [...monthlyData].sort((a,b) => b.total - a.total)[0];

  /* ── Save targets ── */
  async function handleSaveTargets(e) {
    e.preventDefault();
    setSavingTarget(true);
    const month = MONTHS[now.getMonth()];
    const year  = now.getFullYear();

    const upserts = [
      { product: 'WallVex Pro', target_amount: Number(targetForm.wallvex) || 0 },
      { product: 'Chromvex',    target_amount: Number(targetForm.chromvex) || 0 },
      { product: 'Primvex',     target_amount: Number(targetForm.primvex) || 0 },
    ].map(t => ({ ...t, month, year }));

    for (const t of upserts) {
      const existing = targets.find(x => x.product === t.product && x.month === month && x.year === year);
      if (existing) {
        await supabase.from('targets').update({ target_amount: t.target_amount }).eq('id', existing.id);
      } else {
        await supabase.from('targets').insert(t);
      }
    }

    showToast('Targets saved ✓');
    setSavingTarget(false);
    setShowTargetModal(false);
    fetchAll();
  }

  /* ── Load existing targets into form ── */
  function openTargetModal() {
    const month = MONTHS[now.getMonth()];
    const year  = now.getFullYear();
    const get   = (p) => targets.find(t => t.product === p && t.month === month && t.year === year)?.target_amount || '';
    setTargetForm({ wallvex: get('WallVex Pro'), chromvex: get('Chromvex'), primvex: get('Primvex') });
    setShowTargetModal(true);
  }

  /* ── This month target vs achieved ── */
  const thisMonth   = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const thisMonthOrders = orders.filter(o => o.date?.startsWith(thisMonth));

  const targetVsAchieved = PRODUCTS.map(p => {
    const achieved = thisMonthOrders.filter(o => o.product === p).reduce((s,o) => s+Number(o.total_amount || o.amount || 0),0);
    const target   = targets.find(t => t.product === p && t.month === MONTHS[now.getMonth()] && t.year === now.getFullYear())?.target_amount || 0;
    return { product: p, target: Number(target), achieved, color: COLORS[p] };
  });

  const hasTargets = targetVsAchieved.some(t => t.target > 0);

  return (
    <div className="analytics-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="analytics-main">
        <Topbar title="Analytics" onMenuClick={() => setSidebarOpen(true)} />

        <div className="analytics-content">

          {/* Header */}
          <div className="analytics-header">
            <div>
              <h2 className="analytics-title">Business Analytics</h2>
              <p className="analytics-sub">Sales, collections, dealer performance and monthly goals</p>
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <button className="analytics-target-btn" onClick={openTargetModal}>
                <i className="ti ti-target" /> Set Monthly Targets
              </button>
              <div className="analytics-range-btns">
                {['3m','6m','12m'].map(r => (
                  <button
                    key={r}
                    className={`analytics-range-btn${range === r ? ' active' : ''}`}
                    onClick={() => setRange(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="analytics-loading">
              <div className="analytics-spinner" /> Loading analytics...
            </div>
          ) : (
            <>

              {/* KPI Summary */}
              <div className="analytics-kpis">
                <div className="analytics-kpi">
                  <div className="analytics-kpi-icon" style={{ background:'rgba(201,146,42,0.1)', color:'#C9922A' }}>
                    <i className="ti ti-currency-rupee" />
                  </div>
                  <div>
                    <div className="analytics-kpi-val">{fmtFull(totalRevenue)}</div>
                    <div className="analytics-kpi-lbl">Total Revenue</div>
                  </div>
                </div>
                <div className="analytics-kpi">
                  <div className="analytics-kpi-icon" style={{ background:'rgba(45,157,110,0.1)', color:'#2D9D6E' }}>
                    <i className="ti ti-circle-check" />
                  </div>
                  <div>
                    <div className="analytics-kpi-val">{fmtFull(totalCollected)}</div>
                    <div className="analytics-kpi-lbl">Total Collected</div>
                  </div>
                </div>
                <div className="analytics-kpi">
                  <div className="analytics-kpi-icon" style={{ background:'rgba(216,90,48,0.1)', color:'#D85A30' }}>
                    <i className="ti ti-alert-circle" />
                  </div>
                  <div>
                    <div className="analytics-kpi-val">{fmtFull(totalOutstanding)}</div>
                    <div className="analytics-kpi-lbl">Outstanding</div>
                  </div>
                </div>
                <div className="analytics-kpi">
                  <div className="analytics-kpi-icon" style={{ background:'rgba(58,143,212,0.1)', color:'#3A8FD4' }}>
                    <i className="ti ti-shopping-cart" />
                  </div>
                  <div>
                    <div className="analytics-kpi-val">{totalOrders}</div>
                    <div className="analytics-kpi-lbl">Total Orders</div>
                  </div>
                </div>
                <div className="analytics-kpi">
                  <div className="analytics-kpi-icon" style={{ background:'rgba(11,31,58,0.08)', color:'#0B1F3A' }}>
                    <i className="ti ti-chart-bar" />
                  </div>
                  <div>
                    <div className="analytics-kpi-val">{fmtFull(avgOrderValue)}</div>
                    <div className="analytics-kpi-lbl">Avg Order Value</div>
                  </div>
                </div>
                <div className="analytics-kpi">
                  <div className="analytics-kpi-icon" style={{ background:'rgba(232,184,75,0.15)', color:'#8a5a00' }}>
                    <i className="ti ti-star" />
                  </div>
                  <div>
                    <div className="analytics-kpi-val">{bestMonth?.month || '—'}</div>
                    <div className="analytics-kpi-lbl">Best Month ({fmtRupee(bestMonth?.total || 0)})</div>
                  </div>
                </div>
              </div>

              {/* Revenue trend + Product share */}
              <div className="analytics-row">
                <div className="analytics-card analytics-card-lg">
                  <div className="analytics-card-hdr">
                    <span className="analytics-card-title">
                      <i className="ti ti-chart-line" /> Revenue Trend
                    </span>
                  </div>
                  <div className="analytics-chart-wrap">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthlyData} margin={{ top:4, right:4, left:0, bottom:0 }}>
                        <defs>
                          {PRODUCTS.map((p,i) => (
                            <linearGradient key={p} id={`g${i}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor={COLORS[p]} stopOpacity={0.15} />
                              <stop offset="95%" stopColor={COLORS[p]} stopOpacity={0} />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F5" />
                        <XAxis dataKey="month" tick={{ fontSize:11, fill:'#8A8FA3' }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={fmtRupee} tick={{ fontSize:11, fill:'#8A8FA3' }} axisLine={false} tickLine={false} width={52} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize:11, paddingTop:8 }} />
                        {PRODUCTS.map((p,i) => (
                          <Area key={p} type="monotone" dataKey={p} name={p}
                            stroke={COLORS[p]} fill={`url(#g${i})`} strokeWidth={2} dot={false} />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="analytics-card">
                  <div className="analytics-card-hdr">
                    <span className="analytics-card-title">
                      <i className="ti ti-chart-donut" /> Product Share
                    </span>
                  </div>
                  {productShare.length === 0 ? (
                    <div className="analytics-empty">No data yet</div>
                  ) : (
                    <>
                      <div style={{ height:180 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={productShare} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                              paddingAngle={3} dataKey="value">
                              {productShare.map((p,i) => <Cell key={i} fill={p.color} />)}
                            </Pie>
                            <Tooltip formatter={(v) => fmtFull(v)} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="analytics-pie-legend">
                        {productShare.map((p) => (
                          <div key={p.name} className="analytics-pie-row">
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <div style={{ width:10, height:10, borderRadius:'50%', background:p.color }} />
                              <span style={{ fontSize:12, color:'#5A5F72' }}>{p.name}</span>
                            </div>
                            <span style={{ fontSize:12, fontWeight:700, color:'#0B1F3A' }}>{fmtFull(p.value)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Target vs Achievement */}
              <div className="analytics-card" style={{ marginBottom:14 }}>
                <div className="analytics-card-hdr">
                  <span className="analytics-card-title">
                    <i className="ti ti-target" /> Target vs Achievement — {MONTHS[now.getMonth()]} {now.getFullYear()}
                  </span>
                  <button className="analytics-link" onClick={openTargetModal}>
                    {hasTargets ? 'Edit targets' : 'Set targets →'}
                  </button>
                </div>
                {!hasTargets ? (
                  <div className="analytics-empty">
                    <i className="ti ti-target" />
                    <span>No targets set for this month — <button className="analytics-link-inline" onClick={openTargetModal}>set now</button></span>
                  </div>
                ) : (
                  <div className="analytics-target-rows">
                    {targetVsAchieved.map((t) => {
                      const pct = t.target > 0 ? Math.min(Math.round((t.achieved/t.target)*100), 100) : 0;
                      const barColor = pct >= 80 ? '#2D9D6E' : pct >= 50 ? '#C9922A' : '#D85A30';
                      return (
                        <div key={t.product} className="analytics-target-row">
                          <div className="analytics-target-meta">
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <div style={{ width:10, height:10, borderRadius:'50%', background:t.color }} />
                              <span className="analytics-target-name">{t.product}</span>
                            </div>
                            <div style={{ display:'flex', gap:16, fontSize:12 }}>
                              <span style={{ color:'#8A8FA3' }}>Target: <strong style={{ color:'#0B1F3A' }}>{fmtFull(t.target)}</strong></span>
                              <span style={{ color:'#8A8FA3' }}>Achieved: <strong style={{ color:barColor }}>{fmtFull(t.achieved)}</strong></span>
                              <span style={{ fontWeight:700, color:barColor }}>{pct}%</span>
                            </div>
                          </div>
                          <div className="analytics-target-bar-wrap">
                            <div className="analytics-target-bar-track">
                              <div className="analytics-target-bar-fill" style={{ width:`${pct}%`, background:barColor }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bar chart */}
              <div className="analytics-card" style={{ marginBottom:14 }}>
                <div className="analytics-card-hdr">
                  <span className="analytics-card-title">
                    <i className="ti ti-chart-bar" /> Product-wise Monthly Sales
                  </span>
                </div>
                <div className="analytics-chart-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData} margin={{ top:4, right:4, left:0, bottom:0 }} barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F5" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize:11, fill:'#8A8FA3' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={fmtRupee} tick={{ fontSize:11, fill:'#8A8FA3' }} axisLine={false} tickLine={false} width={52} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize:11, paddingTop:8 }} />
                      {PRODUCTS.map(p => (
                        <Bar key={p} dataKey={p} name={p} fill={COLORS[p]} radius={[4,4,0,0]} maxBarSize={28} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Dealer ranking + Payment behavior */}
              <div className="analytics-row">
                <div className="analytics-card">
                  <div className="analytics-card-hdr">
                    <span className="analytics-card-title">
                      <i className="ti ti-trophy" /> Dealer Ranking
                    </span>
                  </div>
                  {dealerRanking.length === 0 ? (
                    <div className="analytics-empty">No dealer data yet</div>
                  ) : dealerRanking.map((d, i) => (
                    <div key={d.name} className="analytics-dealer-row">
                      <div className="analytics-dealer-rank">#{i+1}</div>
                      <div className="analytics-dealer-info">
                        <div className="analytics-dealer-name">{d.name}</div>
                        <div className="analytics-dealer-loc">{d.location} · {d.orders} orders</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:13, fontWeight:700, color:'#0B1F3A' }}>{fmtFull(d.revenue)}</div>
                        {d.outstanding > 0 && (
                          <div style={{ fontSize:11, color:'#D85A30' }}>Due: {fmtFull(d.outstanding)}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="analytics-card">
                  <div className="analytics-card-hdr">
                    <span className="analytics-card-title">
                      <i className="ti ti-star" /> Payment Behavior
                    </span>
                  </div>
                  {paymentBehavior.length === 0 ? (
                    <div className="analytics-empty">No payment data yet</div>
                  ) : paymentBehavior.map((d) => (
                    <div key={d.name} className="analytics-behavior-row">
                      <div className="analytics-dealer-info">
                        <div className="analytics-dealer-name">{d.name}</div>
                        <div className="analytics-dealer-loc">{d.location}</div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:10, flex:1 }}>
                        <div className="analytics-behavior-bar-track">
                          <div className="analytics-behavior-bar-fill" style={{ width:`${d.pct}%`, background:d.color }} />
                        </div>
                        <span style={{ fontSize:11, fontWeight:700, color:d.color, minWidth:32 }}>{d.pct}%</span>
                      </div>
                      <span className="analytics-score-badge" style={{ background:`${d.color}18`, color:d.color }}>
                        {d.score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </>
          )}
        </div>
      </div>

      {/* Set Targets Modal */}
      {showTargetModal && (
        <div className="modal-overlay" onClick={() => setShowTargetModal(false)}>
          <div className="modal-card modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Set Monthly Targets — {MONTHS[now.getMonth()]} {now.getFullYear()}</h3>
              <button className="modal-close" onClick={() => setShowTargetModal(false)}>
                <i className="ti ti-x" />
              </button>
            </div>
            <form className="modal-form" onSubmit={handleSaveTargets}>
              <div className="modal-field">
                <label>WallVex Pro Target (₹)</label>
                <input type="number" min="0" placeholder="e.g. 250000"
                  value={targetForm.wallvex}
                  onChange={e => setTargetForm({ ...targetForm, wallvex: e.target.value })} />
              </div>
              <div className="modal-field">
                <label>Chromvex Target (₹)</label>
                <input type="number" min="0" placeholder="e.g. 150000"
                  value={targetForm.chromvex}
                  onChange={e => setTargetForm({ ...targetForm, chromvex: e.target.value })} />
              </div>
              <div className="modal-field">
                <label>Primvex Target (₹)</label>
                <input type="number" min="0" placeholder="e.g. 100000"
                  value={targetForm.primvex}
                  onChange={e => setTargetForm({ ...targetForm, primvex: e.target.value })} />
              </div>
              <div className="modal-footer">
                <button type="button" className="modal-cancel" onClick={() => setShowTargetModal(false)}>Cancel</button>
                <button type="submit" className="modal-submit" disabled={savingTarget}>
                  {savingTarget ? <span className="btn-spinner" /> : <i className="ti ti-check" />}
                  Save Targets
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="analytics-toast">
          <i className="ti ti-circle-check" />
          {toast}
        </div>
      )}
    </div>
  );
}
