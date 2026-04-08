'use client'

import { OfficerType } from '@/types'

// 16x16 pixel grid: each row is 16 columns, '' = transparent
type PixelGrid = string[][]

// Helper: render pixel grid as SVG rects
function renderPixels(grid: PixelGrid, size: number) {
  const pixelSize = size / 16
  const rects: React.ReactNode[] = []
  grid.forEach((row, y) => {
    row.forEach((color, x) => {
      if (color) {
        rects.push(
          <rect key={`${x}-${y}`} x={x * pixelSize} y={y * pixelSize}
            width={pixelSize} height={pixelSize} fill={color} />
        )
      }
    })
  })
  return rects
}

// ── Character pixel definitions ──────────────────────────────────────────────

const DEVELOPER: PixelGrid = [
  ['','','','','','#2d3436','#2d3436','#2d3436','#2d3436','#2d3436','#2d3436','','','','',''],
  ['','','','','#2d3436','#2d3436','#2d3436','#2d3436','#2d3436','#2d3436','#2d3436','#2d3436','','','',''],
  ['','','','#2d3436','#2d3436','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#2d3436','#2d3436','#2d3436','','',''],
  ['','','','#2d3436','#ffecd2','#f6e05e','#1a1a2e','#ffecd2','#ffecd2','#1a1a2e','#f6e05e','#ffecd2','#2d3436','','',''],
  ['','','','#2d3436','#ffecd2','#f6e05e','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#f6e05e','#ffecd2','#2d3436','','',''],
  ['','','','','#2d3436','#ffecd2','#ffecd2','#c9b1a0','#ffecd2','#ffecd2','#ffecd2','#2d3436','','','',''],
  ['','','','','','#2d3748','#2d3748','#2d3748','#2d3748','#2d3748','#2d3748','','','','',''],
  ['','','#2d3748','#2d3748','#2d3748','#2d3748','#2d3748','#2d3748','#2d3748','#2d3748','#2d3748','#2d3748','#2d3748','','',''],
  ['','','#2d3748','#1a202c','#68d391','#68d391','#68d391','#68d391','#68d391','#68d391','#1a202c','#2d3748','#2d3748','','',''],
  ['','','#2d3748','#1a202c','#9ae6b4','#48bb78','#38a169','#38a169','#48bb78','#9ae6b4','#1a202c','#2d3748','#2d3748','','',''],
  ['','','#2d3748','#2d3748','#1a202c','#1a202c','#1a202c','#1a202c','#1a202c','#1a202c','#2d3748','#2d3748','#2d3748','','',''],
  ['','','','#2d3748','#718096','#718096','#718096','#718096','#718096','#718096','#718096','#2d3748','','','',''],
  ['','','','#2d3748','#2d3748','#2d3748','#2d3748','#2d3748','#2d3748','#2d3748','#2d3748','#2d3748','','','',''],
  ['','','','','#4a5568','#4a5568','','','','','#4a5568','#4a5568','','','',''],
  ['','','','','#4a5568','#4a5568','','','','','#4a5568','#4a5568','','','',''],
  ['','','','','#2d3748','#2d3748','','','','','#2d3748','#2d3748','','','',''],
]

