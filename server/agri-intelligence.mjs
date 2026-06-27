const metricLabels = {
  airTemp: '空气温度',
  airHumidity: '空气湿度',
  light: '光照强度',
  co2: 'CO2',
  soilHumidity: '土壤湿度',
  soilTemp: '土壤温度',
  ec: '土壤 EC',
  ph: '土壤 pH',
}

const jujubeKnowledge = {
  cropId: 'jujube',
  cropName: '冰糖枣',
  positioning:
    '冰糖枣大棚管理应优先稳定昼夜温差、控制棚内高湿、保持土壤见干见湿，并把坐果、膨果、裂果和叶片异常与温湿度、水肥、光照联动判断。',
  environmentTargets: {
    airTemp: '日间 22-30°C，夜间 12-18°C；连续高于 32°C 或低于 10°C 需重点关注。',
    airHumidity: '开花坐果期宜 50-70%，果实膨大期宜 55-75%；连续高于 85% 易诱发病害和授粉受阻。',
    soilTemp: '根区 16-25°C 较稳；低于 12°C 根系吸收弱，高于 28°C 容易闷根。',
    soilHumidity: '保持 45-70%，避免忽干忽湿；过湿易闷根，过干易落果或裂果风险上升。',
    light: '白天需充足散射光，弱光会影响花芽、坐果和糖分积累；强光高温时注意遮阳降温。',
    co2: '白天通风前后宜维持约 420-900 ppm；过低说明通风强或补碳不足，过高需排查通风。',
    ph: '根区 pH 约 6.0-7.5；长期偏酸或偏碱都会影响钙、铁、镁等吸收。',
    ec: '土壤 EC 约 0.8-1.8 mS/cm；过高有盐害风险，过低说明肥力供应不足或淋失。',
  },
  commonIssues: [
    {
      name: '叶片发黄',
      clues: '新叶发黄多关注铁、镁等元素吸收和 pH；老叶发黄多关注氮镁不足、根系弱或长期阴湿。',
      actions: '先复核 pH、EC、土壤湿度和根系状态，再少量多次补肥，避免一次性重肥。',
    },
    {
      name: '叶片卷曲',
      clues: '常与高温强光、根区缺水、虫害或药害有关；若伴随黏液、虫体或畸形新梢，需人工查虫。',
      actions: '优先查叶背和新梢，结合温湿度调整通风、遮阳和灌溉。',
    },
    {
      name: '落花落果',
      clues: '常见诱因包括花期高湿、温度突变、授粉差、树势弱、水肥波动或光照不足。',
      actions: '稳定温湿度和土壤水分，避免大水大肥，连续记录落果位置和比例。',
    },
    {
      name: '裂果',
      clues: '多与膨果期水分剧烈波动、湿度过高、钙供应不足或昼夜温差异常有关。',
      actions: '保持土壤水分平稳，雨后或高湿期加强排湿，必要时复核钙镁供应。',
    },
    {
      name: '果面病斑',
      clues: '若有褐斑、霉层、软腐或扩展性病斑，通常与高湿、通风差和病原侵染风险相关。',
      actions: '隔离标记病果，降低棚内湿度，采样给农技人员复核后再决定用药。',
    },
    {
      name: '长势弱',
      clues: '可能来自根区过湿、低温、盐分累积、肥力不足、弱光或负载过高。',
      actions: '先排查根区温湿度、EC、pH 和光照，再调整负载、水肥和通风。',
    },
    {
      name: '虫害可疑',
      clues: '叶片缺刻、卷叶、畸形新梢、虫粪、蜜露或叶背活动虫体都需要人工确认。',
      actions: '上传叶背和新梢近照，设置黄板或人工巡查，不凭单张远景直接用药。',
    },
    {
      name: '水肥失衡',
      clues: 'EC 偏高、土壤过湿或过干、叶色异常和新梢生长异常同时出现时优先考虑。',
      actions: '采用小水勤浇、少量多次追肥，并在 24-48 小时内复查 EC 和土壤湿度。',
    },
  ],
}

