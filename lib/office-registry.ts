import { supabase } from './supabase'

export interface PlayerOfficeRecord {
  office_id: string
  owner_player_id: string
  office_name: string
  map_data: unknown | null
  map_config: unknown | null
  npcs: unknown[] | null
  updated_at?: string
}

const LOCAL_FALLBACK_KEY_PREFIX = 'deskrpg:office-snapshot:'

function getLocalFallbackKey(officeId: string): string {
  return `${LOCAL_FALLBACK_KEY_PREFIX}${officeId}`
}

function readLocalOfficeSnapshot(officeId: string): PlayerOfficeRecord | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(getLocalFallbackKey(officeId))
    return raw ? (JSON.parse(raw) as PlayerOfficeRecord) : null
  } catch {
    return null
  }
}

function writeLocalOfficeSnapshot(office: PlayerOfficeRecord): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(getLocalFallbackKey(office.office_id), JSON.stringify(office))
  } catch {
    // ignore storage failures
  }
}

/**
 * Persist a player's office snapshot.
 * Requires a `player_offices` Supabase table for cross-device persistence.
 * Falls back to localStorage when the table is not available yet.
 */
export async function upsertPlayerOffice(office: PlayerOfficeRecord): Promise<void> {
  writeLocalOfficeSnapshot(office)
  try {
    await supabase.from('player_offices').upsert({
      office_id: office.office_id,
      owner_player_id: office.owner_player_id,
      office_name: office.office_name,
      map_data: office.map_data,
      map_config: office.map_config,
      npcs: office.npcs,
      updated_at: new Date().toISOString(),
    })
  } catch {
    // graceful fallback to local-only persistence
  }
}

/** Load an office snapshot by office id. */
export async function getPlayerOffice(officeId: string): Promise<PlayerOfficeRecord | null> {
  try {
    const { data } = await supabase
      .from('player_offices')
      .select('*')
      .eq('office_id', officeId)
      .single()
    if (data) {
      writeLocalOfficeSnapshot(data as PlayerOfficeRecord)
      return data as PlayerOfficeRecord
    }
  } catch {
    // fall through to local fallback
  }
  return readLocalOfficeSnapshot(officeId)
}

/** Load an office snapshot by owner player id. */
export async function getPlayerOfficeByOwner(ownerPlayerId: string): Promise<PlayerOfficeRecord | null> {
  try {
    const { data } = await supabase
      .from('player_offices')
      .select('*')
      .eq('owner_player_id', ownerPlayerId)
      .single()
    if (data) {
      writeLocalOfficeSnapshot(data as PlayerOfficeRecord)
      return data as PlayerOfficeRecord
    }
  } catch {
    // fall through to local fallback via registry-driven office_id lookup elsewhere
  }
  return null
}
