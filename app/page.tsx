'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Agent } from '@/types'
import { getAgents } from '@/lib/agents'
import { AgentCard } from '@/components/agent-card'
import { DotBackground } from '@/components/dot-background'
import { PixelCharacter } from '@/components/pixel-character'

export default function RosterPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loaded, setLoaded] = useState(false)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'level' | 'recent'>('level')

  useEffect(() => {
    setAgents(getAgents())
    setLoaded(true)
  }, [])

  const filtered = agents
    .filter(
      (a) =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.role.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'recent') return b.messageCount - a.messageCount
      return b.level - a.level
    })

  if (!loaded) {
    return (
      <DotBackground>
        <div className="flex items-center justify-center min-h-screen">
          <div
            className="text-gray-500 text-xs"
            style={{ fontFamily: "'Press Start 2P', monospace" }}
          >
            LOADING...
          </div>
        </div>
      </DotBackground>
    )
  }

  return (
    <DotBackground>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1
              className="text-white text-lg sm:text-xl"
              style={{ fontFamily: "'Press Start 2P', monospace" }}
            >
              AGENT ROSTER
            </h1>
            <p className="text-gray-600 text-xs mt-2">
              AI 에이전트를 고용하고 채팅방에서 팀원과 함께 활용하세요
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/rooms"
              className="nb-btn px-4 py-2.5 rounded text-xs font-bold bg-[#1a1a1a] text-white border-[#333] flex items-center gap-1.5"
            >
              <span>💬</span>
              <span className="hidden sm:inline">채팅방</span>
            </Link>
            <Link
              href="/office"
              className="nb-btn px-4 py-2.5 rounded text-xs font-bold bg-[#1a1a1a] text-white border-[#333] flex items-center gap-1.5"
            >
              <span>🏢</span>
              <span className="hidden sm:inline">오피스</span>
            </Link>
            <Link
              href="/agents/new"
              className="nb-btn nb-btn-gold px-4 py-2.5 rounded text-sm font-bold"
            >
              + 에이전트 고용
            </Link>
          </div>
        </div>

        {/* ── Search + Sort ── */}
        {agents.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <input
              type="text"
              placeholder="에이전트 이름 또는 역할 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-[#141414] border border-[#333] focus:border-[#ffd700] outline-none rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 transition-colors"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'level' | 'recent')}
              className="bg-[#141414] border border-[#333] rounded-lg px-4 py-2.5 text-sm text-gray-300 outline-none cursor-pointer"
            >
              <option value="level">레벨순</option>
              <option value="name">이름순</option>
              <option value="recent">대화 많은순</option>
            </select>
          </div>
        )}

        {/* ── Agent grid or empty state ── */}
        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-6">
            <div className="nb-card bg-[#141414] rounded-xl p-12 flex flex-col items-center gap-5 text-center">
              <PixelCharacter type="developer" size={96} animated />
              <div>
                <p
                  className="text-gray-400 mb-2"
                  style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '10px' }}
                >
                  에이전트가 없습니다
                </p>
                <p className="text-gray-600 text-xs">첫 번째 AI 에이전트를 고용하세요</p>
              </div>
              <Link
                href="/agents/new"
                className="nb-btn nb-btn-gold px-6 py-3 rounded-lg text-sm font-bold mt-2"
              >
                에이전트 고용하기 →
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
            {/* Add slot */}
            <Link href="/agents/new" className="block">
              <div className="nb-card bg-[#0d0d0d] border-dashed rounded-xl p-5 flex flex-col items-center justify-center gap-3 h-full min-h-[220px] hover:bg-[#111] transition-colors group">
                <div
                  className="text-gray-700 group-hover:text-gray-400 transition-colors text-3xl"
                  style={{ fontFamily: "'Press Start 2P', monospace" }}
                >
                  +
                </div>
                <p className="text-gray-700 group-hover:text-gray-400 text-xs transition-colors text-center">
                  에이전트 고용하기
                </p>
              </div>
            </Link>
          </div>
        )}

        {/* ── Features hint ── */}
        {agents.length > 0 && (
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { icon: '🤖', title: '1:1 채팅', desc: '에이전트 카드 클릭 → 대화 시작', href: null },
              { icon: '💬', title: '그룹 채팅방', desc: '팀원 + 에이전트 함께 대화', href: '/rooms' },
              { icon: '🏢', title: '오피스 맵', desc: '에이전트들의 사무실 확인', href: '/office' },
              { icon: '⚙', title: '에이전트 설정', desc: '모델, 프롬프트, 파일 관리', href: null },
            ].map((f) => (
              f.href ? (
                <Link key={f.title} href={f.href}>
                  <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4 flex items-start gap-3 hover:border-[#ffd700]/30 transition-colors">
                    <span className="text-xl flex-shrink-0">{f.icon}</span>
                    <div>
                      <p className="text-gray-300 text-xs font-bold">{f.title}</p>
                      <p className="text-gray-600 text-[10px] mt-0.5">{f.desc}</p>
                    </div>
                  </div>
                </Link>
              ) : (
                <div key={f.title} className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4 flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">{f.icon}</span>
                  <div>
                    <p className="text-gray-300 text-xs font-bold">{f.title}</p>
                    <p className="text-gray-600 text-[10px] mt-0.5">{f.desc}</p>
                  </div>
                </div>
              )
            ))}
          </div>
        )}

        <p className="text-center text-xs text-gray-700 mt-10">
          AI 답변은 참고용입니다. 중요한 사안은 담당자에게 확인하세요.
        </p>
      </div>
    </DotBackground>
  )
}
