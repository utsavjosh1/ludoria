/** Deterministic world data. Rendering and game rules share these coordinates. */
export const TILE = 16;
export const WIDTH = 96;
export const HEIGHT = 80;
export const SPAWN = { x: 44.5 * TILE, y: 43.5 * TILE };
export const BEACONS = [
  { id: 'pine', name: 'Pinewatch', x: 31.5 * TILE, y: 14.5 * TILE, hint: 'Follow the northern trail into the pines.' },
  { id: 'tide', name: 'Stillwater', x: 79.5 * TILE, y: 32.5 * TILE, hint: 'Cross the eastern bridge, then follow the shore.' },
  { id: 'moss', name: 'Mossheart', x: 34.5 * TILE, y: 65.5 * TILE, hint: 'Take the southern trail through the old grove.' },
];
export const NPCS = [
  { id: 'rowan', name: 'Rowan', role: 'Keeper of Greenhaven', sprite: 85, x: 44.5 * TILE, y: 40.5 * TILE },
  { id: 'mira', name: 'Mira', role: 'The wandering herbalist', sprite: 84, x: 24.5 * TILE, y: 28.5 * TILE },
  { id: 'finch', name: 'Finch', role: 'Fisher of Stillwater', sprite: 112, x: 72.5 * TILE, y: 48.5 * TILE },
];
export const BUILDINGS = [
  { x: 37, y: 35, w: 5, h: 4, roof: 'red' },
  { x: 48, y: 36, w: 4, h: 4, roof: 'blue' },
  { x: 38, y: 46, w: 4, h: 4, roof: 'blue' },
  { x: 50, y: 46, w: 5, h: 4, roof: 'red' },
  { x: 21, y: 23, w: 4, h: 4, roof: 'red' },
  { x: 73, y: 44, w: 4, h: 4, roof: 'blue' },
];
export function random(seed) {
  return () => { let t = seed += 0x6d2b79f5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function regionAt(x, y) {
  x /= TILE; y /= TILE;
  if (Math.hypot(x - 45, y - 43) < 14) return 'Greenhaven';
  if (x > 62) return 'Stillwater Shore';
  if (y < 31) return 'Whispering Pines';
  if (y > 54) return 'Mossheart Grove';
  return 'The Wilds';
}
export function createWorld(seed = 81642) {
  const rand = random(seed), tiles = new Uint8Array(WIDTH * HEIGHT), solid = new Uint8Array(WIDTH * HEIGHT);
  const trees = [], resources = [], enemies = [];
  const set = (x, y, value) => { if (x > 1 && y > 1 && x < WIDTH - 2 && y < HEIGHT - 2) tiles[y * WIDTH + x] = value; };
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    const riverX = 63 + Math.sin(y * .11) * 3;
    const lake = ((x - 65) / 10) ** 2 + ((y - 47) / 12) ** 2 < 1;
    const pond = ((x - 18) / 6) ** 2 + ((y - 51) / 5) ** 2 < 1;
    tiles[y * WIDTH + x] = Math.abs(x - riverX) < 2.4 || lake || pond || x < 2 || y < 2 || x > WIDTH - 3 || y > HEIGHT - 3 ? 2 : 0;
  }
  const path = (points, radius = 1) => {
    for (let i = 1; i < points.length; i++) {
      const [ax, ay] = points[i - 1], [bx, by] = points[i], steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 2;
      for (let j = 0; j <= steps; j++) {
        const x = Math.round(ax + (bx - ax) * j / steps), y = Math.round(ay + (by - ay) * j / steps);
        for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) set(x + dx, y + dy, tiles[(y + dy) * WIDTH + x + dx] === 2 ? 4 : 1);
      }
    }
  };
  path([[44, 51], [44, 43], [45, 34], [40, 29], [37, 23], [31, 20], [31, 14]]);
  path([[44, 42], [54, 42], [57, 37], [59, 32], [79, 32]]);
  path([[44, 48], [46, 55], [41, 60], [34, 62], [34, 65]]);
  path([[39, 29], [30, 28], [23, 28]]);
  path([[78, 32], [81, 39], [79, 47], [72, 49]]);
  path([[36, 42], [52, 42]]);
  for (let y = 40; y < 46; y++) for (let x = 42; x < 48; x++) set(x, y, 1);
  for (const b of BUILDINGS) {
    path([[b.x + 2, b.y + b.h], [b.x + 2, b.y + b.h + 2]], 0);
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) { set(x, y, 1); solid[y * WIDTH + x] = 1; }
  }
  const clearings = [...BEACONS.map(b => ({ x: b.x / TILE, y: b.y / TILE, r: 4 })), ...NPCS.map(n => ({ x: n.x / TILE, y: n.y / TILE, r: 3 })), { x: 45, y: 43, r: 4 }];
  for (const c of clearings) for (let y = Math.floor(c.y - c.r); y <= c.y + c.r; y++) for (let x = Math.floor(c.x - c.r); x <= c.x + c.r; x++) {
    if (Math.hypot(x - c.x, y - c.y) < c.r && !solid[y * WIDTH + x]) set(x, y, c.r === 4 ? 3 : 0);
  }
  for (let y = 3; y < HEIGHT - 3; y++) for (let x = 3; x < WIDTH - 3; x++) {
    const nearClearing = clearings.some(c => Math.hypot(x - c.x, y - c.y) < c.r + 1);
    const nearHouse = BUILDINGS.some(b => x >= b.x - 1 && x <= b.x + b.w + 1 && y >= b.y - 1 && y <= b.y + b.h + 2);
    const nearPath = [-1, 0, 1].some(dy => [-1, 0, 1].some(dx => [1, 3, 4].includes(tiles[(y + dy) * WIDTH + x + dx])));
    if (tiles[y * WIDTH + x] !== 0 || nearClearing || nearHouse || nearPath) continue;
    const p = rand();
    if (p < .20 && !solid[y * WIDTH + x - 1]) {
      trees.push({ id: `tree-${x}-${y}`, type: 'tree', x: (x + .5) * TILE, y: (y + .6) * TILE, style: rand() > .45 ? 0 : 1, tint: rand() });
      solid[y * WIDTH + x] = 1;
    } else if (p < .26) {
      const type = p < .224 ? 'log' : p < .247 ? 'rock' : 'berry';
      resources.push({ id: `${type}-${x}-${y}`, type, x: (x + .5) * TILE, y: (y + .5) * TILE });
    }
  }
  // Guaranteed starter supplies in reachable space immediately around the village.
  for (const [x, y, type] of [[42, 43, 'log'], [41, 43, 'log'], [48, 43, 'rock'], [49, 43, 'rock'], [46, 46, 'berry'], [47, 38, 'log']]) {
    solid[y * WIDTH + x] = 0;
    resources.push({ id: `starter-${x}-${y}`, type, x: (x + .5) * TILE, y: (y + .5) * TILE });
  }
  for (let i = 0; i < 26; i++) {
    let x, y, attempts = 0;
    do { x = 5 + Math.floor(rand() * (WIDTH - 10)); y = 5 + Math.floor(rand() * (HEIGHT - 10)); attempts++; }
    while (attempts < 100 && (solid[y * WIDTH + x] || tiles[y * WIDTH + x] === 2 || Math.hypot(x - 45, y - 43) < 16 || clearings.some(c => Math.hypot(x - c.x, y - c.y) < 4)));
    if (attempts < 100) enemies.push({ id: `slime-${i}`, x: (x + .5) * TILE, y: (y + .5) * TILE, homeX: (x + .5) * TILE, homeY: (y + .5) * TILE, hp: 3, phase: rand() * 6, cooldown: 0 });
  }
  for (const [i, x, y] of [[0, 41, 39], [1, 29, 17], [2, 78, 35], [3, 37, 64]]) resources.push({ id: `chest-${i}`, type: 'chest', x: (x + .5) * TILE, y: (y + .5) * TILE });
  return { seed, tiles, solid, trees, resources, enemies, beacons: BEACONS.map(b => ({ ...b })), npcs: NPCS, buildings: BUILDINGS };
}
export function isWalkable(world, x, y, radius = 4) {
  for (const dx of [-radius, radius]) for (const dy of [-radius, radius]) {
    const tx = Math.floor((x + dx) / TILE), ty = Math.floor((y + dy) / TILE);
    if (tx < 0 || ty < 0 || tx >= WIDTH || ty >= HEIGHT || world.tiles[ty * WIDTH + tx] === 2 || world.solid[ty * WIDTH + tx]) return false;
  }
  return true;
}
