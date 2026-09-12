import * as THREE from 'three'

export type GraphicsQuality = 'low' | 'medium' | 'high'

export const QUALITY_SETTINGS: Record<
  GraphicsQuality,
  { pixelRatioCap: number; shadows: boolean; shadowMap: number; antialias: boolean }
> = {
  low: { pixelRatioCap: 1, shadows: false, shadowMap: 0, antialias: false },
  medium: { pixelRatioCap: 1.5, shadows: true, shadowMap: 512, antialias: true },
  high: { pixelRatioCap: 2, shadows: true, shadowMap: 1024, antialias: true },
}

export function createRenderer(
  canvas: HTMLCanvasElement,
  quality: GraphicsQuality,
): THREE.WebGLRenderer {
  const q = QUALITY_SETTINGS[quality]
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: q.antialias,
    powerPreference: 'high-performance',
  })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  applyQuality(renderer, quality)
  return renderer
}

export function applyQuality(renderer: THREE.WebGLRenderer, quality: GraphicsQuality): void {
  const q = QUALITY_SETTINGS[quality]
  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio ?? 1) : 1
  renderer.setPixelRatio(Math.min(dpr, q.pixelRatioCap))
  renderer.shadowMap.enabled = q.shadows
  renderer.shadowMap.type = THREE.PCFShadowMap
  // Shadow map resolution is per-light (see Game: sun.shadow.mapSize) — the
  // renderer only toggles the shadow pass here.
}

export function resizeRenderer(renderer: THREE.WebGLRenderer): void {
  const canvas = renderer.domElement
  const parent = canvas.parentElement
  const width = parent ? parent.clientWidth : window.innerWidth
  const height = parent ? parent.clientHeight : window.innerHeight
  renderer.setSize(width, height, false)
}
