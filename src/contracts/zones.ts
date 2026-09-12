import { z } from 'zod'

/** Trigger that fires when the player enters a sphere. */
export const areaTriggerSchema = z.object({
  kind: z.literal('area'),
  id: z.string().min(1).max(64),
  center: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]),
  radius: z.number().positive().max(500),
})

/** Trigger that fires on an explicit interact press near a socket/point. */
export const interactTriggerSchema = z.object({
  kind: z.literal('interact'),
  id: z.string().min(1).max(64),
  point: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]),
  radius: z.number().positive().max(50),
  prompt: z.string().min(1).max(128),
})

export const triggerSchema = z.discriminatedUnion('kind', [
  areaTriggerSchema,
  interactTriggerSchema,
])

export type Trigger = z.infer<typeof triggerSchema>

export const objectiveSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(128),
  description: z.string().min(1).max(512),
  /** Objective ids that must complete first. Order is enforced at runtime. */
  prerequisites: z.array(z.string().min(1).max(64)).default([]),
  trigger: triggerSchema,
  /** Checkpoint id recorded when this objective completes. */
  checkpoint: z.string().min(1).max(64),
})

export type Objective = z.infer<typeof objectiveSchema>

export const missionSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(128),
  zone: z.string().min(1).max(16),
  objectives: z.array(objectiveSchema).min(1).max(64),
})

export type Mission = z.infer<typeof missionSchema>
