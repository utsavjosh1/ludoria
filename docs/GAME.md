# Ludoria: The Wandering Valley

The first playable Ludoria release is a solo, top-down exploration game written in JavaScript. The original repository contained a Turborepo/Next.js starter and an unused account schema; no existing gameplay or game assets were replaced.

## Play loop

1. Meet Rowan, north of the spawn point in Greenhaven, and receive three embers.
2. Gather wood from fallen logs with the axe, stone from rocks with the pickaxe, and berries with Interact. Traveler caches also contain supplies.
3. Follow the paths to Pinewatch, Stillwater, and Mossheart. Spend 3 wood, 2 stone, and 1 ember to rekindle each beacon.
4. Return to Rowan to complete the journey. Free exploration remains available afterward.

Slimes take three sword hits and drop an ember. Face enemies before swinging. Berries restore two health; lit beacons restore all six health. Defeat returns the player to Greenhaven without removing supplies or quest progress. All quest destinations and enough resources are reachable from spawn.

## Source layout

- `apps/web/public/game/engine/world.js`: deterministic 96 × 80 tile world, roads, bridges, collision mask, landmarks, resource placement.
- `engine/simulation.js`: movement, stamina, combat, inventory, quest transitions, validated save serialization. No DOM dependencies.
- `engine/renderer.js`: pixel renderer, sprite atlases, terrain cache, camera, depth sorting, lighting, maps, particle effects.
- `engine/audio.js`: gesture-gated Web Audio synthesis with bounded oscillator lifetimes.
- `apps/web/public/game/main.js`: input, game loop, accessible HTML panels, mobile controls, lifecycle, UI, and local saves.
- `scripts/build-game.mjs`: dependency-free static build, syntax/import checks, required asset checks, and a 250 KiB raw release budget.
- `scripts/dev-game.mjs`: dependency-free local server bound to loopback.
- `apps/web/tests/game.test.mjs`: world connectivity, deterministic generation, resource accounting, quest completion, combat, collision, and malformed-save tests.

The Next.js page embeds this same game at `/game/index.html`. The standalone release serves the game directly at `/`, without a React runtime. Existing server/database packages remain outside gameplay and are not presented as working multiplayer or account features.

## Resource decisions

- No added runtime npm dependencies in the game.
- Two packed 192 × 176 sprite atlases, each using 16 × 16 source tiles; no per-sprite HTTP requests.
- Local font and assets; no runtime CDN, analytics, or external game APIs.
- Terrain is cached in 256 × 256 canvases, with a 16-entry LRU limit (4 MiB of RGBA pixels, excluding browser overhead).
- Static scenery is bucketed by chunk and culled before depth sorting. Offscreen enemies skip steering outside 240 world pixels.
- Rendering ignores device pixel ratio, so a high-density display cannot multiply canvas fill cost.
- Simulation runs at a fixed 60 Hz, caps catch-up at six steps, and normalizes diagonal movement. This is a timing target, not a measured frame-rate guarantee.
- DOM HUD updates run at 8 Hz and avoid text/style writes when values are unchanged. The background menu renders at approximately 30 Hz.
- Particles are capped at 100. Hidden tabs stop animation and suspend audio. Input clears on blur and modal entry.
- Audio uses short-lived oscillators instead of downloaded sound files. Sound starts muted and requires a user gesture.
- Saves are local to the current browser/origin, schema validated, and limited to known resources and beacons. Storage failures never block play.
- Reduced-motion preferences disable ambient drift, walking bob, and camera easing.

## Validation and limits

Run `npm run test:game` and `npm run build:game` without installing dependencies. CI runs both and uploads the static game artifact. To check the retained Next.js integration, install the workspace and run its build separately.

This release is single-player. It has no network server, multiplayer synchronization, account login, building interiors, or cloud saves. A static host can deploy `out/` directly. Do not open the HTML using `file://`: JavaScript modules require HTTP. Saves on a private preview do not migrate automatically to a different domain.

Interactive browser QA and device performance benchmarking are separate from the deterministic logic and build checks. No universal FPS or device-support guarantee is implied.

## Asset attribution

Kenney Tiny Town and Tiny Dungeon: CC0, https://kenney.nl/assets/tiny-town and https://kenney.nl/assets/tiny-dungeon. License files are shipped alongside the atlases.

The existing Geist font is reused under the SIL Open Font License; its license is included. Gameplay, world composition, and synthesized audio are authored for this Ludoria release. The project does not add a new license to the owner's source code.
