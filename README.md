# Ludoria

A little world to get lost in. **The Wandering Valley** is a playable 2D pixel adventure written in JavaScript: explore a forest valley, meet its people, gather supplies, fight slimes, and rekindle three ancient beacons.

## Play locally

Node.js 22 or newer is recommended. The standalone game has no npm dependencies to install:

```sh
npm run dev:game
```

Open http://localhost:3000. Start your journey and speak to Rowan, just north of the village square.

| Control | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Shift | Sprint |
| E | Talk, collect berries, open chests, light beacons |
| Space / click world | Use the selected tool |
| 1–5 | Sword, axe, pickaxe, lantern, berries |
| M / J / I | Map, journal, inventory |
| Escape | Pause / close a panel |

Touch controls appear on touch devices. Progress saves on this device. Audio is off until you enable it.

## Test and build

```sh
npm run test:game
npm run build:game
```

Deploy `out/` to any static host. This output serves the game directly without framework JavaScript, external fonts, or CDN requests. The build verifies local modules and assets and enforces a 250 KiB uncompressed release budget.

## Existing workspace

The Next.js app embeds the same game. Its original monorepo structure and database workspace are retained for later expansion:

```sh
npm ci
npm run dev --workspace web
npm run build
```

The repo now uses the existing npm lockfile consistently; the stale Bun lockfile was removed. `npm run build` builds the workspace and then prepares the standalone game release.

See [docs/GAME.md](docs/GAME.md) for gameplay rules, architecture, resource choices, tests, and current limitations. This release is single-player; account and multiplayer services are not implemented.

## Credits

Game by Utsav Joshi. Pixel assets: [Kenney Tiny Town](https://kenney.nl/assets/tiny-town) and [Tiny Dungeon](https://kenney.nl/assets/tiny-dungeon), CC0. Geist by Vercel, SIL OFL 1.1. Asset licenses are included in the game distribution.
