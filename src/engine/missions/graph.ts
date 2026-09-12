import type { Mission, Objective, Trigger } from '../../contracts/index.js'

/** Serializable mission progress. Gameplay state only — no scene references. */
export interface MissionProgress {
  missionId: string
  completed: string[]
  checkpoints: string[]
  activeId: string | null
}

export interface MissionRuntime {
  mission: Mission
  progress: MissionProgress
}

export function createRuntime(mission: Mission, restored?: MissionProgress): MissionRuntime {
  if (restored && restored.missionId === mission.id) {
    // Drop unknown ids (mission def changed since the save was written).
    const known = new Set(mission.objectives.map((o) => o.id))
    const completed = restored.completed.filter((id) => known.has(id))
    const checkpoints = restored.checkpoints.filter((c) =>
      mission.objectives.some((o) => o.checkpoint === c),
    )
    return {
      mission,
      progress: {
        missionId: mission.id,
        completed,
        checkpoints,
        activeId: nextActiveId(mission, completed),
      },
    }
  }
  return {
    mission,
    progress: {
      missionId: mission.id,
      completed: [],
      checkpoints: [],
      activeId: nextActiveId(mission, []),
    },
  }
}

/** Objectives that are incomplete and whose prerequisites are all met. */
export function eligibleObjectives(runtime: MissionRuntime): Objective[] {
  const done = new Set(runtime.progress.completed)
  return runtime.mission.objectives.filter(
    (o) => !done.has(o.id) && o.prerequisites.every((p) => done.has(p)),
  )
}

function nextActiveId(mission: Mission, completed: string[]): string | null {
  const done = new Set(completed)
  const next = mission.objectives.find(
    (o) => !done.has(o.id) && o.prerequisites.every((p) => done.has(p)),
  )
  if (next) return next.id
  // If objectives remain but none are eligible, the def has an unsatisfiable
  // chain — surface the first incomplete one so the HUD can report it.
  const stuck = mission.objectives.find((o) => !done.has(o.id))
  return stuck ? stuck.id : null
}

/**
 * Attempt to complete an objective. Returns false (no state change) when the
 * objective is unknown, already complete, or its prerequisites are unmet —
 * objectives can never advance out of order and completion is granted once.
 */
export function tryComplete(runtime: MissionRuntime, objectiveId: string): boolean {
  const { progress, mission } = runtime
  if (progress.completed.includes(objectiveId)) return false
  const objective = mission.objectives.find((o) => o.id === objectiveId)
  if (!objective) return false
  const done = new Set(progress.completed)
  if (!objective.prerequisites.every((p) => done.has(p))) return false
  progress.completed.push(objective.id)
  if (!progress.checkpoints.includes(objective.checkpoint)) {
    progress.checkpoints.push(objective.checkpoint)
  }
  progress.activeId = nextActiveId(mission, progress.completed)
  return true
}

export function isComplete(runtime: MissionRuntime): boolean {
  return (
    runtime.progress.activeId === null &&
    runtime.mission.objectives.every((o) => runtime.progress.completed.includes(o.id))
  )
}

export function activeObjective(runtime: MissionRuntime): Objective | null {
  if (!runtime.progress.activeId) return null
  return runtime.mission.objectives.find((o) => o.id === runtime.progress.activeId) ?? null
}

export interface TriggerInput {
  player: { x: number; y: number; z: number }
  interactPressed: boolean
}

export function triggerSatisfied(trigger: Trigger, input: TriggerInput): boolean {
  if (trigger.kind === 'area') {
    const dx = input.player.x - trigger.center[0]
    const dy = input.player.y - trigger.center[1]
    const dz = input.player.z - trigger.center[2]
    return dx * dx + dy * dy + dz * dz <= trigger.radius * trigger.radius
  }
  const dx = input.player.x - trigger.point[0]
  const dz = input.player.z - trigger.point[2]
  const horizontal = Math.sqrt(dx * dx + dz * dz)
  return input.interactPressed && horizontal <= trigger.radius
}