const jujubeRules = [
  { id: 'air-temp-high-critical', metric: 'airTemp', level: 'high', when: (v) => v > 35, title: '棚温严重偏高', advice: '立即加强通风、遮阳和雾化降温，避免花果灼伤和落果。' },
  { id: 'air-temp-high', metric: 'airTemp', level: 'medium', when: (v) => v > 32, title: '棚温偏高', advice: '增加通风频次，避开高温时段大水大肥，观察叶片萎蔫和卷曲。' },
  { id: 'air-temp-low-critical', metric: 'airTemp', level: 'high', when: (v) => v < 6, title: '棚温严重偏低', advice: '夜间保温并检查加温或覆盖措施，低温会削弱根系吸收和坐果。' },
  { id: 'air-temp-low', metric: 'airTemp', level: 'medium', when: (v) => v < 10, title: '棚温偏低', advice: '减少冷风直吹，上午升温后再逐步通风。' },
  { id: 'air-humidity-critical', metric: 'airHumidity', level: 'high', when: (v) => v > 90, title: '空气湿度过高', advice: '优先排湿和通风，重点巡查果面病斑、霉层和花期授粉情况。' },
  { id: 'air-humidity-high', metric: 'airHumidity', level: 'medium', when: (v) => v > 85, title: '空气湿度偏高', advice: '避免傍晚大水灌溉，通风排湿后再关闭棚膜。' },
  { id: 'air-humidity-low', metric: 'airHumidity', level: 'medium', when: (v) => v < 35, title: '空气湿度偏低', advice: '关注新梢失水和叶缘焦枯，必要时微喷增湿但避免叶面长期带水。' },
  { id: 'soil-humidity-critical-high', metric: 'soilHumidity', level: 'high', when: (v) => v > 82, title: '土壤湿度过高', advice: '暂停灌溉并加强通风，排查排水和根区闷根风险。' },
  { id: 'soil-humidity-high', metric: 'soilHumidity', level: 'medium', when: (v) => v > 72, title: '土壤湿度偏高', advice: '延后灌水，观察叶片发黄、长势弱和根系缺氧信号。' },
  { id: 'soil-humidity-critical-low', metric: 'soilHumidity', level: 'high', when: (v) => v < 30, title: '土壤明显偏干', advice: '分次补水，避免一次大水造成膨果期裂果或根区波动。' },
  { id: 'soil-humidity-low', metric: 'soilHumidity', level: 'medium', when: (v) => v < 38, title: '土壤湿度偏低', advice: '小水勤浇并复查滴灌均匀性，关注落果和叶片卷曲。' },
  { id: 'soil-temp-high', metric: 'soilTemp', level: 'medium', when: (v) => v > 28, title: '根区温度偏高', advice: '降低棚温和地表温度，避免根系活力下降。' },
  { id: 'soil-temp-low', metric: 'soilTemp', level: 'medium', when: (v) => v < 12, title: '根区温度偏低', advice: '提高根区温度后再追肥，低温下肥料吸收效率低。' },
  { id: 'ph-high', metric: 'ph', level: 'medium', when: (v) => v > 7.8, title: 'pH 偏碱', advice: '复核水源和基质 pH，关注新叶黄化和铁锌等元素吸收障碍。' },
  { id: 'ph-low', metric: 'ph', level: 'medium', when: (v) => v < 5.6, title: 'pH 偏酸', advice: '避免继续施用酸性肥，复核根区酸化和根系受损风险。' },
  { id: 'ec-critical-high', metric: 'ec', level: 'high', when: (v) => v > 2.4, title: 'EC 明显偏高', advice: '警惕盐害和烧根，暂停高浓度追肥，必要时分次淋洗。' },
  { id: 'ec-high', metric: 'ec', level: 'medium', when: (v) => v > 1.8, title: 'EC 偏高', advice: '降低追肥浓度，观察叶缘焦枯、根系弱和果实膨大受阻。' },
  { id: 'ec-low', metric: 'ec', level: 'medium', when: (v) => v < 0.6, title: 'EC 偏低', advice: '结合树势少量多次补肥，避免在根区低温或过湿时追肥。' },
  { id: 'light-low-day', metric: 'light', level: 'medium', when: (v) => v > 0 && v < 8000, title: '白天光照偏弱', advice: '清洁棚膜、调整遮挡，弱光会影响坐果、糖分和枝条充实。' },
  { id: 'light-too-strong', metric: 'light', level: 'medium', when: (v) => v > 45000, title: '光照过强', advice: '若伴随高温，应短时遮阳降温，防止叶片灼伤和果面日灼。' },
  { id: 'co2-low', metric: 'co2', level: 'medium', when: (v) => v > 0 && v < 350, title: 'CO2 偏低', advice: '强通风后注意光合效率下降，必要时优化通风节奏。' },
  { id: 'co2-high', metric: 'co2', level: 'medium', when: (v) => v > 1200, title: 'CO2 偏高', advice: '检查通风和人员安全，避免密闭时间过长。' },
  { id: 'hot-and-dry', level: 'high', whenAll: ({ airTemp, airHumidity, soilHumidity }) => airTemp > 32 && airHumidity < 40 && soilHumidity < 40, title: '高温低湿叠加缺水', advice: '优先降温和分次补水，重点观察叶片卷曲、萎蔫和落果。' },
  { id: 'humid-and-wet-root', level: 'high', whenAll: ({ airHumidity, soilHumidity }) => airHumidity > 85 && soilHumidity > 72, title: '高湿叠加根区偏湿', advice: '病害和闷根风险同步上升，先排湿控水，再巡查果面和根系。' },
]

function toFiniteNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function normalizeMetric(metric) {
  const key = typeof metric?.key === 'string' ? metric.key : ''
  if (!key) return null
  const value = metric.value === null || metric.value === undefined || metric.value === '' ? null : toFiniteNumber(metric.value)
  return {
    key,
    label: metric.label || metricLabels[key] || key,
    value,
    unit: metric.unit || '',
    target: metric.target || '',
  }
}

export function normalizeMetrics(metrics) {
  return Array.isArray(metrics) ? metrics.map(normalizeMetric).filter(Boolean) : []
}

function metricMap(metrics) {
  return Object.fromEntries(metrics.map((metric) => [metric.key, metric.value]))
}

function describeMetric(metric) {
  const value = metric.value === null ? '缺失' : `${metric.value}${metric.unit || ''}`
  const target = metric.target ? `，目标 ${metric.target}` : ''
  return `${metric.label}：${value}${target}`
}

function riskWeight(level) {
  if (level === 'high') return 3
  if (level === 'medium') return 2
  if (level === 'low') return 1
  return 0
}

export function buildAgriContext({ cropId, greenhouseId, greenhouseName, metrics, useEnvironmentContext = true }) {
  const normalizedMetrics = useEnvironmentContext ? normalizeMetrics(metrics) : []
  if (cropId !== 'jujube') {
    return {
      supported: false,
      cropId,
      greenhouseId,
      greenhouseName,
      environmentContextUsed: Boolean(useEnvironmentContext),
      metrics: normalizedMetrics,
      metricSummary: {
        current: normalizedMetrics.map(describeMetric),
        missing: [],
      },
      matchedRules: [],
      knowledge: null,
    }
  }

  const values = metricMap(normalizedMetrics)
  const singleMetricRules = jujubeRules
    .filter((rule) => rule.metric)
    .map((rule) => {
      const value = values[rule.metric]
      if (typeof value !== 'number' || !rule.when(value)) return null
      return {
        id: rule.id,
        level: rule.level,
        title: rule.title,
        metric: rule.metric,
        value,
        advice: rule.advice,
      }
    })
    .filter(Boolean)

  const compoundRules = jujubeRules
    .filter((rule) => rule.whenAll)
    .map((rule) => {
      if (!rule.whenAll(values)) return null
      return {
        id: rule.id,
        level: rule.level,
        title: rule.title,
        advice: rule.advice,
      }
    })
    .filter(Boolean)

  const matchedRules = [...singleMetricRules, ...compoundRules].sort((a, b) => riskWeight(b.level) - riskWeight(a.level))
  const missing = Object.keys(metricLabels).filter((key) => !normalizedMetrics.some((metric) => metric.key === key && metric.value !== null))

  return {
    supported: true,
    cropId,
    greenhouseId,
    greenhouseName,
    environmentContextUsed: Boolean(useEnvironmentContext),
    metrics: normalizedMetrics,
    metricSummary: {
      current: normalizedMetrics.map(describeMetric),
      missing: missing.map((key) => metricLabels[key] || key),
      highlights: matchedRules.slice(0, 6).map((rule) => `${rule.title}：${rule.advice}`),
    },
    matchedRules,
    knowledge: jujubeKnowledge,
  }
}

