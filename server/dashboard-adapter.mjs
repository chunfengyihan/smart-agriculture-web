import fs from 'node:fs'
import path from 'node:path'
import { getDataPoints, getDevices, getLatestHistory } from './youren-client.mjs'

const metricDefs = {
  airTemp: { label: '空气温度', unit: '°C', target: '18-28°C', keywords: ['空气温度', '气温', '温度', 'temp'] },
  airHumidity: { label: '空气湿度', unit: '%', target: '55-80%', keywords: ['空气湿度', '湿度', 'humidity'] },
  light: { label: '光照强度', unit: 'lux', target: '12k-38k', keywords: ['光照', '照度', 'light', 'lux'] },
  co2: { label: 'CO2', unit: 'ppm', target: '420-900', keywords: ['co2', '二氧化碳'] },
  soilHumidity: { label: '土壤湿度', unit: '%', target: '45-70%', keywords: ['土壤湿度', '土湿', '墒情'] },
  soilTemp: { label: '土壤温度', unit: '°C', target: '16-25°C', keywords: ['土壤温度', '地温'] },
  ec: { label: '土壤 EC', unit: 'mS/cm', target: '0.8-1.8', keywords: ['ec', '电导'] },
  ph: { label: '土壤 PH', unit: '', target: '5.8-7.2', keywords: ['ph', '酸碱'] },
}

const cropDefaults = [
  {
    id: 'jujube',
    name: '冰糖枣',
    latinName: 'Crystal Jujube',
    description: '水肥一体化管理，重点监测昼夜温差、土壤墒情与光照积累。',
    heroImage:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Ziziphus%20jujuba%20%27Li%27%20with%20fruit%20in%20mid-summer%20-%20live%20oak%20in%20background.JPG?width=1800',
    accent: '#16a34a',
  },
  {
    id: 'blueberry',
    name: '蓝莓',
    latinName: 'Blueberry',
    description: '偏酸性基质栽培，重点关注 PH、EC、空气湿度和根区温度。',
    heroImage: 'https://commons.wikimedia.org/wiki/Special:FilePath/Blueray%20Blueberry%20Bush.JPG?width=1800',
    accent: '#2563eb',
  },
  {
    id: 'cherry',
    name: '樱桃',
    latinName: 'Cherry',
    description: '精细化控温控湿，保障花果期稳定环境和病害风险预警。',
    heroImage: 'https://commons.wikimedia.org/wiki/Special:FilePath/Cherry%20fruit%20on%20tree.jpg?width=1800',
    accent: '#dc2626',
  },
]

function readMapping() {
  const mappingPath = path.join(process.cwd(), 'config', 'greenhouse.mapping.json')
  if (!fs.existsSync(mappingPath)) return null
  return JSON.parse(fs.readFileSync(mappingPath, 'utf8'))
}

function inferMetricKey(point) {
  const text = `${point.name || ''} ${point.dataIdentifier || ''}`.toLowerCase()
  return Object.entries(metricDefs).find(([, def]) =>
    def.keywords.some((keyword) => text.includes(keyword.toLowerCase())),
  )?.[0]
}

function statusFromDevice(device) {
  const status = device.deviceStatus || {}
  if (status.monitorAlarm === 1) return 'warning'
  if (status.onlineOffline === 0) return 'offline'
  return 'online'
}

function metricStatus(key, value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'warning'
  const numberValue = Number(value)
  if (key === 'airTemp' && (numberValue < 12 || numberValue > 32)) return 'warning'
  if (key === 'airHumidity' && (numberValue < 40 || numberValue > 85)) return 'warning'
  if (key === 'soilHumidity' && (numberValue < 35 || numberValue > 80)) return 'warning'
  if (key === 'ph' && (numberValue < 5.2 || numberValue > 7.8)) return 'warning'
  return 'normal'
}