const MARKETER: PixelGrid = [
  ['','','','','','#c9a96e','#c9a96e','#c9a96e','#c9a96e','#c9a96e','','','','','',''],
  ['','','','','#c9a96e','#c9a96e','#c9a96e','#c9a96e','#c9a96e','#c9a96e','#c9a96e','','','','',''],
  ['','','','#c9a96e','#c9a96e','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#c9a96e','#c9a96e','','','',''],
  ['','','','','#ffecd2','#ffecd2','#1a1a2e','#ffecd2','#ffecd2','#1a1a2e','#ffecd2','#ffecd2','','','',''],
  ['','','','','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#ffecd2','','','',''],
  ['','','','','','#ffecd2','#ffecd2','#c9b1a0','#ffecd2','#ffecd2','#ffecd2','','','','',''],
  ['','','','','','#e53e3e','#e53e3e','#e53e3e','#e53e3e','#e53e3e','','','','','',''],
  ['','','#e53e3e','#e53e3e','#ffffff','#e53e3e','#e53e3e','#e53e3e','#e53e3e','#ffffff','#e53e3e','#e53e3e','#f6ad55','','',''],
  ['','','#e53e3e','#e53e3e','#ffffff','#e53e3e','#e53e3e','#e53e3e','#e53e3e','#ffffff','#f6ad55','#f6ad55','#f6ad55','','',''],
  ['','','#e53e3e','#e53e3e','#e53e3e','#e53e3e','#e53e3e','#e53e3e','#e53e3e','#e53e3e','#f6ad55','#f6ad55','','','',''],
  ['','','#e53e3e','#e53e3e','#e53e3e','#e53e3e','#e53e3e','#e53e3e','#e53e3e','#e53e3e','#e53e3e','#e53e3e','','','',''],
  ['','','','#e53e3e','#e53e3e','#e53e3e','#e53e3e','#e53e3e','#e53e3e','#e53e3e','#e53e3e','','','','',''],
  ['','','','#e53e3e','#e53e3e','#e53e3e','','','','','#e53e3e','#e53e3e','','','',''],
  ['','','','','#4a1942','#4a1942','','','','','#4a1942','#4a1942','','','',''],
  ['','','','','#4a1942','#4a1942','','','','','#4a1942','#4a1942','','','',''],
  ['','','','','#2d1b1b','#2d1b1b','','','','','#2d1b1b','#2d1b1b','','','',''],
]

const ANALYST: PixelGrid = [
  ['','','','','','#1a1a2e','#1a1a2e','#1a1a2e','#1a1a2e','#1a1a2e','','','','','',''],
  ['','','','','#1a1a2e','#1a1a2e','#1a1a2e','#1a1a2e','#1a1a2e','#1a1a2e','#1a1a2e','','','','',''],
  ['','','','#1a1a2e','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#1a1a2e','','','',''],
  ['','','','','#ffecd2','#ffecd2','#1a1a2e','#ffecd2','#ffecd2','#1a1a2e','#ffecd2','#ffecd2','','','',''],
  ['','','','','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#ffecd2','','','',''],
  ['','','','','','#ffecd2','#c9b1a0','#c9b1a0','#c9b1a0','#ffecd2','#ffecd2','','','','',''],
  ['','','','','','#2b6cb0','#2b6cb0','#2b6cb0','#2b6cb0','#2b6cb0','','','','','',''],
  ['','','#2b6cb0','#2b6cb0','#e2e8f0','#2b6cb0','#2b6cb0','#2b6cb0','#2b6cb0','#e2e8f0','#2b6cb0','#2b6cb0','#e8e8e8','','',''],
  ['','','#2b6cb0','#2b6cb0','#e2e8f0','#fc8181','#2b6cb0','#2b6cb0','#fc8181','#e2e8f0','#2b6cb0','#e8e8e8','#e8e8e8','','',''],
  ['','','#2b6cb0','#2b6cb0','#2b6cb0','#2b6cb0','#2b6cb0','#2b6cb0','#2b6cb0','#2b6cb0','#e8e8e8','#e8e8e8','','','',''],
  ['','','#2b6cb0','#2b6cb0','#2b6cb0','#2b6cb0','#2b6cb0','#2b6cb0','#2b6cb0','#2b6cb0','#2b6cb0','#2b6cb0','','','',''],
  ['','','','#2b6cb0','#2b6cb0','#2b6cb0','#2b6cb0','#2b6cb0','#2b6cb0','#2b6cb0','#2b6cb0','','','','',''],
  ['','','','#1a365d','#1a365d','#2b6cb0','','','','','#2b6cb0','#1a365d','','','',''],
  ['','','','','#1a365d','#1a365d','','','','','#1a365d','#1a365d','','','',''],
  ['','','','','#1a365d','#1a365d','','','','','#1a365d','#1a365d','','','',''],
  ['','','','','#2c3e50','#2c3e50','','','','','#2c3e50','#2c3e50','','','',''],
]

