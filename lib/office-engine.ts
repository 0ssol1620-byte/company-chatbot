export type TileType = 'floor' | 'wall' | 'desk' | 'chair' | 'plant' | 'door' | 'window'

export interface Tile {
  type: TileType
  walkable: boolean
  color: string
}

export interface CharacterState {
  agentId: string
  x: number
  y: number
  tx: number
  ty: number
  path: { x: number; y: number }[]
  state: 'sitting' | 'walking' | 'idle'
  animFrame: number
  animTimer: number
  facing: 'down' | 'up' | 'left' | 'right'
}

export const TILE_DEFS: Record<TileType, Tile> = {
  floor:  { type: 'floor',  walkable: true,  color: '#1a1a1a' },
  wall:   { type: 'wall',   walkable: false, color: '#2a2a2a' },
  desk:   { type: 'desk',   walkable: false, color: '#2d2010' },
  chair:  { type: 'chair',  walkable: false, color: '#1a1030' },
  plant:  { type: 'plant',  walkable: false, color: '#0a2a0a' },
  door:   { type: 'door',   walkable: true,  color: '#3a2010' },
  window: { type: 'window', walkable: false, color: '#0a1a2a' },
}

export const DESK_SEATS: {
  x: number
  y: number
  deskX: number
  deskY: number
  facing: 'right' | 'left'
}[] = [
  { x: 3,  y: 3, deskX: 2,  deskY: 2, facing: 'right' },
  { x: 3,  y: 6, deskX: 2,  deskY: 5, facing: 'right' },
  { x: 9,  y: 3, deskX: 10, deskY: 2, facing: 'left'  },
  { x: 9,  y: 6, deskX: 10, deskY: 5, facing: 'left'  },
  { x: 14, y: 3, deskX: 15, deskY: 2, facing: 'right' },
  { x: 14, y: 6, deskX: 15, deskY: 5, facing: 'right' },
  { x: 20, y: 3, deskX: 21, deskY: 2, facing: 'left'  },
  { x: 20, y: 6, deskX: 21, deskY: 5, facing: 'left'  },
]

export function bfs(
  map: string[][],
  from: { x: number; y: number },
  to: { x: number; y: number }
): { x: number; y: number }[] {
  const rows = map.length
  const cols = map[0]?.length ?? 0
  const isWalkable = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || y >= rows || x >= cols) return false
    const cell = map[y]?.[x] ?? 'W'
    return cell !== 'W' && cell !== 'D' && cell !== 'C' && cell !== 'P' && cell !== 'N'
  }

  if (!isWalkable(from.x, from.y) || !isWalkable(to.x, to.y)) return []
  if (from.x === to.x && from.y === to.y) return [from]

  const visited = new Set<string>()
  const queue: Array<{ x: number; y: number; path: { x: number; y: number }[] }> = [
    { x: from.x, y: from.y, path: [from] },
  ]
  visited.add(`${from.x},${from.y}`)

  const dirs = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ]

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const { dx, dy } of dirs) {
      const nx = current.x + dx
      const ny = current.y + dy
      const key = `${nx},${ny}`
      if (visited.has(key) || !isWalkable(nx, ny)) continue
      const newPath = [...current.path, { x: nx, y: ny }]
      if (nx === to.x && ny === to.y) return newPath
      visited.add(key)
      queue.push({ x: nx, y: ny, path: newPath })
    }
  }

  return []
}
