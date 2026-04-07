export const MODELS = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', description: '가장 강력한 멀티모달 모델' },
    { id: 'gpt-4o-mini', name: 'GPT-4o mini', description: '빠르고 경제적' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: '고성능 추론' },
    { id: 'o1-mini', name: 'o1 mini', description: '고급 추론' },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', description: '균형잡힌 성능' },
    { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', description: '최고 성능' },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku', description: '초고속 경량' },
  ],
  google: [
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: '대용량 컨텍스트' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: '빠른 응답' },
  ],
} as const

export type ModelId = (typeof MODELS)[keyof typeof MODELS][number]['id']
