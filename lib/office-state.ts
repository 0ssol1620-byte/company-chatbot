import type { PendingChannelData } from "@/game/EventBus";
import type { LocalChannel, LocalNpc, LocalTask } from "./local-store";
import type { PlayerOfficeRecord } from "./office-registry";

export const OFFICE_MAP_VERSION = 2;
export const DEFAULT_OFFICE_NAME_FALLBACK = "Office";
export const DEFAULT_OFFICE_MAP_CONFIG = { spawnCol: 10, spawnRow: 7 };

export interface OfficeRuntimeState {
  officeId: string;
  officeName: string;
  ownerPlayerId: string;
  ownerPlayerName: string;
  isVisiting: boolean;
  isOwner: boolean;
}

export interface OfficeSnapshotSeed {
  officeId: string;
  officeName: string;
  ownerPlayerId: string;
  ownerPlayerName: string;
  channel: LocalChannel | null;
  npcs: LocalNpc[];
  tasks: LocalTask[];
  savedPosition: { x: number; y: number } | null;
}

export function getOfficeIdForPlayer(playerId: string): string {
  return `office:${playerId}`;
}

export function getDefaultOfficeName(playerName: string): string {
  return `${playerName}'s Office`;
}

export function buildOfficeRuntimeState(input: {
  officeId: string;
  officeName?: string | null;
  ownerPlayerId: string;
  ownerPlayerName?: string | null;
  currentPlayerId: string;
  currentPlayerName?: string | null;
}): OfficeRuntimeState {
  const isOwner = input.ownerPlayerId === input.currentPlayerId;
  return {
    officeId: input.officeId,
    officeName: input.officeName?.trim() || (isOwner
      ? getDefaultOfficeName(input.currentPlayerName?.trim() || DEFAULT_OFFICE_NAME_FALLBACK)
      : DEFAULT_OFFICE_NAME_FALLBACK),
    ownerPlayerId: input.ownerPlayerId,
    ownerPlayerName: input.ownerPlayerName?.trim() || (isOwner
      ? input.currentPlayerName?.trim() || DEFAULT_OFFICE_NAME_FALLBACK
      : DEFAULT_OFFICE_NAME_FALLBACK),
    isVisiting: !isOwner,
    isOwner,
  };
}

export function buildPendingOfficeChannelData(input: {
  officeId: string;
  channel: LocalChannel | null;
  savedPosition?: { x: number; y: number } | null;
}): PendingChannelData {
  const mapData = input.channel?.mapData ?? null;
  const mapConfig = input.channel?.mapConfig ?? DEFAULT_OFFICE_MAP_CONFIG;

  return {
    channelId: input.officeId,
    mapData,
    tiledJson: (mapData as Record<string, unknown> | null)?.tiledJson as object | undefined,
    mapConfig,
    savedPosition: input.savedPosition ?? null,
    reportWaitSeconds: 20,
  };
}

export function buildPlayerOfficeRecord(seed: OfficeSnapshotSeed): PlayerOfficeRecord {
  return {
    office_id: seed.officeId,
    owner_player_id: seed.ownerPlayerId,
    office_name: seed.officeName,
    map_data: seed.channel?.mapData ?? null,
    map_config: seed.channel?.mapConfig ?? null,
    npcs: seed.npcs,
  };
}

export function buildOfficeSnapshotSeedFromRecord(input: {
  office: PlayerOfficeRecord;
  ownerPlayerName: string;
  tasks?: LocalTask[];
  savedPosition?: { x: number; y: number } | null;
}): OfficeSnapshotSeed {
  const mapData = input.office.map_data as LocalChannel["mapData"];
  const mapConfig = (input.office.map_config as LocalChannel["mapConfig"]) ?? DEFAULT_OFFICE_MAP_CONFIG;

  return {
    officeId: input.office.office_id,
    officeName: input.office.office_name,
    ownerPlayerId: input.office.owner_player_id,
    ownerPlayerName: input.ownerPlayerName,
    channel: {
      id: input.office.office_id,
      name: input.office.office_name,
      mapData,
      tiledJson: (mapData as Record<string, unknown> | null)?.tiledJson ?? null,
      mapConfig,
      mapVersion: OFFICE_MAP_VERSION,
    },
    npcs: (input.office.npcs as LocalNpc[] | null) ?? [],
    tasks: input.tasks ?? [],
    savedPosition: input.savedPosition ?? null,
  };
}
