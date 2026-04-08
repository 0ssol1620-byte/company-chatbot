export type OfficerType = 'developer' | 'marketer' | 'analyst' | 'planner' | 'hr' | 'sales'
export type AvatarType = OfficerType  // backward compat alias
export type Provider = 'openai' | 'anthropic' | 'google'

export interface AgentFile {
  id: string
  name: string
  blobUrl: string
  contentType: string
  size: number
}

export interface Agent {
  id: string
  name: string
  role: string
  description: string
  avatar: OfficerType
  color: string
  provider: Provider
  model: string
  apiKey: string
  systemPrompt: string
  files: AgentFile[]
  messageCount: number
  level: number
  createdAt: string
}

export interface Room {
  id: string
  name: string
  description: string
  invitedAgentIds: string[]
  createdAt: string
}

export interface RoomMessage {
  id: string
  roomId: string
  type: 'user' | 'agent' | 'system'
  content: string
  userName?: string
  userEmoji?: string
  agentId?: string
  agentName?: string
  agentAvatar?: OfficerType
  agentColor?: string
  agentRole?: string
  timestamp: string
}

export interface ChatUser {
  name: string
  emoji: string
}

export const LEVEL_THRESHOLDS = [0, 10, 30, 60, 100] as const

export function getLevelInfo(messageCount: number): { level: number; title: string; next: number; progress: number } {
  const titles = ['신입', '숙련', '전문가', '고수', '마스터']
  let level = 0
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (messageCount >= LEVEL_THRESHOLDS[i]) { level = i; break }
  }
  const current = LEVEL_THRESHOLDS[level]
  const next = LEVEL_THRESHOLDS[level + 1] ?? LEVEL_THRESHOLDS[level]
  const progress = level >= 4 ? 100 : Math.floor(((messageCount - current) / (next - current)) * 100)
  return { level: level + 1, title: titles[level], next, progress }
}
