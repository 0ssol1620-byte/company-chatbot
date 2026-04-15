"use client";

/**
 * MapEditorPanel — Left-sidebar map editor panel.
 * Clean IDE-style panel: zoom, layers, tools, tile picker.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { EventBus } from "@/game/EventBus";
import {
  ChevronLeft, ChevronRight, Save, ZoomIn, ZoomOut,
  Grid3x3, Layers, Eraser, Stamp, RotateCcw,
} from "lucide-react";

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
  onSave: () => void;
}

/** Derive public URL from a tileset image path stored in Tiled JSON */
function resolveTilesetUrl(image: string): string {
  if (!image) return "";
  if (image.startsWith("data:")) return image;
  if (image.startsWith("/")) return image;
  const filename = image.split("/").pop() ?? image;
  return `/assets/tilesets/builtin/${filename}`;
}

/** Detect floor / wall hint from tileset name */
function guessTilesetLayer(ts: TilesetDef): "floor" | "walls" | "both" {
  const n = (ts.name + ts.image).toLowerCase();
  if (n.includes("floor")) return "floor";
  if (n.includes("wall") || n.includes("partition") || n.includes("paritition")) return "walls";
  return "both";
}

const ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4];
const DEFAULT_ZOOM = 2;

export default function MapEditorPanel({ tilesets, tiledMode, onSave }: MapEditorPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeLayer, setActiveLayer] = useState<"floor" | "walls">("floor");
  const [activeTool, setActiveTool] = useState<"stamp" | "erase">("stamp");
  const [selected, setSelected] = useState<SelectedTile | null>(null);
  const [activeTileset, setActiveTileset] = useState<TilesetDef | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [showGrid, setShowGrid] = useState(true);

  const visibleTilesets = (tilesets ?? []).filter((ts) => {
    if (ts.tilecount > 1024) return false;
    const h = guessTilesetLayer(ts);
    return h === activeLayer || h === "both";
  });

  // Auto-select first tileset when layer changes
  useEffect(() => {
    if (visibleTilesets.length > 0 && (!activeTileset || !visibleTilesets.find(t => t.name === activeTileset.name))) {
      setActiveTileset(visibleTilesets[0]);
    }
  }, [activeLayer, tilesets]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync tool mode with active tile selection
  const handleTileClick = useCallback((ts: TilesetDef, localIdx: number) => {
    const gid = ts.firstgid + localIdx;
    const tile: SelectedTile = { gid, tilesetName: ts.name, layer: activeLayer };
    setSelected(tile);
    setActiveTool("stamp");
    EventBus.emit("editor:select-stamp", { gid, layer: activeLayer });
  }, [activeLayer]);

  const handleErase = useCallback(() => {
    setSelected(null);
    setActiveTool("erase");
    EventBus.emit("editor:select-stamp", { gid: -1, layer: activeLayer });
  }, [activeLayer]);

  // Zoom controls
  const changeZoom = useCallback((dir: 1 | -1) => {
    setZoom(prev => {
      const idx = ZOOM_STEPS.indexOf(prev);
      const nextIdx = Math.max(0, Math.min(ZOOM_STEPS.length - 1, idx + dir));
      const next = ZOOM_STEPS[nextIdx];
      EventBus.emit("editor:set-zoom", { zoom: next });
      return next;
    });
  }, []);

  // Listen for zoom changes from GameScene (e.g. scroll wheel)
  useEffect(() => {
    const onZoomChanged = (data: { zoom: number }) => {
      setZoom(data.zoom);
    };
    EventBus.on("editor:zoom-changed", onZoomChanged);
    return () => { EventBus.off("editor:zoom-changed", onZoomChanged); };
  }, []);

  // Grid toggle
  const handleToggleGrid = useCallback(() => {
    setShowGrid(prev => {
      EventBus.emit("editor:toggle-grid", { visible: !prev });
      return !prev;
    });
  }, []);

  const zoomPct = Math.round(zoom * 100);

  if (collapsed) {
    return (
      <div className="fixed top-0 left-0 bottom-0 w-10 z-50 bg-gray-900/95 border-r border-gray-700 flex flex-col items-center py-2 gap-2 pointer-events-auto">
        <button
          onClick={() => setCollapsed(false)}
          className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white"
          title="패널 열기"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-gray-700" />
        <button onClick={onSave} className="p-1.5 rounded hover:bg-green-800 text-green-400" title="저장">
          <Save className="w-4 h-4" />
        </button>
        <button onClick={() => changeZoom(1)} className="p-1.5 rounded hover:bg-gray-700 text-gray-400" title="줌인">
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => changeZoom(-1)} className="p-1.5 rounded hover:bg-gray-700 text-gray-400" title="줌아웃">
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 bottom-0 w-64 z-50 flex flex-col bg-gray-900/97 border-r border-gray-700 pointer-events-auto select-none"
      style={{ backdropFilter: "blur(4px)" }}>

      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700 shrink-0">
        <span className="text-xs font-bold text-green-400 uppercase tracking-widest flex-1">맵 에디터</span>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Save ── */}
      <div className="px-3 py-2 border-b border-gray-700 shrink-0">
        <button
          onClick={onSave}
          className="w-full flex items-center justify-center gap-2 py-1.5 rounded-md bg-green-800/80 hover:bg-green-700 text-green-300 hover:text-white text-xs font-semibold transition-colors"
        >
          <Save className="w-3.5 h-3.5" />
          맵 저장
        </button>
      </div>

      {/* ── Zoom ── */}
      <div className="px-3 py-2 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 uppercase tracking-wide w-8">줌</span>
          <button
            onClick={() => changeZoom(-1)}
            disabled={zoom <= ZOOM_STEPS[0]}
            className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <div className="flex-1 h-1 bg-gray-700 rounded-full relative">
            <div
              className="absolute top-0 left-0 h-1 bg-green-500 rounded-full transition-all"
              style={{ width: `${((ZOOM_STEPS.indexOf(zoom)) / (ZOOM_STEPS.length - 1)) * 100}%` }}
            />
          </div>
          <button
            onClick={() => changeZoom(1)}
            disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
            className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs text-gray-300 w-10 text-right font-mono">{zoomPct}%</span>
        </div>
      </div>

      {/* ── Layers ── */}
      <div className="px-3 py-2 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-1 mb-1.5">
          <Layers className="w-3 h-3 text-gray-500" />
          <span className="text-xs text-gray-500 uppercase tracking-wide">레이어</span>
        </div>
        <div className="flex gap-1">
          {(["floor", "walls"] as const).map(layer => (
            <button
              key={layer}
              onClick={() => setActiveLayer(layer)}
              className={`flex-1 py-1 text-xs rounded transition-colors font-medium ${
                activeLayer === layer
                  ? "bg-green-700 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
              }`}
            >
              {layer === "floor" ? "바닥" : "벽/파티션"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tools ── */}
      <div className="px-3 py-2 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-1 mb-1.5">
          <span className="text-xs text-gray-500 uppercase tracking-wide">도구</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => {
              setActiveTool("stamp");
              if (selected) EventBus.emit("editor:select-stamp", { gid: selected.gid, layer: activeLayer });
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs rounded transition-colors font-medium ${
              activeTool === "stamp"
                ? "bg-blue-700 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            <Stamp className="w-3 h-3" />
            스탬프
          </button>
          <button
            onClick={handleErase}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs rounded transition-colors font-medium ${
              activeTool === "erase"
                ? "bg-red-800 text-red-200"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            <Eraser className="w-3 h-3" />
            지우기
          </button>
        </div>
      </div>

      {/* ── Grid toggle ── */}
      <div className="px-3 py-1.5 border-b border-gray-700 shrink-0">
        <button
          onClick={handleToggleGrid}
          className={`flex items-center gap-2 w-full py-1 px-1.5 rounded text-xs transition-colors ${
            showGrid ? "text-green-400 hover:bg-gray-800" : "text-gray-500 hover:bg-gray-800"
          }`}
        >
          <Grid3x3 className="w-3.5 h-3.5" />
          그리드 {showGrid ? "ON" : "OFF"}
        </button>
      </div>

      {/* ── Tileset selector (tiledMode only) ── */}
      {tiledMode && visibleTilesets.length > 0 && (
        <div className="px-3 py-2 border-b border-gray-700 shrink-0">
          <select
            className="w-full text-xs bg-gray-800 border border-gray-600 text-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-500"
            value={activeTileset?.name ?? ""}
            onChange={e => {
              const ts = visibleTilesets.find(t => t.name === e.target.value);
              if (ts) setActiveTileset(ts);
            }}
          >
            {visibleTilesets.map(ts => (
              <option key={ts.name} value={ts.name}>
                {ts.name.replace(/-edited$/, "").replace(/stamp-[0-9a-f-]{36}-?/, "").substring(0, 32) || ts.name.substring(0, 32)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ── Tile grid (scrollable, fills remaining space) ── */}
      {tiledMode && activeTileset ? (
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2">
          {selected && (
            <div className="mb-2 px-2 py-1 bg-green-900/40 border border-green-700/50 rounded text-xs text-green-400">
              선택: {activeTileset.name.substring(0, 20)} · GID {selected.gid}
            </div>
          )}
          <TileGrid
            ts={activeTileset}
            selectedGid={selected?.gid ?? null}
            onTileClick={handleTileClick}
          />
        </div>
      ) : (
        <div className="flex-1" />
      )}

      {/* ── Footer shortcuts ── */}
      <div className="px-3 py-2 border-t border-gray-800 shrink-0">
        <div className="text-xs text-gray-600 leading-relaxed">
          <div>LMB 배치 · RMB 지우기</div>
          <div>Tab 에디터 종료</div>
        </div>
      </div>
    </div>
  );
}

/** Tile grid — CSS background-image slice technique */
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
  const CELL = 36; // px per cell

  return (
    <div
      className="grid gap-0.5"
      style={{ gridTemplateColumns: `repeat(auto-fill, ${CELL}px)` }}
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
            title={`GID ${gid}`}
            className={`cursor-pointer rounded-sm border transition-all ${
              isSelected
                ? "border-green-400 ring-1 ring-green-400 ring-offset-1 ring-offset-gray-900"
                : "border-gray-700 hover:border-gray-400"
            }`}
            style={{ width: CELL, height: CELL, flexShrink: 0 }}
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
