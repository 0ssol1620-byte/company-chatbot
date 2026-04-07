import { Room, RoomMessage, ChatUser } from '@/types'

const ROOMS_KEY = 'company-chatbot-rooms'
const USER_KEY = 'company-chatbot-user'

export const USER_EMOJIS = [
  '🐺', '🦊', '🐻', '🐼', '🦁', '🐯',
  '🦅', '🦋', '🐲', '🌟', '⚡', '🔥',
  '🎭', '🎪', '🎨', '🚀', '💎', '🎯',
]

export function getOrCreateUser(): ChatUser {
  if (typeof window === 'undefined') return { name: '', emoji: '👤' }
  try {
    const stored = localStorage.getItem(USER_KEY)
    if (stored) {
      const user = JSON.parse(stored) as ChatUser
      return user
    }
  } catch {}
  return {
    name: '',
    emoji: USER_EMOJIS[Math.floor(Math.random() * USER_EMOJIS.length)],
  }
}

export function saveUser(user: ChatUser): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function getRooms(): Room[] {
  if (typeof window === 'undefined') return []
  try {
    const data = localStorage.getItem(ROOMS_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function getRoom(id: string): Room | null {
  return getRooms().find((r) => r.id === id) ?? null
}

export function saveRoom(room: Room): void {
  const rooms = getRooms()
  const idx = rooms.findIndex((r) => r.id === room.id)
  if (idx === -1) rooms.push(room)
  else rooms[idx] = room
  localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms))
}

export function deleteRoom(id: string): void {
  const rooms = getRooms().filter((r) => r.id !== id)
  localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms))
  localStorage.removeItem(`room-${id}-messages`)
}

export function getRoomMessages(roomId: string): RoomMessage[] {
  if (typeof window === 'undefined') return []
  try {
    const data = localStorage.getItem(`room-${roomId}-messages`)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function addRoomMessage(roomId: string, message: RoomMessage): void {
  const messages = getRoomMessages(roomId)
  messages.push(message)
  // Keep last 500 messages
  if (messages.length > 500) messages.splice(0, messages.length - 500)
  localStorage.setItem(`room-${roomId}-messages`, JSON.stringify(messages))
}

export function updateRoomAgents(roomId: string, agentIds: string[]): void {
  const room = getRoom(roomId)
  if (!room) return
  room.invitedAgentIds = agentIds
  saveRoom(room)
}
