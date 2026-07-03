import type { DashboardData } from '../types'
import { requestJson } from './client'
import type { RequestTimeoutOptions } from '../lib/http'

export const DEFAULT_DASHBOARD_ENDPOINT = '/api/v1/greenhouse/dashboard'

export interface DashboardRequestMetadata {
  etag?: string
  lastModified?: string
  version?: string
}

export const DASHBOARD_RESOURCE_PATHS = {
  dashboard: DEFAULT_DASHBOARD_ENDPOINT,
  readings: '/api/v1/greenhouse/readings',
  alerts: '/api/v1/greenhouse/alerts',
  alertStream: '/api/v1/greenhouse/alerts/stream',
} as const

export function getRemoteDashboardData(
  endpoint = DEFAULT_DASHBOARD_ENDPOINT,
  options: Pick<RequestTimeoutOptions, 'signal'> = {},
) {
  return requestJson<DashboardData>(endpoint, { timeoutMs: 12_000, signal: options.signal })
}
