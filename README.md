# Dead Letter Run

A small 3D game prototype built with React, Three.js, and Rapier. Explore the
relay field, activate the pylon, and reach the exit. Saves stay in your browser.

## Run

Install [Node.js 24](https://nodejs.org/) or newer, then:

```sh
npm install
npm run dev
```

Open the local URL printed in the terminal (usually http://localhost:5173),
then click **Start game**. No backend, credentials, pnpm, or build step required.

**Controls:** WASD move · Shift sprint · E interact · Esc pause.
**Continue** resumes your saved progress on the same browser and origin.

## Other commands

- `npm run build` — typecheck, validate assets, and build to `dist/`.
- `npm run preview` — serve the production build locally.
- `npm test` — run tests.
- `npm run check` — lint, tests, and production build.
- `npm run format` — format source and tests.

Deploy `dist/` to any static web host. No server process is needed in production.

## Code

```text
src/App.tsx       Menus and game session
src/game/         React canvas host
src/engine/       Rendering, physics, input, missions, audio, local saves
src/contracts/    Save, mission, and asset schemas
src/screens/      HUD and settings UI
public/           Scene manifest and assets
scripts/          Asset validation
tests/            Game, schema, and UI tests
```

The current scene uses procedural placeholder geometry; no model downloads are
needed. See [docs/assets.md](docs/assets.md) for asset notes.
