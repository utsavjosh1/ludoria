# `public/models/` — exported runtime art

Place exported **GLB files** here, mirroring the `url` fields in
`public/manifests/*.json`:

```
public/models/z01/relay-pylon.glb
```

Rules (full workflow: `docs/assets.md`):

- Only small, web-ready exports live here. Blender `.blend` sources stay out
  of git (see root `.gitignore`).
- Every file must be registered in a zone manifest with a matching
  `contentVersion`; the game loads `url?v=<contentVersion>` so a running
  session pins one consistent build.
- Run `npm run assets:validate` after adding or replacing files.
- Z01 currently ships **fixtures only** (`"fixture": true` in
  `zone-z01.json`); no `.glb` files are required for the test scene.
