'use client'

import { use, useState, useEffect, useRef, useMemo, useCallback } from 'react'
import Link from 'next/link'
import type { UIMessage, FileUIPart } from 'ai'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Agent } from '@/types'
import { getAgent, incrementMessageCount, getLevelInfo } from '@/lib/agents'
import { PixelCharacter } from '@/components/pixel-character'
import { DotBackground } from '@/components/dot-background'
import { buildMemoryContext, hydrateFromServer } from '@/lib/npc-memory'

// ── Markdown components ────────────────────────────────────────────────────────
const markdownComponents = {
  code({ className, children, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
    const isBlock = className?.includes('language-')
    return isBlock ? (
      <pre className="bg-[#0d0d0d] border border-[#2a2a2a] rounded p-3 overflow-x-auto my-2">
        <code className="text-sm text-gray-200 font-mono">{children}</code>
      </pre>
    ) : (
      <code className="bg-[#0d0d0d] px-1 py-0.5 rounded text-[#ffd700] text-sm font-mono" {...props}>{children}</code>
    )
  },
  p({ children }: { children?: React.ReactNode }) { return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p> },
  ul({ children }: { children?: React.ReactNode }) { return <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul> },
  ol({ children }: { children?: React.ReactNode }) { return <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol> },
  h1({ children }: { children?: React.ReactNode }) { return <h1 className="text-base font-bold mb-2 text-white">{children}</h1> },
  h2({ children }: { children?: React.ReactNode }) { return <h2 className="text-sm font-bold mb-2 text-white">{children}</h2> },
  h3({ children }: { children?: React.ReactNode }) { return <h3 className="text-xs font-bold mb-1 text-gray-200">{children}</h3> },
  a({ href, children }: { href?: string; children?: React.ReactNode }) {
    return <a href={href} className="text-[#ffd700] underline hover:text-yellow-300" target="_blank" rel="noopener noreferrer">{children}</a>
  },
  blockquote({ children }: { children?: React.ReactNode }) {
    return <blockquote className="border-l-2 border-[#333] pl-3 my-2 text-gray-400">{children}</blockquote>
  },
}

// ── Message text extraction ────────────────────────────────────────────────────
function getMessageText(message: { parts: Array<{ type: string; text?: string }> }): string {
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text)
    .join('')
}

// ── Quick actions based on role ────────────────────────────────────────────────
function getQuickActions(role: string): Array<{ label: string; text: string }> {
  const lower = role.toLowerCase()
  if (lower.includes('개발') || lower.includes('코드') || lower.includes('developer') || lower.includes('engineer')) {
    return [
      { label: '코드 리뷰', text: '이 코드를 리뷰해줘' },
      { label: '버그 분석', text: '이 버그를 분석해줘' },
      { label: '리팩토링 제안', text: '리팩토링 방법을 제안해줘' },
    ]
  }
  if (lower.includes('hr') || lower.includes('인사') || lower.includes('human resource')) {
    return [
      { label: '정책 안내', text: '관련 인사 정책을 안내해줘' },
      { label: '온보딩 체크리스트', text: '온보딩 체크리스트를 만들어줘' },
      { label: '휴가 신청 안내', text: '휴가 신청 절차를 안내해줘' },
    ]
  }
  if (lower.includes('마케팅') || lower.includes('마케터') || lower.includes('marketing')) {
    return [
      { label: '캠페인 아이디어', text: '새로운 캠페인 아이디어를 제안해줘' },
      { label: '카피라이팅', text: '이 내용을 카피라이팅해줘' },
      { label: '경쟁사 분석', text: '경쟁사 분석을 해줘' },
    ]
  }
  return [
    { label: '요약해줘', text: '방금 내용을 간단히 요약해줘' },
    { label: '번역해줘', text: '한국어로 번역해줘' },
    { label: '아이디어 제안', text: '아이디어를 제안해줘' },
  ]
}

// ── Error message helper ───────────────────────────────────────────────────────
function getErrorMessage(error: Error): string {
  const msg = error.message?.toLowerCase() ?? ''
  if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('invalid api key')) {
    return 'API 키가 올바르지 않습니다. 설정에서 확인해 주세요.'
  }
  if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many')) {
    return '요청 한도를 초과했습니다. 잠시 후 시도해 주세요.'
  }
  return '오류가 발생했습니다. API 키와 네트워크를 확인해 주세요.'
}

