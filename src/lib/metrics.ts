import type { CropDiagnosisMetric, Greenhouse, MetricKey } from '../types'

const diagnosisMetricKeys: MetricKey[] = [
  'airTemp',
  'airHumidity',
  'soilTemp',
  'soilHumidity',
  'ph',
  'ec',
  'light',
  'co2',
]

export type DiagnosisMetricDraft = CropDiagnosisMetric & {
  inputValue: string
}

function buildMetricSnapshot(greenhouse: Greenhouse, key: MetricKey): CropDiagnosisMetric {
  const metric = greenhouse.metrics.find((item) => item.key === key)

  return {
    key,
    label: metric?.label || key,
    value: metric?.value ?? null,
    unit: metric?.unit || '',
    target: metric?.target || '-',
  }
}

export function buildDiagnosisMetrics(greenhouse: Greenhouse): DiagnosisMetricDraft[] {
  return diagnosisMetricKeys.map((key) => {
    const metric = buildMetricSnapshot(greenhouse, key)

    return {
      ...metric,
      inputValue: metric.value === null ? '' : String(metric.value),
    }
  })
}

export function buildWeatherMetrics(greenhouse: Greenhouse): CropDiagnosisMetric[] {
  return diagnosisMetricKeys.map((key) => buildMetricSnapshot(greenhouse, key))
}
