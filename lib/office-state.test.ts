import assert from "node:assert/strict";
import test from "node:test";

import {
  OFFICE_MAP_VERSION,
  buildOfficeRuntimeState,
  buildPendingOfficeChannelData,
  buildPlayerOfficeRecord,
  buildOfficeSnapshotSeedFromRecord,
  getDefaultOfficeName,
  getOfficeIdForPlayer,
} from "./office-state";
import type { LocalChannel, LocalNpc, LocalTask } from "./local-store";

test("getOfficeIdForPlayer and getDefaultOfficeName produce stable office identifiers", () => {
  assert.equal(getOfficeIdForPlayer("player-123"), "office:player-123");
  assert.equal(getDefaultOfficeName("Phillip"), "Phillip's Office");
});

test("buildOfficeRuntimeState marks visits as read-only for non-owners", () => {
  const runtime = buildOfficeRuntimeState({
    officeId: "office:alice",
    officeName: "Alice HQ",
    ownerPlayerId: "alice",
    ownerPlayerName: "Alice",
    currentPlayerId: "phillip",
    currentPlayerName: "Phillip",
  });

  assert.deepEqual(runtime, {
    officeId: "office:alice",
    officeName: "Alice HQ",
    ownerPlayerId: "alice",
    ownerPlayerName: "Alice",
    isVisiting: true,
    isOwner: false,
  });
});

test("buildPendingOfficeChannelData preserves office-specific channel id and map payload", () => {
  const channel: LocalChannel = {
    id: "office:alice",
    name: "Alice HQ",
    mapData: { tiledJson: { layers: [] } },
    tiledJson: null,
    mapConfig: { spawnCol: 2, spawnRow: 4 },
    mapVersion: OFFICE_MAP_VERSION,
  };

  const pending = buildPendingOfficeChannelData({
    officeId: "office:alice",
    channel,
    savedPosition: { x: 7, y: 9 },
  });

  assert.equal(pending?.channelId, "office:alice");
  assert.deepEqual(pending?.mapConfig, { spawnCol: 2, spawnRow: 4 });
  assert.deepEqual(pending?.savedPosition, { x: 7, y: 9 });
  assert.deepEqual(pending?.tiledJson, { layers: [] });
});

test("office record conversion round-trips channel and NPC snapshot data", () => {
  const npcs: LocalNpc[] = [{
    id: "npc-1",
    name: "Guide",
    positionX: 1,
    positionY: 2,
    direction: "down",
    appearance: { body: "base" },
    agentConfig: {
      provider: "openai",
      model: "gpt-4o",
      apiKey: "",
      systemPrompt: "helpful",
    },
  }];
  const tasks: LocalTask[] = [{
    id: "task-1",
    npcTaskId: "npc-task-1",
    npcId: "npc-1",
    npcName: "Guide",
    title: "Welcome guest",
    summary: null,
    status: "pending",
    createdAt: "2026-04-15T00:00:00.000Z",
    updatedAt: "2026-04-15T00:00:00.000Z",
  }];
  const channel: LocalChannel = {
    id: "office:alice",
    name: "Alice HQ",
    mapData: { tiledJson: { width: 10 } },
    tiledJson: null,
    mapConfig: { spawnCol: 5, spawnRow: 6 },
    mapVersion: OFFICE_MAP_VERSION,
  };

  const record = buildPlayerOfficeRecord({
    officeId: "office:alice",
    officeName: "Alice HQ",
    ownerPlayerId: "alice",
    ownerPlayerName: "Alice",
    channel,
    npcs,
    tasks,
    savedPosition: { x: 3, y: 4 },
  });

  const seed = buildOfficeSnapshotSeedFromRecord({
    office: record,
    ownerPlayerName: "Alice",
    tasks,
    savedPosition: { x: 3, y: 4 },
  });

  assert.equal(record.office_id, "office:alice");
  assert.deepEqual(seed.channel?.mapConfig, { spawnCol: 5, spawnRow: 6 });
  assert.deepEqual(seed.npcs, npcs);
  assert.deepEqual(seed.tasks, tasks);
  assert.deepEqual(seed.savedPosition, { x: 3, y: 4 });
});
