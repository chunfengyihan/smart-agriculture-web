import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Expand, Maximize, Minimize2, X } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useHistoricalAnalytics } from '../hooks/useHistoricalAnalytics'
import type {
  HistoricalCropAnalytics,
  HistoricalMetricKey,
  HistoricalMetricSeries,
} from '../types'

interface MetricGroup {
  id: string
  label: string
  keys: HistoricalMetricKey[]
}

interface ChartGroupData {
  group: MetricGroup
  series: HistoricalMetricSeries[]
  points: Array<Record<string, string | number | null>>
}

const metricGroups: MetricGroup[] = [
  { id: 'temperature', label: '温度', keys: ['airTemp', 'soilTemp'] },
  { id: 'humidity', label: '湿度', keys: ['airHumidity', 'soilHumidity'] },
  { id: 'light', label: '光照', keys: ['light'] },
  { id: 'co2', label: 'CO₂', keys: ['co2'] },
  { id: 'pressure', label: '气压', keys: ['pressure'] },
  { id: 'ec', label: 'EC', keys: ['ec'] },
  { id: 'ph', label: 'PH', keys: ['ph'] },
  { id: 'salinity', label: '盐分', keys: ['salinity'] },
]

const seriesColors: Record<HistoricalMetricKey, string> = {
  airTemp: '#7de8b2',
  airHumidity: '#79cbe8',
  light: '#f2c85b',
  co2: '#b8a6f5',
  soilHumidity: '#dfb96a',
  soilTemp: '#a8dc72',
  ec: '#f092aa',
  ph: '#f3a26f',
  pressure: '#83bde8',
  salinity: '#e4c768',
}

function utcDate(date: string) {
  return new Date(`${date}T00:00:00Z`)
}

