/**
 * npc-memory.ts
 * Per-NPC memory system — AI SaaS Chatbot Memory Architecture.
 *
 * Three-layer memory:
 *   1. SOUL.md     — NPC persona / system prompt (agentConfig.systemPrompt)
 *   2. MEMORY.md   — Long-term facts extracted by the LLM (permanent until cleared)
 *   3. USER.md     — User profile: preferences, name, recurring patterns
 *   4. Short-term  — Daily conversation key-points (kept 7 days)
 *
 * Storage strategy:
 *   - localStorage   → fast local access (primary read path)
 *   - /api/agent-memory → server-side sync (survives browser clears, cross-device)
 *
 * Context builder injects all layers into every /api/chat request.
 * Memory extraction runs as a background fire-and-forget after each NPC response.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LongTermFact {
  content: string;
  createdAt: string; // ISO date
}

export interface UserProfileEntry {
  key: string;   // e.g. "name", "preference", "goal"
  value: string;
  updatedAt: string;
}

export interface ShortTermEntry {
  content: string;
  createdAt: string; // ISO date
}

export interface NpcMemory {
  longTerm: LongTermFact[];
  shortTerm: Record<string, ShortTermEntry[]>; // key: YYYY-MM-DD
  userProfile: UserProfileEntry[];
}

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const memoryKey = (npcId: string) => `deskrpg:npc-memory:${npcId}`;

// ---------------------------------------------------------------------------
// CRUD helpers
// ---------------------------------------------------------------------------

function readMemory(npcId: string): NpcMemory {
  if (typeof window === "undefined") return emptyMemory();
  try {
    const raw = localStorage.getItem(memoryKey(npcId));
    return raw ? (JSON.parse(raw) as NpcMemory) : emptyMemory();
  } catch {
    return emptyMemory();
  }
}

function writeMemory(npcId: string, memory: NpcMemory): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(memoryKey(npcId), JSON.stringify(memory));
  } catch {
    // Storage full — prune oldest short-term entries and retry
    pruneOldShortTerm(memory);
    try {
      localStorage.setItem(memoryKey(npcId), JSON.stringify(memory));
    } catch { /* give up */ }
  }
}

