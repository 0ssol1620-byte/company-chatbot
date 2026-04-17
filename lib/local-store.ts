/**
 * local-store.ts
 * Type-safe localStorage wrapper for all game state.
 * Replaces the SQLite database layer.
 */

import type { CharacterAppearance, LegacyCharacterAppearance } from "@/lib/lpc-registry";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LocalCharacter {
  id: string;
  name: string;
  appearance: CharacterAppearance | LegacyCharacterAppearance;
}

export interface LocalAgentConfig {
  provider: "openai" | "anthropic" | "google";
  model: string;
  apiKey: string;
  systemPrompt: string;
  files?: LocalAgentFile[];
}

export interface LocalAgentFile {
  id: string;
  name: string;
  blobUrl: string; // data: URI
  contentType: string;
  size: number;
}

export interface LocalAgent {
  id: string;
  name: string;
  role: string;
  description: string;
  color: string;
  provider: "openai" | "anthropic" | "google";
  model: string;
  apiKey: string;
  systemPrompt: string;
  files: LocalAgentFile[];
  messageCount: number;
  level: number;
  createdAt: string;
}

export interface LocalNpc {
  id: string;
  name: string;
  positionX: number;
  positionY: number;
  direction: string;
  appearance: unknown;
  agentConfig: LocalAgentConfig;
}

export interface LocalTask {
  id: string;
  npcTaskId: string;
  npcId: string;
  npcName: string;
  title: string;
  summary: string | null;
  status: "pending" | "in_progress" | "complete" | "cancelled" | "stalled";
  createdAt: string;
  updatedAt: string;
}

export interface LocalChatMessage {
  role: "player" | "npc";
  content: string;
  timestamp: number;
}

export interface LocalMeetingMinutes {
  id: string;
  topic: string;
  transcript: string;
  participants: Array<{ name: string; type: "npc" | "player" }>;
  createdAt: string;
}