// ── Confetti component ─────────────────────────────────────────────────────────
function Confetti() {
  const colors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#a8e6cf', '#ff8b94', '#ffeaa7', '#dda0dd', '#98d8c8']
  const dots = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    color: colors[i % colors.length],
    left: `${5 + Math.random() * 90}%`,
    delay: `${Math.random() * 0.4}s`,
    size: `${6 + Math.random() * 8}px`,
  }))

  return (
    <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden">
      {dots.map((dot) => (
        <div
          key={dot.id}
          className="absolute animate-confetti-fall rounded-sm"
          style={{
            left: dot.left,
            bottom: '20%',
            width: dot.size,
            height: dot.size,
            backgroundColor: dot.color,
            animationDelay: dot.delay,
          }}
        />
      ))}
    </div>
  )
}

// ── Page entry point (unwraps async params) ───────────────────────────────────
interface PageProps {
  params: Promise<{ id: string }>
}

export default function AgentChatPage({ params }: PageProps) {
  const { id } = use(params)
  const [agent, setAgent] = useState<Agent | null>(null)
  const [savedMessages, setSavedMessages] = useState<UIMessage[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const a = getAgent(id)
    let msgs: UIMessage[] = []
    try {
      const raw = localStorage.getItem(`agent-${id}-chat`)
      msgs = raw ? JSON.parse(raw) : []
    } catch { /* ignore parse errors */ }
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
  savedMessages: UIMessage[]
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lastCountedIdRef = useRef<string | null>(null)
  const prevStatusRef = useRef<string>('ready')

  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<FileUIPart[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [currentLevel, setCurrentLevel] = useState(agent.level)
  const [currentCount, setCurrentCount] = useState(agent.messageCount)
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [leveledUpTo, setLeveledUpTo] = useState(agent.level)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showFlash, setShowFlash] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [memorySystemPrompt, setMemorySystemPrompt] = useState(agent.systemPrompt)

  // Hydrate memory from server on mount, then rebuild system prompt with memory context
  useEffect(() => {
    hydrateFromServer(agent.id).then(() => {
      setMemorySystemPrompt(buildMemoryContext(agent.systemPrompt, agent.id))
    })
  }, [agent.id, agent.systemPrompt])

  const agentConfig = useMemo(
    () => ({
      provider: agent.provider,
      model: agent.model,
      apiKey: agent.apiKey,
      baseUrl: agent.baseUrl,
      systemPrompt: memorySystemPrompt,
      files: agent.files,
    }),
    [agent.provider, agent.model, agent.apiKey, agent.baseUrl, memorySystemPrompt, agent.files]
  )

  const { messages, setMessages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: { agentConfig },
    }),
    messages: savedMessages as UIMessage[],
  })

  const isStreaming = status === 'submitted' || status === 'streaming'

  const levelInfo = getLevelInfo(currentCount)
  const quickActions = useMemo(() => getQuickActions(agent.role), [agent.role])

  // Persist messages
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(`agent-${agent.id}-chat`, JSON.stringify(messages))
      } catch { /* ignore storage errors */ }
    }
  }, [messages, agent.id])

  // Level-up detection + memory extraction: fires once when streaming completes
  useEffect(() => {
    if (prevStatusRef.current !== 'ready' && status === 'ready') {
      const assistantMsgs = messages.filter((m) => m.role === 'assistant')
      const last = assistantMsgs[assistantMsgs.length - 1]
      if (last && last.id !== lastCountedIdRef.current) {
        lastCountedIdRef.current = last.id
        const result = incrementMessageCount(agent.id)
        setCurrentCount((c) => c + 1)
        if (result.leveledUp) {
          setLeveledUpTo(result.newLevel)
          setCurrentLevel(result.newLevel)
          setShowLevelUp(true)
          setShowConfetti(true)
          setShowFlash(true)
          setTimeout(() => setShowFlash(false), 300)
          setTimeout(() => setShowConfetti(false), 2500)
          setTimeout(() => setShowLevelUp(false), 2800)
        }

        // Fire-and-forget memory extraction
        const userMsgs = messages.filter((m) => m.role === 'user')
        const lastUser = userMsgs[userMsgs.length - 1]
        const userText = lastUser?.parts?.find((p: { type: string }) => p.type === 'text')
        const npcText = last.parts?.find((p: { type: string }) => p.type === 'text')
        if (userText && npcText && agent.apiKey) {
          fetch('/api/memory-extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              agentConfig: { provider: agent.provider, model: agent.model, apiKey: agent.apiKey },
              userMessage: (userText as { text: string }).text,
              npcResponse: (npcText as { text: string }).text,
            }),
          })
            .then((r) => r.json())
            .then((extracted) => {
              if (!extracted || (!extracted.longTerm?.length && !extracted.shortTerm?.length && !extracted.userProfile?.length)) return
              fetch('/api/agent-memory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  npcId: agent.id,
                  longTerm: extracted.longTerm ?? [],
                  shortTerm: extracted.shortTerm ?? [],
                  userProfile: extracted.userProfile ?? [],
                }),
              })
                .then(() => {
                  // Rebuild memory context with new facts
                  setMemorySystemPrompt(buildMemoryContext(agent.systemPrompt, agent.id))
                })
                .catch(() => {})
            })
            .catch(() => {})
        }
      }
    }
    prevStatusRef.current = status
  }, [status, messages, agent.id, agent.provider, agent.model, agent.apiKey, agent.systemPrompt])

  // Scroll tracking
  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current
    if (!el) return
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 50
    setIsAtBottom(atBottom)
  }, [])

  // Auto-scroll when at bottom
  useEffect(() => {
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isStreaming, isAtBottom])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    setIsAtBottom(true)
  }

  // Convert File → FileUIPart (base64 data URL)
  const fileToUIPart = useCallback((file: File): Promise<FileUIPart> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve({
        type: 'file',
        mediaType: file.type || 'application/octet-stream',
        filename: file.name,
        url: reader.result as string,
      })
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }, [])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const parts = await Promise.all(files.map(fileToUIPart))
    setAttachments(prev => [...prev, ...parts])
    e.target.value = ''
  }, [fileToUIPart])

  const removeAttachment = useCallback((idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx))
  }, [])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const text = input.trim()
    if ((!text && attachments.length === 0) || isStreaming) return
    setInput('')
    setAttachments([])
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setIsAtBottom(true)
    await sendMessage({ text: text || ' ', files: attachments.length > 0 ? attachments : undefined })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleClear = () => {
    if (confirm('대화 기록을 초기화할까요?')) {
      try { localStorage.removeItem(`agent-${agent.id}-chat`) } catch { /* ignore */ }
      setMessages([])
    }
  }

  const handleExport = () => {
    const date = new Date().toLocaleString('ko-KR')
    const lines = [
      `[${agent.name}] 대화 기록`,
      `내보내기: ${date}`,
      '',
      ...messages.map((m) => {
        const content = getMessageText(m as unknown as { parts: Array<{ type: string; text?: string }> })
        const label = m.role === 'user' ? '나' : agent.name
        return `${label}: ${content}`
      }),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${agent.name}-chat.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCopy = (messageId: string, content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(messageId)
      setTimeout(() => setCopiedId(null), 1500)
    })
  }

  const handleQuickAction = (text: string) => {
    setInput(text)
    textareaRef.current?.focus()
  }

  const progress = levelInfo.progress
  const untilNext = currentLevel < 5 ? Math.max(0, levelInfo.next - currentCount) : 0
  const modelLabel = agent.model.split('/').pop() ?? agent.model

  const lastAssistantIndex = messages.reduce((acc, m, i) => m.role === 'assistant' ? i : acc, -1)

  return (
    <div className="flex flex-col h-screen" style={{ background: '#0a0a0a' }}>
      {/* ── Screen flash overlay ── */}
      {showFlash && (
        <div className="fixed inset-0 z-50 pointer-events-none bg-white opacity-30" />
      )}

      {/* ── Confetti ── */}
      {showConfetti && <Confetti />}

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
          {messages.length > 0 && (
            <button
              onClick={handleExport}
              className="text-gray-700 hover:text-gray-400 transition-colors text-sm"
              title="대화 내보내기"
            >
              📥
            </button>
          )}
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
              <span className="text-gray-600 text-[9px]">{levelInfo.title}</span>
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
        <main
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-4 relative"
        >
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

          {messages.map((message, index) => {
            const isLastAssistant = index === lastAssistantIndex
            const isStreamingThisMsg = isLastAssistant && isStreaming && message.role === 'assistant'
            const messageText = getMessageText(message as unknown as { parts: Array<{ type: string; text?: string }> })

            return (
              <div
                key={message.id}
                className={`flex gap-3 group msg-${message.role === 'user' ? 'user' : 'agent'} ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0 mt-1">
                    <PixelCharacter type={agent.avatar} size={32} />
                  </div>
                )}

                <div className="relative max-w-[75%]">
                  <div
                    className={`rounded-xl px-4 py-3 text-sm leading-relaxed break-words ${
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
                    {/* File/image attachments in message */}
                    {message.parts.filter(p => p.type === 'file').map((part, i) => {
                      const fp = part as FileUIPart
                      const isImage = fp.mediaType.startsWith('image/')
                      return isImage ? (
                        <img
                          key={i}
                          src={fp.url}
                          alt={fp.filename ?? '첨부 이미지'}
                          className="max-w-xs max-h-64 rounded-lg mb-2 border border-[#2a2a2a] object-contain"
                        />
                      ) : (
                        <div key={i} className="flex items-center gap-2 bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 mb-2 text-xs text-gray-400">
                          <span className="text-lg">📎</span>
                          <span className="truncate max-w-[180px]">{fp.filename ?? '첨부파일'}</span>
                          <span className="text-gray-600 shrink-0">{fp.mediaType.split('/')[1]?.toUpperCase()}</span>
                        </div>
                      )
                    })}
                  {message.role === 'user' ? (
                      messageText ? <span>{messageText}</span> : null
                    ) : isStreamingThisMsg ? (
                      <span>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={markdownComponents}
                        >
                          {messageText}
                        </ReactMarkdown>
                        <span className="animate-pulse text-[#ffd700]">▋</span>
                      </span>
                    ) : (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={markdownComponents}
                      >
                        {messageText}
                      </ReactMarkdown>
                    )}
                  </div>

                  {/* Copy button on hover */}
                  <button
                    onClick={() => handleCopy(message.id, messageText)}
                    className={`absolute ${message.role === 'user' ? '-left-8 top-2' : '-right-8 top-2'} opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-600 hover:text-gray-300 p-1`}
                    title="복사"
                  >
                    {copiedId === message.id ? '✓' : '📋'}
                  </button>
                </div>

                {message.role === 'user' && (
                  <div
                    className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold border-2 border-[#2a2a2a] mt-1 bg-[#1a1a1a] text-gray-300"
                  >
                    나
                  </div>
                )}
              </div>
            )
          })}

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
              ⚠ {getErrorMessage(error)}
            </div>
          )}

          <div ref={messagesEndRef} />

          {/* Scroll to bottom button */}
          {!isAtBottom && (
            <button
              onClick={scrollToBottom}
              className="fixed bottom-24 right-6 w-9 h-9 rounded-full bg-[#1a1a1a] border border-[#333] text-gray-400 hover:text-white hover:border-[#555] transition-all flex items-center justify-center text-sm shadow-lg z-10"
              title="맨 아래로"
            >
              ↓
            </button>
          )}
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
              LV.{leveledUpTo}&nbsp;&nbsp;{getLevelInfo((leveledUpTo - 1) * 20).title}
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
        <div className="max-w-4xl mx-auto">
          {/* Quick action buttons */}
          {messages.length > 0 && !isStreaming && (
            <div className="flex gap-2 mb-3 flex-wrap">
              {quickActions.map(({ label, text }) => (
                <button
                  key={label}
                  onClick={() => handleQuickAction(text)}
                  className="px-3 py-1 rounded-full text-xs border border-[#2a2a2a] bg-[#1a1a1a] text-gray-400 hover:text-white hover:border-[#444] transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Hidden file inputs */}
          <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
          <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md,.csv,.json,.docx,.xlsx" multiple className="hidden" onChange={handleFileSelect} />

          {/* Attachment previews */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {attachments.map((att, idx) => {
                const isImage = att.mediaType.startsWith('image/')
                return (
                  <div key={idx} className="relative group flex items-center gap-2 bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-xs text-gray-300">
                    {isImage ? (
                      <img src={att.url} alt={att.filename} className="w-10 h-10 object-cover rounded" />
                    ) : (
                      <span className="text-base">📎</span>
                    )}
                    <span className="max-w-[120px] truncate">{att.filename ?? '파일'}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="ml-1 text-gray-600 hover:text-red-400 transition-colors font-bold"
                    >×</button>
                  </div>
                )
              })}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2 items-end">
            {/* Image attach */}
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={isStreaming}
              className="nb-btn px-3 py-3 rounded-xl text-base flex-shrink-0 bg-[#1a1a1a] text-gray-400 hover:text-white disabled:opacity-40"
              title="이미지 첨부"
            >🖼️</button>
            {/* File attach */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming}
              className="nb-btn px-3 py-3 rounded-xl text-base flex-shrink-0 bg-[#1a1a1a] text-gray-400 hover:text-white disabled:opacity-40"
              title="파일 첨부 (PDF, TXT, CSV...)"
            >📎</button>
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
              disabled={isStreaming || (!input.trim() && attachments.length === 0)}
              className="nb-btn nb-btn-gold px-5 py-3 rounded-xl text-sm font-bold flex-shrink-0"
            >
              {isStreaming ? '···' : '전송'}
            </button>
          </form>
          <p className="text-center text-[10px] text-gray-700 mt-2">
            Enter: 전송 · Shift+Enter: 줄바꿈 · 이미지/파일 첨부 가능
          </p>
        </div>
      </footer>
    </div>
  )
}
