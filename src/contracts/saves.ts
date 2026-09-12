import { z } from 'zod'

/** Semantic save-format version. Bump when SaveData changes incompatibly. */
export const SAVE_VERSION = 2 as const

export const MIN_SUPPORTED_SAVE_VERSION = 1 as const

/** Upper bound for a serialized local save. */
export const MAX_SAVE_BYTES = 256 * 1024

const vec3Schema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
})

export type Vec3 = z.infer<typeof vec3Schema>

/** Stable checkpoint identifiers are namespaced per zone: e.g. "z01-relay". */
const checkpointIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'checkpoint id must be kebab-case')

export const saveDataSchema = z.object({
  version: z.number().int().min(MIN_SUPPORTED_SAVE_VERSION).max(SAVE_VERSION),
  missionId: z.string().min(1).max(64),
  /** Completed objective ids, in completion order. */
  completedObjectives: z.array(z.string().min(1).max(64)).max(256),
  /** Reached checkpoints, in reach order. */
  checkpoints: z.array(checkpointIdSchema).max(256),
  /** Currently active objective id, if the mission is still in progress. */
  activeObjective: z.string().min(1).max(64).nullable(),
  playerPosition: vec3Schema,
  playerZone: z.string().min(1).max(16),
  playtimeSeconds: z
    .number()
    .min(0)
    .max(60 * 60 * 60),
  updatedAt: z.string().datetime(),
})

export type SaveData = z.infer<typeof saveDataSchema>

export function byteSizeOf(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length
}
