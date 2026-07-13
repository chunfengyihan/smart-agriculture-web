import { useMemo, useState } from 'react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BarChart3, CalendarRange, Database, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useHistoricalAnalytics } from '../hooks/useHistoricalAnalytics'
import type {
  Crop,
  Greenhouse,
  HistoricalGreenhouseAnalytics,
  HistoricalMetricKey,
  HistoricalMetricSeries,
} from '../types'


type DateRangeKey = '30d' | '90d' | 'all'

interface MetricGroup {
  id: string
  label: string
  keys: HistoricalMetricKey[]
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

const rangeOptions: Array<{ id: DateRangeKey; label: string }> = [
  { id: '30d', label: '最近 30 天' },
  { id: '90d', label: '最近 90 天' },
  { id: 'all', label: '全部' },
]

const seriesColors: Record<HistoricalMetricKey, string> = {
  airTemp: '#22c55e',
  airHumidity: '#38bdf8',
  light: '#f59e0b',
  co2: '#a78bfa',
  soilHumidity: '#0ea5e9',
  soilTemp: '#84cc16',
  ec: '#fb7185',
  ph: '#f97316',
  pressure: '#60a5fa',
  salinity: '#eab308',
}

const qualityColors = ['#22c55e', '#f59e0b', '#ef4444']

function utcDate(date: string) {
  return new Date(`${date}T00:00:00Z`)
}

function dateText(date: string | null) {
  if (!date) return '-'
  return date.replaceAll('-', '.')
}

function shortDate(date: string) {
  const [, month, day] = date.split('-')
  return `${month}/${day}`
}

function addDays(date: string, days: number) {
  const next = utcDate(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next.toISOString().slice(0, 10)
}

function maxDate(left: string, right: string) {
  return left > right ? left : right
}

function buildDates(start: string, end: string) {
  const dates = []
  for (let date = start; date <= end; date = addDays(date, 1)) dates.push(date)
  return dates
}

function rangeStart(start: string, end: string, range: DateRangeKey) {
  if (range === 'all') return start
  const days = range === '30d' ? 29 : 89
  return maxDate(start, addDays(end, -days))
}

function greenhouseToken(value: string) {
  const lowered = value.toLowerCase()
  const blueberry = lowered.match(/c\s*([12])/)
  if (blueberry) return `c${blueberry[1]}`
  const jujube = lowered.match(/(?:^|\D)([12])(?:\D|$)/)
  return jujube?.[1] || ''
}

function matchHistoricalGreenhouse(
  greenhouses: HistoricalGreenhouseAnalytics[],
  selectedGreenhouse?: Greenhouse,
) {
  if (!greenhouses.length) return undefined
  if (!selectedGreenhouse) return greenhouses[0]

  const exact = greenhouses.find((greenhouse) => greenhouse.id === selectedGreenhouse.id)
  if (exact) return exact

  const selectedText = [selectedGreenhouse.id, selectedGreenhouse.name, selectedGreenhouse.area].join(' ')
  const selectedToken = greenhouseToken(selectedText)
  if (selectedToken) {
    const tokenMatch = greenhouses.find((greenhouse) =>
      greenhouseToken(`${greenhouse.id} ${greenhouse.name} ${greenhouse.area}`).includes(selectedToken),
    )
    if (tokenMatch) return tokenMatch
  }
  return greenhouses[0]
}

function seriesMap(greenhouse: HistoricalGreenhouseAnalytics) {
  return new Map(greenhouse.series.map((series) => [series.key, series]))
}

function availableGroups(greenhouses: HistoricalGreenhouseAnalytics[]) {
  const keys = new Set(greenhouses.flatMap((greenhouse) => greenhouse.series.map((series) => series.key)))
  return metricGroups.filter((group) => group.keys.some((key) => keys.has(key)))
}

function pointsInRange(series: HistoricalMetricSeries, start: string, end: string) {
  return series.points.filter((point) => point.date >= start && point.date <= end)
}

function weightedAverage(series: HistoricalMetricSeries, start: string, end: string) {
  const points = pointsInRange(series, start, end)
  const totalCount = points.reduce((sum, point) => sum + point.validCount, 0)
  if (!totalCount) return null
  const total = points.reduce(
    (sum, point) => sum + (point.average === null ? 0 : point.average * point.validCount),
    0,
  )
  return Number((total / totalCount).toFixed(2))
}

function countText(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value)
}

function metricName(series: HistoricalMetricSeries) {
  const suffix = series.unit || series.unitNote
  return suffix ? `${series.label}（${suffix}）` : series.label
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="history-chart-empty">
      <BarChart3 size={24} aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}

export default function HistoricalAnalyticsPanel({
  selectedCrop,
  selectedGreenhouse,
}: {
  selectedCrop: Crop
  selectedGreenhouse?: Greenhouse
}) {
  const { data, error, isLoading } = useHistoricalAnalytics()
  const [selectedGroupId, setSelectedGroupId] = useState('temperature')
  const [selectedRange, setSelectedRange] = useState<DateRangeKey>('all')

  const historicalCrop = data?.crops.find((crop) => crop.id === selectedCrop.id)
  const groups = useMemo(
    () => availableGroups(historicalCrop?.greenhouses || []),
    [historicalCrop?.greenhouses],
  )
  const selectedGroup = groups.find((group) => group.id === selectedGroupId) || groups[0]
  const historicalGreenhouse = matchHistoricalGreenhouse(
    historicalCrop?.greenhouses || [],
    selectedGreenhouse,
  )

  const dateWindow = useMemo(() => {
    const start = data?.period.start
    const end = data?.period.end
    if (!start || !end) return null
    return { start: rangeStart(start, end, selectedRange), end }
  }, [data?.period.end, data?.period.start, selectedRange])

  const activeSeries = useMemo(() => {
    if (!historicalGreenhouse || !selectedGroup) return []
    const lookup = seriesMap(historicalGreenhouse)
    return selectedGroup.keys
      .map((key) => lookup.get(key))
      .filter((series): series is HistoricalMetricSeries => Boolean(series))
  }, [historicalGreenhouse, selectedGroup])

  const lineData = useMemo(() => {
    if (!dateWindow || !activeSeries.length) return []
    const lookups = new Map(
      activeSeries.map((series) => [series.key, new Map(series.points.map((point) => [point.date, point]))]),
    )
    return buildDates(dateWindow.start, dateWindow.end).map((date) => {
      const row: Record<string, string | number | null | [number, number]> = {
        date,
        label: shortDate(date),
      }
      for (const series of activeSeries) {
        const point = lookups.get(series.key)?.get(date)
        row[series.key] = point?.average ?? null
        row[`${series.key}Range`] =
          point?.minimum !== null && point?.minimum !== undefined && point.maximum !== null
            ? [point.minimum, point.maximum]
            : null
      }
      return row
    })
  }, [activeSeries, dateWindow])

  const barData = useMemo(() => {
    if (!historicalCrop || !selectedGroup || !dateWindow) return []
    return historicalCrop.greenhouses.map((greenhouse) => {
      const lookup = seriesMap(greenhouse)
      const row: Record<string, string | number | null> = { name: greenhouse.name }
      for (const key of selectedGroup.keys) {
        const series = lookup.get(key)
        row[key] = series ? weightedAverage(series, dateWindow.start, dateWindow.end) : null
      }
      return row
    })
  }, [dateWindow, historicalCrop, selectedGroup])

  const quality = useMemo(() => {
    if (!dateWindow || !activeSeries.length) return { valid: 0, filtered: 0, invalid: 0 }
    return activeSeries.reduce(
      (totals, series) => {
        const points = pointsInRange(series, dateWindow.start, dateWindow.end)
        totals.valid += points.reduce((sum, point) => sum + point.validCount, 0)
        totals.filtered += points.reduce((sum, point) => sum + point.filteredZeroCount, 0)
        totals.invalid += points.reduce((sum, point) => sum + point.invalidCount, 0)
        if (selectedRange === 'all') totals.invalid += series.undatedInvalidCount
        return totals
      },
      { valid: 0, filtered: 0, invalid: 0 },
    )
  }, [activeSeries, dateWindow, selectedRange])

  const qualityData = [
    { name: '有效记录', value: quality.valid, color: qualityColors[0] },
    { name: '过滤零值', value: quality.filtered, color: qualityColors[1] },
    { name: '无效记录', value: quality.invalid, color: qualityColors[2] },
  ].filter((item) => item.value > 0)
  const qualityTotal = quality.valid + quality.filtered + quality.invalid
  const validRate = qualityTotal ? Math.round((quality.valid / qualityTotal) * 100) : 0
  const hasLineValues = lineData.some((row) => activeSeries.some((series) => row[series.key] !== null))
  const axisUnit = [...new Set(activeSeries.map((series) => series.unit || series.unitNote).filter(Boolean))].join(' / ')

  if (isLoading) {
    return (
      <section className="historical-panel history-state-panel">
        <Database className="spin" size={20} aria-hidden="true" />
        <span>正在加载 2026 历史采集数据...</span>
      </section>
    )
  }

  if (error) {
    return (
      <section className="historical-panel history-state-panel history-error">
        <TriangleAlert size={20} aria-hidden="true" />
        <span>{error}</span>
      </section>
    )
  }

  if (!data || !historicalCrop || !historicalGreenhouse || !selectedGroup || !dateWindow) {
    return (
      <section className="historical-panel history-state-panel">
        <Database size={20} aria-hidden="true" />
        <span>{selectedCrop.name} 暂无 2026 Excel 历史采集数据</span>
      </section>
    )
  }

  return (
    <section className="historical-panel" aria-labelledby="historical-analysis-title">
      <div className="section-heading history-heading">
        <div>
          <p>2026 Excel historical analytics</p>
          <h2 id="historical-analysis-title">2026 采集数据分析</h2>
        </div>
        <span className="history-source-pill">
          <Database size={14} aria-hidden="true" />
          {data.source}
        </span>
      </div>

      <div className="history-context-row">
        <span>
          <CalendarRange size={15} aria-hidden="true" />
          {historicalGreenhouse.name} · {dateText(data.period.start)}—{dateText(data.period.end)}
        </span>
        <span>
          <ShieldCheck size={15} aria-hidden="true" />
          光照零值保留，其他指标异常零值按缺测处理
        </span>
      </div>

      <div className="history-controls">
        <div className="history-control-group" aria-label="历史指标">
          {groups.map((group) => (
            <button
              key={group.id}
              className={group.id === selectedGroup.id ? 'active' : ''}
              type="button"
              aria-pressed={group.id === selectedGroup.id}
              onClick={() => setSelectedGroupId(group.id)}
            >
              {group.label}
            </button>
          ))}
        </div>
        <div className="history-control-group history-range-control" aria-label="历史时间范围">
          {rangeOptions.map((option) => (
            <button
              key={option.id}
              className={option.id === selectedRange ? 'active' : ''}
              type="button"
              aria-pressed={option.id === selectedRange}
              onClick={() => setSelectedRange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="history-summary-grid">
        <article>
          <small>当前历史棚区</small>
          <strong>{historicalGreenhouse.name}</strong>
          <span>{historicalGreenhouse.deviceNo || '设备编号未提供'}</span>
        </article>
        <article>
          <small>当前显示区间</small>
          <strong>{dateText(dateWindow.start)}</strong>
          <span>至 {dateText(dateWindow.end)}</span>
        </article>
        <article className={quality.filtered ? 'warning' : ''}>
          <small>有效 / 过滤记录</small>
          <strong>{countText(quality.valid)}</strong>
          <span>{quality.filtered ? `已过滤 ${countText(quality.filtered)} 条零值` : '未发现异常零值'}</span>
        </article>
      </div>

      <div className="history-chart-grid">
        <article className="history-chart-card history-line-card">
          <div className="history-chart-title">
            <div>
              <p>当前棚区日均值</p>
              <h3>{selectedGroup.label}变化趋势</h3>
            </div>
            <span>{axisUnit || '设备原始值'}</span>
          </div>
          {hasLineValues ? (
            <div className="history-chart-canvas" role="img" aria-label={`${historicalGreenhouse.name}${selectedGroup.label}日均趋势图`}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={lineData} margin={{ top: 12, right: 10, left: -6, bottom: 0 }}>
                  <defs>
                    {activeSeries.map((series) => (
                      <linearGradient key={series.key} id={`history-range-${series.key}`} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor={seriesColors[series.key]} stopOpacity={0.24} />
                        <stop offset="95%" stopColor={seriesColors[series.key]} stopOpacity={0.04} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={28} />
                  <YAxis tickLine={false} axisLine={false} width={54} domain={['auto', 'auto']} />
                  <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ''} />
                  <Legend />
                  {activeSeries.length === 1 && (
                    <Area
                      type="monotone"
                      dataKey={`${activeSeries[0].key}Range`}
                      name="日最小—最大"
                      stroke="none"
                      fill={`url(#history-range-${activeSeries[0].key})`}
                      connectNulls={false}
                    />
                  )}
                  {activeSeries.map((series) => (
                    <Line
                      key={series.key}
                      type="monotone"
                      dataKey={series.key}
                      name={metricName(series)}
                      stroke={seriesColors[series.key]}
                      strokeWidth={2.4}
                      dot={false}
                      connectNulls={false}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart message="当前时间范围没有可绘制的有效记录" />
          )}
        </article>

        <article className="history-chart-card history-quality-card">
          <div className="history-chart-title">
            <div>
              <p>数据质量构成</p>
              <h3>记录有效率</h3>
            </div>
          </div>
          {qualityData.length ? (
            <>
              <div className="history-donut-wrap" role="img" aria-label={`${selectedGroup.label}数据质量环形图，有效率 ${validRate}%`}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={qualityData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="64%"
                      outerRadius="88%"
                      paddingAngle={2}
                      stroke="none"
                    >
                      {qualityData.map((item) => (
                        <Cell key={item.name} fill={item.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="history-donut-center">
                  <strong>{validRate}%</strong>
                  <span>有效</span>
                </div>
              </div>
              <div className="history-quality-legend">
                {qualityData.map((item) => (
                  <span key={item.name}>
                    <i style={{ background: item.color }} />
                    {item.name} {countText(item.value)}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <EmptyChart message="当前时间范围没有质量统计" />
          )}
        </article>

        <article className="history-chart-card history-bar-card">
          <div className="history-chart-title">
            <div>
              <p>同作物棚区加权均值</p>
              <h3>{selectedCrop.name}棚区对比</h3>
            </div>
            <span>{axisUnit || '设备原始值'}</span>
          </div>
          {barData.some((row) => selectedGroup.keys.some((key) => row[key] !== null)) ? (
            <div className="history-bar-canvas" role="img" aria-label={`${selectedCrop.name}${selectedGroup.label}棚区柱状对比图`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 12, right: 10, left: -6, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={54} />
                  <Tooltip />
                  <Legend />
                  {selectedGroup.keys.map((key) => {
                    const series = historicalCrop.greenhouses
                      .flatMap((greenhouse) => greenhouse.series)
                      .find((item) => item.key === key)
                    if (!series) return null
                    return (
                      <Bar
                        key={key}
                        dataKey={key}
                        name={metricName(series)}
                        fill={seriesColors[key]}
                        radius={[7, 7, 0, 0]}
                        maxBarSize={58}
                      />
                    )
                  })}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart message="当前时间范围没有可比较的棚区记录" />
          )}
        </article>
      </div>
    </section>
  )
}
