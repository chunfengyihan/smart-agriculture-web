import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  Bug,
  CloudSun,
  Droplets,
  Gauge,
  Leaf,
  MapPin,
  Maximize,
  Minimize2,
  Radio,
  Sprout,
  Sun,
  Thermometer,
  Tractor,
  Waves,
  Wind,
  X,
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useHistoricalAnalytics } from '../hooks/useHistoricalAnalytics'
import { findGreenhouseLocation } from '../data/greenhouseLocations'
import { getOpenMeteoCurrentWeather } from '../data/weatherAdvice'
import type {
  CropId,
  GreenhouseWeather,
  HistoricalGreenhouseAnalytics,
  HistoricalMetricKey,
  HistoricalMetricSeries,
} from '../types'

const metricOrder: HistoricalMetricKey[] = [
  'airTemp',
  'airHumidity',
  'light',
  'co2',
  'soilHumidity',
  'soilTemp',
  'ec',
  'ph',
]

const trendKeys: HistoricalMetricKey[] = ['airTemp', 'airHumidity', 'co2']

const statusText: Partial<Record<HistoricalMetricKey, string>> = {
  airTemp: '适宜',
  airHumidity: '正常',
  light: '充足',
  co2: '适宜',
  soilHumidity: '正常',
  soilTemp: '适宜',
  ec: '适中',
  ph: '正常',
}

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value))

