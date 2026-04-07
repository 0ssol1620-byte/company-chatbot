'use client'

import { use, useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Room, RoomMessage, Agent, AvatarType } from '@/types'
import {
  getRoom,
  getRoomMessages,
  addRoomMessage,
  getOrCreateUser,
  saveUser,
  updateRoomAgents,
} from '@/lib/rooms'
import { getAgents } from '@/lib/agents'
import { DotBackground } from '@/components/dot-background'
import { PixelCharacter } from '@/components/pixel-character'

interface PageProps {
  params: Promise<{ roomId: string }>
}

export default function RoomChatPage({ params }: PageProps) {
  const { roomId } = use(params)

  const [room, setRoom] = useState<Room | null>(null)
  const [messages, setMessages] = useState<RoomMessage[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loaded, setLoaded] = useState(false)

  const [user, setUser] = useState<{ name: string; emoji: string }>({ name: '', emoji: '👤' })
  const [nameInput, setNameInput] = useState('')
  const [showNameModal, setShowNameModal] = useState(false)

  const [input, setInput] = useState('')
  const [showAgentPanel, setShowAgentPanel] = useState(false)

  // Streaming state for agent invocation
  const [streamingAgentId, setStreamingAgentId] = useState<string | null>(null)
  const [streamingContent, setStreamingContent] = useState('')
  const [isInvoking, setIsInvoking] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<BroadcastChannel | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const r = getRoom(roomId)
    const msgs = getRoomMessages(roomId)
    const allAgents = getAgents()
    const savedUser = getOrCreateUser()

    setRoom(r)
    setMessages(msgs)
    setAgents(allAgents)
    setUser(savedUser)

    if (!savedUser.name) {
      setShowNameModal(true)
    }

    setLoaded(true)

    // Real-time BroadcastChannel sync (same browser, cross-tab)
    const channel = new BroadcastChannel(`room-${roomId}`)
    channelRef.current = channel

    channel.onmessage = (event: MessageEvent<RoomMessage>) => {
      const msg = event.data
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })
    }

    return () => channel.close()
  }, [roomId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // ── Send user message ────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    (content: string) => {
      const msg: RoomMessage = {
        id: crypto.randomUUID(),
        roomId,
        type: 'user',
        content,
        userName: user.name || '익명',
        userEmoji: user.emoji,
        timestamp: new Date().toISOString(),
      }
      addRoomMessage(roomId, msg)
      setMessages((prev) => [...prev, msg])
      channelRef.current?.postMessage(msg)
    },
    [roomId, user]
  )

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    const text = input.trim()
    if (!text || isInvoking) return
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    sendMessage(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // ── Set nickname ─────────────────────────────────────────────────────────────
  const handleSetName = () => {
    if (!nameInput.trim()) return
    const newUser = { ...user, name: nameInput.trim() }
    setUser(newUser)
    saveUser(newUser)
    setShowNameModal(false)

    const sysMsg: RoomMessage = {
      id: crypto.randomUUID(),
      roomId,
      type: 'system',
      content: `${newUser.emoji} ${newUser.name}님이 입장했습니다`,
      timestamp: new Date().toISOString(),
    }
    addRoomMessage(roomId, sysMsg)
    setMessages((prev) => [...prev, sysMsg])
    channelRef.current?.postMessage(sysMsg)
  }

  // ── Invoke agent in room ─────────────────────────────────────────────────────
  const invokeAgent = async (agent: Agent) => {
    setIsInvoking(true)
    setStreamingAgentId(agent.id)
    setStreamingContent('')
    setShowAgentPanel(false)

    // Build context: last 20 messages as plain user/assistant turns
    const ctx = messages.slice(-20).map((m) => ({
      role: (m.type === 'agent' ? 'assistant' : 'user') as 'user' | 'assistant',
      content:
        m.type === 'user'
          ? `${m.userEmoji} ${m.userName}: ${m.content}`
          : m.type === 'agent'
          ? `[${m.agentName}]: ${m.content}`
          : m.content,
    }))

    try {
      const res = await fetch('/api/room-invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: ctx,
          agentConfig: {
            provider: agent.provider,
            model: agent.model,
            apiKey: agent.apiKey,
            systemPrompt: agent.systemPrompt,
          },
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        setStreamingContent(full)
      }

      const finalMsg: RoomMessage = {
        id: crypto.randomUUID(),
        roomId,
        type: 'agent',
        content: full,
        agentId: agent.id,
        agentName: agent.name,
        agentAvatar: agent.avatar,
        agentColor: agent.color,
        agentRole: agent.role,
        timestamp: new Date().toISOString(),
      }

      addRoomMessage(roomId, finalMsg)
      setMessages((prev) => [...prev, finalMsg])
      channelRef.current?.postMessage(finalMsg)
    } catch {
      const errMsg: RoomMessage = {
        id: crypto.randomUUID(),
        roomId,
        type: 'system',
        content: `⚠ ${agent.name} 호출 실패 — API 키를 확인해 주세요`,
        timestamp: new Date().toISOString(),
      }
      addRoomMessage(roomId, errMsg)
      setMessages((prev) => [...prev, errMsg])
    } finally {
      setIsInvoking(false)
      setStreamingAgentId(null)
      setStreamingContent('')
    }
  }

  // ── Toggle agent invitation ──────────────────────────────────────────────────
  const toggleAgent = (agentId: string) => {
    if (!room) return
    const next = room.invitedAgentIds.includes(agentId)
      ? room.invitedAgentIds.filter((id) => id !== agentId)
      : [...room.invitedAgentIds, agentId]
    updateRoomAgents(roomId, next)
    setRoom((prev) => (prev ? { ...prev, invitedAgentIds: next } : prev))
  }

  const invitedAgents = agents.filter((a) => room?.invitedAgentIds.includes(a.id))

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

  if (!room) {
    return (
      <DotBackground>
        <div className="flex flex-col items-center justify-center h-screen gap-4">
          <p className="text-white text-sm">채팅방을 찾을 수 없습니다</p>
          <Link href="/rooms" className="nb-btn nb-btn-gold px-4 py-2 rounded text-sm font-bold">
            ← 채팅방 목록
          </Link>
        </div>
      </DotBackground>
    )
  }

  return (
    <div className="flex flex-col h-screen" style={{ background: '#0a0a0a' }}>
      {/* ── Nickname modal ── */}
      {showNameModal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm">
          <div
            className="nb-card bg-[#141414] rounded-2xl p-8 max-w-sm w-full text-center"
            style={{ borderColor: '#ffd700', boxShadow: '6px 6px 0 #ffd700' }}
          >
            <p
              className="text-white mb-1"
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '11px' }}
            >
              닉네임 설정
            </p>
            <p className="text-gray-500 text-xs mb-6">채팅방에서 사용할 이름을 입력하세요</p>
            <div className="text-4xl mb-4">{user.emoji}</div>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="닉네임 (최대 20자)"
              className="w-full px-3 py-2.5 rounded-lg text-sm mb-4"
              maxLength={20}
              onKeyDown={(e) => e.key === 'Enter' && handleSetName()}
              autoFocus
            />
            <button
              onClick={handleSetName}
              disabled={!nameInput.trim()}
              className="nb-btn nb-btn-gold w-full py-3 rounded-lg text-sm font-bold"
            >
              입장하기 →
            </button>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header
        className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a] flex-shrink-0 gap-3"
        style={{ background: '#0d0d0d' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/rooms"
            className="text-gray-500 hover:text-white text-xs transition-colors flex-shrink-0"
          >
            ← 채팅방
          </Link>
          <span className="text-[#1a1a1a]">|</span>
          <div className="min-w-0">
            <span
              className="text-white"
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '9px' }}
            >
              {room.name}
            </span>
            {room.description && (
              <span className="text-gray-600 text-[10px] ml-2 hidden sm:inline">
                {room.description}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {user.name && (
            <span className="text-[10px] text-gray-500 hidden sm:inline">
              {user.emoji} {user.name}
            </span>
          )}
          <button
            onClick={() => setShowAgentPanel(!showAgentPanel)}
            className={`nb-btn px-3 py-1.5 rounded text-xs font-bold transition-all ${
              showAgentPanel
                ? 'bg-[#ffd700] text-black border-[#ffd700]'
                : 'bg-[#1a1a1a] text-white'
            }`}
          >
            🤖 에이전트
            {invitedAgents.length > 0 && (
              <span className="ml-1 text-[9px]">({invitedAgents.length})</span>
            )}
          </button>
        </div>
      </header>

      {/* ── Content ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Messages */}
        <main className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-5 text-center">
              <div className="text-5xl">💬</div>
              <div>
                <p
                  className="text-gray-400 mb-2"
                  style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '10px' }}
                >
                  {room.name}
                </p>
                <p className="text-gray-600 text-sm">대화를 시작해보세요!</p>
                <p className="text-gray-700 text-xs mt-2">
                  에이전트를 초대해 함께 의견을 나눌 수 있어요 🤖
                </p>
              </div>
              <button
                onClick={() => setShowAgentPanel(true)}
                className="nb-btn nb-btn-gold px-5 py-2.5 rounded-lg text-xs font-bold"
              >
                🤖 에이전트 초대하기
              </button>
            </div>
          )}

          {messages.map((msg) => (
            <MsgBubble key={msg.id} msg={msg} me={user} />
          ))}

          {/* Streaming agent response */}
          {streamingAgentId && (
            <AgentStreamBubble
              agent={agents.find((a) => a.id === streamingAgentId)!}
              content={streamingContent}
            />
          )}

          <div ref={messagesEndRef} />
        </main>

        {/* Agent panel */}
        {showAgentPanel && (
          <aside
            className="w-64 flex-shrink-0 border-l border-[#1a1a1a] overflow-y-auto flex flex-col"
            style={{ background: '#0d0d0d' }}
          >
            <div className="p-4 flex-1">
              <p
                className="text-white mb-4"
                style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '8px' }}
              >
                에이전트 관리
              </p>

              {agents.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 text-xs mb-3">에이전트가 없습니다</p>
                  <Link
                    href="/agents/new"
                    className="text-[#ffd700] text-xs hover:underline"
                  >
                    에이전트 고용하기 →
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {agents.map((agent) => {
                    const invited = room.invitedAgentIds.includes(agent.id)
                    return (
                      <div
                        key={agent.id}
                        className={`rounded-xl p-3 border-2 transition-all ${
                          invited
                            ? 'border-[#ffd700]/60 bg-[#1a1a1a]'
                            : 'border-[#1e1e1e] bg-[#111]'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <PixelCharacter type={agent.avatar} size={30} />
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-white truncate"
                              style={{
                                fontFamily: "'Press Start 2P', monospace",
                                fontSize: '7px',
                                lineHeight: 1.8,
                              }}
                            >
                              {agent.name}
                            </p>
                            <p className="text-gray-600 text-[9px] truncate">{agent.role}</p>
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => toggleAgent(agent.id)}
                            className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold border transition-all ${
                              invited
                                ? 'border-[#ffd700]/60 text-[#ffd700] hover:bg-[#ffd700]/10'
                                : 'border-[#2a2a2a] text-gray-500 hover:border-[#444] hover:text-gray-300'
                            }`}
                          >
                            {invited ? '✓ 초대됨' : '초대'}
                          </button>
                          {invited && (
                            <button
                              onClick={() => invokeAgent(agent)}
                              disabled={isInvoking}
                              className="nb-btn nb-btn-gold py-1.5 px-3 rounded-lg text-[9px] font-bold disabled:opacity-50"
                            >
                              호출
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {invitedAgents.length > 0 && (
              <div className="p-4 border-t border-[#1a1a1a]">
                <p className="text-gray-600 text-[9px] mb-2">대화 참여 에이전트</p>
                <div className="space-y-1.5">
                  {invitedAgents.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => invokeAgent(a)}
                      disabled={isInvoking}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border border-[#222] hover:border-[#444] transition-all text-left disabled:opacity-50"
                    >
                      <PixelCharacter type={a.avatar} size={20} />
                      <span className="text-[10px] text-gray-300 flex-1 truncate">{a.name}</span>
                      <span className="text-[9px] text-gray-600">↵ 호출</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* ── Quick-call bar when panel closed ── */}
      {invitedAgents.length > 0 && !showAgentPanel && (
        <div
          className="border-t border-[#1a1a1a] px-4 py-2 flex items-center gap-3 flex-shrink-0 overflow-x-auto"
          style={{ background: '#0d0d0d' }}
        >
          <span className="text-gray-600 text-[10px] flex-shrink-0">에이전트 호출:</span>
          {invitedAgents.map((a) => (
            <button
              key={a.id}
              onClick={() => invokeAgent(a)}
              disabled={isInvoking}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#2a2a2a] hover:border-[#ffd700]/40 text-[10px] text-gray-400 hover:text-white transition-all flex-shrink-0 disabled:opacity-50"
            >
              <PixelCharacter type={a.avatar} size={16} />
              <span>{a.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Input ── */}
      <footer
        className="border-t border-[#1a1a1a] p-4 flex-shrink-0"
        style={{ background: '#0d0d0d' }}
      >
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <div className="flex-shrink-0 text-xl pb-2.5" title={user.name || '나'}>
            {user.emoji}
          </div>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`
            }}
            placeholder={isInvoking ? '에이전트 응답 중...' : '메시지 입력... (Enter: 전송)'}
            rows={1}
            disabled={isInvoking}
            className="flex-1 resize-none rounded-xl px-4 py-3 text-sm max-h-32 overflow-y-auto"
            style={{
              background: '#1a1a1a',
              border: '2px solid #2a2a2a',
              color: '#ededed',
            }}
          />
          <button
            type="submit"
            disabled={isInvoking || !input.trim()}
            className="nb-btn nb-btn-gold px-5 py-3 rounded-xl text-sm font-bold flex-shrink-0"
          >
            {isInvoking ? '···' : '전송'}
          </button>
        </form>
      </footer>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MsgBubble({
  msg,
  me,
}: {
  msg: RoomMessage
  me: { name: string; emoji: string }
}) {
  const ts = new Date(msg.timestamp).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (msg.type === 'system') {
    return (
      <div className="text-center py-1">
        <span className="text-[10px] text-gray-600 bg-[#111] px-3 py-1 rounded-full border border-[#1a1a1a]">
          {msg.content}
        </span>
      </div>
    )
  }

  if (msg.type === 'agent') {
    return (
      <div className="flex gap-3 justify-start msg-agent">
        <div className="flex-shrink-0 mt-1">
          {msg.agentAvatar ? (
            <PixelCharacter type={msg.agentAvatar as AvatarType} size={34} />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-[#1a1a1a] border border-[#333] flex items-center justify-center">
              🤖
            </div>
          )}
        </div>
        <div className="max-w-[78%]">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[9px] font-bold"
              style={{
                color: msg.agentColor || '#ffd700',
                fontFamily: "'Press Start 2P', monospace",
              }}
            >
              {msg.agentName}
            </span>
            {msg.agentRole && (
              <span className="text-[9px] text-gray-600">{msg.agentRole}</span>
            )}
          </div>
          <div
            className="rounded-xl rounded-tl-none px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words bg-[#141414] border-2 text-gray-100"
            style={{ borderColor: `${msg.agentColor || '#ffd700'}33` }}
          >
            {msg.content}
          </div>
          <div className="text-[9px] text-gray-700 mt-1 ml-1">{ts}</div>
        </div>
      </div>
    )
  }

  // User message
  const isMe = msg.userName === me.name && me.name !== ''
  return (
    <div className={`flex gap-2.5 ${isMe ? 'justify-end' : 'justify-start'} msg-user`}>
      {!isMe && (
        <div className="flex-shrink-0 text-xl mt-1" title={msg.userName}>
          {msg.userEmoji}
        </div>
      )}
      <div className={`max-w-[78%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
        {!isMe && (
          <span className="text-[10px] text-gray-500 mb-1 ml-1">{msg.userName}</span>
        )}
        <div
          className={`rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words border-2 ${
            isMe
              ? 'bg-[#1a1a1a] border-[#2a2a2a] text-white rounded-br-none'
              : 'bg-[#141414] border-[#1e1e1e] text-gray-100 rounded-tl-none'
          }`}
        >
          {msg.content}
        </div>
        <div className={`text-[9px] text-gray-700 mt-1 ${isMe ? 'mr-1' : 'ml-1'}`}>{ts}</div>
      </div>
      {isMe && (
        <div className="flex-shrink-0 text-xl mt-1">{msg.userEmoji || '👤'}</div>
      )}
    </div>
  )
}

function AgentStreamBubble({ agent, content }: { agent: Agent; content: string }) {
  if (!agent) return null
  return (
    <div className="flex gap-3 justify-start msg-agent">
      <div className="flex-shrink-0 mt-1">
        <PixelCharacter type={agent.avatar} size={34} isThinking={!content} />
      </div>
      <div className="max-w-[78%]">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-[9px] font-bold"
            style={{ color: agent.color, fontFamily: "'Press Start 2P', monospace" }}
          >
            {agent.name}
          </span>
          <span className="text-[9px] text-gray-600 animate-pulse">응답 중...</span>
        </div>
        <div
          className="rounded-xl rounded-tl-none px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words bg-[#141414] border-2 text-gray-100 min-h-[44px]"
          style={{ borderColor: `${agent.color}33` }}
        >
          {content || (
            <span className="flex gap-1.5 items-center h-5">
              <span className="w-2 h-2 bg-gray-600 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 bg-gray-600 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 bg-gray-600 rounded-full animate-bounce [animation-delay:300ms]" />
            </span>
          )}
          {content && (
            <span className="inline-block w-1 h-4 bg-gray-400 ml-0.5 align-middle animate-pulse" />
          )}
        </div>
      </div>
    </div>
  )
}
