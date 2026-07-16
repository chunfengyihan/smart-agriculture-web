import type { CSSProperties } from 'react'
import { ArrowRight, Bell, MapPin, Monitor, Warehouse } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Crop } from '../../types'

interface HeroPanelProps {
  selectedCrop: Crop
  totals: {
    greenhouses: number
    onlineDevices: number
    totalDevices: number
    alerts: number
  }
}

export function HeroPanel({ selectedCrop, totals }: HeroPanelProps) {
  return (
    <section
      className="hero-section"
      style={{ '--crop-accent': selectedCrop.accent, backgroundImage: `url(${selectedCrop.heroImage})` } as CSSProperties}
    >
      <div className="hero-content">
        <p className="hero-kicker">智慧农业 · 实时生产管理</p>
        <h1>智慧农业管理平台</h1>
        <p className="hero-slogan">让每一座大棚更智慧</p>
        <span className="hero-divider" aria-hidden="true" />
        <p className="hero-description">实时掌握环境、设备与作物状态</p>
        <div className="hero-actions">
          <Link className="hero-primary-action" to="/monitoring">
            进入管理中枢
            <ArrowRight size={20} />
          </Link>
          <Link className="hero-secondary-action" to="/map">
            查看棚区地图
            <MapPin size={19} />
          </Link>
        </div>
      </div>
      <div className="hero-stats" aria-label="园区运行概览">
        <span>
          <i className="hero-stat-icon" aria-hidden="true"><Monitor size={30} /></i>
          <span>
            <small>在线设备</small>
            <strong>{totals.onlineDevices}<em>/{totals.totalDevices}</em></strong>
          </span>
        </span>
        <span>
          <i className="hero-stat-icon" aria-hidden="true"><Warehouse size={30} /></i>
          <span>
            <small>管理棚区</small>
            <strong>{totals.greenhouses}<em> 个</em></strong>
          </span>
        </span>
        <span>
          <i className="hero-stat-icon warning" aria-hidden="true"><Bell size={30} /></i>
          <span>
            <small>今日预警</small>
            <strong className="warning-value">{totals.alerts}<em> 条</em></strong>
          </span>
        </span>
      </div>
    </section>
  )
}
