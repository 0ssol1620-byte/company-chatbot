'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Agent, OfficerType, Provider } from '@/types'
import { getAgent, updateAgent, deleteAgent, getLevelInfo } from '@/lib/agents'
import { MODELS } from '@/lib/models'
import { PixelCharacter, OFFICER_LABELS } from '@/components/pixel-character'
import { DotBackground } from '@/components/dot-background'

const AVATAR_TYPES: OfficerType[] = ['developer', 'marketer', 'analyst', 'planner', 'hr', 'sales']
const PRESET_COLORS = ['#ff4757', '#2ed573', '#1e90ff', '#ffd700', '#a855f7', '#ff6b6b', '#00cec9', '#fd9644']
const PROVIDER_LABELS: Record<Provider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  groq: 'Groq',
  mistral: 'Mistral',
  ollama: 'Ollama',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function AgentSettingsPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()

  const [agent, setAgent] = useState<Agent | null>(null)
  const [loaded, setLoaded] = useState(false)

  // Form fields
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [description, setDescription] = useState('')
  const [avatar, setAvatar] = useState<OfficerType>('developer')
  const [color, setColor] = useState('#1e90ff')
  const [provider, setProvider] = useState<Provider>('openai')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [agentFiles, setAgentFiles] = useState(agent?.files ?? [])

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    const a = getAgent(id)
    if (a) {
      setAgent(a)
      setName(a.name)
      setRole(a.role)
      setDescription(a.description)
      setAvatar(a.avatar)
      setColor(a.color)
      setProvider(a.provider)
      setModel(a.model)
      setApiKey(a.apiKey)
      setSystemPrompt(a.systemPrompt)
      setAgentFiles(a.files)
    }
    setLoaded(true)
  }, [id])

  const handleSave = () => {
    if (!name.trim() || !role.trim()) return
    setSaving(true)
    updateAgent(id, {
      name: name.trim(),
      role: role.trim(),
      description: description.trim(),
      avatar,
      color,
      provider,
      model,
      apiKey,
      systemPrompt,
      files: agentFiles,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleDelete = () => {
    if (!agent) return
    try { localStorage.removeItem(`agent-${id}-chat`) } catch { /* ignore */ }
    deleteAgent(id)
    router.push('/')
  }

  const handleClearChat = () => {
    if (confirm('이 에이전트와의 대화 기록을 모두 삭제할까요?')) {
      try { localStorage.removeItem(`agent-${id}-chat`) } catch { /* ignore */ }
      alert('대화 기록이 삭제되었습니다.')
    }
  }

  const handleRemoveFile = (fileId: string) => {
    setAgentFiles(prev => prev.filter(f => f.id !== fileId))
  }

  if (!loaded) {
    return (
      <DotBackground>
        <div className="flex items-center justify-center h-screen">
          <span
            className="text-gray-500 text-xs"
            style={{ fontFamily: "'Press Start 2P', monospace" }}
          >
            LOADING...
          </span>
        </div>
      </DotBackground>
    )
  }

  if (!agent) {
    return (
      <DotBackground>
        <div className="flex flex-col items-center justify-center h-screen gap-4">
          <p className="text-white text-sm">에이전트를 찾을 수 없습니다</p>
          <Link href="/" className="nb-btn nb-btn-gold px-4 py-2 rounded text-sm font-bold">
            ← 로스터로
          </Link>
        </div>
      </DotBackground>
    )
  }

  const levelInfo = getLevelInfo(agent.messageCount)
  const currentModel = MODELS[provider]?.find((m) => m.id === model)

  return (
    <DotBackground>
      <div className="max-w-2xl mx-auto px-4 py-8 pb-16">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href={`/agents/${id}`}
            className="text-gray-500 hover:text-white text-xs transition-colors"
          >
            ← 채팅으로
          </Link>
          <h1
            className="text-white"
            style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '13px' }}
          >
            AGENT SETTINGS
          </h1>
        </div>

        {/* Preview card */}
        <div
          className="nb-card bg-[#141414] rounded-xl p-6 flex items-center gap-6 mb-6"
          style={{ borderColor: color, boxShadow: `4px 4px 0 ${color}66` }}
        >
          <div className="relative flex-shrink-0">
            <PixelCharacter type={avatar} size={80} animated />
            <div
              className="absolute -top-1 -right-1 text-[8px] px-1.5 py-0.5 rounded font-bold"
              style={{
                backgroundColor: color,
                color: '#0a0a0a',
                fontFamily: "'Press Start 2P', monospace",
              }}
            >
              LV.{agent.level}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-white font-bold truncate"
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '10px' }}
            >
              {name || '이름 없음'}
            </p>
            <p className="text-gray-400 text-xs mt-1 truncate">{role || '역할 없음'}</p>
            {description && (
              <p className="text-gray-600 text-[10px] mt-1 line-clamp-2">{description}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#1a1a1a] border border-[#333] text-gray-400">
                {currentModel?.name ?? model}
              </span>
              <span className="text-[10px] text-gray-600">{levelInfo.title}</span>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {/* ── Basic info ── */}
          <section className="nb-card bg-[#141414] rounded-xl p-6 space-y-4">
            <h2
              className="text-white font-bold mb-1"
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '9px', letterSpacing: '1px' }}
            >
              기본 정보
            </h2>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">에이전트 이름 *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="에이전트 이름"
                className="w-full px-3 py-2.5 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">역할 *</label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="예: 마케팅 분석가, 코드 리뷰어"
                className="w-full px-3 py-2.5 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">설명</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="이 에이전트의 특기와 성격"
                rows={3}
                className="w-full px-3 py-2.5 rounded-lg text-sm resize-none"
              />
            </div>
          </section>

          {/* ── Character & color ── */}
          <section className="nb-card bg-[#141414] rounded-xl p-6 space-y-4">
            <h2
              className="text-white font-bold mb-1"
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '9px', letterSpacing: '1px' }}
            >
              외관
            </h2>
            <div className="grid grid-cols-6 gap-2">
              {AVATAR_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setAvatar(t)}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition-all ${
                    avatar === t
                      ? 'border-[#ffd700] bg-[#1a1a1a]'
                      : 'border-[#222] hover:border-[#444] bg-[#0d0d0d]'
                  }`}
                >
                  <PixelCharacter type={t} size={36} animated={avatar === t} />
                  <span className="text-[8px] text-gray-500">{OFFICER_LABELS[t]}</span>
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-2 block">테마 색상</label>
              <div className="flex gap-3 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* ── LLM settings ── */}
          <section className="nb-card bg-[#141414] rounded-xl p-6 space-y-4">
            <h2
              className="text-white font-bold mb-1"
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '9px', letterSpacing: '1px' }}
            >
              LLM 설정
            </h2>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(MODELS) as Provider[]).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setProvider(p)
                    setModel(MODELS[p][0].id)
                    setApiKey('')
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${
                    provider === p
                      ? 'border-white bg-white text-black'
                      : 'border-[#333] text-gray-400 hover:border-[#555]'
                  }`}
                >
                  {PROVIDER_LABELS[p]}
                </button>
              ))}
            </div>
            {provider === 'ollama' ? (
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">모델 이름</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="llama3.2, mistral, gemma3 ..."
                  className="w-full px-3 py-2.5 rounded-lg text-sm"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(MODELS[provider] as readonly { id: string; name: string; description: string }[]).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setModel(m.id)}
                    className={`text-left p-3 rounded-lg border-2 transition-all ${
                      model === m.id
                        ? 'border-[#ffd700] bg-[#1a1a1a]'
                        : 'border-[#222] hover:border-[#444] bg-[#0d0d0d]'
                    }`}
                  >
                    <div className="text-xs font-bold text-white">{m.name}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{m.description}</div>
                  </button>
                ))}
              </div>
            )}
            {provider !== 'ollama' && (
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">API Key</label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="API 키 입력..."
                    className="w-full px-3 py-2.5 rounded-lg text-sm pr-16"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-white px-2 py-1 transition-colors"
                  >
                    {showApiKey ? '숨기기' : '보기'}
                  </button>
                </div>
                <p className="text-[10px] text-yellow-600 mt-2">
                  ⚠ API 키는 브라우저의 localStorage에 저장됩니다. 공용 기기에서는 사용 후 반드시 삭제해 주세요.
                </p>
              </div>
            )}
          </section>

          {/* ── System prompt ── */}
          <section className="nb-card bg-[#141414] rounded-xl p-6">
            <h2
              className="text-white font-bold mb-4"
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '9px', letterSpacing: '1px' }}
            >
              시스템 프롬프트
            </h2>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={9}
              className="w-full px-3 py-2.5 rounded-lg text-sm resize-none"
              placeholder="에이전트에게 부여할 역할과 지시사항..."
            />
            <p className="text-xs text-gray-700 mt-1 text-right">{systemPrompt.length}자</p>
          </section>

          {/* ── Files management ── */}
          {agentFiles.length > 0 && (
            <section className="nb-card bg-[#141414] rounded-xl p-6 space-y-3">
              <h2
                className="text-white font-bold mb-1"
                style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '9px', letterSpacing: '1px' }}
              >
                참고 파일
              </h2>
              {agentFiles.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate">{f.name}</p>
                    <p className="text-[10px] text-gray-500">{f.contentType}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveFile(f.id)}
                    className="text-red-400 hover:text-red-300 text-xs ml-2"
                  >
                    ✕ 제거
                  </button>
                </div>
              ))}
            </section>
          )}

          {/* ── Actions ── */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !name.trim() || !role.trim()}
              className="nb-btn nb-btn-gold flex-1 py-3 rounded-xl text-sm font-bold"
            >
              {saved ? '✓ 저장됨!' : saving ? '저장 중...' : '변경사항 저장'}
            </button>
            <button
              onClick={handleClearChat}
              className="nb-btn px-4 py-3 rounded-xl text-xs bg-[#1a1a1a] text-gray-400 border-[#333] hover:text-white transition-colors"
              title="대화 기록 삭제"
            >
              🗑 대화
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="nb-btn nb-btn-danger px-5 py-3 rounded-xl text-sm font-bold"
            >
              삭제
            </button>
          </div>
        </div>
      </div>

      {/* Custom delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="confirm-dialog-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="confirm-dialog max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-white font-bold text-sm mb-2">에이전트 삭제</p>
            <p className="text-gray-400 text-xs mb-4">
              정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
              <br />
              &quot;{agent.name}&quot; 에이전트와 대화 기록이 모두 삭제됩니다.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="nb-btn px-4 py-2 rounded text-xs bg-[#1a1a1a] text-white"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                className="nb-btn nb-btn-danger px-4 py-2 rounded text-xs font-bold"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </DotBackground>
  )
}
