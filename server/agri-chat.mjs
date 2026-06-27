import { buildAgriContext, formatAgriContext } from './agri-intelligence.mjs'

const fallbackChat = {
  riskLevel: 'unknown',
  summary: 'AI 暂未返回可解析的冰糖枣顾问回答。',
  likelyCauses: ['当前信息不足，需要结合现场照片、症状部位和近期水肥操作复核。'],
  actions: ['先复核棚内温湿度、土壤湿度、pH 和 EC，再决定是否调整水肥或通风。'],
  watchItems: ['记录症状出现时间、扩展速度和集中部位。'],
  matchedRules: [],
  disclaimer: 'AI 建议仅供参考，病虫害和用药决策需农技人员或现场专家复核。',
}

function readJsonBody(request, maxBytes = 256 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0

    request.on('data', (chunk) => {
      size += chunk.length
      if (size > maxBytes) {
        const error = new Error('请求体超过 256KB 限制')
        error.statusCode = 413
        reject(error)
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8')
        resolve(text ? JSON.parse(text) : {})
      } catch {
        const error = new Error('请求体不是有效 JSON')
        error.statusCode = 400
        reject(error)
      }
    })
    request.on('error', reject)
  })
}

function toText(value, fallback = '') {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map((item) => toText(item)).filter(Boolean).join('，')
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, item]) => {
        const text = toText(item)
        return text ? `${key}：${text}` : ''
      })
      .filter(Boolean)
      .join('，')
  }
  return fallback
}

function normalizeTextList(value, fallback, maxItems = 6) {
  const list = Array.isArray(value) ? value.map((item) => toText(item)).filter(Boolean) : fallback
  return list.length ? list.slice(0, maxItems) : fallback
}

function extractJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('AI 返回内容不是 JSON')
    return JSON.parse(match[0])
  }
}

function normalizeChatResult(value, context) {
  const source = value && typeof value === 'object' ? value : {}
  const riskLevel = ['low', 'medium', 'high', 'unknown'].includes(source.riskLevel) ? source.riskLevel : 'unknown'
  const matchedRulesFallback = context.matchedRules.slice(0, 5).map((rule) => `${rule.title}：${rule.advice}`)

  return {
    riskLevel,
    summary: toText(source.summary, fallbackChat.summary),
    likelyCauses: normalizeTextList(source.likelyCauses, fallbackChat.likelyCauses),
    actions: normalizeTextList(source.actions, fallbackChat.actions),
    watchItems: normalizeTextList(source.watchItems, fallbackChat.watchItems, 5),
    matchedRules: normalizeTextList(source.matchedRules, matchedRulesFallback, 6),
    disclaimer: toText(source.disclaimer, fallbackChat.disclaimer),
  }
}

function buildChatPrompt({ requestBody, context }) {
  return [
    '你是冰糖枣大棚生产顾问，只回答冰糖枣相关问题。',
    '请结合当前棚内传感器指标、冰糖枣知识库和规则命中情况，给出可执行建议。',
    '回答要具体到通风、控湿、灌溉、追肥、补光、巡查或人工复核，不要泛泛而谈。',
    '如果当前指标缺失，要明确说明缺少哪些依据，不能编造数据。',
    '只返回严格 JSON，不要使用 Markdown。',
    'JSON 字段必须为：riskLevel, summary, likelyCauses, actions, watchItems, matchedRules, disclaimer。',
    'riskLevel 只能是 low、medium、high、unknown；likelyCauses/actions/watchItems/matchedRules 必须是中文字符串数组。',
    `用户问题：${requestBody.question}`,
    `作物：${requestBody.cropName || '冰糖枣'}`,
    `大棚：${requestBody.greenhouseName || requestBody.greenhouseId || '未知大棚'}`,
    '',
    formatAgriContext(context),
  ].join('\n')
}

async function callChatModel({ requestBody, context }) {
  const apiKey = process.env.AI_API_KEY
  if (!apiKey) {
    const error = new Error('AI_API_KEY 未配置，无法生成冰糖枣顾问回答')
    error.statusCode = 503
    throw error
  }

  if (!process.env.AI_API_BASE) {
    const error = new Error('AI_API_BASE 未配置，外部集成未启用')
    error.statusCode = 503
    throw error
  }

  const apiBase = process.env.AI_API_BASE.replace(/\/$/, '')
  const model = process.env.AI_MODEL || 'gpt-4o-mini'

  const response = await fetch(`${apiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: buildChatPrompt({ requestBody, context }),
        },
      ],
    }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(payload?.error?.message || `AI 顾问生成失败：${response.status}`)
    error.statusCode = response.status >= 400 && response.status < 500 ? 502 : 500
    throw error
  }

  const content = payload?.choices?.[0]?.message?.content
  if (!content) throw new Error('AI 模型未返回顾问内容')

  return normalizeChatResult(extractJson(content), context)
}

export async function handleAgriChat(request) {
  const requestBody = await readJsonBody(request)
  const question = typeof requestBody.question === 'string' ? requestBody.question.trim() : ''
  if (!question) {
    const error = new Error('请先输入冰糖枣管理问题')
    error.statusCode = 400
    throw error
  }

  if (requestBody.cropId !== 'jujube') {
    const error = new Error('首版农业顾问只支持冰糖枣')
    error.statusCode = 400
    throw error
  }

  const context = buildAgriContext({
    cropId: requestBody.cropId,
    greenhouseId: requestBody.greenhouseId,
    greenhouseName: requestBody.greenhouseName,
    metrics: requestBody.metrics,
  })

  return callChatModel({ requestBody: { ...requestBody, question }, context })
}
