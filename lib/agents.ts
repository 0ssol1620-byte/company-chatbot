import { Agent, getLevelInfo } from '@/types'
export { getLevelInfo, LEVEL_THRESHOLDS } from '@/types'

const KEY = 'company-chatbot-agents'

function readAll(): Agent[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Agent[]) : []
  } catch { return [] }
}

function writeAll(agents: Agent[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(agents)) } catch {}
}

export function getAgents(): Agent[] { return readAll() }

export function getAgent(id: string): Agent | null {
  return readAll().find(a => a.id === id) ?? null
}

export function saveAgent(agent: Agent): void {
  const all = readAll().filter(a => a.id !== agent.id)
  writeAll([...all, agent])
}

export function updateAgent(id: string, updates: Partial<Agent>): void {
  const all = readAll().map(a => a.id === id ? { ...a, ...updates } : a)
  writeAll(all)
}

export function deleteAgent(id: string): void {
  writeAll(readAll().filter(a => a.id !== id))
}

export function incrementMessageCount(id: string): { leveledUp: boolean; newLevel: number } {
  const agents = readAll()
  const idx = agents.findIndex(a => a.id === id)
  if (idx === -1) return { leveledUp: false, newLevel: 1 }
  const oldLevel = agents[idx].level
  const newCount = agents[idx].messageCount + 1
  const { level } = getLevelInfo(newCount)
  agents[idx] = { ...agents[idx], messageCount: newCount, level }
  writeAll(agents)
  return { leveledUp: level > oldLevel, newLevel: level }
}
