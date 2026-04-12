import { supabase } from './supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

type Listener = (data: unknown) => void

export interface PlayerPresence {
  playerId: string
  name: string
  appearance: unknown
  position?: { x: number; y: number }
}

export class SupabaseMultiplayer {
  private channel: RealtimeChannel
  private listeners = new Map<string, Set<Listener>>()
  readonly playerId: string

  constructor(playerId: string, channelName = 'office-default') {
    this.playerId = playerId
    this.channel = supabase.channel(channelName, {
      config: { presence: { key: playerId } }
    })

    // All broadcast events → dispatch to listeners
    this.channel.on('broadcast', { event: '*' }, ({ event, payload }) => {
      // Ignore own broadcasts (already applied locally)
      if ((payload as { _from?: string })?._from === playerId) return
      this.dispatch(event, payload)
    })

    // Presence join
    this.channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      if (key === playerId) return
      this.dispatch('player:joined', { playerId: key, ...(newPresences[0] as object) })
    })

    // Presence leave
    this.channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      if (key === playerId) return
      this.dispatch('player:left', { playerId: key, ...(leftPresences[0] as object) })
    })

    // Presence sync (full state)
    this.channel.on('presence', { event: 'sync' }, () => {
      const state = this.channel.presenceState<PlayerPresence>()
      this.dispatch('presence:sync', state)
    })
  }

  async subscribe(initialPresence: PlayerPresence): Promise<void> {
    return new Promise((resolve) => {
      this.channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await this.channel.track(initialPresence)
          resolve()
        }
      })
    })
  }

  on(event: string, cb: Listener): this {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(cb)
    return this
  }

  off(event: string, cb: Listener): this {
    this.listeners.get(event)?.delete(cb)
    return this
  }

  private dispatch(event: string, data: unknown) {
    this.listeners.get(event)?.forEach(fn => fn(data))
  }

  async emit(event: string, data: Record<string, unknown>): Promise<void> {
    await this.channel.send({
      type: 'broadcast',
      event,
      payload: { ...data, _from: this.playerId }
    })
  }

  async updatePresence(update: Partial<PlayerPresence>): Promise<void> {
    await this.channel.track(update)
  }

  getOnlinePlayers(): Record<string, PlayerPresence[]> {
    return this.channel.presenceState<PlayerPresence>()
  }

  disconnect(): void {
    supabase.removeChannel(this.channel)
  }
}
