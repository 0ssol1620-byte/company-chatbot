"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, X, MessageSquare, Footprints } from "lucide-react";
import { useT } from "@/lib/i18n";
import { getAllPlayers, type PlayerRecord } from "@/lib/player-registry";
import type { OfflineMessage } from "@/lib/player-registry";
import type { CharacterAppearance, LegacyCharacterAppearance } from "@/lib/lpc-registry";

interface DirectoryPlayer extends PlayerRecord {
  isOnline: boolean;
}

interface PlayerDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onlinePlayerIds: string[];          // currently connected player IDs (excl. self)
  selfId: string;
  onVisit: (player: PlayerRecord, isOnline: boolean) => void;
  onMessage: (player: PlayerRecord) => void;
  inbox: OfflineMessage[];
  onMarkInboxRead: () => void;
  // Inline avatar renderer (same as the roster)
  renderAvatar: (appearance: CharacterAppearance | LegacyCharacterAppearance | null) => React.ReactNode;
}

export default function PlayerDirectoryModal({
  isOpen,
  onClose,
  onlinePlayerIds,
  selfId,
  onVisit,
  onMessage,
  inbox,
  onMarkInboxRead,
  renderAvatar,
}: PlayerDirectoryModalProps) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [players, setPlayers] = useState<DirectoryPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"all" | "online" | "offline" | "inbox">("all");

  const reload = useCallback(async () => {
    setLoading(true);
    const all = await getAllPlayers();
    const onlineSet = new Set(onlinePlayerIds);
    setPlayers(
      all
        .filter(p => p.id !== selfId)
        .map(p => ({ ...p, isOnline: onlineSet.has(p.id) }))
        .sort((a, b) => {
          // Online first, then by last_seen desc
          if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
          return new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime();
        })
    );
    setLoading(false);
  }, [onlinePlayerIds, selfId]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setTab("all");
      reload();
    }
  }, [isOpen, reload]);

  if (!isOpen) return null;

  const filtered = players.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );
  const tabFiltered =
    tab === "online" ? filtered.filter(p => p.isOnline) :
    tab === "offline" ? filtered.filter(p => !p.isOnline) :
    tab === "inbox" ? filtered : // inbox doesn't filter players, handled separately
    filtered;

  const onlineCount = players.filter(p => p.isOnline).length;
  const offlineCount = players.filter(p => !p.isOnline).length;

  function formatLastSeen(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 2) return t("game.justNow");
    if (mins < 60) return t("game.minutesAgo", { n: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t("game.hoursAgo", { n: hours });
    const days = Math.floor(hours / 24);
    return t("game.daysAgo", { n: days });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col"
        style={{ maxHeight: "80vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          <h2 className="text-body font-semibold text-text flex-1">{t("game.playerDirectory")}</h2>
          <span className="text-micro text-text-dim">{t("game.playerDirectoryCount", { total: players.length, online: onlineCount })}</span>
          <button onClick={onClose} className="text-text-dim hover:text-text p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2.5 border-b border-border shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-dim pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t("game.playerDirectorySearch")}
              className="w-full pl-8 pr-3 py-1.5 bg-gray-800 border border-border rounded-lg text-body text-text placeholder:text-text-dim focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-dim hover:text-text"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0">
          {(["all", "online", "offline", "inbox"] as const).map(tabId => (
            <button
              key={tabId}
              onClick={() => setTab(tabId)}
              className={`flex-1 py-2 text-caption font-medium transition-colors ${
                tab === tabId
                  ? "text-primary border-b-2 border-primary"
                  : "text-text-dim hover:text-text-secondary"
              }`}
            >
              {tabId === "all" && t("game.dirTabAll", { n: filtered.length })}
              {tabId === "online" && (
                <span className="flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  {t("game.dirTabOnline", { n: onlineCount })}
                </span>
              )}
              {tabId === "offline" && t("game.dirTabOffline", { n: offlineCount })}
              {tabId === "inbox" && (
                <span className="flex items-center justify-center gap-1">
                  {t("game.inbox")}
                  {inbox.length > 0 && (
                    <span className="min-w-[16px] h-4 bg-amber-500 text-white text-micro rounded-full flex items-center justify-center px-1 font-bold">
                      {inbox.length > 9 ? "9+" : inbox.length}
                    </span>
                  )}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Inbox tab */}
          {tab === "inbox" ? (
            inbox.length === 0 ? (
              <div className="px-4 py-8 text-center text-caption text-text-dim">{t("game.inboxEmpty")}</div>
            ) : (
              <div>
                <div className="px-4 py-2 flex justify-end border-b border-border">
                  <button onClick={onMarkInboxRead} className="text-caption text-primary hover:underline">
                    {t("game.inboxMarkRead")}
                  </button>
                </div>
                {inbox.map(msg => (
                  <div key={msg.id} className="px-4 py-3 border-b border-border/50 hover:bg-surface-raised">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-caption font-semibold text-amber-400">{msg.from_player_name}</span>
                      <span className="text-micro text-text-dim ml-auto">{new Date(msg.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-body text-text-secondary break-words">{msg.content}</p>
                  </div>
                ))}
              </div>
            )
          ) : loading ? (
            <div className="px-4 py-8 text-center text-caption text-text-dim">{t("common.loading")}</div>
          ) : tabFiltered.length === 0 ? (
            <div className="px-4 py-8 text-center text-caption text-text-dim">
              {query ? t("game.playerDirectoryNoResults") : t("game.playerDirectoryEmpty")}
            </div>
          ) : (
            tabFiltered.map(player => (
              <div key={player.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border/40 hover:bg-surface-raised">
                {/* Status dot + avatar */}
                <div className="relative shrink-0">
                  {renderAvatar(player.appearance as CharacterAppearance | LegacyCharacterAppearance | null)}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface ${
                      player.isOnline ? "bg-green-400" : "bg-gray-500"
                    }`}
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-body font-medium text-text truncate">{player.name}</div>
                  <div className="text-micro text-text-dim">
                    {player.isOnline
                      ? t("game.statusOnline")
                      : t("game.lastSeen", { time: formatLastSeen(player.last_seen) })}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => onVisit(player, player.isOnline)}
                    title={t("game.visitPlayer")}
                    className={`p-1.5 rounded-lg transition-colors ${
                      player.isOnline
                        ? "bg-primary/80 hover:bg-primary text-white"
                        : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                    }`}
                  >
                    <Footprints className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onMessage(player)}
                    title={t("game.leaveMessage")}
                    className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