function emptyMemory(): NpcMemory {
  return { longTerm: [], shortTerm: {}, userProfile: [] };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Remove short-term entries older than 7 days */
function pruneOldShortTerm(memory: NpcMemory): void {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  for (const date of Object.keys(memory.shortTerm)) {
    if (date < cutoffStr) {
      delete memory.shortTerm[date];
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getNpcMemory(npcId: string): NpcMemory {
  const memory = readMemory(npcId);
  pruneOldShortTerm(memory);
  return memory;
}

export function appendLongTermFact(npcId: string, content: string): void {
  const memory = readMemory(npcId);
  const isDuplicate = memory.longTerm.some(
    (f) => f.content.trim().toLowerCase() === content.trim().toLowerCase(),
  );
  if (!isDuplicate) {
    memory.longTerm.push({ content, createdAt: new Date().toISOString() });
    if (memory.longTerm.length > 100) {
      memory.longTerm = memory.longTerm.slice(-100);
    }
    writeMemory(npcId, memory);
    syncMemoryToServer(npcId, { longTerm: [content] });
  }
}

export function upsertUserProfile(npcId: string, key: string, value: string): void {
  const memory = readMemory(npcId);
  const existing = memory.userProfile.findIndex((e) => e.key === key);
  const entry: UserProfileEntry = { key, value, updatedAt: new Date().toISOString() };
  if (existing >= 0) {
    memory.userProfile[existing] = entry;
  } else {
    memory.userProfile.push(entry);
  }
  writeMemory(npcId, memory);
  syncMemoryToServer(npcId, { userProfile: [{ key, value }] });
}

export function appendShortTermEntry(npcId: string, content: string): void {
  const memory = readMemory(npcId);
  const date = today();
  if (!memory.shortTerm[date]) memory.shortTerm[date] = [];
  memory.shortTerm[date].push({ content, createdAt: new Date().toISOString() });
  if (memory.shortTerm[date].length > 20) {
    memory.shortTerm[date] = memory.shortTerm[date].slice(-20);
  }
  pruneOldShortTerm(memory);
  writeMemory(npcId, memory);
  syncMemoryToServer(npcId, { shortTerm: [content] });
}

export function clearNpcMemory(npcId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(memoryKey(npcId));
  } catch { /* ignore */ }
  // Fire-and-forget server clear
  fetch(`/api/agent-memory?npcId=${encodeURIComponent(npcId)}`, { method: "DELETE" }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Server sync — fire-and-forget background sync to /api/agent-memory
// ---------------------------------------------------------------------------

/**
 * Push new memory entries to the server (fire-and-forget).
 * Failures are silently ignored — localStorage remains the source of truth.
 */
export function syncMemoryToServer(npcId: string, entries: {
  longTerm?: string[];
  shortTerm?: string[];
  userProfile?: Array<{ key: string; value: string }>;
}): void {
  if (typeof window === "undefined") return;
  fetch("/api/agent-memory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ npcId, ...entries }),
  }).catch(() => {});
}

/**
 * Hydrate localStorage from server on first load (cross-device recovery).
 * Merges server state into local — server wins for long-term and user profile.
 */
export async function hydrateFromServer(npcId: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const res = await fetch(`/api/agent-memory?npcId=${encodeURIComponent(npcId)}`);
    if (!res.ok) return;
    const serverMemory = (await res.json()) as NpcMemory;

    const local = readMemory(npcId);

    // Merge: server long-term facts take precedence (they survive browser clears)
    const merged: NpcMemory = {
      longTerm: mergeByContent(serverMemory.longTerm, local.longTerm),
      userProfile: mergeByKey(serverMemory.userProfile, local.userProfile),
      shortTerm: mergeShortTerm(serverMemory.shortTerm, local.shortTerm),
    };

    writeMemory(npcId, merged);
  } catch { /* silent — localStorage fallback is fine */ }
}

function mergeByContent(server: LongTermFact[], local: LongTermFact[]): LongTermFact[] {
  const seen = new Set(server.map((f) => f.content));
  const localOnly = local.filter((f) => !seen.has(f.content));
  return [...server, ...localOnly].slice(-200);
}

function mergeByKey(server: UserProfileEntry[], local: UserProfileEntry[]): UserProfileEntry[] {
  const map = new Map<string, UserProfileEntry>();
  for (const e of local) map.set(e.key, e);
  // Server entries override local (server = more durable)
  for (const e of server) map.set(e.key, e);
  return Array.from(map.values());
}

function mergeShortTerm(
  server: Record<string, ShortTermEntry[]>,
  local: Record<string, ShortTermEntry[]>,
): Record<string, ShortTermEntry[]> {
  const result: Record<string, ShortTermEntry[]> = { ...local };
  for (const [date, entries] of Object.entries(server)) {
    if (!result[date]) {
      result[date] = entries;
    } else {
      const seen = new Set(result[date].map((e) => e.content));
      const merged = [...result[date], ...entries.filter((e) => !seen.has(e.content))];
      result[date] = merged.slice(-30);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Context builder — injects memory into system prompt
// ---------------------------------------------------------------------------

/**
 * Build the effective system prompt with memory layers injected.
 * Priority (token budget):
 *   1. SOUL.md (system prompt)   — always included
 *   2. Long-term memory          — top 50 facts
 *   3. User profile              — all entries
 *   4. Short-term memory         — today + yesterday
 */
export function buildMemoryContext(
  systemPrompt: string,
  npcId: string,
  locale: "ko" | "en" = "ko",
): string {
  const memory = getNpcMemory(npcId);

  const sections: string[] = [systemPrompt.trim()];

  // ── Long-term memory (MEMORY.md) ─────────────────────────────────────────
  const top50LongTerm = memory.longTerm.slice(-50);
  if (top50LongTerm.length > 0) {
    const header = locale === "ko" ? "## 장기 기억 (MEMORY.md)" : "## Long-term Memory (MEMORY.md)";
    const lines = top50LongTerm.map((f) => `- ${f.content}`).join("\n");
    sections.push(`${header}\n${lines}`);
  }

  // ── User profile (USER.md) ───────────────────────────────────────────────
  if (memory.userProfile.length > 0) {
    const header = locale === "ko" ? "## 사용자 프로필 (USER.md)" : "## User Profile (USER.md)";
    const lines = memory.userProfile.map((e) => `- ${e.key}: ${e.value}`).join("\n");
    sections.push(`${header}\n${lines}`);
  }

  // ── Short-term memory (today + yesterday) ────────────────────────────────
  const todayStr = today();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const recentEntries = [
    ...(memory.shortTerm[todayStr] ?? []),
    ...(memory.shortTerm[yesterdayStr] ?? []),
  ].slice(-20);

  if (recentEntries.length > 0) {
    const header = locale === "ko" ? "## 최근 맥락 (단기 기억)" : "## Recent Context (Short-term)";
    const lines = recentEntries.map((e) => `- ${e.content}`).join("\n");
    sections.push(`${header}\n${lines}`);
  }

  return sections.join("\n\n---\n\n");
}

// ---------------------------------------------------------------------------
// Memory extraction response type (from /api/memory-extract)
// ---------------------------------------------------------------------------

export interface MemoryExtractionResult {
  longTerm: string[];    // facts to store permanently
  shortTerm: string[];   // daily key-points
  userProfile: Array<{ key: string; value: string }>;
}
