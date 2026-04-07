'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AvatarType, Provider, Agent, AgentFile } from '@/types'
import { PixelCharacter } from './pixel-character'
import { MODELS } from '@/lib/models'
import { saveAgent } from '@/lib/agents'

const AVATAR_TYPES: AvatarType[] = ['warrior', 'mage', 'archer', 'healer', 'rogue', 'bard']
const AVATAR_LABELS: Record<AvatarType, string> = {
  warrior: '전사',
  mage: '마법사',
  archer: '궁수',
  healer: '힐러',
  rogue: '도적',
  bard: '음유시인',
}

const PRESET_COLORS = ['#ff4757', '#2ed573', '#1e90ff', '#ffd700', '#a855f7', '#ff6b6b']

const PROVIDER_LABELS: Record<Provider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
}

const API_KEY_LINKS: Record<Provider, string> = {
  openai: 'https://platform.openai.com/api-keys',
  anthropic: 'https://console.anthropic.com/settings/keys',
  google: 'https://aistudio.google.com/app/apikey',
}

const STEPS = ['캐릭터 선택', '기본 정보', 'LLM 설정', '시스템 프롬프트', '파일 업로드']

export function AgentWizard() {
  const router = useRouter()
  const [step, setStep] = useState(0)

  // Step 1
  const [avatar, setAvatar] = useState<AvatarType>('warrior')
  const [color, setColor] = useState('#1e90ff')

  // Step 2
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [description, setDescription] = useState('')

  // Step 3
  const [provider, setProvider] = useState<Provider>('openai')
  const [model, setModel] = useState('gpt-4o')
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)

  // Step 4
  const [systemPrompt, setSystemPrompt] = useState('')

  // Step 5
  const [files, setFiles] = useState<AgentFile[]>([])
  const [uploading, setUploading] = useState(false)

  const [saving, setSaving] = useState(false)

  const canAdvance = useCallback((): boolean => {
    switch (step) {
      case 0: return true
      case 1: return name.trim().length > 0 && role.trim().length > 0
      case 2: return model.length > 0 && apiKey.trim().length > 0
      case 3: return true
      case 4: return true
      default: return false
    }
  }, [step, name, role, model, apiKey])

  const goNext = () => {
    if (step === 2 && !systemPrompt) {
      setSystemPrompt(`당신은 ${name}입니다. ${role} 전문가로서 사용자를 돕습니다. 항상 한국어로 답변하세요.`)
    }
    if (step < STEPS.length - 1) setStep(step + 1)
  }

  const handleFileUpload = async (fileList: FileList | null) => {
    if (!fileList) return
    setUploading(true)

    for (const file of Array.from(fileList)) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/files/upload', { method: 'POST', body: formData })
        if (!res.ok) continue
        const data = await res.json()
        const newFile: AgentFile = {
          id: crypto.randomUUID(),
          name: data.name,
          blobUrl: data.url,
          contentType: data.contentType,
          size: data.size,
        }
        setFiles((prev) => [...prev, newFile])
      } catch {
        // skip failed uploads silently
      }
    }
    setUploading(false)
  }

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const handleCreate = async () => {
    setSaving(true)
    const agent: Agent = {
      id: crypto.randomUUID(),
      name: name.trim(),
      role: role.trim(),
      description: description.trim(),
      avatar,
      color,
      provider,
      model,
      apiKey,
      systemPrompt: systemPrompt || `당신은 ${name}입니다. ${role} 전문가로서 사용자를 돕습니다. 항상 한국어로 답변하세요.`,
      files,
      messageCount: 0,
      level: 1,
      createdAt: new Date().toISOString(),
    }
    saveAgent(agent)
    router.push(`/agents/${agent.id}`)
  }

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1048576).toFixed(1)} MB`
  }

  return (
    <div className="min-h-screen dot-bg">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <button
          onClick={() => router.push('/')}
          className="text-gray-400 hover:text-white text-sm mb-6 inline-block transition-colors"
        >
          &larr; 로스터로 돌아가기
        </button>

        <h1
          className="text-white text-lg mb-8"
          style={{ fontFamily: "'Press Start 2P', monospace" }}
        >
          NEW AGENT
        </h1>

        {/* Progress bar */}
        <div className="flex items-center gap-1 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div
                className="h-1.5 w-full rounded-full transition-colors"
                style={{
                  backgroundColor: i <= step ? color : '#333',
                }}
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mb-6">
          Step {step + 1}/{STEPS.length}: {STEPS[step]}
        </p>

        {/* Steps */}
        <div className="nb-card bg-[#141414] rounded-lg p-6">
          {/* Step 1: Character Selection */}
          {step === 0 && (
            <div>
              <h2 className="text-white font-bold mb-4">캐릭터를 선택하세요</h2>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 mb-6">
                {AVATAR_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setAvatar(t)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                      avatar === t
                        ? 'border-[#ffd700] bg-[#1a1a1a]'
                        : 'border-[#333] hover:border-[#555] bg-[#0a0a0a]'
                    }`}
                  >
                    <PixelCharacter type={t} size={48} animated={avatar === t} />
                    <span className="text-[10px] text-gray-300">{AVATAR_LABELS[t]}</span>
                  </button>
                ))}
              </div>

              <h3 className="text-white font-bold mb-3 text-sm">테마 색상</h3>
              <div className="flex gap-3">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${
                      color === c ? 'border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Basic Info */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-white font-bold mb-4">기본 정보</h2>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">에이전트 이름 *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="에이전트 이름"
                  className="w-full px-3 py-2.5 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">역할 *</label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="예: 마케팅 분석가, 코드 리뷰어, HR 어시스턴트..."
                  className="w-full px-3 py-2.5 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">설명</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="이 에이전트의 특기와 성격을 간단히 설명하세요"
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg text-sm resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 3: LLM Settings */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-white font-bold mb-4">LLM 설정</h2>

              {/* Provider tabs */}
              <div className="flex gap-2">
                {(Object.keys(MODELS) as Provider[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setProvider(p)
                      setModel(MODELS[p][0].id)
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-bold border-2 transition-all ${
                      provider === p
                        ? 'border-white bg-white text-black'
                        : 'border-[#333] text-gray-400 hover:border-[#555]'
                    }`}
                  >
                    {PROVIDER_LABELS[p]}
                  </button>
                ))}
              </div>

              {/* Model grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {MODELS[provider].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setModel(m.id)}
                    className={`text-left p-3 rounded-lg border-2 transition-all ${
                      model === m.id
                        ? 'border-[#ffd700] bg-[#1a1a1a]'
                        : 'border-[#333] hover:border-[#555] bg-[#0a0a0a]'
                    }`}
                  >
                    <div className="text-sm font-bold text-white">{m.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{m.description}</div>
                  </button>
                ))}
              </div>

              {/* API Key */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">API Key *</label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full px-3 py-2.5 rounded-lg text-sm pr-16"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-white px-2 py-1"
                  >
                    {showApiKey ? '숨기기' : '보기'}
                  </button>
                </div>
                <a
                  href={API_KEY_LINKS[provider]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs mt-1 inline-block hover:underline"
                  style={{ color }}
                >
                  {PROVIDER_LABELS[provider]} API Key 발급받기 &rarr;
                </a>
              </div>
            </div>
          )}

          {/* Step 4: System Prompt */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-white font-bold mb-4">시스템 프롬프트</h2>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="에이전트에게 부여할 역할과 지시사항을 작성하세요..."
                rows={8}
                className="w-full px-3 py-2.5 rounded-lg text-sm resize-none"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>{systemPrompt.length}자</span>
              </div>
              <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[#333]">
                <p className="text-xs text-gray-400 font-bold mb-2">Tips</p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>- 에이전트의 역할과 성격을 명확히 정의하세요</li>
                  <li>- 답변 형식이나 톤을 지정할 수 있습니다</li>
                  <li>- 금지사항이나 주의사항을 포함하면 좋습니다</li>
                  <li>- 한국어/영어 답변 선호도를 지정하세요</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step 5: File Upload */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-white font-bold mb-4">참고 파일 업로드 (선택)</h2>
              <p className="text-xs text-gray-400 mb-4">
                에이전트가 참고할 파일을 업로드하세요. PDF, TXT, MD, DOCX, PNG, JPG 지원
              </p>

              {/* Drop zone */}
              <label
                className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-[#333] rounded-lg cursor-pointer hover:border-[#555] transition-colors"
              >
                <input
                  type="file"
                  multiple
                  accept=".pdf,.txt,.md,.docx,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files)}
                />
                <span className="text-2xl text-gray-600 mb-1">&#128206;</span>
                <span className="text-xs text-gray-400">
                  {uploading ? '업로드 중...' : '클릭하거나 파일을 놓으세요'}
                </span>
              </label>

              {/* File list */}
              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white truncate">{f.name}</p>
                        <p className="text-[10px] text-gray-500">{formatSize(f.size)}</p>
                      </div>
                      <button
                        onClick={() => removeFile(f.id)}
                        className="text-red-400 hover:text-red-300 text-xs ml-2"
                      >
                        &#10005;
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Create button */}
              <button
                onClick={handleCreate}
                disabled={saving}
                className="nb-btn nb-btn-gold w-full py-3 rounded-lg text-sm font-bold mt-4"
              >
                {saving ? '생성 중...' : '완료 - 에이전트 고용'}
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="nb-btn px-4 py-2 rounded text-sm bg-[#1a1a1a] text-white disabled:opacity-30"
          >
            &larr; 이전
          </button>
          {step < STEPS.length - 1 && (
            <button
              onClick={goNext}
              disabled={!canAdvance()}
              className="nb-btn nb-btn-gold px-6 py-2 rounded text-sm font-bold"
            >
              다음 &rarr;
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
