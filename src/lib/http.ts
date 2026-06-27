export interface RequestTimeoutOptions extends RequestInit {
  timeoutMs?: number
}

export async function fetchWithTimeout(input: RequestInfo | URL, options: RequestTimeoutOptions = {}) {
  const { timeoutMs = 12_000, signal, ...requestOptions } = options
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)

  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    return await fetch(input, {
      ...requestOptions,
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
