import { Activity, AlertTriangle, Menu, Moon, RefreshCw, Sun, X } from 'lucide-react'
import type { ThemeMode } from '../../types'

interface DashboardTopbarProps {
  error: string | null
  isFetching: boolean
  isPaused: boolean
  mobileNavOpen: boolean
  theme: ThemeMode
  totalAlerts: number
  onCloseMobileNav: () => void
  onRefresh: () => void
  onToggleMobileNav: () => void
  onToggleTheme: () => void
}

export function DashboardTopbar({
  error,
  isFetching,
  isPaused,
  mobileNavOpen,
  theme,
  totalAlerts,
  onCloseMobileNav,
  onRefresh,
  onToggleMobileNav,
  onToggleTheme,
}: DashboardTopbarProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">
          <img src="/logo-mark.svg" alt="" />
        </span>
        <strong>智慧农业</strong>
      </div>
      <nav id="mobile-nav" className={`top-links ${mobileNavOpen ? 'open' : ''}`} aria-label="页面分区">
        <a href="#overview" onClick={onCloseMobileNav}>
          概览
        </a>
        <a href="#map" onClick={onCloseMobileNav}>
          位置
        </a>
        <a href="#detail" onClick={onCloseMobileNav}>
          监测
        </a>
        <a href="#diagnosis" onClick={onCloseMobileNav}>
          AI 诊断
        </a>
      </nav>
      <div className="topbar-actions">
        {error ? (
          <span className="query-status warning">
            <AlertTriangle size={14} />
            数据刷新失败
          </span>
        ) : null}
        {isPaused ? <span className="query-status muted">暂停刷新</span> : null}
        {isFetching ? <span className="query-status">正在刷新</span> : null}
        <span className="health-pill">
          <Activity size={15} />
          {totalAlerts > 0 ? `${totalAlerts} 条提醒` : '全部正常'}
        </span>
        <button className="icon-button" type="button" onClick={onToggleTheme} aria-label="切换主题" title="切换主题">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button className="icon-button" type="button" onClick={onRefresh} aria-label="刷新数据" title="刷新数据">
          <RefreshCw className={isFetching ? 'spinning' : ''} size={18} />
        </button>
        <button
          className="icon-button mobile-menu-button"
          type="button"
          onClick={onToggleMobileNav}
          aria-expanded={mobileNavOpen}
          aria-controls="mobile-nav"
          aria-label="打开页面导航"
          title="页面导航"
        >
          {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
    </header>
  )
}
