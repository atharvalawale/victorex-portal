import { useState, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import Sidebar from '../../components/Sidebar/Sidebar';
import Topbar from '../../components/Topbar/Topbar';
import { supabase } from '../../lib/supabase';
import { getBusinessInfo } from '../../lib/businessInfo';
import './Report.css';

export default function Report() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [report, setReport]           = useState(null);
  const [reportDate, setReportDate]   = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const COMPANY = getBusinessInfo();
  const printRef = useRef();

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Victorex_Report_${reportDate}`,
  });

  const fmtAmt  = n => `₹${Number(n||0).toLocaleString('en-IN')}`;
  const fmtDate = d => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });

  async function generateReport() {
    setLoading(true);

    const [ordersRes, paymentsRes, dealersRes, chequesRes, stockRes] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('payments').select('*').order('created_at', { ascending: false }),
      supabase.from('dealers').select('*'),
      supabase.from('cheques').select('*').eq('status', 'pending').order('due_date'),
      supabase.from('stock').select('*'),
    ]);

    const orders   = ordersRes.data   || [];
    const payments = paymentsRes.data || [];
    const dealers  = dealersRes.data  || [];
    const cheques  = chequesRes.data  || [];
    const stock    = stockRes.data    || [];

    /* ── Date filters ── */
    const today     = reportDate;
    const thisMonth = reportDate.slice(0, 7);

    const todayOrders    = orders.filter(o => o.date === today);
    const monthOrders    = orders.filter(o => o.date?.startsWith(thisMonth));
    const todayPayments  = payments.filter(p => p.date === today);

    /* ── Outstanding dues ── */
    const dealerDues = dealers
      .filter(d => d.status === 'active')
      .map(d => {
        const totalOrdered = orders.filter(o => o.dealer_name === d.name).reduce((s,o) => s+Number(o.total_amount || o.amount || 0),0);
        const totalPaid    = payments.filter(p => p.dealer_name === d.name).reduce((s,p) => s+Number(p.amount),0);
        return { name: d.name, location: d.location, outstanding: totalOrdered - totalPaid };
      })
      .filter(d => d.outstanding > 0)
      .sort((a,b) => b.outstanding - a.outstanding);

    /* ── Cheques due soon ── */
    const sevenDaysLater = new Date(Date.now() + 7*86400000).toISOString().split('T')[0];
    const chequeDueSoon  = cheques.filter(c => c.due_date <= sevenDaysLater);

    /* ── Low stock ── */
    const lowStock = stock.filter(s => s.quantity <= s.reorder_level);

    /* ── Product breakdown today ── */
    const products = ['WallVex Pro', 'Chromvex', 'Primvex'];
    const todayByProduct = products.map(p => ({
      name: p,
      orders: todayOrders.filter(o => o.product === p).length,
      amount: todayOrders.filter(o => o.product === p).reduce((s,o) => s+Number(o.total_amount || o.amount || 0),0),
    }));

    const monthByProduct = products.map(p => ({
      name: p,
      orders: monthOrders.filter(o => o.product === p).length,
      amount: monthOrders.filter(o => o.product === p).reduce((s,o) => s+Number(o.total_amount || o.amount || 0),0),
    }));

    setReport({
      date: reportDate,
      today: {
        sales:    todayOrders.reduce((s,o) => s+Number(o.total_amount || o.amount || 0),0),
        orders:   todayOrders.length,
        pending:  todayOrders.filter(o=>o.status==='pending').length,
        delivered: todayOrders.filter(o=>o.status==='delivered').length,
        payments: todayPayments.reduce((s,p) => s+Number(p.amount),0),
        byProduct: todayByProduct,
        orderList: todayOrders,
        paymentList: todayPayments,
      },
      month: {
        sales:   monthOrders.reduce((s,o) => s+Number(o.total_amount || o.amount || 0),0),
        orders:  monthOrders.length,
        payments: payments.filter(p=>p.date?.startsWith(thisMonth)).reduce((s,p)=>s+Number(p.amount),0),
        byProduct: monthByProduct,
      },
      outstanding: {
        total:   dealerDues.reduce((s,d) => s+d.outstanding,0),
        dealers: dealerDues,
      },
      cheques: chequeDueSoon,
      stock: {
        lowItems: lowStock,
        all: stock,
      },
      activeDealers: dealers.filter(d=>d.status==='active').length,
    });

    setLoading(false);
  }

  return (
    <div className="report-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="report-main">
        <Topbar title="Daily Report" onMenuClick={() => setSidebarOpen(true)} />

        <div className="report-content">

          {/* Header */}
          <div className="report-header">
            <div>
              <h2 className="report-title">Daily Business Report</h2>
              <p className="report-sub">Generate a PDF summary of your business for any date</p>
            </div>
          </div>

          {/* Controls */}
          <div className="report-controls">
            <div className="report-date-wrap">
              <label>Report Date</label>
              <input
                type="date"
                value={reportDate}
                onChange={e => setReportDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <button
              className="report-generate-btn"
              onClick={generateReport}
              disabled={loading}
            >
              {loading ? <span className="btn-spinner" /> : <i className="ti ti-chart-bar" />}
              Generate Report
            </button>
            {report && (
              <button className="report-print-btn" onClick={handlePrint}>
                <i className="ti ti-printer" /> Print / Save PDF
              </button>
            )}
          </div>

          {/* Report preview */}
          {loading && (
            <div className="report-loading">
              <div className="report-spinner" /> Generating report...
            </div>
          )}

          {!loading && !report && (
            <div className="report-empty">
              <i className="ti ti-file-analytics" />
              <span>Select a date and click Generate Report</span>
            </div>
          )}

          {report && !loading && (
            <div ref={printRef}>
              <div className="report-doc">

                {/* Report header */}
                <div className="rdoc-header">
                  <div className="rdoc-brand">
                    <div className="rdoc-logo">V</div>
                    <div>
                      <div className="rdoc-brand-name">{COMPANY.brand || 'Victorex'}</div>
                      {COMPANY.name && <div className="rdoc-brand-sub">by {COMPANY.name}</div>}
                    </div>
                  </div>
                  <div className="rdoc-header-right">
                    <div className="rdoc-report-title">DAILY BUSINESS REPORT</div>
                    <div className="rdoc-report-date">{fmtDate(report.date)}</div>
                    {(COMPANY.address || COMPANY.gst) && <div className="rdoc-report-meta">{[COMPANY.address, COMPANY.gst && `GST: ${COMPANY.gst}`].filter(Boolean).join(' · ')}</div>}
                  </div>
                </div>

                {/* Today summary */}
                <div className="rdoc-section">
                  <div className="rdoc-section-title">Today's Summary</div>
                  <div className="rdoc-kpis">
                    <div className="rdoc-kpi">
                      <div className="rdoc-kpi-val gold">{fmtAmt(report.today.sales)}</div>
                      <div className="rdoc-kpi-lbl">Sales</div>
                    </div>
                    <div className="rdoc-kpi">
                      <div className="rdoc-kpi-val">{report.today.orders}</div>
                      <div className="rdoc-kpi-lbl">Orders</div>
                    </div>
                    <div className="rdoc-kpi">
                      <div className="rdoc-kpi-val">{report.today.pending}</div>
                      <div className="rdoc-kpi-lbl">Pending</div>
                    </div>
                    <div className="rdoc-kpi">
                      <div className="rdoc-kpi-val green">{fmtAmt(report.today.payments)}</div>
                      <div className="rdoc-kpi-lbl">Payments Received</div>
                    </div>
                    <div className="rdoc-kpi">
                      <div className="rdoc-kpi-val">{report.activeDealers}</div>
                      <div className="rdoc-kpi-lbl">Active Dealers</div>
                    </div>
                  </div>
                </div>

                {/* Today orders */}
                {report.today.orderList.length > 0 && (
                  <div className="rdoc-section">
                    <div className="rdoc-section-title">Today's Orders</div>
                    <table className="rdoc-table">
                      <thead>
                        <tr>
                          <th>Order No</th>
                          <th>Dealer</th>
                          <th>Product</th>
                          <th>Qty</th>
                          <th>Amount</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.today.orderList.map(o => (
                          <tr key={o.id}>
                            <td>{o.order_number}</td>
                            <td>{o.dealer_name} · {o.location}</td>
                            <td>{o.product}</td>
                            <td>{o.qty} boxes</td>
                            <td><strong>{fmtAmt(o.amount)}</strong></td>
                            <td>{o.status.charAt(0).toUpperCase()+o.status.slice(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {report.today.orderList.length === 0 && (
                  <div className="rdoc-section">
                    <div className="rdoc-section-title">Today's Orders</div>
                    <div className="rdoc-no-data">No orders on this date</div>
                  </div>
                )}

                {/* Product breakdown */}
                <div className="rdoc-two-col">
                  <div className="rdoc-section">
                    <div className="rdoc-section-title">Today by Product</div>
                    <table className="rdoc-table">
                      <thead>
                        <tr><th>Product</th><th>Orders</th><th>Amount</th></tr>
                      </thead>
                      <tbody>
                        {report.today.byProduct.map(p => (
                          <tr key={p.name}>
                            <td>{p.name}</td>
                            <td>{p.orders}</td>
                            <td><strong>{fmtAmt(p.amount)}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="rdoc-section">
                    <div className="rdoc-section-title">This Month by Product</div>
                    <table className="rdoc-table">
                      <thead>
                        <tr><th>Product</th><th>Orders</th><th>Amount</th></tr>
                      </thead>
                      <tbody>
                        {report.month.byProduct.map(p => (
                          <tr key={p.name}>
                            <td>{p.name}</td>
                            <td>{p.orders}</td>
                            <td><strong>{fmtAmt(p.amount)}</strong></td>
                          </tr>
                        ))}
                        <tr className="rdoc-total-row">
                          <td><strong>Total</strong></td>
                          <td><strong>{report.month.orders}</strong></td>
                          <td><strong>{fmtAmt(report.month.sales)}</strong></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Outstanding dues */}
                <div className="rdoc-section">
                  <div className="rdoc-section-title">
                    Outstanding Dues — Total: {fmtAmt(report.outstanding.total)}
                  </div>
                  {report.outstanding.dealers.length === 0 ? (
                    <div className="rdoc-no-data rdoc-green">✓ All dealers are clear</div>
                  ) : (
                    <table className="rdoc-table">
                      <thead>
                        <tr><th>Dealer</th><th>Location</th><th>Outstanding</th></tr>
                      </thead>
                      <tbody>
                        {report.outstanding.dealers.map(d => (
                          <tr key={d.name}>
                            <td>{d.name}</td>
                            <td>{d.location}</td>
                            <td style={{ color:'#D85A30', fontWeight:700 }}>{fmtAmt(d.outstanding)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Cheques due soon */}
                <div className="rdoc-section">
                  <div className="rdoc-section-title">Cheques Due Within 7 Days</div>
                  {report.cheques.length === 0 ? (
                    <div className="rdoc-no-data rdoc-green">✓ No cheques due soon</div>
                  ) : (
                    <table className="rdoc-table">
                      <thead>
                        <tr><th>Dealer</th><th>Cheque No</th><th>Bank</th><th>Amount</th><th>Due Date</th></tr>
                      </thead>
                      <tbody>
                        {report.cheques.map(c => (
                          <tr key={c.id}>
                            <td>{c.dealer_name}</td>
                            <td>{c.cheque_number}</td>
                            <td>{c.bank}</td>
                            <td><strong>{fmtAmt(c.amount)}</strong></td>
                            <td style={{ color:'#D85A30' }}>{fmtDate(c.due_date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Stock status */}
                <div className="rdoc-section">
                  <div className="rdoc-section-title">Stock Status</div>
                  <table className="rdoc-table">
                    <thead>
                      <tr><th>Product</th><th>In Stock</th><th>Reorder Level</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {report.stock.all.map(s => (
                        <tr key={s.id}>
                          <td>{s.product}</td>
                          <td>{s.quantity} boxes</td>
                          <td>{s.reorder_level} boxes</td>
                          <td style={{ color: s.quantity <= s.reorder_level ? '#D85A30' : '#2D9D6E', fontWeight:600 }}>
                            {s.quantity === 0 ? 'Out of Stock' : s.quantity <= s.reorder_level ? 'Low Stock' : 'Good'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div className="rdoc-footer">
                  <div>Generated on {fmtDate(new Date().toISOString().split('T')[0])} · Victorex Management Portal</div>
                  <div>{[COMPANY.name, COMPANY.address].filter(Boolean).join(' · ') || (COMPANY.brand || 'Victorex')}</div>
                </div>

              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
