# Scene assets

The playable Z01 scene uses procedural placeholders generated in
`src/engine/render/fixture.ts`. Its spawn and placements live in
`public/manifests/zone-z01.json`; mission triggers live in
`src/engine/missions/demo.ts`. Keep trigger and visual positions aligned.

## Validate

```sh
npm run assets:validate
```

This checks manifest metadata, asset IDs, placement references, and referenced
files. Assets marked `"fixture": true` do not need files. Validation also runs
during `npm run build`.

## Adding real art

- Export small `.glb` files to `public/models/<zone>/`. Keep Blender sources out
  of git. Use metres, apply transforms, and export using glTF's Y-up convention.
- Register files in the zone manifest with a stable kebab-case `id`, root-relative
  `url`, and `contentVersion`. Bump the version whenever the file changes.
- The loader can fetch and cache GLBs, but the current renderer still builds
  procedural geometry. Replacing a fixture also requires wiring the loaded
  model into `src/engine/render/fixture.ts` or the runtime scene setup.
- Animation playback, collision proxies, and sockets are not yet connected to
  real models. Exporting art alone does not implement gameplay.

Only Z01 is playable. Other zone IDs are reserved, not implemented.
