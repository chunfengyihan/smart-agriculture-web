import type { DashboardData } from '../types'
import { requestJson } from './client'

export const DEFAULT_DASHBOARD_ENDPOINT = '/api/v1/greenhouse/dashboard'

export function getRemoteDashboardData(endpoint = DEFAULT_DASHBOARD_ENDPOINT) {
  return requestJson<DashboardData>(endpoint, { timeoutMs: 12_000 })
}
