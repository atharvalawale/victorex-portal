import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import Sidebar from '../../components/Sidebar/Sidebar';
import Topbar from '../../components/Topbar/Topbar';
import { supabase } from '../../lib/supabase';
import './DiaryDashboard.css';

const fmtAmt  = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = d => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#fff', border:'0.5px solid #E2E5EE', borderRadius:8, padding:'10px 14px', fontSize:12, boxShadow:'0 4px 16px rgba(11,31,58,0.08)' }}>
      <div style={{ fontWeight:700, color:'#0B1F3A', marginBottom:6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color:p.color, fontWeight:600, marginBottom:2 }}>
          {p.name}: {fmtAmt(p.value)}
        </div>
      ))}
    </div>
  );
}

export default function DiaryDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [entries, setEntries]         = useState([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => { fetchEntries(); }, []);

  async function fetchEntries() {
    setLoading(true);
    const { data } = await supabase
      .from('diary_entries')
      .select('*')
      .order('date', { ascending: false });
    setEntries(data || []);
    setLoading(false);
  }

  /* ── Summary KPIs ── */
  const totalAmt       = entries.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalPaid      = entries.reduce((s, e) => s + Number(e.paid_amount || 0), 0);
  const totalOutstanding = totalAmt - totalPaid;
  const paidCount      = entries.filter(e => e.payment_status === 'paid').length;
  const unpaidCount    = entries.filter(e => e.payment_status === 'unpaid').length;
  const partialCount   = entries.filter(e => e.payment_status === 'partial').length;
  const collectionPct  = totalAmt > 0 ? Math.round((totalPaid / totalAmt) * 100) : 0;

  /* ── Dealer wise breakdown ── */
  const dealerMap = {};
  entries.forEach(e => {
    if (!dealerMap[e.dealer_name]) {
      dealerMap[e.dealer_name] = {
        name:        e.dealer_name,
        location:    e.location || '',
        total:       0,
        paid:        0,
        entries:     0,
        lastDate:    e.date,
      };
    }
    dealerMap[e.dealer_name].total   += Number(e.amount || 0);
    dealerMap[e.dealer_name].paid    += Number(e.paid_amount || 0);
    dealerMap[e.dealer_name].entries += 1;
    if (e.date > dealerMap[e.dealer_name].lastDate) {
      dealerMap[e.dealer_name].lastDate = e.date;
    }
  });

  const dealerList = Object.values(dealerMap)
    .map(d => ({ ...d, outstanding: d.total - d.paid, pct: d.total > 0 ? Math.round((d.paid / d.total) * 100) : 0 }))
    .sort((a, b) => b.outstanding - a.outstanding);

  /* ── Month wise chart ── */
  const monthMap = {};
  entries.forEach(e => {
    const month = e.date?.slice(0, 7);
    if (!month) return;
    if (!monthMap[month]) monthMap[month] = { month, total: 0, paid: 0 };
    monthMap[month].total += Number(e.amount || 0);
    monthMap[month].paid  += Number(e.paid_amount || 0);
  });

  const monthChart = Object.values(monthMap)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(m => ({
      month:       m.month.slice(5) + '/' + m.month.slice(2, 4),
      Total:       m.total,
      Paid:        m.paid,
      Outstanding: m.total - m.paid,
    }));

  /* ── Pie chart data ── */
  const pieData = [
    { name: 'Paid',    value: totalPaid,        color: '#2D9D6E' },
    { name: 'Unpaid',  value: entries.filter(e => e.payment_status === 'unpaid').reduce((s,e) => s+Number(e.amount||0), 0), color: '#D85A30' },
    { name: 'Partial', value: entries.filter(e => e.payment_status === 'partial').reduce((s,e) => s+Number(e.amount||0)-Number(e.paid_amount||0), 0), color: '#E8B84B' },
  ].filter(p => p.value > 0);

  /* ── Top defaulters ── */
  const defaulters = dealerList.filter(d => d.outstanding > 0).slice(0, 5);

  const getInitials = n => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="diarydash-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="diarydash-main">
        <Topbar title="Diary Dashboard" onMenuClick={() => setSidebarOpen(true)} />

        <div className="diarydash-content">

          {/* Header */}
          <div className="diarydash-header">
            <div>
              <h2 className="diarydash-title">Diary Dashboard</h2>
              <p className="diarydash-sub">Overview of all old diary records — {entries.length} entries</p>
            </div>
          </div>

          {loading ? (
            <div className="diarydash-loading"><div className="diarydash-spinner" /> Loading...</div>
          ) : entries.length === 0 ? (
            <div className="diarydash-empty">
              <i className="ti ti-notebook" />
              <span>No diary entries yet — go to Diary Entry page to add records</span>
            </div>
          ) : (
            <>

              {/* KPI Cards */}
              <div className="diarydash-kpis">
                <div className="diarydash-kpi gold">
                  <div className="diarydash-kpi-icon"><i className="ti ti-currency-rupee" /></div>
                  <div>
                    <div className="diarydash-kpi-val">{fmtAmt(totalAmt)}</div>
                    <div className="diarydash-kpi-lbl">Total Business</div>
                    <div className="diarydash-kpi-sub">{entries.length} entries</div>
                  </div>
                </div>
                <div className="diarydash-kpi green">
                  <div className="diarydash-kpi-icon"><i className="ti ti-circle-check" /></div>
                  <div>
                    <div className="diarydash-kpi-val">{fmtAmt(totalPaid)}</div>
                    <div className="diarydash-kpi-lbl">Total Collected</div>
                    <div className="diarydash-kpi-sub">{paidCount} fully paid</div>
                  </div>
                </div>
                <div className="diarydash-kpi red">
                  <div className="diarydash-kpi-icon"><i className="ti ti-alert-circle" /></div>
                  <div>
                    <div className="diarydash-kpi-val">{fmtAmt(totalOutstanding)}</div>
                    <div className="diarydash-kpi-lbl">Outstanding</div>
                    <div className="diarydash-kpi-sub">{unpaidCount + partialCount} pending</div>
                  </div>
                </div>
                <div className="diarydash-kpi navy">
                  <div className="diarydash-kpi-icon"><i className="ti ti-users" /></div>
                  <div>
                    <div className="diarydash-kpi-val">{dealerList.length}</div>
                    <div className="diarydash-kpi-lbl">Unique Dealers</div>
                    <div className="diarydash-kpi-sub">{dealerList.filter(d => d.outstanding > 0).length} have dues</div>
                  </div>
                </div>
              </div>

              {/* Collection progress */}
              <div className="diarydash-card" style={{ marginBottom: 14 }}>
                <div className="diarydash-card-title">
                  <i className="ti ti-chart-line" /> Overall Collection Progress
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:8 }}>
                  <div className="diarydash-progress-track">
                    <div
                      className="diarydash-progress-fill"
                      style={{
                        width: `${collectionPct}%`,
                        background: collectionPct >= 80 ? '#2D9D6E' : collectionPct >= 50 ? '#C9922A' : '#D85A30',
                      }}
                    />
                  </div>
                  <span style={{ font:'700 18px Outfit', color:'#0B1F3A', flexShrink:0 }}>{collectionPct}% collected</span>
                </div>
                <div style={{ display:'flex', gap:24, fontSize:12, color:'#8A8FA3' }}>
                  <span>Collected: <strong style={{ color:'#2D9D6E' }}>{fmtAmt(totalPaid)}</strong></span>
                  <span>Remaining: <strong style={{ color:'#D85A30' }}>{fmtAmt(totalOutstanding)}</strong></span>
                  <span>Total: <strong style={{ color:'#0B1F3A' }}>{fmtAmt(totalAmt)}</strong></span>
                </div>
              </div>

              {/* Charts row */}
              <div className="diarydash-row">

                {/* Monthly bar chart */}
                <div className="diarydash-card">
                  <div className="diarydash-card-title">
                    <i className="ti ti-chart-bar" /> Month-wise Breakdown
                  </div>
                  {monthChart.length === 0 ? (
                    <div className="diarydash-empty-sm">No data</div>
                  ) : (
                    <div style={{ height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthChart} margin={{ top:4, right:4, left:0, bottom:0 }} barGap={2}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F5" vertical={false} />
                          <XAxis dataKey="month" tick={{ fontSize:11, fill:'#8A8FA3' }} axisLine={false} tickLine={false} />
                          <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} tick={{ fontSize:11, fill:'#8A8FA3' }} axisLine={false} tickLine={false} width={48} />
                          <Tooltip content={<ChartTooltip />} />
                          <Bar dataKey="Total"       name="Total"       fill="#0B1F3A" radius={[4,4,0,0]} maxBarSize={24} />
                          <Bar dataKey="Paid"        name="Paid"        fill="#2D9D6E" radius={[4,4,0,0]} maxBarSize={24} />
                          <Bar dataKey="Outstanding" name="Outstanding" fill="#D85A30" radius={[4,4,0,0]} maxBarSize={24} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Pie chart */}
                <div className="diarydash-card">
                  <div className="diarydash-card-title">
                    <i className="ti ti-chart-donut" /> Payment Status Split
                  </div>
                  {pieData.length === 0 ? (
                    <div className="diarydash-empty-sm">No data</div>
                  ) : (
                    <>
                      <div style={{ height: 160 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value">
                              {pieData.map((p, i) => <Cell key={i} fill={p.color} />)}
                            </Pie>
                            <Tooltip formatter={v => fmtAmt(v)} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:8 }}>
                        {pieData.map(p => (
                          <div key={p.name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <div style={{ width:10, height:10, borderRadius:'50%', background:p.color }} />
                              <span style={{ color:'#5A5F72' }}>{p.name}</span>
                            </div>
                            <strong style={{ color:'#0B1F3A' }}>{fmtAmt(p.value)}</strong>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

              </div>

              {/* Top defaulters */}
              {defaulters.length > 0 && (
                <div className="diarydash-card" style={{ marginBottom: 14 }}>
                  <div className="diarydash-card-title">
                    <i className="ti ti-alert-triangle" /> Top Outstanding Dealers
                  </div>
                  {defaulters.map(d => (
                    <div key={d.name} className="diarydash-dealer-row">
                      <div className="diarydash-dealer-avatar">{getInitials(d.name)}</div>
                      <div className="diarydash-dealer-info">
                        <div className="diarydash-dealer-name">{d.name}</div>
                        <div className="diarydash-dealer-loc">{d.location} · {d.entries} entries · Last: {fmtDate(d.lastDate)}</div>
                      </div>
                      <div style={{ flex:1, margin:'0 16px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#8A8FA3', marginBottom:4 }}>
                          <span>{fmtAmt(d.paid)} paid</span>
                          <span>{d.pct}%</span>
                        </div>
                        <div className="diarydash-bar-track">
                          <div
                            className="diarydash-bar-fill"
                            style={{
                              width: `${d.pct}%`,
                              background: d.pct >= 80 ? '#2D9D6E' : d.pct >= 50 ? '#C9922A' : '#D85A30',
                            }}
                          />
                        </div>
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontSize:14, fontWeight:800, color:'#D85A30' }}>{fmtAmt(d.outstanding)}</div>
                        <div style={{ fontSize:11, color:'#8A8FA3' }}>outstanding</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Full dealer table */}
              <div className="diarydash-card">
                <div className="diarydash-card-title">
                  <i className="ti ti-users" /> All Dealers — Diary Summary
                </div>
                <div style={{ overflowX:'auto' }}>
                  <table className="diarydash-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Dealer</th>
                        <th>Entries</th>
                        <th>Total</th>
                        <th>Paid</th>
                        <th>Outstanding</th>
                        <th>Collection</th>
                        <th>Last Entry</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dealerList.map((d, i) => (
                        <tr key={d.name}>
                          <td style={{ color:'#8A8FA3', fontSize:12 }}>{i + 1}</td>
                          <td>
                            <div style={{ fontWeight:600, color:'#0B1F3A' }}>{d.name}</div>
                            {d.location && <div style={{ fontSize:11, color:'#8A8FA3' }}>{d.location}</div>}
                          </td>
                          <td style={{ color:'#5A5F72' }}>{d.entries}</td>
                          <td><strong>{fmtAmt(d.total)}</strong></td>
                          <td style={{ color:'#2D9D6E', fontWeight:600 }}>{fmtAmt(d.paid)}</td>
                          <td style={{ color: d.outstanding > 0 ? '#D85A30' : '#2D9D6E', fontWeight:600 }}>
                            {d.outstanding > 0 ? fmtAmt(d.outstanding) : '✓ Clear'}
                          </td>
                          <td>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <div className="diarydash-mini-track">
                                <div
                                  className="diarydash-mini-fill"
                                  style={{
                                    width:`${d.pct}%`,
                                    background: d.pct >= 80 ? '#2D9D6E' : d.pct >= 50 ? '#C9922A' : '#D85A30',
                                  }}
                                />
                              </div>
                              <span style={{ fontSize:11, fontWeight:700, color:'#0B1F3A', minWidth:30 }}>{d.pct}%</span>
                            </div>
                          </td>
                          <td style={{ fontSize:12, color:'#8A8FA3' }}>{fmtDate(d.lastDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </>
          )}
        </div>
      </div>
    </div>
  );
}