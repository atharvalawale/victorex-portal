import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar/Sidebar';
import Topbar from '../../components/Topbar/Topbar';
import { supabase } from '../../lib/supabase';
import './CreditBalance.css';

const fmtAmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => d
  ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';

export default function CreditBalance() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dealers, setDealers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDealer, setSelectedDealer] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [dealerResult, orderResult, paymentResult] = await Promise.all([
      supabase.from('dealers').select('id, name, location, status').order('name'),
      supabase.from('orders').select('*').order('date', { ascending: false }),
      supabase.from('payments').select('*').order('date', { ascending: false }),
    ]);
    setDealers(dealerResult.data || []);
    setOrders(orderResult.data || []);
    setPayments(paymentResult.data || []);
    setLoading(false);
  }

  function getDealerBalance(name) {
    const dealerOrders = orders.filter((order) => order.dealer_name === name);
    const dealerPayments = payments.filter((payment) => payment.dealer_name === name);
    const totalOrdered = dealerOrders.reduce((sum, order) => sum + Number(order.total_amount || order.amount || 0), 0);
    const totalReceived = dealerPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const balance = totalOrdered - totalReceived;

    return {
      totalOrdered,
      totalReceived,
      creditBalance: Math.max(-balance, 0),
      actualDue: Math.max(balance, 0),
      isCredit: balance < 0,
      dealerOrders,
      dealerPayments,
    };
  }

  const dealerBalances = dealers.map((dealer) => ({
    name: dealer.name,
    location: dealer.location || '',
    ...getDealerBalance(dealer.name),
  })).sort((a, b) => b.totalOrdered - a.totalOrdered);

  const totalCredit = dealerBalances.reduce((sum, dealer) => sum + dealer.creditBalance, 0);
  const totalDue = dealerBalances.reduce((sum, dealer) => sum + dealer.actualDue, 0);
  const creditDealers = dealerBalances.filter((dealer) => dealer.isCredit);
  const dueDealers = dealerBalances.filter((dealer) => dealer.actualDue > 0);
  const totalBusiness = dealerBalances.reduce((sum, dealer) => sum + dealer.totalOrdered, 0);
  const getInitials = (name) => name.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase();

  function toggleDealer(name) {
    setSelectedDealer((current) => current === name ? null : name);
  }

  function renderDealerCard(dealer) {
    const isCredit = dealer.isCredit;
    const progress = dealer.totalOrdered > 0
      ? Math.min(Math.round((dealer.totalReceived / dealer.totalOrdered) * 100), 100)
      : 0;

    return (
      <article
        key={dealer.name}
        className={`credit-card ${isCredit ? 'credit-card-green' : 'credit-card-red'}`}
        onClick={() => toggleDealer(dealer.name)}
      >
        <div className="credit-card-top">
          <div className={`credit-avatar ${isCredit ? 'green-avatar' : 'red-avatar'}`}>{getInitials(dealer.name)}</div>
          <div className="credit-dealer-info">
            <div className="credit-dealer-name">{dealer.name}</div>
            <div className="credit-dealer-loc">{dealer.location || '—'}</div>
          </div>
          <div className={`credit-balance-badge ${isCredit ? 'green-badge' : 'red-badge'}`}>
            <i className={`ti ${isCredit ? 'ti-arrow-down-circle' : 'ti-alert-circle'}`} />
            {isCredit ? `Credit: ${fmtAmt(dealer.creditBalance)}` : `Due: ${fmtAmt(dealer.actualDue)}`}
          </div>
        </div>

        <div className="credit-card-stats">
          <div className="credit-stat">
            <div className="credit-stat-val">{fmtAmt(dealer.totalOrdered)}</div>
            <div className="credit-stat-lbl">Website Orders</div>
          </div>
          <div className="credit-stat">
            <div className="credit-stat-val" style={{ color: '#2D9D6E' }}>{fmtAmt(dealer.totalReceived)}</div>
            <div className="credit-stat-lbl">Payments Received</div>
          </div>
          <div className="credit-stat">
            <div className="credit-stat-val" style={{ color: isCredit ? '#2D9D6E' : '#D85A30' }}>
              {fmtAmt(isCredit ? dealer.creditBalance : dealer.actualDue)}
            </div>
            <div className="credit-stat-lbl">{isCredit ? 'Credit' : 'Outstanding'}</div>
          </div>
        </div>

        {!isCredit && dealer.totalOrdered > 0 && (
          <div className="credit-progress-wrap">
            <div className="credit-progress-caption">
              <span>{fmtAmt(dealer.totalReceived)} received</span><span>{progress}%</span>
            </div>
            <div className="credit-progress-track">
              <div className="credit-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {selectedDealer === dealer.name && (
          <div className="credit-history" onClick={(event) => event.stopPropagation()}>
            <div className="credit-history-title">Website order and payment history</div>
            {dealer.dealerOrders.length === 0 && dealer.dealerPayments.length === 0 ? (
              <div className="credit-history-empty">No website orders or payments recorded yet.</div>
            ) : (
              <>
                {dealer.dealerOrders.map((order) => (
                  <div className="credit-history-row" key={`order-${order.id}`}>
                    <div>
                      <div className="credit-history-label">Order {order.order_number || ''}</div>
                      <div className="credit-history-meta">{fmtDate(order.date)} · {order.status || 'Order'}</div>
                    </div>
                    <strong>{fmtAmt(order.total_amount || order.amount)}</strong>
                  </div>
                ))}
                {dealer.dealerPayments.map((payment) => (
                  <div className="credit-history-row" key={`payment-${payment.id}`}>
                    <div>
                      <div className="credit-history-label">Payment received · {(payment.mode || 'payment').toUpperCase()}</div>
                      <div className="credit-history-meta">{fmtDate(payment.date)}{payment.reference ? ` · ${payment.reference}` : ''}</div>
                    </div>
                    <strong className="credit-payment-amount">+{fmtAmt(payment.amount)}</strong>
                  </div>
                ))}
              </>
            )}
            <button className="credit-add-advance-btn" onClick={(event) => { event.stopPropagation(); navigate('/khata'); }}>
              <i className="ti ti-receipt" /> Open Khata / Record Payment
            </button>
          </div>
        )}
      </article>
    );
  }

  return (
    <div className="credit-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="credit-main">
        <Topbar title="Credit Balance" onMenuClick={() => setSidebarOpen(true)} />
        <div className="credit-content">
          <div className="credit-header">
            <div>
              <h2 className="credit-title">Credit Balance Tracker</h2>
              <p className="credit-sub">Based on orders and payments recorded on the website.</p>
            </div>
            <button className="credit-add-btn" onClick={() => navigate('/khata')}>
              <i className="ti ti-plus" /> Record Payment in Khata
            </button>
          </div>

          {loading ? (
            <div className="credit-loading"><div className="credit-spinner" /> Loading website balances...</div>
          ) : (
            <>
              <div className="credit-kpis">
                <div className="credit-kpi green">
                  <div className="credit-kpi-icon"><i className="ti ti-arrow-down-circle" /></div>
                  <div><div className="credit-kpi-val">{fmtAmt(totalCredit)}</div><div className="credit-kpi-lbl">Dealer Credit</div><div className="credit-kpi-sub">{creditDealers.length} dealers have credit</div></div>
                </div>
                <div className="credit-kpi red">
                  <div className="credit-kpi-icon"><i className="ti ti-alert-circle" /></div>
                  <div><div className="credit-kpi-val">{fmtAmt(totalDue)}</div><div className="credit-kpi-lbl">Outstanding</div><div className="credit-kpi-sub">{dueDealers.length} dealers owe payment</div></div>
                </div>
                <div className="credit-kpi gold">
                  <div className="credit-kpi-icon"><i className="ti ti-users" /></div>
                  <div><div className="credit-kpi-val">{dealers.length}</div><div className="credit-kpi-lbl">Dealers</div><div className="credit-kpi-sub">From the dealer list</div></div>
                </div>
                <div className="credit-kpi navy">
                  <div className="credit-kpi-icon"><i className="ti ti-currency-rupee" /></div>
                  <div><div className="credit-kpi-val">{fmtAmt(totalBusiness)}</div><div className="credit-kpi-lbl">Website Orders</div><div className="credit-kpi-sub">Total recorded order value</div></div>
                </div>
              </div>

              {dueDealers.length > 0 && (
                <section className="credit-section">
                  <div className="credit-section-title red-title"><i className="ti ti-alert-circle" />Outstanding Dealers — They owe you</div>
                  <div className="credit-cards">{dueDealers.map(renderDealerCard)}</div>
                </section>
              )}

              {creditDealers.length > 0 && (
                <section className="credit-section">
                  <div className="credit-section-title green-title"><i className="ti ti-arrow-down-circle" />Dealers with Credit — Payments exceed orders</div>
                  <div className="credit-cards">{creditDealers.map(renderDealerCard)}</div>
                </section>
              )}

              {dealerBalances.length > 0 ? (
                <div className="credit-card-plain">
                  <div className="credit-table-title"><i className="ti ti-table" />Website Balance Summary</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="credit-table">
                      <thead><tr><th>#</th><th>Dealer</th><th>Website Orders</th><th>Payments Received</th><th>Status</th><th>Balance</th></tr></thead>
                      <tbody>{dealerBalances.map((dealer, index) => (
                        <tr key={dealer.name}>
                          <td style={{ color: '#8A8FA3', fontSize: 12 }}>{index + 1}</td>
                          <td><div style={{ fontWeight: 600, color: '#0B1F3A' }}>{dealer.name}</div><div style={{ fontSize: 11, color: '#8A8FA3' }}>{dealer.location}</div></td>
                          <td><strong>{fmtAmt(dealer.totalOrdered)}</strong></td>
                          <td style={{ color: '#2D9D6E', fontWeight: 600 }}>{fmtAmt(dealer.totalReceived)}</td>
                          <td>{dealer.isCredit ? <span className="credit-status-badge green-badge-sm">Credit</span> : dealer.actualDue > 0 ? <span className="credit-status-badge red-badge-sm">Outstanding</span> : <span className="credit-status-badge clear-badge-sm">Clear</span>}</td>
                          <td><strong style={{ color: dealer.isCredit ? '#2D9D6E' : dealer.actualDue > 0 ? '#D85A30' : '#0B1F3A' }}>{dealer.isCredit ? `+${fmtAmt(dealer.creditBalance)}` : dealer.actualDue > 0 ? `-${fmtAmt(dealer.actualDue)}` : '✓ Clear'}</strong></td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="credit-card-plain credit-empty">
                  <i className="ti ti-chart-bar" />
                  <strong>No dealer records found</strong>
                  <span>Add a dealer to get started. New order totals will appear here.</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
