'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getAgents } from '@/lib/agents'
import { Agent } from '@/types'
import { PixelCharacter } from '@/components/pixel-character'
import { bfs } from '@/lib/office-engine'

const TILE = 48
const COLS = 22
const ROWS = 12

// Tile map: 0=floor, 1=wall, 2=desk, 3=window, 4=plant, 5=door, 6=carpet
const MAP: number[][] = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,3,3,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,3,3,1],
  [1,0,0,0,2,0,0,2,0,0,6,6,0,0,0,2,0,0,2,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,2,0,0,2,0,0,6,6,0,0,0,2,0,0,2,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,1],
  [1,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,1],
  [1,0,0,0,2,0,0,2,0,0,6,6,0,0,0,2,0,0,2,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,2,0,0,2,0,0,6,6,0,0,0,2,0,0,2,0,0,1],
  [1,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,1],
  [1,1,1,1,1,1,1,1,1,5,5,5,5,1,1,1,1,1,1,1,1,1],
]

// Convert numeric map to string for BFS
const BFS_MAP: string[][] = MAP.map(row =>
  row.map(t => {
    switch (t) {
      case 1: return 'W'
      case 2: return 'D'
      case 4: return 'P'
      default: return '.'
    }
  })
)

const TILE_COLORS: Record<number, string> = {
  0: '#1c1c2e', // floor
  1: '#12121a', // wall
  2: '#2a1f3d', // desk
  3: '#1a3a5c', // window
  4: '#0a200a', // plant
  5: '#3a2010', // door
  6: '#1a1a3e', // carpet
}

// Generate seat positions dynamically based on desk positions in the map
function generateSeats(): { col: number; row: number }[] {
  const seats: { col: number; row: number }[] = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (MAP[r]?.[c] === 2) {
        // Place the seat adjacent to the desk on a walkable tile
        const adjacents = [
          { col: c - 1, row: r },
          { col: c + 1, row: r },
          { col: c, row: r - 1 },
          { col: c, row: r + 1 },
        ]
        for (const adj of adjacents) {
          const tile = MAP[adj.row]?.[adj.col]
          if (tile === 0 || tile === 6) {
            seats.push(adj)
            break
          }
        }
      }
    }
  }
  return seats
}

const ALL_SEATS = generateSeats()

interface AgentPosition {
  agent: Agent
  x: number
  y: number
  targetX: number
  targetY: number
  path: { x: number; y: number }[]
  pathIndex: number
  seatIndex: number
}

