"use client";

/**
 * MapEditorPanel — Left-sidebar map editor panel.
 * Full-featured: multi-tile stamp, layer management, undo/redo,
 * select tool, keyboard shortcuts, legacy tile picker, zoom sync.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { EventBus } from "@/game/EventBus";
import {
  ChevronLeft, ChevronRight, Save, ZoomIn, ZoomOut,
  Grid3x3, Layers, Eraser, Stamp, RotateCcw,
  Eye, EyeOff, Copy, Clipboard, Scissors, Trash2, MousePointer2,
} from "lucide-react";

// ─── Exported types ────────────────────────────────────────────────────────────

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

export interface LayerInfo {
  name: string;
  visible: boolean;
  isActive: boolean;
}

// ─── Internal types ────────────────────────────────────────────────────────────

interface SelectedRegion {
  firstgid: number;
  col: number;
  row: number;
  width: number;
  height: number;
  gids: number[][];
}

interface SelectedTile {
  gid: number;
  tilesetName: string;
  layer: "floor" | "walls";
  region: SelectedRegion | null;
}

type ActiveTool = "stamp" | "erase" | "select";

interface MapEditorPanelProps {
  tilesets: TilesetDef[] | null;
  tiledMode: boolean;
  layers: LayerInfo[];
  onSave: () => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function resolveTilesetUrl(image: string): string {
  if (!image) return "";
  if (image.startsWith("data:")) return image;
  if (image.startsWith("/")) return image;
  const filename = image.split("/").pop() ?? image;
  return `/assets/tilesets/builtin/${filename}`;
}

/** Detect floor / wall hint from tileset name (typo fix: paritition → partition) */
function guessTilesetLayer(ts: TilesetDef): "floor" | "walls" | "both" {
  const n = (ts.name + ts.image).toLowerCase();
  if (n.includes("floor")) return "floor";
  if (n.includes("wall") || n.includes("partition")) return "walls";
  return "both";
}

const ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4];
const DEFAULT_ZOOM = 2;

/** Find nearest zoom step index (bug fix: indexOf can return -1) */
function nearestZoomIdx(zoom: number): number {
  return ZOOM_STEPS.reduce(
    (best, s, i) => (Math.abs(s - zoom) < Math.abs(ZOOM_STEPS[best] - zoom) ? i : best),
    0
  );
}

// Legacy tile colors for non-tiledMode picker (procedurally generated tiles)
const LEGACY_TILE_COLORS = [
  "#4a4a4a", "#6b6b6b", "#8b6914", "#a0522d",
  "#2e7d32", "#1565c0", "#6a1b9a", "#ad1457",
  "#e65100", "#f57f17", "#37474f", "#455a64",
  "#78909c", "#b0bec5", "#cfd8dc", "#eceff1",
];

// ─── Main component ────────────────────────────────────────────────────────────

