import type { CropDiagnosisMetric, CropDiagnosisResult, CropId } from '../types'
import { fetchWithTimeout } from '../lib/http'

interface CropDiagnosisRequest {
  image: File
  cropId: CropId
  cropName: string
  greenhouseId: string
  greenhouseName?: string
  metrics?: CropDiagnosisMetric[]
  useEnvironmentContext?: boolean
}

export async function diagnoseCrop(request: CropDiagnosisRequest): Promise<CropDiagnosisResult> {
  const formData = new FormData()
  formData.append('image', request.image)
  formData.append('cropId', request.cropId)
  formData.append('cropName', request.cropName)
  formData.append('greenhouseId', request.greenhouseId)
  if (request.greenhouseName) formData.append('greenhouseName', request.greenhouseName)
  formData.append('useEnvironmentContext', request.useEnvironmentContext ? 'true' : 'false')
  formData.append('metrics', JSON.stringify(request.useEnvironmentContext ? request.metrics || [] : []))

  const response = await fetchWithTimeout('/api/ai/crop-diagnosis', {
    method: 'POST',
    body: formData,
    timeoutMs: 30_000,
  })

  const payload = (await response.json().catch(() => null)) as { message?: string } | CropDiagnosisResult | null

  if (!response.ok) {
    throw new Error(payload && 'message' in payload && payload.message ? payload.message : `AI 诊断失败：${response.status}`)
  }

  return payload as CropDiagnosisResult
}
