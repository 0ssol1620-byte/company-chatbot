'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { getAgents } from '@/lib/agents'
import { Agent } from '@/types'

// Dynamic import — Phaser requires browser, no SSR
const OfficePhaser = dynamic(
  () => import('@/components/office-phaser').then((m) => m.OfficePhaser),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center w-full aspect-[640/480] bg-[#1a1a2e]">
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '10px', color: '#ffd700' }}>
          LOADING...
        </div>
      </div>
    )
  }
)

export default function OfficePage() {
  const router = useRouter()
  const [agents, setAgents] = useState<Agent[]>([])

  useEffect(() => {
    setAgents(getAgents())
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a] bg-[#0d0d0d]">
        <Link href="/" className="text-gray-500 hover:text-white text-xs transition-colors">
          ← 로스터
        </Link>
        <h1
          className="text-white"
          style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '10px' }}
        >
          OFFICE MAP
        </h1>
        <span className="text-gray-600 text-xs">{agents.length}명 근무 중</span>
      </div>

      {/* Game */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="relative w-full max-w-3xl">
          {/* Scanline overlay */}
          <div
            className="absolute inset-0 pointer-events-none z-10 rounded"
            style={{
              background: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.05) 2px,rgba(0,0,0,0.05) 4px)',
            }}
          />
          <div className="nb-card rounded-lg overflow-hidden">
            <OfficePhaser
              agents={agents}
              onAgentClick={(id) => router.push(`/agents/${id}`)}
            />
          </div>
        </div>
      </div>

      {agents.length === 0 && (
        <div className="text-center pb-6">
          <p className="text-gray-600 text-xs mb-3">에이전트를 고용하면 사무실에 배치됩니다</p>
          <Link href="/agents/new" className="inline-block nb-btn nb-btn-gold px-5 py-2.5 rounded text-sm font-bold">
            에이전트 고용하기 →
          </Link>
        </div>
      )}

      <p className="text-center text-gray-700 text-xs pb-4">
        캐릭터를 클릭하면 AI와 채팅을 시작합니다
      </p>
    </div>
  )
}
