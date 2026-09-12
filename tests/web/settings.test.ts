// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, loadSettings } from '../../src/settings/store'

describe('settings store', () => {
  it('falls back to defaults when nothing is stored', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('merges partial stored settings over defaults', () => {
    localStorage.setItem('dlr.settings.v1', JSON.stringify({ volume: 0.2, quality: 'low' }))
    try {
      const settings = loadSettings()
      expect(settings.volume).toBeCloseTo(0.2)
      expect(settings.quality).toBe('low')
      expect(settings.muted).toBe(DEFAULT_SETTINGS.muted)
    } finally {
      localStorage.removeItem('dlr.settings.v1')
    }
  })

  it('rejects invalid quality values', () => {
    localStorage.setItem('dlr.settings.v1', JSON.stringify({ quality: 'ultra' }))
    try {
      expect(loadSettings().quality).toBe(DEFAULT_SETTINGS.quality)
    } finally {
      localStorage.removeItem('dlr.settings.v1')
    }
  })

  it('survives corrupted storage', () => {
    localStorage.setItem('dlr.settings.v1', '{{{broken')
    try {
      expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
    } finally {
      localStorage.removeItem('dlr.settings.v1')
    }
  })
})
