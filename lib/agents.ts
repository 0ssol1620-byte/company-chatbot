import { Agent } from '@/types'

const STORAGE_KEY = 'company-chatbot-agents'

function computeLevel(messageCount: number): number {
  if (messageCount >= 100) return 5
  if (messageCount >= 60) return 4
  if (messageCount >= 30) return 3
  if (messageCount >= 10) return 2
  return 1
}

export function getAgents(): Agent[] {
  if (typeof window === 'undefined') return []
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function getAgent(id: string): Agent | null {
  const agents = getAgents()
  return agents.find((a) => a.id === id) ?? null
}

export function saveAgent(agent: Agent): void {
  const agents = getAgents()
  agents.push(agent)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(agents))
}

export function updateAgent(id: string, updates: Partial<Agent>): void {
  const agents = getAgents()
  const index = agents.findIndex((a) => a.id === id)
  if (index === -1) return
  agents[index] = { ...agents[index], ...updates }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(agents))
}

export function deleteAgent(id: string): void {
  const agents = getAgents().filter((a) => a.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(agents))
}

export function incrementMessageCount(id: string): { leveled: boolean; newLevel: number } {
  const agents = getAgents()
  const index = agents.findIndex((a) => a.id === id)
  if (index === -1) return { leveled: false, newLevel: 1 }

  const agent = agents[index]
  const oldLevel = agent.level
  agent.messageCount += 1
  agent.level = computeLevel(agent.messageCount)
  agents[index] = agent
  localStorage.setItem(STORAGE_KEY, JSON.stringify(agents))

  return { leveled: agent.level > oldLevel, newLevel: agent.level }
}

export const LEVEL_NAMES = ['', '신입', '숙련', '전문가', '고수', '마스터']
