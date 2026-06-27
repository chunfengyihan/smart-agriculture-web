const weatherCache = new Map()

const shanghaiTimeZone = 'Asia/Shanghai'
const weatherFetchAttempts = 3
const weatherFetchTimeoutMs = 8_000
const cacheDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: shanghaiTimeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const fallbackAdvice = {
  riskLevel: 'unknown',
  summary: 'AI 暂未返回可解析的棚内操作建议。',
  actions: ['先按常规巡棚流程检查通风、遮阳、灌溉和排湿设备状态。'],
  watchItems: ['关注棚内温湿度与室外天气变化是否同步异常。'],
  disclaimer: 'AI 建议仅供参考，关键生产决策需人工复核。',
}

function getShanghaiDateKey() {
  return cacheDateFormatter.format(new Date())
}

function readJsonBody(request, maxBytes = 256 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0

    request.on('data', (chunk) => {
      size += chunk.length
      if (size > maxBytes) {
        const error = new Error('请求体超过 256KB 限制')
        error.statusCode = 413
        reject(error)
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8')
        resolve(text ? JSON.parse(text) : {})
      } catch {
        const error = new Error('请求体不是有效 JSON')
        error.statusCode = 400
        reject(error)
      }
    })
    request.on('error', reject)
  })
}

function toFiniteNumber(value, fieldName) {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    const error = new Error(`${fieldName} 缺失或不是有效数字`)
    error.statusCode = 400
    throw error
  }
  return number
}

function toText(value, fallback = '') {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map((item) => toText(item)).filter(Boolean).join('，')
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, item]) => {
        const text = toText(item)
        return text ? `${key}：${text}` : ''
      })
      .filter(Boolean)
      .join('，')
  }
  return fallback
}

function weatherDescription(code) {
  const descriptions = {
    0: '晴',
    1: '基本晴朗',
    2: '局部多云',
    3: '阴',
    45: '有雾',
    48: '雾凇',
    51: '小毛毛雨',
    53: '中等毛毛雨',
    55: '大毛毛雨',
    56: '冻毛毛雨',
    57: '强冻毛毛雨',
    61: '小雨',
    63: '中雨',
    65: '大雨',
    66: '冻雨',
    67: '强冻雨',
    71: '小雪',
    73: '中雪',
    75: '大雪',
    77: '雪粒',
    80: '小阵雨',
    81: '中等阵雨',
    82: '强阵雨',
    85: '小阵雪',
    86: '强阵雪',
    95: '雷暴',
    96: '雷暴伴小冰雹',
    99: '雷暴伴强冰雹',
  }
  return descriptions[code] || '未知天气'
}

function valueAt(list, index) {
  return Array.isArray(list) ? list[index] ?? null : null
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function isRetryableWeatherStatus(status) {
  return status === 429 || status >= 500
}

async function fetchWeatherPayload(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), weatherFetchTimeoutMs)

  try {
    const response = await fetch(url, { signal: controller.signal })
    const payload = await response.json().catch(() => null)
    return { response, payload }
  } catch (error) {
    if (controller.signal.aborted) {
      const timeoutError = new Error('Open-Meteo 天气预报请求超时')
      timeoutError.statusCode = 502
      throw timeoutError
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function normalizeWeather(payload, requestBody) {
  const currentCode = payload?.current?.weather_code
  const current = {
    time: payload?.current?.time || '',
    temperature: payload?.current?.temperature_2m ?? null,
    apparentTemperature: payload?.current?.apparent_temperature ?? null,
    humidity: payload?.current?.relative_humidity_2m ?? null,
    precipitation: payload?.current?.precipitation ?? null,
    windSpeed: payload?.current?.wind_speed_10m ?? null,
    weatherCode: currentCode ?? null,
    description: weatherDescription(currentCode),
  }

  const daily = payload?.daily || {}
  const forecast = Array.isArray(daily.time)
    ? daily.time.slice(0, 3).map((date, index) => {
        const code = valueAt(daily.weather_code, index)
        return {
          date,
          weatherCode: code,
          description: weatherDescription(code),
          temperatureMax: valueAt(daily.temperature_2m_max, index),
          temperatureMin: valueAt(daily.temperature_2m_min, index),
          precipitationProbabilityMax: valueAt(daily.precipitation_probability_max, index),
          precipitationSum: valueAt(daily.precipitation_sum, index),
          windSpeedMax: valueAt(daily.wind_speed_10m_max, index),
        }
      })
    : []

  return {
    source: 'Open-Meteo',
    sourceUrl: 'https://open-meteo.com/',
    generatedAt: new Date().toISOString(),
    location: {
      latitude: requestBody.latitude,
      longitude: requestBody.longitude,
      address: requestBody.address || '',
    },
    current,
    forecast,
  }
}

async function fetchWeather(requestBody) {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(requestBody.latitude))
  url.searchParams.set('longitude', String(requestBody.longitude))
  url.searchParams.set(
    'current',
    'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m',
  )
  url.searchParams.set(
    'daily',
    'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max',
  )
  url.searchParams.set('timezone', shanghaiTimeZone)
  url.searchParams.set('forecast_days', '3')

  let lastError = null
  for (let attempt = 0; attempt < weatherFetchAttempts; attempt += 1) {
    try {
      const { response, payload } = await fetchWeatherPayload(url)
      if (response.ok) {
        return normalizeWeather(payload, requestBody)
      }

      const error = new Error(payload?.reason || `天气预报获取失败：${response.status}`)
      error.statusCode = 502
      lastError = error

      if (!isRetryableWeatherStatus(response.status) || attempt === weatherFetchAttempts - 1) {
        throw error
      }
    } catch (error) {
      lastError = error
      if (attempt === weatherFetchAttempts - 1) {
        if (error instanceof Error && !error.statusCode) error.statusCode = 502
        throw error
      }
    }

    await sleep(300 * (attempt + 1))
  }

  const error = lastError instanceof Error ? lastError : new Error('天气预报获取失败')
  error.statusCode = error.statusCode || 502
  throw error
}

function extractJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('AI 返回内容不是 JSON')
    return JSON.parse(match[0])
  }
}

