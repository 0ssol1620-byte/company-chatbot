// @deprecated - LEGACY: This file supports the old team-based routing system at /chat/[teamId]
// New system uses /agents/[id] with user-created agents stored in localStorage
// TODO: Remove when /chat/[teamId] route is cleaned up

import { Provider } from '@/types'

export interface TeamConfig {
  id: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
  provider: Provider;
  model: string;
  systemPrompt: string;
}

export const teams: TeamConfig[] = [
  {
    id: 'engineering',
    name: '개발팀',
    description: '코드 리뷰, 기술 아키텍처, 버그 해결',
    emoji: '⚙️',
    color: 'blue',
    provider: 'openai',
    model: 'gpt-4o',
    systemPrompt: `당신은 개발팀 전용 AI 어시스턴트입니다.
소프트웨어 개발, 코드 리뷰, 기술 아키텍처 설계, 버그 해결에 대한 전문 지식을 제공합니다.
코드 예시는 마크다운 코드 블록으로 작성하고, 항상 한국어로 답변하세요.
불확실한 내용은 추측하지 말고 솔직하게 말씀해 주세요.`,
  },
  {
    id: 'hr',
    name: 'HR팀',
    description: '인사 정책, 복리후생, 휴가 문의',
    emoji: '👥',
    color: 'green',
    provider: 'openai',
    model: 'gpt-4o-mini',
    systemPrompt: `당신은 HR팀 전용 AI 어시스턴트입니다.
인사 정책, 복리후생, 휴가, 채용, 온보딩 관련 질문에 답변합니다.
항상 한국어로 답변하세요.
법률적 해석이 필요한 사안은 반드시 HR 담당자나 법무팀에 확인을 권고하세요.`,
  },
  {
    id: 'sales',
    name: '영업팀',
    description: '영업 전략, 고객 응대, 제품 정보',
    emoji: '📈',
    color: 'orange',
    provider: 'openai',
    model: 'gpt-4o-mini',
    systemPrompt: `당신은 영업팀 전용 AI 어시스턴트입니다.
영업 전략, 고객 응대 방법, 제품 정보, 경쟁사 분석에 대한 도움을 제공합니다.
항상 한국어로 답변하고 긍정적이며 전문적인 톤을 유지하세요.
구체적인 가격이나 계약 조건은 담당 영업 매니저에게 확인을 권고하세요.`,
  },
  {
    id: 'general',
    name: '공용',
    description: '문서 작성, 번역, 일반 업무 지원',
    emoji: '💬',
    color: 'purple',
    provider: 'openai',
    model: 'gpt-4o-mini',
    systemPrompt: `당신은 사내 범용 AI 어시스턴트입니다.
문서 작성, 번역, 데이터 분석, 요약, 아이디어 브레인스토밍 등 일반 업무를 지원합니다.
항상 한국어로 답변하세요. 영어 요청이 들어오면 영어로 답변해도 됩니다.`,
  },
];

export function getTeam(id: string): TeamConfig | undefined {
  return teams.find((t) => t.id === id);
}
