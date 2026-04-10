import type { Provider } from '@/types'

export const MODELS: Record<Provider, readonly { id: string; name: string; description: string }[]> = {
  openai: [
    { id: 'gpt-4.1', name: 'GPT-4.1', description: '최신 · 코딩/추론 최강' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini', description: '최신 · 경량 고성능' },
    { id: 'gpt-4o', name: 'GPT-4o', description: '안정 · 멀티모달 강자' },
    { id: 'gpt-4o-mini', name: 'GPT-4o mini', description: '경제적 · 빠른 응답' },
    { id: 'o4-mini', name: 'o4-mini', description: '추론 모델 · 복잡한 문제 해결' },
    { id: 'o3', name: 'o3', description: '최고 추론 · 수학/과학' },
  ],
  anthropic: [
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', description: '최고 지능 · 에이전트/코딩 최강 · 1M 컨텍스트' },
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', description: '속도/지능 균형 · 범용 추천 · 1M 컨텍스트' },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', description: '초고속 · 경량 최신 · 200k 컨텍스트' },
  ],
  google: [
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: '최고 추론 · 복잡한 작업' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: '최적 가성비 · 저지연' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', description: '초경량 · 대용량 처리' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Preview)', description: '차세대 · 프리뷰' },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', description: '초고속 280 tok/s · 오픈소스 강자' },
    { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B', description: '초고속 500 tok/s · 120B 대형' },
    { id: 'openai/gpt-oss-20b', name: 'GPT OSS 20B', description: '최고속 1000 tok/s · 경량' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', description: '최고속 560 tok/s · 즉각 응답' },
    { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout (Preview)', description: '차세대 750 tok/s' },
  ],
  mistral: [
    { id: 'mistral-large-2512', name: 'Mistral Large 3', description: '범용 최고성능 · 멀티모달' },
    { id: 'mistral-medium-2508', name: 'Mistral Medium 3.1', description: '프론티어급 · 균형' },
    { id: 'mistral-small-2603', name: 'Mistral Small 4', description: '추론/코딩 특화 · 경량' },
    { id: 'codestral-2508', name: 'Codestral', description: '코드 완성 전문' },
    { id: 'devstral-2-2512', name: 'Devstral 2', description: '코드 에이전트 최강' },
  ],
} as const

export type ModelId = string
