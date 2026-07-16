import { Menu, Moon, RefreshCw, Sun, X } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import type { ThemeMode } from '../../types'

interface DashboardTopbarProps {
  error: string | null
  isFetching: boolean
  isPaused: boolean
  mobileNavOpen: boolean
  theme: ThemeMode
  onCloseMobileNav: () => void
  onRefresh: () => void
  onToggleMobileNav: () => void
  onToggleTheme: () => void
}

const navigation = [
  { to: '/', label: '首页', end: true },
  { to: '/monitoring', label: '棚区监测' },
  { to: '/map', label: '地图分布' },
  { to: '/analytics', label: '数据分析' },
  { to: '/intelligence', label: '智能服务' },
]

export function DashboardTopbar({
  error,
  isFetching,
  isPaused,
  mobileNavOpen,
  theme,
  onCloseMobileNav,
  onRefresh,
  onToggleMobileNav,
  onToggleTheme,
}: DashboardTopbarProps) {
  return (
    <header className="topbar">
      <Link className="brand" to="/" onClick={onCloseMobileNav} aria-label="智慧农业首页">
        <img src="/logo-lockup.png" alt="智慧农业 Smart Agriculture" />
      </Link>
      <nav id="mobile-nav" className={`top-links ${mobileNavOpen ? 'open' : ''}`} aria-label="主导航">
        {navigation.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onCloseMobileNav}
            className={({ isActive }) => (isActive ? 'active' : undefined)}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="topbar-actions">
        <span className="sr-only" aria-live="polite">
          {error ? '数据刷新失败' : isPaused ? '数据刷新已暂停' : isFetching ? '正在刷新数据' : '数据已更新'}
        </span>
        <button className="icon-button" type="button" onClick={onToggleTheme} aria-label="切换主题" title="切换主题">
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <button className="icon-button refresh-button" type="button" onClick={onRefresh} aria-label="刷新数据" title="刷新数据">
          <RefreshCw className={isFetching ? 'spinning' : ''} size={20} />
          <span>刷新</span>
        </button>
        <button
          className="icon-button mobile-menu-button"
          type="button"
          onClick={onToggleMobileNav}
          aria-expanded={mobileNavOpen}
          aria-controls="mobile-nav"
          aria-label="打开主导航"
          title="主导航"
        >
          {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
    </header>
  )
}
