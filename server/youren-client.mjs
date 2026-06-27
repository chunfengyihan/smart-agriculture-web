const API_BASE = process.env.YOUREN_API_BASE?.trim() || ''
const AUTH_PATH = process.env.YOUREN_AUTH_PATH || '/usrCloud/user/getAuthToken'

let tokenCache = {
  value: '',
  expiresAt: 0,
}

async function postJson(path, body, headers = {}) {
  if (!API_BASE) {
    throw new Error('YOUREN_API_BASE 未配置，外部集成未启用')
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })

  const text = await response.text()
  let payload

  try {
    payload = text ? JSON.parse(text) : {}
  } catch {
    payload = { raw: text }
  }

  if (!response.ok) {
    throw new Error(`有人云 HTTP ${response.status}: ${text.slice(0, 240)}`)
  }

  if (payload.status !== undefined && payload.status !== 0) {
    throw new Error(`有人云 API ${payload.status}: ${payload.info || 'unknown error'}`)
  }

  return payload
}

export function hasCredentials() {
  return Boolean(process.env.YOUREN_APP_KEY && process.env.YOUREN_APP_SECRET)
}

export async function getAccessToken() {
  if (tokenCache.value && Date.now() < tokenCache.expiresAt) {
    return tokenCache.value
  }

  if (!hasCredentials()) {
    throw new Error('缺少 YOUREN_APP_KEY 或 YOUREN_APP_SECRET')
  }

  const payload = await postJson(AUTH_PATH, {
    appKey: process.env.YOUREN_APP_KEY,
    appSecret: process.env.YOUREN_APP_SECRET,
  })

  const token =
    payload?.data?.['X-Access-Token'] ||
    payload?.data?.token ||
    payload?.['X-Access-Token'] ||
    payload?.token

  if (!token) {
    throw new Error('有人云鉴权成功但未返回 X-Access-Token')
  }

  tokenCache = {
    value: token,
    expiresAt: Date.now() + 110 * 60 * 1000,
  }

  return token
}

export async function getDevices({ pageNo = 1, pageSize = 100, projectId, searchParam = '' } = {}) {
  const token = await getAccessToken()
  const payload = await postJson(
    '/usrCloud/V6/device/getDevices',
    {
      pageNo,
      pageSize,
      projectId,
      searchParam,
    },
    { 'X-Access-Token': token },
  )

  return payload?.data?.list || []
}

export async function getDataPoints(cusdeviceNo) {
  const token = await getAccessToken()
  const payload = await postJson(
    '/usrCloud/V6/cusdevice/getDataPointInfoForCusdeviceNo',
    {
      cusdeviceNo,
      pageNo: 1,
      pageSize: 500,
    },
    { 'X-Access-Token': token },
  )

  return payload?.data?.cusdeviceDataPointList || []
}

export async function getLatestHistory(devDatapoints) {
  if (devDatapoints.length === 0) return []

  const token = await getAccessToken()
  const payload = await postJson(
    '/usrCloud/vn/ucloudSdk/getLastDataHistory',
    { devDatapoints },
    {
      token,
      'X-Access-Token': token,
    },
  )

  return payload?.data?.list || []
}
