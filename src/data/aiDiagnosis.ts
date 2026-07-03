import { requestForm } from '../api/client'
import type { CropDiagnosisMetric, CropDiagnosisResult, CropId } from '../types'

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

  return requestForm<CropDiagnosisResult>('/api/v1/ai/crop-diagnosis', formData, {
    timeoutMs: 30_000,
  })
}
