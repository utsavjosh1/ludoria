#!/usr/bin/env node
/**
 * Asset manifest validation (zero dependencies).
 *
 * Usage: npm run assets:validate
 *
 * Detects: missing files, duplicate ids, invalid metadata, broken references.
 * Structural rules mirror src/contracts; this tool also checks files on disk.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'

const ZONES = ['Z01', 'Z02', 'Z03', 'Z04', 'Z05', 'Z06', 'Z07', 'Z08', 'Z09']
const TYPES = ['glb', 'texture', 'audio']
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/
const WARN_BYTES = 10 * 1024 * 1024

const errors = []
const warnings = []
const infos = []
let checkedAssets = 0
let checkedManifests = 0

function err(msg) {
  errors.push(msg)
}
function warn(msg) {
  warnings.push(msg)
}
function info(msg) {
  infos.push(msg)
}
function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v)
}
function isVec3(v) {
  return Array.isArray(v) && v.length === 3 && v.every(isFiniteNumber)
}

function checkAsset(manifestName, asset, seenIds, globalIds) {
  const where = `${manifestName} asset "${asset?.id ?? '(unknown)'}"`
  if (typeof asset !== 'object' || asset === null) {
    err(`${manifestName}: asset entry is not an object`)
    return
  }
  if (typeof asset.id !== 'string' || !KEBAB.test(asset.id)) {
    err(`${manifestName}: asset id "${asset.id}" must be kebab-case (stable, never renamed)`)
    return
  }
  if (seenIds.has(asset.id)) err(`${manifestName}: duplicate asset id "${asset.id}"`)
  seenIds.add(asset.id)
  const prev = globalIds.get(asset.id)
  if (prev && (prev.url !== asset.url || prev.type !== asset.type)) {
    err(
      `${manifestName}: asset id "${asset.id}" conflicts with ${prev.manifest} (same id, different url/type)`,
    )
  } else if (!prev) {
    globalIds.set(asset.id, { url: asset.url, type: asset.type, manifest: manifestName })
  }
  if (typeof asset.url !== 'string' || !asset.url.startsWith('/')) {
    err(`${where}: url must be a web-root-relative path starting with "/"`)
  }
  if (typeof asset.contentVersion !== 'string' || asset.contentVersion.length === 0) {
    err(`${where}: contentVersion is required (pin one consistent build)`)
  }
  if (!TYPES.includes(asset.type)) err(`${where}: type must be one of ${TYPES.join(', ')}`)
  if (
    !Array.isArray(asset.zones) ||
    asset.zones.length === 0 ||
    !asset.zones.every((z) => ZONES.includes(z))
  ) {
    err(`${where}: zones must be a non-empty list of Z01–Z09`)
  }
  if (
    asset.animations !== undefined &&
    (!Array.isArray(asset.animations) || !asset.animations.every((a) => typeof a === 'string'))
  ) {
    err(`${where}: animations must be a string array`)
  }
  if (asset.sockets !== undefined) {
    if (!Array.isArray(asset.sockets)) err(`${where}: sockets must be an array`)
    else {
      for (const socket of asset.sockets) {
        if (typeof socket?.name !== 'string' || typeof socket?.node !== 'string') {
          err(`${where}: every socket needs { name, node }`)
        }
        if (socket?.offset !== undefined && !isVec3(socket.offset)) {
          err(`${where}: socket offset must be [x, y, z]`)
        }
      }
    }
  }
  if (asset.collision !== undefined) {
    if (
      typeof asset.collision?.proxyNode !== 'string' ||
      !['static', 'trigger'].includes(asset.collision?.kind)
    ) {
      err(`${where}: collision needs { proxyNode: string, kind: static|trigger }`)
    }
  }
  checkedAssets += 1
}

function checkFile(manifestName, asset, publicDir) {
  if (asset.fixture === true) {
    info(`${manifestName}: "${asset.id}" is a fixture (procedural stand-in, no file needed)`)
    return
  }
  if (typeof asset.url !== 'string' || !asset.url.startsWith('/')) return
  const filePath = join(publicDir, asset.url.split('?')[0].split('/').join(sep))
  if (!existsSync(filePath)) {
    err(`${manifestName}: "${asset.id}" is missing file ${asset.url} (served from ${filePath})`)
    return
  }
  const size = statSync(filePath).size
  if (size === 0) err(`${manifestName}: "${asset.id}" file is empty: ${asset.url}`)
  if (size > WARN_BYTES) {
    warn(
      `${manifestName}: "${asset.id}" is ${(size / 1048576).toFixed(1)} MiB — keep web exports small (see docs/assets.md)`,
    )
  }
}

function checkManifest(file, manifestsDir, publicDir, globalIds) {
  const raw = readFileSync(join(manifestsDir, file), 'utf8')
  let manifest
  try {
    manifest = JSON.parse(raw)
  } catch {
    err(`${file}: not valid JSON`)
    return
  }
  if (!Number.isInteger(manifest?.manifestVersion) || manifest.manifestVersion < 1) {
    err(`${file}: manifestVersion must be an integer >= 1`)
  }
  if (!ZONES.includes(manifest?.zone)) err(`${file}: zone must be one of ${ZONES.join(', ')}`)
  if (typeof manifest?.name !== 'string' || manifest.name.length === 0)
    err(`${file}: name is required`)
  if (!isVec3(manifest?.spawn?.position) || !isFiniteNumber(manifest?.spawn?.facingY)) {
    err(`${file}: spawn needs { position: [x, y, z], facingY: number }`)
  }
  if (!Array.isArray(manifest?.assets) || manifest.assets.length === 0) {
    err(`${file}: assets must be a non-empty array`)
    return
  }
  const seenIds = new Set()
  for (const asset of manifest.assets) {
    checkAsset(file, asset, seenIds, globalIds)
    checkFile(file, asset, publicDir)
  }
  if (manifest.placements !== undefined) {
    if (!Array.isArray(manifest.placements)) err(`${file}: placements must be an array`)
    else {
      for (const placement of manifest.placements) {
        if (typeof placement?.asset !== 'string' || !seenIds.has(placement.asset)) {
          err(`${file}: placement references unknown asset "${placement?.asset}"`)
          continue
        }
        if (!isVec3(placement?.position))
          err(`${file}: placement of "${placement.asset}" needs position [x, y, z]`)
        if (placement?.rotationY !== undefined && !isFiniteNumber(placement.rotationY)) {
          err(`${file}: placement of "${placement.asset}" needs numeric rotationY`)
        }
        if (
          placement?.scale !== undefined &&
          !(typeof placement.scale === 'number' && placement.scale > 0)
        ) {
          err(`${file}: placement of "${placement.asset}" needs positive scale`)
        }
      }
    }
  }
  checkedManifests += 1
}

function main() {
  const [manifestsDir, publicDir] = process.argv.slice(2)
  if (!manifestsDir || !publicDir) {
    console.error('Usage: node scripts/validate-assets.mjs <manifestsDir> <publicDir>')
    process.exit(2)
  }
  if (!existsSync(manifestsDir)) {
    err(`Manifests directory does not exist: ${manifestsDir}`)
  } else {
    const files = readdirSync(manifestsDir)
      .filter((f) => f.endsWith('.json'))
      .sort()
    if (files.length === 0) warn(`No manifests found in ${manifestsDir}`)
    const globalIds = new Map()
    for (const file of files) {
      try {
        checkManifest(file, manifestsDir, publicDir, globalIds)
      } catch (error) {
        err(`${file}: unreadable (${error instanceof Error ? error.message : error})`)
      }
    }
  }
  for (const line of infos) console.log(`info: ${line}`)
  for (const line of warnings) console.log(`warn: ${line}`)
  console.log(`\nChecked ${checkedManifests} manifest(s), ${checkedAssets} asset(s).`)
  if (errors.length > 0) {
    for (const line of errors) console.error(`error: ${line}`)
    console.error(`\nAsset validation FAILED with ${errors.length} error(s).`)
    process.exit(1)
  }
  if (warnings.length > 0)
    console.log(`\nAsset validation passed with ${warnings.length} warning(s).`)
  else console.log('\nAsset validation passed.')
}

main()
