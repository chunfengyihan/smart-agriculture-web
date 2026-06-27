import http from 'node:http'
import { loadEnv } from './env.mjs'
import { buildYourenDashboard } from './dashboard-adapter.mjs'
import { handleAgriChat } from './agri-chat.mjs'
import { handleCropDiagnosis } from './ai-diagnosis.mjs'
import { handleGreenhouseWeatherAdvice } from './weather-advice.mjs'
import { getAccessToken, getDevices, hasCredentials } from './youren-client.mjs'

loadEnv()

const port = Number(process.env.API_PORT || 8787)

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  })
  response.end(JSON.stringify(payload, null, 2))
}

async function handleRequest(request, response) {
  const url = new URL(request.url || '/', `http://${request.headers.host}`)

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    })
    response.end()
    return
  }

  try {
    if (url.pathname === '/api/youren/health') {
      if (!hasCredentials()) {
        sendJson(response, 200, {
          ok: false,
          configured: false,
          message: '缺少 YOUREN_APP_KEY 或 YOUREN_APP_SECRET，请先配置 .env.local',
        })
        return
      }

      await getAccessToken()
      const devices = await getDevices({ pageSize: 10 })
      sendJson(response, 200, {
        ok: true,
        configured: true,
        deviceCountInSample: devices.length,
        sampleDevices: devices.map((device) => ({
          deviceNo: device.deviceNo || device.sn,
          deviceName: device.deviceName,
          projectName: device.projectName,
          onlineOffline: device.deviceStatus?.onlineOffline,
        })),
      })
      return
    }

    if (url.pathname === '/api/greenhouse/dashboard') {
      if (!hasCredentials()) {
        sendJson(response, 503, {
          message: '有人云凭据未配置，无法获取真实数据',
          requiredEnv: ['YOUREN_APP_KEY', 'YOUREN_APP_SECRET'],
        })
        return
      }

      sendJson(response, 200, await buildYourenDashboard())
      return
    }

    if (url.pathname === '/api/ai/crop-diagnosis') {
      if (request.method !== 'POST') {
        sendJson(response, 405, { message: 'Method not allowed' })
        return
      }

      sendJson(response, 200, await handleCropDiagnosis(request))
      return
    }

    if (url.pathname === '/api/ai/agri-chat') {
      if (request.method !== 'POST') {
        sendJson(response, 405, { message: 'Method not allowed' })
        return
      }

      sendJson(response, 200, await handleAgriChat(request))
      return
    }

    if (url.pathname === '/api/weather/greenhouse-advice') {
      if (request.method !== 'POST') {
        sendJson(response, 405, { message: 'Method not allowed' })
        return
      }

      sendJson(response, 200, await handleGreenhouseWeatherAdvice(request))
      return
    }

    sendJson(response, 404, { message: 'Not found' })
  } catch (error) {
    sendJson(response, error.statusCode || 500, {
      message: error instanceof Error ? error.message : '有人云代理服务异常',
    })
  }
}

http.createServer((request, response) => {
  void handleRequest(request, response)
}).listen(port, () => {
  console.log(`Youren API proxy listening on http://127.0.0.1:${port}`)
})
