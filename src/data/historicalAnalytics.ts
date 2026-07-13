import { fetchWithTimeout } from '../lib/http'
import type { HistoricalAnalyticsData } from '../types'


const HISTORICAL_ANALYTICS_PATH =
  import.meta.env.VITE_HISTORICAL_ANALYTICS_PATH || '/data/historical-analytics.json'

export async function getHistoricalAnalytics(signal?: AbortSignal): Promise<HistoricalAnalyticsData> {
  const response = await fetchWithTimeout(HISTORICAL_ANALYTICS_PATH, {
    auth: false,
    signal,
    timeoutMs: 12_000,
  })

  if (!response.ok) {
    throw new Error(`历史采集数据加载失败：${response.status}`)
  }

  return response.json() as Promise<HistoricalAnalyticsData>
}
