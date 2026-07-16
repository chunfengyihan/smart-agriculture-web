import { lazy, Suspense } from 'react'
import { Activity, CloudSun, Droplets, Gauge, Sprout, Sun, ThermometerSun, Wifi, WifiOff } from 'lucide-react'
import type { Crop, Greenhouse, MetricReading } from '../../types'
import { hasMetricValue, metricValue, statusText } from '../../lib/formatters'
import { AlertPanel } from './AlertPanel'
import { PanelFallback } from './PanelFallback'

const WeatherAdvicePanel = lazy(() => import('../WeatherAdvicePanel'))
const CropDiagnosisPanel = lazy(() => import('../CropDiagnosisPanel'))
const JujubeAdvisorPanel = lazy(() => import('../JujubeAdvisorPanel'))
const TrendChart = lazy(() => import('../TrendChart'))
const HistoricalAnalyticsPanel = lazy(() => import('../HistoricalAnalyticsPanel'))

const metricIcons: Record<string, typeof ThermometerSun> = {
  airTemp: ThermometerSun,
  airHumidity: Droplets,
  light: Sun,
  co2: CloudSun,
  soilHumidity: Sprout,
  soilTemp: ThermometerSun,
  ec: Gauge,
  ph: Activity,
}

type EnvironmentMode = 'monitoring' | 'analytics' | 'intelligence'

interface EnvironmentPanelProps {
  mode: EnvironmentMode
  selectedCrop: Crop
  selectedGreenhouse?: Greenhouse
  onSelectGreenhouse: (greenhouseId: string) => void
}

function MetricCard({ metric }: { metric: MetricReading }) {
  const Icon = metricIcons[metric.key] || Activity

  return (
    <article className={`metric-card ${metric.status}`}>
      <span className="metric-icon" aria-hidden="true">
        <Icon size={17} strokeWidth={1.8} />
      </span>
      <p>{metric.label}</p>
      <strong>
        {metricValue(metric)}
        {hasMetricValue(metric) && <span>{metric.unit}</span>}
      </strong>
      <small>目标 {metric.target}</small>
    </article>
  )
}

function GreenhouseCard({
  greenhouse,
  active,
  onSelect,
}: {
  greenhouse: Greenhouse
  active: boolean
  onSelect: () => void
}) {
  const temp = greenhouse.metrics.find((metric) => metric.key === 'airTemp')
  const humidity = greenhouse.metrics.find((metric) => metric.key === 'airHumidity')
  const soil = greenhouse.metrics.find((metric) => metric.key === 'soilHumidity')

  return (
    <button
      className={`greenhouse-card ${greenhouse.status} ${active ? 'active' : ''}`}
      type="button"
      onClick={onSelect}
    >
      <span className="greenhouse-card-main">
        <span className="card-topline">
          <span>{greenhouse.area}</span>
          <span className="status-pill">{statusText(greenhouse.status)}</span>
        </span>
        <strong>{greenhouse.name}</strong>
        <span className="device-row">
          {greenhouse.status === 'offline' ? <WifiOff size={15} /> : <Wifi size={15} />}
          {greenhouse.onlineDevices}/{greenhouse.totalDevices} 台设备在线
        </span>
      </span>
      <span className="quick-grid">
        <span>
          <small>温度</small>
          <strong>{temp && hasMetricValue(temp) ? `${temp.value.toFixed(1)}°C` : '-'}</strong>
        </span>
        <span>
          <small>湿度</small>
          <strong>{humidity && hasMetricValue(humidity) ? `${humidity.value}%` : '-'}</strong>
        </span>
        <span>
          <small>土壤</small>
          <strong>{soil && hasMetricValue(soil) ? `${soil.value}%` : '-'}</strong>
        </span>
      </span>
    </button>
  )
}

