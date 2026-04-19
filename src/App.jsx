import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { AboutPage } from './pages/AboutPage';
import { DashboardPage } from './pages/DashboardPage';
import { HistoryPage } from './pages/HistoryPage';
import { HomePage } from './pages/HomePage';
import { ThreatDetailsPage } from './pages/ThreatDetailsPage';

function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/threat-details" element={<ThreatDetailsPage />} />
        <Route path="/threat-details/:scanId" element={<ThreatDetailsPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
    </AppShell>
  );
}

export default App;