function normalizeAdvice(value) {
  const source = value && typeof value === 'object' ? value : {}
  const riskLevel = ['low', 'medium', 'high', 'unknown'].includes(source.riskLevel) ? source.riskLevel : 'unknown'
  const actions = Array.isArray(source.actions)
    ? source.actions.slice(0, 6).map((item) => toText(item)).filter(Boolean)
    : fallbackAdvice.actions
  const watchItems = Array.isArray(source.watchItems)
    ? source.watchItems.slice(0, 4).map((item) => toText(item)).filter(Boolean)
    : fallbackAdvice.watchItems

  return {
    riskLevel,
    summary: toText(source.summary, fallbackAdvice.summary),
    actions: actions.length ? actions : fallbackAdvice.actions,
    watchItems: watchItems.length ? watchItems : fallbackAdvice.watchItems,
    disclaimer: toText(source.disclaimer, fallbackAdvice.disclaimer),
  }
}

function buildAdvicePrompt({ cropName, greenhouseName, metrics, weather }) {
  return [
    '你是智慧农业温室大棚管理助手。',
    '请根据室外天气预报、当前棚内传感器指标和作物类型，给出当天棚内可执行操作建议。',
    '建议要围绕通风、保温、遮阳、灌溉、排湿、病虫害巡查和设备巡检。',
    '只返回严格 JSON，不要使用 Markdown。',
    'JSON 字段必须为：riskLevel, summary, actions, watchItems, disclaimer。',
    'riskLevel 只能是 low、medium、high、unknown；actions 返回 3-6 条中文字符串；watchItems 返回 2-4 条中文字符串。',
    `作物：${cropName || '未知作物'}`,
    `大棚：${greenhouseName || '未知大棚'}`,
    `棚内指标：${JSON.stringify(metrics || [], null, 2)}`,
    `天气预报：${JSON.stringify(weather, null, 2)}`,
  ].join('\n')
}

async function callAdviceModel({ requestBody, weather }) {
  const apiKey = process.env.AI_API_KEY
  if (!apiKey) {
    const error = new Error('AI_API_KEY 未配置，无法生成棚内操作建议')
    error.statusCode = 503
    throw error
  }

  if (!process.env.AI_API_BASE) {
    const error = new Error('AI_API_BASE 未配置，外部集成未启用')
    error.statusCode = 503
    throw error
  }

  const apiBase = process.env.AI_API_BASE.replace(/\/$/, '')
  const model = process.env.AI_MODEL || 'gpt-4o-mini'

  const response = await fetch(`${apiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: buildAdvicePrompt({
            cropName: requestBody.cropName,
            greenhouseName: requestBody.greenhouseName,
            metrics: requestBody.metrics,
            weather,
          }),
        },
      ],
    }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(payload?.error?.message || `AI 建议生成失败：${response.status}`)
    error.statusCode = response.status >= 400 && response.status < 500 ? 502 : 500
    throw error
  }

  const content = payload?.choices?.[0]?.message?.content
  if (!content) throw new Error('AI 模型未返回建议内容')

  return normalizeAdvice(extractJson(content))
}

function makeCacheKey(requestBody) {
  return [
    getShanghaiDateKey(),
    requestBody.cropId || 'unknown-crop',
    requestBody.greenhouseId || 'unknown-greenhouse',
    Number(requestBody.latitude).toFixed(4),
    Number(requestBody.longitude).toFixed(4),
  ].join('|')
}

export async function handleGreenhouseWeatherAdvice(request) {
  const requestBody = await readJsonBody(request)
  requestBody.latitude = toFiniteNumber(requestBody.latitude, 'latitude')
  requestBody.longitude = toFiniteNumber(requestBody.longitude, 'longitude')

  const cacheKey = makeCacheKey(requestBody)
  const cached = weatherCache.get(cacheKey)
  if (cached) {
    if (requestBody.includeAdvice === true && !cached.advice) {
      try {
        cached.advice = await callAdviceModel({ requestBody, weather: cached.weather })
        cached.adviceError = null
      } catch (error) {
        cached.adviceError = error instanceof Error ? error.message : 'AI 建议生成失败'
      }
      cached.cachedAt = new Date().toISOString()
    }

    return cached
  }

  const weather = await fetchWeather(requestBody)
  const result = {
    cacheKey,
    cachedAt: new Date().toISOString(),
    weather,
    advice: null,
    adviceError: null,
  }

  if (requestBody.includeAdvice === true) {
    try {
      result.advice = await callAdviceModel({ requestBody, weather })
    } catch (error) {
      result.adviceError = error instanceof Error ? error.message : 'AI 建议生成失败'
    }
  }

  weatherCache.set(cacheKey, result)
  return result
}
