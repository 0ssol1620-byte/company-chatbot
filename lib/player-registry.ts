/**
 * player-registry.ts
 * Supabase-backed registry of all known players + async offline messaging.
 *
 * Required Supabase tables — run once in the Supabase SQL editor:
 * ----------------------------------------------------------------
 * create table if not exists public.player_registry (
 *   id text primary key,
 *   name text not null,
 *   appearance jsonb,
 *   last_position jsonb,
 *   last_seen timestamptz default now()
 * );
 * alter table public.player_registry enable row level security;
 * create policy "allow_all" on public.player_registry for all to anon using (true) with check (true);
 *
 * create table if not exists public.offline_messages (
 *   id uuid primary key default gen_random_uuid(),
 *   to_player_id text not null,
 *   from_player_id text not null,
 *   from_player_name text not null,
 *   content text not null,
 *   read boolean default false,
 *   created_at timestamptz default now()
 * );
 * alter table public.offline_messages enable row level security;
 * create policy "allow_all" on public.offline_messages for all to anon using (true) with check (true);
 * ----------------------------------------------------------------
 */

import { supabase } from './supabase'

export interface PlayerRecord {
  id: string
  name: string
  appearance: unknown
  last_position: { x: number; y: number } | null
  last_seen: string
}

export interface OfflineMessage {
  id: string
  to_player_id: string
  from_player_id: string
  from_player_name: string
  content: string
  read: boolean
  created_at: string
}

/** Register or refresh the current player. Call on app init. */
export async function upsertPlayer(player: {
  id: string
  name: string
  appearance: unknown
  last_position?: { x: number; y: number } | null
}): Promise<void> {
  try {
    await supabase.from('player_registry').upsert({
      id: player.id,
      name: player.name,
      appearance: player.appearance,
      last_position: player.last_position ?? null,
      last_seen: new Date().toISOString(),
    })
  } catch { /* graceful degrade if table doesn't exist yet */ }
}

/** Update last known world position. Caller should throttle calls. */
export async function updatePlayerPosition(id: string, x: number, y: number): Promise<void> {
  try {
    await supabase.from('player_registry')
      .update({ last_position: { x, y }, last_seen: new Date().toISOString() })
      .eq('id', id)
  } catch { /* ignore */ }
}

/** Return all registered players from the last 30 days. */
export async function getAllPlayers(): Promise<PlayerRecord[]> {
  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('player_registry')
      .select('*')
      .gte('last_seen', cutoff)
      .order('last_seen', { ascending: false })
    return data ?? []
  } catch {
    return []
  }
}

/**
 * Return all registered players whose IDs are NOT in `onlineIds`.
 * Shows who is currently offline.
 */
export async function getOfflinePlayers(onlineIds: string[]): Promise<PlayerRecord[]> {
  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    const { data } = await supabase
      .from('player_registry')
      .select('*')
      .gte('last_seen', cutoff)
      .order('last_seen', { ascending: false })
    if (!data) return []
    return onlineIds.length > 0
      ? data.filter(p => !onlineIds.includes(p.id))
      : data
  } catch {
    return []
  }
}

/** Send a message to an offline player. */
export async function sendOfflineMessage(msg: {
  toPlayerId: string
  fromPlayerId: string
  fromPlayerName: string
  content: string
}): Promise<boolean> {
  try {
    const { error } = await supabase.from('offline_messages').insert({
      to_player_id: msg.toPlayerId,
      from_player_id: msg.fromPlayerId,
      from_player_name: msg.fromPlayerName,
      content: msg.content,
    })
    return !error
  } catch {
    return false
  }
}

/** Fetch unread messages addressed to `playerId`. */
export async function getUnreadMessages(playerId: string): Promise<OfflineMessage[]> {
  try {
    const { data } = await supabase
      .from('offline_messages')
      .select('*')
      .eq('to_player_id', playerId)
      .eq('read', false)
      .order('created_at', { ascending: true })
    return data ?? []
  } catch {
    return []
  }
}

/** Mark messages as read by ID list. */
export async function markMessagesRead(messageIds: string[]): Promise<void> {
  if (!messageIds.length) return
  try {
    await supabase.from('offline_messages').update({ read: true }).in('id', messageIds)
  } catch { /* ignore */ }
}
