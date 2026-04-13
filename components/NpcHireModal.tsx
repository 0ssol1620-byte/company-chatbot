"use client";

import { useState, useEffect, useRef, useCallback, startTransition } from "react";
import type { CharacterAppearance } from "@/lib/lpc-registry";
import type { NpcPreset } from "@/lib/npc-presets";
import type { LocalAgentFile } from "@/lib/local-store";
import { PERSONA_PRESETS, applyPresetName } from "@/lib/npc-persona-presets";
import { OFFICE_PRESETS } from "@/lib/office-presets";
import { useLocale, useT } from "@/lib/i18n";
import { Maximize2 } from "lucide-react";
import { useCharacterAppearance } from "@/hooks/useCharacterAppearance";
import CharacterPreview from "@/components/CharacterPreview";
import AppearanceEditor from "@/components/AppearanceEditor";
import { localizeNpcPromptDocument } from "@/lib/npc-agent-defaults";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PREVIEW_SCALE = 3;
const DIRECTION_LABELS: { id: string; label: string }[] = [
  { id: "down", label: "↓" },
  { id: "left", label: "←" },
  { id: "right", label: "→" },
  { id: "up", label: "↑" },
];
const MAX_NPC_COUNT = 10;

const MODELS_BY_PROVIDER: Record<string, string[]> = {
  openai: ["gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4o", "gpt-4o-mini", "o3", "o4-mini"],
  anthropic: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
  google: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-2.0-flash-lite"],
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NpcHireModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlaceOnMap: (npcData: {
    name: string;
    persona: string;
    appearance: unknown;
    direction: string;
    identity?: string;
    soul?: string;
    locale?: string;
    provider: string;
    model: string;
    apiKey: string;
    systemPrompt: string;
    files?: LocalAgentFile[];
  }) => void;
  onSaveEdit?: (
    npcId: string,
    updates: {
      name?: string;
      persona?: string;
      appearance?: unknown;
      direction?: string;
      identity?: string;
      soul?: string;
      locale?: string;
      provider?: string;
      model?: string;
      apiKey?: string;
      systemPrompt?: string;
      files?: LocalAgentFile[];
    },
  ) => void;
  editingNpc?: {
    id: string;
    name: string;
    persona: string;
    appearance: unknown;
    direction?: string;
    agentId?: string | null;
  } | null;
  currentNpcCount: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NpcHireModal({
  isOpen,
  onClose,
  onPlaceOnMap,
  onSaveEdit,
  editingNpc,
  currentNpcCount,
}: NpcHireModalProps) {
  const t = useT();
  const { locale } = useLocale();

  // --- Appearance (shared hook) ---
  const {
    bodyType, setBodyType, layers, setLayers,
    activeCategory, setActiveCategory,
    handleBodyTypeChange, selectItem, clearCategory, setVariant, setSkin,
    isItemCompatible, getItemBodyTypes, compatibleCount,
    randomize, buildAppearance: buildAppearanceFromHook,
  } = useCharacterAppearance();

  // --- NPC-specific state ---
  const [name, setName] = useState("");
  const [identity, setIdentity] = useState("");
  const [soul, setSoul] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [appearanceMode, setAppearanceMode] = useState<"presets" | "custom">("presets");

  // Step flow state (simplified: no creating-agent)
  const [step, setStep] = useState<"configure" | "place">("configure");

  // Persona preset state
  const [personaPresetId, setPersonaPresetId] = useState<string>("custom");

  // AI provider fields (direct AI SDK integration)
  const [aiProvider, setAiProvider] = useState<"openai" | "anthropic" | "google">("openai");
  const [aiModel, setAiModel] = useState("");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiSystemPrompt, setAiSystemPrompt] = useState("");
  const [aiFiles, setAiFiles] = useState<LocalAgentFile[]>([]);

  // Direction
  const [direction, setDirection] = useState("up"); // "up" = faces desk/monitor (typical desk setup)

  // Presets
  const [presets, setPresets] = useState<NpcPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [identityCustomized, setIdentityCustomized] = useState(false);
  const [soulCustomized, setSoulCustomized] = useState(false);

  // --- Derived ---
  const isEdit = !!editingNpc;
  const atLimit = currentNpcCount >= MAX_NPC_COUNT;
  const personaCompat = identity.trim();
  const canSubmit = name.trim().length > 0 && !!aiProvider && !!aiModel.trim() && !!aiApiKey.trim();

  // --- Build appearance (with preset support) ---
  const buildAppearance = useCallback((): CharacterAppearance => {
    if (appearanceMode === "presets" && selectedPresetId) {
      const preset = presets.find((p) => p.id === selectedPresetId);
      if (preset) return preset.appearance as CharacterAppearance;
    }
    return buildAppearanceFromHook();
  }, [appearanceMode, selectedPresetId, presets, buildAppearanceFromHook]);

  const findPreset = useCallback((presetId: string | null) => {
    if (!presetId) return null;
    return presets.find((preset) => preset.id === presetId) || null;
  }, [presets]);

  const applyPresetSelection = useCallback((presetId: string) => {
    const preset = findPreset(presetId);
    if (!preset) return;

    const resolvedName = name.trim() || preset.displayName || preset.name || t("npc.defaultName");

    setSelectedPresetId(preset.id);
    setAppearanceMode("presets");
    setPersonaPresetId(preset.id);

    if (!name.trim()) {
      setName(preset.displayName || preset.name);
    }

    setIdentity(localizeNpcPromptDocument(applyPresetName(preset.identity, resolvedName), locale, "identity"));
    setSoul(localizeNpcPromptDocument(applyPresetName(preset.soul, resolvedName), locale, "soul"));
    setIdentityCustomized(false);
    setSoulCustomized(false);
  }, [findPreset, locale, name, t]);

  // --- Initialise / reset on open or editingNpc change ---
  useEffect(() => {
    if (!isOpen) return;
    startTransition(() => {
      setStep("configure");
      if (editingNpc) {
        setName(editingNpc.name);
        setIdentity(editingNpc.persona || "");
        setSoul("");
        setShowAdvanced(false);
        setDirection(editingNpc.direction || "up");
        const app = editingNpc.appearance as CharacterAppearance | null;
        if (app && app.bodyType && app.layers) {
          setBodyType(app.bodyType);
          setLayers(app.layers);
          setAppearanceMode("custom");
          setSelectedPresetId(null);
        }
        setPersonaPresetId("custom");
        setIdentityCustomized(true);
        setSoulCustomized(true);
      } else {
        setName("");
        setIdentity("");
        setSoul("");
        setShowAdvanced(false);
        setBodyType("male");
        setLayers({ body: { itemKey: "body", variant: "light" }, eye_color: { itemKey: "eye_color", variant: "brown" } });
        setActiveCategory("body");
        setDirection("down");
        setAppearanceMode("presets");
        setSelectedPresetId(null);
        setPersonaPresetId("custom");
        setIdentityCustomized(false);
        setSoulCustomized(false);
      }
      setAiProvider("openai");
      setAiModel("");
      setAiApiKey("");
      setAiSystemPrompt("");
      setAiFiles([]);
    });
  }, [isOpen, editingNpc, setBodyType, setLayers, setActiveCategory]);

  // --- Load presets from local data (no API needed) ---
  useEffect(() => {
    if (!isOpen) return;

    const localPresets: NpcPreset[] = OFFICE_PRESETS.map((preset) => ({
      id: preset.id,
      name: preset.nameKo,
      displayName: preset.nameKo,
      identity: preset.identity,
      soul: preset.soul,
      appearance: {
        bodyType: preset.bodyType,
        layers: Object.fromEntries(
          Object.entries(preset.layers)
            .filter(([, v]) => v !== null)
            .map(([k, v]) => [k, { itemKey: v!.itemKey, variant: v!.variant }]),
        ),
      },
      defaultAgentId: preset.id,
    }));
    setPresets(localPresets);

    // Re-apply persona text if a preset is active and identity hasn't been customized
    if (personaPresetId !== "custom" && !identityCustomized && !soulCustomized) {
      const nextPreset = localPresets.find((p) => p.id === personaPresetId);
      if (nextPreset) {
        const resolvedName = name.trim() || nextPreset.displayName || nextPreset.name || t("npc.defaultName");
        setIdentity(localizeNpcPromptDocument(applyPresetName(nextPreset.identity, resolvedName), locale, "identity"));
        setSoul(localizeNpcPromptDocument(applyPresetName(nextPreset.soul, resolvedName), locale, "soul"));
      }
    }
  }, [isOpen, locale, identityCustomized, soulCustomized, personaPresetId, name, t]);

  // --- Apply persona preset ---
  const handlePersonaPresetChange = useCallback((presetId: string) => {
    setPersonaPresetId(presetId);
    if (presetId === "custom") {
      setIdentity("");
      setSoul("");
      setIdentityCustomized(false);
      setSoulCustomized(false);
      return;
    }
    if (findPreset(presetId)) {
      applyPresetSelection(presetId);
      return;
    }
    const preset = PERSONA_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const currentName = name.trim() || t("npc.defaultName");
    setIdentity(localizeNpcPromptDocument(applyPresetName(preset.identity, currentName), locale, "identity"));
    setSoul(localizeNpcPromptDocument(applyPresetName(preset.soul, currentName), locale, "soul"));
    setIdentityCustomized(false);
    setSoulCustomized(false);
  }, [applyPresetSelection, findPreset, locale, name, t]);

  const handleNameChange = (newName: string) => {
    setName(newName);
    if (personaPresetId !== "custom") {
      const preset = PERSONA_PRESETS.find((p) => p.id === personaPresetId);
      if (preset) {
        const n = newName.trim() || t("npc.defaultName");
        if (!identityCustomized) {
          setIdentity(localizeNpcPromptDocument(applyPresetName(preset.identity, n), locale, "identity"));
        }
        if (!soulCustomized) {
          setSoul(localizeNpcPromptDocument(applyPresetName(preset.soul, n), locale, "soul"));
        }
      }
    }
  };

  // --- Submit ---
  const handleSubmit = () => {
    if (!canSubmit) return;
    const appearance = buildAppearance();

    if (isEdit && onSaveEdit) {
      onSaveEdit(editingNpc!.id, {
        name: name.trim(),
        persona: personaCompat,
        appearance,
        direction,
        identity: identity.trim(),
        soul: soul.trim(),
        locale,
        provider: aiProvider,
        model: aiModel.trim(),
        apiKey: aiApiKey.trim(),
        systemPrompt: aiSystemPrompt.trim() || identity.trim(),
        files: aiFiles,
      });
    } else {
      onPlaceOnMap({
        name: name.trim(),
        persona: personaCompat,
        appearance,
        direction,
        identity: identity.trim(),
        soul: soul.trim(),
        locale,
        provider: aiProvider,
        model: aiModel.trim(),
        apiKey: aiApiKey.trim(),
        systemPrompt: aiSystemPrompt.trim() || identity.trim(),
        files: aiFiles,
      });
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={handleBackdropClick}>
      <div className="relative max-w-4xl w-full mx-4 max-h-[90vh] bg-gray-900 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">
            {isEdit ? t("npc.edit") : t("npc.hire")}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none" aria-label={t("common.close")}>&times;</button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left section — inputs + appearance selector */}
          <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-5">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">{t("npc.name")}</label>
              <input
                type="text" maxLength={50} value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder={t("npc.namePlaceholder")}
                className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* AI Provider Section */}
            <AiProviderSection
              provider={aiProvider} setProvider={setAiProvider}
              model={aiModel} setModel={setAiModel}
              apiKey={aiApiKey} setApiKey={setAiApiKey}
              systemPrompt={aiSystemPrompt} setSystemPrompt={setAiSystemPrompt}
              files={aiFiles} setFiles={setAiFiles}
              t={t}
            />

            {/* Persona Section */}
            <PersonaSection
              personaPresetId={personaPresetId}
              onPersonaPresetChange={handlePersonaPresetChange}
              identity={identity} setIdentity={setIdentity}
              soul={soul} setSoul={setSoul}
              setIdentityCustomized={setIdentityCustomized}
              setSoulCustomized={setSoulCustomized}
              showAdvanced={showAdvanced} setShowAdvanced={setShowAdvanced}
              t={t}
            />

            {/* Appearance */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">{t("npc.appearance")}</label>
              <div className="flex gap-1 mb-3">
                <button
                  onClick={() => setAppearanceMode("presets")}
                  className={`px-4 py-1.5 rounded text-sm font-medium ${
                    appearanceMode === "presets" ? "bg-indigo-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >{t("npc.presets")}</button>
                <button
                  onClick={() => setAppearanceMode("custom")}
                  className={`px-4 py-1.5 rounded text-sm font-medium ${
                    appearanceMode === "custom" ? "bg-indigo-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >{t("npc.personaCustom")}</button>
              </div>

              {appearanceMode === "presets" && (
                <div>
                  {presets.length === 0 ? (
                    <p className="text-sm text-gray-500">{t("npc.noPresets")}</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {presets.map((preset) => (
                        <PresetCard
                          key={preset.id}
                          preset={preset}
                          isSelected={selectedPresetId === preset.id}
                          onSelect={() => applyPresetSelection(preset.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {appearanceMode === "custom" && (
                <AppearanceEditor
                  bodyType={bodyType}
                  layers={layers}
                  activeCategory={activeCategory}
                  onBodyTypeChange={(bt) => handleBodyTypeChange(bt)}
                  onSkinChange={setSkin}
                  onSelectItem={selectItem}
                  onClearCategory={clearCategory}
                  onSetVariant={setVariant}
                  onSetActiveCategory={setActiveCategory}
                  isItemCompatible={isItemCompatible}
                  getItemBodyTypes={getItemBodyTypes}
                  compatibleCount={compatibleCount}
                  variant="compact"
                  presetsSlot={
                    <button
                      onClick={randomize}
                      className="w-full px-2 py-1 bg-indigo-900/60 hover:bg-indigo-800 rounded text-xs text-indigo-300 text-center font-semibold mb-1"
                    >{t("characters.random")}</button>
                  }
                />
              )}
            </div>
          </div>

          {/* Right section — preview canvas */}
          <div className="w-56 flex flex-col items-center justify-center gap-4 p-6 border-l border-gray-700">
            <CharacterPreview
              appearance={buildAppearance()}
              scale={PREVIEW_SCALE}
              direction={direction}
              active={isOpen}
            />
            <p className="text-xs text-gray-500 mb-2">{t("common.preview")}</p>
            <div className="flex gap-1">
              {DIRECTION_LABELS.map((d) => (
                <button
                  key={d.id} type="button"
                  onClick={() => setDirection(d.id)}
                  className={`w-8 h-8 rounded text-sm font-bold ${
                    direction === d.id ? "bg-indigo-600 text-white" : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                  }`}
                >{d.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-between">
          <div>
            {!isEdit && atLimit && (
              <p className="text-xs text-amber-400">
                {t("npc.limitReached", { count: MAX_NPC_COUNT, max: MAX_NPC_COUNT })}
              </p>
            )}
          </div>
          <div className="flex gap-3 items-center">
            <button onClick={onClose} className="px-4 py-2 rounded text-sm bg-gray-700 text-gray-300 hover:bg-gray-600">
              {t("common.cancel")}
            </button>

            {step === "configure" && (
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || (!isEdit && atLimit)}
                className="px-5 py-2 rounded text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isEdit ? t("common.save") : t("npc.placeOnMap")}
              </button>
            )}

            {step === "place" && (
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || (!isEdit && atLimit)}
                className="px-5 py-2 rounded text-sm font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >{t("npc.placeOnMap")}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI Provider Section sub-component
// ---------------------------------------------------------------------------

type AiProvider = "openai" | "anthropic" | "google";

const PROVIDER_LABELS: Record<AiProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic (Claude)",
  google: "Google (Gemini)",
};

const API_KEY_PLACEHOLDER: Record<AiProvider, string> = {
  openai: "sk-...",
  anthropic: "sk-ant-...",
  google: "AIza...",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AiProviderSection({
  provider, setProvider,
  model, setModel,
  apiKey, setApiKey,
  systemPrompt, setSystemPrompt,
  files, setFiles,
  t,
}: {
  provider: "openai" | "anthropic" | "google";
  setProvider: (v: "openai" | "anthropic" | "google") => void;
  model: string;
  setModel: (v: string) => void;
  apiKey: string;
  setApiKey: (v: string) => void;
  systemPrompt: string;
  setSystemPrompt: (v: string) => void;
  files: LocalAgentFile[];
  setFiles: (v: LocalAgentFile[]) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const models = MODELS_BY_PROVIDER[provider] ?? [];
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProviderChange = (p: AiProvider) => {
    setProvider(p);
    setModel("");
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;
    setUploading(true);
    const newFiles: LocalAgentFile[] = [];
    for (const file of Array.from(selected)) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/files/upload", { method: "POST", body: formData });
        if (res.ok) {
          const data = await res.json();
          newFiles.push({
            id: crypto.randomUUID(),
            name: file.name,
            blobUrl: data.url,
            contentType: file.type,
            size: file.size,
          });
        } else {
          // Fallback: store as data URI for local dev (no BLOB_READ_WRITE_TOKEN)
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          newFiles.push({
            id: crypto.randomUUID(),
            name: file.name,
            blobUrl: dataUrl,
            contentType: file.type,
            size: file.size,
          });
        }
      } catch {
        // skip failed uploads silently
      }
    }
    setFiles([...files, ...newFiles]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (id: string) => setFiles(files.filter((f) => f.id !== id));

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">
        {t("npc.aiProviderConfig") || "AI Provider Configuration"}
      </label>

      <div className="space-y-3 rounded border border-gray-700 bg-gray-800/60 p-3">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            {t("npc.aiProvider") || "Provider"}
          </label>
          <select
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value as AiProvider)}
            className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {(Object.keys(PROVIDER_LABELS) as AiProvider[]).map((p) => (
              <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            {t("npc.aiModel") || "Model"}
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">{t("npc.selectModel") || "Select a model..."}</option>
            {models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            {t("npc.aiApiKey") || "API Key"}
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={API_KEY_PLACEHOLDER[provider]}
            className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            {t("npc.aiSystemPrompt") || "System Prompt (optional)"}
          </label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={3}
            placeholder={t("npc.aiSystemPromptPlaceholder") || "당신은 친절한 AI 어시스턴트입니다."}
            className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        {/* Reference files */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            참고 파일 (선택)
          </label>
          <div className="space-y-1">
            {files.map((f) => (
              <div key={f.id} className="flex items-center justify-between bg-gray-700/60 rounded px-2 py-1 text-xs text-gray-300">
                <span className="truncate max-w-[180px]" title={f.name}>{f.name}</span>
                <span className="text-gray-500 mx-2 shrink-0">{formatBytes(f.size)}</span>
                <button
                  type="button"
                  onClick={() => removeFile(f.id)}
                  className="text-gray-500 hover:text-red-400 shrink-0 leading-none"
                  aria-label="파일 제거"
                >×</button>
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="mt-1.5 w-full px-2 py-1.5 rounded border border-dashed border-gray-600 text-xs text-gray-400 hover:border-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
          >
            {uploading ? "업로드 중…" : "+ 파일 추가"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.md,.csv,.json,.xml,.pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
          <p className="text-[10px] text-gray-600 mt-1">시스템 프롬프트에 자동 첨부됩니다. 최대 10 MB/파일</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Persona Section sub-component
// ---------------------------------------------------------------------------

function PersonaSection({
  personaPresetId, onPersonaPresetChange,
  identity, setIdentity,
  soul, setSoul,
  setIdentityCustomized,
  setSoulCustomized,
  showAdvanced, setShowAdvanced,
  t,
}: {
  personaPresetId: string;
  onPersonaPresetChange: (id: string) => void;
  identity: string;
  setIdentity: (v: string) => void;
  soul: string;
  setSoul: (v: string) => void;
  setIdentityCustomized: (v: boolean) => void;
  setSoulCustomized: (v: boolean) => void;
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [identityHeight, setIdentityHeight] = useState(128);
  const [showFullEditor, setShowFullEditor] = useState(false);
  const dragStartY = useRef<number>(0);
  const dragStartHeight = useRef<number>(0);

  const handleDragMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragStartY.current = e.clientY;
    dragStartHeight.current = identityHeight;
    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientY - dragStartY.current;
      setIdentityHeight(Math.max(80, dragStartHeight.current + delta));
    };
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">{t("npc.persona")}</label>

      <div className="mb-2">
        <select
          value={personaPresetId}
          onChange={(e) => onPersonaPresetChange(e.target.value)}
          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="custom">{t("npc.personaCustom")}</option>
          {PERSONA_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>{p.name} — {p.role}</option>
          ))}
        </select>
      </div>

      <div className="relative">
        <textarea
          maxLength={2000} value={identity}
          onChange={(e) => { setIdentity(e.target.value); setIdentityCustomized(true); }}
          placeholder={t("npc.identityPlaceholder")}
          style={{ height: identityHeight }}
          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="button"
          onClick={() => setShowFullEditor(true)}
          title={t("npc.edit")}
          className="absolute top-1.5 right-1.5 p-1 rounded bg-gray-700/80 hover:bg-gray-600 text-gray-400 hover:text-white transition-colors"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <div
          onMouseDown={handleDragMouseDown}
          className="absolute bottom-0 right-0 w-5 h-5 cursor-s-resize flex items-end justify-end pr-0.5 pb-0.5"
          title={t("mapEditor.pixel.resize")}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" className="text-gray-500">
            <line x1="2" y1="9" x2="9" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="5" y1="9" x2="9" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-1 text-right">{identity.length}/2000</p>

      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 flex items-center gap-1"
      >
        <span className={`transition-transform ${showAdvanced ? "rotate-90" : ""}`}>&#9654;</span>
        {t("npc.advanced")}
      </button>

      {showAdvanced && (
        <div className="mt-2">
          <label className="block text-xs font-medium text-gray-400 mb-1">
            {t("npc.soul")} {t("npc.advancedHint")}
          </label>
          <textarea
            maxLength={3000} rows={6} value={soul}
            onChange={(e) => { setSoul(e.target.value); setSoulCustomized(true); }}
            placeholder={t("npc.soulPlaceholder")}
            className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-xs text-gray-500 mt-1 text-right">{soul.length}/3000</p>
        </div>
      )}

      {showFullEditor && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70"
          onClick={(e) => { if (e.target === e.currentTarget) setShowFullEditor(false); }}
        >
          <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col" style={{ maxHeight: "80vh" }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <h3 className="text-sm font-semibold text-white">{t("npc.persona")}</h3>
              <button onClick={() => setShowFullEditor(false)} className="text-gray-400 hover:text-white text-xl leading-none" aria-label={t("common.close")}>&times;</button>
            </div>
            <div className="flex-1 p-4 flex flex-col overflow-hidden min-h-0">
              <textarea
                maxLength={2000} value={identity}
                onChange={(e) => { setIdentity(e.target.value); setIdentityCustomized(true); }}
                placeholder={t("npc.identityPlaceholder")}
                className="flex-1 w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                style={{ minHeight: "300px" }}
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1 text-right">{identity.length}/2000</p>
            </div>
            <div className="px-4 py-3 border-t border-gray-700 flex justify-end">
              <button
                onClick={() => setShowFullEditor(false)}
                className="px-4 py-2 rounded text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
              >{t("common.done")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preset Card sub-component
// ---------------------------------------------------------------------------

function PresetCard({
  preset, isSelected, onSelect,
}: {
  preset: NpcPreset;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`flex flex-col items-center gap-1 p-2 rounded border-2 transition-colors ${
        isSelected ? "border-indigo-500 bg-gray-800" : "border-transparent bg-gray-800 hover:border-gray-600"
      }`}
    >
      <CharacterPreview
        appearance={preset.appearance as CharacterAppearance}
        scale={2}
        fps={6}
      />
      <span className="text-xs text-gray-300">{preset.name}</span>
    </button>
  );
}
