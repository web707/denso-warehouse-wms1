import { Toaster } from '@/components/ui/toaster';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import { ThemeProvider } from '@/lib/theme';
import ProtectedRoute from '@/components/ProtectedRoute';
import PublicOnlyRoute from '@/components/PublicOnlyRoute';
import ScrollToTop from './components/ScrollToTop';
import Layout from '@/components/Layout';
import { StoreProvider } from '@/lib/store';
import Dashboard from '@/pages/Dashboard';
import Orders from '@/pages/Orders';
import OrderDetail from '@/pages/OrderDetail';
import Racks from '@/pages/Racks';
import RackAllocation from '@/pages/RackAllocation';
import RackPlan from '@/pages/RackPlan';
import PackingRules from '@/pages/PackingRules';
import History from '@/pages/History';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import InventoryOperations from '@/pages/InventoryOperations';
import QRLabels from '@/pages/QRLabels';
import LocationDetail from '@/pages/LocationDetail';
import Zones from '@/pages/Zones';
import Reports from '@/pages/Reports';

function App() {
  return (
    <ThemeProvider>
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <AuthProvider>
          <ScrollToTop />
          <StoreProvider>
            <Routes>
              <Route element={<PublicOnlyRoute />}>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
              </Route>
              <Route path="/reset-password" element={<ResetPassword />} />

              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/orders" element={<Orders />} />
                  <Route path="/orders/:orderId" element={<OrderDetail />} />
                  <Route path="/racks" element={<Racks />} />
                  <Route path="/racks/:orderId" element={<RackAllocation />} />
                  <Route path="/racks/:rackId/plan" element={<RackPlan />} />
                  <Route path="/history" element={<History />} />
                  <Route path="/packing-rules" element={<PackingRules />} />
                  <Route path="/inventory" element={<InventoryOperations />} />
                  <Route path="/qr-labels" element={<QRLabels />} />
                  <Route path="/locations/:rackId/:slotCode" element={<LocationDetail />} />
                  <Route path="/zones" element={<Zones />} />
                  <Route path="/reports" element={<Reports />} />
                </Route>
              </Route>

              <Route path="*" element={<PageNotFound />} />
            </Routes>
            <Toaster />
          </StoreProvider>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
