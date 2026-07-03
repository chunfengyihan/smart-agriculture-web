import { lazy, Suspense, useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  Activity,
  AlertTriangle,
  Camera,
  CloudSun,
  Droplets,
  Gauge,
  MapPin,
  Menu,
  Moon,
  RefreshCw,
  Sprout,
  Sun,
  ThermometerSun,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'
import { greenhouseLocations } from './data/greenhouseLocations'
import { useDashboardQuery } from './hooks/useDashboardQuery'
import { formatTime, hasMetricValue, metricValue, sourceText, statusText } from './lib/formatters'
import type {
  Crop,
  DashboardData,
  Greenhouse,
  MetricReading,
  ThemeMode,
} from './types'
import './App.css'

const configuredDataSource = import.meta.env.VITE_DATA_SOURCE || 'remote'
const usesDjangoApi =
  configuredDataSource === 'remote' ||
  (!import.meta.env.VITE_DATA_SOURCE && import.meta.env.VITE_USE_REMOTE_DATA === 'true')
const WeatherAdvicePanel = lazy(() => import('./components/WeatherAdvicePanel'))
const CropDiagnosisPanel = lazy(() => import('./components/CropDiagnosisPanel'))
const JujubeAdvisorPanel = lazy(() => import('./components/JujubeAdvisorPanel'))
const TrendChart = lazy(() => import('./components/TrendChart'))

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

type DalianFeatureCollection = {
  type: 'FeatureCollection'
  features: DalianFeature[]
}

type DalianFeature = {
  type: 'Feature'
  properties: {
    name: string
    adcode: number
    center?: [number, number]
    centroid?: [number, number]
  }
  geometry: {
    type: 'MultiPolygon'
    coordinates: number[][][][]
  }
}

const mapWidth = 760
const mapHeight = 520
const mapPadding = 26

function dashboardSourceText(source: DashboardData['source']) {
  const label = sourceText(source)
  return usesDjangoApi ? `Django API / ${label}` : label
}

function getInitialTheme(): ThemeMode {
  const stored = localStorage.getItem('theme') as ThemeMode | null
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
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

function GreenhouseMap({
  selectedCropId,
  onSelectLocation,
}: {
  selectedCropId: Crop['id']
  onSelectLocation: (cropId: Crop['id'], greenhouseId: string) => void
}) {
  const [mapData, setMapData] = useState<DalianFeatureCollection | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch('/data/dalian.geojson')
      .then((response) => {
        if (!response.ok) throw new Error('Dalian map data failed to load')
        return response.json() as Promise<DalianFeatureCollection>
      })
      .then((data) => {
        if (!cancelled) setMapData(data)
      })
      .catch(() => {
        if (!cancelled) setMapData(null)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const mapProjection = useMemo(() => {
    if (!mapData) return null

    const points = mapData.features.flatMap((feature) =>
      feature.geometry.coordinates.flatMap((polygon) => polygon.flatMap((ring) => ring)),
    )
    const longitudes = points.map(([lon]) => lon)
    const latitudes = points.map(([, lat]) => lat)
    const minLon = Math.min(...longitudes)
    const maxLon = Math.max(...longitudes)
    const minLat = Math.min(...latitudes)
    const maxLat = Math.max(...latitudes)
    const scale = Math.min(
      (mapWidth - mapPadding * 2) / (maxLon - minLon),
      (mapHeight - mapPadding * 2) / (maxLat - minLat),
    )
    const drawnWidth = (maxLon - minLon) * scale
    const drawnHeight = (maxLat - minLat) * scale
    const offsetX = (mapWidth - drawnWidth) / 2
    const offsetY = (mapHeight - drawnHeight) / 2
    const project = ([lon, lat]: [number, number]) => ({
      x: offsetX + (lon - minLon) * scale,
      y: offsetY + (maxLat - lat) * scale,
    })

    return {
      project,
      paths: mapData.features.map((feature) => ({
        name: feature.properties.name,
        adcode: feature.properties.adcode,
        d: feature.geometry.coordinates
          .flatMap((polygon) =>
            polygon.map((ring) =>
              ring
                .map((point, index) => {
                  const projected = project(point as [number, number])
                  return `${index === 0 ? 'M' : 'L'}${projected.x.toFixed(2)} ${projected.y.toFixed(2)}`
                })
                .join(' ') + ' Z',
            ),
          )
          .join(' '),
        labelPoint: project((feature.properties.centroid || feature.properties.center || [0, 0]) as [number, number]),
      })),
    }
  }, [mapData])

  const plottedLocations = greenhouseLocations.filter(
    (location): location is (typeof greenhouseLocations)[number] & { lon: number; lat: number } =>
      typeof location.lon === 'number' && typeof location.lat === 'number',
  )
  const pendingLocations = greenhouseLocations.filter((location) => typeof location.lon !== 'number')

  return (
    <section className="location-panel">
      <div className="section-heading location-heading">
        <div>
          <p>大连棚区位置</p>
          <h2>棚区位置与作物分布</h2>
        </div>
        <span>
          <MapPin size={16} />
          {plottedLocations.length} 处已标注
        </span>
      </div>

      <div className="dalian-map-wrap">
        <div className="dalian-map" aria-label="大连市作物大棚位置示意图">
          <svg className="dalian-map-shape" viewBox="0 0 760 520" role="img" aria-label="大连市地图轮廓">
            {mapProjection?.paths.map((district) => (
              <path key={district.adcode} d={district.d}>
                <title>{district.name}</title>
              </path>
            ))}
          </svg>
          {mapProjection?.paths.map((district) => (
            <span
              key={district.adcode}
              className="map-label"
              style={{
                left: `${(district.labelPoint.x / mapWidth) * 100}%`,
                top: `${(district.labelPoint.y / mapHeight) * 100}%`,
              }}
            >
              {district.name}
            </span>
          ))}
          {mapProjection &&
            plottedLocations.map((location) => {
              const point = mapProjection.project([location.lon, location.lat])

              return (
                <button
                  key={location.cropId}
                  className={`crop-marker ${location.cropId} ${point.y < 170 ? 'tooltip-below' : ''} ${
                    selectedCropId === location.cropId ? 'active' : ''
                  }`}
                  style={{ left: `${(point.x / mapWidth) * 100}%`, top: `${(point.y / mapHeight) * 100}%` }}
                  type="button"
                  onClick={() => onSelectLocation(location.cropId, location.greenhouseId)}
                  aria-label={`${location.cropName}位置：${location.address}`}
                >
                  <span className="marker-icon">{location.marker}</span>
                  <span className="marker-tooltip">
                    <strong>{location.name}</strong>
                    <small>{location.address}</small>
                    <span className="photo-placeholder">
                      {location.photo ? (
                        <img src={location.photo} alt={`${location.name}实景`} />
                      ) : (
                        <>
                          <Camera size={20} />
                          大棚图片待补充
                        </>
                      )}
                    </span>
                  </span>
                </button>
              )
            })}

          {!mapProjection && (
            <span className="map-loading">
              <MapPin size={22} />
              正在加载大连市地图
            </span>
          )}
        </div>

        <div className="location-legend">
          {greenhouseLocations.map((location) => (
            <button
              key={location.cropId}
              className={`legend-item ${selectedCropId === location.cropId ? 'active' : ''}`}
              type="button"
              disabled={!location.greenhouseId}
              onClick={() => location.greenhouseId && onSelectLocation(location.cropId, location.greenhouseId)}
            >
              <span>{location.marker}</span>
              <strong>{location.cropName}</strong>
              <small>{location.address}</small>
            </button>
          ))}
          {pendingLocations.length > 0 && <p className="pending-note">樱桃棚位置确定后，可在这里补充地图坐标。</p>}
        </div>
      </div>
    </section>
  )
}

function PanelFallback({ label }: { label: string }) {
  return (
    <article className="lazy-panel">
      <RefreshCw className="spinning" size={18} />
      {label}
    </article>
  )
}

function App() {
  const {
    data: dashboard,
    error,
    isFetching,
    isPaused,
    refetch: refetchDashboard,
  } = useDashboardQuery()
  const [selectedCropId, setSelectedCropId] = useState<Crop['id']>('jujube')
  const [selectedGreenhouseId, setSelectedGreenhouseId] = useState<string>('')
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  const selectedCrop = useMemo(
    () => dashboard?.crops.find((crop) => crop.id === selectedCropId) || dashboard?.crops[0],
    [dashboard, selectedCropId],
  )

  const selectedGreenhouse = useMemo(() => {
    if (!selectedCrop) return undefined
    return (
      selectedCrop.greenhouses.find((greenhouse) => greenhouse.id === selectedGreenhouseId) ||
      selectedCrop.greenhouses[0]
    )
  }, [selectedCrop, selectedGreenhouseId])

  const totals = useMemo(() => {
    const crops = dashboard?.crops || []
    const greenhouses = crops.flatMap((crop) => crop.greenhouses)
    return {
      greenhouses: greenhouses.length,
      onlineDevices: greenhouses.reduce((sum, item) => sum + item.onlineDevices, 0),
      totalDevices: greenhouses.reduce((sum, item) => sum + item.totalDevices, 0),
      alerts: greenhouses.reduce((sum, item) => sum + item.alerts.length, 0),
    }
  }, [dashboard])

  const cropAlerts = selectedCrop?.greenhouses.reduce((sum, item) => sum + item.alerts.length, 0) || 0

  if (!dashboard || !selectedCrop) {
    return (
      <main className="app-shell loading-shell">
        <div className="loading-panel">
          <img className="loading-logo" src="/logo-mark.svg" alt="" />
          <h1>智慧农业管理中枢</h1>
          <p>{error || '正在准备温室数据...'}</p>
          <button type="button" onClick={() => void refetchDashboard({ force: true })}>
            重新加载
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <img src="/logo-mark.svg" alt="" />
          </span>
          <strong>智慧农业</strong>
        </div>
        <nav id="mobile-nav" className={`top-links ${mobileNavOpen ? 'open' : ''}`} aria-label="页面分区">
          <a href="#overview" onClick={() => setMobileNavOpen(false)}>
            概览
          </a>
          <a href="#map" onClick={() => setMobileNavOpen(false)}>
            位置
          </a>
          <a href="#detail" onClick={() => setMobileNavOpen(false)}>
            监测
          </a>
          <a href="#diagnosis" onClick={() => setMobileNavOpen(false)}>
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
            {totals.alerts > 0 ? `${totals.alerts} 条提醒` : '全部正常'}
          </span>
          <button
            className="icon-button"
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="切换主题"
            title="切换主题"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={() => void refetchDashboard({ force: true })}
            aria-label="刷新数据"
            title="刷新数据"
          >
            <RefreshCw className={isFetching ? 'spinning' : ''} size={18} />
          </button>
          <button
            className="icon-button mobile-menu-button"
            type="button"
            onClick={() => setMobileNavOpen((open) => !open)}
            aria-expanded={mobileNavOpen}
            aria-controls="mobile-nav"
            aria-label="打开页面导航"
            title="页面导航"
          >
            {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      <section
        id="overview"
        className="hero-section"
        style={{ '--crop-accent': selectedCrop.accent, backgroundImage: `url(${selectedCrop.heroImage})` } as CSSProperties}
      >
        <div className="hero-content">
          <span className="hero-label">智慧农业中控台</span>
          <p className="eyebrow">
            <Sprout size={16} />
            {dashboardSourceText(dashboard.source)} · 更新于 {formatTime(dashboard.generatedAt)}
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

      <nav className="crop-tabs" aria-label="作物切换">
        {dashboard.crops.map((crop) => (
          <button
            key={crop.id}
            className={crop.id === selectedCrop.id ? 'active' : ''}
            type="button"
            onClick={() => {
              setSelectedCropId(crop.id)
              setSelectedGreenhouseId(crop.greenhouses[0]?.id || '')
              setMobileNavOpen(false)
            }}
          >
            <span style={{ backgroundColor: crop.accent }} />
            <strong>{crop.name}</strong>
            <small>
              {crop.greenhouses.length} 座棚 ·{' '}
              {crop.greenhouses.reduce((sum, greenhouse) => sum + greenhouse.alerts.length, 0)} 条提醒
            </small>
          </button>
        ))}
      </nav>

      <div id="map">
        <GreenhouseMap
          selectedCropId={selectedCrop.id}
          onSelectLocation={(cropId, greenhouseId) => {
            setSelectedCropId(cropId)
            setSelectedGreenhouseId(greenhouseId)
            setMobileNavOpen(false)
          }}
        />
      </div>

      <section id="detail" className="dashboard-grid">
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
                  onSelect={() => setSelectedGreenhouseId(greenhouse.id)}
                />
              ))
            ) : (
              <div className="empty-state">当前作物暂无本地采集数据</div>
            )}
          </div>
        </aside>

        {selectedGreenhouse ? (
          <section className="detail-panel">
            <div className="section-heading detail-heading">
              <div>
                <p>{selectedGreenhouse.area}</p>
                <h2>{selectedGreenhouse.name}</h2>
              </div>
              <span className={`status-pill ${selectedGreenhouse.status}`}>
                {statusText(selectedGreenhouse.status)}
              </span>
            </div>

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

            <div id="diagnosis">
              <Suspense fallback={<PanelFallback label="正在加载 AI 诊断模块" />}>
                <CropDiagnosisPanel
                  key={`${selectedCrop.id}-${selectedGreenhouse.id}`}
                  crop={selectedCrop}
                  greenhouse={selectedGreenhouse}
                />
              </Suspense>
            </div>

            {selectedCrop.id === 'jujube' && (
              <Suspense fallback={<PanelFallback label="正在加载冰糖枣顾问" />}>
                <JujubeAdvisorPanel
                  key={`jujube-advisor-${selectedGreenhouse.id}`}
                  crop={selectedCrop}
                  greenhouse={selectedGreenhouse}
                />
              </Suspense>
            )}

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

              <article className="alerts-panel">
                <div className="section-heading">
                  <div>
                    <p>异常和建议</p>
                    <h2>预警中心</h2>
                  </div>
                  <AlertTriangle size={20} />
                </div>
                <div className="alert-list">
                  {selectedGreenhouse.alerts.length > 0 ? (
                    selectedGreenhouse.alerts.map((alert) => (
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
            </div>
          </section>
        ) : (
          <section className="detail-panel no-data-panel">
            <div className="empty-state">
              <h2>{selectedCrop.name} 暂无本地数据</h2>
              <p>当前数据文件夹里没有识别到该作物的大棚采集表。放入对应 Excel 后重新运行本地数据构建脚本即可显示。</p>
            </div>
          </section>
        )}
      </section>
    </main>
  )
}

export default App