const PLANNER: PixelGrid = [
  ['','','','','','#553c9a','#553c9a','#553c9a','#553c9a','#553c9a','','','','','',''],
  ['','','','','#553c9a','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#553c9a','','','','',''],
  ['','','','#553c9a','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#553c9a','','','',''],
  ['','','','','#ffecd2','#ffecd2','#1a1a2e','#ffecd2','#ffecd2','#1a1a2e','#ffecd2','#ffecd2','','','',''],
  ['','','','','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#ffecd2','','','',''],
  ['','','','','','#ffecd2','#ffecd2','#c9b1a0','#c9b1a0','#ffecd2','#ffecd2','','','','',''],
  ['','','','','','#553c9a','#553c9a','#553c9a','#553c9a','#553c9a','','','','','',''],
  ['','','#553c9a','#553c9a','#553c9a','#553c9a','#553c9a','#553c9a','#553c9a','#553c9a','#553c9a','#fed7e2','#fed7e2','','',''],
  ['','','#553c9a','#553c9a','#553c9a','#553c9a','#f6e05e','#f6e05e','#553c9a','#553c9a','#fed7e2','#fed7e2','#fed7e2','','',''],
  ['','','#553c9a','#553c9a','#553c9a','#f6e05e','#f6e05e','#f6e05e','#f6e05e','#553c9a','#fed7e2','#fed7e2','','','',''],
  ['','','#553c9a','#553c9a','#553c9a','#553c9a','#553c9a','#553c9a','#553c9a','#553c9a','#553c9a','#553c9a','','','',''],
  ['','','','#553c9a','#553c9a','#553c9a','#553c9a','#553c9a','#553c9a','#553c9a','#553c9a','','','','',''],
  ['','','','#6b46c1','#6b46c1','#553c9a','','','','','#553c9a','#6b46c1','','','',''],
  ['','','','','#6b46c1','#6b46c1','','','','','#6b46c1','#6b46c1','','','',''],
  ['','','','','#6b46c1','#6b46c1','','','','','#6b46c1','#6b46c1','','','',''],
  ['','','','','#44337a','#44337a','','','','','#44337a','#44337a','','','',''],
]

const HR: PixelGrid = [
  ['','','','','','','#d4a574','#d4a574','#d4a574','#d4a574','#d4a574','','','','',''],
  ['','','','','','#d4a574','#d4a574','#d4a574','#d4a574','#d4a574','#d4a574','#d4a574','','','',''],
  ['','','','','#d4a574','#d4a574','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#d4a574','#d4a574','','','',''],
  ['','','','','','#ffecd2','#ffecd2','#1a1a2e','#ffecd2','#1a1a2e','#ffecd2','#ffecd2','','','',''],
  ['','','','','','#ffecd2','#ffecd2','#ffecd2','#c9b1a0','#ffecd2','#ffecd2','#ffecd2','','','',''],
  ['','','','','','','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#ffecd2','','','','',''],
  ['','','','','','#2d6a4f','#2d6a4f','#2d6a4f','#2d6a4f','#2d6a4f','#2d6a4f','','','','',''],
  ['','','#2d6a4f','#2d6a4f','#2d6a4f','#2d6a4f','#2d6a4f','#2d6a4f','#2d6a4f','#2d6a4f','#2d6a4f','#2d6a4f','','','',''],
  ['','','#2d6a4f','#2d6a4f','#2d6a4f','#ff6b9d','#ff6b9d','#2d6a4f','#2d6a4f','#2d6a4f','#2d6a4f','#2d6a4f','','','',''],
  ['','','#2d6a4f','#2d6a4f','#2d6a4f','#2d6a4f','#2d6a4f','#2d6a4f','#2d6a4f','#2d6a4f','#2d6a4f','#2d6a4f','','','',''],
  ['','','#2d6a4f','#2d6a4f','#2d6a4f','#2d6a4f','#2d6a4f','#2d6a4f','#2d6a4f','#2d6a4f','#2d6a4f','#2d6a4f','','','',''],
  ['','','','#2d6a4f','#2d6a4f','#2d6a4f','#2d6a4f','#2d6a4f','#2d6a4f','#2d6a4f','#2d6a4f','','','','',''],
  ['','','','#1b4332','#1b4332','#2d6a4f','','','','','#2d6a4f','#1b4332','','','',''],
  ['','','','','#1b4332','#1b4332','','','','','#1b4332','#1b4332','','','',''],
  ['','','','','#1b4332','#1b4332','','','','','#1b4332','#1b4332','','','',''],
  ['','','','','#0d2818','#0d2818','','','','','#0d2818','#0d2818','','','',''],
]

