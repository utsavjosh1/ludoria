import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import type { SaveData } from '../contracts'
import { DEMO_MISSION } from '../engine/missions/demo'
import type { GameSettings as EngineSettings, Game, HudSnapshot } from '../engine/runtime/Game'
import type { GameSettings } from '../settings/store'

export interface GameHostHandle {
  pause(): void
  resume(): void
  saveNow(): SaveData | null
  applySettings(settings: GameSettings): void
}

interface GameHostProps {
  manifestUrl: string
  settings: GameSettings
  restoreSave: SaveData | null
  perfOverlay: boolean
  onHud(snapshot: HudSnapshot): void
  onProgress(phase: string, loaded: number, total: number): void
  onError(message: string): void
  onAutoPause(): void
}

function toEngineSettings(settings: GameSettings): EngineSettings {
  return { volume: settings.volume, muted: settings.muted, quality: settings.quality }
}

/**
 * Owns the canvas and exactly one Game instance. The engine is lazy-imported
 * so the menu bundle never pays for Three.js/Rapier. StrictMode double-mounts
 * (and any re-entry) dispose cleanly: no duplicate loops or listeners.
 */
export const GameHost = forwardRef<GameHostHandle, GameHostProps>(function GameHost(props, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const gameRef = useRef<Game | null>(null)
  const propsRef = useRef(props)
  propsRef.current = props

  useImperativeHandle(ref, () => ({
    pause: () => gameRef.current?.pause(),
    resume: () => gameRef.current?.resume(),
    saveNow: () => {
      try {
        return gameRef.current?.saveNow() ?? null
      } catch {
        return null
      }
    },
    applySettings: (settings: GameSettings) => {
      gameRef.current?.setQuality(settings.quality)
      gameRef.current?.setVolume(settings.volume)
      gameRef.current?.setMuted(settings.muted)
    },
  }))

  useEffect(() => {
    let cancelled = false
    let game: Game | null = null

    async function boot(): Promise<void> {
      const canvas = canvasRef.current
      if (!canvas) return
      // Lazy: the menu renders without downloading the 3D engine.
      const mod = await import('../engine/runtime/Game')
      if (cancelled) return
      const p = propsRef.current
      game = new mod.Game({
        canvas,
        manifestUrl: p.manifestUrl,
        mission: DEMO_MISSION,
        settings: toEngineSettings(p.settings),
        perfOverlay: p.perfOverlay,
        hooks: {
          onHud: (snapshot) => {
            if (!cancelled) p.onHud(snapshot)
          },
          onProgress: (phase, loaded, total) => {
            if (!cancelled) p.onProgress(phase, loaded, total)
          },
          onError: (message) => {
            if (!cancelled) p.onError(message)
          },
          onAutoPause: () => {
            if (!cancelled) p.onAutoPause()
          },
        },
      })
      gameRef.current = game
      try {
        await game.init()
        if (cancelled) {
          game.dispose()
          gameRef.current = null
          return
        }
        game.start(p.restoreSave)
      } catch (error) {
        game.dispose()
        gameRef.current = null
        if (!cancelled) {
          p.onError(error instanceof Error ? error.message : 'Failed to start the game.')
        }
      }
    }

    void boot()
    return () => {
      cancelled = true
      gameRef.current?.dispose()
      gameRef.current = null
      game?.dispose()
    }
    // Mount-once by design: settings apply via the imperative handle, and a
    // fresh restore requires remounting through App state (new session key).
  }, [])

  return (
    <canvas ref={canvasRef} className="game-canvas" aria-label="Dead Letter Run 3D test scene" />
  )
})
