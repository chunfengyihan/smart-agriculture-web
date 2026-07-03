import { requestJson } from '../api/client'
import type { AgriChatRequest, AgriChatResponse } from '../types'

export async function askAgriAdvisor(request: AgriChatRequest): Promise<AgriChatResponse> {
  return requestJson<AgriChatResponse>('/api/v1/ai/agri-chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    timeoutMs: 25_000,
  })
}
