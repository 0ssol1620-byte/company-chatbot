export const MODELS = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', description: '안정적인 멀티모달 강자' },
    { id: 'gpt-4o-mini', name: 'GPT-4o mini', description: '경제적 · 빠른 응답' },
    { id: 'gpt-4.1', name: 'GPT-4.1', description: '최신 · 강력한 코딩/추론' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini', description: '최신 · 경량 고성능' },
    { id: 'o4-mini', name: 'o4-mini', description: '추론 모델 · 고성능' },
  ],
  anthropic: [
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', description: '최신 · 최고 지능' },
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', description: '최신 · 균형 성능' },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', description: '초고속 경량' },
  ],
  google: [
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: '최신 · 최고 성능' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: '최신 · 빠른 고성능' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: '안정 · 빠른 고성능' },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', description: '초고속 · 오픈소스 최강' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', description: '초고속 · 경량' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', description: '초고속 · 균형' },
    { id: 'gemma2-9b-it', name: 'Gemma2 9B', description: '초고속 · Google 경량' },
  ],
  mistral: [
    { id: 'mistral-large-latest', name: 'Mistral Large', description: '최고 성능 · 유럽산' },
    { id: 'mistral-small-latest', name: 'Mistral Small', description: '경제적 · 빠름' },
    { id: 'open-mixtral-8x22b', name: 'Mixtral 8x22B', description: '오픈소스 · 강력' },
    { id: 'codestral-latest', name: 'Codestral', description: '코딩 특화' },
  ],
  ollama: [
    { id: 'llama3.2', name: 'Llama 3.2', description: '로컬 · Meta 최신' },
    { id: 'llama3.1', name: 'Llama 3.1', description: '로컬 · Meta 안정' },
    { id: 'mistral', name: 'Mistral', description: '로컬 · Mistral' },
    { id: 'gemma3', name: 'Gemma 3', description: '로컬 · Google' },
    { id: 'qwen2.5', name: 'Qwen 2.5', description: '로컬 · Alibaba' },
  ],
} as const

export type ModelId = string
