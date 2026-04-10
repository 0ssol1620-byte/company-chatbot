/**
 * /api/agent-memory
 *
 * Server-side memory persistence for NPC agents.
 * Implements the AI SaaS Chatbot Memory Architecture:
 *   - Long-term memory  (MEMORY.md)   — permanent facts, decisions, preferences
 *   - Short-term memory (daily .md)   — today/yesterday key-points (7-day TTL)
 *   - User profile      (USER.md)     — name, preferences, recurring patterns
 *
 * Storage: in-memory Map (development) with Vercel Runtime Cache for hot access.
 * Falls back gracefully so the client-side localStorage remains the primary store.
 *
 * GET  /api/agent-memory?npcId=<id>        — read full memory
 * POST /api/agent-memory                   — write memory entries
 * DELETE /api/agent-memory?npcId=<id>      — clear all memory for NPC
 */

import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Types (mirrors npc-memory.ts client types)
// ---------------------------------------------------------------------------

interface LongTermFact {
  content: string;
  createdAt: string;
}

interface UserProfileEntry {
  key: string;
  value: string;
  updatedAt: string;
}

interface ShortTermEntry {
  content: string;
  createdAt: string;
}

interface NpcMemory {
  longTerm: LongTermFact[];
  shortTerm: Record<string, ShortTermEntry[]>; // key: YYYY-MM-DD
  userProfile: UserProfileEntry[];
}

// ---------------------------------------------------------------------------
// In-process store (survives across requests in the same serverless instance)
// For production persistence across instances, use Neon/Postgres or Vercel KV.
// ---------------------------------------------------------------------------

const memoryStore = new Map<string, NpcMemory>();

function emptyMemory(): NpcMemory {
  return { longTerm: [], shortTerm: {}, userProfile: [] };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function pruneOldShortTerm(memory: NpcMemory): void {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  for (const date of Object.keys(memory.shortTerm)) {
    if (date < cutoffStr) delete memory.shortTerm[date];
  }
}

function getMemory(npcId: string): NpcMemory {
  const mem = memoryStore.get(npcId) ?? emptyMemory();
  pruneOldShortTerm(mem);
  return mem;
}

function saveMemory(npcId: string, memory: NpcMemory): void {
  // Cap arrays to prevent unbounded growth
  if (memory.longTerm.length > 200) memory.longTerm = memory.longTerm.slice(-200);
  if (memory.userProfile.length > 50) memory.userProfile = memory.userProfile.slice(-50);
  const todayStr = today();
  if (memory.shortTerm[todayStr]?.length > 30) {
    memory.shortTerm[todayStr] = memory.shortTerm[todayStr].slice(-30);
  }
  memoryStore.set(npcId, memory);
}

// ---------------------------------------------------------------------------
// GET — read memory
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const npcId = req.nextUrl.searchParams.get("npcId");
  if (!npcId) {
    return NextResponse.json({ error: "npcId is required" }, { status: 400 });
  }

  const memory = getMemory(npcId);
  return NextResponse.json(memory);
}

// ---------------------------------------------------------------------------
// POST — write memory entries
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  let body: {
    npcId?: string;
    longTerm?: string[];
    shortTerm?: string[];
    userProfile?: Array<{ key: string; value: string }>;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { npcId, longTerm = [], shortTerm = [], userProfile = [] } = body;
  if (!npcId) {
    return NextResponse.json({ error: "npcId is required" }, { status: 400 });
  }

  const memory = getMemory(npcId);
  const now = new Date().toISOString();
  const todayStr = today();

  // Append long-term facts (deduplicate by content)
  for (const content of longTerm) {
    if (!memory.longTerm.some((f) => f.content === content)) {
      memory.longTerm.push({ content, createdAt: now });
    }
  }

  // Append short-term entries for today
  if (!memory.shortTerm[todayStr]) memory.shortTerm[todayStr] = [];
  for (const content of shortTerm) {
    memory.shortTerm[todayStr].push({ content, createdAt: now });
  }

  // Upsert user profile entries (merge by key)
  for (const { key, value } of userProfile) {
    const existing = memory.userProfile.find((e) => e.key === key);
    if (existing) {
      existing.value = value;
      existing.updatedAt = now;
    } else {
      memory.userProfile.push({ key, value, updatedAt: now });
    }
  }

  saveMemory(npcId, memory);
  return NextResponse.json({ ok: true });
}

// ---------------------------------------------------------------------------
// DELETE — clear all memory for an NPC
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest) {
  const npcId = req.nextUrl.searchParams.get("npcId");
  if (!npcId) {
    return NextResponse.json({ error: "npcId is required" }, { status: 400 });
  }

  memoryStore.delete(npcId);
  return NextResponse.json({ ok: true });
}
