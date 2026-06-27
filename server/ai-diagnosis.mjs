import {
  buildAgriContext,
  enforceJujubeDiagnosis,
  formatAgriContext,
  normalizeJujubeEnhancedFields,
} from './agri-intelligence.mjs'

const maxImageBytes = 8 * 1024 * 1024
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

const defaultResult = {
  riskLevel: 'unknown',
  hasPestOrDisease: false,
  suspectedIssues: [],
  environmentAssessment: 'AI 未能返回可解析的环境评价。',
  recommendations: ['请重新上传清晰的叶片、果实或茎部图片，并保留当前温湿度数据后再次诊断。'],
  disclaimer: 'AI 诊断仅供参考，严重情况建议人工复核。',
}

function readRequestBody(request, maxBytes = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0

    request.on('data', (chunk) => {
      size += chunk.length
      if (size > maxBytes) {
        reject(new Error('请求体超过 10MB 限制'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
  })
}

function parseContentDisposition(value) {
  const result = {}
  for (const part of value.split(';')) {
    const [rawKey, ...rawValue] = part.trim().split('=')
    if (!rawValue.length) continue
    result[rawKey] = rawValue.join('=').replace(/^"|"$/g, '')
  }
  return result
}

function parseMultipart(body, contentType) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)
  if (!boundaryMatch) throw new Error('缺少 multipart boundary')

  const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`)
  const fields = {}
  const files = {}
  let cursor = body.indexOf(boundary)

  while (cursor !== -1) {
    cursor += boundary.length
    if (body[cursor] === 45 && body[cursor + 1] === 45) break
    if (body[cursor] === 13 && body[cursor + 1] === 10) cursor += 2

    const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), cursor)
    if (headerEnd === -1) break

    const headerText = body.slice(cursor, headerEnd).toString('utf8')
    const headers = Object.fromEntries(
      headerText.split('\r\n').map((line) => {
        const separator = line.indexOf(':')
        return [line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim()]
      }),
    )

    const contentStart = headerEnd + 4
    const nextBoundary = body.indexOf(boundary, contentStart)
    if (nextBoundary === -1) break

    const contentEnd = body[nextBoundary - 2] === 13 && body[nextBoundary - 1] === 10 ? nextBoundary - 2 : nextBoundary
    const content = body.slice(contentStart, contentEnd)
    const disposition = parseContentDisposition(headers['content-disposition'] || '')

    if (disposition.name) {
      if (disposition.filename) {
        files[disposition.name] = {
          filename: disposition.filename,
          contentType: headers['content-type'] || 'application/octet-stream',
          buffer: content,
        }
      } else {
        fields[disposition.name] = content.toString('utf8')
      }
    }

    cursor = nextBoundary
  }

  return { fields, files }
}

function normalizeDiagnosisResult(value, context = null) {
  const source = value && typeof value === 'object' ? value : {}
  const riskLevel = ['low', 'medium', 'high', 'unknown'].includes(source.riskLevel) ? source.riskLevel : 'unknown'
  const toText = (item, fallback = '') => {
    if (item === null || item === undefined || item === '') return fallback
    if (typeof item === 'string') return item
    if (typeof item === 'number' || typeof item === 'boolean') return String(item)
    if (Array.isArray(item)) return item.map((entry) => toText(entry)).filter(Boolean).join('；')
    if (typeof item === 'object') {
      return Object.entries(item)
        .map(([key, entry]) => {
          const text = toText(entry)
          return text ? `${key}：${text}` : ''
        })
        .filter(Boolean)
        .join('；')
    }
    return fallback
  }
  const suspectedIssues = Array.isArray(source.suspectedIssues)
    ? source.suspectedIssues.slice(0, 5).map((issue) => ({
        name: toText(issue?.name, '未命名风险'),
        confidence: Math.max(0, Math.min(1, Number(issue?.confidence ?? 0))),
        evidence: toText(issue?.evidence, '模型未提供图像依据'),
      }))
    : []

  const result = {
    riskLevel,
    hasPestOrDisease: Boolean(source.hasPestOrDisease),
    suspectedIssues,
    environmentAssessment: toText(source.environmentAssessment, defaultResult.environmentAssessment),
    recommendations: Array.isArray(source.recommendations)
      ? source.recommendations.slice(0, 8).map((item) => toText(item)).filter(Boolean)
      : defaultResult.recommendations,
    disclaimer: toText(source.disclaimer, defaultResult.disclaimer),
    ...normalizeJujubeEnhancedFields(source, context),
  }

  return enforceJujubeDiagnosis(result, context)
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

function buildPrompt({ cropName, greenhouseId, metrics, context, useEnvironmentContext }) {
  const basePrompt = [
    '你是智慧农业温室病虫害和环境调控助手。',
    useEnvironmentContext
      ? '请根据作物图片和大棚环境数据，判断是否疑似病虫害、可能类型、图像依据、温湿度是否需要调整，并给出可执行措施。'
      : '请仅根据作物图片和作物知识判断疑似症状、可能原因、处理建议和需要补拍或人工复核的项目；不要编造当前温湿度、EC、pH、光照或 CO2 数据。',
    '只返回严格 JSON，不要使用 Markdown。',
    'JSON 字段必须为：riskLevel, hasPestOrDisease, suspectedIssues, environmentAssessment, recommendations, disclaimer。',
    'environmentAssessment 必须是一个中文字符串，不要返回对象；recommendations 必须是中文字符串数组。',
    `作物：${cropName || '未知作物'}`,
    useEnvironmentContext ? `大棚 ID：${greenhouseId || '未知'}` : '诊断模式：仅图片诊断',
    useEnvironmentContext ? `环境指标：${JSON.stringify(metrics, null, 2)}` : '环境指标：本次未提供，不得作为当前判断依据。',
  ]

  if (!context?.supported) return basePrompt.join('\n')

  return [
    ...basePrompt,
    '',
    formatAgriContext(context),
    '',
    '【冰糖枣诊断要求】',
    useEnvironmentContext
      ? '1. 必须从图像症状、环境异常、冰糖枣管理经验三方面判断。'
      : '1. 必须从图像症状和冰糖枣管理经验两方面判断；环境异常只能作为可能复核方向，不能描述为当前已发生。',
    '2. 如果命中规则与图片症状相关，recommendations 中必须包含对应操作。',
    '3. 不确定时要说明需要补拍叶背、果面、枝条或根区照片，不能编造病名。',
    '4. 额外返回 evidence, matchedRules, confidenceReason, followUpQuestions 字段。',
    '5. evidence、matchedRules、followUpQuestions 都必须是中文字符串数组；confidenceReason 必须是中文字符串。',
  ].join('\n')
}

async function callVisionModel({ image, fields }) {
  const apiKey = process.env.AI_API_KEY
  if (!apiKey) {
    const error = new Error('AI_API_KEY 未配置，无法调用 AI 诊断服务')
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
  const metrics = JSON.parse(fields.metrics || '[]')
  const legacyEnvironmentMode = fields.useEnvironmentContext === undefined && metrics.length > 0
  const useEnvironmentContext = fields.useEnvironmentContext === 'true' || legacyEnvironmentMode
  const context = buildAgriContext({
    cropId: fields.cropId,
    greenhouseId: fields.greenhouseId,
    greenhouseName: fields.greenhouseName,
    metrics,
    useEnvironmentContext,
  })
  const dataUrl = `data:${image.contentType};base64,${image.buffer.toString('base64')}`

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
          content: [
            {
              type: 'text',
              text: buildPrompt({
                cropName: fields.cropName,
                greenhouseId: fields.greenhouseId,
                metrics: useEnvironmentContext ? metrics : [],
                context,
                useEnvironmentContext,
              }),
            },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(payload?.error?.message || `AI 模型调用失败：${response.status}`)
    error.statusCode = response.status >= 400 && response.status < 500 ? 502 : 500
    throw error
  }

  const content = payload?.choices?.[0]?.message?.content
  if (!content) throw new Error('AI 模型未返回诊断内容')

  return normalizeDiagnosisResult(extractJson(content), context)
}

export async function handleCropDiagnosis(request) {
  const contentType = request.headers['content-type'] || ''
  if (!contentType.includes('multipart/form-data')) {
    const error = new Error('请使用 multipart/form-data 上传图片')
    error.statusCode = 400
    throw error
  }

  const body = await readRequestBody(request)
  const { fields, files } = parseMultipart(body, contentType)
  const image = files.image

  if (!image) {
    const error = new Error('请先上传作物图片')
    error.statusCode = 400
    throw error
  }
  if (!allowedImageTypes.has(image.contentType)) {
    const error = new Error('图片格式不支持，请上传 JPG、PNG 或 WebP')
    error.statusCode = 400
    throw error
  }
  if (image.buffer.length > maxImageBytes) {
    const error = new Error('图片超过 8MB 限制')
    error.statusCode = 413
    throw error
  }

  try {
    JSON.parse(fields.metrics || '[]')
  } catch {
    const error = new Error('metrics 字段不是有效 JSON')
    error.statusCode = 400
    throw error
  }

  return callVisionModel({ image, fields })
}
