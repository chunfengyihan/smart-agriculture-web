import { useEffect, useState } from 'react'
import { getHistoricalAnalytics } from '../data/historicalAnalytics'
import type { HistoricalAnalyticsData } from '../types'


export function useHistoricalAnalytics() {
  const [data, setData] = useState<HistoricalAnalyticsData | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    void getHistoricalAnalytics(controller.signal)
      .then((payload) => setData(payload))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : '历史采集数据加载失败')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [])

  return { data, error, isLoading }
}
