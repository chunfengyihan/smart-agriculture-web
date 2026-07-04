import net from 'node:net'
import { signFramePayload } from '../server/ingest/dtu-protocol.mjs'

const host = argValue('--host') || process.env.DTU_TCP_SIM_HOST || '127.0.0.1'
const port = Number(argValue('--port') || process.env.DTU_TCP_SIM_PORT || 9000)
const deviceId = argValue('--device') || process.env.DTU_TCP_SIM_DEVICE || 'dtu-001'
const token = argValue('--token') || process.env.DTU_TCP_SIM_TOKEN || 'replace-with-device-token'
const mode = argValue('--mode') || process.env.DTU_TCP_SIM_MODE || 'pipe'
const recordedAt = new Date().toISOString()
const metrics = {
  air_temp: Number(argValue('--air-temp') || 25.6),
  air_humidity: Number(argValue('--air-humidity') || 68),
  soil_humidity: Number(argValue('--soil-humidity') || 52),
}

const frame =
  mode === 'json'
    ? jsonFrame({ deviceId, token, recordedAt, metrics })
    : `DTU1|device=${deviceId}|token=${token}|ts=${recordedAt}|air_temp=${metrics.air_temp}|humidity=${metrics.air_humidity}|soil_humidity=${metrics.soil_humidity}`

const client = net.createConnection({ host, port }, () => {
  client.write(frame)
  client.end()
})

client.on('close', () => {
  console.log(`sent ${Buffer.byteLength(frame)} bytes to ${host}:${port}`)
})

client.on('error', (error) => {
  console.error(`failed to send DTU frame: ${error.message}`)
  process.exitCode = 1
})

function jsonFrame({ deviceId, token, recordedAt, metrics }) {
  const unsigned = {
    deviceId,
    recordedAt,
    metrics,
  }
  return JSON.stringify({
    ...unsigned,
    signature: signFramePayload(token, unsigned),
  })
}

function argValue(name) {
  const index = process.argv.indexOf(name)
  if (index === -1) return ''
  return process.argv[index + 1] || ''
}

