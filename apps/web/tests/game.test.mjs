import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, TILE, WIDTH, HEIGHT, SPAWN, isWalkable, BEACONS } from '../public/game/engine/world.js';
import { createState, restoreState, serializeState, update, interact, useTool, questText } from '../public/game/engine/simulation.js';

test('world seed reproduces terrain, resources, and enemy placement', () => {
  const a = createWorld(), b = createWorld();
  assert.deepEqual(a.tiles, b.tiles); assert.deepEqual(a.resources, b.resources); assert.deepEqual(a.enemies, b.enemies);
  assert.notDeepEqual(a.trees, createWorld(42).trees);
});

function reachableCells(world) {
  const startX = Math.floor(SPAWN.x / TILE), startY = Math.floor(SPAWN.y / TILE);
  const seen = new Set([startY * WIDTH + startX]), queue = [[startX, startY]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, key = ny * WIDTH + nx;
      if (nx < 0 || ny < 0 || nx >= WIDTH || ny >= HEIGHT || seen.has(key)) continue;
      if (isWalkable(world, (nx + .5) * TILE, (ny + .5) * TILE)) { seen.add(key); queue.push([nx, ny]); }
    }
  }
  return seen;
}

test('all beacons, villagers, caches, and sufficient supplies are reachable from spawn', () => {
  const world = createWorld(), seen = reachableCells(world);
  const reachable = item => seen.has(Math.floor(item.y / TILE) * WIDTH + Math.floor(item.x / TILE));
  assert.ok(seen.size > 2500, 'the player can freely explore a substantial world');
  for (const item of [...world.beacons, ...world.npcs, ...world.resources.filter(r => r.type === 'chest')]) assert.ok(reachable(item), `${item.id} is reachable`);
  assert.ok(world.resources.filter(r => r.type === 'log' && reachable(r)).length >= 5);
  assert.ok(world.resources.filter(r => r.type === 'rock' && reachable(r)).length >= 3);
});

test('diagonal movement is normalized and sprint consumes bounded stamina', () => {
  const world = { tiles: new Uint8Array(WIDTH * HEIGHT), solid: new Uint8Array(WIDTH * HEIGHT), enemies: [] };
  const a = createState(), b = createState();
  for (let i = 0; i < 60; i++) { update(a, world, { x: 1, y: 0 }, 1 / 60); update(b, world, { x: 1, y: 1 }, 1 / 60); }
  assert.ok(Math.abs(Math.hypot(a.player.x - SPAWN.x, a.player.y - SPAWN.y) - Math.hypot(b.player.x - SPAWN.x, b.player.y - SPAWN.y)) < .001);
  update(a, world, { x: 1, y: 0, sprint: true }, .1);
  assert.ok(a.player.stamina < 100 && a.player.stamina >= 0);
});

test('solid terrain blocks movement while bridges remain passable', () => {
  const world = createWorld();
  assert.equal(isWalkable(world, 16, 16), false);
  assert.equal(isWalkable(world, 38.5 * TILE, 36.5 * TILE), false);
  const bridge = world.tiles.findIndex(t => t === 4);
  assert.ok(bridge > 0); assert.ok(isWalkable(world, (bridge % WIDTH + .5) * TILE, (Math.floor(bridge / WIDTH) + .5) * TILE));
  assert.equal(isWalkable(world, -100, -100), false);
});

test('gathering requires the right tool and cannot duplicate a collected resource', () => {
  const world = createWorld(), state = createState(), log = world.resources.find(r => r.id === 'starter-42-43');
  state.player.x = log.x; state.player.y = log.y;
  state.tool = 2; useTool(state, world); assert.equal(state.inventory.wood, 0);
  state.tool = 1; state.cooldown = 0; useTool(state, world); assert.equal(state.inventory.wood, 2); assert.ok(state.collected.has(log.id));
  // Isolate the exhausted log from other valid resources in tool range.
  world.resources = [log]; state.cooldown = 0; useTool(state, world); assert.equal(state.inventory.wood, 2);
});

