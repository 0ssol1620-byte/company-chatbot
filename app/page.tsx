"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useT, useLocale, LOCALES } from "@/lib/i18n";
import { ClipboardList, MessageSquare, Undo2, Clock, Footprints, PhoneCall, Bell, ChevronDown, UserPlus, UserMinus, Settings, LogOut, Pencil, Users, Globe, RotateCcw, Bug, Info, Search } from "lucide-react";
import {
  CharacterAppearance,
  LegacyCharacterAppearance,
} from "@/lib/lpc-registry";
import { compositeCharacter } from "@/lib/sprite-compositor";
import { EventBus, setPendingChannelData, type PendingChannelData } from "@/game/EventBus";
import ChatPanel, { type ChannelChatMessage } from "@/components/ChatPanel";
import MeetingRoom from "@/components/MeetingRoom";
import NpcHireModal from "@/components/NpcHireModal";
import MapEditorPanel, { type TilesetDef } from "@/components/MapEditorPanel";
import PlayerDirectoryModal from "@/components/PlayerDirectoryModal";
import type { NpcChatMessage } from "@/components/NpcDialog";
import TaskBoard from "@/components/TaskBoard";
import type { Task } from "@/components/TaskCard";
import { sanitizeNpcResponseText } from "@/lib/task-block-utils.js";
import { LocalMultiplayer, getTabId } from "@/lib/local-multiplayer";
import { SupabaseMultiplayer, type PlayerPresence } from "@/lib/supabase-multiplayer";
import {
  getCharacter,
  getNpcs,
  addNpc,
  updateNpc,
  removeNpc,
  getTasks,
  upsertTask,
  removeTask,
  removeTasksForNpc,
  getNpcChat,
  appendNpcChat,
  clearNpcChat,
  getMeetings,
  savePlayerPosition,
  getPlayerPosition,
  getChannel,
  saveChannel,
  getOfficeChannel,
  saveOfficeChannel,
  getOfficeNpcs,
  addOfficeNpc,
  updateOfficeNpc,
  removeOfficeNpc,
  saveOfficeNpcs,
  getOfficeTasks,
  upsertOfficeTask,
  removeOfficeTask,
  removeOfficeTasksForNpc,
  saveOfficeTasks,
  getOfficePlayerPosition,
  saveOfficePlayerPosition,
  migrateLegacyOfficeStorage,
  type LocalNpc,
  type LocalTask,
  type LocalChannel,
} from "@/lib/local-store";
import {
  upsertPlayer,
  updatePlayerPosition,
  getOfflinePlayers,
  sendOfflineMessage,
  getUnreadMessages,
  markMessagesRead,
  type PlayerRecord,
  type OfflineMessage,
} from "@/lib/player-registry";
import { getPlayerOffice, upsertPlayerOffice, type PlayerOfficeRecord } from "@/lib/office-registry";
import {
  OFFICE_MAP_VERSION,
  buildOfficeRuntimeState,
  buildPendingOfficeChannelData,
  buildPlayerOfficeRecord,
  buildOfficeSnapshotSeedFromRecord,
  getDefaultOfficeName,
  getOfficeIdForPlayer,
} from "@/lib/office-state";

const APP_VERSION = "2026.4.6";
const BUG_REPORT_BASE_URL = "https://github.com/0ssol1620-byte/company-chatbot/issues/new";
const SOURCE_CODE_URL = "https://github.com/0ssol1620-byte/company-chatbot";
const LICENSE_URL = `${SOURCE_CODE_URL}/blob/main/LICENSE.md`;
const THIRD_PARTY_LICENSES_URL = "/third-party-licenses.html";
const AVATAR_ASSET_CREDITS_URL = "/assets/spritesheets/CREDITS.md";
const AVATAR_ASSET_LICENSE_URL = "/assets/spritesheets/LICENSE-assets.md";
const INSTANCE_ID_STORAGE_KEY = "deskrpg.instanceId";

function GameEngineLoading() {
  const t = useT();

  return (
    <div className="fixed inset-0 bg-gray-800 flex items-center justify-center text-gray-400">
      {t("game.loadingEngine")}
    </div>
  );
}

// Import PhaserGame with SSR disabled — Phaser requires browser APIs
const PhaserGame = dynamic(() => import("@/components/PhaserGame"), {
  ssr: false,
  loading: () => <GameEngineLoading />,
});

interface Character {
  id: string;
  name: string;
  appearance: CharacterAppearance | LegacyCharacterAppearance;
}

interface GameNotification {
  id: string;
  message: string;
  timestamp: number;
  read: boolean;
}

interface ChannelPlayerSummary {
  id: string;
  name: string;
  appearance: CharacterAppearance | LegacyCharacterAppearance | null;
}

type RosterActionMenu =
  | {
      type: "player";
      playerId: string;
      playerName: string;
      x: number;
      y: number;
    }
  | {
      type: "npc";
      npcId: string;
      npcName: string;
      x: number;
      y: number;
    };

type RosterActionMenuInput =
  | {
      type: "player";
      playerId: string;
      playerName: string;
    }
  | {
      type: "npc";
      npcId: string;
      npcName: string;
    };

function RosterAvatar({
  appearance,
  size = 28,
}: {
  appearance: CharacterAppearance | LegacyCharacterAppearance | null;
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !appearance) return;

    const canvas = canvasRef.current;
    const offscreen = document.createElement("canvas");

    compositeCharacter(offscreen, appearance)
      .then(() => {
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = size;
        canvas.height = size;
        ctx.clearRect(0, 0, size, size);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(offscreen, 0, 128, 64, 64, 0, 0, size, size);
      })
      .catch(() => {});
  }, [appearance, size]);

  if (!appearance) {
    return (
      <div
        className="rounded-full bg-surface-raised flex items-center justify-center text-text-secondary text-micro font-bold shrink-0"
        style={{ width: size, height: size }}
      >
        ?
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="rounded-full bg-surface-raised shrink-0"
      style={{ width: size, height: size, imageRendering: "pixelated" }}
    />
  );
}

export default function GamePage() {
  const t = useT();
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        {t("common.loading")}
      </div>
    }>
      <GamePageInner />
    </Suspense>
  );
}