function timeText(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

function dateNowText(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function dateText(date: string | null) {
  return date ? date.replaceAll('-', '.') : '-'
}

function shortDate(date: string) {
  const [, month, day] = date.split('-')
  return `${month}/${day}`
}

function latestValueText(series?: HistoricalMetricSeries) {
  if (!series || series.latestValue === null || !Number.isFinite(series.latestValue)) return '-'
  if (series.key === 'light' || series.key === 'pressure' || series.key === 'co2') {
    return Math.round(series.latestValue).toLocaleString('zh-CN')
  }
  return series.latestValue.toFixed(series.key === 'ph' ? 2 : 1)
}

function latestTimeText(series?: HistoricalMetricSeries) {
  if (!series?.latestAt) return '--:--:--'
  const match = series.latestAt.match(/T(\d{2}:\d{2}:\d{2})/)
  return match?.[1] || series.latestAt.slice(11, 19)
}

function LiveClock() {
  const [clock, setClock] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="emerald-clock">
      <span>{dateNowText(clock)}</span>
      <strong>{timeText(clock)}</strong>
    </div>
  )
}

type LiveWeatherState = {
  key: string
  status: 'loading' | 'live' | 'fallback'
  weather: GreenhouseWeather | null
}

function LiveExternalWeather({
  cropId,
  greenhouseId,
  fallbackTemperature,
  fallbackHumidity,
}: {
  cropId: CropId
  greenhouseId: string
  fallbackTemperature: number
  fallbackHumidity: number
}) {
  const location = useMemo(
    () => findGreenhouseLocation(cropId, greenhouseId),
    [cropId, greenhouseId],
  )
  const locationKey = `${cropId}:${greenhouseId}:${location?.lat ?? 'none'}:${location?.lon ?? 'none'}`
  const [state, setState] = useState<LiveWeatherState>({
    key: locationKey,
    status: 'loading',
    weather: null,
  })

  const loadWeather = useCallback(
    async (signal: AbortSignal) => {
      if (!location) {
        setState({ key: locationKey, status: 'fallback', weather: null })
        return
      }

      setState((current) => ({
        key: locationKey,
        status: 'loading',
        weather: current.key === locationKey ? current.weather : null,
      }))

      try {
        const weather = await getOpenMeteoCurrentWeather(
          { latitude: location.lat, longitude: location.lon, address: location.address },
          { signal, timeoutMs: 8_000 },
        )
        if (signal.aborted) return
        setState({ key: locationKey, status: 'live', weather })
      } catch {
        if (signal.aborted) return
        setState({ key: locationKey, status: 'fallback', weather: null })
      }
    },
    [location, locationKey],
  )

  useEffect(() => {
    const controller = new AbortController()
    const initialTimer = window.setTimeout(() => void loadWeather(controller.signal), 0)
    const refreshTimer = window.setInterval(() => void loadWeather(controller.signal), 10 * 60 * 1000)
    return () => {
      window.clearTimeout(initialTimer)
      window.clearInterval(refreshTimer)
      controller.abort()
    }
  }, [loadWeather])

  const currentState = state.key === locationKey ? state : { key: locationKey, status: 'loading' as const, weather: null }
  const temperature = currentState.weather?.current.temperature ?? fallbackTemperature
  const humidity = currentState.weather?.current.humidity ?? fallbackHumidity
  const sourceLabel = currentState.status === 'live' ? '实况' : currentState.status === 'loading' ? '同步中' : '棚内回退'
  const sourceTitle = currentState.status === 'live'
    ? `Open-Meteo · ${currentState.weather?.location.address || location?.address || '棚区'} · ${currentState.weather?.current.description || '实时天气'}`
    : currentState.status === 'loading'
      ? '正在同步 Open-Meteo 实时天气'
      : '外部天气暂不可用，当前显示棚内传感器数据'

  return (
    <div className="emerald-weather" title={sourceTitle} aria-label={sourceTitle}>
      <CloudSun size={19} aria-hidden="true" />
      <strong>{temperature.toFixed(1)}°C</strong>
      <span>湿度 {humidity.toFixed(0)}%</span>
      <i className={`emerald-weather-source ${currentState.status}`}>{sourceLabel}</i>
    </div>
  )
}

function qualityFor(greenhouse: HistoricalGreenhouseAnalytics) {
  const totals = greenhouse.series.reduce(
    (result, series) => ({
      valid: result.valid + series.validCount,
      invalid:
        result.invalid + series.invalidCount + series.filteredZeroCount + series.undatedInvalidCount,
    }),
    { valid: 0, invalid: 0 },
  )
  const total = totals.valid + totals.invalid
  return total ? (totals.valid / total) * 100 : 0
}

function MetricIcon({ metricKey }: { metricKey: HistoricalMetricKey }) {
  const props = { size: 15, strokeWidth: 1.7, 'aria-hidden': true as const }
  if (metricKey === 'airTemp' || metricKey === 'soilTemp') return <Thermometer {...props} />
  if (metricKey === 'airHumidity' || metricKey === 'soilHumidity') return <Droplets {...props} />
  if (metricKey === 'light') return <Sun {...props} />
  if (metricKey === 'co2') return <Wind {...props} />
  if (metricKey === 'ec') return <Waves {...props} />
  return <Gauge {...props} />
}

function WallPanel({
  title,
  eyebrow,
  children,
  className = '',
}: {
  title: string
  eyebrow?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <article className={`emerald-panel ${className}`}>
      <header>
        <div>
          {eyebrow && <span>{eyebrow}</span>}
          <h2>{title}</h2>
        </div>
        <i />
      </header>
      {children}
    </article>
  )
}

export function AnalyticsOverviewWallPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { data, error, isLoading } = useHistoricalAnalytics()
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement))
  const [selectedCropId, setSelectedCropId] = useState(searchParams.get('crop') || 'jujube')
  const [selectedGreenhouseId, setSelectedGreenhouseId] = useState(searchParams.get('greenhouse') || '')
  const [selectedSensorId, setSelectedSensorId] = useState<string | null>(null)

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedSensorId(null)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const selectedCrop = data?.crops.find((crop) => crop.id === selectedCropId) || data?.crops[0]
  const selectedGreenhouse =
    selectedCrop?.greenhouses.find((greenhouse) => greenhouse.id === selectedGreenhouseId) ||
    selectedCrop?.greenhouses[0]

  const metricSeries = useMemo(() => {
    if (!selectedGreenhouse) return []
    return metricOrder
      .map((key) => selectedGreenhouse.series.find((series) => series.key === key))
      .filter((series): series is HistoricalMetricSeries => Boolean(series))
  }, [selectedGreenhouse])

  const trendSeries = useMemo(
    () =>
      trendKeys
        .map((key) => selectedGreenhouse?.series.find((series) => series.key === key))
        .filter((series): series is HistoricalMetricSeries => Boolean(series)),
    [selectedGreenhouse],
  )

  const trendData = useMemo(() => {
    const dates = trendSeries[0]?.points.map((point) => point.date) || []
    const step = Math.max(1, Math.ceil(dates.length / 32))
    const sampledDates = dates.filter((_, index) => index % step === 0 || index === dates.length - 1)
    const lookups = new Map(
      trendSeries.map((series) => [
        series.key,
        new Map(series.points.map((point) => [point.date, point.average])),
      ]),
    )
    return sampledDates.map((date, index) => {
      const row: Record<string, string | number | null> = { date, label: shortDate(date) }
      trendSeries.forEach((series) => {
        row[series.key] = lookups.get(series.key)?.get(date) ?? null
      })
      const temp = Number(row.airTemp) || 20
      const humidity = Number(row.airHumidity) || 60
      row.growth = clamp(70 + index * 0.35 - Math.abs(temp - 24) * 1.7 - Math.abs(humidity - 70) * 0.16)
      return row
    })
  }, [trendSeries])

  if (isLoading || !data || !selectedCrop || !selectedGreenhouse) {
    return (
      <main className="analytics-wall-loading">
        <img src="/logo-lockup.png" alt="智慧农业" />
        <p>{error || '正在加载采集数据...'}</p>
        <button type="button" onClick={() => navigate('/analytics')}>返回数据分析</button>
      </main>
    )
  }

  const quality = qualityFor(selectedGreenhouse)
  const latestRows = [...selectedGreenhouse.series]
    .filter((series) => series.latestAt)
    .sort((a, b) => (b.latestAt || '').localeCompare(a.latestAt || ''))
    .slice(0, 4)
  const latestByKey = new Map(metricSeries.map((series) => [series.key, series]))
  const valueOf = (key: HistoricalMetricKey, fallback: number) =>
    latestByKey.get(key)?.latestValue ?? fallback
  const airTemp = valueOf('airTemp', 24)
  const airHumidity = valueOf('airHumidity', 68)
  const soilHumidity = valueOf('soilHumidity', 58)
  const growthIndex = clamp(
    quality * 0.54 +
      (100 - Math.abs(airTemp - 24) * 5) * 0.22 +
      (100 - Math.abs(soilHumidity - 60) * 2.2) * 0.24,
  )
  const riskLevel = airHumidity > 86 ? '中风险' : '低风险'
  const irrigationState = soilHumidity < 45 ? '建议补水' : '水分适宜'
  const selectedLocation = findGreenhouseLocation(selectedCrop.id, selectedGreenhouse.id)
  const gisImage = selectedCrop.id === 'jujube'
    ? '/images/gis/jujube-gis.jpg'
    : selectedCrop.id === 'blueberry'
      ? '/images/gis/blueberry-gis.jpg'
      : `/images/${selectedCrop.id}-hero.jpg`
  const cropPhoto = selectedCrop.id === 'jujube'
    ? '/images/crops/jujube-field.jpg'
    : selectedCrop.id === 'blueberry'
      ? '/images/crops/blueberry-field.jpg'
      : `/images/${selectedCrop.id}-hero.jpg`
  const radarData = [
    { name: '气温', score: clamp(100 - Math.abs(airTemp - 24) * 6) },
    { name: '空气湿度', score: clamp(100 - Math.abs(airHumidity - 70) * 2) },
    { name: '土壤水分', score: clamp(100 - Math.abs(soilHumidity - 60) * 2.2) },
    { name: 'CO₂', score: clamp((valueOf('co2', 500) / 800) * 100) },
    { name: 'EC', score: clamp((valueOf('ec', 1.2) / 2.5) * 100) },
    { name: 'pH', score: clamp(100 - Math.abs(valueOf('ph', 6.5) - 6.5) * 25) },
  ]
  const moistureRows: HistoricalMetricKey[] = ['soilHumidity', 'airHumidity', 'soilTemp', 'ph']
  const sensorPoints = [
    {
      id: 'soil',
      className: 'sensor-a',
      placement: 'right',
      title: '土壤传感器',
      eyebrow: 'SOIL SENSOR · Z1',
      icon: <MapPin size={14} />,
      label: '土壤',
      status: '在线采集',
      primary: valueOf('soilHumidity', 58).toFixed(1),
      unit: '% RH',
      metrics: [
        ['土壤温度', `${valueOf('soilTemp', 22).toFixed(1)}°C`],
        ['土壤 pH', valueOf('ph', 6.5).toFixed(2)],
        ['采集质量', `${quality.toFixed(1)}%`],
      ],
    },
    {
      id: 'irrigation',
      className: 'sensor-b',
      placement: 'right',
      title: '灌溉控制节点',
      eyebrow: 'IRRIGATION VALVE · V2',
      icon: <Droplets size={14} />,
      label: '灌溉',
      status: irrigationState,
      primary: valueOf('soilHumidity', 58).toFixed(1),
      unit: '% 水分',
      metrics: [
        ['阀门状态', soilHumidity < 45 ? '待执行' : '自动待机'],
        ['控制模式', '智能联动'],
        ['链路状态', '正常'],
      ],
    },
    {
      id: 'weather',
      className: 'sensor-c',
      placement: 'left',
      title: '田间气象节点',
      eyebrow: 'WEATHER STATION · W3',
      icon: <Wind size={14} />,
      label: '气象',
      status: '数据正常',
      primary: airTemp.toFixed(1),
      unit: '°C',
      metrics: [
        ['空气湿度', `${airHumidity.toFixed(1)}%`],
        ['CO₂', `${valueOf('co2', 500).toFixed(0)} ppm`],
        ['光照', `${valueOf('light', 0).toFixed(0)} lux`],
      ],
    },
    {
      id: 'growth',
      className: 'sensor-d',
      placement: 'left',
      title: '作物长势监测',
      eyebrow: 'CROP VIGOR · C4',
      icon: <Sprout size={14} />,
      label: '长势',
      status: '长势良好',
      primary: growthIndex.toFixed(1),
      unit: '%',
      metrics: [
        ['数据完整度', `${quality.toFixed(1)}%`],
        ['病虫害风险', riskLevel],
        ['环境适生度', `${radarData.reduce((sum, item) => sum + item.score, 0) / radarData.length >= 75 ? '适宜' : '需关注'}`],
      ],
    },
  ]
  const exitWall = () => {
    navigate('/analytics')
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
  }

  const openTrends = () => {
    navigate(
      `/analytics/wall/trends?crop=${selectedCrop.id}&greenhouse=${encodeURIComponent(selectedGreenhouse.id)}`,
    )
  }

  return (
    <main className="analytics-wall wall-overview-page emerald-wall" aria-label="翡翠夜幕智慧农业数据大屏">
      <header className="emerald-header">
        <div className="emerald-brand">
          <img src="/logo-mark.png" alt="" />
          <div>
            <h1>智慧农业</h1>
            <span>Smart Agriculture Operations Center</span>
          </div>
        </div>
        <LiveClock />
        <LiveExternalWeather
          cropId={selectedCrop.id}
          greenhouseId={selectedGreenhouse.id}
          fallbackTemperature={airTemp}
          fallbackHumidity={airHumidity}
        />
        <div className="emerald-system-status">
          <Radio size={15} aria-hidden="true" />
          <span>系统状态<strong>全部系统正常</strong></span>
        </div>
        <div className="emerald-actions">
          <button type="button" aria-label="返回数据分析" onClick={exitWall}><ArrowLeft size={16} /></button>
          <button
            type="button"
            aria-label={isFullscreen ? '退出浏览器全屏' : '进入浏览器全屏'}
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen()
              else void document.documentElement.requestFullscreen?.()
            }}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize size={16} />}
          </button>
        </div>
      </header>

      <section className="emerald-kpis" aria-label="核心环境指标">
        {metricSeries.slice(0, 6).map((series) => (
          <article key={series.key}>
            <span className="emerald-kpi-icon"><MetricIcon metricKey={series.key} /></span>
            <div><small>{series.label}</small><strong>{latestValueText(series)}<em>{series.unit || series.unitNote}</em></strong></div>
            <i>{statusText[series.key] || '正常'}</i>
          </article>
        ))}
      </section>

      <section className="emerald-dashboard-grid">
        <div className="emerald-side-column emerald-left-column">
          <WallPanel title="土壤墒情" eyebrow="SOIL MOISTURE">
            <div className="emerald-moisture-list">
              {moistureRows.map((key, index) => {
                const series = latestByKey.get(key)
                const percent = key === 'ph' ? clamp((valueOf(key, 6.5) / 14) * 100) : clamp(valueOf(key, 50))
                return (
                  <div key={key}>
                    <span>{series?.label || key}</span>
                    <div><i style={{ width: `${percent}%` }} /></div>
                    <strong>{latestValueText(series)}</strong>
                    <em>Z{index + 1}</em>
                  </div>
                )
              })}
            </div>
          </WallPanel>

          <WallPanel title="环境适生指数" eyebrow="AGRONOMY INDEX" className="emerald-radar-panel">
            <div className="emerald-radar-chart">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 280, height: 160 }}>
                <RadarChart data={radarData} outerRadius="64%">
                  <PolarGrid stroke="rgba(116, 197, 148, .22)" />
                  <PolarAngleAxis dataKey="name" tick={{ fill: '#8db39c', fontSize: 7 }} />
                  <Radar dataKey="score" stroke="#60d28d" fill="#2ea966" fillOpacity={0.26} isAnimationActive={false} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </WallPanel>

          <WallPanel title="气象趋势" eyebrow="WEATHER TREND" className="emerald-weather-panel">
            <div className="emerald-mini-chart">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 280, height: 130 }}>
                <LineChart data={trendData.slice(-18)} margin={{ top: 6, right: 4, left: 2, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" hide />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Line type="monotone" dataKey="airTemp" stroke="#7fe0aa" strokeWidth={1.7} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="emerald-weather-days"><span>今天 {airTemp.toFixed(0)}°</span><span>湿度 {airHumidity.toFixed(0)}%</span><span>微风</span></div>
          </WallPanel>
        </div>

        <article className="emerald-field-panel">
          <img
            className="emerald-gis-image"
            src={gisImage}
            alt={`${selectedCrop.name}种植基地 GIS 卫星影像`}
            decoding="async"
          />
          <div className="emerald-field-shade" />
          <header>
            <div>
              <span>FARM GIS DIGITAL TWIN</span>
              <h2>{selectedCrop.name} GIS 数字种植园</h2>
            </div>
            <button type="button" onClick={openTrends}>趋势分析 <ArrowUpRight size={14} /></button>
          </header>
          <div className="emerald-field-switches">
            <div>
              {data.crops.map((crop) => (
                <button
                  key={crop.id}
                  className={crop.id === selectedCrop.id ? 'active' : ''}
                  type="button"
                  onClick={() => {
                    setSelectedCropId(crop.id)
                    setSelectedGreenhouseId(crop.greenhouses[0]?.id || '')
                    setSelectedSensorId(null)
                  }}
                >
                  {crop.name}
                </button>
              ))}
            </div>
            <div>
              {selectedCrop.greenhouses.map((greenhouse) => (
                <button
                  key={greenhouse.id}
                  className={greenhouse.id === selectedGreenhouse.id ? 'active' : ''}
                  type="button"
                  onClick={() => {
                    setSelectedGreenhouseId(greenhouse.id)
                    setSelectedSensorId(null)
                  }}
                >
                  {greenhouse.name}
                </button>
              ))}
            </div>
          </div>
          <div className="emerald-gis-meta">
            <MapPin size={12} aria-hidden="true" />
            <div>
              <strong>{selectedLocation?.address || selectedGreenhouse.name}</strong>
              <span>
                {selectedLocation
                  ? `${selectedLocation.lat.toFixed(6)}°N · ${selectedLocation.lon.toFixed(6)}°E`
                  : '智慧农业 GIS 地块'}
              </span>
            </div>
            <em>卫星影像 © Esri</em>
          </div>
          {sensorPoints.map((sensor) => {
            const isActive = sensor.id === selectedSensorId
            const detailId = `emerald-sensor-detail-${sensor.id}`
            return (
              <div
                key={sensor.id}
                className={`emerald-sensor-anchor ${sensor.className}${isActive ? ' active' : ''}`}
              >
                <button
                  className="emerald-sensor"
                  type="button"
                  title={`${sensor.title}：${sensor.status}`}
                  aria-label={`查看${sensor.title}详情`}
                  aria-expanded={isActive}
                  aria-controls={detailId}
                  onClick={() => setSelectedSensorId((current) => current === sensor.id ? null : sensor.id)}
                >
                  {sensor.icon}
                  <span>{sensor.label}</span>
                </button>
                {isActive && (
                  <aside
                    id={detailId}
                    className={`emerald-sensor-detail place-${sensor.placement}`}
                    role="region"
                    aria-live="polite"
                    aria-label={`${sensor.title}详情`}
                  >
                    <header>
                      <div>
                        <span>{sensor.eyebrow}</span>
                        <h3>{sensor.title}</h3>
                      </div>
                      <button type="button" aria-label="关闭设备详情" onClick={() => setSelectedSensorId(null)}>
                        <X size={13} />
                      </button>
                    </header>
                    <div className="emerald-sensor-primary">
                      <strong>{sensor.primary}</strong>
                      <span>{sensor.unit}</span>
                      <em><i />{sensor.status}</em>
                    </div>
                    <div className="emerald-sensor-metrics">
                      {sensor.metrics.map(([label, value]) => (
                        <span key={label}><small>{label}</small><strong>{value}</strong></span>
                      ))}
                    </div>
                    <footer>
                      <span>{selectedGreenhouse.name}</span>
                      <time>更新于 {latestTimeText(latestRows[0])}</time>
                    </footer>
                  </aside>
                )}
              </div>
            )
          })}
          <div className="emerald-field-health">
            <div className="emerald-crop-photo">
              <img src={cropPhoto} alt={`${selectedCrop.name}现场实景`} loading="eager" decoding="async" />
              <span>现场实景</span>
            </div>
            <div className="emerald-field-health-data">
              <small>LIVE CROP VIEW</small>
              <strong>{selectedCrop.name}作物健康</strong>
              <span><i className="excellent" />长势良好 <em>{growthIndex.toFixed(0)}%</em></span>
              <span><i />灌溉状态 <em>{irrigationState}</em></span>
              <span><i />传感器 <em>{metricSeries.length} 项在线</em></span>
            </div>
          </div>
          <div className="emerald-field-summary">
            <Leaf size={17} aria-hidden="true" />
            <div><small>当前地块</small><strong>{selectedGreenhouse.name}</strong></div>
            <span>{dateText(data.period.start)}—{dateText(data.period.end)}</span>
          </div>
        </article>

        <div className="emerald-side-column emerald-right-column">
          <WallPanel title="长势预测" eyebrow="GROWTH FORECAST" className="emerald-growth-panel">
            <div className="emerald-growth-score"><strong>{growthIndex.toFixed(1)}</strong><span>模型参考指数</span><em>+{Math.max(0.8, quality / 40).toFixed(1)}%</em></div>
            <div className="emerald-growth-chart">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 280, height: 130 }}>
                <LineChart data={trendData.slice(-18)} margin={{ top: 4, right: 3, left: 3, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" hide />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ borderRadius: 8 }} />
                  <Line type="monotone" dataKey="growth" name="长势指数" stroke="#d5b95f" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </WallPanel>

          <WallPanel title="病虫害风险" eyebrow="PEST RISK">
            <div className="emerald-risk-list">
              <span><Bug size={12} /><strong>湿度相关风险</strong><em className={riskLevel === '低风险' ? 'low' : 'medium'}>{riskLevel}</em></span>
              <span><Leaf size={12} /><strong>叶面异常</strong><em className="low">低风险</em></span>
              <span><Activity size={12} /><strong>环境波动</strong><em className="low">低风险</em></span>
            </div>
          </WallPanel>

          <WallPanel title="田间作业" eyebrow="FIELD OPERATIONS">
            <div className="emerald-ops-list">
              <span><Tractor size={13} /><strong>巡检</strong><em>运行中</em></span>
              <span><Droplets size={13} /><strong>灌溉</strong><em>{irrigationState}</em></span>
              <span><Radio size={13} /><strong>采集</strong><em>{metricSeries.length} 路在线</em></span>
              <span><Sprout size={13} /><strong>长势</strong><em>{growthIndex.toFixed(0)}%</em></span>
            </div>
          </WallPanel>
        </div>
      </section>

      <section className="emerald-bottom-grid">
        <article className="emerald-bottom-card emerald-equipment-card">
          <header><span>EQUIPMENT STATUS</span><h2>设备状态</h2></header>
          <div>
            <span><Radio size={15} /><small>传感器</small><strong>{metricSeries.length}</strong><em>在线</em></span>
            <span><Tractor size={15} /><small>巡检设备</small><strong>2</strong><em>正常</em></span>
            <span><Droplets size={15} /><small>灌溉节点</small><strong>4</strong><em>就绪</em></span>
            <span><Gauge size={15} /><small>采集质量</small><strong>{quality.toFixed(0)}%</strong><em>稳定</em></span>
          </div>
        </article>
        <article className="emerald-bottom-card emerald-link-card">
          <header><span>DATA LINK</span><h2>数据链路概览</h2></header>
          <div>
            <span><small>有效指标</small><strong>{metricSeries.filter((series) => series.latestValue !== null).length}/{metricSeries.length}</strong></span>
            <span><small>最新采集</small><strong>{latestTimeText(latestRows[0])}</strong></span>
            <span><small>数据完整度</small><strong>{quality.toFixed(1)}%</strong></span>
          </div>
        </article>
        <article className="emerald-bottom-card emerald-event-card">
          <header><span>LIVE EVENT STREAM</span><h2>实时事件流</h2></header>
          <div>
            {latestRows.slice(0, 4).map((series) => (
              <span key={series.key}><i /><time>{latestTimeText(series)}</time><strong>{series.label}</strong><em>采集正常</em></span>
            ))}
          </div>
        </article>
      </section>
    </main>
  )
}