export function formatAgriContext(context) {
  if (!context?.supported) return ''

  const lines = [
    '【冰糖枣专用知识库】',
    context.knowledge.positioning,
    '适宜环境：',
    ...Object.entries(context.knowledge.environmentTargets).map(([key, value]) => `- ${metricLabels[key] || key}：${value}`),
    '常见问题和处理：',
    ...context.knowledge.commonIssues.map((issue) => `- ${issue.name}：症状线索：${issue.clues}；处理：${issue.actions}`),
  ]

  if (!context.environmentContextUsed) {
    return [
      ...lines,
      '本次诊断模式：仅图片诊断，未使用当前棚内传感器数据；不要把环境阈值当作当前实测异常。',
    ].join('\n')
  }

  return [
    ...lines,
    '当前棚内指标摘要：',
    ...(context.metricSummary.current.length ? context.metricSummary.current.map((item) => `- ${item}`) : ['- 暂无有效传感器指标']),
    context.metricSummary.missing.length ? `缺失指标：${context.metricSummary.missing.join('、')}` : '缺失指标：无',
    '规则命中：',
    ...(context.matchedRules.length
      ? context.matchedRules.slice(0, 8).map((rule) => `- [${rule.level}] ${rule.title}：${rule.advice}`)
      : ['- 未命中明显环境风险规则']),
  ].join('\n')
}

export function normalizeJujubeEnhancedFields(source, context) {
  const matchedRules = Array.isArray(source?.matchedRules)
    ? source.matchedRules.map((item) => String(item)).filter(Boolean).slice(0, 8)
    : []
  const ruleTexts = context?.matchedRules?.slice(0, 5).map((rule) => `${rule.title}：${rule.advice}`) || []
  const evidence = Array.isArray(source?.evidence)
    ? source.evidence.map((item) => String(item)).filter(Boolean).slice(0, 8)
    : []
  const followUpQuestions = Array.isArray(source?.followUpQuestions)
    ? source.followUpQuestions.map((item) => String(item)).filter(Boolean).slice(0, 5)
    : []

  return {
    evidence,
    matchedRules: matchedRules.length ? matchedRules : ruleTexts,
    confidenceReason: typeof source?.confidenceReason === 'string' ? source.confidenceReason : '',
    followUpQuestions,
  }
}

export function enforceJujubeDiagnosis(result, context) {
  if (!context?.supported) return result
  const hasHighRule = context.matchedRules.some((rule) => rule.level === 'high')
  const hasMediumRule = context.matchedRules.some((rule) => rule.level === 'medium')
  const nextResult = { ...result }

  if (hasHighRule && (nextResult.riskLevel === 'low' || nextResult.riskLevel === 'unknown')) {
    nextResult.riskLevel = 'medium'
  } else if (hasMediumRule && nextResult.riskLevel === 'low') {
    nextResult.riskLevel = 'medium'
  }

  const ruleRecommendations = context.matchedRules.slice(0, 4).map((rule) => `${rule.title}：${rule.advice}`)
  const existing = new Set(nextResult.recommendations)
  nextResult.recommendations = [
    ...nextResult.recommendations,
    ...ruleRecommendations.filter((item) => !existing.has(item)),
  ].slice(0, 8)

  nextResult.matchedRules = nextResult.matchedRules?.length ? nextResult.matchedRules : ruleRecommendations
  if (!nextResult.confidenceReason) {
    nextResult.confidenceReason = context.environmentContextUsed
      ? '已结合冰糖枣知识库、当前棚内指标和规则命中结果；单张图片无法替代现场复核。'
      : '已结合图片可见症状和冰糖枣知识库；本次未使用当前棚内传感器数据，环境诱因需要另行复核。'
  }
  if (!nextResult.followUpQuestions?.length) {
    nextResult.followUpQuestions = ['症状最早出现时间是什么时候？', '异常主要在新叶、老叶、果面还是枝条？', '最近 3 天是否有灌水、追肥或打药？']
  }

  return nextResult
}
