import { describe, expect, it } from 'vitest'
import { DEMO_MISSION } from '../../src/engine/missions/demo.js'
import {
  activeObjective,
  createRuntime,
  eligibleObjectives,
  isComplete,
  triggerSatisfied,
  tryComplete,
} from '../../src/engine/missions/graph.js'

describe('mission ordering', () => {
  it('starts with the first objective active', () => {
    const runtime = createRuntime(DEMO_MISSION)
    expect(activeObjective(runtime)?.id).toBe('enter-field')
    expect(isComplete(runtime)).toBe(false)
  })

  it('refuses out-of-order completion', () => {
    const runtime = createRuntime(DEMO_MISSION)
    expect(tryComplete(runtime, 'activate-relay')).toBe(false)
    expect(tryComplete(runtime, 'reach-exit')).toBe(false)
    expect(runtime.progress.completed).toEqual([])
  })

  it('refuses unknown objectives', () => {
    const runtime = createRuntime(DEMO_MISSION)
    expect(tryComplete(runtime, 'nope')).toBe(false)
  })

  it('advances through the full sequence exactly once', () => {
    const runtime = createRuntime(DEMO_MISSION)
    expect(tryComplete(runtime, 'enter-field')).toBe(true)
    expect(activeObjective(runtime)?.id).toBe('activate-relay')
    // Double completion is not granted.
    expect(tryComplete(runtime, 'enter-field')).toBe(false)
    expect(tryComplete(runtime, 'activate-relay')).toBe(true)
    expect(tryComplete(runtime, 'reach-exit')).toBe(true)
    expect(isComplete(runtime)).toBe(true)
    expect(runtime.progress.activeId).toBeNull()
  })

  it('records checkpoints in order without duplicates', () => {
    const runtime = createRuntime(DEMO_MISSION)
    for (const id of ['enter-field', 'activate-relay', 'reach-exit']) {
      expect(tryComplete(runtime, id)).toBe(true)
    }
    expect(runtime.progress.checkpoints).toEqual(['z01-field', 'z01-relay', 'z01-exit'])
  })

  it('exposes only eligible objectives', () => {
    const runtime = createRuntime(DEMO_MISSION)
    expect(eligibleObjectives(runtime).map((o) => o.id)).toEqual(['enter-field'])
    tryComplete(runtime, 'enter-field')
    expect(eligibleObjectives(runtime).map((o) => o.id)).toEqual(['activate-relay'])
  })

  it('restores progress from a save and drops unknown ids', () => {
    const runtime = createRuntime(DEMO_MISSION, {
      missionId: 'z01-first-light',
      completed: ['enter-field', 'stale-objective'],
      checkpoints: ['z01-field', 'stale-checkpoint'],
      activeId: 'activate-relay',
    })
    expect(runtime.progress.completed).toEqual(['enter-field'])
    expect(runtime.progress.checkpoints).toEqual(['z01-field'])
    expect(activeObjective(runtime)?.id).toBe('activate-relay')
  })

  it('ignores restores for a different mission', () => {
    const runtime = createRuntime(DEMO_MISSION, {
      missionId: 'other',
      completed: ['enter-field'],
      checkpoints: [],
      activeId: null,
    })
    expect(runtime.progress.completed).toEqual([])
  })
})

describe('trigger conditions', () => {
  it('fires area triggers on the boundary', () => {
    const trigger = DEMO_MISSION.objectives[0]?.trigger
    if (!trigger) throw new Error('demo mission changed')
    expect(
      triggerSatisfied(trigger, { player: { x: 0, y: 0, z: 6 }, interactPressed: false }),
    ).toBe(true)
    expect(
      triggerSatisfied(trigger, { player: { x: 0, y: 0, z: 11 }, interactPressed: false }),
    ).toBe(false)
  })

  it('requires both proximity and an interact press', () => {
    const trigger = DEMO_MISSION.objectives[1]?.trigger
    if (trigger?.kind !== 'interact') throw new Error('demo mission changed')
    const near = { player: { x: 3, y: 0, z: 12 }, interactPressed: false }
    expect(triggerSatisfied(trigger, near)).toBe(false)
    expect(triggerSatisfied(trigger, { ...near, interactPressed: true })).toBe(true)
    expect(
      triggerSatisfied(trigger, { player: { x: 30, y: 0, z: 30 }, interactPressed: true }),
    ).toBe(false)
  })
})
