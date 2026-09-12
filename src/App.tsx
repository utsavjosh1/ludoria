import { useCallback, useEffect, useRef, useState } from 'react'
import type { SaveData } from './contracts'
import type { HudSnapshot } from './engine/runtime/Game'
import { decodeSave, encodeSave } from './engine/save/codec'
import { saveStore } from './engine/save/store'
import { GameHost, type GameHostHandle } from './game/GameHost'
import { Hud } from './screens/Hud'
import { SettingsControls } from './screens/SettingsControls'
import { MenuButton, Screen, Subtitle, Title } from './screens/ui'
import { type GameSettings, loadSettings, storeSettings } from './settings/store'

type Phase = 'menu' | 'settings' | 'loading' | 'playing' | 'paused' | 'error'
type SaveState =
  | { status: 'checking' }
  | { status: 'none' }
  | { status: 'ready'; save: SaveData }
  | { status: 'broken'; detail: string }

export default function App() {
  const [phase, setPhase] = useState<Phase>('menu')
  const [error, setError] = useState('')
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings())
  const [saveState, setSaveState] = useState<SaveState>({ status: 'checking' })
  const [hud, setHud] = useState<HudSnapshot | null>(null)
  const [progress, setProgress] = useState({ phase: 'starting', loaded: 0, total: 1 })
  const [session, setSession] = useState(0)
  const hostRef = useRef<GameHostHandle | null>(null)
  const restoreRef = useRef<SaveData | null>(null)

  const refreshSave = useCallback(async () => {
    setSaveState({ status: 'checking' })
    try {
      const loaded = await saveStore.loadRaw()
      if (loaded.status === 'missing') {
        setSaveState({ status: 'none' })
      } else if (loaded.status === 'unavailable') {
        setSaveState({ status: 'broken', detail: loaded.detail })
      } else {
        const decoded = decodeSave(loaded.raw)
        setSaveState(
          decoded.ok
            ? { status: 'ready', save: decoded.save }
            : { status: 'broken', detail: decoded.detail },
        )
      }
    } catch {
      setSaveState({ status: 'none' })
    }
  }, [])

  useEffect(() => {
    void refreshSave()
  }, [refreshSave])

  const updateSettings = (next: GameSettings) => {
    setSettings(next)
    storeSettings(next)
    hostRef.current?.applySettings(next)
  }

  const startGame = (restore: SaveData | null) => {
    restoreRef.current = restore
    setHud(null)
    setProgress({ phase: 'starting', loaded: 0, total: 1 })
    setSession((s) => s + 1)
    setPhase('loading')
  }

  const discardBrokenSave = async () => {
    await saveStore.clear()
    await refreshSave()
  }

  const persistCheckpoint = useCallback(async () => {
    try {
      const snapshot = hostRef.current?.saveNow()
      if (snapshot) await saveStore.writeRaw(encodeSave(snapshot))
    } catch {
      // Local storage failures must not break navigation.
    }
  }, [])

  const pauseGame = useCallback(() => {
    hostRef.current?.pause()
    setPhase('paused')
    void persistCheckpoint().then(refreshSave)
  }, [persistCheckpoint, refreshSave])

  const resumeGame = () => {
    hostRef.current?.resume()
    setPhase('playing')
  }

  const quitToMenu = async () => {
    await persistCheckpoint()
    setPhase('menu')
    void refreshSave()
  }

  useEffect(() => {
    if (phase !== 'playing') return
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault()
        pauseGame()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, pauseGame])

  if (phase === 'menu' || phase === 'settings') {
    return (
      <Screen>
        <Title>DEAD LETTER RUN</Title>
        <Subtitle>
          Explore the relay field, activate the pylon, and reach the exit. Progress saves on this
          device.
        </Subtitle>
        {phase === 'menu' ? (
          <div className="flex flex-col items-center gap-3">
            <MenuButton primary onClick={() => startGame(null)}>
              Start game
            </MenuButton>
            <MenuButton
              onClick={() => saveState.status === 'ready' && startGame(saveState.save)}
              disabled={saveState.status !== 'ready'}
            >
              {saveState.status === 'checking' ? 'Checking saves…' : 'Continue'}
            </MenuButton>
            <MenuButton onClick={() => setPhase('settings')}>Settings</MenuButton>
            {saveState.status === 'broken' && (
              <div className="mt-2 max-w-sm rounded-lg border border-amber-500/50 bg-amber-950/40 px-4 py-3 text-xs text-amber-200">
                <p className="font-semibold">Saved progress could not be loaded.</p>
                <p className="mt-1 opacity-80">{saveState.detail}</p>
                <button
                  type="button"
                  onClick={() => void discardBrokenSave()}
                  className="mt-2 rounded border border-amber-500/60 px-3 py-1 font-semibold hover:bg-amber-900/40"
                >
                  Discard and start over
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <SettingsControls settings={settings} onChange={updateSettings} />
            <MenuButton onClick={() => setPhase('menu')}>Back</MenuButton>
          </div>
        )}
        <p className="text-xs text-slate-600">WASD move · Shift sprint · E interact · Esc pause</p>
      </Screen>
    )
  }

  if (phase === 'error') {
    return (
      <Screen>
        <Title>Could not load the scene</Title>
        <Subtitle>{error}</Subtitle>
        <MenuButton primary onClick={() => startGame(restoreRef.current)}>
          Retry
        </MenuButton>
        <MenuButton onClick={() => setPhase('menu')}>Back to menu</MenuButton>
      </Screen>
    )
  }

  const pct = Math.round((progress.loaded / Math.max(1, progress.total)) * 100)
  return (
    <div className="relative h-full bg-black">
      {/* Loading and pausing are overlays: the engine mounts only once per session. */}
      <GameHost
        key={session}
        ref={hostRef}
        manifestUrl="/manifests/zone-z01.json"
        settings={settings}
        restoreSave={restoreRef.current}
        perfOverlay={import.meta.env.DEV}
        onHud={(snapshot) => {
          setHud(snapshot)
          setPhase((current) => (current === 'loading' ? 'playing' : current))
        }}
        onProgress={(p, loaded, total) => setProgress({ phase: p, loaded, total })}
        onError={(message) => {
          setError(message)
          setPhase('error')
        }}
        onAutoPause={pauseGame}
      />
      {phase === 'loading' ? (
        <div className="absolute inset-0 z-40">
          <Screen>
            <Title>Loading Z01</Title>
            <div className="w-72">
              <div className="h-2 overflow-hidden rounded bg-slate-800">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {progress.phase}… {pct}%
              </p>
            </div>
          </Screen>
        </div>
      ) : (
        <Hud snapshot={hud} />
      )}
      {phase === 'paused' && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 overflow-y-auto bg-black/70 px-6 py-8 text-center">
          <Title>Paused</Title>
          <MenuButton primary onClick={resumeGame}>
            Resume
          </MenuButton>
          <SettingsControls settings={settings} onChange={updateSettings} />
          <MenuButton onClick={() => void quitToMenu()}>Save & return to menu</MenuButton>
        </div>
      )}
      {phase === 'playing' && (
        <>
          <button
            type="button"
            onClick={pauseGame}
            aria-label="Pause"
            className="absolute right-4 top-4 z-30 rounded-lg border border-slate-700 bg-black/60 px-3 py-2 text-sm font-semibold text-slate-200 backdrop-blur hover:border-slate-500"
          >
            ❚❚ Pause
          </button>
          <p className="pointer-events-none absolute bottom-3 left-4 z-30 text-[11px] text-slate-500">
            WASD move · Shift sprint · E interact · Esc pause
          </p>
        </>
      )}
    </div>
  )
}
