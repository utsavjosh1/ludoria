import {
  MIN_SUPPORTED_SAVE_VERSION,
  SAVE_VERSION,
  type SaveData,
  saveDataSchema,
} from '../../contracts/index.js'

export type SaveIssue = 'missing' | 'corrupt' | 'incompatible'

export interface SaveDefaults {
  missionId: string
  playerZone: string
  playerPosition: { x: number; y: number; z: number }
}

/**
 * Validate unknown data into a SaveData. Never throws: incompatible versions
 * and corrupted payloads are reported so the UI can offer recovery (discard /
 * start over) instead of crashing.
 */
export function decodeSave(
  unknownData: unknown,
): { ok: true; save: SaveData } | { ok: false; issue: SaveIssue; detail: string } {
  if (unknownData === null || unknownData === undefined) {
    return { ok: false, issue: 'missing', detail: 'No save data present.' }
  }
  let parsed: unknown = unknownData
  if (typeof unknownData === 'string') {
    try {
      parsed = JSON.parse(unknownData)
    } catch {
      return { ok: false, issue: 'corrupt', detail: 'Save is not valid JSON.' }
    }
  }
  const result = saveDataSchema.safeParse(parsed)
  if (!result.success) {
    const version =
      typeof parsed === 'object' && parsed !== null && 'version' in parsed
        ? (parsed as { version: unknown }).version
        : undefined
    if (
      typeof version === 'number' &&
      (version > SAVE_VERSION || version < MIN_SUPPORTED_SAVE_VERSION)
    ) {
      return {
        ok: false,
        issue: 'incompatible',
        detail: `Save version ${version} is not supported by this build.`,
      }
    }
    return { ok: false, issue: 'corrupt', detail: 'Save failed validation.' }
  }
  return { ok: true, save: result.data }
}

export function encodeSave(save: SaveData): string {
  return JSON.stringify(save)
}

export function freshSave(defaults: SaveDefaults): SaveData {
  return {
    version: 2,
    missionId: defaults.missionId,
    completedObjectives: [],
    checkpoints: [],
    activeObjective: null,
    playerPosition: { ...defaults.playerPosition },
    playerZone: defaults.playerZone,
    playtimeSeconds: 0,
    updatedAt: new Date().toISOString(),
  }
}
