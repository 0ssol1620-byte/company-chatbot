import type { Provider } from '@/types'

export const MODELS: Record<Provider, readonly { id: string; name: string; description: string }[]> = {
  openai: [
    { id: 'gpt-4.1', name: 'GPT-4.1', description: '최신 · 코딩/추론 최강' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini', description: '최신 · 경량 고성능' },
    { id: 'gpt-4.1-nano', name: 'GPT-4.1 nano', description: '최신 · 초경량 최저비용' },
    { id: 'gpt-4o', name: 'GPT-4o', description: '안정 · 멀티모달 강자' },
    { id: 'gpt-4o-mini', name: 'GPT-4o mini', description: '경제적 · 빠른 응답' },
    { id: 'o3', name: 'o3', description: '최고 추론 · 수학/과학' },
    { id: 'o4-mini', name: 'o4-mini', description: '추론 모델 · 복잡한 문제 해결' },
  ],
  anthropic: [
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', description: '최고 지능 · 에이전트/코딩 최강' },
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', description: '속도/지능 균형 · 범용 추천' },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', description: '초고속 · 경량 최신' },
  ],
  google: [
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: '최고 추론 · 복잡한 작업' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: '최적 가성비 · 저지연' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', description: '초경량 · 대용량 처리' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: '안정 · 범용' },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', description: '초저비용 · 고속' },
  ],
} as const

export type ModelId = string
