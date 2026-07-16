import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import { DashboardLayout } from './pages/DashboardLayout'
import {
  AnalyticsPage,
  HomePage,
  IntelligencePage,
  MapPage,
  MonitoringPage,
} from './pages/FunctionalPages'
import { AnalyticsWallPage } from './pages/AnalyticsWallPage'
import { AnalyticsOverviewWallPage } from './pages/AnalyticsOverviewWallPage'
import './App.css'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="analytics/wall" element={<AnalyticsOverviewWallPage />} />
        <Route path="analytics/wall/trends" element={<AnalyticsWallPage />} />
        <Route element={<DashboardLayout />}>
          <Route index element={<HomePage />} />
          <Route path="monitoring" element={<MonitoringPage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="intelligence" element={<IntelligencePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

export default App
