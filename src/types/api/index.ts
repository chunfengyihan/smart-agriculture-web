export interface ApiSuccess<T> {
  code: 0
  message: string
  data: T
  request_id?: string
}

export interface ApiErrorBody {
  code: number | string
  message: string
  data?: unknown
  details?: unknown
  request_id?: string
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody

export interface PageResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
