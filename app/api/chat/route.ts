import { streamText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

export const maxDuration = 300

export async function POST(req: Request) {
  const body = await req.json()
  const { messages, agentConfig } = body

  if (!agentConfig) {
    return new Response('agentConfig is required', { status: 400 })
  }

  const { provider, model, apiKey, systemPrompt } = agentConfig

  if (!apiKey) {
    return new Response('API key is required', { status: 400 })
  }

  let aiModel
  try {
    if (provider === 'openai') {
      aiModel = createOpenAI({ apiKey })(model)
    } else if (provider === 'anthropic') {
      aiModel = createAnthropic({ apiKey })(model)
    } else if (provider === 'google') {
      aiModel = createGoogleGenerativeAI({ apiKey })(model)
    } else {
      return new Response(`Unknown provider: ${provider}`, { status: 400 })
    }
  } catch {
    return new Response('Failed to initialize model', { status: 500 })
  }

  const result = streamText({
    model: aiModel,
    system: systemPrompt,
    messages,
  })

  return result.toUIMessageStreamResponse()
}
