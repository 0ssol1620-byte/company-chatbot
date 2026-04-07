export type AvatarType = 'warrior' | 'mage' | 'archer' | 'healer' | 'rogue' | 'bard'
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
  avatar: AvatarType
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

export interface RoomMessage {
  id: string
  roomId: string
  type: 'user' | 'agent' | 'system'
  content: string
  userName?: string
  userEmoji?: string
  agentId?: string
  agentName?: string
  agentAvatar?: AvatarType
  agentColor?: string
  agentRole?: string
  timestamp: string
}

export interface Room {
  id: string
  name: string
  description: string
  invitedAgentIds: string[]
  createdAt: string
}

export interface ChatUser {
  name: string
  emoji: string
}
