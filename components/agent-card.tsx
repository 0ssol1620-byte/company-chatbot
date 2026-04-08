'use client'

import Link from 'next/link'
import { Agent } from '@/types'
import { getLevelInfo } from '@/lib/agents'
import { PixelCharacter, OFFICER_LABELS } from '@/components/pixel-character'

export function AgentCard({ agent }: { agent: Agent }) {
  const { level, title, progress } = getLevelInfo(agent.messageCount)
  const modelLabel = agent.model.split('/').pop() ?? agent.model

  return (
    <div className="nb-card bg-[#111] rounded-lg p-4 flex flex-col gap-3 group"
      style={{ borderColor: agent.color, boxShadow: `4px 4px 0 ${agent.color}40` }}>
      {/* Character */}
      <div className="flex items-start justify-between">
        <PixelCharacter type={agent.avatar} size={72} animated />
        <div className="flex flex-col items-end gap-1">
          <span className="level-badge px-2 py-1 rounded text-[9px]"
            style={{ background: agent.color + '22', color: agent.color, border: `1px solid ${agent.color}` }}>
            LV.{level}
          </span>
          <span className="text-[9px] text-gray-500" style={{ fontFamily: "'Press Start 2P', monospace" }}>
            {title}
          </span>
        </div>
      </div>

      {/* Info */}
      <div>
        <h3 className="font-bold text-white text-sm truncate"
          style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10 }}>
          {agent.name}
        </h3>
        <p className="text-gray-400 text-xs mt-1 truncate">{agent.role}</p>
        <p className="text-gray-600 text-xs mt-0.5">{OFFICER_LABELS[agent.avatar]}</p>
      </div>

      {/* EXP Bar */}
      <div className="space-y-1">
        <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden border border-[#2a2a2a]">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${progress}%`, backgroundColor: agent.color }}
          />
        </div>
        <span className="text-[9px] text-gray-700">{agent.messageCount}개 대화</span>
      </div>

      {/* Model badge */}
      <div className="text-[9px] px-2 py-1 rounded text-center"
        style={{ background: '#1a1a1a', border: '1px solid #333', color: '#888' }}>
        {modelLabel}
      </div>

      {/* Actions - separate links not nested */}
      <div className="flex gap-2 mt-auto">
        <Link href={`/agents/${agent.id}`}
          className="flex-1 text-center text-xs py-2 rounded font-bold nb-btn"
          style={{ background: agent.color, color: '#0a0a0a', borderColor: agent.color }}>
          대화하기
        </Link>
        <Link href={`/agents/${agent.id}/settings`}
          className="px-3 py-2 rounded nb-btn text-gray-400 hover:text-white text-xs"
          style={{ background: '#1a1a1a' }}
          onClick={(e) => e.stopPropagation()}>
          ⚙
        </Link>
      </div>
    </div>
  )
}
