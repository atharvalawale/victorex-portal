import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import Orders from './pages/Orders/Orders';
import Dealers from './pages/Dealers/Dealers';
import Khata from './pages/Khata/Khata';
import Invoices from './pages/Invoices/Invoices';
import Analytics from './pages/Analytics/Analytics';
import Stock from './pages/Stock/Stock';
import Settings from './pages/Settings/Settings';
import Cheques from './pages/Cheques/Cheques';
import Export from './pages/Export/Export';
import Report from './pages/Report/Report';
import Offers from './pages/Offers/Offers';
import PriceList from './pages/PriceList/PriceList';
import Suppliers from './pages/Suppliers/Suppliers';
import Purchases from './pages/Purchases/Purchases';
import CostCalc from './pages/CostCalc/CostCalc';
import CreditBalance from './pages/CreditBalance/CreditBalance';
import Products from './pages/Products/Products';
import BatchCosting from './pages/BatchCosting/BatchCosting';

function Protected({ children }) {
  const [authState, setAuthState] = useState('checking');

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (mounted) {
          setAuthState(!error && data.session ? 'signed-in' : 'signed-out');
        }
      })
      .catch(() => {
        if (mounted) setAuthState('signed-out');
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setAuthState(session ? 'signed-in' : 'signed-out');
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (authState === 'checking') {
    return (
      <div role="status" style={{ padding: 24, textAlign: 'center' }}>
        Checking sign-in…
      </div>
    );
  }

  return authState === 'signed-in'
    ? children
    : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
        <Route path="/orders" element={<Protected><Orders /></Protected>} />
        <Route path="/dealers" element={<Protected><Dealers /></Protected>} />
        <Route path="/khata" element={<Protected><Khata /></Protected>} />
        <Route path="/invoices" element={<Protected><Invoices /></Protected>} />
        <Route path="/analytics" element={<Protected><Analytics /></Protected>} />
        <Route path="/stock" element={<Protected><Stock /></Protected>} />
        <Route path="/settings" element={<Protected><Settings /></Protected>} />
        <Route path="/cheques" element={<Protected><Cheques /></Protected>} />
        <Route path="/export" element={<Protected><Export /></Protected>} />
        <Route path="/report" element={<Protected><Report /></Protected>} />
        <Route path="/offers" element={<Protected><Offers /></Protected>} />
        <Route path="/pricelist" element={<Protected><PriceList /></Protected>} />
        <Route path="/products" element={<Protected><Products /></Protected>} />
        <Route path="/batch-costing" element={<Protected><BatchCosting /></Protected>} />
        <Route path="/suppliers" element={<Protected><Suppliers /></Protected>} />
        <Route path="/purchases" element={<Protected><Purchases /></Protected>} />
        <Route path="/costcalc" element={<Protected><CostCalc /></Protected>} />
        <Route path="/diary" element={<Navigate to="/orders" replace />} />
        <Route path="/diarydashboard" element={<Navigate to="/analytics" replace />} />
        <Route path="/creditbalance" element={<Protected><CreditBalance /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}