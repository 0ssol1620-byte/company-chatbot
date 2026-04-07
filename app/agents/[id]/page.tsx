'use client'

import { use, useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Agent } from '@/types'
import { getAgent, incrementMessageCount, LEVEL_NAMES } from '@/lib/agents'
import { PixelCharacter } from '@/components/pixel-character'
import { DotBackground } from '@/components/dot-background'

// ── Level helpers ──────────────────────────────────────────────────────────────
const LEVEL_THRESHOLDS = [0, 10, 30, 60, 100]
const LEVEL_RANGES = [10, 20, 30, 40, Infinity]

function getLevelProgress(count: number, level: number): number {
  if (level >= 5) return 100
  const min = LEVEL_THRESHOLDS[level - 1]
  const range = LEVEL_RANGES[level - 1]
  return Math.min(100, Math.round(((count - min) / range) * 100))
}

function getUntilNext(count: number, level: number): number {
  if (level >= 5) return 0
  return Math.max(0, LEVEL_THRESHOLDS[level] - count)
}

// ── Page entry point (unwraps async params) ───────────────────────────────────
interface PageProps {
  params: Promise<{ id: string }>
}

export default function AgentChatPage({ params }: PageProps) {
  const { id } = use(params)
  const [agent, setAgent] = useState<Agent | null>(null)
  const [savedMessages, setSavedMessages] = useState<unknown[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const a = getAgent(id)
    let msgs: unknown[] = []
    try {
      const raw = localStorage.getItem(`agent-${id}-chat`)
      msgs = raw ? JSON.parse(raw) : []
    } catch {}
    setAgent(a)
    setSavedMessages(msgs)
    setLoaded(true)
  }, [id])

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
          <p
            className="text-white text-sm"
            style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '11px' }}
          >
            에이전트를 찾을 수 없습니다
          </p>
          <Link href="/" className="nb-btn nb-btn-gold px-4 py-2 rounded text-sm font-bold">
            ← 로스터로
          </Link>
        </div>
      </DotBackground>
    )
  }

  return <AgentChatUI key={id} agent={agent} savedMessages={savedMessages} />
}

