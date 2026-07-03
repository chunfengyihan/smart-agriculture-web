import { fetchWithTimeout, type RequestTimeoutOptions } from '../lib/http'
import type { ApiErrorBody, ApiResponse } from '../types/api'

export class ApiRequestError extends Error {
  status: number
  code: string
  details: unknown
  requestId: string

  constructor(message: string, options: { status: number; code?: number | string; details?: unknown; requestId?: string }) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = options.status
    this.code = String(options.code ?? options.status)
    this.details = options.details ?? {}
    this.requestId = options.requestId ?? ''
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isApiResponse<T>(payload: unknown): payload is ApiResponse<T> {
  return isObject(payload) && 'code' in payload && 'message' in payload
}

async function parseJson(response: Response) {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function errorFromPayload(response: Response, payload: unknown) {
  if (isApiResponse<unknown>(payload)) {
    const body = payload as ApiErrorBody
    return new ApiRequestError(body.message || response.statusText, {
      status: response.status,
      code: body.code,
      details: body.details ?? body.data ?? {},
      requestId: body.request_id,
    })
  }

  if (isObject(payload) && typeof payload.message === 'string') {
    return new ApiRequestError(payload.message, {
      status: response.status,
      details: payload,
    })
  }

  return new ApiRequestError(response.statusText || `Request failed: ${response.status}`, {
    status: response.status,
    details: payload,
  })
}

export function unwrapApiPayload<T>(payload: unknown): T {
  if (isApiResponse<T>(payload)) {
    if (payload.code === 0) {
      return payload.data as T
    }

    const errorBody = payload as ApiErrorBody
    throw new ApiRequestError(errorBody.message, {
      status: 200,
      code: errorBody.code,
      details: errorBody.details ?? errorBody.data ?? {},
      requestId: errorBody.request_id,
    })
  }

  return payload as T
}

export async function requestJson<T>(input: RequestInfo | URL, options: RequestTimeoutOptions = {}) {
  const response = await fetchWithTimeout(input, options)
  const payload = await parseJson(response)

  if (!response.ok) {
    throw errorFromPayload(response, payload)
  }

  return unwrapApiPayload<T>(payload)
}

export async function requestForm<T>(input: RequestInfo | URL, formData: FormData, options: RequestTimeoutOptions = {}) {
  return requestJson<T>(input, {
    ...options,
    method: options.method ?? 'POST',
    body: formData,
  })
}
