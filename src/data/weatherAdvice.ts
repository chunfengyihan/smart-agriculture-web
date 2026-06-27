import type {
  CropDiagnosisMetric,
  CropId,
  GreenhouseWeatherAdviceResponse,
} from '../types'
import { fetchWithTimeout, type RequestTimeoutOptions } from '../lib/http'

interface GreenhouseWeatherAdviceRequest {
  cropId: CropId
  cropName: string
  greenhouseId: string
  greenhouseName: string
  latitude: number
  longitude: number
  address?: string
  metrics: CropDiagnosisMetric[]
  includeAdvice?: boolean
}

export async function getGreenhouseWeatherAdvice(
  request: GreenhouseWeatherAdviceRequest,
  options: Pick<RequestTimeoutOptions, 'signal' | 'timeoutMs'> = {},
): Promise<GreenhouseWeatherAdviceResponse> {
  const response = await fetchWithTimeout('/api/weather/greenhouse-advice', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    signal: options.signal,
    timeoutMs: options.timeoutMs,
  })

  const payload = (await response.json().catch(() => null)) as
    | { message?: string }
    | GreenhouseWeatherAdviceResponse
    | null

  if (!response.ok) {
    if ([502, 503, 504].includes(response.status)) {
      throw new Error('天气服务暂不可用，请确认本地 API 已启动：npm run dev:full 或 npm run dev:api')
    }

    throw new Error(
      payload && 'message' in payload && payload.message
        ? payload.message
        : `天气建议获取失败：${response.status}`,
    )
  }

  return payload as GreenhouseWeatherAdviceResponse
}
