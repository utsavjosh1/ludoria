import { z } from 'zod'

/** Zone identifiers from the Blender production guide. Z01–Z09 are addressable
 *  even though most zones have no exports yet — manifests, not code, decide
 *  which zones are playable. */
export const zoneIdSchema = z.enum(['Z01', 'Z02', 'Z03', 'Z04', 'Z05', 'Z06', 'Z07', 'Z08', 'Z09'])

export type ZoneId = z.infer<typeof zoneIdSchema>

export const assetTypeSchema = z.enum(['glb', 'texture', 'audio'])
export type AssetType = z.infer<typeof assetTypeSchema>

const socketSchema = z.object({
  /** Stable socket name used by gameplay code (e.g. "interact", "muzzle"). */
  name: z.string().min(1).max(64),
  /** Object/node name inside the GLB the socket is attached to. */
  node: z.string().min(1).max(128),
  /** Positional offset in metres, applied after the node transform. */
  offset: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]).optional(),
})

export type AssetSocket = z.infer<typeof socketSchema>

const collisionSchema = z.object({
  /** Node name of the collision proxy mesh inside the GLB. */
  proxyNode: z.string().min(1).max(128),
  kind: z.enum(['static', 'trigger']),
})

const placementSchema = z.object({
  /** References an asset id defined in the same zone manifest. */
  asset: z.string().min(1).max(128),
  position: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]),
  rotationY: z.number().finite().default(0),
  scale: z.number().positive().max(1000).default(1),
})

export type AssetPlacement = z.infer<typeof placementSchema>

export const assetDefSchema = z.object({
  /** Stable id used by gameplay code, e.g. "relay-pylon". Never rename. */
  id: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'asset id must be kebab-case'),
  /** URL relative to the web root (leading "/"), versioned with ?v=<contentVersion>. */
  url: z.string().min(1).max(512),
  contentVersion: z.string().min(1).max(64),
  type: assetTypeSchema,
  zones: z.array(zoneIdSchema).min(1),
  /** Expected animation clip names inside the GLB (informational until loaded). */
  animations: z.array(z.string().min(1).max(128)).max(64).default([]),
  collision: collisionSchema.optional(),
  sockets: z.array(socketSchema).max(32).default([]),
  /** Metres per Blender unit; Blender exports must use 1 unit = 1 m. */
  unitScale: z.number().positive().max(1000).default(1),
  /**
   * Procedural development stand-in: no file is fetched and the validator
   * skips the file-existence check. Must be replaced by a real export before
   * the zone ships. Gameplay code must treat fixtures as temporary.
   */
  fixture: z.boolean().default(false),
})

export type AssetDef = z.infer<typeof assetDefSchema>

export const zoneManifestSchema = z.object({
  manifestVersion: z.number().int().min(1),
  zone: zoneIdSchema,
  name: z.string().min(1).max(128),
  /** Player spawn for this zone: position + facing (radians, Y-up). */
  spawn: z.object({
    position: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]),
    facingY: z.number().finite(),
  }),
  assets: z.array(assetDefSchema).min(1),
  placements: z.array(placementSchema).default([]),
})

export type ZoneManifest = z.infer<typeof zoneManifestSchema>

/** Cross-manifest reference checks that need more than one file. */
export const manifestSetSchema = z.object({
  manifests: z.array(zoneManifestSchema).min(1),
})
