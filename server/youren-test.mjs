import { loadEnv } from './env.mjs'
import { getAccessToken, getDataPoints, getDevices, hasCredentials } from './youren-client.mjs'

loadEnv()

if (!hasCredentials()) {
  console.error('缺少 YOUREN_APP_KEY 或 YOUREN_APP_SECRET。请先复制 .env.example 为 .env.local 并填入有人云二开密钥。')
  process.exit(1)
}

try {
  const token = await getAccessToken()
  console.log(`鉴权成功，X-Access-Token 前缀: ${token.slice(0, 18)}...`)

  const devices = await getDevices({ pageSize: 5 })
  console.log(`读取网关列表成功，样本数量: ${devices.length}`)

  for (const device of devices.slice(0, 3)) {
    const deviceNo = device.deviceNo || device.sn
    console.log(`- ${device.deviceName || '未命名网关'} (${deviceNo})`)
    const points = await getDataPoints(deviceNo)
    console.log(`  变量数量: ${points.length}`)
    for (const point of points.slice(0, 6)) {
      console.log(`  · ${point.name || point.dataIdentifier}: dataPointId=${point.dataPointId || point.dataPointRelId}`)
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