export default function OfficePage() {
  const router = useRouter()
  const [agents, setAgents] = useState<Agent[]>([])
  const [positions, setPositions] = useState<AgentPosition[]>([])
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const animFrameRef = useRef<number>(0)
  const lastTickRef = useRef<number>(0)

  useEffect(() => {
    const loaded = getAgents()
    setAgents(loaded)

    // Assign agents to seats
    const initial: AgentPosition[] = loaded.slice(0, ALL_SEATS.length).map((agent, i) => {
      const seat = ALL_SEATS[i]
      return {
        agent,
        x: seat.col,
        y: seat.row,
        targetX: seat.col,
        targetY: seat.row,
        path: [],
        pathIndex: 0,
        seatIndex: i,
      }
    })
    setPositions(initial)
  }, [])

  // Animation loop for walking
  useEffect(() => {
    const tick = (ts: number) => {
      const delta = ts - lastTickRef.current
      if (delta > 200) { // Move every 200ms
        lastTickRef.current = ts
        setPositions(prev => {
          let changed = false
          const next = prev.map(p => {
            if (p.path.length > 0 && p.pathIndex < p.path.length) {
              changed = true
              const step = p.path[p.pathIndex]
              return {
                ...p,
                x: step.x,
                y: step.y,
                pathIndex: p.pathIndex + 1,
                path: p.pathIndex + 1 >= p.path.length ? [] : p.path,
              }
            }
            return p
          })
          return changed ? next : prev
        })
      }
      animFrameRef.current = requestAnimationFrame(tick)
    }
    animFrameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [])

  const handleAgentClick = useCallback((agentId: string) => {
    router.push(`/agents/${agentId}`)
  }, [router])

  const handleTileClick = useCallback((col: number, row: number) => {
    // Find if any agent is close, move first agent toward clicked tile using BFS
    if (positions.length === 0) return
    const tile = MAP[row]?.[col]
    if (tile === 1 || tile === 2 || tile === 4) return // not walkable

    // Find nearest agent
    let nearestIdx = 0
    let nearestDist = Infinity
    positions.forEach((p, i) => {
      const dist = Math.abs(p.x - col) + Math.abs(p.y - row)
      if (dist < nearestDist) {
        nearestDist = dist
        nearestIdx = i
      }
    })

    const agent = positions[nearestIdx]
    const path = bfs(BFS_MAP, { x: agent.x, y: agent.y }, { x: col, y: row })
    if (path.length > 1) {
      setPositions(prev => prev.map((p, i) =>
        i === nearestIdx ? { ...p, targetX: col, targetY: row, path: path.slice(1), pathIndex: 0 } : p
      ))
    }
  }, [positions])

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
        <span className="text-gray-600 text-xs">{agents.length} 에이전트</span>
      </div>

      {/* Office grid */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="relative" style={{ maxWidth: '100%', overflow: 'auto' }}>
          {/* Scanline overlay */}
          <div
            className="absolute inset-0 pointer-events-none z-20 rounded"
            style={{
              background:
                'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)',
            }}
          />

          {/* Tile grid */}
          <div
            className="relative"
            style={{
              width: COLS * TILE,
              height: ROWS * TILE,
              border: '2px solid #2a2a2a',
              borderRadius: '4px',
              imageRendering: 'pixelated',
            }}
          >
            {/* Render tiles */}
            {MAP.map((row, r) =>
              row.map((t, c) => (
                <div
                  key={`${r}-${c}`}
                  className="absolute"
                  style={{
                    left: c * TILE,
                    top: r * TILE,
                    width: TILE,
                    height: TILE,
                    backgroundColor: TILE_COLORS[t] ?? '#1c1c2e',
                    borderRight: '1px solid rgba(255,255,255,0.02)',
                    borderBottom: '1px solid rgba(255,255,255,0.02)',
                    cursor: (t === 0 || t === 5 || t === 6) ? 'pointer' : 'default',
                  }}
                  onClick={() => handleTileClick(c, r)}
                >
                  {/* Desk detail */}
                  {t === 2 && (
                    <div className="w-full h-full flex items-center justify-center">
                      <div style={{ width: TILE - 8, height: TILE - 8, background: '#3a2a4d', borderRadius: 2 }}>
                        <div style={{ width: 10, height: 8, background: '#1a0a20', margin: '6px auto 0', borderRadius: 1 }} />
                      </div>
                    </div>
                  )}
                  {/* Plant detail */}
                  {t === 4 && (
                    <div className="w-full h-full flex items-center justify-center">
                      <div style={{ width: 16, height: 16, background: '#0a3a0a', borderRadius: '50%' }} />
                    </div>
                  )}
                  {/* Window detail */}
                  {t === 3 && (
                    <div className="w-full h-full flex items-center justify-center" style={{ padding: 3 }}>
                      <div style={{ width: '100%', height: '100%', background: 'rgba(100,150,255,0.12)', border: '1px solid rgba(100,150,255,0.3)', borderRadius: 2 }} />
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Render agent characters */}
            {positions.map((pos) => {
              const isWalking = pos.path.length > 0 && pos.pathIndex < pos.path.length
              const isHovered = hoveredId === pos.agent.id
              return (
                <div
                  key={pos.agent.id}
                  className="absolute z-10 cursor-pointer"
                  style={{
                    left: pos.x * TILE + (TILE - 40) / 2,
                    top: pos.y * TILE + (TILE - 40) / 2 - 8,
                    transition: isWalking ? 'left 0.18s linear, top 0.18s linear' : 'none',
                  }}
                  onClick={(e) => { e.stopPropagation(); handleAgentClick(pos.agent.id) }}
                  onMouseEnter={() => setHoveredId(pos.agent.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* Name tag */}
                  <div
                    className="text-center mb-0.5 whitespace-nowrap"
                    style={{
                      fontFamily: "'Press Start 2P', monospace",
                      fontSize: '6px',
                      color: isHovered ? '#fff' : '#aaa',
                      textShadow: '0 0 4px rgba(0,0,0,0.8)',
                    }}
                  >
                    {pos.agent.name.slice(0, 6)}
                  </div>
                  <div style={{ filter: isHovered ? `drop-shadow(0 0 6px ${pos.agent.color})` : 'none' }}>
                    <PixelCharacter
                      type={pos.agent.avatar}
                      size={40}
                      animated={!isWalking}
                      isWalking={isWalking}
                    />
                  </div>
                  {/* Role tooltip on hover */}
                  {isHovered && (
                    <div
                      className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-1 rounded"
                      style={{
                        top: -22,
                        background: 'rgba(0,0,0,0.9)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        fontSize: '9px',
                        color: '#fff',
                      }}
                    >
                      {pos.agent.role.slice(0, 18)}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Empty state inside canvas */}
            {agents.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                <p className="text-gray-600 text-xs mb-3" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9 }}>
                  사무실이 비어있습니다
                </p>
                <p className="text-gray-700 text-xs">에이전트를 고용하면 사무실에 배치됩니다</p>
                <Link
                  href="/agents/new"
                  className="inline-block mt-4 nb-btn nb-btn-gold px-4 py-2 rounded text-sm font-bold"
                >
                  에이전트 고용하기 →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="text-center pb-4">
        <p className="text-gray-700 text-xs">캐릭터를 클릭하면 채팅을 시작합니다 · 바닥을 클릭하면 가장 가까운 에이전트가 이동합니다</p>
      </div>
    </div>
  )
}
