'use client'

import Link from 'next/link'
import { Agent } from '@/types'
import { PixelCharacter } from './pixel-character'
import { LEVEL_NAMES } from '@/lib/agents'

interface AgentCardProps {
  agent: Agent
}

export function AgentCard({ agent }: AgentCardProps) {
  const modelLabel = agent.model.split('/').pop() ?? agent.model

  return (
    <Link href={`/agents/${agent.id}`} className="block">
      <div className="nb-card bg-[#141414] rounded-lg p-5 flex flex-col items-center gap-3 h-full">
        <div className="relative">
          <PixelCharacter type={agent.avatar} size={80} animated />
          <div
            className="absolute -top-1 -right-1 level-badge px-1.5 py-0.5 rounded text-[8px]"
            style={{ backgroundColor: agent.color, color: '#0a0a0a' }}
          >
            LV.{agent.level}
          </div>
        </div>

        <div className="text-center w-full">
          <h3
            className="text-sm font-bold truncate"
            style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '10px', lineHeight: '1.6' }}
          >
            {agent.name}
          </h3>
          <p className="text-xs text-gray-400 mt-1 truncate">{agent.role}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-center">
          <span className="text-[10px] px-2 py-0.5 rounded bg-[#1a1a1a] border border-[#333] text-gray-300">
            {modelLabel}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-[#1a1a1a] border border-[#333] text-gray-400">
            {LEVEL_NAMES[agent.level]}
          </span>
        </div>

        <p className="text-[10px] text-gray-500">{agent.messageCount} messages</p>

        <div className="flex gap-2 mt-auto w-full">
          <button className="nb-btn nb-btn-gold flex-1 px-3 py-2 rounded text-xs font-bold">
            대화하기
          </button>
          <Link
            href={`/agents/${agent.id}/settings`}
            onClick={(e) => e.stopPropagation()}
            className="nb-btn px-3 py-2 rounded text-xs bg-[#1a1a1a] text-white"
          >
            &#9881;
          </Link>
        </div>
      </div>
    </Link>
  )
}