export interface LocalChannel {
  id: string;
  name: string;
  mapData: unknown | null;
  tiledJson: unknown | null;
  mapConfig: { cols?: number; rows?: number; spawnCol?: number; spawnRow?: number } | null;
  mapVersion?: number;
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

const KEYS = {
  CHARACTER: "deskrpg:character",
  CHANNEL: "deskrpg:channel",
  NPCS: "deskrpg:npcs",
  AGENTS: "deskrpg:agents",
  TASKS: "deskrpg:tasks",
  MEETINGS: "deskrpg:meetings",
  PLAYER_POSITION: "deskrpg:player-position",
  npcChat: (npcId: string) => `deskrpg:npc-chat:${npcId}`,
  players: (tabId: string) => `deskrpg:players:${tabId}`,
} as const;

const OFFICE_KEY_PREFIX = "deskrpg:office:";

function encodeOfficeKeyPart(value: string): string {
  return encodeURIComponent(value);
}

const OFFICE_KEYS = {
  channel: (officeId: string) => `${OFFICE_KEY_PREFIX}${encodeOfficeKeyPart(officeId)}:channel`,
  npcs: (officeId: string) => `${OFFICE_KEY_PREFIX}${encodeOfficeKeyPart(officeId)}:npcs`,
  tasks: (officeId: string) => `${OFFICE_KEY_PREFIX}${encodeOfficeKeyPart(officeId)}:tasks`,
  playerPosition: (officeId: string) => `${OFFICE_KEY_PREFIX}${encodeOfficeKeyPart(officeId)}:player-position`,
  npcChat: (officeId: string, npcId: string) => `${OFFICE_KEY_PREFIX}${encodeOfficeKeyPart(officeId)}:npc-chat:${npcId}`,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function get<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function set(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked
  }
}

function remove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Character
// ---------------------------------------------------------------------------

export function getCharacter(): LocalCharacter | null {
  return get<LocalCharacter>(KEYS.CHARACTER);
}

export function saveCharacter(char: LocalCharacter): void {
  set(KEYS.CHARACTER, char);
}

export function clearCharacter(): void {
  remove(KEYS.CHARACTER);
}

// ---------------------------------------------------------------------------
// Channel
// ---------------------------------------------------------------------------

export function getChannel(): LocalChannel | null {
  return get<LocalChannel>(KEYS.CHANNEL);
}

export function saveChannel(channel: LocalChannel): void {
  set(KEYS.CHANNEL, channel);
}

export function getOfficeChannel(officeId: string): LocalChannel | null {
  return get<LocalChannel>(OFFICE_KEYS.channel(officeId));
}

export function saveOfficeChannel(officeId: string, channel: LocalChannel): void {
  set(OFFICE_KEYS.channel(officeId), channel);
}

export function migrateLegacyOfficeStorage(officeId: string): void {
  const legacyChannel = getChannel();
  const legacyNpcs = getNpcs();
  const legacyTasks = getTasks();
  const legacyPlayerPosition = getPlayerPosition();

  if (legacyChannel && !getOfficeChannel(officeId)) {
    saveOfficeChannel(officeId, legacyChannel);
  }
  if (legacyNpcs.length > 0 && getOfficeNpcs(officeId).length === 0) {
    saveOfficeNpcs(officeId, legacyNpcs);
  }
  if (legacyTasks.length > 0 && getOfficeTasks(officeId).length === 0) {
    saveOfficeTasks(officeId, legacyTasks);
  }
  if (legacyPlayerPosition && !getOfficePlayerPosition(officeId)) {
    saveOfficePlayerPosition(officeId, legacyPlayerPosition);
  }
}

// ---------------------------------------------------------------------------
// NPCs
// ---------------------------------------------------------------------------

export function getNpcs(): LocalNpc[] {
  return get<LocalNpc[]>(KEYS.NPCS) ?? [];
}

export function saveNpcs(npcs: LocalNpc[]): void {
  set(KEYS.NPCS, npcs);
}

export function getOfficeNpcs(officeId: string): LocalNpc[] {
  return get<LocalNpc[]>(OFFICE_KEYS.npcs(officeId)) ?? [];
}

export function saveOfficeNpcs(officeId: string, npcs: LocalNpc[]): void {
  set(OFFICE_KEYS.npcs(officeId), npcs);
}

export function addNpc(npc: LocalNpc): void {
  const existing = getNpcs();
  saveNpcs([...existing.filter((n) => n.id !== npc.id), npc]);
}

export function addOfficeNpc(officeId: string, npc: LocalNpc): void {
  const existing = getOfficeNpcs(officeId);
  saveOfficeNpcs(officeId, [...existing.filter((n) => n.id !== npc.id), npc]);
}

export function updateNpc(npcId: string, updates: Partial<LocalNpc>): void {
  const existing = getNpcs();
  saveNpcs(existing.map((n) => (n.id === npcId ? { ...n, ...updates } : n)));
}

export function updateOfficeNpc(officeId: string, npcId: string, updates: Partial<LocalNpc>): void {
  const existing = getOfficeNpcs(officeId);
  saveOfficeNpcs(officeId, existing.map((n) => (n.id === npcId ? { ...n, ...updates } : n)));
}

export function removeNpc(npcId: string): void {
  saveNpcs(getNpcs().filter((n) => n.id !== npcId));
  // Also clear chat history
  remove(KEYS.npcChat(npcId));
}

export function removeOfficeNpc(officeId: string, npcId: string): void {
  saveOfficeNpcs(officeId, getOfficeNpcs(officeId).filter((n) => n.id !== npcId));
  remove(OFFICE_KEYS.npcChat(officeId, npcId));
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export function getAgents(): LocalAgent[] {
  return get<LocalAgent[]>(KEYS.AGENTS) ?? [];
}

export function saveAgents(agents: LocalAgent[]): void {
  set(KEYS.AGENTS, agents);
}

export function getAgent(id: string): LocalAgent | null {
  return getAgents().find((a) => a.id === id) ?? null;
}

export function addAgent(agent: LocalAgent): void {
  const existing = getAgents();
  saveAgents([...existing.filter((a) => a.id !== agent.id), agent]);
}

export function updateAgent(id: string, updates: Partial<LocalAgent>): void {
  saveAgents(getAgents().map((a) => (a.id === id ? { ...a, ...updates } : a)));
}

export function removeAgent(id: string): void {
  saveAgents(getAgents().filter((a) => a.id !== id));
}

// ---------------------------------------------------------------------------
// NPC chat history
// ---------------------------------------------------------------------------

export function getNpcChat(npcId: string): LocalChatMessage[] {
  return get<LocalChatMessage[]>(KEYS.npcChat(npcId)) ?? [];
}

export function appendNpcChat(npcId: string, message: LocalChatMessage): void {
  const history = getNpcChat(npcId);
  const next = [...history, message];
  // Keep last 40 messages per NPC
  set(KEYS.npcChat(npcId), next.slice(-40));
}

export function clearNpcChat(npcId: string): void {
  remove(KEYS.npcChat(npcId));
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export function getTasks(): LocalTask[] {
  return get<LocalTask[]>(KEYS.TASKS) ?? [];
}

export function saveTasks(tasks: LocalTask[]): void {
  set(KEYS.TASKS, tasks);
}

export function getOfficeTasks(officeId: string): LocalTask[] {
  return get<LocalTask[]>(OFFICE_KEYS.tasks(officeId)) ?? [];
}

export function saveOfficeTasks(officeId: string, tasks: LocalTask[]): void {
  set(OFFICE_KEYS.tasks(officeId), tasks);
}

export function upsertTask(task: LocalTask): void {
  const existing = getTasks();
  const idx = existing.findIndex((t) => t.id === task.id);
  if (idx >= 0) {
    existing[idx] = task;
    saveTasks(existing);
  } else {
    saveTasks([task, ...existing]);
  }
}

export function upsertOfficeTask(officeId: string, task: LocalTask): void {
  const existing = getOfficeTasks(officeId);
  const idx = existing.findIndex((t) => t.id === task.id);
  if (idx >= 0) {
    existing[idx] = task;
    saveOfficeTasks(officeId, existing);
  } else {
    saveOfficeTasks(officeId, [task, ...existing]);
  }
}

export function removeTask(taskId: string): void {
  saveTasks(getTasks().filter((t) => t.id !== taskId));
}

export function removeOfficeTask(officeId: string, taskId: string): void {
  saveOfficeTasks(officeId, getOfficeTasks(officeId).filter((t) => t.id !== taskId));
}

export function removeTasksForNpc(npcId: string): void {
  saveTasks(getTasks().filter((t) => t.npcId !== npcId));
}

export function removeOfficeTasksForNpc(officeId: string, npcId: string): void {
  saveOfficeTasks(officeId, getOfficeTasks(officeId).filter((t) => t.npcId !== npcId));
}

// ---------------------------------------------------------------------------
// Meeting minutes
// ---------------------------------------------------------------------------

export function getMeetings(): LocalMeetingMinutes[] {
  return get<LocalMeetingMinutes[]>(KEYS.MEETINGS) ?? [];
}

export function addMeeting(minutes: LocalMeetingMinutes): void {
  const existing = getMeetings();
  set(KEYS.MEETINGS, [minutes, ...existing].slice(0, 50));
}

// ---------------------------------------------------------------------------
// Player position (saved across sessions)
// ---------------------------------------------------------------------------

export function getPlayerPosition(): { x: number; y: number } | null {
  return get<{ x: number; y: number }>(KEYS.PLAYER_POSITION);
}

export function savePlayerPosition(pos: { x: number; y: number }): void {
  set(KEYS.PLAYER_POSITION, pos);
}

export function getOfficePlayerPosition(officeId: string): { x: number; y: number } | null {
  return get<{ x: number; y: number }>(OFFICE_KEYS.playerPosition(officeId));
}

export function saveOfficePlayerPosition(officeId: string, pos: { x: number; y: number }): void {
  set(OFFICE_KEYS.playerPosition(officeId), pos);
}
