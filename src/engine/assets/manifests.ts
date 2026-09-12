import { type AssetDef, type ZoneManifest, zoneManifestSchema } from '../../contracts/index.js'

export interface ManifestLoadResult {
  manifest: ZoneManifest
}

/** Append the content version so a running game pins one consistent build. */
export function versionedUrl(def: AssetDef): string {
  if (def.fixture) return def.url
  const separator = def.url.includes('?') ? '&' : '?'
  return `${def.url}${separator}v=${encodeURIComponent(def.contentVersion)}`
}

function duplicateIds(manifest: ZoneManifest): string[] {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const asset of manifest.assets) {
    if (seen.has(asset.id)) dupes.add(asset.id)
    seen.add(asset.id)
  }
  return [...dupes]
}

function brokenPlacementRefs(manifest: ZoneManifest): string[] {
  const ids = new Set(manifest.assets.map((a) => a.id))
  return manifest.placements.filter((p) => !ids.has(p.asset)).map((p) => p.asset)
}

export async function loadZoneManifest(
  fetchFn: typeof fetch,
  url: string,
): Promise<ManifestLoadResult> {
  let response: Response
  try {
    response = await fetchFn(url)
  } catch (error) {
    throw new Error(
      `Could not fetch zone manifest at ${url}: ${error instanceof Error ? error.message : 'network error'}`,
    )
  }
  if (!response.ok) {
    throw new Error(
      `Zone manifest at ${url} is missing or unreadable (HTTP ${response.status}). ` +
        `Check the file exists under the web public directory and the name matches the zone id.`,
    )
  }
  let json: unknown
  try {
    json = await response.json()
  } catch {
    throw new Error(`Zone manifest at ${url} is not valid JSON.`)
  }
  const parsed = zoneManifestSchema.safeParse(json)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    throw new Error(
      `Zone manifest at ${url} has invalid metadata` +
        (first ? `: ${first.path.join('.')} — ${first.message}` : '.'),
    )
  }
  const dupes = duplicateIds(parsed.data)
  if (dupes.length > 0) {
    throw new Error(`Zone manifest at ${url} has duplicate asset ids: ${dupes.join(', ')}.`)
  }
  const broken = brokenPlacementRefs(parsed.data)
  if (broken.length > 0) {
    throw new Error(`Zone manifest at ${url} references unknown assets: ${broken.join(', ')}.`)
  }
  return { manifest: parsed.data }
}
