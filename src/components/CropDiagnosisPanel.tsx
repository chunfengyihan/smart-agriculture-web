import { useEffect, useState } from 'react'
import { Camera } from 'lucide-react'
import { diagnoseCrop } from '../data/aiDiagnosis'
import { displayText, riskLabel } from '../lib/formatters'
import { buildDiagnosisMetrics, type DiagnosisMetricDraft } from '../lib/metrics'
import type { Crop, CropDiagnosisResult, Greenhouse } from '../types'

const maxDiagnosisImageBytes = 8 * 1024 * 1024
const diagnosisImageTypes = ['image/jpeg', 'image/png', 'image/webp']

export default function CropDiagnosisPanel({ crop, greenhouse }: { crop: Crop; greenhouse: Greenhouse }) {
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [metricDrafts, setMetricDrafts] = useState<DiagnosisMetricDraft[]>(() => buildDiagnosisMetrics(greenhouse))
  const [useEnvironmentContext, setUseEnvironmentContext] = useState(false)
  const [diagnosis, setDiagnosis] = useState<CropDiagnosisResult | null>(null)
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null)
  const [diagnosing, setDiagnosing] = useState(false)

  function resetImage() {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(null)
    setImagePreview('')
  }

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  function onImageChange(file: File | undefined) {
    setDiagnosis(null)
    setDiagnosisError(null)

    if (!file) return
    if (!diagnosisImageTypes.includes(file.type)) {
      resetImage()
      setDiagnosisError('图片格式不支持，请上传 JPG、PNG 或 WebP。')
      return
    }
    if (file.size > maxDiagnosisImageBytes) {
      resetImage()
      setDiagnosisError('图片超过 8MB 限制，请压缩后再上传。')
      return
    }

    resetImage()
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function clearImage() {
    resetImage()
    setDiagnosis(null)
    setDiagnosisError(null)
  }

  async function submitDiagnosis() {
    if (!imageFile) {
      setDiagnosisError('请先上传作物图片。')
      return
    }

    setDiagnosing(true)
    setDiagnosisError(null)
    setDiagnosis(null)

    try {
      const metrics = useEnvironmentContext
        ? metricDrafts.map(({ inputValue, ...metric }) => {
            const parsedValue = inputValue.trim() === '' ? null : Number(inputValue)
            return {
              ...metric,
              value: parsedValue !== null && Number.isFinite(parsedValue) ? parsedValue : null,
            }
          })
        : []
      setDiagnosis(
        await diagnoseCrop({
          image: imageFile,
          cropId: crop.id,
          cropName: crop.name,
          greenhouseId: greenhouse.id,
          greenhouseName: greenhouse.name,
          metrics,
          useEnvironmentContext,
        }),
      )
    } catch (submitError) {
      setDiagnosisError(submitError instanceof Error ? submitError.message : 'AI 诊断失败，请稍后重试。')
    } finally {
      setDiagnosing(false)
    }
  }

  return (
    <article className="diagnosis-panel">
      <div className="section-heading diagnosis-heading">
        <div>
          <p>AI crop diagnosis</p>
          <h2>上传图片诊断疑似症状。</h2>
        </div>
        <span className="diagnosis-badge">
          <Camera size={16} />
          图片诊断
        </span>
      </div>

      <div className="diagnosis-layout">
        <div className="diagnosis-upload">
          {imagePreview ? (
            <div className="diagnosis-preview">
              <img src={imagePreview} alt="待诊断作物" />
              <button type="button" onClick={clearImage}>
                移除图片
              </button>
            </div>
          ) : (
            <label className="diagnosis-dropzone">
              <Camera size={28} />
              <strong>上传叶片、果实或茎部图片</strong>
              <span>JPG / PNG / WebP，单张不超过 8MB</span>
              <input
                type="file"
                accept={diagnosisImageTypes.join(',')}
                onChange={(event) => onImageChange(event.target.files?.[0])}
              />
            </label>
          )}
        </div>

        <div className="diagnosis-controls">
          <label className="diagnosis-env-toggle">
            <input
              type="checkbox"
              checked={useEnvironmentContext}
              onChange={(event) => {
                setUseEnvironmentContext(event.target.checked)
                setDiagnosis(null)
                setDiagnosisError(null)
              }}
            />
            <span>
              <strong>结合当前环境数据</strong>
              <small>关闭时只根据图片和作物知识给出疑似症状、处理建议和复查项。</small>
            </span>
          </label>

          {useEnvironmentContext && (
            <div className="diagnosis-metrics">
              {metricDrafts.map((metric) => (
                <label key={metric.key}>
                  <span>
                    {metric.label}
                    {metric.unit ? ` (${metric.unit})` : ''}
                  </span>
                  <input
                    type="number"
                    value={metric.inputValue}
                    placeholder={metric.target}
                    onChange={(event) =>
                      setMetricDrafts((current) =>
                        current.map((item) =>
                          item.key === metric.key ? { ...item, inputValue: event.target.value } : item,
                        ),
                      )
                    }
                  />
                </label>
              ))}
            </div>
          )}

          <button
            className="diagnosis-submit"
            type="button"
            disabled={diagnosing || !imageFile}
            onClick={() => void submitDiagnosis()}
          >
            {diagnosing ? '诊断中...' : useEnvironmentContext ? '开始综合诊断' : '开始图片诊断'}
          </button>

          {diagnosisError && <div className="diagnosis-error">{diagnosisError}</div>}
        </div>
      </div>

      {diagnosis && (
        <div className={`diagnosis-result ${diagnosis.riskLevel}`}>
          <div className="diagnosis-result-top">
            <strong>{riskLabel(diagnosis.riskLevel)}</strong>
            <span>{diagnosis.hasPestOrDisease ? '疑似存在病虫害' : '未发现明确病虫害'}</span>
          </div>

          <div className="diagnosis-result-grid">
            <section>
              <h3>疑似问题</h3>
              {diagnosis.suspectedIssues.length > 0 ? (
                diagnosis.suspectedIssues.map((issue) => (
                  <div className="diagnosis-issue" key={`${issue.name}-${issue.confidence}`}>
                    <strong>{issue.name}</strong>
                    <span>{Math.round(issue.confidence * 100)}%</span>
                    <p>{issue.evidence}</p>
                  </div>
                ))
              ) : (
                <p>模型未识别出明确病虫害类型。</p>
              )}
            </section>

            <section>
              <h3>环境评价</h3>
              <p>{displayText(diagnosis.environmentAssessment)}</p>
            </section>

            <section>
              <h3>调整措施</h3>
              <ul>
                {diagnosis.recommendations.map((recommendation) => (
                  <li key={displayText(recommendation)}>{displayText(recommendation)}</li>
                ))}
              </ul>
            </section>
          </div>

          {(diagnosis.evidence?.length ||
            diagnosis.matchedRules?.length ||
            diagnosis.confidenceReason ||
            diagnosis.followUpQuestions?.length) && (
            <div className="diagnosis-evidence-grid">
              {diagnosis.evidence && diagnosis.evidence.length > 0 && (
                <section>
                  <h3>判断依据</h3>
                  <ul>
                    {diagnosis.evidence.map((item) => (
                      <li key={displayText(item)}>{displayText(item)}</li>
                    ))}
                  </ul>
                </section>
              )}

              {diagnosis.matchedRules && diagnosis.matchedRules.length > 0 && (
                <section>
                  <h3>规则命中</h3>
                  <ul>
                    {diagnosis.matchedRules.map((item) => (
                      <li key={displayText(item)}>{displayText(item)}</li>
                    ))}
                  </ul>
                </section>
              )}

              {(diagnosis.confidenceReason || diagnosis.followUpQuestions?.length) && (
                <section>
                  <h3>复核建议</h3>
                  {diagnosis.confidenceReason && <p>{displayText(diagnosis.confidenceReason)}</p>}
                  {diagnosis.followUpQuestions && diagnosis.followUpQuestions.length > 0 && (
                    <ul>
                      {diagnosis.followUpQuestions.map((item) => (
                        <li key={displayText(item)}>{displayText(item)}</li>
                      ))}
                    </ul>
                  )}
                </section>
              )}
            </div>
          )}

          <small>{diagnosis.disclaimer}</small>
        </div>
      )}
    </article>
  )
}
