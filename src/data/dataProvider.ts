import { createMockDashboard } from './mockDashboard'
import type { DashboardData } from '../types'
import { fetchWithTimeout } from '../lib/http'
import { DEFAULT_DASHBOARD_ENDPOINT, getRemoteDashboardData } from '../api/dashboard'

const DATA_SOURCE = import.meta.env.VITE_DATA_SOURCE || 'remote'
const USE_REMOTE_DATA = import.meta.env.VITE_USE_REMOTE_DATA === 'true'
const DASHBOARD_ENDPOINT =
  import.meta.env.VITE_DASHBOARD_ENDPOINT || DEFAULT_DASHBOARD_ENDPOINT
const LOCAL_DASHBOARD_PATH =
  import.meta.env.VITE_LOCAL_DASHBOARD_PATH || '/data/local-dashboard.json'

export interface DashboardDataRequestOptions {
  cacheBust?: boolean
  signal?: AbortSignal
}

export async function getDashboardData(options: DashboardDataRequestOptions = {}): Promise<DashboardData> {
  if (DATA_SOURCE === 'local') {
    const localUrl = options.cacheBust ? `${LOCAL_DASHBOARD_PATH}?t=${Date.now()}` : LOCAL_DASHBOARD_PATH
    const response = await fetchWithTimeout(localUrl, { timeoutMs: 8_000, signal: options.signal })

    if (!response.ok) {
      throw new Error(`Local dashboard file failed: ${response.status}`)
    }

    return response.json() as Promise<DashboardData>
  }

  if (DATA_SOURCE === 'remote' || (!import.meta.env.VITE_DATA_SOURCE && USE_REMOTE_DATA)) {
    return getRemoteDashboardData(DASHBOARD_ENDPOINT, { signal: options.signal })
  }

  if (DATA_SOURCE !== 'mock') {
    console.warn(`Unknown VITE_DATA_SOURCE "${DATA_SOURCE}", falling back to mock data.`)
  }

  return createMockDashboard()
}
