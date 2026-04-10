"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { EventBus, setPendingChannelData, type PendingChannelData } from "@/game/EventBus";
import { compositeCharacter } from "@/lib/sprite-compositor";
import type {
  CharacterAppearance,
  LegacyCharacterAppearance,
} from "@/lib/lpc-registry";
import type { LocalMultiplayer } from "@/lib/local-multiplayer";

interface PhaserGameProps {
  spritesheetDataUrl: string;
  localMultiplayer: LocalMultiplayer | null;
  characterId: string;
  characterName: string;
  appearance: CharacterAppearance | LegacyCharacterAppearance;
  channelInitData: Exclude<PendingChannelData, null>;
}

export default function PhaserGame({
  spritesheetDataUrl,
  localMultiplayer,
  characterId,
  characterName,
  appearance,
  channelInitData,
}: PhaserGameProps) {
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const spritesheetRef = useRef(spritesheetDataUrl);
  const multiplayerRef = useRef(localMultiplayer);
  const characterRef = useRef({ characterId, characterName, appearance });
  const channelInitDataRef = useRef(channelInitData);

  // Keep refs in sync
  spritesheetRef.current = spritesheetDataUrl;
  multiplayerRef.current = localMultiplayer;
  characterRef.current = { characterId, characterName, appearance };
  channelInitDataRef.current = channelInitData;

  useLayoutEffect(() => {
    if (gameRef.current || !containerRef.current) return;

    setPendingChannelData(channelInitDataRef.current);

    // Ensure localStorage is accessible — Phaser accesses it internally.
    try {
      localStorage.getItem("__test__");
    } catch {
      const memStore: Record<string, string> = {};
      Object.defineProperty(window, "localStorage", {
        value: {
          getItem: (k: string) => memStore[k] ?? null,
          setItem: (k: string, v: string) => { memStore[k] = v; },
          removeItem: (k: string) => { delete memStore[k]; },
          clear: () => { Object.keys(memStore).forEach(k => delete memStore[k]); },
          get length() { return Object.keys(memStore).length; },
          key: (i: number) => Object.keys(memStore)[i] ?? null,
        },
        writable: true,
        configurable: true,
      });
    }

    let onSceneReady: (() => void) | null = null;
    let emitMultiplayerIfReady: (() => void) | null = null;
    let onCompositeRemote: ((data: { id: string; appearance: CharacterAppearance | LegacyCharacterAppearance; textureKey?: string }) => Promise<void>) | null = null;

    import("@/game/main").then(({ createGame }) => {
      if (gameRef.current) return;

      const game = createGame("game-container");
      gameRef.current = game;

      onSceneReady = () => {
        EventBus.emit("spritesheet-ready", spritesheetRef.current);
      };
      EventBus.on("scene-ready", onSceneReady);

      // Send LocalMultiplayer whenever requested or when player spawns
      emitMultiplayerIfReady = () => {
        if (multiplayerRef.current) {
          const c = characterRef.current;
          EventBus.emit("multiplayer-ready", {
            localMultiplayer: multiplayerRef.current,
            characterId: c.characterId,
            characterName: c.characterName,
            appearance: c.appearance,
          });
        }
      };
      EventBus.on("player-spawned", emitMultiplayerIfReady);
      EventBus.on("request-multiplayer", emitMultiplayerIfReady);

      // Remote player compositing
      onCompositeRemote = async (data: {
        id: string;
        appearance: CharacterAppearance | LegacyCharacterAppearance;
        textureKey?: string;
      }) => {
        try {
          const canvas = document.createElement("canvas");
          await compositeCharacter(canvas, data.appearance);
          const dataUrl = canvas.toDataURL("image/png");
          EventBus.emit("remote-spritesheet-ready", {
            id: data.id,
            textureKey: data.textureKey || `remote-${data.id}`,
            dataUrl,
          });
        } catch (err) {
          console.error("Failed to composite remote player:", data.id, err);
        }
      };
      EventBus.on("composite-remote-player", onCompositeRemote);
    });

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
      if (onSceneReady) EventBus.off("scene-ready", onSceneReady);
      if (emitMultiplayerIfReady) {
        EventBus.off("player-spawned", emitMultiplayerIfReady);
        EventBus.off("request-multiplayer", emitMultiplayerIfReady);
      }
      if (onCompositeRemote) EventBus.off("composite-remote-player", onCompositeRemote);
    };
  }, []);

  useEffect(() => {
    setPendingChannelData(channelInitData);
    EventBus.emit("channel-data-ready", channelInitData);
  }, [channelInitData]);

  useEffect(() => {
    if (!spritesheetDataUrl) return;
    EventBus.emit("spritesheet-ready", spritesheetDataUrl);
  }, [spritesheetDataUrl]);

  // If localMultiplayer becomes available after game init, send it
  useEffect(() => {
    if (!localMultiplayer) return;
    const c = characterRef.current;
    EventBus.emit("multiplayer-ready", {
      localMultiplayer,
      characterId: c.characterId,
      characterName: c.characterName,
      appearance: c.appearance,
    });
  }, [localMultiplayer]);

  return (
    <div
      id="game-container"
      ref={containerRef}
      className="fixed inset-0 z-0"
    />
  );
}
