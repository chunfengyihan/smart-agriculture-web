import { Outlet } from 'react-router-dom'
import { DashboardTopbar } from '../components/dashboard/DashboardTopbar'
import { useDashboard } from '../hooks/useDashboard'
import type { DashboardOutletContext } from './dashboardContext'

export function DashboardLayout() {
  const dashboard = useDashboard()

  if (!dashboard.data) {
    return (
      <main className="app-shell loading-shell">
        <div className="loading-panel">
          <img className="loading-logo" src="/logo-mark.svg" alt="" />
          <h1>智慧农业管理中枢</h1>
          <p>{dashboard.error || '正在准备温室数据...'}</p>
          <button type="button" onClick={() => void dashboard.refetch({ force: true })}>
            重新加载
          </button>
        </div>
      </main>
    )
  }

  if (!dashboard.selectedCrop) {
    return (
      <main className="app-shell loading-shell">
        <div className="loading-panel">
          <img className="loading-logo" src="/logo-mark.svg" alt="" />
          <h1>暂无温室数据</h1>
          <p>{dashboard.error || '数据库连接正常，尚未录入温室和设备数据。'}</p>
          <button type="button" onClick={() => void dashboard.refetch({ force: true })}>
            重新检查
          </button>
        </div>
      </main>
    )
  }

  const context: DashboardOutletContext = {
    ...dashboard,
    data: dashboard.data,
    selectedCrop: dashboard.selectedCrop,
  }

  return (
    <main className="app-shell site-shell">
      <DashboardTopbar
        error={dashboard.error}
        isFetching={dashboard.isFetching}
        isPaused={dashboard.isPaused}
        mobileNavOpen={dashboard.mobileNavOpen}
        theme={dashboard.theme}
        onCloseMobileNav={dashboard.closeMobileNav}
        onRefresh={() => void dashboard.refetch({ force: true })}
        onToggleMobileNav={dashboard.toggleMobileNav}
        onToggleTheme={dashboard.toggleTheme}
      />
      <Outlet context={context} />
      <footer className="site-footer" aria-label="Project author">
        <span>Smart Agriculture Website</span>
        <span>Built by Zhao Xihan</span>
      </footer>
    </main>
  )
}
