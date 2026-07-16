import { requestJson } from '../api/client'
import type {
  CropDiagnosisMetric,
  CropId,
  GreenhouseWeather,
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

interface OpenMeteoCurrentPayload {
  current?: {
    time?: string
    temperature_2m?: number
    apparent_temperature?: number
    relative_humidity_2m?: number
    precipitation?: number
    weather_code?: number
    wind_speed_10m?: number
  }
}

function weatherDescription(code: number | null) {
  if (code === null) return '实时天气'
  if (code === 0) return '晴朗'
  if (code <= 3) return '多云'
  if (code === 45 || code === 48) return '有雾'
  if (code >= 51 && code <= 67) return '降雨'
  if (code >= 71 && code <= 77) return '降雪'
  if (code >= 80 && code <= 82) return '阵雨'
  if (code === 85 || code === 86) return '阵雪'
  if (code >= 95) return '雷暴'
  return '实时天气'
}

function weatherNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export async function getOpenMeteoCurrentWeather(
  request: { latitude: number; longitude: number; address?: string },
  options: Pick<RequestTimeoutOptions, 'signal' | 'timeoutMs'> = {},
): Promise<GreenhouseWeather> {
  const query = new URLSearchParams({
    latitude: String(request.latitude),
    longitude: String(request.longitude),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m',
    timezone: 'auto',
  })
  const sourceUrl = `https://api.open-meteo.com/v1/forecast?${query.toString()}`
  const response = await fetchWithTimeout(sourceUrl, {
    ...options,
    auth: false,
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`Open-Meteo 请求失败：${response.status}`)

  const payload = await response.json() as OpenMeteoCurrentPayload
  const current = payload.current || {}
  const weatherCode = weatherNumber(current.weather_code)

  return {
    source: 'Open-Meteo',
    sourceUrl: 'https://open-meteo.com/',
    generatedAt: new Date().toISOString(),
    location: {
      latitude: request.latitude,
      longitude: request.longitude,
      address: request.address || '',
    },
    current: {
      time: current.time || '',
      temperature: weatherNumber(current.temperature_2m),
      apparentTemperature: weatherNumber(current.apparent_temperature),
      humidity: weatherNumber(current.relative_humidity_2m),
      precipitation: weatherNumber(current.precipitation),
      windSpeed: weatherNumber(current.wind_speed_10m),
      weatherCode,
      description: weatherDescription(weatherCode),
    },
    forecast: [],
  }
}
