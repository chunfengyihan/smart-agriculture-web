import crypto from 'node:crypto'
import fs from 'node:fs'

export const PARSER_VERSION = 'dtu-parser-v1'
export const DEFAULT_PROTOCOL = 'smart_agri_v1'
export const SUPPORTED_METRICS = new Map([
  ['airTemp', 'air_temp'],
  ['air_temp', 'air_temp'],
  ['temp', 'air_temp'],
  ['temperature', 'air_temp'],
  ['airHumidity', 'air_humidity'],
  ['air_humidity', 'air_humidity'],
  ['humidity', 'air_humidity'],
  ['light', 'light'],
  ['co2', 'co2'],
  ['soilHumidity', 'soil_humidity'],
  ['soil_humidity', 'soil_humidity'],
  ['soil_moisture', 'soil_humidity'],
  ['soilTemp', 'soil_temp'],
  ['soil_temp', 'soil_temp'],
  ['ec', 'ec'],
  ['ph', 'ph'],
])

export class DtuProtocolError extends Error {
  constructor(code, message, audit = {}) {
    super(message)
    this.name = 'DtuProtocolError'
    this.code = code
    this.audit = audit
  }
}

export function loadDeviceRegistry(registryPath) {
  if (!registryPath) return new Map()
  if (!fs.existsSync(registryPath)) return new Map()

  const parsed = JSON.parse(fs.readFileSync(registryPath, 'utf8').replace(/^\uFEFF/, ''))
  const devices = Array.isArray(parsed) ? parsed : parsed.devices
  if (!Array.isArray(devices)) {
    throw new Error('DTU device registry must be an array or an object with a devices array')
  }

  return new Map(
    devices.map((device) => {
      if (!device.deviceId) {
        throw new Error('DTU registry device is missing deviceId')
      }
      return [
        String(device.deviceId),
        {
          deviceId: String(device.deviceId),
          token: device.token ? String(device.token) : '',
          allowedIps: Array.isArray(device.allowedIps) ? device.allowedIps.map(String) : [],
          protocol: device.protocol ? String(device.protocol) : DEFAULT_PROTOCOL,
        },
      ]
    }),
  )
}

export function parseDtuFrame(buffer, { registry, remoteAddress, maxFrameBytes = 4096, previewBytes = 160 } = {}) {
  const audit = buildFrameAudit(buffer, previewBytes)
  if (!buffer.length) {
    throw new DtuProtocolError('DTU_EMPTY_FRAME', 'DTU frame is empty', audit)
  }
  if (buffer.length > maxFrameBytes) {
    throw new DtuProtocolError('DTU_FRAME_TOO_LARGE', 'DTU frame exceeds configured max bytes', audit)
  }

  const decoded = decodeTextFrame(buffer)
  const parsed = decoded.startsWith('{') ? parseJsonFrame(decoded) : parsePipeFrame(decoded)
  const deviceId = parsed.deviceId || parsed.device_id || parsed.device
  if (!deviceId) {
    throw new DtuProtocolError('DTU_DEVICE_MISSING', 'DTU frame is missing device id', audit)
  }

  const registered = registry?.get(String(deviceId))
  if (!registered) {
    throw new DtuProtocolError('DTU_DEVICE_NOT_REGISTERED', 'DTU device is not registered', {
      ...audit,
      device_id: String(deviceId),
    })
  }

  const protocol = parsed.protocol || registered.protocol || DEFAULT_PROTOCOL
  if (protocol !== registered.protocol) {
    throw new DtuProtocolError('DTU_PROTOCOL_MISMATCH', 'DTU frame protocol does not match registry', {
      ...audit,
      device_id: String(deviceId),
      protocol,
    })
  }

  if (registered.allowedIps.length > 0 && !registered.allowedIps.includes(remoteAddress)) {
    throw new DtuProtocolError('DTU_DEVICE_IP_DENIED', 'DTU remote address is not allowlisted', {
      ...audit,
      device_id: String(deviceId),
      protocol,
      remote_ip: remoteAddress,
    })
  }

  const token = parsed.token || parsed.deviceToken || parsed.device_token || ''
  const signature = parsed.signature || ''
  if (registered.token) {
    if (signature) {
      assertValidSignature(registered.token, signature, parsed, {
        ...audit,
        device_id: String(deviceId),
        protocol,
      })
    } else if (token !== registered.token) {
      throw new DtuProtocolError('DTU_TOKEN_INVALID', 'DTU device token is invalid', {
        ...audit,
        device_id: String(deviceId),
        protocol,
      })
    }
  }

  const recordedAt = parsed.ts || parsed.recordedAt || parsed.recorded_at || new Date().toISOString()
  const metrics = normalizeMetrics(parsed.metrics || parsed)
  if (Object.keys(metrics).length === 0) {
    throw new DtuProtocolError('DTU_NO_METRICS', 'DTU frame has no supported metrics', {
      ...audit,
      device_id: String(deviceId),
      protocol,
    })
  }

  return {
    payload: {
      device_id: String(deviceId),
      device_token: token || registered.token,
      protocol,
      recorded_at: recordedAt,
      metrics,
      remote_ip: remoteAddress,
      raw_frame_hash: audit.raw_frame_hash,
      frame_length: audit.frame_length,
      parser_version: PARSER_VERSION,
      redacted_snippet: audit.redacted_snippet,
    },
    audit: {
      ...audit,
      device_id: String(deviceId),
      protocol,
      remote_ip: remoteAddress,
      metrics: Object.keys(metrics),
    },
  }
}