export default function MapEditorPanel({
  tilesets,
  tiledMode,
  layers,
  onSave,
}: MapEditorPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeLayer, setActiveLayer] = useState<"floor" | "walls">("floor");
  const [activeTool, setActiveTool] = useState<ActiveTool>("stamp");
  const [selected, setSelected] = useState<SelectedTile | null>(null);
  const [activeTileset, setActiveTileset] = useState<TilesetDef | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [showGrid, setShowGrid] = useState(true);
  const [showCollision, setShowCollision] = useState(false);
  const [hasSelection, setHasSelection] = useState(false); // select-tool has an active map selection

  const panelRef = useRef<HTMLDivElement>(null);

  const visibleTilesets = (tilesets ?? []).filter((ts) => {
    if (ts.tilecount > 1024) return false;
    const h = guessTilesetLayer(ts);
    return h === activeLayer || h === "both";
  });

  // Auto-select first tileset when layer changes
  useEffect(() => {
    if (
      visibleTilesets.length > 0 &&
      (!activeTileset || !visibleTilesets.find((t) => t.name === activeTileset.name))
    ) {
      setActiveTileset(visibleTilesets[0]);
    }
  }, [activeLayer, tilesets]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Zoom sync from GameScene scroll wheel ──────────────────────────────────
  useEffect(() => {
    const onZoomChanged = (data: { zoom: number }) => {
      setZoom(data.zoom);
    };
    EventBus.on("editor:zoom-changed", onZoomChanged);
    return () => { EventBus.off("editor:zoom-changed", onZoomChanged); };
  }, []);

  // ── Listen for editor:state to update selection info (e.g. select tool active area) ──
  useEffect(() => {
    const onEditorState = (data: { hasSelection?: boolean }) => {
      if (typeof data.hasSelection === "boolean") {
        setHasSelection(data.hasSelection);
      }
    };
    EventBus.on("editor:state", onEditorState);
    return () => { EventBus.off("editor:state", onEditorState); };
  }, []);

  // ── Keyboard shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z) ─────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      if (e.ctrlKey && e.shiftKey && (e.key === "Z" || e.key === "z")) {
        e.preventDefault();
        EventBus.emit("editor:redo", {});
        return;
      }
      if (e.ctrlKey && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        EventBus.emit("editor:undo", {});
        return;
      }
      if (e.ctrlKey && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        EventBus.emit("editor:redo", {});
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleRegionSelect = useCallback(
    (ts: TilesetDef, region: SelectedRegion) => {
      const gid = region.gids[0]?.[0] ?? ts.firstgid;
      const tile: SelectedTile = { gid, tilesetName: ts.name, layer: activeLayer, region };
      setSelected(tile);
      setActiveTool("stamp");
      EventBus.emit("editor:select-stamp", { gid, layer: activeLayer, region });
    },
    [activeLayer]
  );

  const handleErase = useCallback(() => {
    setSelected(null);
    setActiveTool("erase");
    EventBus.emit("editor:set-tool", { tool: "erase" });
  }, []);

  const handleSelectTool = useCallback(() => {
    setActiveTool("select");
    EventBus.emit("editor:set-tool", { tool: "select" });
  }, []);

  const handleStampTool = useCallback(() => {
    setActiveTool("stamp");
    EventBus.emit("editor:set-tool", { tool: "stamp" });
    if (selected) {
      EventBus.emit("editor:select-stamp", {
        gid: selected.gid,
        layer: activeLayer,
        region: selected.region,
      });
    }
  }, [selected, activeLayer]);

  // Zoom controls (nearest index fix)
  const changeZoom = useCallback((dir: 1 | -1) => {
    setZoom((prev) => {
      const idx = nearestZoomIdx(prev);
      const nextIdx = Math.max(0, Math.min(ZOOM_STEPS.length - 1, idx + dir));
      const next = ZOOM_STEPS[nextIdx];
      EventBus.emit("editor:set-zoom", { zoom: next });
      return next;
    });
  }, []);

  const handleToggleGrid = useCallback(() => {
    setShowGrid((prev) => {
      EventBus.emit("editor:toggle-grid", { visible: !prev });
      return !prev;
    });
  }, []);

  const handleToggleCollision = useCallback(() => {
    setShowCollision((prev) => {
      EventBus.emit("editor:toggle-collision-layer", { visible: !prev });
      return !prev;
    });
  }, []);

  // Layer management
  const handleSetActiveLayer = useCallback((layerName: string) => {
    EventBus.emit("editor:set-active-layer", { layerName });
  }, []);

  const handleToggleLayerVisibility = useCallback((layerName: string, currentlyVisible: boolean) => {
    EventBus.emit("editor:toggle-layer-visibility", { layerName, visible: !currentlyVisible });
  }, []);

  // Legacy tile picker (non-tiledMode)
  const handleLegacyTileSelect = useCallback(
    (tileIndex: number) => {
      EventBus.emit("editor:select-legacy-tile", { tileIndex, layer: activeLayer });
    },
    [activeLayer]
  );

  // Select tool actions
  const handleCopySelection = useCallback(() => {
    EventBus.emit("editor:copy-selection", {});
  }, []);

  const handlePasteClipboard = useCallback(() => {
    EventBus.emit("editor:paste-clipboard", {});
  }, []);

  const handleDeleteSelection = useCallback(() => {
    EventBus.emit("editor:delete-selection", {});
  }, []);

  const zoomIdx = nearestZoomIdx(zoom);
  const zoomPct = Math.round(zoom * 100);

  // ── Collapsed state ────────────────────────────────────────────────────────

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
        <button onClick={() => EventBus.emit("editor:undo", {})} className="p-1.5 rounded hover:bg-gray-700 text-gray-400" title="실행취소">
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // ── Expanded panel ─────────────────────────────────────────────────────────

  return (
    <div
      ref={panelRef}
      className="fixed top-0 left-0 bottom-0 w-64 z-50 flex flex-col bg-gray-900/97 border-r border-gray-700 pointer-events-auto select-none"
      style={{ backdropFilter: "blur(4px)" }}
    >
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

      {/* ── Undo / Redo ── */}
      <div className="px-3 py-2 border-b border-gray-700 shrink-0">
        <div className="flex gap-1">
          <button
            onClick={() => EventBus.emit("editor:undo", {})}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs rounded bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors font-medium"
            title="실행취소 (Ctrl+Z)"
          >
            <RotateCcw className="w-3 h-3" />
            실행취소
          </button>
          <button
            onClick={() => EventBus.emit("editor:redo", {})}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs rounded bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors font-medium"
            title="다시실행 (Ctrl+Y)"
            style={{ transform: "scaleX(-1)" }}
          >
            <RotateCcw className="w-3 h-3" style={{ transform: "scaleX(-1)" }} />
            <span style={{ transform: "scaleX(-1)" }}>다시실행</span>
          </button>
        </div>
      </div>

      {/* ── Zoom ── */}
      <div className="px-3 py-2 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 uppercase tracking-wide w-8">줌</span>
          <button
            onClick={() => changeZoom(-1)}
            disabled={zoomIdx <= 0}
            className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <div className="flex-1 h-1 bg-gray-700 rounded-full relative">
            <div
              className="absolute top-0 left-0 h-1 bg-green-500 rounded-full transition-all"
              style={{ width: `${(zoomIdx / (ZOOM_STEPS.length - 1)) * 100}%` }}
            />
          </div>
          <button
            onClick={() => changeZoom(1)}
            disabled={zoomIdx >= ZOOM_STEPS.length - 1}
            className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs text-gray-300 w-10 text-right font-mono">{zoomPct}%</span>
        </div>
      </div>

      {/* ── Tools ── */}
      <div className="px-3 py-2 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-1 mb-1.5">
          <span className="text-xs text-gray-500 uppercase tracking-wide">도구</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={handleStampTool}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs rounded transition-colors font-medium ${
              activeTool === "stamp"
                ? "bg-blue-700 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
            title="스탬프 (B)"
          >
            <Stamp className="w-3 h-3" />
            스탬프
          </button>
          <button
            onClick={handleErase}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs rounded transition-colors font-medium ${
              activeTool === "erase"
                ? "bg-red-800 text-red-200"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
            title="지우기 (E)"
          >
            <Eraser className="w-3 h-3" />
            지우기
          </button>
          <button
            onClick={handleSelectTool}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs rounded transition-colors font-medium ${
              activeTool === "select"
                ? "bg-purple-700 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
            title="선택 (S)"
          >
            <MousePointer2 className="w-3 h-3" />
            선택
          </button>
        </div>

        {/* Select tool actions */}
        {activeTool === "select" && hasSelection && (
          <div className="flex gap-1 mt-1.5">
            <button
              onClick={handleCopySelection}
              className="flex-1 flex items-center justify-center gap-1 py-1 text-xs rounded bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
              title="복사 (Ctrl+C)"
            >
              <Copy className="w-3 h-3" />
              복사
            </button>
            <button
              onClick={handlePasteClipboard}
              className="flex-1 flex items-center justify-center gap-1 py-1 text-xs rounded bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
              title="붙여넣기 (Ctrl+V)"
            >
              <Clipboard className="w-3 h-3" />
              붙여넣기
            </button>
            <button
              onClick={handleDeleteSelection}
              className="flex-1 flex items-center justify-center gap-1 py-1 text-xs rounded bg-gray-800 text-red-400 hover:bg-red-900 hover:text-red-200 transition-colors"
              title="삭제 (Del)"
            >
              <Trash2 className="w-3 h-3" />
              삭제
            </button>
          </div>
        )}
      </div>

      {/* ── Grid + Collision toggles ── */}
      <div className="px-3 py-1.5 border-b border-gray-700 shrink-0 flex flex-col gap-0.5">
        <button
          onClick={handleToggleGrid}
          className={`flex items-center gap-2 w-full py-1 px-1.5 rounded text-xs transition-colors ${
            showGrid ? "text-green-400 hover:bg-gray-800" : "text-gray-500 hover:bg-gray-800"
          }`}
        >
          <Grid3x3 className="w-3.5 h-3.5" />
          그리드 {showGrid ? "ON" : "OFF"}
        </button>
        <label className="flex items-center gap-2 w-full py-1 px-1.5 rounded text-xs transition-colors hover:bg-gray-800 cursor-pointer text-gray-400">
          <input
            type="checkbox"
            checked={showCollision}
            onChange={handleToggleCollision}
            className="w-3 h-3 accent-yellow-400"
          />
          충돌 레이어
        </label>
      </div>

      {/* ── Tiled layer list ── */}
      {tiledMode && layers.length > 0 && (
        <div className="px-3 py-2 border-b border-gray-700 shrink-0">
          <div className="flex items-center gap-1 mb-1.5">
            <Layers className="w-3 h-3 text-gray-500" />
            <span className="text-xs text-gray-500 uppercase tracking-wide">레이어</span>
          </div>
          <div className="flex flex-col gap-0.5 max-h-28 overflow-y-auto">
            {layers.map((layer) => (
              <div
                key={layer.name}
                className={`flex items-center gap-1.5 px-1.5 py-1 rounded cursor-pointer text-xs transition-colors ${
                  layer.isActive
                    ? "bg-green-900/50 text-green-300 border border-green-700/50"
                    : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                }`}
                onClick={() => handleSetActiveLayer(layer.name)}
              >
                <span className="flex-1 truncate">{layer.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleLayerVisibility(layer.name, layer.visible);
                  }}
                  className="p-0.5 rounded hover:bg-gray-700 shrink-0"
                  title={layer.visible ? "숨기기" : "표시"}
                >
                  {layer.visible ? (
                    <Eye className="w-3 h-3 text-gray-400" />
                  ) : (
                    <EyeOff className="w-3 h-3 text-gray-600" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Floor/Walls tab (tiled mode) ── */}
      {tiledMode && (
        <div className="px-3 py-2 border-b border-gray-700 shrink-0">
          <div className="flex gap-1">
            {(["floor", "walls"] as const).map((layer) => (
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
      )}

      {/* ── Tileset selector (tiledMode only) ── */}
      {tiledMode && visibleTilesets.length > 0 && (
        <div className="px-3 py-2 border-b border-gray-700 shrink-0">
          <select
            className="w-full text-xs bg-gray-800 border border-gray-600 text-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-500"
            value={activeTileset?.name ?? ""}
            onChange={(e) => {
              const ts = visibleTilesets.find((t) => t.name === e.target.value);
              if (ts) setActiveTileset(ts);
            }}
          >
            {visibleTilesets.map((ts) => (
              <option key={ts.name} value={ts.name}>
                {ts.name
                  .replace(/-edited$/, "")
                  .replace(/stamp-[0-9a-f-]{36}-?/, "")
                  .substring(0, 32) || ts.name.substring(0, 32)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ── Tile grid (scrollable, fills remaining space) ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2">
        {tiledMode ? (
          activeTileset ? (
            <>
              {selected && (
                <div className="mb-2 px-2 py-1 bg-green-900/40 border border-green-700/50 rounded text-xs text-green-400">
                  선택: {activeTileset.name.substring(0, 20)} · GID {selected.gid}
                  {selected.region && selected.region.width > 1 || (selected.region && selected.region.height > 1) ? (
                    <span className="ml-1 text-green-500">
                      ({selected.region.width}×{selected.region.height})
                    </span>
                  ) : null}
                </div>
              )}
              <TileGrid
                ts={activeTileset}
                selectedGid={selected?.gid ?? null}
                selectedRegion={selected?.region ?? null}
                onRegionSelect={handleRegionSelect}
              />
            </>
          ) : (
            <div className="text-xs text-gray-600 text-center mt-4">타일셋 없음</div>
          )
        ) : (
          /* Non-tiledMode: legacy office-tiles picker */
          <>
            <div className="mb-2 flex gap-1">
              {(["floor", "walls"] as const).map((layer) => (
                <button
                  key={layer}
                  onClick={() => setActiveLayer(layer)}
                  className={`flex-1 py-1 text-xs rounded transition-colors font-medium ${
                    activeLayer === layer
                      ? "bg-green-700 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  {layer === "floor" ? "바닥" : "벽"}
                </button>
              ))}
            </div>
            <div className="text-xs text-gray-500 mb-2">오피스 타일 (0–15)</div>
            <LegacyTileGrid
              activeLayer={activeLayer}
              onTileSelect={handleLegacyTileSelect}
            />
          </>
        )}
      </div>

      {/* ── Footer: keyboard shortcuts ── */}
      <div className="px-3 py-2 border-t border-gray-800 shrink-0">
        <div className="text-xs text-gray-600 leading-relaxed space-y-0.5">
          <div className="text-gray-500 font-semibold mb-1 uppercase tracking-wide text-[10px]">단축키</div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
            <span><kbd className="bg-gray-800 px-1 rounded">B</kbd> 스탬프</span>
            <span><kbd className="bg-gray-800 px-1 rounded">E</kbd> 지우기</span>
            <span><kbd className="bg-gray-800 px-1 rounded">S</kbd> 선택</span>
            <span><kbd className="bg-gray-800 px-1 rounded">G</kbd> 그리드</span>
            <span><kbd className="bg-gray-800 px-1 rounded">+/-</kbd> 줌</span>
            <span><kbd className="bg-gray-800 px-1 rounded">Tab</kbd> 에디터 종료</span>
            <span><kbd className="bg-gray-800 px-1 rounded">Ctrl+Z</kbd> 실행취소</span>
            <span><kbd className="bg-gray-800 px-1 rounded">Ctrl+Y</kbd> 다시실행</span>
            <span><kbd className="bg-gray-800 px-1 rounded">Ctrl+C</kbd> 복사</span>
            <span><kbd className="bg-gray-800 px-1 rounded">Ctrl+X</kbd> 잘라내기</span>
            <span><kbd className="bg-gray-800 px-1 rounded">Ctrl+V</kbd> 붙여넣기</span>
            <span><kbd className="bg-gray-800 px-1 rounded">Del</kbd> 삭제</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TileGrid with multi-tile drag selection ───────────────────────────────────

interface DragPos {
  col: number;
  row: number;
}

function TileGrid({
  ts,
  selectedGid,
  selectedRegion,
  onRegionSelect,
}: {
  ts: TilesetDef;
  selectedGid: number | null;
  selectedRegion: SelectedRegion | null;
  onRegionSelect: (ts: TilesetDef, region: SelectedRegion) => void;
}) {
  const tileW = ts.tilewidth ?? 32;
  const tileH = ts.tileheight ?? 32;
  const cols = ts.columns || 1;
  const count = ts.tilecount;
  const url = resolveTilesetUrl(ts.image);
  const CELL = 36; // px per cell

  const rows = Math.ceil(count / cols);

  const [dragStart, setDragStart] = useState<DragPos | null>(null);
  const [dragEnd, setDragEnd] = useState<DragPos | null>(null);
  const isDragging = useRef(false);

  const getCellFromEvent = (e: React.MouseEvent<HTMLDivElement>): DragPos | null => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const col = Math.floor(x / (CELL + 2)); // 2 = gap-0.5 (2px)
    const row = Math.floor(y / (CELL + 2));
    if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
    // Make sure within tilecount
    const localIdx = row * cols + col;
    if (localIdx >= count) return null;
    return { col, row };
  };

  const buildRegion = (start: DragPos, end: DragPos): SelectedRegion => {
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const width = maxCol - minCol + 1;
    const height = maxRow - minRow + 1;

    const gids: number[][] = [];
    for (let ry = 0; ry < height; ry++) {
      const rowGids: number[] = [];
      for (let rx = 0; rx < width; rx++) {
        rowGids.push(ts.firstgid + (minRow + ry) * cols + (minCol + rx));
      }
      gids.push(rowGids);
    }

    return {
      firstgid: ts.firstgid,
      col: minCol,
      row: minRow,
      width,
      height,
      gids,
    };
  };

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const pos = getCellFromEvent(e);
    if (!pos) return;
    isDragging.current = true;
    setDragStart(pos);
    setDragEnd(pos);
    e.preventDefault();
  };

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current || !dragStart) return;
    const pos = getCellFromEvent(e);
    if (pos) setDragEnd(pos);
  };

  const onMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (dragStart && dragEnd) {
      const region = buildRegion(dragStart, dragEnd);
      onRegionSelect(ts, region);
    }
    setDragStart(null);
    setDragEnd(null);
  };

  const onMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging.current && dragStart && dragEnd) {
      isDragging.current = false;
      const region = buildRegion(dragStart, dragEnd);
      onRegionSelect(ts, region);
    }
    setDragStart(null);
    setDragEnd(null);
  };

  // Compute selection rect in drag coords
  const selRect = dragStart && dragEnd ? {
    minCol: Math.min(dragStart.col, dragEnd.col),
    maxCol: Math.max(dragStart.col, dragEnd.col),
    minRow: Math.min(dragStart.row, dragEnd.row),
    maxRow: Math.max(dragStart.row, dragEnd.row),
  } : null;

  return (
    <div
      className="relative"
      style={{ userSelect: "none" }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      <div
        className="grid gap-0.5"
        style={{ gridTemplateColumns: `repeat(${cols}, ${CELL}px)` }}
      >
        {Array.from({ length: count }, (_, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const gid = ts.firstgid + i;

          const isSelected = !dragStart && selectedRegion
            ? col >= selectedRegion.col &&
              col < selectedRegion.col + selectedRegion.width &&
              row >= selectedRegion.row &&
              row < selectedRegion.row + selectedRegion.height
            : !dragStart && gid === selectedGid;

          const isDragSelected = selRect
            ? col >= selRect.minCol &&
              col <= selRect.maxCol &&
              row >= selRect.minRow &&
              row <= selRect.maxRow
            : false;

          return (
            <div
              key={i}
              title={`GID ${gid}`}
              className={`cursor-crosshair rounded-sm border transition-all ${
                isDragSelected
                  ? "border-yellow-400 ring-1 ring-yellow-400"
                  : isSelected
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
    </div>
  );
}

// ─── Legacy tile picker (non-tiledMode) ───────────────────────────────────────

function LegacyTileGrid({
  activeLayer,
  onTileSelect,
}: {
  activeLayer: "floor" | "walls";
  onTileSelect: (tileIndex: number) => void;
}) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const handleClick = (idx: number) => {
    setSelectedIdx(idx);
    onTileSelect(idx);
  };

  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
      {Array.from({ length: 16 }, (_, i) => (
        <div
          key={i}
          onClick={() => handleClick(i)}
          className={`cursor-pointer rounded border text-center flex items-center justify-center text-xs font-mono transition-all ${
            selectedIdx === i
              ? "border-green-400 ring-1 ring-green-400"
              : "border-gray-700 hover:border-gray-400"
          }`}
          style={{ height: 40, background: LEGACY_TILE_COLORS[i] ?? "#333" }}
          title={`타일 ${i}`}
        >
          <span className="text-white/80 text-[10px] font-bold drop-shadow">{i}</span>
        </div>
      ))}
    </div>
  );
}
