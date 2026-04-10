/**
 * local-multiplayer.ts
 * BroadcastChannel-based multiplayer for same-origin tab sync.
 * Replaces Socket.IO for player movement, NPC position sync, and map editing.
 *
 * Design: a thin wrapper that has the same emit/on/off interface as socket.io
 * for the events used in GameScene.ts, so the game scene code requires minimal changes.
 */

type Handler = (data: unknown) => void;

interface BroadcastMessage {
  event: string;
  tabId: string;
  data: unknown;
}

export class LocalMultiplayer {
  private readonly channel: BroadcastChannel;
  private readonly tabId: string;
  private readonly listeners = new Map<string, Set<Handler>>();
  private _connected = true;

  constructor(tabId: string) {
    this.tabId = tabId;
    this.channel = new BroadcastChannel("deskrpg:multiplayer");
    this.channel.onmessage = (ev: MessageEvent<BroadcastMessage>) => {
      const { event, tabId, data } = ev.data;
      // Ignore messages from ourselves
      if (tabId === this.tabId) return;
      this.dispatch(event, data);
    };
  }

  get connected(): boolean {
    return this._connected;
  }

  get id(): string {
    return this.tabId;
  }

  /** Broadcast event to all other tabs */
  emit(event: string, data?: unknown): void {
    try {
      this.channel.postMessage({ event, tabId: this.tabId, data } satisfies BroadcastMessage);
    } catch {
      // Channel closed or context destroyed
    }
  }

  /** Listen for events from other tabs */
  on(event: string, handler: Handler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  off(event: string, handler: Handler): void {
    this.listeners.get(event)?.delete(handler);
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }

  disconnect(): void {
    this._connected = false;
    this.listeners.clear();
    try {
      this.channel.close();
    } catch {
      // ignore
    }
  }

  private dispatch(event: string, data: unknown): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const h of handlers) {
      try {
        h(data);
      } catch (err) {
        console.error("[LocalMultiplayer] handler error", event, err);
      }
    }
  }
}

/** Generate a stable per-tab ID stored in sessionStorage */
export function getTabId(): string {
  if (typeof window === "undefined") return "ssr";
  const key = "deskrpg:tabId";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}
