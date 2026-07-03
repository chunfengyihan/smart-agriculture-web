export interface RequestTimeoutOptions extends RequestInit {
  timeoutMs?: number
  auth?: boolean
}

const ACCESS_TOKEN_STORAGE_KEYS = ['smart_agri_access_token', 'access_token', 'token']

export function getStoredAccessToken() {
  if (typeof window === 'undefined') return ''

  for (const key of ACCESS_TOKEN_STORAGE_KEYS) {
    const token = window.localStorage.getItem(key) || window.sessionStorage.getItem(key)
    if (token) return token
  }

  return ''
}

export function setStoredAccessToken(token: string, persist = true) {
  if (typeof window === 'undefined') return
  const storage = persist ? window.localStorage : window.sessionStorage
  storage.setItem('smart_agri_access_token', token)
}

export function clearStoredAccessToken() {
  if (typeof window === 'undefined') return
  for (const key of ACCESS_TOKEN_STORAGE_KEYS) {
    window.localStorage.removeItem(key)
    window.sessionStorage.removeItem(key)
  }
}

function buildHeaders(headers: HeadersInit | undefined, auth = true) {
  const nextHeaders = new Headers(headers)
  const token = auth ? getStoredAccessToken() : ''

  if (token && !nextHeaders.has('Authorization')) {
    nextHeaders.set('Authorization', `Bearer ${token}`)
  }

  return nextHeaders
}

export async function fetchWithTimeout(input: RequestInfo | URL, options: RequestTimeoutOptions = {}) {
  const { timeoutMs = 12_000, signal, auth = true, ...requestOptions } = options
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)

  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    return await fetch(input, {
      ...requestOptions,
      headers: buildHeaders(requestOptions.headers, auth),
      signal: controller.signal,
    })
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('请求超时或已取消，请稍后重试。', { cause: error })
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}