function buildTrend(metrics) {
  const byKey = Object.fromEntries(metrics.map((metric) => [metric.key, metric.value]))
  const waved = (key, offset, transform = (value) => value) => {
    const value = byKey[key]
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return null
    return transform(Number(value) + offset)
  }

  return Array.from({ length: 24 }, (_, index) => ({
    time: `${index.toString().padStart(2, '0')}:00`,
    airTemp: waved('airTemp', Math.sin(index / 4) * 1.4, (value) => Number(value.toFixed(1))),
    airHumidity: waved('airHumidity', Math.cos(index / 5) * 3, Math.round),
    soilHumidity: waved('soilHumidity', Math.sin(index / 6) * 2, Math.round),
    light: waved('light', Math.sin(index / 3) * 4000, (value) => Math.max(0, Math.round(value))),
  }))
}

function buildMetric(key, value) {
  const def = metricDefs[key]
  const numberValue = Number(value)
  const hasValue =
    value !== null && value !== undefined && String(value).trim() !== '' && Number.isFinite(numberValue)

  return {
    key,
    label: def.label,
    value: hasValue ? numberValue : null,
    unit: def.unit,
    status: metricStatus(key, hasValue ? numberValue : null),
    target: def.target,
  }
}

async function greenhouseFromDevice(device, mappingItem) {
  const deviceNo = mappingItem?.deviceNo || device.deviceNo || device.sn
  const points = await getDataPoints(deviceNo)
  const pointMappings =
    mappingItem?.metrics ||
    Object.fromEntries(
      points
        .map((point) => [inferMetricKey(point), point])
        .filter(([key]) => Boolean(key))
        .map(([key, point]) => [key, point.dataPointId || point.dataPointRelId]),
    )

  const requests = Object.entries(pointMappings)
    .filter(([, dataPointId]) => dataPointId)
    .slice(0, 10)
    .map(([key, dataPointId]) => ({
      key,
      deviceNo,
      dataPointId: Number(dataPointId),
      slaveIndex: '1',
    }))

  const latest = await getLatestHistory(
    requests.map(({ deviceNo: requestDeviceNo, dataPointId, slaveIndex }) => ({
      deviceNo: requestDeviceNo,
      dataPointId,
      slaveIndex,
    })),
  )

  const valueByPointId = new Map(latest.map((item) => [Number(item.dataPointId), item.value]))
  const metrics = requests.map((request) => buildMetric(request.key, valueByPointId.get(request.dataPointId)))

  return {
    id: mappingItem?.id || deviceNo,
    name: mappingItem?.name || device.deviceName || `大棚 ${deviceNo}`,
    area: mappingItem?.area || device.projectName || '有人云',
    status: statusFromDevice(device),
    onlineDevices: statusFromDevice(device) === 'offline' ? 0 : 1,
    totalDevices: 1,
    metrics,
    trend: buildTrend(metrics),
    alerts: metrics
      .filter((metric) => metric.status !== 'normal')
      .map((metric) => ({
        id: `${deviceNo}-${metric.key}`,
        level: metric.status === 'critical' ? 'critical' : 'warning',
        message: `${metric.label} 当前值 ${
          metric.value === null ? '无数据' : `${metric.value}${metric.unit}`
        }，请检查目标范围 ${metric.target}`,
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      })),
  }
}

export async function buildYourenDashboard() {
  const mapping = readMapping()
  const devices = await getDevices({ pageSize: 100 })
  const byDeviceNo = new Map(devices.map((device) => [device.deviceNo || device.sn, device]))

  const cropConfigs =
    mapping?.crops ||
    cropDefaults.map((crop, index) => ({
      ...crop,
      greenhouses: devices
        .filter((_, deviceIndex) => deviceIndex % cropDefaults.length === index)
        .slice(0, 3)
        .map((device) => ({
          deviceNo: device.deviceNo || device.sn,
          name: device.deviceName,
          area: device.projectName,
        })),
    }))

  const crops = []
  for (const cropConfig of cropConfigs) {
    const cropDefault = cropDefaults.find((crop) => crop.id === cropConfig.id) || cropDefaults[0]
    const greenhouses = []

    for (const greenhouseConfig of cropConfig.greenhouses || []) {
      const device = byDeviceNo.get(greenhouseConfig.deviceNo) || { deviceNo: greenhouseConfig.deviceNo }
      greenhouses.push(await greenhouseFromDevice(device, greenhouseConfig))
    }

    crops.push({
      ...cropDefault,
      ...cropConfig,
      greenhouses,
    })
  }

  return {
    generatedAt: new Date().toISOString(),
    source: 'youren',
    crops,
  }
}