const SALES: PixelGrid = [
  ['','','','','','#1a202c','#1a202c','#1a202c','#1a202c','#1a202c','','','','','',''],
  ['','','','','#1a202c','#1a202c','#1a202c','#1a202c','#1a202c','#1a202c','#1a202c','','','','',''],
  ['','','','#1a202c','#1a202c','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#1a202c','#1a202c','','','',''],
  ['','','','','#ffecd2','#ffecd2','#1a1a2e','#ffecd2','#ffecd2','#1a1a2e','#ffecd2','#ffecd2','','','',''],
  ['','','','','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#ffecd2','#ffecd2','','','',''],
  ['','','','','','#ffecd2','#c9b1a0','#c9b1a0','#ffecd2','#ffecd2','#ffecd2','','','','',''],
  ['','','','','','#1a202c','#1a202c','#1a202c','#1a202c','#1a202c','','','','','',''],
  ['','','#1a202c','#1a202c','#e2e8f0','#1a202c','#1a202c','#1a202c','#1a202c','#e2e8f0','#1a202c','#1a202c','#ffecd2','','',''],
  ['','','#1a202c','#1a202c','#e2e8f0','#ffd700','#ffd700','#ffd700','#ffd700','#e2e8f0','#1a202c','#1a202c','#ffecd2','','',''],
  ['','','#1a202c','#1a202c','#1a202c','#1a202c','#1a202c','#1a202c','#1a202c','#1a202c','#1a202c','#1a202c','','','',''],
  ['','','#1a202c','#1a202c','#1a202c','#1a202c','#1a202c','#1a202c','#1a202c','#1a202c','#1a202c','#1a202c','','','',''],
  ['','','','#1a202c','#1a202c','#1a202c','#1a202c','#1a202c','#1a202c','#1a202c','#1a202c','','','','',''],
  ['','','','#2d3748','#2d3748','#1a202c','','','','','#1a202c','#2d3748','','','',''],
  ['','','','','#2d3748','#2d3748','','','','','#2d3748','#2d3748','','','',''],
  ['','','','','#2d3748','#2d3748','','','','','#2d3748','#2d3748','','','',''],
  ['','','','','#1a202c','#1a202c','','','','','#1a202c','#1a202c','','','',''],
]

const CHARACTERS: Record<OfficerType, PixelGrid> = {
  developer: DEVELOPER,
  marketer: MARKETER,
  analyst: ANALYST,
  planner: PLANNER,
  hr: HR,
  sales: SALES,
}

export const OFFICER_LABELS: Record<OfficerType, string> = {
  developer: '개발자',
  marketer: '마케터',
  analyst: '분석가',
  planner: '기획자',
  hr: 'HR담당자',
  sales: '영업',
}

interface PixelCharacterProps {
  type: OfficerType
  size?: number
  animated?: boolean
  isThinking?: boolean
  isTyping?: boolean
  isWalking?: boolean
}

export function PixelCharacter({ type, size = 64, animated = false, isThinking = false, isWalking = false, isTyping = false }: PixelCharacterProps) {
  const grid = CHARACTERS[type] ?? CHARACTERS.developer

  let animStyle: React.CSSProperties = {}
  if (isWalking) {
    animStyle = { animation: 'walk-sway 0.3s ease-in-out infinite' }
  } else if (isTyping) {
    animStyle = { animation: 'type-bob 0.4s ease-in-out infinite' }
  } else if (isThinking) {
    animStyle = { animation: 'breathe 0.8s ease-in-out infinite' }
  } else if (animated) {
    animStyle = { animation: 'breathe 2.5s ease-in-out infinite' }
  }

  return (
    <div className="relative inline-block" style={{ width: size, height: size + (isThinking ? 20 : 0) }}>
      {isThinking && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 flex gap-1 items-center"
          style={{ fontFamily: 'monospace', fontSize: 10, color: '#ffd700' }}>
          <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
          <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
          <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
        </div>
      )}
      <svg
        width={size} height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          imageRendering: 'pixelated',
          marginTop: isThinking ? 20 : 0,
          ...animStyle,
        }}
      >
        {renderPixels(grid, size)}
      </svg>
    </div>
  )
}
