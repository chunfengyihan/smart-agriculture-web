import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CloudSun, MapPin, RefreshCw } from 'lucide-react'
import { getGreenhouseWeatherAdvice } from '../data/weatherAdvice'
import { findGreenhouseLocation } from '../data/greenhouseLocations'
import {
  formatForecastDate,
  formatWeatherNumber,
  weatherRiskLabel,
} from '../lib/formatters'
import { buildWeatherMetrics } from '../lib/metrics'
import type { Crop, Greenhouse, GreenhouseWeatherAdviceResponse } from '../types'

export default function WeatherAdvicePanel({ crop, greenhouse }: { crop: Crop; greenhouse: Greenhouse }) {
  const [weatherAdvice, setWeatherAdvice] = useState<GreenhouseWeatherAdviceResponse | null>(null)
  const [weatherError, setWeatherError] = useState<string | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [adviceLoading, setAdviceLoading] = useState(false)
  const requestIdRef = useRef(0)
  const activeControllerRef = useRef<AbortController | null>(null)
  const location = useMemo(() => findGreenhouseLocation(crop.id, greenhouse.id), [crop.id, greenhouse.id])
  const weatherMetrics = useMemo(() => buildWeatherMetrics(greenhouse), [greenhouse])

  const loadWeatherAdvice = useCallback(
    async (includeAdvice = false) => {
      if (!location) return

      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId
      activeControllerRef.current?.abort()
      const controller = new AbortController()
      activeControllerRef.current = controller

      setWeatherError(null)
      setWeatherLoading(!includeAdvice)
      setAdviceLoading(includeAdvice)

      try {
        const result = await getGreenhouseWeatherAdvice(
          {
            cropId: crop.id,
            cropName: crop.name,
            greenhouseId: greenhouse.id,
            greenhouseName: greenhouse.name,
            latitude: location.lat,
            longitude: location.lon,
            address: location.address,
            metrics: weatherMetrics,
            includeAdvice,
          },
          { signal: controller.signal, timeoutMs: includeAdvice ? 20_000 : 8_000 },
        )
        if (requestId !== requestIdRef.current) return
        setWeatherAdvice(result)
      } catch (loadError) {
        if (requestId !== requestIdRef.current) return
        setWeatherError(loadError instanceof Error ? loadError.message : '天气建议加载失败')
      } finally {
        if (requestId === requestIdRef.current) {
          setWeatherLoading(false)
          setAdviceLoading(false)
        }
      }
    },
    [crop.id, crop.name, greenhouse.id, greenhouse.name, location, weatherMetrics],
  )

  useEffect(() => {
    if (!location) return
    const timer = window.setTimeout(() => void loadWeatherAdvice(false), 0)
    return () => {
      window.clearTimeout(timer)
      activeControllerRef.current?.abort()
    }
  }, [loadWeatherAdvice, location])

  if (!location) {
    return (
      <article className="weather-panel missing">
        <div className="section-heading weather-heading">
          <div>
            <p>今日天气，按天更新</p>
            <h2>棚区天气与操作建议</h2>
          </div>
          <span className="diagnosis-badge">
            <MapPin size={16} />
            位置待补充
          </span>
        </div>
        <div className="empty-state">当前棚区缺少经纬度，无法获取对应地区天气预报。</div>
      </article>
    )
  }

  const weather = weatherAdvice?.weather
  const advice = weatherAdvice?.advice

  return (
    <article className="weather-panel">
      <div className="section-heading weather-heading">
        <div>
          <p>今日天气，按天更新</p>
          <h2>棚区天气与操作建议</h2>
        </div>
        <span className="diagnosis-badge">
          <CloudSun size={16} />
          天气数据：Open-Meteo
        </span>
      </div>

      {weatherLoading && !weatherAdvice ? (
        <div className="weather-loading">
          <RefreshCw className="spinning" size={18} />
          正在同步天气预报
        </div>
      ) : weatherError && !weather ? (
        <div className="diagnosis-error">
          {weatherError}
          <button type="button" onClick={() => void loadWeatherAdvice(false)}>
            重试
          </button>
        </div>
      ) : weather ? (
        <>
          <div className="weather-summary">
            <div className="weather-current">
              <span className="weather-icon">
                <CloudSun size={28} />
              </span>
              <div>
                <p>{weather.current.description}</p>
                <strong>{formatWeatherNumber(weather.current.temperature, '°C', 1)}</strong>
                <small>
                  体感 {formatWeatherNumber(weather.current.apparentTemperature, '°C', 1)} · 湿度{' '}
                  {formatWeatherNumber(weather.current.humidity, '%')} · 风速{' '}
                  {formatWeatherNumber(weather.current.windSpeed, ' km/h', 1)}
                </small>
              </div>
            </div>
            <div className="weather-meta">
              <span>{location.address}</span>
              <button type="button" onClick={() => void loadWeatherAdvice(false)} disabled={weatherLoading}>
                <RefreshCw className={weatherLoading ? 'spinning' : ''} size={15} />
                刷新天气
              </button>
            </div>
          </div>

          <div className="forecast-grid">
            {weather.forecast.map((day) => (
              <section key={day.date}>
                <span>{formatForecastDate(day.date)}</span>
                <strong>{day.description}</strong>
                <p>
                  {formatWeatherNumber(day.temperatureMin, '°C', 1)} /{' '}
                  {formatWeatherNumber(day.temperatureMax, '°C', 1)}
                </p>
                <small>
                  降水 {formatWeatherNumber(day.precipitationProbabilityMax, '%')} ·{' '}
                  {formatWeatherNumber(day.precipitationSum, ' mm', 1)}
                </small>
                <small>最大风速 {formatWeatherNumber(day.windSpeedMax, ' km/h', 1)}</small>
              </section>
            ))}
          </div>

          <div className="weather-advice">
            <div className="weather-advice-top">
              <strong>{advice ? weatherRiskLabel(advice.riskLevel) : '操作建议'}</strong>
              <span>
                {advice?.summary ||
                  weatherAdvice?.adviceError ||
                  '天气已同步，可按需生成棚内操作建议，避免每次切换棚区都等待 AI。'}
              </span>
            </div>

            {!advice && (
              <button
                className="weather-advice-action"
                type="button"
                onClick={() => void loadWeatherAdvice(true)}
                disabled={adviceLoading}
              >
                <RefreshCw className={adviceLoading ? 'spinning' : ''} size={15} />
                {adviceLoading ? '正在生成建议' : '生成操作建议'}
              </button>
            )}

            {weatherError && weather && <div className="diagnosis-error">{weatherError}</div>}

            {advice && (
              <div className="weather-advice-grid">
                <section>
                  <h3>棚内操作</h3>
                  <ul>
                    {advice.actions.map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3>重点观察</h3>
                  <ul>
                    {advice.watchItems.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              </div>
            )}

            {advice?.disclaimer && <small>{advice.disclaimer}</small>}
          </div>
        </>
      ) : (
        <div className="empty-state">暂无天气数据。</div>
      )}
    </article>
  )
}
