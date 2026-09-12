/** Logical gameplay state — plain data, no Three.js references. */
export interface WorldState {
  zone: string
  player: { x: number; y: number; z: number; facingY: number }
  moving: boolean
  speed: number
}

export function createWorldState(
  zone: string,
  spawn: { x: number; y: number; z: number },
): WorldState {
  return { zone, player: { ...spawn, facingY: 0 }, moving: false, speed: 0 }
}
