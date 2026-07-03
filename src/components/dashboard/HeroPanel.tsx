import type { CSSProperties } from 'react'
import { Sprout } from 'lucide-react'
import type { Crop, DashboardData } from '../../types'
import { formatTime } from '../../lib/formatters'

interface HeroPanelProps {
  cropAlerts: number
  dashboard: DashboardData
  dashboardSourceLabel: string
  selectedCrop: Crop
  totals: {
    onlineDevices: number
    totalDevices: number
  }
}

export function HeroPanel({ cropAlerts, dashboard, dashboardSourceLabel, selectedCrop, totals }: HeroPanelProps) {
  return (
    <section
      id="overview"
      className="hero-section"
      style={{ '--crop-accent': selectedCrop.accent, backgroundImage: `url(${selectedCrop.heroImage})` } as CSSProperties}
    >
      <div className="hero-content">
        <span className="hero-label">智慧农业中控台</span>
        <p className="eyebrow">
          <Sprout size={16} />
          {dashboardSourceLabel} · 更新于 {formatTime(dashboard.generatedAt)}
        </p>
        <h1>{selectedCrop.name}</h1>
        <p className="hero-description">{selectedCrop.description}</p>
      </div>
      <div className="hero-stats">
        <span>
          <strong>{selectedCrop.greenhouses.length}</strong>
          <small>当前作物大棚</small>
        </span>
        <span>
          <strong>
            {totals.onlineDevices}/{totals.totalDevices}
          </strong>
          <small>设备在线</small>
        </span>
        <span>
          <strong>{cropAlerts}</strong>
          <small>作物提醒</small>
        </span>
      </div>
    </section>
  )
}
