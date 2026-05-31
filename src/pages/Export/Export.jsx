import { useState } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import Sidebar from '../../components/Sidebar/Sidebar';
import Topbar from '../../components/Topbar/Topbar';
import { supabase } from '../../lib/supabase';
import './Export.css';

const TODAY = new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });

const EXPORTS = [
  {
    id: 'orders',
    title: 'Orders',
    desc: 'All orders with dealer, product, qty, rate, amount, status, date',
    icon: 'ti-shopping-cart',
    color: '#C9922A',
    bg: 'rgba(201,146,42,0.1)',
    table: 'orders',
    columns: ['order_number','dealer_name','location','product','qty','rate','amount','status','date'],
    headers: ['Order No','Dealer','Location','Product','Qty','Rate (₹)','Amount (₹)','Status','Date'],
  },
  {
    id: 'dealers',
    title: 'Dealers',
    desc: 'All dealers with contact info, GST, credit limit, status',
    icon: 'ti-users',
    color: '#0B1F3A',
    bg: 'rgba(11,31,58,0.08)',
    table: 'dealers',
    columns: ['name','location','phone','email','gst_number','credit_limit','status','created_at'],
    headers: ['Name','Location','Phone','Email','GST Number','Credit Limit (₹)','Status','Added On'],
  },
  {
    id: 'payments',
    title: 'Payments / Khata',
    desc: 'All payment records with dealer, amount, mode, date, reference',
    icon: 'ti-notebook',
    color: '#2D9D6E',
    bg: 'rgba(45,157,110,0.1)',
    table: 'payments',
    columns: ['dealer_name','amount','mode','reference','notes','date'],
    headers: ['Dealer','Amount (₹)','Mode','Reference','Notes','Date'],
  },
  {
    id: 'cheques',
    title: 'Cheques',
    desc: 'Post-dated cheques with cheque no, bank, due date, status',
    icon: 'ti-writing',
    color: '#3A8FD4',
    bg: 'rgba(58,143,212,0.1)',
    table: 'cheques',
    columns: ['dealer_name','amount','cheque_number','bank','due_date','status','notes'],
    headers: ['Dealer','Amount (₹)','Cheque No','Bank','Due Date','Status','Notes'],
  },
  {
    id: 'stock',
    title: 'Stock',
    desc: 'Current stock levels, reorder levels per product',
    icon: 'ti-package',
    color: '#E8B84B',
    bg: 'rgba(232,184,75,0.12)',
    table: 'stock',
    columns: ['product','quantity','reorder_level','updated_at'],
    headers: ['Product','Qty in Stock','Reorder Level','Last Updated'],
  },
];

