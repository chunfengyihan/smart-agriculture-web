import { AlertTriangle } from 'lucide-react'
import type { Greenhouse } from '../../types'

interface AlertPanelProps {
  greenhouse: Greenhouse
}

export function AlertPanel({ greenhouse }: AlertPanelProps) {
  return (
    <article className="alerts-panel">
      <div className="section-heading">
        <div>
          <p>异常和建议</p>
          <h2>预警中心</h2>
        </div>
        <AlertTriangle size={20} />
      </div>
      <div className="alert-list">
        {greenhouse.alerts.length > 0 ? (
          greenhouse.alerts.map((alert) => (
            <div className={`alert-item ${alert.level}`} key={alert.id}>
              <span>{alert.time}</span>
              <p>{alert.message}</p>
            </div>
          ))
        ) : (
          <div className="empty-state">当前大棚暂无预警</div>
        )}
      </div>
    </article>
  )
}
