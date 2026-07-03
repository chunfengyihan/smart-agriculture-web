import { requestJson } from '../api/client'
import type {
  CropDiagnosisMetric,
  CropId,
  GreenhouseWeatherAdviceResponse,
} from '../types'
import type { RequestTimeoutOptions } from '../lib/http'

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
  return requestJson<GreenhouseWeatherAdviceResponse>('/api/v1/weather/greenhouse-advice', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    signal: options.signal,
    timeoutMs: options.timeoutMs,
  })
}
