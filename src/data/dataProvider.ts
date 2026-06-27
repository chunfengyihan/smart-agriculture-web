import { createMockDashboard } from './mockDashboard'
import type { DashboardData } from '../types'
import { fetchWithTimeout } from '../lib/http'

const DATA_SOURCE = import.meta.env.VITE_DATA_SOURCE || 'mock'
const USE_REMOTE_DATA = import.meta.env.VITE_USE_REMOTE_DATA === 'true'
const DASHBOARD_ENDPOINT =
  import.meta.env.VITE_DASHBOARD_ENDPOINT || '/api/greenhouse/dashboard'
const LOCAL_DASHBOARD_PATH =
  import.meta.env.VITE_LOCAL_DASHBOARD_PATH || '/data/local-dashboard.json'

export async function getDashboardData(): Promise<DashboardData> {
  if (DATA_SOURCE === 'local') {
    const response = await fetchWithTimeout(`${LOCAL_DASHBOARD_PATH}?t=${Date.now()}`, { timeoutMs: 8_000 })

    if (!response.ok) {
      throw new Error(`Local dashboard file failed: ${response.status}`)
    }

    return response.json() as Promise<DashboardData>
  }

  if (DATA_SOURCE === 'remote' || (!import.meta.env.VITE_DATA_SOURCE && USE_REMOTE_DATA)) {
    const response = await fetchWithTimeout(DASHBOARD_ENDPOINT, { timeoutMs: 12_000 })

    if (!response.ok) {
      throw new Error(`Dashboard API failed: ${response.status}`)
    }

    return response.json() as Promise<DashboardData>
  }

  if (DATA_SOURCE !== 'mock') {
    console.warn(`Unknown VITE_DATA_SOURCE "${DATA_SOURCE}", falling back to mock data.`)
  }

  return createMockDashboard()
}
