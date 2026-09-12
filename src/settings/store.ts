export type GraphicsQuality = 'low' | 'medium' | 'high'

export interface GameSettings {
  volume: number
  muted: boolean
  quality: GraphicsQuality
}

const KEY = 'dlr.settings.v1'

export const DEFAULT_SETTINGS: GameSettings = {
  volume: 0.8,
  muted: false,
  quality: 'medium',
}

function isQuality(value: unknown): value is GraphicsQuality {
  return value === 'low' || value === 'medium' || value === 'high'
}

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<GameSettings>
    return {
      volume:
        typeof parsed.volume === 'number'
          ? Math.min(1, Math.max(0, parsed.volume))
          : DEFAULT_SETTINGS.volume,
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULT_SETTINGS.muted,
      quality: isQuality(parsed.quality) ? parsed.quality : DEFAULT_SETTINGS.quality,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function storeSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // Private mode / quota: settings simply don't persist.
  }
}
