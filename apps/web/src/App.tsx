import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LoginPage, RegisterPage, RequireAuth } from './features/auth/AuthPages';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { PortfolioPage } from './features/portfolio/PortfolioPage';
import { AssetDetailPage } from './features/portfolio/AssetDetailPage';
import { OperationsPage } from './features/operations/OperationsPage';
import { StatsPage } from './features/stats/StatsPage';
import { MorePage } from './features/more/MorePage';
import { MastersPage } from './features/admin/MastersPage';
import { AssetsAdminPage } from './features/admin/AssetsAdminPage';
import { SettingsPage } from './features/admin/SettingsPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/assets/:id" element={<AssetDetailPage />} />
          <Route path="/operations" element={<OperationsPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/more" element={<MorePage />} />
          <Route path="/admin/masters" element={<MastersPage />} />
          <Route path="/admin/assets" element={<AssetsAdminPage />} />
          <Route path="/admin/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
