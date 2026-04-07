import { streamText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

export const maxDuration = 300

export async function POST(req: Request) {
  const { messages, agentConfig } = await req.json()
  const { provider, model, apiKey, systemPrompt } = agentConfig

  if (!apiKey) {
    return new Response('API key is required', { status: 400 })
  }

  let aiModel
  if (provider === 'openai') {
    aiModel = createOpenAI({ apiKey })(model)
  } else if (provider === 'anthropic') {
    aiModel = createAnthropic({ apiKey })(model)
  } else if (provider === 'google') {
    aiModel = createGoogleGenerativeAI({ apiKey })(model)
  } else {
    return new Response('Unknown provider', { status: 400 })
  }

  const roomSystem =
    systemPrompt +
    '\n\n이것은 팀 채팅방입니다. 여러 사용자가 참여 중입니다. 대화 맥락을 파악하고 명확하고 간결하게 답변하세요.'

  const result = streamText({
    model: aiModel,
    system: roomSystem,
    messages,
  })

  return result.toTextStreamResponse()
}
