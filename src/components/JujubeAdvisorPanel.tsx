import { useMemo, useState } from 'react'
import { MessageCircle, RefreshCw } from 'lucide-react'
import { askAgriAdvisor } from '../data/agriChat'
import { displayText, riskLabel } from '../lib/formatters'
import { buildWeatherMetrics } from '../lib/metrics'
import type { AgriChatResponse, Crop, Greenhouse } from '../types'

const sampleQuestions = [
  '当前环境下冰糖枣是否需要通风排湿？',
  '叶片发黄应该优先排查什么？',
  '膨果期怎么降低裂果风险？',
]

export default function JujubeAdvisorPanel({ crop, greenhouse }: { crop: Crop; greenhouse: Greenhouse }) {
  const [question, setQuestion] = useState(sampleQuestions[0])
  const [answer, setAnswer] = useState<AgriChatResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const metrics = useMemo(() => buildWeatherMetrics(greenhouse), [greenhouse])

  async function submitQuestion(nextQuestion = question) {
    const trimmedQuestion = nextQuestion.trim()
    if (!trimmedQuestion) {
      setError('请先输入冰糖枣管理问题。')
      return
    }

    setQuestion(trimmedQuestion)
    setLoading(true)
    setError(null)
    setAnswer(null)

    try {
      setAnswer(
        await askAgriAdvisor({
          cropId: crop.id,
          cropName: crop.name,
          greenhouseId: greenhouse.id,
          greenhouseName: greenhouse.name,
          metrics,
          question: trimmedQuestion,
        }),
      )
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '冰糖枣顾问生成失败，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <article className="jujube-advisor-panel">
      <div className="section-heading diagnosis-heading">
        <div>
          <p>Jujube advisor</p>
          <h2>冰糖枣专用问答顾问</h2>
        </div>
        <span className="diagnosis-badge">
          <MessageCircle size={16} />
          知识库 + 规则
        </span>
      </div>

      <div className="advisor-question-row">
        <textarea
          value={question}
          rows={3}
          onChange={(event) => {
            setQuestion(event.target.value)
            setError(null)
          }}
          placeholder="输入冰糖枣管理问题，例如叶片发黄、落果、裂果、湿度偏高、土壤水分异常..."
        />
        <button type="button" onClick={() => void submitQuestion()} disabled={loading}>
          <RefreshCw className={loading ? 'spinning' : ''} size={15} />
          {loading ? '生成中' : '询问顾问'}
        </button>
      </div>

      <div className="advisor-samples" aria-label="冰糖枣顾问示例问题">
        {sampleQuestions.map((item) => (
          <button key={item} type="button" onClick={() => void submitQuestion(item)} disabled={loading}>
            {item}
          </button>
        ))}
      </div>

      {error && <div className="diagnosis-error">{error}</div>}

      {answer && (
        <div className={`advisor-result ${answer.riskLevel}`}>
          <div className="weather-advice-top">
            <strong>{riskLabel(answer.riskLevel)}</strong>
            <span>{displayText(answer.summary)}</span>
          </div>

          <div className="weather-advice-grid">
            <section>
              <h3>可能原因</h3>
              <ul>
                {answer.likelyCauses.map((item) => (
                  <li key={displayText(item)}>{displayText(item)}</li>
                ))}
              </ul>
            </section>
            <section>
              <h3>操作建议</h3>
              <ul>
                {answer.actions.map((item) => (
                  <li key={displayText(item)}>{displayText(item)}</li>
                ))}
              </ul>
            </section>
            <section>
              <h3>重点观察</h3>
              <ul>
                {answer.watchItems.map((item) => (
                  <li key={displayText(item)}>{displayText(item)}</li>
                ))}
              </ul>
            </section>
            {answer.matchedRules.length > 0 && (
              <section>
                <h3>规则命中</h3>
                <ul>
                  {answer.matchedRules.map((item) => (
                    <li key={displayText(item)}>{displayText(item)}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <small>{answer.disclaimer}</small>
        </div>
      )}
    </article>
  )
}