test('a complete adventure gifts embers once, consumes supplies once, and ends at Rowan', () => {
  const world = createWorld(), state = createState(), rowan = world.npcs[0];
  Object.assign(state.player, { x: rowan.x, y: rowan.y });
  assert.equal(interact(state, world).id, 'rowan-first');
  assert.equal(state.inventory.embers, 3); interact(state, world); assert.equal(state.inventory.embers, 3);
  for (const chest of world.resources.filter(r => r.type === 'chest').slice(0, 3)) {
    Object.assign(state.player, { x: chest.x, y: chest.y }); assert.equal(interact(state, world).type, 'chest');
  }
  assert.equal(state.inventory.wood, 9); assert.equal(state.inventory.stone, 6);
  for (const beacon of world.beacons) {
    Object.assign(state.player, { x: beacon.x, y: beacon.y }); assert.equal(interact(state, world).type, 'beacon');
    const wood = state.inventory.wood; interact(state, world); assert.equal(state.inventory.wood, wood);
  }
  assert.equal(state.lit.size, 3); assert.equal(state.inventory.wood, 0); assert.equal(state.inventory.stone, 0); assert.equal(state.inventory.embers, 0);
  Object.assign(state.player, { x: rowan.x, y: rowan.y }); assert.equal(interact(state, world).type, 'win'); assert.ok(state.won);
  assert.match(questText(state), /yours to wander/);
});

test('beacons cannot be activated with insufficient inventory', () => {
  const world = createWorld(), state = createState();
  Object.assign(state.player, { x: BEACONS[0].x, y: BEACONS[0].y });
  assert.equal(interact(state, world).type, 'notice'); assert.equal(state.lit.size, 0); assert.equal(state.inventory.wood, 0);
});

test('combat respects direction, cooldown, defeat, and enemy drops', () => {
  const world = createWorld(), state = createState();
  const enemy = { id: 'test-slime', x: state.player.x + 16, y: state.player.y, hp: 3, homeX: state.player.x + 16, homeY: state.player.y, cooldown: 0 };
  world.enemies = [enemy]; state.player.facingX = -1; state.player.facingY = 0;
  useTool(state, world); assert.equal(enemy.hp, 3);
  state.player.facingX = 1;
  for (let i = 0; i < 3; i++) { enemy.x = state.player.x + 16; state.cooldown = 0; useTool(state, world); useTool(state, world); assert.equal(enemy.hp, 2 - i); }
  assert.equal(state.kills, 1); assert.equal(state.inventory.embers, 1);
  state.cooldown = 0; useTool(state, world); assert.equal(state.inventory.embers, 1);
});

test('eating heals without exceeding maximum or consuming berries unnecessarily', () => {
  const state = createState(), world = createWorld(); state.tool = 4;
  useTool(state, world); assert.equal(state.inventory.berries, 3);
  state.player.health = 5; useTool(state, world); assert.equal(state.player.health, 6); assert.equal(state.inventory.berries, 2);
});

test('defeat returns the player safely to the village without losing quest progress', () => {
  const state = createState(), world = createWorld(); state.player.health = 1; state.lit.add('pine'); state.inventory.wood = 8;
  world.enemies = [{ x: state.player.x, y: state.player.y, homeX: state.player.x, homeY: state.player.y, hp: 3, cooldown: 0 }];
  const events = []; update(state, world, {}, 1 / 60, event => events.push(event));
  assert.equal(state.player.health, 6); assert.equal(state.player.x, SPAWN.x); assert.ok(state.lit.has('pine')); assert.equal(state.inventory.wood, 8); assert.ok(events.some(e => e.type === 'respawn'));
});

test('save round-trip preserves progress and invalid saves never strand the player', () => {
  const world = createWorld(), state = createState(); state.lit.add('pine'); state.inventory.wood = 7; state.metRowan = true;
  state.collected.add(world.resources[0].id);
  const restored = restoreState(serializeState(state), world);
  assert.equal(restored.inventory.wood, 7); assert.deepEqual(restored.lit, state.lit); assert.deepEqual(restored.collected, state.collected);
  for (const invalid of ['oops', null, { version: 2 }, { version: 1, player: { x: Infinity, y: -9, health: -10 }, inventory: { wood: -500 }, lit: ['fake'], collected: ['fake'] }]) {
    const clean = restoreState(invalid, world); assert.ok(isWalkable(world, clean.player.x, clean.player.y)); assert.ok(clean.player.health > 0); assert.ok(clean.inventory.wood >= 0); assert.ok(!clean.lit.has('fake'));
  }
});
