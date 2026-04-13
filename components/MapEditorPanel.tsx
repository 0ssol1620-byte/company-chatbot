"use client";

/**
 * MapEditorPanel — React tile picker for the Phaser map editor.
 * Shows tileset images from the Tiled JSON so the user can select
 * a stamp tile and paint it onto Floor or Walls layers.
 */

import { useState, useCallback, useEffect } from "react";
import { EventBus } from "@/game/EventBus";

export interface TilesetDef {
  name: string;
  image: string;
  firstgid: number;
  columns: number;
  tilecount: number;
  tilewidth?: number;
  tileheight?: number;
  imagewidth?: number;
  imageheight?: number;
}

interface SelectedTile {
  gid: number;
  tilesetName: string;
  layer: "floor" | "walls";
}

interface MapEditorPanelProps {
  tilesets: TilesetDef[] | null;
  tiledMode: boolean;
}

/** Derive public URL from a tileset image path stored in Tiled JSON */
function resolveTilesetUrl(image: string): string {
  if (!image) return "";
  if (image.startsWith("data:")) return image;
  if (image.startsWith("/")) return image;
  // Relative path in Tiled JSON — builtin tilesets live under /assets/tilesets/builtin/
  const filename = image.split("/").pop() ?? image;
  return `/assets/tilesets/builtin/${filename}`;
}

/** Check if a tileset name/image suggests floor or wall use */
function guessTilesetLayer(ts: TilesetDef): "floor" | "walls" | "both" {
  const n = (ts.name + ts.image).toLowerCase();
  if (n.includes("floor")) return "floor";
  if (n.includes("wall") || n.includes("partition") || n.includes("paritition")) return "walls";
  return "both";
}

export default function MapEditorPanel({ tilesets, tiledMode }: MapEditorPanelProps) {
  const [activeLayer, setActiveLayer] = useState<"floor" | "walls">("floor");
  const [selected, setSelected] = useState<SelectedTile | null>(null);
  const [activeTileset, setActiveTileset] = useState<TilesetDef | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  // Filter to tilesets relevant to the active layer
  const visibleTilesets = (tilesets ?? []).filter((ts) => {
    // Skip very large tilesets (>1024 tiles) in the basic picker to keep UI usable
    if (ts.tilecount > 1024) return false;
    const layerHint = guessTilesetLayer(ts);
    return layerHint === activeLayer || layerHint === "both";
  });

  // Auto-select the first tileset when layer changes
  useEffect(() => {
    if (visibleTilesets.length > 0 && (!activeTileset || !visibleTilesets.find(t => t.name === activeTileset.name))) {
      setActiveTileset(visibleTilesets[0]);
    }
  }, [activeLayer, tilesets]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTileClick = useCallback((ts: TilesetDef, localIdx: number) => {
    const gid = ts.firstgid + localIdx;
    const tile: SelectedTile = { gid, tilesetName: ts.name, layer: activeLayer };
    setSelected(tile);
    EventBus.emit("editor:select-stamp", { gid, layer: activeLayer });
  }, [activeLayer]);

  const handleErase = useCallback(() => {
    setSelected(null);
    EventBus.emit("editor:select-stamp", { gid: -1, layer: activeLayer });
  }, [activeLayer]);

  if (!tiledMode) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 pointer-events-auto"
      style={{ maxHeight: collapsed ? 40 : 240 }}
    >
      <div className="bg-gray-900/95 border-t border-gray-700 backdrop-blur-sm select-none">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-700">
          <span className="text-xs font-bold text-green-400 uppercase tracking-wide">맵 에디터</span>

          {/* Layer tabs */}
          <div className="flex gap-1 ml-2">
            {(["floor", "walls"] as const).map(layer => (
              <button
                key={layer}
                onClick={() => setActiveLayer(layer)}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  activeLayer === layer
                    ? "bg-green-700 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                {layer === "floor" ? "바닥" : "벽/파티션"}
              </button>
            ))}
          </div>

          {/* Tileset selector */}
          {visibleTilesets.length > 0 && (
            <select
              className="ml-2 text-xs bg-gray-700 border border-gray-600 text-white rounded px-1 py-0.5 max-w-[180px]"
              value={activeTileset?.name ?? ""}
              onChange={e => {
                const ts = visibleTilesets.find(t => t.name === e.target.value);
                if (ts) setActiveTileset(ts);
              }}
            >
              {visibleTilesets.map(ts => (
                <option key={ts.name} value={ts.name}>
                  {ts.name.replace(/-edited$/, "").replace(/stamp-[0-9a-f-]{36}-?/, "").substring(0, 30) || ts.name.substring(0, 30)}
                </option>
              ))}
            </select>
          )}

          {/* Erase button */}
          <button
            onClick={handleErase}
            className="ml-2 px-2 py-0.5 text-xs rounded bg-red-900 hover:bg-red-800 text-red-300 transition-colors"
          >
            지우기
          </button>

          {/* Selected tile info */}
          {selected && (
            <span className="ml-2 text-xs text-gray-400">
              선택: GID {selected.gid}
            </span>
          )}

          <button
            onClick={() => setCollapsed(c => !c)}
            className="ml-auto text-gray-400 hover:text-white text-xs px-2"
          >
            {collapsed ? "▲" : "▼"}
          </button>
        </div>

        {/* Tile grid */}
        {!collapsed && activeTileset && (
          <TileGrid
            ts={activeTileset}
            selectedGid={selected?.gid ?? null}
            onTileClick={handleTileClick}
          />
        )}

        {/* Object mode hint */}
        {!collapsed && (
          <div className="px-3 py-1 text-xs text-gray-500 border-t border-gray-800">
            오브젝트(가구) 배치는 게임 화면 하단 툴바 사용 | Tab: 에디터 종료
          </div>
        )}
      </div>
    </div>
  );
}

/** Renders the tile grid for a single tileset */
function TileGrid({
  ts,
  selectedGid,
  onTileClick,
}: {
  ts: TilesetDef;
  selectedGid: number | null;
  onTileClick: (ts: TilesetDef, localIdx: number) => void;
}) {
  const tileW = ts.tilewidth ?? 32;
  const tileH = ts.tileheight ?? 32;
  const cols = ts.columns || 1;
  const count = ts.tilecount;
  const url = resolveTilesetUrl(ts.image);
  const CELL = 40;

  return (
    <div
      className="flex flex-wrap gap-0.5 p-2 overflow-x-auto overflow-y-auto"
      style={{ maxHeight: 160 }}
    >
      {Array.from({ length: count }, (_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const gid = ts.firstgid + i;
        const isSelected = gid === selectedGid;

        return (
          <div
            key={i}
            onClick={() => onTileClick(ts, i)}
            title={`GID ${gid} (local ${i})`}
            className={`relative cursor-pointer border transition-all shrink-0 ${
              isSelected
                ? "border-green-400 ring-1 ring-green-400"
                : "border-gray-600 hover:border-gray-400"
            }`}
            style={{ width: CELL, height: CELL }}
          >
            <div
              style={{
                width: CELL,
                height: CELL,
                backgroundImage: `url(${url})`,
                backgroundPosition: `-${col * tileW * (CELL / tileW)}px -${row * tileH * (CELL / tileH)}px`,
                backgroundSize: `${cols * CELL}px auto`,
                imageRendering: "pixelated",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
