export interface OfficeTraceEntry {
  ts: string;
  event: string;
  details?: Record<string, unknown>;
}

const TRACE_STORAGE_KEY = "deskrpg:office-debug-trace";
const TRACE_LIMIT = 200;

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readTrace(): OfficeTraceEntry[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(TRACE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OfficeTraceEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeTrace(entries: OfficeTraceEntry[]): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(TRACE_STORAGE_KEY, JSON.stringify(entries.slice(-TRACE_LIMIT)));
  } catch {
    // ignore storage failures
  }
}

export function appendOfficeTrace(event: string, details?: Record<string, unknown>): void {
  const entry: OfficeTraceEntry = {
    ts: new Date().toISOString(),
    event,
    details,
  };
  const next = [...readTrace(), entry].slice(-TRACE_LIMIT);
  writeTrace(next);
  if (typeof console !== "undefined") {
    console.info(`[office-trace] ${entry.ts} ${event}`, details ?? {});
  }
}

export function getRecentOfficeTrace(limit = 80): OfficeTraceEntry[] {
  return readTrace().slice(-Math.max(1, limit));
}

export function getRecentOfficeTraceText(limit = 80): string {
  return getRecentOfficeTrace(limit)
    .map((entry) => `${entry.ts} ${entry.event} ${entry.details ? JSON.stringify(entry.details) : ""}`.trim())
    .join("\n");
}

export function clearOfficeTrace(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(TRACE_STORAGE_KEY);
  } catch {
    // ignore storage failures
  }
}
