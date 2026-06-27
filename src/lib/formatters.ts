import type { CropDiagnosisResult, DashboardData, MetricReading, WeatherAdviceRiskLevel } from '../types'

export function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))
}

export function sourceText(source: DashboardData['source']) {
  if (source === 'mock') return '模拟数据'
  if (source === 'local') return '本地 Excel 数据'
  return '有人云实时数据'
}

export function hasMetricValue(metric: MetricReading): metric is MetricReading & { value: number } {
  return typeof metric.value === 'number' && Number.isFinite(metric.value)
}

export function metricValue(metric: MetricReading) {
  if (!hasMetricValue(metric)) return '-'
  if (metric.key === 'ec') return metric.value.toFixed(2)
  if (metric.key === 'ph' || metric.key === 'airTemp' || metric.key === 'soilTemp') {
    return metric.value.toFixed(1)
  }
  return Math.round(metric.value).toLocaleString('zh-CN')
}

export function statusText(status: 'online' | 'warning' | 'offline') {
  return status === 'online' ? '运行正常' : status === 'warning' ? '需要关注' : '设备离线'
}

export function riskLabel(riskLevel: CropDiagnosisResult['riskLevel']) {
  if (riskLevel === 'high') return '高风险'
  if (riskLevel === 'medium') return '中风险'
  if (riskLevel === 'low') return '低风险'
  return '无法判断'
}

export function weatherRiskLabel(riskLevel: WeatherAdviceRiskLevel) {
  if (riskLevel === 'high') return '高关注'
  if (riskLevel === 'medium') return '需留意'
  if (riskLevel === 'low') return '适宜'
  return '待判断'
}

export function formatWeatherNumber(value: number | null, suffix: string, digits = 0) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  return `${value.toFixed(digits)}${suffix}`
}

export function formatForecastDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).format(new Date(`${value}T00:00:00+08:00`))
}

export function displayText(value: unknown, fallback = '-'): string {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map((item) => displayText(item, '')).filter(Boolean).join('，')
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, item]) => {
        const text = displayText(item, '')
        return text ? `${key}：${text}` : ''
      })
      .filter(Boolean)
      .join('，')
  }
  return fallback
}