function addDays(date: string, days: number) {
  const next = utcDate(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next.toISOString().slice(0, 10)
}

function buildDates(start: string, end: string) {
  const dates: string[] = []
  for (let date = start; date <= end; date = addDays(date, 1)) dates.push(date)
  return dates
}

function shortDate(date: string) {
  const [, month, day] = date.split('-')
  return `${month}/${day}`
}

function dateText(date: string | null) {
  return date ? date.replaceAll('-', '.') : '-'
}

function availableGroups(crop?: HistoricalCropAnalytics) {
  if (!crop) return []
  const keys = new Set(crop.greenhouses.flatMap((greenhouse) => greenhouse.series.map((series) => series.key)))
  return metricGroups.filter((group) => group.keys.some((key) => keys.has(key)))
}

function latestValueText(series: HistoricalMetricSeries) {
  if (series.latestValue === null || !Number.isFinite(series.latestValue)) return '-'
  if (series.key === 'light' || series.key === 'pressure' || series.key === 'co2') {
    return Math.round(series.latestValue).toLocaleString('zh-CN')
  }
  return series.latestValue.toFixed(series.key === 'ph' ? 2 : 1)
}

function timeText(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

function FeaturedChart({ chart, greenhouseName }: { chart: ChartGroupData; greenhouseName: string }) {
  const { group, series, points } = chart
  return (
    <article className="wall-card wall-featured-chart-card">
      <header>
        <div>
          <span className="wall-card-kicker">核心环境</span>
          <h2>{group.label}趋势</h2>
        </div>
        <div className="wall-featured-values">
          {series.map((item) => (
            <span key={item.key} style={{ color: seriesColors[item.key] }}>
              <small>{item.label}</small>
              <strong>{latestValueText(item)}</strong>
              <em>{item.unit || item.unitNote}</em>
            </span>
          ))}
        </div>
      </header>
      <div className="wall-featured-chart" role="img" aria-label={`${greenhouseName}${group.label}数据趋势图`}>
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          minHeight={0}
          initialDimension={{ width: 560, height: 330 }}
        >
          <LineChart data={points} margin={{ top: 12, right: 9, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e6eee9" strokeDasharray="3 3" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={52} />
            <YAxis axisLine={false} tickLine={false} width={40} domain={['auto', 'auto']} />
            <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ''} />
            {series.map((item) => (
              <Line
                key={item.key}
                type="monotone"
                dataKey={item.key}
                name={`${item.label} ${item.unit || item.unitNote}`}
                stroke={seriesColors[item.key]}
                strokeWidth={2.5}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </article>
  )
}

function CompactChart({
  chart,
  greenhouseName,
  onExpand,
}: {
  chart: ChartGroupData
  greenhouseName: string
  onExpand: () => void
}) {
  const { group, series, points } = chart
  const primarySeries = series[0]
  return (
    <article
      className="wall-card wall-compact-chart-card"
      role="button"
      tabIndex={0}
      aria-label={`放大查看${group.label}趋势图`}
      onClick={onExpand}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onExpand()
        }
      }}
    >
      <header>
        <div>
          <span>{group.label}</span>
          <strong>{primarySeries ? latestValueText(primarySeries) : '-'}</strong>
          <small>{primarySeries?.unit || primarySeries?.unitNote || '设备原始值'}</small>
        </div>
        <div className="wall-compact-actions" aria-hidden="true">
          <i style={{ background: primarySeries ? seriesColors[primarySeries.key] : '#86a294' }} />
          <Expand size={13} />
        </div>
      </header>
      <div className="wall-compact-chart" role="img" aria-label={`${greenhouseName}${group.label}数据趋势图`}>
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          minHeight={0}
          initialDimension={{ width: 180, height: 92 }}
        >
          <LineChart data={points} margin={{ top: 8, right: 2, left: 2, bottom: 2 }}>
            <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ''} />
            {series.map((item) => (
              <Line
                key={item.key}
                type="monotone"
                dataKey={item.key}
                name={`${item.label} ${item.unit || item.unitNote}`}
                stroke={seriesColors[item.key]}
                strokeWidth={2.2}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <footer>{dateText(primarySeries?.latestAt?.slice(0, 10) || null)} 更新</footer>
    </article>
  )
}

function ExpandedChartModal({
  chart,
  greenhouseName,
  onClose,
}: {
  chart: ChartGroupData
  greenhouseName: string
  onClose: () => void
}) {
  const { group, series, points } = chart
  return (
    <div className="wall-chart-modal" role="presentation" onMouseDown={onClose}>
      <section
        className="wall-chart-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wall-chart-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>{greenhouseName} · 辅助指标</span>
            <h2 id="wall-chart-modal-title">{group.label}趋势</h2>
          </div>
          <div className="wall-chart-modal-values">
            {series.map((item) => (
              <span key={item.key} style={{ color: seriesColors[item.key] }}>
                <small>{item.label}</small>
                <strong>{latestValueText(item)}</strong>
                <em>{item.unit || item.unitNote}</em>
              </span>
            ))}
          </div>
          <button type="button" aria-label="关闭放大图表" onClick={onClose} autoFocus>
            <X size={20} />
          </button>
        </header>

        <div className="wall-chart-modal-chart" role="img" aria-label={`${greenhouseName}${group.label}数据趋势图`}>
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={0}
            initialDimension={{ width: 900, height: 520 }}
          >
            <LineChart data={points} margin={{ top: 18, right: 24, left: 4, bottom: 8 }}>
              <CartesianGrid vertical={false} stroke="#e4ece7" strokeDasharray="4 4" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={42} />
              <YAxis axisLine={false} tickLine={false} width={52} domain={['auto', 'auto']} />
              <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ''} />
              {series.map((item) => (
                <Line
                  key={item.key}
                  type="monotone"
                  dataKey={item.key}
                  name={`${item.label} ${item.unit || item.unitNote}`}
                  stroke={seriesColors[item.key]}
                  strokeWidth={3}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <footer>点击空白区域或按 Esc 关闭</footer>
      </section>
    </div>
  )
}

export function AnalyticsWallPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { data, error, isLoading } = useHistoricalAnalytics()
  const [clock, setClock] = useState(() => new Date())
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement))
  const [selectedCropId, setSelectedCropId] = useState(searchParams.get('crop') || 'jujube')
  const [selectedGreenhouseId, setSelectedGreenhouseId] = useState(searchParams.get('greenhouse') || '')
  const [expandedChartId, setExpandedChartId] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000)
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  useEffect(() => {
    if (!expandedChartId) return undefined
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpandedChartId(null)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [expandedChartId])

  const selectedCrop = data?.crops.find((crop) => crop.id === selectedCropId) || data?.crops[0]
  const selectedGreenhouse =
    selectedCrop?.greenhouses.find((greenhouse) => greenhouse.id === selectedGreenhouseId) ||
    selectedCrop?.greenhouses[0]
  const groups = useMemo(() => availableGroups(selectedCrop), [selectedCrop])
  const chartGroups = useMemo(() => {
    if (!data?.period.start || !data.period.end || !selectedGreenhouse) return []
    const dates = buildDates(data.period.start, data.period.end)
    return groups.map((group) => {
      const series = group.keys
        .map((key) => selectedGreenhouse.series.find((item) => item.key === key))
        .filter((item): item is HistoricalMetricSeries => Boolean(item))
      const lookups = new Map(
        series.map((item) => [item.key, new Map(item.points.map((point) => [point.date, point.average]))]),
      )
      const points = dates.map((date) => {
        const row: Record<string, string | number | null> = { date, label: shortDate(date) }
        series.forEach((item) => {
          row[item.key] = lookups.get(item.key)?.get(date) ?? null
        })
        return row
      })
      return { group, series, points }
    })
  }, [data, groups, selectedGreenhouse])
  const featuredCharts = chartGroups.slice(0, 2)
  const compactCharts = chartGroups.slice(2)
  const expandedChart = compactCharts.find((chart) => chart.group.id === expandedChartId)

  const exitWall = () => {
    navigate('/analytics')
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
  }

  if (isLoading || !data || !selectedCrop || !selectedGreenhouse) {
    return (
      <main className="analytics-wall-loading">
        <img src="/logo-lockup.png" alt="智慧农业" />
        <p>{error || '正在加载采集数据...'}</p>
        <button type="button" onClick={() => navigate('/analytics')}>返回数据分析</button>
      </main>
    )
  }

  const backToOverview = () => {
    navigate(
      `/analytics/wall?crop=${selectedCrop.id}&greenhouse=${encodeURIComponent(selectedGreenhouse.id)}`,
    )
  }

  const dateNow = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).format(clock)

  return (
    <main className="analytics-wall analytics-density-wall" aria-label="智慧农业数据大屏">
      <aside className="wall-sidebar">
        <img className="wall-logo" src="/logo-lockup.png" alt="智慧农业 Smart Agriculture" />

        <section className="wall-switch-group" aria-labelledby="wall-crop-title">
          <h2 id="wall-crop-title">作物</h2>
          <div className="wall-crop-switches wall-history-crop-switches">
            {data.crops.map((crop) => (
              <button
                key={crop.id}
                className={crop.id === selectedCrop.id ? 'active' : ''}
                type="button"
                aria-pressed={crop.id === selectedCrop.id}
                onClick={() => {
                  setSelectedCropId(crop.id)
                  setSelectedGreenhouseId(crop.greenhouses[0]?.id || '')
                }}
              >
                {crop.name}
              </button>
            ))}
          </div>
        </section>

        <section className="wall-switch-group wall-greenhouse-group" aria-labelledby="wall-greenhouse-title">
          <h2 id="wall-greenhouse-title">大棚</h2>
          <div className="wall-greenhouse-switches">
            {selectedCrop.greenhouses.map((greenhouse) => (
              <button
                key={greenhouse.id}
                className={greenhouse.id === selectedGreenhouse.id ? 'active' : ''}
                type="button"
                aria-pressed={greenhouse.id === selectedGreenhouse.id}
                onClick={() => setSelectedGreenhouseId(greenhouse.id)}
              >
                <strong>{greenhouse.name}</strong>
                {greenhouse.id === selectedGreenhouse.id && <span><i />设备号 {greenhouse.deviceNo}</span>}
              </button>
            ))}
          </div>
        </section>

        <section className="wall-density-period" aria-label="数据区间">
          <span>数据区间</span>
          <strong>{dateText(data.period.start)}</strong>
          <i />
          <strong>{dateText(data.period.end)}</strong>
          <small>{data.source}</small>
        </section>

        <button className="wall-back-button" type="button" onClick={backToOverview}>
          <ArrowLeft size={17} aria-hidden="true" />
          返回大屏总览
        </button>
      </aside>

      <section className="wall-main wall-focus-main">
        <header className="wall-header wall-density-header">
          <div>
            <p>DATA OVERVIEW</p>
            <h1>智慧农业数据大屏</h1>
            <span>{selectedCrop.name} · {selectedGreenhouse.name} · {dateText(data.period.start)}—{dateText(data.period.end)}</span>
          </div>
          <div className="wall-header-actions">
            <time dateTime={clock.toISOString()}>{dateNow}<strong>{timeText(clock)}</strong></time>
            <button
              className="wall-fullscreen-toggle"
              type="button"
              aria-label={isFullscreen ? '退出浏览器全屏' : '进入浏览器全屏'}
              onClick={() => {
                if (document.fullscreenElement) void document.exitFullscreen()
                else void document.documentElement.requestFullscreen?.()
              }}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize size={18} />}
            </button>
            <button className="wall-exit-button" type="button" onClick={exitWall}>退出大屏</button>
          </div>
        </header>

        <section className="wall-section-guide wall-single-guide" aria-label="核心环境导览">
          <div><span>01</span><strong>核心环境</strong><small>优先关注作物生长状态</small></div>
          <i />
        </section>

        <section className="wall-featured-grid" aria-label="核心环境趋势">
          {featuredCharts.map((chart) => (
            <FeaturedChart key={chart.group.id} chart={chart} greenhouseName={selectedGreenhouse.name} />
          ))}
        </section>

        <section className="wall-section-guide wall-single-guide wall-secondary-guide" aria-label="辅助指标导览">
          <div><span>02</span><strong>辅助指标</strong><small>快速发现设备与土壤变化</small></div>
          <i />
        </section>

        <section
          className="wall-compact-grid"
          style={{ gridTemplateColumns: `repeat(${Math.max(compactCharts.length, 1)}, minmax(0, 1fr))` }}
          aria-label="辅助指标趋势"
        >
          {compactCharts.map((chart) => (
            <CompactChart
              key={chart.group.id}
              chart={chart}
              greenhouseName={selectedGreenhouse.name}
              onExpand={() => setExpandedChartId(chart.group.id)}
            />
          ))}
        </section>
      </section>
      {expandedChart && (
        <ExpandedChartModal
          chart={expandedChart}
          greenhouseName={selectedGreenhouse.name}
          onClose={() => setExpandedChartId(null)}
        />
      )}
    </main>
  )
}
