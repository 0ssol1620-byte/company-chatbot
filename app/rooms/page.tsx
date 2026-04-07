'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Room } from '@/types'
import { getRooms, saveRoom, deleteRoom } from '@/lib/rooms'
import { DotBackground } from '@/components/dot-background'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return '방금'
  if (mins < 60) return `${mins}분 전`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}시간 전`
  return `${Math.floor(hrs / 24)}일 전`
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loaded, setLoaded] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')

  useEffect(() => {
    setRooms(getRooms())
    setLoaded(true)
  }, [])

  const handleCreate = () => {
    if (!newName.trim()) return
    const room: Room = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      description: newDesc.trim(),
      invitedAgentIds: [],
      createdAt: new Date().toISOString(),
    }
    saveRoom(room)
    setRooms((prev) => [...prev, room])
    setNewName('')
    setNewDesc('')
    setShowCreate(false)
  }

  const handleDelete = (e: React.MouseEvent, roomId: string, roomName: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (confirm(`"${roomName}" 채팅방을 삭제할까요? 모든 대화가 삭제됩니다.`)) {
      deleteRoom(roomId)
      setRooms((prev) => prev.filter((r) => r.id !== roomId))
    }
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

  return (
    <DotBackground>
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-gray-500 hover:text-white text-xs transition-colors"
            >
              ← 로스터
            </Link>
            <h1
              className="text-white"
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '14px' }}
            >
              CHAT ROOMS
            </h1>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="nb-btn nb-btn-gold px-4 py-2 rounded text-xs font-bold"
          >
            + 방 만들기
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="nb-card bg-[#141414] rounded-xl p-6 mb-6">
            <h2
              className="text-white font-bold mb-4"
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '9px' }}
            >
              새 채팅방
            </h2>
            <div className="space-y-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="채팅방 이름 *"
                className="w-full px-3 py-2.5 rounded-lg text-sm"
                maxLength={40}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="설명 (선택)"
                className="w-full px-3 py-2.5 rounded-lg text-sm"
                maxLength={80}
              />
              <div className="flex gap-3">
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                  className="nb-btn nb-btn-gold flex-1 py-2.5 rounded-lg text-sm font-bold"
                >
                  만들기
                </button>
                <button
                  onClick={() => { setShowCreate(false); setNewName(''); setNewDesc('') }}
                  className="nb-btn px-6 py-2.5 rounded-lg text-sm bg-[#1a1a1a] text-white"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Room grid or empty state */}
        {rooms.length === 0 && !showCreate ? (
          <div className="flex flex-col items-center justify-center py-28 gap-6">
            <div className="nb-card bg-[#141414] rounded-xl p-12 flex flex-col items-center gap-5 text-center">
              <div className="text-5xl">💬</div>
              <p
                className="text-gray-400"
                style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '9px' }}
              >
                채팅방이 없습니다
              </p>
              <p className="text-gray-600 text-xs max-w-xs">
                팀원과 함께 대화하고 에이전트를 초대해 의견을 나눠보세요
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="nb-btn nb-btn-gold px-6 py-3 rounded-lg text-sm font-bold"
              >
                첫 채팅방 만들기
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {rooms.map((room) => (
              <Link key={room.id} href={`/rooms/${room.id}`} className="block group">
                <div className="nb-card bg-[#141414] rounded-xl p-5 flex flex-col gap-4 h-full hover:bg-[#181818] transition-colors relative">
                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDelete(e, room.id, room.name)}
                    className="absolute top-3 right-3 text-gray-700 hover:text-red-400 transition-colors text-xs opacity-0 group-hover:opacity-100"
                    title="채팅방 삭제"
                  >
                    ✕
                  </button>

                  <div className="flex items-start gap-3 pr-4">
                    <div className="w-12 h-12 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center text-2xl flex-shrink-0">
                      💬
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3
                        className="text-white font-bold truncate"
                        style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '9px', lineHeight: 1.6 }}
                      >
                        {room.name}
                      </h3>
                      {room.description && (
                        <p className="text-gray-500 text-xs mt-1 line-clamp-2">{room.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-gray-600">
                    <span>
                      {room.invitedAgentIds.length > 0
                        ? `🤖 에이전트 ${room.invitedAgentIds.length}명`
                        : '에이전트 없음'}
                    </span>
                    <span>{timeAgo(room.createdAt)}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[#00ff88] text-[10px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
                    입장하기
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <p className="text-center text-[10px] text-gray-700 mt-10">
          같은 브라우저의 탭 간에 실시간으로 동기화됩니다
        </p>
      </div>
    </DotBackground>
  )
}
