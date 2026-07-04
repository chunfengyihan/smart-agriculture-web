import fs from 'node:fs'
import fsp from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import { loadEnv } from './env.mjs'
import { DtuProtocolError, loadDeviceRegistry, parseDtuFrame } from './ingest/dtu-protocol.mjs'

loadEnv()

const host = process.env.DTU_TCP_HOST || '0.0.0.0'
const port = parseInteger(process.env.DTU_TCP_PORT, 9000)
const logDir = path.resolve(process.cwd(), process.env.DTU_TCP_LOG_DIR || '.runtime/dtu')
const registryPath = process.env.DTU_DEVICE_REGISTRY_PATH
const maxFrameBytes = parseInteger(process.env.DTU_TCP_MAX_FRAME_BYTES, 4096)
const previewBytes = parseInteger(process.env.DTU_TCP_REDACTED_PREVIEW_BYTES, 160)
const ingestApiUrl =
  process.env.DTU_INGEST_API_URL ||
  `${(process.env.DJANGO_API_BASE || 'http://127.0.0.1:8000').replace(/\/$/, '')}/api/v1/ingest/dtu-readings`
const ingestApiKey = process.env.DTU_INGEST_API_KEY || process.env.DJANGO_API_AUTH_TOKEN || ''

await fsp.mkdir(logDir, { recursive: true })

const auditLogPath = path.join(logDir, `audit-${formatDate(new Date())}.jsonl`)
const eventLogPath = path.join(logDir, `events-${formatDate(new Date())}.jsonl`)
const auditLog = fs.createWriteStream(auditLogPath, { flags: 'a' })
const eventLog = fs.createWriteStream(eventLogPath, { flags: 'a' })
const registry = loadDeviceRegistry(registryPath)

let connectionSeq = 0
const connections = new Map()
const sockets = new Set()

const server = net.createServer((socket) => {
  const connectionId = `conn-${++connectionSeq}`
  const remoteAddress = normalizeRemoteAddress(socket.remoteAddress)
  const remotePort = socket.remotePort
  const connectedAt = new Date()

  const state = {
    connectionId,
    remoteAddress,
    remotePort,
    connectedAt: connectedAt.toISOString(),
    receivedFrames: 0,
    receivedBytes: 0,
    acceptedFrames: 0,
    rejectedFrames: 0,
  }

  connections.set(connectionId, state)
  sockets.add(socket)

  writeEvent('connected', state)
  console.log(`[${timestamp()}] connected ${connectionId} ${remoteAddress}:${remotePort}`)

  socket.on('data', (buffer) => {
    void handleFrame(buffer, state)
  })

  socket.on('close', (hadError) => {
    connections.delete(connectionId)
    sockets.delete(socket)
    writeEvent('disconnected', {
      ...state,
      disconnectedAt: new Date().toISOString(),
      hadError,
    })
    console.log(`[${timestamp()}] disconnected ${connectionId} hadError=${hadError}`)
  })

  socket.on('error', (error) => {
    writeEvent('socket_error', {
      ...state,
      message: error.message,
      code: error.code,
    })
    console.error(`[${timestamp()}] socket error ${connectionId}: ${error.message}`)
  })
})

server.on('error', (error) => {
  console.error(`[${timestamp()}] server error: ${error.message}`)
  process.exitCode = 1
})

server.listen(port, host, () => {
  console.log(`[${timestamp()}] DTU TCP server listening on ${host}:${port}`)
  console.log(`[${timestamp()}] device registry: ${registryPath || '(not configured)'}`)
  console.log(`[${timestamp()}] registered devices: ${registry.size}`)
  console.log(`[${timestamp()}] ingest API: ${ingestApiUrl}`)
  console.log(`[${timestamp()}] audit log: ${auditLogPath}`)
  console.log(`[${timestamp()}] event log: ${eventLogPath}`)
})

async function handleFrame(buffer, state) {
  state.receivedFrames += 1
  state.receivedBytes += buffer.length

  try {
    const parsed = parseDtuFrame(buffer, {
      registry,
      remoteAddress: state.remoteAddress,
      maxFrameBytes,
      previewBytes,
    })
    parsed.payload.connection_id = state.connectionId
    const result = await submitIngest(parsed.payload, state.remoteAddress)
    state.acceptedFrames += 1
    writeAudit('accepted', {
      ...parsed.audit,
      connectionId: state.connectionId,
      backend_status: result.status,
      backend_code: result.body?.code,
      reading_id: result.body?.data?.reading_id,
    })
    console.log(
      `[${timestamp()}] accepted ${state.connectionId} device=${parsed.payload.device_id} reading=${result.body?.data?.reading_id ?? 'unknown'}`,
    )
  } catch (error) {
    state.rejectedFrames += 1
    const audit = error instanceof DtuProtocolError ? error.audit : {}
    const errorCode = error instanceof DtuProtocolError ? error.code : 'DTU_INGEST_FORWARD_FAILED'
    writeAudit('rejected', {
      ...audit,
      connectionId: state.connectionId,
      remote_ip: state.remoteAddress,
      error_code: errorCode,
      message: error.message,
    })
    console.warn(`[${timestamp()}] rejected ${state.connectionId} code=${errorCode} message=${error.message}`)
  }
}

async function submitIngest(payload, remoteAddress) {
  const headers = {
    'Content-Type': 'application/json',
    'X-DTU-Remote-IP': remoteAddress,
  }
  if (ingestApiKey) {
    headers['X-API-Key'] = ingestApiKey
  }

  const response = await fetch(ingestApiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
  const body = await readJsonResponse(response)
  if (!response.ok) {
    const error = new Error(body?.message || `DTU ingest API returned ${response.status}`)
    error.status = response.status
    error.body = body
    throw error
  }
  return { status: response.status, body }
}

async function readJsonResponse(response) {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { message: text.slice(0, 256) }
  }
}

function writeAudit(status, payload) {
  auditLog.write(`${JSON.stringify({ status, at: new Date().toISOString(), ...sanitizeLogPayload(payload) })}\n`)
}

function writeEvent(type, payload) {
  eventLog.write(`${JSON.stringify({ type, at: new Date().toISOString(), ...sanitizeLogPayload(payload) })}\n`)
}

function sanitizeLogPayload(payload) {
  const { device_token: _deviceToken, token: _token, signature: _signature, ...safePayload } = payload
  return safePayload
}

function parseInteger(value, fallback) {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeRemoteAddress(address) {
  if (!address) return 'unknown'
  return address.startsWith('::ffff:') ? address.slice(7) : address
}

function timestamp() {
  return new Date().toISOString()
}

function formatDate(date) {
  return date.toISOString().slice(0, 10)
}

function shutdown(signal) {
  console.log(`[${timestamp()}] received ${signal}, closing ${connections.size} connection(s)`)

  for (const socket of sockets) {
    socket.end()
    setTimeout(() => socket.destroy(), 1000).unref()
  }

  server.close(() => {
    auditLog.end()
    eventLog.end()
    process.exit(0)
  })

  setTimeout(() => process.exit(0), 3000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