// ── Main chat UI ───────────────────────────────────────────────────────────────
function AgentChatUI({
  agent,
  savedMessages,
}: {
  agent: Agent
  savedMessages: unknown[]
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lastCountedIdRef = useRef<string | null>(null)
  const prevStatusRef = useRef<string>('ready')

  const [input, setInput] = useState('')
  const [currentLevel, setCurrentLevel] = useState(agent.level)
  const [currentCount, setCurrentCount] = useState(agent.messageCount)
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [leveledUpTo, setLeveledUpTo] = useState(agent.level)

  const agentConfig = useMemo(
    () => ({
      provider: agent.provider,
      model: agent.model,
      apiKey: agent.apiKey,
      systemPrompt: agent.systemPrompt,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agent.id]
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: { agentConfig },
    }),
    messages: savedMessages as never,
  })

  const isStreaming = status === 'submitted' || status === 'streaming'

  // Persist messages
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(`agent-${agent.id}-chat`, JSON.stringify(messages))
      } catch {}
    }
  }, [messages, agent.id])

  // Level-up detection: fires once when streaming completes
  useEffect(() => {
    if (prevStatusRef.current !== 'ready' && status === 'ready') {
      const assistantMsgs = messages.filter((m) => m.role === 'assistant')
      const last = assistantMsgs[assistantMsgs.length - 1]
      if (last && last.id !== lastCountedIdRef.current) {
        lastCountedIdRef.current = last.id
        const result = incrementMessageCount(agent.id)
        setCurrentCount((c) => c + 1)
        if (result.leveled) {
          setLeveledUpTo(result.newLevel)
          setCurrentLevel(result.newLevel)
          setShowLevelUp(true)
          setTimeout(() => setShowLevelUp(false), 2800)
        }
      }
    }
    prevStatusRef.current = status
  }, [status, messages, agent.id])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const text = input.trim()
    if (!text || isStreaming) return
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    await sendMessage({ text })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleClear = () => {
    if (confirm('대화 기록을 초기화할까요?')) {
      localStorage.removeItem(`agent-${agent.id}-chat`)
      window.location.reload()
    }
  }

  const progress = getLevelProgress(currentCount, currentLevel)
  const untilNext = getUntilNext(currentCount, currentLevel)
  const modelLabel = agent.model.split('/').pop() ?? agent.model

  return (
    <div className="flex flex-col h-screen" style={{ background: '#0a0a0a' }}>
      {/* ── Header ── */}
      <header
        className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a] flex-shrink-0 gap-3"
        style={{ background: '#0d0d0d' }}
      >
        <Link
          href="/"
          className="text-gray-500 hover:text-white transition-colors text-xs flex-shrink-0"
        >
          ← 로스터
        </Link>

        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-white truncate"
            style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '9px' }}
          >
            {agent.name}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-[#1a1a1a] border border-[#333] text-gray-400 flex-shrink-0 hidden sm:inline">
            {modelLabel}
          </span>
          <span
            className="text-[10px] px-2 py-0.5 rounded font-bold flex-shrink-0"
            style={{ backgroundColor: agent.color, color: '#0a0a0a', fontFamily: "'Press Start 2P', monospace", fontSize: '8px' }}
          >
            LV.{currentLevel}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleClear}
            className="text-gray-700 hover:text-gray-400 transition-colors text-sm"
            title="대화 초기화"
          >
            🗑
          </button>
          <Link
            href={`/agents/${agent.id}/settings`}
            className="nb-btn px-3 py-1.5 rounded text-xs bg-[#1a1a1a] text-white"
          >
            ⚙
          </Link>
        </div>
      </header>

      {/* ── Main ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left sidebar */}
        <aside className="w-44 flex-shrink-0 border-r border-[#1a1a1a] p-4 flex flex-col gap-4 overflow-y-auto hidden sm:flex">
          {/* Character */}
          <div className="flex flex-col items-center gap-3 pt-2">
            <PixelCharacter
              type={agent.avatar}
              size={80}
              animated
              isThinking={isStreaming}
            />
            <span
              className="text-white text-center leading-relaxed"
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '8px' }}
            >
              {agent.name}
            </span>
            <span className="text-gray-500 text-[10px] text-center">{agent.role}</span>
          </div>

          {/* Level */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span
                className="text-[9px] font-bold"
                style={{ fontFamily: "'Press Start 2P', monospace", color: agent.color }}
              >
                LV.{currentLevel}
              </span>
              <span className="text-gray-600 text-[9px]">{LEVEL_NAMES[currentLevel]}</span>
            </div>
            <div className="h-2 bg-[#1a1a1a] rounded-full border border-[#2a2a2a] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${progress}%`, backgroundColor: agent.color }}
              />
            </div>
            <p className="text-[9px] text-gray-700 text-center">
              {currentLevel < 5 ? `다음 레벨까지 ${untilNext}개` : '최고 레벨!'}
            </p>
            <p className="text-[9px] text-gray-700 text-center">{currentCount}개 대화</p>
          </div>

          {/* Files */}
          {agent.files.length > 0 && (
            <div className="border-t border-[#1a1a1a] pt-3 space-y-1.5">
              <p className="text-[9px] text-gray-600 mb-2">📎 참고 파일</p>
              {agent.files.map((f) => (
                <div
                  key={f.id}
                  className="text-[9px] text-gray-500 truncate bg-[#111] rounded px-2 py-1 border border-[#222]"
                  title={f.name}
                >
                  {f.name}
                </div>
              ))}
            </div>
          )}

          {/* Room invite shortcut */}
          <div className="border-t border-[#1a1a1a] pt-3 mt-auto">
            <Link
              href="/rooms"
              className="block text-center text-[9px] text-gray-600 hover:text-gray-400 transition-colors"
            >
              💬 채팅방으로 초대
            </Link>
          </div>
        </aside>

        {/* Messages */}
        <main className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-5 text-center">
              <div className="sm:hidden">
                <PixelCharacter type={agent.avatar} size={72} animated />
              </div>
              <div>
                <p
                  className="text-gray-300 mb-2"
                  style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '10px' }}
                >
                  {agent.name}
                </p>
                <p className="text-gray-600 text-sm">{agent.role}</p>
                {agent.description && (
                  <p className="text-gray-700 text-xs mt-2 max-w-xs">{agent.description}</p>
                )}
                <p className="text-gray-700 text-xs mt-4">무엇이든 물어보세요 ↓</p>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 msg-${message.role === 'user' ? 'user' : 'agent'} ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'assistant' && (
                <div className="flex-shrink-0 mt-1">
                  <PixelCharacter type={agent.avatar} size={32} />
                </div>
              )}

              <div
                className={`max-w-[75%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                  message.role === 'user'
                    ? 'bg-[#1a1a1a] border-2 border-[#2a2a2a] text-white rounded-br-none'
                    : 'bg-[#141414] border-2 text-gray-100 rounded-bl-none'
                }`}
                style={
                  message.role === 'assistant'
                    ? { borderColor: `${agent.color}44` }
                    : undefined
                }
              >
                {message.parts.map((part, i) =>
                  part.type === 'text' ? <span key={i}>{part.text}</span> : null
                )}
              </div>

              {message.role === 'user' && (
                <div
                  className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold border-2 border-[#2a2a2a] mt-1 bg-[#1a1a1a] text-gray-300"
                >
                  나
                </div>
              )}
            </div>
          ))}

          {/* Thinking dots when waiting for first token */}
          {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0">
                <PixelCharacter type={agent.avatar} size={32} isThinking />
              </div>
              <div
                className="rounded-xl rounded-bl-none px-4 py-3 bg-[#141414] border-2"
                style={{ borderColor: `${agent.color}44` }}
              >
                <div className="flex gap-1.5 items-center h-5">
                  <span className="w-2 h-2 bg-gray-600 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-gray-600 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-gray-600 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mx-auto max-w-md text-center text-xs text-red-400 bg-[#1a0000] border border-red-900/50 rounded-lg px-4 py-3">
              ⚠ 오류가 발생했습니다. API 키와 네트워크를 확인해 주세요.
            </div>
          )}

          <div ref={messagesEndRef} />
        </main>
      </div>

      {/* ── Level-up toast ── */}
      {showLevelUp && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
          <div
            className="animate-levelup-appear nb-card rounded-2xl px-10 py-8 text-center"
            style={{
              background: '#0a0a0a',
              borderColor: '#ffd700',
              boxShadow: '8px 8px 0 #ffd700',
            }}
          >
            <div className="animate-float">
              <PixelCharacter type={agent.avatar} size={72} animated />
            </div>
            <p
              className="mt-4 text-[#ffd700]"
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '14px' }}
            >
              LEVEL UP!
            </p>
            <p className="text-white text-sm mt-2">
              LV.{leveledUpTo}&nbsp;&nbsp;{LEVEL_NAMES[leveledUpTo]}
            </p>
            <p className="text-gray-500 text-xs mt-1">{agent.name}이(가) 성장했습니다!</p>
          </div>
        </div>
      )}

      {/* ── Input ── */}
      <footer
        className="border-t border-[#1a1a1a] p-4 flex-shrink-0"
        style={{ background: '#0d0d0d' }}
      >
        <form onSubmit={handleSubmit} className="flex gap-3 items-end max-w-4xl mx-auto">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = `${Math.min(el.scrollHeight, 160)}px`
            }}
            placeholder={`${agent.name}에게 메시지를 보내세요...`}
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none rounded-xl px-4 py-3 text-sm max-h-40 overflow-y-auto transition-colors"
            style={{
              background: '#1a1a1a',
              border: `2px solid ${isStreaming ? '#2a2a2a' : '#333'}`,
              color: '#ededed',
            }}
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="nb-btn nb-btn-gold px-5 py-3 rounded-xl text-sm font-bold flex-shrink-0"
          >
            {isStreaming ? '···' : '전송'}
          </button>
        </form>
        <p className="text-center text-[10px] text-gray-700 mt-2">
          Enter: 전송 · Shift+Enter: 줄바꿈
        </p>
      </footer>
    </div>
  )
}
