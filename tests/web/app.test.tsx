// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App'
import type { GameOptions } from '../../src/engine/runtime/Game'
import { encodeSave, freshSave } from '../../src/engine/save/codec'
import { saveStore } from '../../src/engine/save/store'

const engine = vi.hoisted(() => ({
  create: vi.fn<(options: GameOptions) => void>(),
  init: vi.fn<() => Promise<void>>(),
  start: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  dispose: vi.fn(),
  saveNow: vi.fn(),
}))

vi.mock('../../src/engine/runtime/Game', () => ({
  Game: class {
    constructor(private options: GameOptions) {
      engine.create(options)
    }
    init = engine.init
    pause = engine.pause
    resume = engine.resume
    dispose = engine.dispose
    saveNow = engine.saveNow
    start(save: unknown) {
      engine.start(save)
      this.options.hooks.onHud({
        objectiveTitle: 'Enter the relay field',
        objectiveDesc: 'Walk north',
        objectiveIndex: 0,
        objectiveTotal: 3,
        prompt: null,
        missionComplete: false,
        checkpoint: null,
      })
    }
  },
}))

const saved = freshSave({
  missionId: 'z01-first-light',
  playerZone: 'Z01',
  playerPosition: { x: 0, y: 0, z: 0 },
})

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('fetch', vi.fn())
  vi.spyOn(saveStore, 'loadRaw').mockResolvedValue({ status: 'missing' })
  vi.spyOn(saveStore, 'writeRaw').mockResolvedValue()
  engine.init.mockResolvedValue()
  engine.saveNow.mockReturnValue(saved)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function button(label: string): HTMLButtonElement {
  const match = [...container.querySelectorAll('button')].find(
    (element) =>
      element.textContent?.trim() === label || element.getAttribute('aria-label') === label,
  )
  if (!match) throw new Error(`Button not found: ${label}`)
  return match
}

async function click(label: string) {
  await act(async () => button(label).click())
}

async function render() {
  await act(async () => root.render(<App />))
}

describe('game session', () => {
  it('opens the menu without contacting a backend or starting the engine', async () => {
    await render()
    expect(button('Start game').disabled).toBe(false)
    expect(button('Continue').disabled).toBe(true)
    expect(fetch).not.toHaveBeenCalled()
    expect(engine.create).not.toHaveBeenCalled()
  })

  it('keeps one canvas and engine through loading, play, pause, and resume', async () => {
    let finishLoading: (() => void) | undefined
    const pending = new Promise<void>((resolve) => {
      finishLoading = resolve
    })
    engine.init.mockReturnValueOnce(pending)
    await render()
    await click('Start game')
    await act(async () => {
      await vi.waitFor(() => expect(engine.init).toHaveBeenCalledOnce())
    })
    expect(container.textContent).toContain('Loading Z01')
    const canvas = container.querySelector('canvas')
    expect(canvas).not.toBeNull()

    await act(async () => finishLoading?.())
    expect(container.textContent).not.toContain('Loading Z01')
    expect(container.querySelector('canvas')).toBe(canvas)
    expect(engine.create).toHaveBeenCalledOnce()
    expect(engine.start).toHaveBeenCalledExactlyOnceWith(null)
    expect(engine.dispose).not.toHaveBeenCalled()

    await click('Pause')
    expect(engine.pause).toHaveBeenCalledOnce()
    expect(saveStore.writeRaw).toHaveBeenCalledWith(encodeSave(saved))
    await click('Resume')
    expect(engine.resume).toHaveBeenCalledOnce()
    expect(container.querySelector('canvas')).toBe(canvas)
    expect(engine.create).toHaveBeenCalledOnce()

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }))
    })
    await click('Save & return to menu')
    expect(button('Start game')).toBeDefined()
    expect(container.querySelector('canvas')).toBeNull()
    expect(engine.dispose).toHaveBeenCalled()
  })

  it('continues validated local progress without a network request', async () => {
    vi.mocked(saveStore.loadRaw).mockResolvedValue({ status: 'ok', raw: encodeSave(saved) })
    await render()
    await click('Continue')
    await act(async () => {
      await vi.waitFor(() => expect(engine.start).toHaveBeenCalledWith(saved))
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('shows initialization errors and allows a fresh retry', async () => {
    engine.init.mockRejectedValueOnce(new Error('Scene unavailable'))
    await render()
    await click('Start game')
    await act(async () => {
      await vi.waitFor(() => expect(container.textContent).toContain('Scene unavailable'))
    })
    await click('Retry')
    await act(async () => {
      await vi.waitFor(() => expect(engine.start).toHaveBeenCalledOnce())
    })
    expect(engine.create).toHaveBeenCalledTimes(2)
    expect(container.textContent).not.toContain('Scene unavailable')
  })
})
