import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login      from './pages/Login/Login';
import Dashboard  from './pages/Dashboard/Dashboard';
import Orders     from './pages/Orders/Orders';
import Dealers    from './pages/Dealers/Dealers';
import Khata      from './pages/Khata/Khata';
import Invoices   from './pages/Invoices/Invoices';
import Analytics  from './pages/Analytics/Analytics';
import Stock      from './pages/Stock/Stock';
import Settings   from './pages/Settings/Settings';
import Cheques    from './pages/Cheques/Cheques';
import Export     from './pages/Export/Export';
import Report     from './pages/Report/Report';
import Offers     from './pages/Offers/Offers';
import PriceList  from './pages/PriceList/PriceList';
import Suppliers  from './pages/Suppliers/Suppliers';
import Purchases  from './pages/Purchases/Purchases';
import CostCalc   from './pages/CostCalc/CostCalc';

function Protected({ children }) {
  const auth = sessionStorage.getItem('vx_auth');
  return auth ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"           element={<Login />} />
        <Route path="/dashboard"  element={<Protected><Dashboard /></Protected>} />
        <Route path="/orders"     element={<Protected><Orders /></Protected>} />
        <Route path="/dealers"    element={<Protected><Dealers /></Protected>} />
        <Route path="/khata"      element={<Protected><Khata /></Protected>} />
        <Route path="/invoices"   element={<Protected><Invoices /></Protected>} />
        <Route path="/analytics"  element={<Protected><Analytics /></Protected>} />
        <Route path="/stock"      element={<Protected><Stock /></Protected>} />
        <Route path="/settings"   element={<Protected><Settings /></Protected>} />
        <Route path="/cheques"    element={<Protected><Cheques /></Protected>} />
        <Route path="/export"     element={<Protected><Export /></Protected>} />
        <Route path="/report"     element={<Protected><Report /></Protected>} />
        <Route path="/offers"     element={<Protected><Offers /></Protected>} />
        <Route path="/pricelist"  element={<Protected><PriceList /></Protected>} />
        <Route path="/suppliers"  element={<Protected><Suppliers /></Protected>} />
        <Route path="/purchases"  element={<Protected><Purchases /></Protected>} />
        <Route path="/costcalc"   element={<Protected><CostCalc /></Protected>} />
        <Route path="*"           element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}