export function buildFrameAudit(buffer, previewBytes = 160) {
  return {
    frame_length: buffer.length,
    raw_frame_hash: crypto.createHash('sha256').update(buffer).digest('hex'),
    redacted_snippet: redactSensitiveText(decodeTextFrame(buffer.subarray(0, previewBytes))),
  }
}

export function redactSensitiveText(text) {
  return text
    .replace(/(token|device_token|deviceToken|signature)=([^|,;\s]+)/gi, '$1=[redacted]')
    .replace(/"(token|device_token|deviceToken|signature)"\s*:\s*"[^"]+"/gi, '"$1":"[redacted]"')
    .slice(0, 256)
}

export function signFramePayload(token, frame) {
  return crypto.createHmac('sha256', token).update(canonicalFramePayload(frame)).digest('hex')
}

function parseJsonFrame(decoded) {
  try {
    const parsed = JSON.parse(decoded)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('JSON DTU frame must be an object')
    }
    return parsed
  } catch (error) {
    throw new DtuProtocolError('DTU_JSON_INVALID', error.message, {
      redacted_snippet: redactSensitiveText(decoded),
      frame_length: Buffer.byteLength(decoded),
      raw_frame_hash: crypto.createHash('sha256').update(decoded).digest('hex'),
    })
  }
}

function parsePipeFrame(decoded) {
  const parts = decoded.split('|').map((item) => item.trim()).filter(Boolean)
  if (parts[0] !== 'DTU1') {
    throw new DtuProtocolError('DTU_PROTOCOL_UNSUPPORTED', 'DTU text frame must start with DTU1', {
      redacted_snippet: redactSensitiveText(decoded),
      frame_length: Buffer.byteLength(decoded),
      raw_frame_hash: crypto.createHash('sha256').update(decoded).digest('hex'),
    })
  }

  const parsed = { protocol: DEFAULT_PROTOCOL }
  for (const part of parts.slice(1)) {
    const equalIndex = part.indexOf('=')
    if (equalIndex <= 0) continue
    parsed[part.slice(0, equalIndex).trim()] = part.slice(equalIndex + 1).trim()
  }
  return parsed
}

function normalizeMetrics(raw) {
  const metrics = {}
  for (const [key, value] of Object.entries(raw)) {
    const metric = SUPPORTED_METRICS.get(key)
    if (!metric || value === '' || value === undefined || value === null) continue

    const number = Number(value)
    if (!Number.isFinite(number)) {
      throw new DtuProtocolError('DTU_METRIC_INVALID', `DTU metric ${key} is not numeric`)
    }
    metrics[metric] = number
  }
  return metrics
}

function assertValidSignature(token, signature, frame, audit = {}) {
  const expected = signFramePayload(token, frame)
  const provided = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (provided.length !== expectedBuffer.length || !crypto.timingSafeEqual(provided, expectedBuffer)) {
    throw new DtuProtocolError('DTU_SIGNATURE_INVALID', 'DTU frame signature is invalid', audit)
  }
}

function canonicalFramePayload(frame) {
  const deviceId = frame.deviceId || frame.device_id || frame.device || ''
  const recordedAt = frame.ts || frame.recordedAt || frame.recorded_at || ''
  const metrics = normalizeMetrics(frame.metrics || frame)
  const metricText = Object.keys(metrics)
    .sort()
    .map((key) => `${key}=${metrics[key]}`)
    .join('&')
  return `${deviceId}|${recordedAt}|${metricText}`
}

function decodeTextFrame(buffer) {
  return buffer.toString('utf8').replace(/\0/g, '').trim()
}
