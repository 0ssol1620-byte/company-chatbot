import assert from "node:assert/strict";
import test from "node:test";

import { appendOfficeTrace, clearOfficeTrace, getRecentOfficeTrace, getRecentOfficeTraceText } from "./office-debug";

class MemoryStorage {
  private readonly store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

function installWindowStorage() {
  const localStorage = new MemoryStorage();
  Object.defineProperty(globalThis, "window", {
    value: { localStorage },
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, "localStorage", {
    value: localStorage,
    configurable: true,
    writable: true,
  });
}

installWindowStorage();

test.beforeEach(() => {
  clearOfficeTrace();
});

test("appendOfficeTrace persists recent entries and text export includes event names", () => {
  appendOfficeTrace("visit:start", { officeId: "office:alice" });
  appendOfficeTrace("presence:sync", { officeId: "office:alice", players: 2 });

  const entries = getRecentOfficeTrace(10);
  assert.equal(entries.length, 2);
  assert.equal(entries[0]?.event, "visit:start");
  assert.equal(entries[1]?.event, "presence:sync");

  const text = getRecentOfficeTraceText(10);
  assert.match(text, /visit:start/);
  assert.match(text, /presence:sync/);
  assert.match(text, /office:alice/);
});
