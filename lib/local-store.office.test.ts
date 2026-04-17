import assert from "node:assert/strict";
import test from "node:test";

import {
  getOfficeChannel,
  getOfficeNpcs,
  getOfficePlayerPosition,
  getOfficeTasks,
  migrateLegacyOfficeStorage,
  saveChannel,
  saveNpcs,
  saveOfficeChannel,
  saveOfficePlayerPosition,
  saveTasks,
  savePlayerPosition,
  type LocalChannel,
  type LocalNpc,
  type LocalTask,
} from "./local-store";

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
  return localStorage;
}

function resetStorage() {
  (globalThis.localStorage as MemoryStorage).clear();
}

installWindowStorage();

test.beforeEach(() => {
  resetStorage();
});

test("office-scoped channel/task/position storage stays isolated per office", () => {
  const alphaChannel: LocalChannel = {
    id: "office:alpha",
    name: "Alpha",
    mapData: { tiledJson: { width: 1 } },
    tiledJson: null,
    mapConfig: { spawnCol: 1, spawnRow: 1 },
    mapVersion: 2,
  };
  const betaTask: LocalTask = {
    id: "task-beta",
    npcTaskId: "npc-task-beta",
    npcId: "npc-beta",
    npcName: "Beta NPC",
    title: "Review docs",
    summary: null,
    status: "pending",
    createdAt: "2026-04-15T00:00:00.000Z",
    updatedAt: "2026-04-15T00:00:00.000Z",
  };

  saveOfficeChannel("office:alpha", alphaChannel);
  saveOfficePlayerPosition("office:alpha", { x: 11, y: 22 });
  saveTasks([betaTask]);

  assert.deepEqual(getOfficeChannel("office:alpha"), alphaChannel);
  assert.equal(getOfficeChannel("office:beta"), null);
  assert.deepEqual(getOfficePlayerPosition("office:alpha"), { x: 11, y: 22 });
  assert.deepEqual(getOfficeTasks("office:beta"), []);
});

test("migrateLegacyOfficeStorage seeds a home office from pre-B-option single-office data", () => {
  const legacyChannel: LocalChannel = {
    id: "default",
    name: "Legacy Office",
    mapData: { tiledJson: { width: 5 } },
    tiledJson: null,
    mapConfig: { spawnCol: 4, spawnRow: 6 },
    mapVersion: 2,
  };
  const legacyNpc: LocalNpc = {
    id: "npc-1",
    name: "Legacy NPC",
    positionX: 3,
    positionY: 4,
    direction: "down",
    appearance: { body: "legacy" },
    agentConfig: {
      provider: "openai",
      model: "gpt-4o",
      apiKey: "",
      systemPrompt: "legacy",
    },
  };
  const legacyTask: LocalTask = {
    id: "task-1",
    npcTaskId: "npc-task-1",
    npcId: "npc-1",
    npcName: "Legacy NPC",
    title: "Legacy task",
    summary: null,
    status: "pending",
    createdAt: "2026-04-15T00:00:00.000Z",
    updatedAt: "2026-04-15T00:00:00.000Z",
  };

  saveChannel(legacyChannel);
  saveNpcs([legacyNpc]);
  saveTasks([legacyTask]);
  savePlayerPosition({ x: 9, y: 8 });

  migrateLegacyOfficeStorage("office:phillip");

  assert.deepEqual(getOfficeChannel("office:phillip"), legacyChannel);
  assert.deepEqual(getOfficeNpcs("office:phillip"), [legacyNpc]);
  assert.deepEqual(getOfficeTasks("office:phillip"), [legacyTask]);
  assert.deepEqual(getOfficePlayerPosition("office:phillip"), { x: 9, y: 8 });
});
