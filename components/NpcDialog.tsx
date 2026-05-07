"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { Maximize2, Minimize2 } from "lucide-react";
import ChatInput from "./ChatInput";

export interface NpcChatMessage {
  role: "player" | "npc";
  content: string;
}

interface NpcDialogProps {
  npcName: string;
  messages: NpcChatMessage[];
  isStreaming: boolean;
  onSend: (message: string, files?: File[]) => void;
  onClose: () => void;
}

const COOLDOWN_MS = 2000;

export default function NpcDialog({
  npcName,
  messages,
  isStreaming,
  onSend,
  onClose,
}: NpcDialogProps) {
  const t = useT();
  const [cooldown, setCooldown] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ESC to close / collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (expanded) setExpanded(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, expanded]);

  const handleSend = useCallback(
    (message: string, files?: File[]) => {
      if (cooldown || isStreaming) return;
      onSend(message, files);
      setCooldown(true);
      setTimeout(() => setCooldown(false), COOLDOWN_MS);
    },
    [cooldown, isStreaming, onSend],
  );

  if (expanded) {
    // 전체화면 모드
    return (
      <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-700 flex items-center justify-center text-white font-bold text-base">
              {npcName[0]}
            </div>
            <span className="text-amber-400 font-bold text-base">{npcName}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded(false)}
              className="text-gray-400 hover:text-white p-1.5 rounded hover:bg-white/10 transition-colors"
              title="창 축소"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white px-2 py-1 text-sm"
              title={t("common.closeEsc")}
            >
              ESC
            </button>
          </div>
        </div>

        {/* Messages — 전체 공간 사용 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-gray-500 text-sm italic">
              {t("chat.npcPlaceholder", { name: npcName })}
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "player" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[70%] px-4 py-2.5 rounded-xl text-sm leading-relaxed ${
                  msg.role === "player"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-700 text-gray-100"
                }`}
              >
                {msg.content}
                {msg.role === "npc" && isStreaming && i === messages.length - 1 && (
                  <span className="inline-block w-1.5 h-4 bg-amber-400 ml-0.5 animate-pulse" />
                )}
              </div>
            </div>
          ))}
        </div>

        <ChatInput
          onSend={handleSend}
          disabled={isStreaming}
          cooldown={cooldown}
          maxLength={500}
          autoFocus
          showFileUpload
          accentColor="amber"
          placeholder={t("chat.npcPlaceholder", { name: npcName })}
          disabledPlaceholder={t("chat.responding")}
        />
      </div>
    );
  }

  // 기본 하단 패널 모드
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center pointer-events-none">
      <div className="w-full max-w-[800px] pointer-events-auto">
        <div className="bg-gray-900 border-t-2 border-x-2 border-amber-500 rounded-t-lg shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800 rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-700 flex items-center justify-center text-white font-bold text-base">
                {npcName[0]}
              </div>
              <span className="text-amber-400 font-bold text-base">{npcName}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setExpanded(true)}
                className="text-gray-400 hover:text-white p-1.5 rounded hover:bg-white/10 transition-colors"
                title="전체화면으로 확대"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white px-2 py-1 text-sm"
                title={t("common.closeEsc")}
              >
                ESC
              </button>
            </div>
          </div>

          {/* Messages — 유동 높이 (min 160, max 320) */}
          <div
            ref={scrollRef}
            className="overflow-y-auto px-4 py-3 space-y-2"
            style={{ minHeight: 160, maxHeight: 320 }}
          >
            {messages.length === 0 && (
              <div className="text-gray-500 text-sm italic">
                {t("chat.npcPlaceholder", { name: npcName })}
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "player" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                    msg.role === "player"
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-700 text-gray-100"
                  }`}
                >
                  {msg.content}
                  {msg.role === "npc" && isStreaming && i === messages.length - 1 && (
                    <span className="inline-block w-1.5 h-4 bg-amber-400 ml-0.5 animate-pulse" />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <ChatInput
            onSend={handleSend}
            disabled={isStreaming}
            cooldown={cooldown}
            maxLength={500}
            autoFocus
            showFileUpload
            accentColor="amber"
            placeholder={t("chat.npcPlaceholder", { name: npcName })}
            disabledPlaceholder={t("chat.responding")}
          />
        </div>
      </div>
    </div>
  );
}
