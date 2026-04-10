import { streamText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

export const maxDuration = 300

const TEXT_MIME_PREFIXES = ['text/', 'application/json', 'application/xml', 'application/markdown']

function extractTextFromDataUrl(dataUrl: string): string | null {
  try {
    const commaIdx = dataUrl.indexOf(',')
    if (commaIdx === -1) return null
    const header = dataUrl.slice(0, commaIdx)
    const base64 = dataUrl.slice(commaIdx + 1)
    const mimeMatch = header.match(/:(.*?);/)
    const mimeType = mimeMatch?.[1] ?? ''
    if (!TEXT_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix))) return null
    return Buffer.from(base64, 'base64').toString('utf-8').slice(0, 50_000)
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  const body = await req.json()
  const { messages, agentConfig } = body

  if (!agentConfig) {
    return new Response('agentConfig is required', { status: 400 })
  }

  const { provider, model, apiKey, systemPrompt, files } = agentConfig

  if (!apiKey) {
    return new Response('API key is required', { status: 400 })
  }

  // Build effective system prompt — append reference file contents
  let effectiveSystemPrompt = systemPrompt ?? ''
  if (Array.isArray(files) && files.length > 0) {
    const fileBlocks: string[] = []
    for (const file of files) {
      if (!file?.blobUrl || !file?.name) continue
      const text = extractTextFromDataUrl(file.blobUrl)
      if (text) {
        fileBlocks.push(`<file name="${file.name}">\n${text}\n</file>`)
      }
    }
    if (fileBlocks.length > 0) {
      effectiveSystemPrompt = `${effectiveSystemPrompt}\n\n## 참고 파일\n\n${fileBlocks.join('\n\n')}`
    }
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
    system: effectiveSystemPrompt,
    messages,
  })

  return result.toUIMessageStreamResponse()
}
