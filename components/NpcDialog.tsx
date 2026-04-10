"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
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
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSend = useCallback(
    (message: string, files?: File[]) => {
      if (cooldown || isStreaming) return;
      onSend(message, files);
      setCooldown(true);
      setTimeout(() => setCooldown(false), COOLDOWN_MS);
    },
    [cooldown, isStreaming, onSend],
  );

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center pointer-events-none">
      <div className="w-full max-w-[800px] pointer-events-auto">
        <div className="bg-gray-900 border-t-2 border-x-2 border-amber-500 rounded-t-lg shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800 rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-700 flex items-center justify-center text-white font-bold text-lg">
                {npcName[0]}
              </div>
              <span className="text-amber-400 font-bold text-lg">{npcName}</span>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white px-2 py-1 text-sm"
              title={t("common.closeEsc")}
            >
              ESC
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="h-48 overflow-y-auto px-4 py-3 space-y-2">
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

          {/* Input — reuses ChatInput with file upload */}
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