function GreenhouseList({
  selectedCrop,
  selectedGreenhouse,
  onSelectGreenhouse,
}: Omit<EnvironmentPanelProps, 'mode'>) {
  return (
    <aside className="greenhouse-list">
      <div className="section-heading">
        <div>
          <p>{selectedCrop.latinName}</p>
          <h2>选择棚区</h2>
        </div>
        <span>{selectedCrop.greenhouses.length} 座</span>
      </div>
      <div className="greenhouse-stack">
        {selectedCrop.greenhouses.length > 0 ? (
          selectedCrop.greenhouses.map((greenhouse) => (
            <GreenhouseCard
              key={greenhouse.id}
              greenhouse={greenhouse}
              active={greenhouse.id === selectedGreenhouse?.id}
              onSelect={() => onSelectGreenhouse(greenhouse.id)}
            />
          ))
        ) : (
          <div className="empty-state">当前作物暂无本地采集数据</div>
        )}
      </div>
    </aside>
  )
}

export function EnvironmentPanel({ mode, selectedCrop, selectedGreenhouse, onSelectGreenhouse }: EnvironmentPanelProps) {
  return (
    <section className={`dashboard-grid environment-view ${mode}`}>
      <GreenhouseList
        selectedCrop={selectedCrop}
        selectedGreenhouse={selectedGreenhouse}
        onSelectGreenhouse={onSelectGreenhouse}
      />

      {selectedGreenhouse ? (
        <section className="detail-panel">
          <div className="section-heading detail-heading">
            <div>
              <p>{selectedGreenhouse.area}</p>
              <h2>{selectedGreenhouse.name}</h2>
            </div>
            <span className={`status-pill ${selectedGreenhouse.status}`}>{statusText(selectedGreenhouse.status)}</span>
          </div>

          {mode === 'monitoring' && (
            <>
              <Suspense fallback={<PanelFallback label="正在加载天气模块" />}>
                <WeatherAdvicePanel
                  key={`weather-${selectedCrop.id}-${selectedGreenhouse.id}`}
                  crop={selectedCrop}
                  greenhouse={selectedGreenhouse}
                />
              </Suspense>

              <div className="metric-grid">
                {selectedGreenhouse.metrics.map((metric) => (
                  <MetricCard key={metric.key} metric={metric} />
                ))}
              </div>

              <div className="analytics-row">
                <article className="chart-panel">
                  <div className="section-heading">
                    <div>
                      <p>最近 24 小时</p>
                      <h2>环境趋势</h2>
                    </div>
                  </div>
                  <Suspense fallback={<PanelFallback label="正在加载趋势图" />}>
                    <TrendChart accent={selectedCrop.accent} data={selectedGreenhouse.trend} />
                  </Suspense>
                </article>
                <AlertPanel greenhouse={selectedGreenhouse} />
              </div>
            </>
          )}

          {mode === 'analytics' && (
            <Suspense fallback={<PanelFallback label="正在加载 2026 历史采集分析" />}>
              <HistoricalAnalyticsPanel
                key={`history-${selectedCrop.id}-${selectedGreenhouse.id}`}
                selectedCrop={selectedCrop}
                selectedGreenhouse={selectedGreenhouse}
              />
            </Suspense>
          )}

          {mode === 'intelligence' && (
            <div className="intelligence-stack">
              <Suspense fallback={<PanelFallback label="正在加载 AI 诊断模块" />}>
                <CropDiagnosisPanel
                  key={`${selectedCrop.id}-${selectedGreenhouse.id}`}
                  crop={selectedCrop}
                  greenhouse={selectedGreenhouse}
                />
              </Suspense>

              {selectedCrop.id === 'jujube' && (
                <Suspense fallback={<PanelFallback label="正在加载冰糖枣顾问" />}>
                  <JujubeAdvisorPanel
                    key={`jujube-advisor-${selectedGreenhouse.id}`}
                    crop={selectedCrop}
                    greenhouse={selectedGreenhouse}
                  />
                </Suspense>
              )}
            </div>
          )}
        </section>
      ) : (
        <section className="detail-panel no-data-panel">
          <div className="empty-state">
            <h2>{selectedCrop.name} 暂无本地数据</h2>
            <p>当前数据源中没有识别到该作物的棚区采集记录。</p>
          </div>
        </section>
      )}
    </section>
  )
}
