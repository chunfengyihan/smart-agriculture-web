export type ThemeMode = 'light' | 'dark'

export type CropId = 'jujube' | 'blueberry' | 'cherry'

export type GreenhouseStatus = 'online' | 'warning' | 'offline'

export type MetricKey =
  | 'airTemp'
  | 'airHumidity'
  | 'light'
  | 'co2'
  | 'soilHumidity'
  | 'soilTemp'
  | 'ec'
  | 'ph'

export interface MetricReading {
  key: MetricKey
  label: string
  value: number | null
  unit: string
  status: 'normal' | 'warning' | 'critical'
  target: string
}

export interface TrendPoint {
  time: string
  airTemp: number | null
  airHumidity: number | null
  soilHumidity: number | null
  light: number | null
}

export interface AlertItem {
  id: string
  level: 'notice' | 'warning' | 'critical'
  message: string
  time: string
}

export interface Greenhouse {
  id: string
  name: string
  area: string
  status: GreenhouseStatus
  onlineDevices: number
  totalDevices: number
  metrics: MetricReading[]
  trend: TrendPoint[]
  alerts: AlertItem[]
}

export interface Crop {
  id: CropId
  name: string
  latinName: string
  description: string
  heroImage: string
  accent: string
  greenhouses: Greenhouse[]
}

export interface DashboardData {
  generatedAt: string
  source: 'mock' | 'youren' | 'local'
  crops: Crop[]
}

export type CropDiagnosisRiskLevel = 'low' | 'medium' | 'high' | 'unknown'

export interface CropDiagnosisMetric {
  key: MetricKey
  label: string
  value: number | null
  unit: string
  target: string
}

export interface CropDiagnosisIssue {
  name: string
  confidence: number
  evidence: string
}

export interface CropDiagnosisResult {
  riskLevel: CropDiagnosisRiskLevel
  hasPestOrDisease: boolean
  suspectedIssues: CropDiagnosisIssue[]
  environmentAssessment: string
  recommendations: string[]
  disclaimer: string
  evidence?: string[]
  matchedRules?: string[]
  confidenceReason?: string
  followUpQuestions?: string[]
}

export interface AgriChatRequest {
  cropId: CropId
  cropName: string
  greenhouseId: string
  greenhouseName: string
  metrics: CropDiagnosisMetric[]
  question: string
}

export interface AgriChatResponse {
  riskLevel: CropDiagnosisRiskLevel
  summary: string
  likelyCauses: string[]
  actions: string[]
  watchItems: string[]
  matchedRules: string[]
  disclaimer: string
}

export type WeatherAdviceRiskLevel = 'low' | 'medium' | 'high' | 'unknown'

export interface WeatherCurrent {
  time: string
  temperature: number | null
  apparentTemperature: number | null
  humidity: number | null
  precipitation: number | null
  windSpeed: number | null
  weatherCode: number | null
  description: string
}

export interface WeatherForecastDay {
  date: string
  weatherCode: number | null
  description: string
  temperatureMax: number | null
  temperatureMin: number | null
  precipitationProbabilityMax: number | null
  precipitationSum: number | null
  windSpeedMax: number | null
}

export interface GreenhouseWeather {
  source: 'Open-Meteo'
  sourceUrl: string
  generatedAt: string
  location: {
    latitude: number
    longitude: number
    address: string
  }
  current: WeatherCurrent
  forecast: WeatherForecastDay[]
}

export interface WeatherOperationAdvice {
  riskLevel: WeatherAdviceRiskLevel
  summary: string
  actions: string[]
  watchItems: string[]
  disclaimer: string
}

export interface GreenhouseWeatherAdviceResponse {
  cacheKey: string
  cachedAt: string
  weather: GreenhouseWeather
  advice: WeatherOperationAdvice | null
  adviceError: string | null
}
