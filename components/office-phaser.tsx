'use client'

import { useEffect, useRef } from 'react'
import type { Agent } from '@/types'

interface OfficePhaserProps {
  agents: Agent[]
  onAgentClick: (agentId: string) => void
}

export function OfficePhaser({ agents, onAgentClick }: OfficePhaserProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<unknown>(null)
  const onClickRef = useRef(onAgentClick)
  onClickRef.current = onAgentClick

  useEffect(() => {
    if (!containerRef.current) return

    const init = async () => {
      const Phaser = (await import('phaser')).default

      // Map layout: 20×15 tiles, 32×32 px
      // We'll create a simple but beautiful office scene

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      class OfficeScene extends Phaser.Scene {
        private agentSprites: Map<string, Phaser.GameObjects.Sprite> = new Map()
        private agentLabels: Map<string, Phaser.GameObjects.Text> = new Map()

        constructor() {
          super({ key: 'OfficeScene' })
        }

        preload() {
          // Load body spritesheet: 576×256, 64×64 per frame, 9 cols
          this.load.spritesheet('body-male', '/assets/sprites/body-male-amber.png', {
            frameWidth: 64, frameHeight: 64
          })
          this.load.spritesheet('body-female', '/assets/sprites/body-female-amber.png', {
            frameWidth: 64, frameHeight: 64
          })
          // Load tileset images
          this.load.image('tileset-main', '/assets/tilesets/small-office-tileset-ai.png')
          this.load.image('tileset-office', '/assets/tilesets/소규모-오피스-맵.png')
        }

        create() {
          const TILE = 32
          const COLS = 20
          const ROWS = 15

          // Draw the office map using graphics (procedural)
          this.drawOfficeMap(COLS, ROWS, TILE)

          // Desk seat positions for agents (col, row)
          const SEATS: { col: number; row: number }[] = [
            { col: 4, row: 3 },
            { col: 4, row: 6 },
            { col: 4, row: 10 },
            { col: 4, row: 12 },
            { col: 15, row: 3 },
            { col: 15, row: 6 },
            { col: 15, row: 10 },
            { col: 15, row: 12 },
          ]

          const currentAgents: Agent[] = agents

          currentAgents.slice(0, SEATS.length).forEach((agent, i) => {
            const seat = SEATS[i]
            const x = seat.col * TILE + TILE / 2
            const y = seat.row * TILE + TILE / 2

            // Choose spritesheet based on avatar type
            const isFemale = (['marketer', 'hr', 'planner'] as string[]).includes(agent.avatar)
            const key = isFemale ? 'body-female' : 'body-male'

            // Create sprite — use frame 18 (row 2, col 0) = down-facing idle
            const sprite = this.add.sprite(x, y, key, 18)
            sprite.setScale(0.75) // 64px → ~48px display
            sprite.setTint(parseInt(agent.color.replace('#', ''), 16))
            sprite.setInteractive({ useHandCursor: true })
            sprite.setDepth(y) // Y-sort depth

            // Idle bob animation
            this.tweens.add({
              targets: sprite,
              y: y - 2,
              duration: 800 + i * 100,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.easeInOut',
            })

            // Name label
            const label = this.add.text(x, y - 36, agent.name.slice(0, 8), {
              fontFamily: '"Press Start 2P", monospace',
              fontSize: '6px',
              color: '#ffffff',
              stroke: '#000000',
              strokeThickness: 3,
            }).setOrigin(0.5).setDepth(y + 10)

            // Role popup on hover
            const roleText = this.add.text(x, y - 52, agent.role.slice(0, 16), {
              fontFamily: 'monospace',
              fontSize: '9px',
              color: '#ffffff',
              backgroundColor: '#00000088',
              padding: { x: 4, y: 2 },
            }).setOrigin(0.5).setDepth(y + 20).setAlpha(0)

            sprite.on('pointerover', () => {
              roleText.setAlpha(1)
              sprite.setScale(0.85)
            })
            sprite.on('pointerout', () => {
              roleText.setAlpha(0)
              sprite.setScale(0.75)
            })
            sprite.on('pointerdown', () => {
              onClickRef.current(agent.id)
            })

            this.agentSprites.set(agent.id, sprite)
            this.agentLabels.set(agent.id, label)
          })

          // Camera setup
          this.cameras.main.setBackgroundColor('#1a1a2e')
        }

        drawOfficeMap(cols: number, rows: number, tile: number) {
          const gfx = this.add.graphics()

          // Floor tiles — dark wood-like pattern
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const x = c * tile
              const y = r * tile

              // Border walls
              if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) {
                // Wall
                gfx.fillStyle(0x12121a)
                gfx.fillRect(x, y, tile, tile)
                // Wall texture detail
                if (r === 0) {
                  gfx.fillStyle(0x1a1a2e)
                  gfx.fillRect(x + 2, y + tile - 6, tile - 4, 4)
                }
                continue
              }

              // Floor base
              const isAlternate = (r + c) % 2 === 0
              gfx.fillStyle(isAlternate ? 0x1e1e30 : 0x1a1a2c)
              gfx.fillRect(x, y, tile, tile)

              // Subtle floor lines
              gfx.lineStyle(0.5, 0x252540, 0.3)
              gfx.strokeRect(x, y, tile, tile)

              // Center carpet area
              if (c >= 8 && c <= 11 && r >= 1 && r <= 13) {
                gfx.fillStyle(0x1a1050)
                gfx.fillRect(x, y, tile, tile)
              }
            }
          }

          // Windows (top wall)
          const windowPositions = [2, 4, 6, 13, 15, 17]
          windowPositions.forEach(wc => {
            const x = wc * tile
            gfx.fillStyle(0x1a3a6e)
            gfx.fillRect(x + 2, 2, tile - 4, tile - 4)
            gfx.lineStyle(1, 0x4488cc, 0.8)
            gfx.strokeRect(x + 4, 4, tile - 8, tile - 8)
            // Window shine
            gfx.lineStyle(1, 0xaaddff, 0.4)
            gfx.lineBetween(x + 5, 5, x + 10, 12)
          })

          // Desks (left cluster)
          const leftDesks = [
            { c: 2, r: 2 }, { c: 3, r: 2 }, { c: 5, r: 2 }, { c: 6, r: 2 },
            { c: 2, r: 5 }, { c: 3, r: 5 }, { c: 5, r: 5 }, { c: 6, r: 5 },
            { c: 2, r: 9 }, { c: 3, r: 9 }, { c: 5, r: 9 }, { c: 6, r: 9 },
            { c: 2, r: 11 }, { c: 3, r: 11 }, { c: 5, r: 11 }, { c: 6, r: 11 },
          ]
          // Desks (right cluster)
          const rightDesks = [
            { c: 13, r: 2 }, { c: 14, r: 2 }, { c: 16, r: 2 }, { c: 17, r: 2 },
            { c: 13, r: 5 }, { c: 14, r: 5 }, { c: 16, r: 5 }, { c: 17, r: 5 },
            { c: 13, r: 9 }, { c: 14, r: 9 }, { c: 16, r: 9 }, { c: 17, r: 9 },
            { c: 13, r: 11 }, { c: 14, r: 11 }, { c: 16, r: 11 }, { c: 17, r: 11 },
          ]

          ;[...leftDesks, ...rightDesks].forEach(({ c, r }) => {
            const x = c * tile
            const y = r * tile
            // Desk surface
            gfx.fillStyle(0x3d2b0e)
            gfx.fillRect(x + 1, y + 1, tile - 2, tile - 2)
            // Desk highlight
            gfx.fillStyle(0x5a3f15)
            gfx.fillRect(x + 2, y + 2, tile - 4, 3)
            // Monitor
            gfx.fillStyle(0x111122)
            gfx.fillRect(x + 8, y + 6, 14, 10)
            gfx.fillStyle(0x3355aa)
            gfx.fillRect(x + 9, y + 7, 12, 8)
            // Monitor stand
            gfx.fillStyle(0x333344)
            gfx.fillRect(x + 13, y + 16, 4, 4)
          })

          // Plants (corners)
          const plantPositions = [
            { c: 1, r: 7 }, { c: 18, r: 7 },
            { c: 1, r: 1 }, { c: 18, r: 1 },
          ]
          plantPositions.forEach(({ c, r }) => {
            const x = c * tile + tile / 2
            const y = r * tile + tile / 2
            // Pot
            gfx.fillStyle(0x6b3a1f)
            gfx.fillRect(x - 8, y + 4, 16, 12)
            // Plant
            gfx.fillStyle(0x1a5c1a)
            gfx.fillCircle(x, y - 4, 12)
            gfx.fillStyle(0x228b22)
            gfx.fillCircle(x - 6, y - 6, 7)
            gfx.fillCircle(x + 6, y - 6, 7)
          })

          // Coffee machine (middle right)
          const cmx = 18 * tile
          const cmy = 7 * tile
          gfx.fillStyle(0x2a2a3a)
          gfx.fillRect(cmx + 2, cmy + 2, tile - 4, tile - 4)
          gfx.fillStyle(0xff6600)
          gfx.fillCircle(cmx + tile / 2, cmy + 10, 4)

          // Door (bottom center)
          gfx.fillStyle(0x5a3010)
          gfx.fillRect(9 * tile, (rows - 1) * tile, 2 * tile, tile)
          gfx.fillStyle(0x8b5a2b)
          gfx.fillRect(9 * tile + 2, (rows - 1) * tile + 2, 2 * tile - 4, tile - 4)

          // Whiteboard (top center area)
          const wbx = 8 * tile
          const wby = 1 * tile
          gfx.fillStyle(0xf0f0f0)
          gfx.fillRect(wbx, wby + 2, 4 * tile, tile - 4)
          gfx.lineStyle(2, 0xaaaaaa, 1)
          gfx.strokeRect(wbx, wby + 2, 4 * tile, tile - 4)
          // Whiteboard content
          gfx.lineStyle(1, 0x3366cc, 0.8)
          gfx.lineBetween(wbx + 8, wby + 10, wbx + 50, wby + 20)
          gfx.lineBetween(wbx + 55, wby + 8, wbx + 90, wby + 24)
          gfx.fillStyle(0xff4444)
          gfx.fillCircle(wbx + 35, wby + 15, 3)
        }
      }

      const config: object = {
        type: Phaser.AUTO,
        parent: containerRef.current!,
        width: 640,
        height: 480,
        pixelArt: true,
        antialias: false,
        backgroundColor: '#1a1a2e',
        scene: OfficeScene,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
      }

      const game = new Phaser.Game(config)
      gameRef.current = game
    }

    init()

    return () => {
      if (gameRef.current) {
        (gameRef.current as { destroy: (b: boolean) => void }).destroy(true)
        gameRef.current = null
      }
    }
  }, [agents])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', maxWidth: '640px', aspectRatio: '640/480' }}
    />
  )
}
