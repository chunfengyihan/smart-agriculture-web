import { fetchWithTimeout } from '../lib/http'
import type { AgriChatRequest, AgriChatResponse } from '../types'

export async function askAgriAdvisor(request: AgriChatRequest): Promise<AgriChatResponse> {
  const response = await fetchWithTimeout('/api/ai/agri-chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    timeoutMs: 25_000,
  })

  const payload = (await response.json().catch(() => null)) as { message?: string } | AgriChatResponse | null

  if (!response.ok) {
    throw new Error(payload && 'message' in payload && payload.message ? payload.message : `AI 顾问生成失败：${response.status}`)
  }

  return payload as AgriChatResponse
}
