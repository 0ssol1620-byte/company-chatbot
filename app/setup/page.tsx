"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import CharacterPreview from "@/components/CharacterPreview";
import AppearanceEditor from "@/components/AppearanceEditor";
import { useCharacterAppearance } from "@/hooks/useCharacterAppearance";
import { saveCharacter } from "@/lib/local-store";

export default function SetupPage() {
  const t = useT();
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        {t("common.loading")}
      </div>
    }>
      <SetupPageInner />
    </Suspense>
  );
}

function SetupPageInner() {
  const t = useT();
  const router = useRouter();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const appearance = useCharacterAppearance();
  const {
    bodyType, setBodyType, layers, setLayers,
    activeCategory, setActiveCategory,
    handleBodyTypeChange, selectItem, clearCategory, setVariant, setSkin,
    isItemCompatible, getItemBodyTypes, compatibleCount,
    randomize, buildAppearance,
  } = appearance;

  const handleSave = async () => {
    if (!name.trim()) {
      setError(t("character.nameRequired") || "이름을 입력해주세요.");
      return;
    }
    setSaving(true);
    setError("");

    const builtAppearance = buildAppearance();
    saveCharacter({
      id: crypto.randomUUID(),
      name: name.trim(),
      appearance: builtAppearance,
    });

    router.replace("/");
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-start pt-8 px-4 pb-16">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">
            ViewChat
          </h1>
          <p className="text-gray-400 text-sm">
            {t("character.setupTitle") || "캐릭터를 만들어 사무실에 입장하세요"}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-6">
          {/* Appearance editor */}
          <div className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-4">
              {t("character.appearance") || "외관 설정"}
            </h2>
            <AppearanceEditor
              bodyType={bodyType}
              layers={layers}
              activeCategory={activeCategory}
              onBodyTypeChange={handleBodyTypeChange}
              onSelectItem={selectItem}
              onClearCategory={clearCategory}
              onSetVariant={setVariant}
              onSkinChange={setSkin}
              onSetActiveCategory={setActiveCategory}
              isItemCompatible={isItemCompatible}
              getItemBodyTypes={getItemBodyTypes}
              compatibleCount={compatibleCount}
              presetsSlot={
                <button
                  type="button"
                  onClick={randomize}
                  className="px-3 py-1.5 text-xs rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
                >
                  🎲 랜덤
                </button>
              }
            />
          </div>

          {/* Preview + name */}
          <div className="flex flex-col gap-4">
            <div className="bg-gray-800 rounded-xl p-6 flex flex-col items-center gap-4">
              <h2 className="text-white font-semibold self-start">
                {t("character.preview") || "미리보기"}
              </h2>
              <CharacterPreview
                appearance={buildAppearance()}
                scale={4}
                direction="down"
              />
            </div>

            <div className="bg-gray-800 rounded-xl p-6">
              <label className="block text-sm text-gray-400 mb-2">
                {t("character.name") || "캐릭터 이름"}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                maxLength={20}
                placeholder={t("character.namePlaceholder") || "이름 입력..."}
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              {error && (
                <p className="text-red-400 text-xs mt-2">{error}</p>
              )}
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="w-full py-3 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
            >
              {saving
                ? (t("common.loading") || "로딩...")
                : (t("character.enterOffice") || "사무실 입장하기 →")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