export default function Export() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading]         = useState({});
  const [toast, setToast]             = useState('');
  const [dateFrom, setDateFrom]       = useState('');
  const [dateTo, setDateTo]           = useState('');

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function handleExport(exp) {
    setLoading(prev => ({ ...prev, [exp.id]: true }));

    try {
      let query = supabase.from(exp.table).select('*').order('created_at', { ascending: false });

      /* Apply date filter for orders and payments */
      if ((exp.id === 'orders' || exp.id === 'payments' || exp.id === 'cheques') && dateFrom) {
        query = query.gte('date', dateFrom);
      }
      if ((exp.id === 'orders' || exp.id === 'payments' || exp.id === 'cheques') && dateTo) {
        query = query.lte('date', dateTo);
      }

      const { data, error } = await query;
      if (error) throw error;

      /* Build rows */
      const rows = data.map(row =>
        exp.columns.reduce((acc, col, i) => {
          acc[exp.headers[i]] = row[col] ?? '';
          return acc;
        }, {})
      );

      /* Create workbook */
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, exp.title);

      /* Style header row width */
      const colWidths = exp.headers.map(h => ({ wch: Math.max(h.length + 4, 16) }));
      ws['!cols'] = colWidths;

      /* Save */
      const fileName = `Victorex_${exp.title}_${new Date().toISOString().split('T')[0]}.xlsx`;
      const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      saveAs(new Blob([wbOut], { type: 'application/octet-stream' }), fileName);

      showToast(`${exp.title} exported ✓`);
    } catch (err) {
      showToast('Export failed — try again');
    }

    setLoading(prev => ({ ...prev, [exp.id]: false }));
  }

  async function handleExportAll() {
    setLoading(prev => ({ ...prev, all: true }));

    try {
      const wb = XLSX.utils.book_new();

      for (const exp of EXPORTS) {
        const { data } = await supabase.from(exp.table).select('*').order('created_at', { ascending: false });
        const rows = (data || []).map(row =>
          exp.columns.reduce((acc, col, i) => {
            acc[exp.headers[i]] = row[col] ?? '';
            return acc;
          }, {})
        );
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = exp.headers.map(h => ({ wch: Math.max(h.length + 4, 16) }));
        XLSX.utils.book_append_sheet(wb, ws, exp.title);
      }

      const fileName = `Victorex_Full_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
      const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      saveAs(new Blob([wbOut], { type: 'application/octet-stream' }), fileName);
      showToast('Full export downloaded ✓');
    } catch (err) {
      showToast('Export failed — try again');
    }

    setLoading(prev => ({ ...prev, all: false }));
  }

  return (
    <div className="export-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="export-main">
        <Topbar title="Export" onMenuClick={() => setSidebarOpen(true)} />

        <div className="export-content">

          {/* Header */}
          <div className="export-header">
            <div>
              <h2 className="export-title">Export Data</h2>
              <p className="export-sub">Download your business data as Excel files</p>
            </div>
            <button
              className="export-all-btn"
              onClick={handleExportAll}
              disabled={loading.all}
            >
              {loading.all ? <span className="btn-spinner" /> : <i className="ti ti-download" />}
              Export All Data
            </button>
          </div>

          {/* Date filter */}
          <div className="export-date-filter">
            <div className="export-date-label">
              <i className="ti ti-calendar-event" />
              Filter by date range (applies to Orders, Payments, Cheques):
            </div>
            <div className="export-date-inputs">
              <div className="export-date-field">
                <label>From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                />
              </div>
              <div className="export-date-field">
                <label>To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                />
              </div>
              {(dateFrom || dateTo) && (
                <button
                  className="export-clear-btn"
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                >
                  <i className="ti ti-x" /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Export cards */}
          <div className="export-grid">
            {EXPORTS.map(exp => (
              <div key={exp.id} className="export-card">
                <div className="export-card-top">
                  <div className="export-card-icon" style={{ background: exp.bg, color: exp.color }}>
                    <i className={`ti ${exp.icon}`} />
                  </div>
                  <div>
                    <div className="export-card-title">{exp.title}</div>
                    <div className="export-card-desc">{exp.desc}</div>
                  </div>
                </div>

                <div className="export-card-cols">
                  {exp.headers.map(h => (
                    <span key={h} className="export-col-tag">{h}</span>
                  ))}
                </div>

                <button
                  className="export-btn"
                  onClick={() => handleExport(exp)}
                  disabled={loading[exp.id]}
                >
                  {loading[exp.id] ? (
                    <span className="btn-spinner-dark" />
                  ) : (
                    <i className="ti ti-file-spreadsheet" />
                  )}
                  Download {exp.title}.xlsx
                </button>
              </div>
            ))}
          </div>

          {/* Info box */}
          <div className="export-info">
            <i className="ti ti-info-circle" />
            <div>
              <div className="export-info-title">About exports</div>
              <div className="export-info-text">
                All exports are generated fresh from your Supabase database.
                Share with your accountant monthly. Date filter applies to Orders, Payments and Cheques only.
                Full export downloads all sheets in one file.
              </div>
            </div>
          </div>

        </div>
      </div>

      {toast && (
        <div className="export-toast">
          <i className="ti ti-circle-check" />{toast}
        </div>
      )}
    </div>
  );
}