function GamePageInner() {
  const router = useRouter();
  const t = useT();
  const { locale, setLocale } = useLocale();

  const [character, setCharacter] = useState<Character | null>(null);
  const [spritesheetDataUrl, setSpritesheetDataUrl] = useState<string | null>(null);
  const [gameChannelData, setGameChannelData] = useState<PendingChannelData>(null);
  const [phaserSceneKey, setPhaserSceneKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showRosterMenu, setShowRosterMenu] = useState<"players" | "npcs" | null>(null);
  const [rosterActionMenu, setRosterActionMenu] = useState<RosterActionMenu | null>(null);
  const [mode, setMode] = useState<"office" | "meeting">("office");
  const [channelNpcs, setChannelNpcs] = useState<{ id: string; name: string; appearance: unknown }[]>([]);
  const [channelPlayers, setChannelPlayers] = useState<ChannelPlayerSummary[]>([]);

  // Ref to track current dialogNpc for use inside listeners (must be declared before sync effect)
  const dialogNpcRef = useRef<{ npcId: string; npcName: string } | null>(null);

  // NPC dialog state — all managed here, ChatPanel is pure display
  const [dialogNpc, setDialogNpc] = useState<{ npcId: string; npcName: string } | null>(null);
  // Keep ref in sync so listeners can read current value without stale closure
  useEffect(() => { dialogNpcRef.current = dialogNpc; }, [dialogNpc]);
  const [npcMessages, setNpcMessages] = useState<NpcChatMessage[]>([]);
  const [isNpcStreaming, setIsNpcStreaming] = useState(false);
  const [npcSelectList, setNpcSelectList] = useState<{ npcId: string; npcName: string }[] | null>(null);
  const [interactSelectList, setInteractSelectList] = useState<{ id: string; name: string; type: "npc" | "player"; offline?: boolean }[] | null>(null);

  // Channel chat state
  const [channelMessages, setChannelMessages] = useState<ChannelChatMessage[]>([]);
  const [channelChatOpen, setChannelChatOpen] = useState(false);
  const channelChatOpenRef = useRef(false);
  const [channelChatInputDisabled, setChannelChatInputDisabled] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Map editor state (H1)
  const [editorModeActive, setEditorModeActive] = useState(false);
  const [editorTilesets, setEditorTilesets] = useState<TilesetDef[] | null>(null);
  const [editorTiledMode, setEditorTiledMode] = useState(false);

  // Supabase connection state (H4)
  const [supabaseStatus, setSupabaseStatus] = useState<"connecting" | "connected" | "error">("connecting");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Notification state
  const [notifications, setNotifications] = useState<GameNotification[]>([]);
  const [notificationsExpanded, setNotificationsExpanded] = useState(false);
  const characterNameRef = useRef<string>("");

  // NPC greeting messages (stored until dialog opens)
  const npcGreetings = useRef<Map<string, string>>(new Map());
  const npcMessagesRef = useRef<NpcChatMessage[]>([]);

  const [showTaskBoard, setShowTaskBoard] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [meetingMinutesCount, setMeetingMinutesCount] = useState(0);

  // Offline player registry + inbox
  const [showDirectory, setShowDirectory] = useState(false);
  const [offlinePlayers, setOfflinePlayers] = useState<PlayerRecord[]>([]);
  const [inbox, setInbox] = useState<OfflineMessage[]>([]);
  const [showInbox, setShowInbox] = useState(false);
  const [offlineMsgTarget, setOfflineMsgTarget] = useState<{ id: string; name: string } | null>(null);
  const [offlineMsgText, setOfflineMsgText] = useState("");
  const [offlineMsgSending, setOfflineMsgSending] = useState(false);
  const positionUpdateTimerRef = useRef<number>(0);

  // Owner & NPC management state — always true in local mode
  const [isOwner, setIsOwner] = useState(true);
  const [currentOfficeId, setCurrentOfficeId] = useState<string>("default");
  const [currentOfficeName, setCurrentOfficeName] = useState<string>("Office");
  const [currentOfficeOwnerId, setCurrentOfficeOwnerId] = useState<string>("");
  const [currentOfficeOwnerName, setCurrentOfficeOwnerName] = useState<string>("");
  const [homeOfficeId, setHomeOfficeId] = useState<string>("default");
  const [homeOfficeName, setHomeOfficeName] = useState<string>("Office");
  const [visitingOfficeNotice, setVisitingOfficeNotice] = useState<string | null>(null);
  const [officeOwnerPreview, setOfficeOwnerPreview] = useState<{
    id: string;
    name: string;
    appearance: CharacterAppearance | LegacyCharacterAppearance | null;
    position: { x: number; y: number } | null;
    offline: boolean;
  } | null>(null);
  const [showHireModal, setShowHireModal] = useState(false);
  const [placementMode, setPlacementMode] = useState(false);
  const [spawnSetMode, setSpawnSetMode] = useState(false);
  const [pendingNpc, setPendingNpc] = useState<{ presetId?: string; name: string; persona: string; appearance: unknown; direction: string; agentId?: string; agentAction?: "select" | "create"; identity?: string; soul?: string; locale?: string; provider?: string; model?: string; apiKey?: string; systemPrompt?: string; files?: import("@/lib/local-store").LocalAgentFile[] } | null>(null);
  const [editingNpc, setEditingNpc] = useState<{ id: string; name: string; persona: string; appearance: unknown; direction?: string; agentId?: string | null; agentConfig?: import("@/lib/local-store").LocalAgentConfig } | null>(null);

  // NPC context menu (right-click) state
  const [contextMenu, setContextMenu] = useState<{
    npcId: string;
    npcName: string;
    x: number;
    y: number;
    moveState: string;
  } | null>(null);

  const [npcMoveStates, setNpcMoveStates] = useState<Record<string, string>>({});

  // Ref to accumulate streaming text (avoids setState-in-effect issues)
  const streamBufferRef = useRef("");
  // Current player position — updated from GameScene for beforeunload save
  const playerPositionRef = useRef<{ x: number; y: number } | null>(null);
  const [instanceId, setInstanceId] = useState("");
  const [debugCopied, setDebugCopied] = useState(false);

  // LocalMultiplayer (BroadcastChannel for tab sync)
  const localMultiplayer = useRef<LocalMultiplayer | null>(null);
  // SupabaseMultiplayer (Realtime Presence + Broadcast for cross-machine sync)
  const supabaseMultiplayer = useRef<SupabaseMultiplayer | null>(null);
  // Track last known world positions of remote players (playerId → {x, y})
  const remotePlayerPositions = useRef<Map<string, { x: number; y: number }>>(new Map());

  const getScopedNpcs = useCallback((officeId = currentOfficeId) => getOfficeNpcs(officeId), [currentOfficeId]);
  const getScopedTasks = useCallback((officeId = currentOfficeId) => getOfficeTasks(officeId), [currentOfficeId]);

  const persistOfficeSnapshot = useCallback(async (params: {
    officeId: string;
    officeName: string;
    ownerPlayerId: string;
    ownerPlayerName: string;
    channel?: LocalChannel | null;
  }) => {
    const channel = params.channel ?? getOfficeChannel(params.officeId) ?? null;
    const npcs = getOfficeNpcs(params.officeId);
    const tasks = getOfficeTasks(params.officeId);
    const savedPosition = getOfficePlayerPosition(params.officeId);

    await upsertPlayerOffice(buildPlayerOfficeRecord({
      officeId: params.officeId,
      officeName: params.officeName,
      ownerPlayerId: params.ownerPlayerId,
      ownerPlayerName: params.ownerPlayerName,
      channel,
      npcs,
      tasks,
      savedPosition,
    }));
  }, []);

  const applyOfficeSeed = useCallback((seed: {
    officeId: string;
    officeName: string;
    ownerPlayerId: string;
    ownerPlayerName: string;
    ownerAppearance?: CharacterAppearance | LegacyCharacterAppearance | null;
    ownerOffline?: boolean;
    channel: LocalChannel | null;
    npcs: LocalNpc[];
    tasks: LocalTask[];
    savedPosition: { x: number; y: number } | null;
  }, currentPlayer: Character) => {
    const runtime = buildOfficeRuntimeState({
      officeId: seed.officeId,
      officeName: seed.officeName,
      ownerPlayerId: seed.ownerPlayerId,
      ownerPlayerName: seed.ownerPlayerName,
      currentPlayerId: currentPlayer.id,
      currentPlayerName: currentPlayer.name,
    });

    setCurrentOfficeId(runtime.officeId);
    setCurrentOfficeName(runtime.officeName);
    setCurrentOfficeOwnerId(runtime.ownerPlayerId);
    setCurrentOfficeOwnerName(runtime.ownerPlayerName);
    setIsOwner(runtime.isOwner);
    setVisitingOfficeNotice(runtime.isVisiting ? `${runtime.ownerPlayerName} · ${runtime.officeName}` : null);

    const pending = buildPendingOfficeChannelData({
      officeId: runtime.officeId,
      channel: seed.channel,
      savedPosition: seed.savedPosition,
    });

    setPendingChannelData(pending);
    setGameChannelData(pending);
    // Force a fresh Phaser instance whenever office seed/map context changes.
    // The scene only consumes pendingChannelData during create(), so office switching
    // must remount the game to avoid rendering the previously loaded office.
    setPhaserSceneKey((prev) => prev + 1);
    setChannelNpcs(seed.npcs.map((npc) => ({ id: npc.id, name: npc.name, appearance: npc.appearance })));
    setAllTasks(seed.tasks);
    setChannelPlayers([
      {
        id: "__self__",
        name: currentPlayer.name,
        appearance: currentPlayer.appearance ?? null,
      },
      ...(runtime.isVisiting ? [{
        id: seed.ownerPlayerId,
        name: seed.ownerPlayerName,
        appearance: seed.ownerAppearance ?? null,
      }] : []),
    ]);
    setOfficeOwnerPreview(runtime.isVisiting ? {
      id: seed.ownerPlayerId,
      name: seed.ownerPlayerName,
      appearance: seed.ownerAppearance ?? null,
      position: seed.savedPosition,
      offline: seed.ownerOffline ?? false,
    } : null);
    remotePlayerPositions.current.clear();
    EventBus.emit("channel-data-ready", pending);
  }, []);

  const currentOfficeIdRef = useRef(currentOfficeId);
  const currentOfficeNameRef = useRef(currentOfficeName);
  const currentOfficeOwnerIdRef = useRef(currentOfficeOwnerId);
  const currentOfficeOwnerNameRef = useRef(currentOfficeOwnerName);
  const officeOwnerPreviewRef = useRef(officeOwnerPreview);

  useEffect(() => { currentOfficeIdRef.current = currentOfficeId; }, [currentOfficeId]);
  useEffect(() => { currentOfficeNameRef.current = currentOfficeName; }, [currentOfficeName]);
  useEffect(() => { currentOfficeOwnerIdRef.current = currentOfficeOwnerId; }, [currentOfficeOwnerId]);
  useEffect(() => { currentOfficeOwnerNameRef.current = currentOfficeOwnerName; }, [currentOfficeOwnerName]);
  useEffect(() => { officeOwnerPreviewRef.current = officeOwnerPreview; }, [officeOwnerPreview]);

  const openBugReport = useCallback(() => {
    const userAgent = typeof window !== "undefined" ? window.navigator.userAgent : "unknown";
    const body = [
      "## 문제 설명",
      "",
      "",
      "## 재현 방법",
      "",
      "",
      "## 기대 결과",
      "",
      "",
      "## 실제 결과",
      "",
      "",
      "## 디버그 정보",
      "",
      `- version: v${APP_VERSION}`,
      `- browser: ${userAgent}`,
    ].join("\n");

    const params = new URLSearchParams({
      labels: "bug-report",
      body,
    });

    window.open(`${BUG_REPORT_BASE_URL}?${params.toString()}`, "_blank", "noopener,noreferrer");
  }, []);

  const copyDebugInformation = useCallback(async () => {
    const debugInfo = [
      `version: v${APP_VERSION}`,
      `browser: ${typeof window !== "undefined" ? window.navigator.userAgent : "unknown"}`,
      `url: ${typeof window !== "undefined" ? window.location.href : "unknown"}`,
      `instanceId: ${instanceId || "unknown"}`,
      `locale: ${locale}`,
    ].join("\n");

    await navigator.clipboard.writeText(debugInfo);
    setDebugCopied(true);
    setTimeout(() => setDebugCopied(false), 2000);
  }, [instanceId, locale]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let nextId = window.localStorage.getItem(INSTANCE_ID_STORAGE_KEY);
    if (!nextId) {
      nextId = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem(INSTANCE_ID_STORAGE_KEY, nextId);
    }
    setInstanceId(nextId);
  }, []);

  // Track player position for beforeunload save
  useEffect(() => {
    // Poll position every 15s and update ref
    const interval = setInterval(() => {
      let resolved = false;
      const handler = (data: { x: number; y: number }) => {
        resolved = true;
        EventBus.off("player-position-response", handler);
        playerPositionRef.current = data;
      };
      EventBus.on("player-position-response", handler);
      EventBus.emit("request-player-position");
      setTimeout(() => { if (!resolved) EventBus.off("player-position-response", handler); }, 500);
    }, 15000);

    // Save position on page unload (refresh, tab close)
    const handleUnload = () => {
      // EventBus is synchronous — get fresh position immediately
      let freshPos: { x: number; y: number } | null = null;
      const syncHandler = (data: { x: number; y: number }) => { freshPos = data; };
      EventBus.on("player-position-response", syncHandler);
      EventBus.emit("request-player-position");
      EventBus.off("player-position-response", syncHandler);

      const pos = freshPos ?? playerPositionRef.current;
      if (pos) saveOfficePlayerPosition(currentOfficeIdRef.current, { x: Math.round(pos.x), y: Math.round(pos.y) });
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, []);

  const showToastNotification = useCallback((id: string, message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 4000);
    setNotifications((prev) =>
      [{ id, message, timestamp: Date.now(), read: false }, ...prev].slice(0, 20),
    );
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    removeOfficeTask(currentOfficeId, taskId);
    setAllTasks(prev => prev.filter(t => t.id !== taskId));
  }, [currentOfficeId]);

  const requestTaskReport = useCallback((taskId: string) => {
    showToastNotification(`task-request-${taskId}`, t("task.requestReportQueued"));
  }, [showToastNotification, t]);

  const resumeTask = useCallback((taskId: string) => {
    const tasks = getScopedTasks();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const updated = { ...task, status: "in_progress" as const, updatedAt: new Date().toISOString() };
    upsertOfficeTask(currentOfficeId, updated);
    setAllTasks(prev => prev.map(t => t.id === taskId ? updated : t));
    showToastNotification(`task-resume-${taskId}`, t("task.resumeQueued"));
  }, [currentOfficeId, getScopedTasks, showToastNotification, t]);

  const completeTask = useCallback((taskId: string) => {
    const tasks = getScopedTasks();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const updated = { ...task, status: "complete" as const, updatedAt: new Date().toISOString() };
    upsertOfficeTask(currentOfficeId, updated);
    setAllTasks(prev => prev.map(t => t.id === taskId ? updated : t));
    showToastNotification(`task-complete-${taskId}`, t("task.completeQueued"));
  }, [currentOfficeId, getScopedTasks, showToastNotification, t]);

  const refreshChannelTasks = useCallback(() => {
    setAllTasks(getScopedTasks());
  }, [getScopedTasks]);

  // -----------------------------------------------------------------------
  // Initialization: load character from localStorage, set up office state + LocalMultiplayer
  // -----------------------------------------------------------------------
  useEffect(() => {
    const char = getCharacter();
    if (!char) {
      router.replace("/setup");
      return;
    }

    const homeId = getOfficeIdForPlayer(char.id);
    const homeName = getDefaultOfficeName(char.name);

    setCharacter(char);
    characterNameRef.current = char.name;
    setHomeOfficeId(homeId);
    setHomeOfficeName(homeName);
    currentOfficeIdRef.current = homeId;
    currentOfficeNameRef.current = homeName;
    currentOfficeOwnerIdRef.current = char.id;
    currentOfficeOwnerNameRef.current = char.name;

    migrateLegacyOfficeStorage(homeId);

    let cancelled = false;

    const loadInitialOffice = async () => {
      const savedPos = getOfficePlayerPosition(homeId) ?? getPlayerPosition();
      const savedChannel = getOfficeChannel(homeId) ?? getChannel();
      const savedNpcs = getOfficeNpcs(homeId);
      const savedTasks = getOfficeTasks(homeId);

      if (savedChannel?.mapData && savedChannel.mapVersion === OFFICE_MAP_VERSION) {
        if (cancelled) return;
        applyOfficeSeed({
          officeId: homeId,
          officeName: savedChannel.name || homeName,
          ownerPlayerId: char.id,
          ownerPlayerName: char.name,
          ownerAppearance: char.appearance,
          ownerOffline: false,
          channel: savedChannel,
          npcs: savedNpcs,
          tasks: savedTasks,
          savedPosition: savedPos,
        }, char);
        await persistOfficeSnapshot({
          officeId: homeId,
          officeName: savedChannel.name || homeName,
          ownerPlayerId: char.id,
          ownerPlayerName: char.name,
          channel: savedChannel,
        }).catch(() => {});
      } else {
        try {
          const response = await fetch("/assets/small-office-map.json");
          const mapJson = await response.json();
          if (cancelled) return;
          const fallbackChannel: LocalChannel = {
            id: homeId,
            name: homeName,
            mapData: mapJson,
            tiledJson: mapJson.tiledJson ?? null,
            mapConfig: {
              spawnCol: mapJson.spawnCol ?? 10,
              spawnRow: mapJson.spawnRow ?? 7,
            },
            mapVersion: OFFICE_MAP_VERSION,
          };
          saveOfficeChannel(homeId, fallbackChannel);
          applyOfficeSeed({
            officeId: homeId,
            officeName: homeName,
            ownerPlayerId: char.id,
            ownerPlayerName: char.name,
            ownerAppearance: char.appearance,
            ownerOffline: false,
            channel: fallbackChannel,
            npcs: savedNpcs,
            tasks: savedTasks,
            savedPosition: savedPos,
          }, char);
          await persistOfficeSnapshot({
            officeId: homeId,
            officeName: homeName,
            ownerPlayerId: char.id,
            ownerPlayerName: char.name,
            channel: fallbackChannel,
          }).catch(() => {});
        } catch {
          if (cancelled) return;
          const fallbackChannel: LocalChannel = {
            id: homeId,
            name: homeName,
            mapData: null,
            tiledJson: null,
            mapConfig: { spawnCol: 5, spawnRow: 5 },
            mapVersion: OFFICE_MAP_VERSION,
          };
          saveOfficeChannel(homeId, fallbackChannel);
          applyOfficeSeed({
            officeId: homeId,
            officeName: homeName,
            ownerPlayerId: char.id,
            ownerPlayerName: char.name,
            ownerAppearance: char.appearance,
            ownerOffline: false,
            channel: fallbackChannel,
            npcs: savedNpcs,
            tasks: savedTasks,
            savedPosition: savedPos,
          }, char);
        }
      }
    };

    loadInitialOffice().catch(() => {
      setError("Failed to load office data");
    });

    upsertPlayer({
      id: char.id,
      name: char.name,
      appearance: char.appearance,
      office_id: homeId,
      office_name: homeName,
      office_owner_id: char.id,
    }).catch(() => {});
    getUnreadMessages(char.id).then(msgs => { if (msgs.length) setInbox(msgs); }).catch(() => {});

    setChannelPlayers([{
      id: "__self__",
      name: char.name,
      appearance: char.appearance ?? null,
    }]);
    setMeetingMinutesCount(getMeetings().length);

    const tabId = getTabId();
    const lm = new LocalMultiplayer(tabId);
    localMultiplayer.current = lm;

    lm.on("npc:added", (data) => {
      const payload = data as { officeId?: string; npc: LocalNpc };
      if (payload.officeId !== currentOfficeIdRef.current) return;
      addOfficeNpc(payload.officeId, payload.npc);
      setChannelNpcs(prev => [...prev.filter(n => n.id !== payload.npc.id), { id: payload.npc.id, name: payload.npc.name, appearance: payload.npc.appearance }]);
      EventBus.emit("npc:spawn-local", payload.npc);
    });
    lm.on("npc:removed", (data) => {
      const payload = data as { officeId?: string; npcId: string };
      if (payload.officeId !== currentOfficeIdRef.current) return;
      removeOfficeNpc(payload.officeId, payload.npcId);
      setChannelNpcs(prev => prev.filter(n => n.id !== payload.npcId));
      setAllTasks(prev => prev.filter(t => t.npcId !== payload.npcId));
    });
    lm.on("npc:updated", (data) => {
      const payload = data as { officeId?: string; npcId: string } & Partial<LocalNpc>;
      if (payload.officeId !== currentOfficeIdRef.current) return;
      const { npcId, officeId, ...updates } = payload;
      updateOfficeNpc(officeId!, npcId, updates);
      setChannelNpcs(prev => prev.map(n => n.id === npcId ? { ...n, ...updates } : n));
    });

    return () => {
      cancelled = true;
      lm.disconnect();
      localMultiplayer.current = null;
    };
  }, [applyOfficeSeed, persistOfficeSnapshot, router]);

  useEffect(() => {
    if (!character) return;
    const canvas = document.createElement("canvas");
    canvasRef.current = canvas;
    compositeCharacter(canvas, character.appearance)
      .then(() => {
        setSpritesheetDataUrl(canvas.toDataURL("image/png"));
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [character]);

  useEffect(() => {
    if (!character || !currentOfficeId) return;

    const officeIdAtSubscribe = currentOfficeId;
    const savedPos = getOfficePlayerPosition(currentOfficeId) ?? undefined;
    const sm = new SupabaseMultiplayer(character.id || crypto.randomUUID(), `office:${currentOfficeId}`);
    supabaseMultiplayer.current = sm;
    setSupabaseStatus("connecting");

    const isStaleSubscription = () => currentOfficeIdRef.current !== officeIdAtSubscribe || supabaseMultiplayer.current !== sm;

    sm.on('player:joined', (data) => {
      if (isStaleSubscription()) return;
      const p = data as PlayerPresence;
      if (p.position) remotePlayerPositions.current.set(p.playerId, p.position);
      setOfficeOwnerPreview((prev) => prev && prev.id === p.playerId ? { ...prev, offline: false, position: p.position ?? prev.position } : prev);
      setChannelPlayers(prev => {
        if (prev.some(x => x.id === p.playerId)) {
          return prev.map((x) => x.id === p.playerId ? { ...x, name: p.name, appearance: p.appearance as CharacterAppearance | LegacyCharacterAppearance | null } : x);
        }
        return [...prev, { id: p.playerId, name: p.name, appearance: p.appearance as CharacterAppearance | LegacyCharacterAppearance | null }];
      });
      EventBus.emit('player:joined', p);
    });

    sm.on('player:left', (data) => {
      if (isStaleSubscription()) return;
      const p = data as { playerId: string };
      setOfficeOwnerPreview((prev) => prev && prev.id === p.playerId ? { ...prev, offline: true } : prev);
      setChannelPlayers(prev => {
        const currentOwnerPreview = officeOwnerPreviewRef.current;
        const next = prev.filter(x => x.id !== p.playerId || x.id === currentOwnerPreview?.id);
        const onlineIds = next.map(x => x.id).filter(id => id !== '__self__');
        getOfflinePlayers([character.id, ...onlineIds]).then(setOfflinePlayers).catch(() => {});
        return next;
      });
      EventBus.emit('player:left', p);
    });

    sm.on('presence:sync', (data) => {
      if (isStaleSubscription()) return;
      const state = data as Record<string, PlayerPresence[]>;
      const players = Object.entries(state).map(([id, presences]) => ({
        id,
        name: presences[0]?.name || 'Unknown',
        appearance: (presences[0]?.appearance as CharacterAppearance | LegacyCharacterAppearance | null) || null,
        position: presences[0]?.position,
      }));
      players.forEach(p => {
        if (p.position) remotePlayerPositions.current.set(p.id, p.position);
      });
      setOfficeOwnerPreview((prev) => {
        if (!prev) return prev;
        const liveOwner = players.find((p) => p.id === prev.id);
        return liveOwner
          ? { ...prev, offline: false, appearance: liveOwner.appearance, position: liveOwner.position ?? prev.position }
          : { ...prev, offline: true };
      });
      setChannelPlayers(prev => {
        const self = prev.find(p => p.id === '__self__');
        const currentOwnerPreview = officeOwnerPreviewRef.current;
        const placeholderOwner = currentOwnerPreview && !players.some((p) => p.id === currentOwnerPreview.id)
          ? [{ id: currentOwnerPreview.id, name: currentOwnerPreview.name, appearance: currentOwnerPreview.appearance }]
          : [];
        const others = players.filter(p => p.id !== character.id);
        const next = self ? [self, ...placeholderOwner, ...others.filter((p, index, arr) => arr.findIndex(x => x.id === p.id) === index)] : [...placeholderOwner, ...others];
        const onlineIds = [character.id, ...others.map(x => x.id)];
        getOfflinePlayers(onlineIds).then(setOfflinePlayers).catch(() => {});
        return next;
      });
    });

    sm.on('chat:message', (data) => {
      if (isStaleSubscription()) return;
      const msg = data as ChannelChatMessage;
      setChannelMessages(prev => [...prev, msg]);
      if (!channelChatOpenRef.current) {
        setUnreadChatCount(c => c + 1);
      }
    });

    sm.on('player:moved', (data) => {
      if (isStaleSubscription()) return;
      const { playerId, x, y } = data as { playerId: string; x: number; y: number };
      remotePlayerPositions.current.set(playerId, { x, y });
      EventBus.emit('player:moved', { playerId, x, y });
    });

    sm.subscribe({
      playerId: character.id || 'unknown',
      name: character.name,
      appearance: character.appearance,
      position: savedPos,
    })
      .then(() => {
        if (!isStaleSubscription()) setSupabaseStatus("connected");
      })
      .catch(() => {
        if (!isStaleSubscription()) setSupabaseStatus("error");
      });

    return () => {
      sm.disconnect();
      if (supabaseMultiplayer.current === sm) {
        supabaseMultiplayer.current = null;
      }
    };
  }, [character, currentOfficeId]);

  useEffect(() => {
    if (!character || !currentOfficeId) return;
    upsertPlayer({
      id: character.id,
      name: character.name,
      appearance: character.appearance,
      office_id: currentOfficeId,
      office_name: currentOfficeName,
      office_owner_id: currentOfficeOwnerId || character.id,
    }).catch(() => {});
  }, [character, currentOfficeId, currentOfficeName, currentOfficeOwnerId]);

  useEffect(() => {
    if (!character || !currentOfficeId) return;
    persistOfficeSnapshot({
      officeId: currentOfficeId,
      officeName: currentOfficeName,
      ownerPlayerId: currentOfficeOwnerId || character.id,
      ownerPlayerName: currentOfficeOwnerName || character.name,
      channel: getOfficeChannel(currentOfficeId),
    }).catch(() => {});
  }, [allTasks, channelNpcs, character, currentOfficeId, currentOfficeName, currentOfficeOwnerId, currentOfficeOwnerName, persistOfficeSnapshot]);

  useEffect(() => {
    if (!showTaskBoard) return;
    refreshChannelTasks();
  }, [showTaskBoard, refreshChannelTasks]);

  // Keep ref in sync with channelChatOpen for use in callbacks
  useEffect(() => {
    channelChatOpenRef.current = channelChatOpen;
    if (channelChatOpen) setUnreadChatCount(0); // Clear unread when opened (M6)
  }, [channelChatOpen]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-roster-menu-root]") && !target?.closest("[data-roster-action-menu-root]")) {
        setShowRosterMenu(null);
        setRosterActionMenu(null);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, []);

  // Shared dialog state reset
  const resetDialog = useCallback(() => {
    setDialogNpc(null);
    dialogNpcRef.current = null;
    setNpcMessages([]);
    npcMessagesRef.current = [];
    setIsNpcStreaming(false);
    setNpcSelectList(null);
    streamBufferRef.current = "";
  }, []);

  // Keep refs in sync with state for use in handlers
  useEffect(() => { npcMessagesRef.current = npcMessages; }, [npcMessages]);

  // Listen for NPC interact event from GameScene
  useEffect(() => {
    const handleNpcInteract = (data: { npcId: string; npcName: string }) => {
      resetDialog();
      // If NPC has a stored greeting, show it as the first message
      const greeting = npcGreetings.current.get(data.npcId);
      if (greeting) {
        setNpcMessages([{ role: "npc", content: greeting }]);
        npcGreetings.current.delete(data.npcId);
      }
      dialogNpcRef.current = data;
      setDialogNpc(data);
      EventBus.emit("dialog:open");
      EventBus.emit("npc:bubble-clear", { npcId: data.npcId });
      // Load NPC chat history from localStorage
      const history = getNpcChat(data.npcId);
      const historyMessages = history.map<NpcChatMessage>(m => ({
        role: m.role === "player" ? "player" : "npc",
        content: m.content,
      }));
      if (historyMessages.length > 0) {
        setNpcMessages(historyMessages);
      }
    };

    const handleNpcSelect = (data: { npcs: { npcId: string; npcName: string }[] }) => {
      setNpcSelectList(data.npcs);
    };

    const handleInteractSelect = (data: { targets: { id: string; name: string; type: "npc" | "player"; offline?: boolean }[] }) => {
      setInteractSelectList(data.targets);
    };

    // NPC dialog auto-close (when walking away from NPC)
    const handleNpcDialogAutoClose = () => {
      resetDialog();
      setInteractSelectList(null);
      EventBus.emit("dialog:close");
    };

    // Channel chat input enable/disable based on player proximity
    const handleChatInputEnabled = (enabled: boolean) => {
      setChannelChatInputDisabled(!enabled);
    };

    const handlePlayerChatOpen = (data?: { playerId?: string; playerName?: string; offline?: boolean }) => {
      resetDialog();
      if (data?.playerId && data.offline) {
        setOfflineMsgTarget({ id: data.playerId, name: data.playerName || "Player" });
        setOfflineMsgText("");
        setChannelChatOpen(false);
        setChannelChatInputDisabled(true);
        setUnreadChatCount(0);
        EventBus.emit("dialog:open");
        return;
      }
      setChannelChatOpen(true);
      setChannelChatInputDisabled(false);
      setUnreadChatCount(0);
      EventBus.emit("dialog:open");
    };

    const handleNpcAutoGreet = (data: { npcId: string; npcName: string }) => {
      const greeting = t("game.npcGreeting", { name: data.npcName });
      npcGreetings.current.set(data.npcId, greeting);
      EventBus.emit("npc:bubble", { npcId: data.npcId });
      showToastNotification(`greet-${data.npcId}-${Date.now()}`, t("game.npcGreeting", { name: data.npcName }));
    };

    const handleToastShow = (data: { message: string }) => {
      // Cancel any auto-clear timer so proximity toast persists until toast:hide
      if (toastTimerRef.current) { clearTimeout(toastTimerRef.current); toastTimerRef.current = null; }
      setToastMessage(data.message);
    };
    const handleToastHide = () => {
      if (toastTimerRef.current) { clearTimeout(toastTimerRef.current); toastTimerRef.current = null; }
      setToastMessage(null);
    };

    const handleContextMenu = (data: { npcId: string; npcName: string; screenX: number; screenY: number; moveState: string }) => {
      setContextMenu({
        npcId: data.npcId,
        npcName: data.npcName,
        x: data.screenX,
        y: data.screenY,
        moveState: data.moveState,
      });
    };

    const handlePlayerContextMenu = (data: { playerId: string; playerName: string; screenX: number; screenY: number; offline?: boolean }) => {
      setContextMenu(null);
      setRosterActionMenu({
        type: "player",
        playerId: data.playerId,
        playerName: data.playerName,
        x: data.screenX,
        y: data.screenY,
      });
      if (data.playerId && officeOwnerPreviewRef.current?.id === data.playerId) {
        setOfficeOwnerPreview((prev) => prev ? { ...prev, offline: data.offline ?? prev.offline } : prev);
      }
    };

    const handleMovementStarted = (data: { npcId: string }) => {
      setNpcMoveStates(prev => ({ ...prev, [data.npcId]: "moving-to-player" }));
    };
    const handleMovementArrived = (data: {
      npcId: string;
      npcName?: string;
      reportId?: string;
      reportKind?: string;
    }) => {
      setNpcMoveStates(prev => ({ ...prev, [data.npcId]: "waiting" }));
      if (data.reportId) {
        return;
      }
      // Auto-open dialog when NPC arrives — preserve existing messages (don't resetDialog)
      if (data.npcName) {
        const nextDialogNpc = { npcId: data.npcId, npcName: data.npcName };
        dialogNpcRef.current = nextDialogNpc;
        setDialogNpc(nextDialogNpc);
        EventBus.emit("dialog:open");
        EventBus.emit("npc:bubble-clear", { npcId: data.npcId });
        // Load history from localStorage
        const history = getNpcChat(data.npcId);
        const historyMessages = history.map<NpcChatMessage>(m => ({
          role: m.role === "player" ? "player" : "npc",
          content: m.content,
        }));
        if (historyMessages.length > 0) {
          setNpcMessages(historyMessages);
        }
      }
    };
    const handleMovementReturned = (data: { npcId: string }) => {
      setNpcMoveStates(prev => ({ ...prev, [data.npcId]: "idle" }));
    };

    EventBus.on("npc:interact", handleNpcInteract);
    EventBus.on("npc:select", handleNpcSelect);
    EventBus.on("interact:select", handleInteractSelect);
    EventBus.on("npc:dialog-auto-close", handleNpcDialogAutoClose);
    EventBus.on("chat:input-enabled", handleChatInputEnabled);
    EventBus.on("player:chat-open", handlePlayerChatOpen);
    EventBus.on("npc:auto-greet", handleNpcAutoGreet);
    EventBus.on("toast:show", handleToastShow);
    EventBus.on("toast:hide", handleToastHide);
    EventBus.on("npc:context-menu", handleContextMenu);
    EventBus.on("player:context-menu", handlePlayerContextMenu);
    EventBus.on("npc:call-to-player", handleMovementStarted);
    EventBus.on("npc:movement-arrived", handleMovementArrived);
    EventBus.on("npc:movement-returned", handleMovementReturned);
    return () => {
      EventBus.off("npc:interact", handleNpcInteract);
      EventBus.off("npc:select", handleNpcSelect);
      EventBus.off("interact:select", handleInteractSelect);
      EventBus.off("npc:dialog-auto-close", handleNpcDialogAutoClose);
      EventBus.off("chat:input-enabled", handleChatInputEnabled);
      EventBus.off("player:chat-open", handlePlayerChatOpen);
      EventBus.off("npc:auto-greet", handleNpcAutoGreet);
      EventBus.off("toast:show", handleToastShow);
      EventBus.off("toast:hide", handleToastHide);
      EventBus.off("npc:context-menu", handleContextMenu);
      EventBus.off("player:context-menu", handlePlayerContextMenu);
      EventBus.off("npc:call-to-player", handleMovementStarted);
      EventBus.off("npc:movement-arrived", handleMovementArrived);
      EventBus.off("npc:movement-returned", handleMovementReturned);
    };
  }, [resetDialog, showToastNotification, t]);

  const handleDialogClose = useCallback(() => {
    resetDialog();
    EventBus.emit("dialog:close");
  }, [resetDialog]);

  const openRosterActionMenu = useCallback((
    anchorEl: HTMLElement,
    menu: RosterActionMenuInput,
  ) => {
    const rect = anchorEl.getBoundingClientRect();
    const menuWidth = 180;
    const menuHeight = 220;
    const x = Math.max(12, Math.min(rect.right + 8, window.innerWidth - menuWidth - 12));
    const y = Math.max(12, Math.min(rect.top, window.innerHeight - menuHeight - 12));
    setContextMenu(null);
    if (menu.type === "player") {
      setRosterActionMenu({ type: "player", playerId: menu.playerId, playerName: menu.playerName, x, y });
      return;
    }

    setRosterActionMenu({ type: "npc", npcId: menu.npcId, npcName: menu.npcName, x, y });
  }, []);

  const closeRosterMenus = useCallback(() => {
    setShowRosterMenu(null);
    setRosterActionMenu(null);
  }, []);

  const handleCallNpcById = useCallback((npcId: string) => {
    EventBus.emit("npc:call-to-player", { npcId });
    setContextMenu(null);
    closeRosterMenus();
  }, [closeRosterMenus]);

  const handleTalkNpcById = useCallback((npcId: string, npcName: string) => {
    EventBus.emit("npc:approach-and-interact", { npcId, npcName });
    setContextMenu(null);
    closeRosterMenus();
  }, [closeRosterMenus]);

  const handleEditNpcById = useCallback((npcId: string) => {
    EventBus.emit("npc:edit", { npcId });
    setContextMenu(null);
    closeRosterMenus();
  }, [closeRosterMenus]);

  const handleResetNpcChatById = useCallback((npcId: string) => {
    clearNpcChat(npcId);
    if (dialogNpcRef.current?.npcId === npcId) {
      setNpcMessages([]);
      npcMessagesRef.current = [];
    }
    setContextMenu(null);
    closeRosterMenus();
  }, [closeRosterMenus]);

  const handleFireNpcById = useCallback((npcId: string) => {
    EventBus.emit("npc:fire", { npcId });
    setContextMenu(null);
    closeRosterMenus();
  }, [closeRosterMenus]);

  const handleOpenPlayerChat = useCallback((player?: { id: string; name: string; offline?: boolean }) => {
    EventBus.emit("player:chat-open", player ? { playerId: player.id, playerName: player.name, offline: player.offline ?? false } : undefined);
    closeRosterMenus();
  }, [closeRosterMenus]);

  const switchToOffice = useCallback(async (target: {
    officeId: string;
    officeName?: string | null;
    ownerPlayerId: string;
    ownerPlayerName: string;
    ownerAppearance?: CharacterAppearance | LegacyCharacterAppearance | null;
    ownerOffline?: boolean;
    preferredSavedPosition?: { x: number; y: number } | null;
    officeRecord?: PlayerOfficeRecord | null;
  }) => {
    if (!character) return false;

    const currentPosition = playerPositionRef.current;
    if (currentPosition) {
      saveOfficePlayerPosition(currentOfficeIdRef.current, {
        x: Math.round(currentPosition.x),
        y: Math.round(currentPosition.y),
      });
    }

    await persistOfficeSnapshot({
      officeId: currentOfficeIdRef.current,
      officeName: currentOfficeNameRef.current,
      ownerPlayerId: currentOfficeOwnerIdRef.current || character.id,
      ownerPlayerName: currentOfficeOwnerNameRef.current || character.name,
      channel: getOfficeChannel(currentOfficeIdRef.current),
    }).catch(() => {});

    let officeRecord = target.officeRecord ?? await getPlayerOffice(target.officeId);
    if (!officeRecord) {
      try {
        const response = await fetch("/assets/small-office-map.json");
        const mapJson = await response.json();
        officeRecord = {
          office_id: target.officeId,
          owner_player_id: target.ownerPlayerId,
          office_name: target.officeName ?? getDefaultOfficeName(target.ownerPlayerName),
          map_data: mapJson,
          map_config: {
            spawnCol: mapJson.spawnCol ?? 10,
            spawnRow: mapJson.spawnRow ?? 7,
          },
          npcs: [],
        } satisfies PlayerOfficeRecord;
        await upsertPlayerOffice(officeRecord).catch(() => {});
      } catch {
        return false;
      }
    }

    const seed = buildOfficeSnapshotSeedFromRecord({
      office: officeRecord,
      ownerPlayerName: target.ownerPlayerName,
      tasks: getOfficeTasks(target.officeId),
      savedPosition: target.preferredSavedPosition ?? getOfficePlayerPosition(target.officeId),
    });

    saveOfficeChannel(target.officeId, seed.channel!);
    saveOfficeNpcs(target.officeId, seed.npcs);
    saveOfficeTasks(target.officeId, seed.tasks);
    applyOfficeSeed({
      officeId: target.officeId,
      officeName: target.officeName ?? officeRecord.office_name,
      ownerPlayerId: target.ownerPlayerId,
      ownerPlayerName: target.ownerPlayerName,
      ownerAppearance: target.ownerAppearance ?? null,
      ownerOffline: target.ownerOffline ?? false,
      channel: seed.channel,
      npcs: seed.npcs,
      tasks: seed.tasks,
      savedPosition: seed.savedPosition,
    }, character);

    setChannelMessages([]);
    setUnreadChatCount(0);
    await upsertPlayer({
      id: character.id,
      name: character.name,
      appearance: character.appearance,
      office_id: target.officeId,
      office_name: target.officeName ?? officeRecord.office_name,
      office_owner_id: target.ownerPlayerId,
    }).catch(() => {});
    return true;
  }, [applyOfficeSeed, character, persistOfficeSnapshot]);

  const handleReturnToMyOffice = useCallback(async () => {
    if (!character) return;
    const ok = await switchToOffice({
      officeId: homeOfficeId,
      officeName: homeOfficeName,
      ownerPlayerId: character.id,
      ownerPlayerName: character.name,
      preferredSavedPosition: getOfficePlayerPosition(homeOfficeId),
      officeRecord: await getPlayerOffice(homeOfficeId),
    });
    if (!ok) {
      showToastNotification(`return-office-failed-${Date.now()}`, "Failed to load your office.");
    }
    closeRosterMenus();
  }, [character, closeRosterMenus, homeOfficeId, homeOfficeName, showToastNotification, switchToOffice]);

  const handleVisitPlayer = useCallback(async (player: {
    id: string;
    name: string;
    appearance: unknown;
    last_position?: { x: number; y: number } | null;
    office_id?: string | null;
    office_name?: string | null;
    office_owner_id?: string | null;
  }, fallbackPos?: { x: number; y: number } | null) => {
    if (!character) return;

    const targetOfficeId = player.office_id ?? getOfficeIdForPlayer(player.id);
    const ok = await switchToOffice({
      officeId: targetOfficeId,
      officeName: player.office_name ?? getDefaultOfficeName(player.name),
      ownerPlayerId: player.office_owner_id ?? player.id,
      ownerPlayerName: player.name,
      ownerAppearance: player.appearance as CharacterAppearance | LegacyCharacterAppearance | null,
      ownerOffline: false,
      preferredSavedPosition: fallbackPos ?? player.last_position,
    });

    if (!ok) {
      showToastNotification(`visit-player-failed-${player.id}`, "Office snapshot is not available yet.");
    }
    closeRosterMenus();
  }, [character, closeRosterMenus, showToastNotification, switchToOffice]);

  const handleVisitOfflinePlayer = useCallback(async (player: PlayerRecord) => {
    const targetOfficeId = player.office_id ?? getOfficeIdForPlayer(player.id);
    const ok = await switchToOffice({
      officeId: targetOfficeId,
      officeName: player.office_name ?? getDefaultOfficeName(player.name),
      ownerPlayerId: player.office_owner_id ?? player.id,
      ownerPlayerName: player.name,
      ownerAppearance: player.appearance as CharacterAppearance | LegacyCharacterAppearance | null,
      ownerOffline: true,
      preferredSavedPosition: player.last_position,
    });

    if (!ok) {
      showToastNotification(`offline-no-office-${player.id}`, "Offline office snapshot is not available yet.");
    }
    closeRosterMenus();
  }, [closeRosterMenus, showToastNotification, switchToOffice]);

  const handleSendOfflineMessage = useCallback(async () => {
    if (!offlineMsgTarget || !offlineMsgText.trim() || !character) return;
    setOfflineMsgSending(true);
    const ok = await sendOfflineMessage({
      toPlayerId: offlineMsgTarget.id,
      fromPlayerId: character.id,
      fromPlayerName: character.name,
      content: offlineMsgText.trim(),
    });
    setOfflineMsgSending(false);
    if (ok) {
      showToastNotification(`offline-msg-sent-${Date.now()}`, t("game.leaveMessageSent"));
      setOfflineMsgTarget(null);
      setOfflineMsgText("");
    } else {
      showToastNotification(`offline-msg-fail-${Date.now()}`, t("game.leaveMessageFailed"));
    }
  }, [offlineMsgTarget, offlineMsgText, character, showToastNotification, t]);

  const handleMarkInboxRead = useCallback(async () => {
    const ids = inbox.map(m => m.id);
    await markMessagesRead(ids);
    setInbox([]);
    setShowInbox(false);
  }, [inbox]);

  // H1: Toggle map editor — state is now driven by editor:state event from GameScene
  const handleToggleMapEditor = useCallback(() => {
    EventBus.emit("toggle-editor");
  }, []);

  const handleEditCharacter = useCallback(() => {
    closeRosterMenus();
    router.push("/setup");
  }, [closeRosterMenus, router]);

  const handleStartPositionSetting = useCallback(() => {
    if (!isOwner || mode !== "office") return;
    setSpawnSetMode(true);
    closeRosterMenus();
  }, [closeRosterMenus, isOwner, mode]);

  const handleSelectNpc = useCallback((npcId: string, npcName: string) => {
    resetDialog();
    const nextDialogNpc = { npcId, npcName };
    dialogNpcRef.current = nextDialogNpc;
    setDialogNpc(nextDialogNpc);
    EventBus.emit("dialog:open");
    EventBus.emit("npc:bubble-clear", { npcId });
    // Load NPC chat history from localStorage
    const history = getNpcChat(npcId);
    const historyMessages = history.map<NpcChatMessage>(m => ({
      role: m.role === "player" ? "player" : "npc",
      content: m.content,
    }));
    if (historyMessages.length > 0) {
      setNpcMessages(historyMessages);
    }
  }, [resetDialog]);

  const handleDialogSend = useCallback(async (message: string, files?: File[]) => {
    if (!dialogNpc || isNpcStreaming) return;

    const displayMessage = files?.length
      ? `${message}\n📎 ${files.map(f => f.name).join(", ")}`
      : message;
    setNpcMessages(prev => [...prev, { role: "player", content: displayMessage }]);
    streamBufferRef.current = "";
    setIsNpcStreaming(true);

    // Get NPC's agent config from localStorage
    const npcs = getScopedNpcs();
    const npc = npcs.find(n => n.id === dialogNpc.npcId);
    if (!npc) { setIsNpcStreaming(false); return; }

    // Append to localStorage history
    appendNpcChat(dialogNpc.npcId, { role: "player", content: message, timestamp: Date.now() });

    // Build messages array from history
    const history = getNpcChat(dialogNpc.npcId);
    const messages = history.slice(-20).map(m => ({
      role: m.role === "player" ? "user" as const : "assistant" as const,
      content: m.content,
    }));

    // ── Memory: build context from server-side store ──────────────
    let memorySystemPrompt = npc.agentConfig.systemPrompt;
    try {
      const memRes = await fetch(`/api/agent-memory?npcId=${encodeURIComponent(dialogNpc.npcId)}`);
      if (memRes.ok) {
        const mem = await memRes.json() as {
          longTerm?: { content: string }[];
          shortTerm?: Record<string, { content: string }[]>;
          userProfile?: { key: string; value: string }[];
        };
        const lines: string[] = [];
        if (mem.longTerm?.length) {
          lines.push("## 장기 기억");
          mem.longTerm.slice(-20).forEach(f => lines.push(`- ${f.content}`));
        }
        if (mem.shortTerm) {
          const todayKey = new Date().toISOString().slice(0, 10);
          const todayEntries = mem.shortTerm[todayKey] ?? [];
          if (todayEntries.length) {
            lines.push("## 오늘의 대화 요약");
            todayEntries.slice(-10).forEach(e => lines.push(`- ${e.content}`));
          }
        }
        if (mem.userProfile?.length) {
          lines.push("## 사용자 프로필");
          mem.userProfile.forEach(e => lines.push(`${e.key}: ${e.value}`));
        }
        if (lines.length) {
          memorySystemPrompt = `${npc.agentConfig.systemPrompt}\n\n${lines.join("\n")}`;
        }
      }
    } catch { /* memory injection is best-effort */ }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, agentConfig: { ...npc.agentConfig, systemPrompt: memorySystemPrompt } }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        showToastNotification("npc-chat-error", errorText || t("game.npcChatDisconnected"));
        setIsNpcStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { setIsNpcStreaming(false); return; }

      const decoder = new TextDecoder();
      let fullResponse = "";
      let pendingSseLine = "";

      const appendNpcStreamText = (text: string) => {
        if (!text) return;
        fullResponse += text;
        streamBufferRef.current = fullResponse;
        const sanitized = sanitizeNpcResponseText(fullResponse, { stripIncompleteTail: true });
        setNpcMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "npc") {
            return [...prev.slice(0, -1), { role: "npc", content: sanitized }];
          }
          return [...prev, { role: "npc", content: sanitized }];
        });
      };

      const processStreamLine = (rawLine: string) => {
        const line = rawLine.trim();
        if (!line) return;

        // Legacy AI SDK text stream format (kept for backwards compatibility)
        if (line.startsWith("0:")) {
          try {
            const text = JSON.parse(line.slice(2));
            if (typeof text === "string") {
              appendNpcStreamText(text);
            }
          } catch {
            // skip malformed legacy chunk
          }
          return;
        }

        // AI SDK 6 UI message stream format: SSE lines like
        // data: {"type":"text-delta","delta":"..."}
        if (!line.startsWith("data:")) return;

        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") return;

        try {
          const event = JSON.parse(payload) as { type?: string; delta?: string; errorText?: string };
          if (event.type === "text-delta" && typeof event.delta === "string") {
            appendNpcStreamText(event.delta);
          } else if (event.type === "error" && event.errorText) {
            showToastNotification("npc-chat-error", event.errorText);
          }
        } catch {
          // skip malformed SSE payload
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        pendingSseLine += decoder.decode(value, { stream: true });
        const lines = pendingSseLine.split("\n");
        pendingSseLine = lines.pop() ?? "";

        for (const line of lines) {
          processStreamLine(line);
        }
      }

      if (pendingSseLine) {
        processStreamLine(pendingSseLine);
      }

      // Finalize response
      const cleanedResponse = sanitizeNpcResponseText(fullResponse);

      // Update the final message with cleaned text
      if (cleanedResponse) {
        setNpcMessages(prev => {
          const lastIdx = prev.length - 1;
          if (lastIdx >= 0 && prev[lastIdx].role === "npc") {
            const updated = [...prev];
            updated[lastIdx] = { role: "npc", content: cleanedResponse };
            return updated;
          }
          return [...prev, { role: "npc", content: cleanedResponse }];
        });
      }

      // Save assistant response to history
      if (cleanedResponse) {
        appendNpcChat(dialogNpc.npcId, { role: "npc", content: cleanedResponse, timestamp: Date.now() });
      }

      // ── Memory: extract and persist (fire-and-forget) ──────────
      if (cleanedResponse && npc.agentConfig.apiKey) {
        const npcIdForMemory = dialogNpc.npcId;
        fetch("/api/memory-extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentConfig: npc.agentConfig,
            userMessage: message,
            npcResponse: cleanedResponse,
          }),
        })
          .then(r => r.json())
          .then((extracted: { longTerm?: string[]; shortTerm?: string[]; userProfile?: { key: string; value: string }[] }) => {
            if (extracted.longTerm?.length || extracted.shortTerm?.length || extracted.userProfile?.length) {
              fetch("/api/agent-memory", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  npcId: npcIdForMemory,
                  longTerm: extracted.longTerm ?? [],
                  shortTerm: extracted.shortTerm ?? [],
                  userProfile: extracted.userProfile ?? [],
                }),
              }).catch(() => {});
            }
          })
          .catch(() => {});
      }

      // Task parsing from extractTaskBlocks
      try {
        const { extractTaskBlocks } = await import("@/lib/task-block-utils.js");
        const { taskPayloads } = extractTaskBlocks(fullResponse);
        for (const taskPayload of taskPayloads) {
          const tp = taskPayload as { id?: string; title?: string; summary?: string };
          if (!tp.title) continue;
          const localTask = {
            id: crypto.randomUUID(),
            npcTaskId: tp.id || crypto.randomUUID(),
            npcId: dialogNpc.npcId,
            npcName: dialogNpc.npcName,
            title: tp.title,
            summary: tp.summary || null,
            status: "pending" as const,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          upsertOfficeTask(currentOfficeIdRef.current, localTask);
          setAllTasks(prev => {
            const existing = prev.findIndex(t => t.id === localTask.id);
            if (existing >= 0) { const u = [...prev]; u[existing] = localTask; return u; }
            return [localTask, ...prev];
          });
        }
      } catch {
        // task-block-utils may not export extractTaskBlocks, skip silently
      }

    } catch (err) {
      console.error("NPC chat error:", err);
      showToastNotification("npc-chat-error", t("game.npcChatDisconnected"));
    } finally {
      setIsNpcStreaming(false);
      streamBufferRef.current = "";
    }
  }, [dialogNpc, isNpcStreaming, showToastNotification, t]);

  const handleChannelChatSend = useCallback((message: string) => {
    const msg: ChannelChatMessage = {
      id: crypto.randomUUID(),
      senderId: character?.id || "local",
      sender: character?.name || "나",
      content: message,
      timestamp: Date.now(),
    };
    setChannelMessages(prev => [...prev, msg]);
    EventBus.emit("chat:bubble", { senderId: msg.senderId });
    // Broadcast to all players across machines
    supabaseMultiplayer.current?.emit('chat:message', msg as unknown as Record<string, unknown>).catch(console.error);
  }, [character]);

  // Emit owner status when scene is ready
  useEffect(() => {
    const onSceneReady = () => {
      EventBus.emit("owner-status", { isOwner });
      if (officeOwnerPreview && officeOwnerPreview.id !== character?.id) {
        EventBus.emit("player:joined", {
          playerId: officeOwnerPreview.id,
          name: officeOwnerPreview.name,
          appearance: officeOwnerPreview.appearance,
          position: officeOwnerPreview.position ?? undefined,
          offline: officeOwnerPreview.offline,
        });
      }
    };
    EventBus.on("scene-ready", onSceneReady);
    return () => { EventBus.off("scene-ready", onSceneReady); };
  }, [character?.id, isOwner, officeOwnerPreview]);

  // Forward local player movement to Supabase for cross-machine sync
  // Also throttle position writes to player_registry (max once per 15s)
  useEffect(() => {
    const onPlayerMoved = (data: unknown) => {
      const { playerId, x, y } = data as { playerId: string; x: number; y: number };
      supabaseMultiplayer.current?.emit('player:moved', { playerId, x, y }).catch(() => {});
      supabaseMultiplayer.current?.updatePresence({ position: { x, y } }).catch(() => {});
      saveOfficePlayerPosition(currentOfficeIdRef.current, { x, y });
      // Throttled registry update
      const now = Date.now();
      if (now - positionUpdateTimerRef.current > 15_000) {
        positionUpdateTimerRef.current = now;
        updatePlayerPosition(playerId, x, y).catch(() => {});
      }
    };
    EventBus.on('player:moved-local', onPlayerMoved);
    return () => { EventBus.off('player:moved-local', onPlayerMoved); };
  }, []);

  // Placement mode coordination
  useEffect(() => {
    if (placementMode && pendingNpc) {
      EventBus.emit("placement-mode-start", pendingNpc);
    }
    const onPlacementComplete = async (data: { col: number; row: number }) => {
      if (!pendingNpc) return;
      try {
        const newNpc: LocalNpc = {
          id: crypto.randomUUID(),
          name: pendingNpc.name,
          positionX: data.col,
          positionY: data.row,
          direction: pendingNpc.direction || "down",
          appearance: pendingNpc.appearance,
          agentConfig: {
            provider: (pendingNpc.provider as "openai" | "anthropic" | "google") || "openai",
            model: pendingNpc.model || "gpt-4o",
            apiKey: pendingNpc.apiKey || "",
            systemPrompt: pendingNpc.systemPrompt || pendingNpc.persona || "",
            files: pendingNpc.files ?? [],
          },
        };
        addOfficeNpc(currentOfficeIdRef.current, newNpc);
        setChannelNpcs(prev => [...prev, { id: newNpc.id, name: newNpc.name, appearance: newNpc.appearance }]);
        EventBus.emit("npc:spawn-local", newNpc);
        // Broadcast to other tabs
        localMultiplayer.current?.emit("npc:added", { officeId: currentOfficeIdRef.current, npc: newNpc });
      } catch (err) {
        console.error("Failed to place NPC:", err);
        showToastNotification(
          "npc-place-error",
          err instanceof Error ? err.message : t("errors.failedToCreateNpc"),
        );
      }
      finally { setPlacementMode(false); setPendingNpc(null); EventBus.emit("placement-mode-end"); }
    };
    const onPlacementCancel = () => { setPlacementMode(false); setPendingNpc(null); };
    EventBus.on("placement-complete", onPlacementComplete);
    EventBus.on("placement-cancel", onPlacementCancel);
    return () => { EventBus.off("placement-complete", onPlacementComplete); EventBus.off("placement-cancel", onPlacementCancel); };
  }, [placementMode, pendingNpc, showToastNotification, t]);

  // Spawn set mode coordination
  useEffect(() => {
    if (spawnSetMode) {
      EventBus.emit("spawn-set-mode-start");
    }
    const onSpawnSelected = async (data: { col: number; row: number }) => {
      showToastNotification("spawn-set", t("game.spawnSetSuccess", { col: data.col, row: data.row }));
      setSpawnSetMode(false);
      EventBus.emit("spawn-set-mode-end");
    };
    const onSpawnCancel = () => {
      setSpawnSetMode(false);
      EventBus.emit("spawn-set-mode-end");
    };
    EventBus.on("spawn:selected", onSpawnSelected);
    EventBus.on("spawn-set-cancel", onSpawnCancel);
    return () => {
      EventBus.off("spawn:selected", onSpawnSelected);
      EventBus.off("spawn-set-cancel", onSpawnCancel);
    };
  }, [spawnSetMode, showToastNotification, t]);

  // NPC management listeners (edit / fire)
  useEffect(() => {
    const onNpcEdit = async (data: { npcId: string }) => {
      const npcs = getScopedNpcs();
      const npc = npcs.find(n => n.id === data.npcId);
      if (!npc) return;
      setEditingNpc({
        id: npc.id,
        name: npc.name,
        persona: npc.agentConfig.systemPrompt,
        appearance: npc.appearance,
        direction: npc.direction,
        agentId: npc.agentConfig.provider + ":" + npc.agentConfig.model,
        agentConfig: npc.agentConfig,
      });
      setShowHireModal(true);
    };

    const onNpcFire = async (data: { npcId: string }) => {
      if (!confirm(t("game.fireNpcConfirm"))) return;
      const firedNpcId = data.npcId;
      removeOfficeNpc(currentOfficeIdRef.current, firedNpcId);
      removeOfficeTasksForNpc(currentOfficeIdRef.current, firedNpcId);
      setChannelNpcs(prev => prev.filter(n => n.id !== firedNpcId));
      setAllTasks(prev => prev.filter(t => t.npcId !== firedNpcId));
      EventBus.emit("npc:remove-local", { npcId: firedNpcId });
      localMultiplayer.current?.emit("npc:removed", { officeId: currentOfficeIdRef.current, npcId: firedNpcId });
    };
    EventBus.on("npc:edit", onNpcEdit);
    EventBus.on("npc:fire", onNpcFire);
    return () => { EventBus.off("npc:edit", onNpcEdit); EventBus.off("npc:fire", onNpcFire); };
  }, [t]);

  // NPC context menu handlers
  const handleCallNpc = useCallback(() => {
    if (!contextMenu) return;
    handleCallNpcById(contextMenu.npcId);
  }, [contextMenu, handleCallNpcById]);

  const handleContextTalk = useCallback(() => {
    if (!contextMenu) return;
    handleTalkNpcById(contextMenu.npcId, contextMenu.npcName);
  }, [contextMenu, handleTalkNpcById]);

  const handleReturnNpc = useCallback((npcId: string) => {
    EventBus.emit("npc:start-return", { npcId });
    setContextMenu(null);
    closeRosterMenus();
  }, [closeRosterMenus]);

  // ESC key to close context menu
  // Persist map edits made in the Phaser editor to localStorage
  useEffect(() => {
    const onMapSaved = (mapData: unknown) => {
      // GameScene emits { tiledJson } when in tiledMode, or { layers, objects } in legacy mode.
      // We wrap it as { tiledJson } so reloading can extract tiledJson from mapData.tiledJson.
      const data = mapData as Record<string, unknown>;
      const toSave = data?.tiledJson ? { tiledJson: data.tiledJson } : mapData;
      const channel: LocalChannel = {
        id: currentOfficeIdRef.current,
        name: currentOfficeNameRef.current,
        mapData: toSave,
        tiledJson: null,
        mapConfig: null,
        mapVersion: OFFICE_MAP_VERSION,
      };
      saveOfficeChannel(currentOfficeIdRef.current, channel);
      persistOfficeSnapshot({
        officeId: currentOfficeIdRef.current,
        officeName: currentOfficeNameRef.current,
        ownerPlayerId: currentOfficeOwnerIdRef.current,
        ownerPlayerName: currentOfficeOwnerNameRef.current,
        channel,
      }).catch(() => {});
    };
    EventBus.on("map:saved", onMapSaved);
    return () => { EventBus.off("map:saved", onMapSaved); };
  }, []);

  // Listen for editor state changes (tileset info for tile picker panel)
  useEffect(() => {
    const onEditorState = (state: { active: boolean; tilesets: TilesetDef[] | null; tiledMode: boolean }) => {
      setEditorModeActive(state.active);
      setEditorTilesets(state.tilesets);
      setEditorTiledMode(state.tiledMode);
    };
    EventBus.on("editor:state", onEditorState);
    return () => { EventBus.off("editor:state", onEditorState); };
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (contextMenu) setContextMenu(null);
        if (rosterActionMenu) setRosterActionMenu(null);
      }
    };
    const preventContextMenu = (e: MouseEvent) => e.preventDefault();
    window.addEventListener("keydown", handleEsc);
    window.addEventListener("contextmenu", preventContextMenu);
    return () => {
      window.removeEventListener("keydown", handleEsc);
      window.removeEventListener("contextmenu", preventContextMenu);
    };
  }, [contextMenu, rosterActionMenu]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="text-xl mb-2">{t("common.loadingGame")}</div>
          <div className="text-gray-400">{t("common.preparingCharacter")}</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="text-xl mb-4 text-red-400">{error}</div>
          <Link
            href="/setup"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded font-semibold"
          >
            {t("common.backToCharacters")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-900 text-white">
      {/* Game canvas — full screen background (hidden when in meeting mode) */}
      <div style={{ visibility: mode === "office" ? "visible" : "hidden", position: mode === "office" ? "relative" : "absolute", pointerEvents: mode === "office" ? "auto" : "none" }}>
        {spritesheetDataUrl && character && gameChannelData && (
          <PhaserGame
            key={`phaser-office-${phaserSceneKey}`}
            spritesheetDataUrl={spritesheetDataUrl}
            localMultiplayer={localMultiplayer.current}
            characterId={character.id}
            characterName={character.name}
            appearance={character.appearance}
            channelInitData={gameChannelData}
          />
        )}
      </div>

      {/* Map Editor — left sidebar */}
      {editorModeActive && (
        <MapEditorPanel
          tilesets={editorTilesets as TilesetDef[] | null}
          tiledMode={editorTiledMode}
          onSave={() => EventBus.emit("editor:save-map")}
        />
      )}

      {/* Spawn set mode banner */}
      {spawnSetMode && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-2 bg-green-900/90 border border-green-500 rounded-lg text-green-100 text-sm shadow-lg">
          <Footprints className="w-4 h-4 text-green-400" />
          <span>{t("game.spawnSetMode")}</span>
          <button
            onClick={() => { setSpawnSetMode(false); EventBus.emit("spawn-set-mode-end"); }}
            className="ml-2 px-2 py-0.5 bg-green-700 hover:bg-green-600 rounded text-xs"
          >
            {t("common.closeEsc")}
          </button>
        </div>
      )}

      {/* Visiting office banner */}
      {visitingOfficeNotice && mode === "office" && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-2 bg-sky-950/90 border border-sky-500/60 rounded-lg text-sky-100 text-sm shadow-lg">
          <Globe className="w-4 h-4 text-sky-300" />
          <span>{visitingOfficeNotice}</span>
          <button
            onClick={handleReturnToMyOffice}
            className="px-2 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-xs font-semibold"
          >
            Return to My Office
          </button>
        </div>
      )}

      {/* Top bar — floating over game */}
      <div className="fixed top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-black/50 backdrop-blur-sm">
        {/* Left: Channel name — Character name */}
        <h1 className="text-lg font-bold">
          VieworksRPG &mdash; {currentOfficeName} &mdash; {character?.name}
        </h1>

        {/* Right: grouped controls */}
        <div className="flex items-center gap-1.5">
          {/* Supabase status indicator (H4) */}
          {supabaseStatus === "connecting" && (
            <span className="text-micro text-text-dim flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
              {t("game.supabaseConnecting")}
            </span>
          )}
          {supabaseStatus === "error" && (
            <span className="text-micro text-danger flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-danger" />
              {t("game.supabaseError")}
            </span>
          )}

          {/* Roster buttons */}
          <div className="relative" data-roster-menu-root>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setRosterActionMenu(null);
                  setShowRosterMenu((prev) => prev === "players" ? null : "players");
                }}
                className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-caption text-text-secondary"
              >
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                {(unreadChatCount > 0 || inbox.length > 0) && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-danger text-white text-micro rounded-full flex items-center justify-center px-1 font-bold">
                    {(unreadChatCount + inbox.length) > 9 ? "9+" : (unreadChatCount + inbox.length)}
                  </span>
                )}
                <span>{t("game.playersOnlineCount", { count: channelPlayers.length })}</span>
              </button>
              <button
                onClick={() => {
                  setRosterActionMenu(null);
                  setShowRosterMenu((prev) => prev === "npcs" ? null : "npcs");
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-caption text-text-secondary"
              >
                <span className="w-2 h-2 rounded-full bg-violet-400" />
                <span>{t("game.npcsAtWorkCount", { count: channelNpcs.length })}</span>
              </button>
              {/* Player directory button */}
              <button
                onClick={() => { setShowDirectory(true); closeRosterMenus(); }}
                className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-caption text-text-secondary"
                title={t("game.playerDirectory")}
              >
                <Search className="w-3 h-3" />
                {inbox.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 bg-amber-500 text-white text-micro rounded-full flex items-center justify-center px-0.5 font-bold">
                    {inbox.length > 9 ? "9+" : inbox.length}
                  </span>
                )}
              </button>
            </div>

            {showRosterMenu && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-surface border border-border rounded-lg shadow-xl z-50 overflow-hidden">
                <div className="px-3 py-2 border-b border-border text-caption text-text-dim flex items-center justify-between gap-2">
                  <span>
                    {showRosterMenu === "players" ? t("game.playersOnlineCount", { count: channelPlayers.length }) : t("game.npcsAtWorkCount", { count: channelNpcs.length })}
                  </span>
                  {showRosterMenu === "npcs" && isOwner && mode === "office" && (
                    <button
                      onClick={() => {
                        setShowHireModal(true);
                        closeRosterMenus();
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary/80 hover:bg-primary text-white text-micro font-semibold"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>{t("game.hireNpc")}</span>
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto py-1">
                  {showRosterMenu === "players" ? (
                    <>
                      {/* Online players */}
                      {channelPlayers.length > 0 ? channelPlayers.map((player) => (
                        player.id === "__self__" ? (
                          <div key={player.id} className="px-3 py-2 text-body text-text-secondary flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                            <RosterAvatar appearance={player.appearance} />
                            <span className="truncate">{player.name}</span>
                            <span className="ml-auto text-micro text-text-dim">{t("game.you")}</span>
                          </div>
                        ) : (
                          <div key={player.id} className="px-3 py-2 text-body text-text-secondary hover:bg-surface-raised flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                            <RosterAvatar appearance={player.appearance} />
                            <span className="truncate flex-1">{player.name}</span>
                            <button
                              onClick={() => handleVisitPlayer(player)}
                              className="px-2 py-0.5 rounded text-micro bg-primary/70 hover:bg-primary text-white font-semibold shrink-0"
                            >
                              {t("game.visitPlayer")}
                            </button>
                          </div>
                        )
                      )) : (
                        <div className="px-3 py-2 text-caption text-text-dim">{t("game.noPlayersOnline")}</div>
                      )}

                      {/* Inbox section */}
                      {inbox.length > 0 && (
                        <>
                          <div className="px-3 py-1.5 border-t border-border flex items-center justify-between">
                            <span className="text-micro font-semibold text-amber-400 uppercase tracking-wide">
                              {t("game.inbox")} ({inbox.length})
                            </span>
                            <button
                              onClick={handleMarkInboxRead}
                              className="text-micro text-text-dim hover:text-text-secondary"
                            >
                              {t("game.inboxMarkRead")}
                            </button>
                          </div>
                          {inbox.map(msg => (
                            <div key={msg.id} className="px-3 py-2 bg-amber-500/5 border-l-2 border-amber-500/40">
                              <div className="text-micro text-amber-400 mb-0.5">{t("game.inboxFrom", { name: msg.from_player_name })}</div>
                              <div className="text-caption text-text-secondary break-words">{msg.content}</div>
                              <div className="text-micro text-text-dim mt-0.5">{new Date(msg.created_at).toLocaleString()}</div>
                            </div>
                          ))}
                        </>
                      )}

                      {/* Offline players section */}
                      {offlinePlayers.length > 0 && (
                        <>
                          <div className="px-3 py-1.5 border-t border-border">
                            <span className="text-micro font-semibold text-text-dim uppercase tracking-wide">{t("game.offlinePlayers")}</span>
                          </div>
                          {offlinePlayers.map(player => (
                            <div key={player.id} className="px-3 py-2 text-body text-text-dim hover:bg-surface-raised flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-500 shrink-0" />
                              <RosterAvatar appearance={player.appearance as CharacterAppearance | LegacyCharacterAppearance | null} />
                              <span className="truncate flex-1">{player.name}</span>
                              <button
                                onClick={() => handleVisitOfflinePlayer(player)}
                                className="px-2 py-0.5 rounded text-micro bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold shrink-0"
                              >
                                {t("game.visitOffline")}
                              </button>
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  ) : (
                    channelNpcs.length > 0 ? channelNpcs.map((npc) => (
                      <button
                        key={npc.id}
                        onClick={(event) => openRosterActionMenu(event.currentTarget, {
                          type: "npc",
                          npcId: npc.id,
                          npcName: npc.name,
                        })}
                        className="w-full px-3 py-2 text-body text-text-secondary hover:bg-surface-raised flex items-center gap-2 text-left"
                      >
                        <RosterAvatar appearance={npc.appearance as CharacterAppearance | LegacyCharacterAppearance | null} />
                        <span className="truncate">{npc.name}</span>
                      </button>
                    )) : (
                      <div className="px-3 py-3 text-caption text-text-dim">{t("game.noNpcsAtWork")}</div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Mode toggle */}
          <button
            onClick={() => setMode(mode === "office" ? "meeting" : "office")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-caption font-semibold ${
              mode === "meeting"
                ? "bg-primary hover:bg-primary-hover text-white"
                : "bg-meeting/80 hover:bg-meeting text-white"
            }`}
          >
            <Users className="w-3 h-3" />
            {mode === "office" ? t("game.meetingRoom") : t("common.back")}
            <span className="bg-white/20 px-1.5 rounded-full text-micro">{meetingMinutesCount}</span>
          </button>

          {/* Tasks button */}
          <button
            onClick={() => setShowTaskBoard(true)}
            className="flex items-center gap-1 px-2.5 py-1 bg-primary/80 hover:bg-primary text-white rounded-md text-caption font-semibold"
          >
            <ClipboardList className="w-3 h-3" /> {t("game.tasks")}
            {(() => {
              const n = allTasks.filter((t) => t.status === "in_progress" || t.status === "pending").length;
              return <span className="bg-white/20 px-1.5 rounded-full text-micro">{n}</span>;
            })()}
          </button>

          {/* Map editor toggle button (H1) */}
          {mode === "office" && isOwner && (
            <button
              onClick={handleToggleMapEditor}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-caption font-semibold ${
                editorModeActive
                  ? "bg-amber-500/80 hover:bg-amber-500 text-white"
                  : "bg-white/5 hover:bg-white/10 border border-white/10 text-text-secondary hover:text-white"
              }`}
              title="TAB"
            >
              <Pencil className="w-3 h-3" />
              {editorModeActive ? t("game.mapEditorActive") : t("game.mapEditor")}
            </button>
          )}

          {/* Separator */}
          <div className="w-px h-5 bg-border" />

          {/* Unified menu dropdown */}
          <div className="relative">
            <button
              onClick={() => { setShowUserMenu(!showUserMenu); }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-caption text-text-secondary hover:text-white hover:bg-white/10 relative"
            >
              <Settings className="w-3.5 h-3.5" />
              {t("game.menuSettings")}
              {notifications.some((n) => !n.read) && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-danger rounded-full" />
              )}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-xl w-56 z-50 py-1">
                {/* Notifications section */}
                <div className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => setNotificationsExpanded((prev) => !prev)}
                    className="w-full flex items-center justify-between text-caption text-text-dim hover:text-text-secondary"
                  >
                    <span className="flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5" />
                      {t("game.notifications")}
                      {notifications.some((n) => !n.read) && (
                        <span className="bg-danger text-white text-micro px-1.5 rounded-full">
                          {notifications.filter((n) => !n.read).length}
                        </span>
                      )}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform ${notificationsExpanded ? "rotate-180" : ""}`}
                    />
                  </button>
                  {notificationsExpanded && (
                    <div className="mt-2">
                      {notifications.length > 0 && (
                        <div className="flex justify-end mb-1">
                          <button
                            onClick={() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))}
                            className="text-micro text-primary-light hover:text-primary"
                          >
                            {t("game.markAllRead")}
                          </button>
                        </div>
                      )}
                      {notifications.length === 0 ? (
                        <div className="text-caption text-text-dim py-2 text-center">{t("game.noNotifications")}</div>
                      ) : (
                        <div className="max-h-40 overflow-y-auto -mx-1 px-1">
                          {notifications.slice(0, 5).map((n) => (
                            <div
                              key={n.id}
                              className={`py-1.5 text-caption ${n.read ? "text-text-dim" : "text-text-secondary"}`}
                            >
                              <div className="truncate">{n.message}</div>
                              <div className="text-micro text-text-dim">{new Date(n.timestamp).toLocaleTimeString()}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Preferences section */}
                <div className="border-t border-border my-1" />
                <div className="px-4 py-2">
                  <div className="text-caption text-text-dim mb-1 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    {t("common.language")}
                  </div>
                  <select
                    value={locale}
                    onChange={(e) => setLocale(e.target.value as typeof locale)}
                    className="w-full px-2 py-1 bg-surface border border-border rounded text-caption text-text cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary-light"
                  >
                    {LOCALES.map((l) => (
                      <option key={l.code} value={l.code}>{l.label}</option>
                    ))}
                  </select>
                </div>

                <div className="border-t border-border my-1" />
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    handleEditCharacter();
                  }}
                  className="w-full text-left px-4 py-2 text-body text-text-secondary hover:bg-surface-raised hover:text-white flex items-center gap-2"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  {t("game.editCharacter")}
                </button>

                <div className="border-t border-border my-1" />
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    openBugReport();
                  }}
                  className="w-full text-left px-4 py-2 text-body text-text-secondary hover:bg-surface-raised hover:text-white flex items-center gap-2"
                >
                  <Bug className="w-3.5 h-3.5" />
                  {t("game.reportBug")}
                </button>

                {/* Exit section */}
                <div className="border-t border-border my-1" />
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    // Save position before leaving
                    let freshPos: { x: number; y: number } | null = null;
                    const syncHandler = (data: { x: number; y: number }) => { freshPos = data; };
                    EventBus.on("player-position-response", syncHandler);
                    EventBus.emit("request-player-position");
                    EventBus.off("player-position-response", syncHandler);
                    const pos = freshPos ?? playerPositionRef.current;
                    if (pos) savePlayerPosition({ x: Math.round(pos.x), y: Math.round(pos.y) });
                    window.location.href = "/setup";
                  }}
                  className="w-full text-left px-4 py-2 text-body text-text-secondary hover:bg-surface-raised hover:text-white flex items-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  {t("game.leaveChannel")}
                </button>

                <div className="border-t border-border my-1" />
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowAboutModal(true);
                  }}
                  className="w-full text-left px-4 py-2 text-body text-text-secondary hover:bg-surface-raised hover:text-white flex items-center gap-2"
                >
                  <Info className="w-3.5 h-3.5" />
                  {t("game.aboutVieworksRpg")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Click outside to close dropdowns */}
      {showUserMenu && (
        <div
          className="fixed inset-0 z-[9]"
          onClick={() => setShowUserMenu(false)}
        />
      )}

      {showAboutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-surface shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text">{t("about.title")}</h2>
              <button
                onClick={() => setShowAboutModal(false)}
                className="text-text-dim hover:text-text"
                aria-label={t("common.close")}
              >
                &times;
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-[180px_1fr] gap-x-4 gap-y-4 text-sm">
                <div className="text-text-dim">{t("about.version")}</div>
                <div className="text-text">v{APP_VERSION}</div>

                <div className="text-text-dim">{t("about.sourceCode")}</div>
                <a
                  href={SOURCE_CODE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-light hover:text-primary underline underline-offset-2 break-all"
                >
                  {SOURCE_CODE_URL}
                </a>

                <div className="text-text-dim">{t("about.license")}</div>
                <a
                  href={LICENSE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-light hover:text-primary underline underline-offset-2 break-all"
                >
                  LICENSE.md
                </a>

                <div className="text-text-dim">{t("about.thirdPartyLicenses")}</div>
                <div className="space-y-1">
                  <a
                    href={THIRD_PARTY_LICENSES_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-primary-light hover:text-primary underline underline-offset-2"
                  >
                    {t("about.viewThirdPartyLicenses")}
                  </a>
                  <a
                    href={AVATAR_ASSET_CREDITS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-primary-light hover:text-primary underline underline-offset-2"
                  >
                    {t("about.viewAvatarAssetCredits")}
                  </a>
                  <a
                    href={AVATAR_ASSET_LICENSE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-primary-light hover:text-primary underline underline-offset-2"
                  >
                    {t("about.viewAvatarAssetLicenseNotes")}
                  </a>
                </div>

                <div className="text-text-dim">{t("about.instanceId")}</div>
                <div className="text-text break-all">{instanceId || "—"}</div>

                <div className="text-text-dim">{t("about.debug")}</div>
                <button
                  onClick={() => void copyDebugInformation()}
                  className="text-left text-primary-light hover:text-primary underline underline-offset-2"
                >
                  {debugCopied ? t("about.debugCopied") : t("about.copyDebugInformation")}
                </button>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border">
              <button
                onClick={() => setShowAboutModal(false)}
                className="px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-semibold"
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NPC Hire Modal */}
      <NpcHireModal
        isOpen={showHireModal}
        onClose={() => { setShowHireModal(false); setEditingNpc(null); }}
        onPlaceOnMap={(npcData) => {
          setPendingNpc(npcData);
          setPlacementMode(true);
          setShowHireModal(false);
        }}
        onSaveEdit={async (npcId, updates) => {
          try {
            const lsUpdates: Partial<LocalNpc> = {};
            if (updates.name) lsUpdates.name = updates.name;
            if (updates.appearance) lsUpdates.appearance = updates.appearance;
            if (updates.direction) lsUpdates.direction = updates.direction;
            if (updates.provider || updates.model || updates.apiKey || updates.systemPrompt || updates.files) {
              const existing = getScopedNpcs().find(n => n.id === npcId);
              if (existing) {
                lsUpdates.agentConfig = {
                  ...existing.agentConfig,
                  provider: (updates.provider as "openai" | "anthropic" | "google") || existing.agentConfig.provider,
                  model: updates.model || existing.agentConfig.model,
                  apiKey: updates.apiKey || existing.agentConfig.apiKey,
                  systemPrompt: updates.systemPrompt || existing.agentConfig.systemPrompt,
                  files: updates.files ?? existing.agentConfig.files,
                };
              }
            }
            updateOfficeNpc(currentOfficeIdRef.current, npcId, lsUpdates);
            setChannelNpcs(prev => prev.map(n => n.id === npcId ? { ...n, ...lsUpdates } : n));
            const localUpdate = { ...lsUpdates, npcId, officeId: currentOfficeIdRef.current };
            EventBus.emit("npc:update-local", localUpdate);
            localMultiplayer.current?.emit("npc:updated", localUpdate);
            setShowHireModal(false);
            setEditingNpc(null);
          } catch (error) {
            console.error("Failed to save NPC edit:", error);
            showToastNotification(
              `npc-edit-error-${npcId}`,
              error instanceof Error ? error.message : t("npc.saveEditFailed"),
            );
          }
        }}
        editingNpc={editingNpc}
        currentNpcCount={channelNpcs.length}
      />

      <TaskBoard
        channelId={currentOfficeId}
        isOpen={showTaskBoard}
        onClose={() => setShowTaskBoard(false)}
        tasks={allTasks}
        onDeleteTask={deleteTask}
        onRequestReportTask={requestTaskReport}
        onResumeTask={resumeTask}
        onCompleteTask={completeTask}
      />

      {/* Player directory modal */}
      <PlayerDirectoryModal
        isOpen={showDirectory}
        onClose={() => setShowDirectory(false)}
        onlinePlayerIds={channelPlayers.filter(p => p.id !== "__self__").map(p => p.id)}
        selfId={character?.id ?? ""}
        onVisit={(player, isOnline) => {
          setShowDirectory(false);
          if (isOnline) {
            handleVisitPlayer(player, player.last_position);
          } else {
            handleVisitOfflinePlayer(player);
          }
        }}
        onMessage={(player) => {
          setShowDirectory(false);
          setOfflineMsgTarget({ id: player.id, name: player.name });
          setOfflineMsgText("");
        }}
        inbox={inbox}
        onMarkInboxRead={handleMarkInboxRead}
        renderAvatar={(appearance) => <RosterAvatar appearance={appearance} />}
      />

      {/* Offline message dialog */}
      {offlineMsgTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setOfflineMsgTarget(null)}>
          <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-sm mx-4 p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-body font-semibold text-text mb-3">
              {t("game.leaveMessageTitle", { name: offlineMsgTarget.name })}
            </h3>
            <textarea
              className="w-full h-28 bg-gray-800 border border-border rounded-lg px-3 py-2 text-body text-text resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder={t("game.leaveMessagePlaceholder")}
              value={offlineMsgText}
              onChange={e => setOfflineMsgText(e.target.value)}
              maxLength={500}
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setOfflineMsgTarget(null)}
                className="px-3 py-1.5 rounded-lg text-caption text-text-dim hover:bg-surface-raised"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleSendOfflineMessage}
                disabled={!offlineMsgText.trim() || offlineMsgSending}
                className="px-4 py-1.5 rounded-lg text-caption font-semibold bg-primary hover:bg-primary-hover text-white disabled:opacity-40"
              >
                {offlineMsgSending ? "..." : t("game.leaveMessageSend")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Placement mode indicator */}
      {placementMode && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-primary text-white px-4 py-2 rounded-lg shadow-lg text-body font-medium">
          {t("game.placementMode")}
        </div>
      )}

      {mode === "office" && (
        <>
          {/* Interact selection popup */}
          {interactSelectList && (
            <div className="fixed inset-0 z-40" onClick={() => setInteractSelectList(null)}>
              <div
                className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-surface border border-border rounded-lg shadow-xl p-2 min-w-[180px]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-center text-caption text-text-muted px-3 py-1 mb-1">{t("game.whoToTalkTo")}</div>
                {interactSelectList.map((target) => (
                  <button
                    key={`${target.type}-${target.id}`}
                    onClick={() => {
                      setInteractSelectList(null);
                      if (target.type === "npc") {
                        EventBus.emit("npc:interact", { npcId: target.id, npcName: target.name });
                      } else {
                        EventBus.emit("player:chat-open", { playerId: target.id, playerName: target.name, offline: (target as { offline?: boolean }).offline ?? false });
                      }
                    }}
                    className="w-full text-left px-3 py-2 text-body text-text hover:bg-surface-raised rounded flex items-center gap-2"
                  >
                    <span className={`w-2 h-2 rounded-full ${target.type === "npc" ? "bg-npc" : "bg-info"}`} />
                    {target.name}
                    <span className="text-caption text-text-dim ml-auto">{target.type === "npc" ? t("game.typeNpc") : t("game.typePlayer")}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bottom toast */}
          {toastMessage && !interactSelectList && (
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-10 text-text text-body bg-surface/90 backdrop-blur px-5 py-2 rounded-full shadow-lg border border-border/50">
              {toastMessage}
            </div>
          )}

          {/* Left-side chat panel — resizable */}
          <ChatPanel
            dialogNpc={dialogNpc}
            npcMessages={npcMessages}
            isNpcStreaming={isNpcStreaming}
            onSend={handleDialogSend}
            onClose={handleDialogClose}
            npcSelectList={npcSelectList}
            onSelectNpc={handleSelectNpc}
            isOwner={isOwner}
            onEditNpc={(npcId) => EventBus.emit("npc:edit", { npcId })}
            onFireNpc={(npcId) => EventBus.emit("npc:fire", { npcId })}
            onResetNpcChat={(npcId) => {
              clearNpcChat(npcId);
              setNpcMessages([]);
            }}
            channelMessages={channelMessages}
            channelChatOpen={channelChatOpen}
            channelChatInputDisabled={channelChatInputDisabled}
            onSendChannelChat={handleChannelChatSend}
            currentPlayerName={character?.name}
            npcMoveState={dialogNpc ? npcMoveStates[dialogNpc.npcId] : undefined}
            onReturnNpc={dialogNpc ? handleReturnNpc : undefined}
            socket={null}
            onDeleteTask={deleteTask}
            onRequestReportTask={requestTaskReport}
            onResumeTask={resumeTask}
            onCompleteTask={completeTask}
          />
        </>
      )}

      {/* NPC Context Menu */}
      {contextMenu && (() => {
        const currentMoveState = npcMoveStates[contextMenu.npcId] || contextMenu.moveState;
        return <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <div className="bg-surface border border-border rounded-lg shadow-xl py-1 min-w-[140px]">
              {currentMoveState === "idle" && (
                <button
                  onClick={handleCallNpc}
                  className="w-full text-left px-3 py-2 text-body text-npc hover:bg-surface-raised"
                >
                  <PhoneCall className="w-3.5 h-3.5 inline mr-1" />{t("context.call")}
                </button>
              )}
              {currentMoveState === "waiting" && (
                <button
                  onClick={() => { handleReturnNpc(contextMenu.npcId); setContextMenu(null); }}
                  className="w-full text-left px-3 py-2 text-body text-npc hover:bg-surface-raised"
                >
                  <Undo2 className="w-3.5 h-3.5 inline mr-1" />{t("context.return")}
                </button>
              )}
              {currentMoveState !== "idle" && currentMoveState !== "waiting" && (
                <button disabled className="w-full text-left px-3 py-2 text-body text-text-dim cursor-not-allowed">
                  <Footprints className="w-3.5 h-3.5 inline mr-1" />{t("npc.moving")}
                </button>
              )}
              <button
                onClick={handleContextTalk}
                disabled={currentMoveState !== "idle"}
                className={`w-full text-left px-3 py-2 text-body ${
                  currentMoveState === "idle"
                    ? "text-text hover:bg-surface-raised"
                    : "text-text-dim cursor-not-allowed"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 inline mr-1" />{t("context.talk")}
              </button>
              {isOwner && (
                <button
                  onClick={() => handleEditNpcById(contextMenu.npcId)}
                  className="w-full text-left px-3 py-2 text-body text-text hover:bg-surface-raised"
                >
                  <Pencil className="w-3.5 h-3.5 inline mr-1" />{t("context.edit")}
                </button>
              )}
              <button
                onClick={() => handleResetNpcChatById(contextMenu.npcId)}
                className="w-full text-left px-3 py-2 text-body text-text hover:bg-surface-raised"
              >
                <RotateCcw className="w-3.5 h-3.5 inline mr-1" />{t("context.resetChat")}
              </button>
              {isOwner && (
                <button
                  onClick={() => handleFireNpcById(contextMenu.npcId)}
                  className="w-full text-left px-3 py-2 text-body text-danger hover:bg-surface-raised"
                >
                  <UserMinus className="w-3.5 h-3.5 inline mr-1" />{t("context.fire")}
                </button>
              )}
            </div>
          </div>
        </>;
      })()}

      {rosterActionMenu && (() => {
        if (rosterActionMenu.type === "player") {
          return (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setRosterActionMenu(null)} />
              <div
                className="fixed z-50"
                style={{ left: rosterActionMenu.x, top: rosterActionMenu.y }}
                data-roster-action-menu-root
              >
                <div className="bg-surface border border-border rounded-lg shadow-xl py-1 min-w-[160px]">
                  {rosterActionMenu.playerId === "__self__" ? (
                    <>
                      <button
                        onClick={handleEditCharacter}
                        className="w-full text-left px-3 py-2 text-body text-text hover:bg-surface-raised"
                      >
                        <Pencil className="w-3.5 h-3.5 inline mr-1" />{t("game.editCharacter")}
                      </button>
                      {isOwner && mode === "office" && (
                        <button
                          onClick={handleStartPositionSetting}
                          className="w-full text-left px-3 py-2 text-body text-text hover:bg-surface-raised"
                        >
                          <Footprints className="w-3.5 h-3.5 inline mr-1" />{t("game.setStartPosition")}
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => handleOpenPlayerChat({
                        id: rosterActionMenu.playerId,
                        name: rosterActionMenu.playerName,
                        offline: !!officeOwnerPreview && officeOwnerPreview.id === rosterActionMenu.playerId && officeOwnerPreview.offline,
                      })}
                      className="w-full text-left px-3 py-2 text-body text-text hover:bg-surface-raised"
                    >
                      <MessageSquare className="w-3.5 h-3.5 inline mr-1" />{t("context.talk")}
                    </button>
                  )}
                </div>
              </div>
            </>
          );
        }

        const currentMoveState = npcMoveStates[rosterActionMenu.npcId] || "idle";
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setRosterActionMenu(null)} />
            <div
              className="fixed z-50"
              style={{ left: rosterActionMenu.x, top: rosterActionMenu.y }}
              data-roster-action-menu-root
            >
              <div className="bg-surface border border-border rounded-lg shadow-xl py-1 min-w-[160px]">
                {currentMoveState === "idle" && (
                  <button
                    onClick={() => handleCallNpcById(rosterActionMenu.npcId)}
                    className="w-full text-left px-3 py-2 text-body text-npc hover:bg-surface-raised"
                  >
                    <PhoneCall className="w-3.5 h-3.5 inline mr-1" />{t("context.call")}
                  </button>
                )}
                {currentMoveState === "waiting" && (
                  <button
                    onClick={() => handleReturnNpc(rosterActionMenu.npcId)}
                    className="w-full text-left px-3 py-2 text-body text-npc hover:bg-surface-raised"
                  >
                    <Undo2 className="w-3.5 h-3.5 inline mr-1" />{t("context.return")}
                  </button>
                )}
                {currentMoveState !== "idle" && currentMoveState !== "waiting" && (
                  <button disabled className="w-full text-left px-3 py-2 text-body text-text-dim cursor-not-allowed">
                    <Footprints className="w-3.5 h-3.5 inline mr-1" />{t("npc.moving")}
                  </button>
                )}
                <button
                  onClick={() => handleTalkNpcById(rosterActionMenu.npcId, rosterActionMenu.npcName)}
                  disabled={currentMoveState !== "idle"}
                  className={`w-full text-left px-3 py-2 text-body ${
                    currentMoveState === "idle"
                      ? "text-text hover:bg-surface-raised"
                      : "text-text-dim cursor-not-allowed"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 inline mr-1" />{t("context.talk")}
                </button>
                {isOwner && (
                  <button
                    onClick={() => handleEditNpcById(rosterActionMenu.npcId)}
                    className="w-full text-left px-3 py-2 text-body text-text hover:bg-surface-raised"
                  >
                    <Pencil className="w-3.5 h-3.5 inline mr-1" />{t("context.edit")}
                  </button>
                )}
                <button
                  onClick={() => handleResetNpcChatById(rosterActionMenu.npcId)}
                  className="w-full text-left px-3 py-2 text-body text-text hover:bg-surface-raised"
                >
                  <RotateCcw className="w-3.5 h-3.5 inline mr-1" />{t("context.resetChat")}
                </button>
                {isOwner && (
                  <button
                    onClick={() => handleFireNpcById(rosterActionMenu.npcId)}
                    className="w-full text-left px-3 py-2 text-body text-danger hover:bg-surface-raised"
                  >
                    <UserMinus className="w-3.5 h-3.5 inline mr-1" />{t("context.fire")}
                  </button>
                )}
              </div>
            </div>
          </>
        );
      })()}

      {mode === "meeting" && character && (
        <MeetingRoom
          channelId="default"
          character={{
            id: character.id,
            name: character.name,
            appearance: character.appearance,
          }}
          socket={null}
          npcs={channelNpcs}
          onLeave={() => setMode("office")}
        />
      )}
    </div>
  );
}
