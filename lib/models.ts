export const MODELS = {
  openai: [
    { id: 'gpt-5.4', name: 'GPT-5.4', description: '최신 · 가장 강력한 플래그십' },
    { id: 'gpt-5.4-mini', name: 'GPT-5.4 mini', description: '최신 · 경량 고성능' },
    { id: 'gpt-5.4-nano', name: 'GPT-5.4 nano', description: '최신 · 초경량 초고속' },
    { id: 'gpt-4o', name: 'GPT-4o', description: '안정적인 멀티모달 강자' },
    { id: 'gpt-4o-mini', name: 'GPT-4o mini', description: '경제적 · 빠른 응답' },
  ],
  anthropic: [
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', description: '최신 · 최고 지능' },
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', description: '최신 · 균형 성능' },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', description: '초고속 경량' },
  ],
  google: [
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: '최신 · 최고 성능' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: '최신 · 빠른 고성능' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', description: '최신 · 경량 경제적' },
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (Preview)', description: '차세대 · 프리뷰' },
  ],
} as const

export type ModelId = (typeof MODELS)[keyof typeof MODELS][number]['id']
