import type { Crop, DashboardData, MetricKey, MetricReading, TrendPoint } from '../types'

const metricMeta: Record<MetricKey, { label: string; unit: string; target: string }> = {
  airTemp: { label: '空气温度', unit: '°C', target: '18-28°C' },
  airHumidity: { label: '空气湿度', unit: '%', target: '55-80%' },
  light: { label: '光照强度', unit: 'lux', target: '12k-38k' },
  co2: { label: 'CO2', unit: 'ppm', target: '420-900' },
  soilHumidity: { label: '土壤湿度', unit: '%', target: '45-70%' },
  soilTemp: { label: '土壤温度', unit: '°C', target: '16-25°C' },
  ec: { label: '土壤 EC', unit: 'mS/cm', target: '0.8-1.8' },
  ph: { label: '土壤 PH', unit: '', target: '5.8-7.2' },
}

const makeMetric = (
  key: MetricKey,
  value: number,
  status: MetricReading['status'] = 'normal',
): MetricReading => ({
  key,
  label: metricMeta[key].label,
  value,
  unit: metricMeta[key].unit,
  status,
  target: metricMeta[key].target,
})

const makeTrend = (baseTemp: number, baseHumidity: number, baseSoil: number): TrendPoint[] =>
  Array.from({ length: 24 }, (_, index) => {
    const hour = index.toString().padStart(2, '0')
    const rhythm = Math.sin((index / 24) * Math.PI * 2)
    return {
      time: `${hour}:00`,
      airTemp: Number((baseTemp + rhythm * 3 + (index % 3) * 0.4).toFixed(1)),
      airHumidity: Math.round(baseHumidity - rhythm * 7 + (index % 4)),
      soilHumidity: Math.round(baseSoil + Math.cos(index / 4) * 4),
      light: Math.max(0, Math.round(18000 + rhythm * 15000 + (index % 5) * 900)),
    }
  })

const crops: Crop[] = [
  {
    id: 'jujube',
    name: '冰糖枣',
    latinName: 'Crystal Jujube',
    description: '水肥一体化管理，重点监测昼夜温差、土壤墒情与光照积累。',
    heroImage: '/images/jujube-hero.jpg',
    accent: '#16a34a',
    greenhouses: [
      {
        id: 'jujube-a01',
        name: '冰糖枣 A01 棚',
        area: '北区 01',
        status: 'online',
        onlineDevices: 18,
        totalDevices: 18,
        metrics: [
          makeMetric('airTemp', 24.6),
          makeMetric('airHumidity', 68),
          makeMetric('light', 28600),
          makeMetric('co2', 612),
          makeMetric('soilHumidity', 59),
          makeMetric('soilTemp', 21.4),
          makeMetric('ec', 1.22),
          makeMetric('ph', 6.6),
        ],
        trend: makeTrend(24, 67, 58),
        alerts: [{ id: 'a1', level: 'notice', message: '今日光照累计接近目标值。', time: '14:20' }],
      },
      {
        id: 'jujube-b03',
        name: '冰糖枣 B03 棚',
        area: '北区 03',
        status: 'warning',
        onlineDevices: 16,
        totalDevices: 18,
        metrics: [
          makeMetric('airTemp', 29.2, 'warning'),
          makeMetric('airHumidity', 62),
          makeMetric('light', 31400),
          makeMetric('co2', 704),
          makeMetric('soilHumidity', 43, 'warning'),
          makeMetric('soilTemp', 23.1),
          makeMetric('ec', 1.48),
          makeMetric('ph', 6.8),
        ],
        trend: makeTrend(27, 62, 46),
        alerts: [
          { id: 'a2', level: 'warning', message: '土壤湿度低于目标下限，建议检查滴灌计划。', time: '15:05' },
          { id: 'a3', level: 'notice', message: '2 台采集器超过 10 分钟未上报。', time: '15:12' },
        ],
      },
    ],
  },
  {
    id: 'blueberry',
    name: '蓝莓',
    latinName: 'Blueberry',
    description: '偏酸性基质栽培，重点关注 PH、EC、空气湿度和根区温度。',
    heroImage: '/images/blueberry-hero.jpg',
    accent: '#2563eb',
    greenhouses: [
      {
        id: 'blueberry-c02',
        name: '蓝莓 C02 棚',
        area: '东区 02',
        status: 'online',
        onlineDevices: 21,
        totalDevices: 21,
        metrics: [
          makeMetric('airTemp', 22.8),
          makeMetric('airHumidity', 74),
          makeMetric('light', 21800),
          makeMetric('co2', 558),
          makeMetric('soilHumidity', 63),
          makeMetric('soilTemp', 19.7),
          makeMetric('ec', 1.05),
          makeMetric('ph', 5.4, 'warning'),
        ],
        trend: makeTrend(22, 73, 62),
        alerts: [{ id: 'b1', level: 'warning', message: 'PH 接近蓝莓酸度下限，建议复核传感器。', time: '13:44' }],
      },
      {
        id: 'blueberry-c05',
        name: '蓝莓 C05 棚',
        area: '东区 05',
        status: 'online',
        onlineDevices: 19,
        totalDevices: 20,
        metrics: [
          makeMetric('airTemp', 23.5),
          makeMetric('airHumidity', 71),
          makeMetric('light', 23600),
          makeMetric('co2', 588),
          makeMetric('soilHumidity', 61),
          makeMetric('soilTemp', 20.2),
          makeMetric('ec', 1.17),
          makeMetric('ph', 5.8),
        ],
        trend: makeTrend(23, 71, 60),
        alerts: [{ id: 'b2', level: 'notice', message: '风机运行时长高于昨日均值。', time: '12:18' }],
      },
    ],
  },
  {
    id: 'cherry',
    name: '樱桃',
    latinName: 'Cherry',
    description: '精细化控温控湿，保障花果期稳定环境和病害风险预警。',
    heroImage: '/images/cherry-hero.jpg',
    accent: '#dc2626',
    greenhouses: [
      {
        id: 'cherry-d01',
        name: '樱桃 D01 棚',
        area: '南区 01',
        status: 'warning',
        onlineDevices: 24,
        totalDevices: 25,
        metrics: [
          makeMetric('airTemp', 20.9),
          makeMetric('airHumidity', 84, 'warning'),
          makeMetric('light', 17600),
          makeMetric('co2', 535),
          makeMetric('soilHumidity', 66),
          makeMetric('soilTemp', 18.6),
          makeMetric('ec', 1.31),
          makeMetric('ph', 6.4),
        ],
        trend: makeTrend(21, 80, 65),
        alerts: [{ id: 'c1', level: 'warning', message: '空气湿度持续偏高，注意通风除湿。', time: '14:56' }],
      },
      {
        id: 'cherry-d04',
        name: '樱桃 D04 棚',
        area: '南区 04',
        status: 'offline',
        onlineDevices: 20,
        totalDevices: 24,
        metrics: [
          makeMetric('airTemp', 19.8),
          makeMetric('airHumidity', 76),
          makeMetric('light', 16400),
          makeMetric('co2', 492),
          makeMetric('soilHumidity', 58),
          makeMetric('soilTemp', 17.9),
          makeMetric('ec', 1.2),
          makeMetric('ph', 6.5),
        ],
        trend: makeTrend(20, 75, 58),
        alerts: [
          { id: 'c2', level: 'critical', message: '4 台设备离线，请检查网关或供电。', time: '15:22' },
        ],
      },
    ],
  },
]

export const createMockDashboard = (): DashboardData => ({
  generatedAt: new Date().toISOString(),
  source: 'mock',
  crops,
})
