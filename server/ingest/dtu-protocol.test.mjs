import assert from 'node:assert/strict'
import test from 'node:test'

import { DtuProtocolError, parseDtuFrame, signFramePayload } from './dtu-protocol.mjs'

const registry = new Map([
  [
    'dtu-001',
    {
      deviceId: 'dtu-001',
      token: 'device-token',
      allowedIps: ['127.0.0.1'],
      protocol: 'smart_agri_v1',
    },
  ],
])

test('rejects unregistered devices without exposing token', () => {
  assert.throws(
    () =>
      parseDtuFrame(Buffer.from('DTU1|device=unknown|token=secret|air_temp=22.5'), {
        registry,
        remoteAddress: '127.0.0.1',
      }),
    (error) => {
      assert.equal(error.code, 'DTU_DEVICE_NOT_REGISTERED')
      assert.equal(error.audit.redacted_snippet.includes('secret'), false)
      return true
    },
  )
})

test('rejects disallowed remote ip', () => {
  assert.throws(
    () =>
      parseDtuFrame(Buffer.from('DTU1|device=dtu-001|token=device-token|air_temp=22.5'), {
        registry,
        remoteAddress: '10.0.0.8',
      }),
    /allowlisted/,
  )
})

test('rejects invalid token', () => {
  assert.throws(
    () =>
      parseDtuFrame(Buffer.from('DTU1|device=dtu-001|token=bad-token|air_temp=22.5'), {
        registry,
        remoteAddress: '127.0.0.1',
      }),
    (error) => error instanceof DtuProtocolError && error.code === 'DTU_TOKEN_INVALID',
  )
})

test('parses legal pipe frame into normalized metrics', () => {
  const result = parseDtuFrame(Buffer.from('DTU1|device=dtu-001|token=device-token|air_temp=22.5|humidity=63'), {
    registry,
    remoteAddress: '127.0.0.1',
  })

  assert.equal(result.payload.device_id, 'dtu-001')
  assert.deepEqual(result.payload.metrics, { air_temp: 22.5, air_humidity: 63 })
  assert.equal(result.payload.redacted_snippet.includes('device-token'), false)
})

test('parses signed json frame', () => {
  const frame = {
    deviceId: 'dtu-001',
    recordedAt: '2026-07-04T10:00:00+08:00',
    metrics: { airTemp: 23.1, soilHumidity: 55 },
  }
  const signed = { ...frame, signature: signFramePayload('device-token', frame) }
  const result = parseDtuFrame(Buffer.from(JSON.stringify(signed)), {
    registry,
    remoteAddress: '127.0.0.1',
  })

  assert.deepEqual(result.payload.metrics, { air_temp: 23.1, soil_humidity: 55 })
  assert.equal(result.payload.recorded_at, frame.recordedAt)
})

