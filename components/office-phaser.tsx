'use client'

import { useEffect, useRef } from 'react'
import type { Agent } from '@/types'

interface OfficePhaserProps {
  agents: Agent[]
  onAgentClick: (agentId: string) => void
}

const TILE = 32
const MAP_COLS = 20
const MAP_ROWS = 15

// Agent desk seat positions (col, row) — matches the map layout
const SEATS = [
  { col: 4, row: 3 }, { col: 4, row: 6 }, { col: 4, row: 10 }, { col: 4, row: 12 },
  { col: 15, row: 3 }, { col: 15, row: 6 }, { col: 15, row: 10 }, { col: 15, row: 12 },
]

export function OfficePhaser({ agents, onAgentClick }: OfficePhaserProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<unknown>(null)
  const onClickRef = useRef(onAgentClick)
  onClickRef.current = onAgentClick

  useEffect(() => {
    if (!containerRef.current) return
    let destroyed = false

    const init = async () => {
      const [Phaser, mapRaw] = await Promise.all([
        import('phaser').then(m => m.default),
        fetch('/assets/small-office-map.json').then(r => r.json()),
      ])

      if (destroyed) return

      // Extract the Tiled JSON and fix tileset image paths
      // (map was built with /assets/tilesets/builtin/ prefix, our files are in /assets/tilesets/)
      const tiledJson: Record<string, unknown> = { ...mapRaw.tiledJson }
      const tilesetArr = tiledJson.tilesets as Array<Record<string, unknown>>
      for (const ts of tilesetArr ?? []) {
        if (typeof ts.image === 'string') {
          ts.image = ts.image.replace('/assets/tilesets/builtin/', '/assets/tilesets/')
        }
      }

      const currentAgents = agents

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      class OfficeScene extends (Phaser.Scene as any) {
        private foregroundSprites: Phaser.GameObjects.Sprite[] = []

        constructor() { super({ key: 'OfficeScene' }) }

        preload() {
          // 576×256, 64×64 per frame (9 cols × 4 rows)
          // Row 0=up, Row 1=left, Row 2=down, Row 3=right
          this.load.spritesheet('body-male', '/assets/sprites/body-male-amber.png', {
            frameWidth: 64, frameHeight: 64,
          })
          this.load.spritesheet('body-female', '/assets/sprites/body-female-amber.png', {
            frameWidth: 64, frameHeight: 64,
          })
        }

        create() {
          this.cameras.main.setBackgroundColor('#1a1a2e')
          this.loadTiledMap()
        }

        // ── Step 1: register map in cache, queue tileset images ──────────────
        private loadTiledMap() {
          // Put the Tiled JSON into Phaser's tilemap cache
          this.cache.tilemap.add('office-map', {
            format: Phaser.Tilemaps.Formats.TILED_JSON,
            data: tiledJson,
          })

          const defs = (tiledJson.tilesets as Array<{
            name?: string; image?: string; tilewidth?: number; tileheight?: number
          }>) ?? []

          // Queue only images that (a) have an absolute path and (b) aren't loaded yet
          const toLoad: { key: string; url: string }[] = []
          for (const ts of defs) {
            const key = ts.name ?? ''
            const url = ts.image ?? ''
            if (!key || !url) continue
            if (this.textures.exists(key)) continue
            if (url.startsWith('/') || url.startsWith('data:')) {
              toLoad.push({ key, url })
            }
          }

          const proceed = () => this.finishMapLoad()

          if (toLoad.length === 0) {
            proceed()
            return
          }

          for (const { key, url } of toLoad) this.load.image(key, url)

          // Log missing tilesets but don't block — complete fires regardless
          this.load.on('loaderror', (file: { key: string }) => {
            console.warn('[Office] Tileset not found, skipping:', file.key)
          })
          this.load.once('complete', proceed)
          this.load.start()
        }

        // ── Step 2: build tilemap and render layers ───────────────────────────
        private finishMapLoad() {
          const map = this.make.tilemap({ key: 'office-map' })

          const defs = (tiledJson.tilesets as Array<{
            name?: string; tilewidth?: number; tileheight?: number
          }>) ?? []

          // Add successfully-loaded tilesets to the map
          for (const ts of defs) {
            const name = ts.name ?? ''
            if (!name || !this.textures.exists(name)) continue
            map.addTilesetImage(name, name, ts.tilewidth ?? TILE, ts.tileheight ?? TILE, 0, 0)
          }

          // Register per-tile frame entries needed for foreground sprite rendering
          for (const ts of defs) {
            const name = ts.name ?? ''
            const phaserTs = map.getTileset(name)
            if (!phaserTs?.image) continue
            const tex = phaserTs.image as Phaser.Textures.Texture
            const cols = phaserTs.columns || 1
            const total = phaserTs.total || 1
            const tw = phaserTs.tileWidth
            const th = phaserTs.tileHeight
            for (let fi = 0; fi < total; fi++) {
              if (!tex.has(String(fi))) {
                tex.add(String(fi), 0, (fi % cols) * tw, Math.floor(fi / cols) * th, tw, th)
              }
            }
          }

          // Render each tile layer in depth order
          const rawLayers = (tiledJson.layers as Array<Record<string, unknown>>) ?? []
          const tileLayers = rawLayers.filter(l => l.type === 'tilelayer')

          for (const rawLayer of tileLayers) {
            const name = rawLayer.name as string
            const nameLower = name.toLowerCase()

            // Resolve depth from Tiled layer properties
            const props = (rawLayer.properties as Array<{ name: string; type: string; value: unknown }>) ?? []
            const dp = props.find(p => p.name === 'depth')
            let depth = 1
            if (dp) {
              if (dp.type === 'int' || dp.type === 'float') depth = Number(dp.value)
              else if (dp.type === 'string' && dp.value === 'y-sort') depth = 5000
            }

            if (nameLower === 'collision') {
              // Hide collision layer in production
              const l = map.createLayer(name, map.tilesets)
              if (l) l.setAlpha(0)
              continue
            }

            if (depth >= 10000) {
              // Foreground: convert to individual sprites for y-sort depth ordering
              // (same technique as deskrpg GameScene.finishTiledMapLoad)
              const tempLayer = map.createLayer(name, map.tilesets)
              if (!tempLayer) continue
              const opacity = (rawLayer.opacity as number) ?? 1

              tempLayer.forEachTile((tile: Phaser.Tilemaps.Tile) => {
                if (tile.index < 0) return
                const tileset = tile.tileset
                if (!tileset?.image) return

                const texKey = (tileset.image as Phaser.Textures.Texture).key
                const frame = String(tile.index - tileset.firstgid)
                const px = tile.pixelX + tile.width / 2
                const py = tile.pixelY + tile.height / 2

                const s = this.add.sprite(px, py, texKey, frame)
                s.setOrigin(0.5, 0.5).setAlpha(opacity)
                if (tile.flipX) s.setFlipX(true)
                if (tile.flipY) s.setFlipY(true)
                s.setDepth(depth + tile.pixelY + tile.height)
                this.foregroundSprites.push(s)
              })

              tempLayer.destroy()
            } else {
              const l = map.createLayer(name, map.tilesets)
              if (l) l.setDepth(depth)
            }
          }

          this.placeAgents()
        }

        // ── Step 3: place agent sprites at desk seats ─────────────────────────
        private placeAgents() {
          currentAgents.slice(0, SEATS.length).forEach((agent: Agent, i: number) => {
            const { col, row } = SEATS[i]
            const x = col * TILE + TILE / 2
            const y = row * TILE + TILE / 2

            // Frame 18 = row 2, col 0 = down-facing idle
            const isFemale = ['marketer', 'hr', 'planner'].includes(agent.avatar ?? '')
            const sprite: Phaser.GameObjects.Sprite = this.add.sprite(x, y, isFemale ? 'body-female' : 'body-male', 18)
            sprite.setScale(0.75)
            sprite.setInteractive({ useHandCursor: true })
            sprite.setDepth(y + 500)

            // Subtle idle bob
            this.tweens.add({
              targets: sprite,
              y: y - 2,
              duration: 800 + i * 120,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.easeInOut',
            })

            // Name label
            this.add.text(x, y - 36, agent.name.slice(0, 8), {
              fontFamily: '"Press Start 2P", monospace',
              fontSize: '6px',
              color: '#ffffff',
              stroke: '#000000',
              strokeThickness: 3,
            }).setOrigin(0.5).setDepth(y + 510)

            // Role tooltip on hover
            const roleText: Phaser.GameObjects.Text = this.add.text(
              x, y - 52,
              (agent.role ?? '').slice(0, 16),
              {
                fontFamily: 'monospace',
                fontSize: '9px',
                color: '#ffffff',
                backgroundColor: '#00000099',
                padding: { x: 4, y: 2 },
              }
            ).setOrigin(0.5).setDepth(y + 512).setAlpha(0)

            sprite.on('pointerover', () => { roleText.setAlpha(1); sprite.setScale(0.9) })
            sprite.on('pointerout', () => { roleText.setAlpha(0); sprite.setScale(0.75) })
            sprite.on('pointerdown', () => { onClickRef.current(agent.id) })
          })
        }
      }

      const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current!,
        width: MAP_COLS * TILE,  // 640px
        height: MAP_ROWS * TILE, // 480px
        pixelArt: true,
        antialias: false,
        backgroundColor: '#1a1a2e',
        scene: OfficeScene,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
      } as object)

      gameRef.current = game
    }

    init()

    return () => {
      destroyed = true
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
