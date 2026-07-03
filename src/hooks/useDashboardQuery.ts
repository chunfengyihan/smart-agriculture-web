import { useCallback, useEffect, useRef, useState } from 'react'
import { getDashboardData } from '../data/dataProvider'
import type { DashboardData } from '../types'

const staleTimeMs = 20_000
const refetchIntervalMs = 30_000
const retryCount = 2
const retryDelayMs = 1_200

interface DashboardCache {
  data: DashboardData | null
  updatedAt: number
  error: Error | null
  promise: Promise<DashboardData | null> | null
}

interface DashboardQueryState {
  data: DashboardData | null
  error: string | null
  isLoading: boolean
  isFetching: boolean
  isPaused: boolean
  lastUpdatedAt: number
}

interface RefetchOptions {
  force?: boolean
}

const dashboardCache: DashboardCache = {
  data: null,
  updatedAt: 0,
  error: null,
  promise: null,
}

function isDocumentHidden() {
  return typeof document !== 'undefined' && document.hidden
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

function normalizeError(error: unknown) {
  return error instanceof Error ? error : new Error('Dashboard data load failed')
}

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }

    const timer = window.setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

function hasFreshCache() {
  return Boolean(dashboardCache.data && Date.now() - dashboardCache.updatedAt < staleTimeMs)
}

async function fetchWithRetry(signal: AbortSignal) {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      return await getDashboardData({ signal, cacheBust: attempt > 0 })
    } catch (error) {
      const normalized = normalizeError(error)
      lastError = normalized

      if (signal.aborted || isAbortError(error) || attempt === retryCount) {
        throw normalized
      }

      await delay(retryDelayMs * (attempt + 1), signal)
    }
  }

  throw lastError || new Error('Dashboard data load failed')
}

export function useDashboardQuery() {
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(false)
  const [state, setState] = useState<DashboardQueryState>(() => ({
    data: dashboardCache.data,
    error: dashboardCache.error?.message || null,
    isLoading: !dashboardCache.data,
    isFetching: false,
    isPaused: isDocumentHidden(),
    lastUpdatedAt: dashboardCache.updatedAt,
  }))

  const syncCache = useCallback((updates: Partial<DashboardQueryState> = {}) => {
    if (!mountedRef.current) return
    setState((current) => ({
      ...current,
      data: dashboardCache.data,
      error: dashboardCache.error?.message || null,
      isLoading: !dashboardCache.data && current.isFetching,
      lastUpdatedAt: dashboardCache.updatedAt,
      ...updates,
    }))
  }, [])

  const refetch = useCallback(
    async ({ force = false }: RefetchOptions = {}) => {
      if (isDocumentHidden()) {
        syncCache({ isPaused: true, isFetching: false, isLoading: !dashboardCache.data })
        return dashboardCache.data
      }

      if (!force && hasFreshCache()) {
        syncCache({ isPaused: false, isFetching: false, isLoading: false })
        return dashboardCache.data
      }

      if (!force && dashboardCache.promise) {
        syncCache({ isPaused: false, isFetching: true, isLoading: !dashboardCache.data })
        return dashboardCache.promise
      }

      if (force) {
        abortRef.current?.abort()
        dashboardCache.promise = null
      }

      const controller = new AbortController()
      abortRef.current = controller
      syncCache({ isPaused: false, isFetching: true, isLoading: !dashboardCache.data })

      const request = fetchWithRetry(controller.signal)
        .then((data) => {
          dashboardCache.data = data
          dashboardCache.updatedAt = Date.now()
          dashboardCache.error = null
          return data
        })
        .catch((error) => {
          if (!controller.signal.aborted) {
            dashboardCache.error = normalizeError(error)
          }
          return dashboardCache.data
        })
        .finally(() => {
          if (dashboardCache.promise === request) {
            dashboardCache.promise = null
          }
          if (abortRef.current === controller) {
            abortRef.current = null
          }
          syncCache({ isFetching: false, isLoading: false })
        })

      dashboardCache.promise = request
      return request
    },
    [syncCache],
  )

  useEffect(() => {
    mountedRef.current = true
    void refetch()

    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [refetch])

  useEffect(() => {
    const handleVisibilityChange = () => {
      const hidden = isDocumentHidden()
      syncCache({ isPaused: hidden, isFetching: hidden ? false : state.isFetching })
      if (!hidden && !hasFreshCache()) {
        void refetch()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [refetch, state.isFetching, syncCache])

  useEffect(() => {
    if (state.isPaused) return undefined

    const timer = window.setInterval(() => {
      if (!isDocumentHidden()) {
        void refetch()
      }
    }, refetchIntervalMs)

    return () => window.clearInterval(timer)
  }, [refetch, state.isPaused])

  return {
    ...state,
    refetch,
  }
}
