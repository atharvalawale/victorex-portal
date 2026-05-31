import { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import Sidebar from '../../components/Sidebar/Sidebar';
import Topbar from '../../components/Topbar/Topbar';
import { supabase } from '../../lib/supabase';
import './Invoices.css';

const COMPANY = {
  name:    'Gayatri Metal Finishers',
  address: 'Satara, Maharashtra',
  phone:   '+91 XXXXXXXXXX',
  email:   'info@victorex.in',
  gst:     '27XXXXX1234X1ZX',
  brand:   'Victorex',
};

const GST_RATE = 18;

function InvoiceTemplate({ order, ref: _ }) {
  if (!order) return null;
  const subtotal  = Number(order.amount);
  const gstAmt    = Math.round(subtotal * GST_RATE / 100);
  const total     = subtotal + gstAmt;
  const cgst      = gstAmt / 2;
  const sgst      = gstAmt / 2;
  const fmtAmt    = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
  const fmtDate   = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  function numToWords(n) {
    const a = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
    const b = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    if (n === 0) return 'Zero';
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n/10)] + (n%10 ? ' ' + a[n%10] : '');
    if (n < 1000) return a[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' ' + numToWords(n%100) : '');
    if (n < 100000) return numToWords(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' ' + numToWords(n%1000) : '');
    if (n < 10000000) return numToWords(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' ' + numToWords(n%100000) : '');
    return numToWords(Math.floor(n/10000000)) + ' Crore' + (n%10000000 ? ' ' + numToWords(n%10000000) : '');
  }

  const totalWords = numToWords(Math.round(total)) + ' Rupees Only';

  return (
    <div className="invoice-template">
      {/* Header */}
      <div className="inv-header">
        <div className="inv-brand">
          <div className="inv-logo-mark">V</div>
          <div>
            <div className="inv-brand-name">{COMPANY.brand}</div>
            <div className="inv-brand-sub">by {COMPANY.name}</div>
          </div>
        </div>
        <div className="inv-header-right">
          <div className="inv-title">TAX INVOICE</div>
          <div className="inv-meta-row"><span>Invoice No:</span><strong>{order.order_number}</strong></div>
          <div className="inv-meta-row"><span>Date:</span><strong>{fmtDate(order.date)}</strong></div>
        </div>
      </div>

      {/* Addresses */}
      <div className="inv-addresses">
        <div className="inv-addr-block">
          <div className="inv-addr-label">From</div>
          <div className="inv-addr-name">{COMPANY.name}</div>
          <div className="inv-addr-detail">{COMPANY.address}</div>
          <div className="inv-addr-detail">Phone: {COMPANY.phone}</div>
          <div className="inv-addr-detail">Email: {COMPANY.email}</div>
          <div className="inv-addr-detail">GSTIN: {COMPANY.gst}</div>
        </div>
        <div className="inv-addr-block">
          <div className="inv-addr-label">To</div>
          <div className="inv-addr-name">{order.dealer_name}</div>
          <div className="inv-addr-detail">{order.location}</div>
          {order.dealer_gst && <div className="inv-addr-detail">GSTIN: {order.dealer_gst}</div>}
        </div>
      </div>

      {/* Table */}
      <table className="inv-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Product / Description</th>
            <th>HSN</th>
            <th>Qty</th>
            <th>Unit</th>
            <th>Rate</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>{order.product}</td>
            <td>3209</td>
            <td>{order.qty}</td>
            <td>Box</td>
            <td>{fmtAmt(order.rate)}</td>
            <td>{fmtAmt(subtotal)}</td>
          </tr>
          {Array.from({ length: 4 }).map((_, i) => (
            <tr key={i} className="inv-empty-row">
              <td>{i + 2}</td>
              <td></td><td></td><td></td><td></td><td></td><td></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="inv-totals-wrap">
        <div className="inv-words">
          <div className="inv-words-label">Amount in words:</div>
          <div className="inv-words-val">{totalWords}</div>
        </div>
        <div className="inv-totals">
          <div className="inv-total-row">
            <span>Subtotal</span>
            <span>{fmtAmt(subtotal)}</span>
          </div>
          <div className="inv-total-row">
            <span>CGST @ {GST_RATE / 2}%</span>
            <span>{fmtAmt(cgst)}</span>
          </div>
          <div className="inv-total-row">
            <span>SGST @ {GST_RATE / 2}%</span>
            <span>{fmtAmt(sgst)}</span>
          </div>
          <div className="inv-total-row grand">
            <span>Grand Total</span>
            <span>{fmtAmt(total)}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="inv-footer">
        <div className="inv-terms">
          <div className="inv-terms-title">Terms & Conditions</div>
          <div className="inv-terms-text">1. Payment due within 30 days of invoice date.</div>
          <div className="inv-terms-text">2. Goods once sold will not be taken back.</div>
          <div className="inv-terms-text">3. Subject to Satara jurisdiction.</div>
        </div>
        <div className="inv-sign">
          <div className="inv-sign-line" />
          <div className="inv-sign-label">Authorised Signatory</div>
          <div className="inv-sign-name">{COMPANY.name}</div>
        </div>
      </div>
    </div>
  );
}

export default function Invoices() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [orders, setOrders]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const printRef = useRef();

  useEffect(() => { fetchOrders(); }, []);

  async function fetchOrders() {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    setOrders(data || []);
    setLoading(false);
  }

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Invoice-${selectedOrder?.order_number || ''}`,
  });

  const filtered = orders.filter((o) => {
    const matchStatus = filterStatus === 'all' || o.status === filterStatus;
    const matchSearch =
      o.dealer_name.toLowerCase().includes(search.toLowerCase()) ||
      o.product.toLowerCase().includes(search.toLowerCase()) ||
      (o.order_number || '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const fmtAmt  = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const STATUS_STYLE = {
    pending:    { background: 'rgba(232,184,75,0.12)',  color: '#8a5a00' },
    processing: { background: 'rgba(58,143,212,0.12)',  color: '#1a4a7a' },
    delivered:  { background: 'rgba(45,157,110,0.12)',  color: '#165c3a' },
    cancelled:  { background: 'rgba(216,90,48,0.12)',   color: '#7a2010' },
  };

  return (
    <div className="invoices-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="invoices-main">
        <Topbar title="Invoices" onMenuClick={() => setSidebarOpen(true)} />

        <div className="invoices-content">

          {/* Header */}
          <div className="invoices-header">
            <div>
              <h2 className="invoices-title">Invoices</h2>
              <p className="invoices-sub">
                {loading ? 'Loading...' : `${filtered.length} invoices`}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="invoices-filters">
            <div className="invoices-search-wrap">
              <i className="ti ti-search" />
              <input
                className="invoices-search"
                placeholder="Search dealer, product, order ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="invoices-status-filters">
              {['all', 'pending', 'processing', 'delivered', 'cancelled'].map((s) => (
                <button
                  key={s}
                  className={`invoices-filter-btn${filterStatus === s ? ' active' : ''}`}
                  onClick={() => setFilterStatus(s)}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="invoices-table-wrap">
            {loading ? (
              <div className="invoices-loading">
                <div className="invoices-spinner" /> Loading invoices...
              </div>
            ) : filtered.length === 0 ? (
              <div className="invoices-empty">
                <i className="ti ti-file-invoice" />
                <span>No invoices yet — add orders first</span>
              </div>
            ) : (
              <table className="invoices-table">
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Dealer</th>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Amount</th>
                    <th>GST (18%)</th>
                    <th>Total</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => {
                    const gst   = Math.round(Number(o.amount) * GST_RATE / 100);
                    const total = Number(o.amount) + gst;
                    return (
                      <tr key={o.id}>
                        <td><span className="invoices-id">{o.order_number}</span></td>
                        <td>
                          <div className="invoices-dealer">{o.dealer_name}</div>
                          <div className="invoices-loc">{o.location}</div>
                        </td>
                        <td>{o.product}</td>
                        <td>{o.qty} boxes</td>
                        <td>{fmtAmt(o.amount)}</td>
                        <td>{fmtAmt(gst)}</td>
                        <td><strong>{fmtAmt(total)}</strong></td>
                        <td className="invoices-date">{fmtDate(o.date)}</td>
                        <td>
                          <span className="inv-status-badge" style={STATUS_STYLE[o.status]}>
                            {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                          </span>
                        </td>
                        <td>
                          <button
                            className="inv-view-btn"
                            onClick={() => setSelectedOrder(o)}
                            title="View & Print"
                          >
                            <i className="ti ti-printer" /> Print
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Invoice Preview Modal */}
      {selectedOrder && (
        <div className="inv-modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="inv-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="inv-modal-header">
              <h3 className="inv-modal-title">Invoice — {selectedOrder.order_number}</h3>
              <div className="inv-modal-actions">
                <button className="inv-print-btn" onClick={handlePrint}>
                  <i className="ti ti-printer" /> Print / Save PDF
                </button>
                <button className="inv-close-btn" onClick={() => setSelectedOrder(null)}>
                  <i className="ti ti-x" />
                </button>
              </div>
            </div>
            <div className="inv-modal-body">
              <div ref={printRef}>
                <InvoiceTemplate order={selectedOrder} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}