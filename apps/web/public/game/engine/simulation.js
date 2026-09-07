import { SPAWN, TILE, distance, isWalkable } from './world.js';
export const SAVE_KEY = 'ludoria.valley.v1';
export const TOOLS = ['Sword', 'Axe', 'Pickaxe', 'Lantern', 'Berries'];
export function createState() {
  return { version: 1, player: { ...SPAWN, health: 6, stamina: 100, facingX: 0, facingY: 1, walk: 0, moving: false, invincible: 0, attack: 0 }, inventory: { wood: 0, stone: 0, berries: 3, embers: 0 }, collected: new Set(), lit: new Set(), metRowan: false, won: false, tool: 0, time: 65, visited: new Set(['Greenhaven']), kills: 0, cooldown: 0 };
}
const integer = (n, fallback, max = 9999) => Number.isInteger(n) && n >= 0 && n <= max ? n : fallback;
/** Saved data is untrusted. Restore only known fields and valid world identities. */
export function restoreState(raw, world) {
  const state = createState();
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!data || data.version !== 1) return state;
    const p = data.player;
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y) && isWalkable(world, p.x, p.y)) { state.player.x = p.x; state.player.y = p.y; }
    state.player.health = Math.max(1, integer(p?.health, 6, 6));
    for (const key of Object.keys(state.inventory)) state.inventory[key] = integer(data.inventory?.[key], state.inventory[key]);
    const ids = new Set(world.resources.map(r => r.id));
    state.collected = new Set(Array.isArray(data.collected) ? data.collected.filter(id => ids.has(id)) : []);
    state.lit = new Set(Array.isArray(data.lit) ? data.lit.filter(id => world.beacons.some(b => b.id === id)) : []);
    state.metRowan = data.metRowan === true;
    state.won = data.won === true && state.lit.size === world.beacons.length;
    state.time = typeof data.time === 'number' && Number.isFinite(data.time) && data.time >= 0 && data.time < 1e9 ? data.time : 65;
    state.kills = integer(data.kills, 0);
    state.tool = integer(data.tool, 0, 4);
    state.visited = new Set(Array.isArray(data.visited) ? data.visited.filter(x => ['Greenhaven', 'Whispering Pines', 'Stillwater Shore', 'Mossheart Grove', 'The Wilds'].includes(x)) : ['Greenhaven']);
  } catch { /* A corrupt or outdated save never prevents a new adventure. */ }
  return state;
}
export function serializeState(state) {
  return JSON.stringify({ version: 1, player: { x: state.player.x, y: state.player.y, health: state.player.health }, inventory: state.inventory, collected: [...state.collected], lit: [...state.lit], metRowan: state.metRowan, won: state.won, time: state.time, visited: [...state.visited], kills: state.kills, tool: state.tool });
}
export function moveBody(body, x, y, world) {
  if (isWalkable(world, body.x + x, body.y)) body.x += x;
  if (isWalkable(world, body.x, body.y + y)) body.y += y;
}
export function update(state, world, input, dt, emit = () => {}) {
  const p = state.player;
  state.time += dt;
  state.cooldown = Math.max(0, state.cooldown - dt);
  p.invincible = Math.max(0, p.invincible - dt);
  p.attack = Math.max(0, p.attack - dt);
  let dx = input.x || 0, dy = input.y || 0;
  const length = Math.hypot(dx, dy);
  p.moving = length > 0;
  if (length) {
    dx /= length; dy /= length; p.facingX = dx; p.facingY = dy;
    const sprint = input.sprint && p.stamina > 1;
    const speed = sprint ? 88 : 55;
    moveBody(p, dx * speed * dt, dy * speed * dt, world);
    p.walk += speed * dt * .14;
    p.stamina = Math.max(0, Math.min(100, p.stamina + (sprint ? -33 : 16) * dt));
  } else p.stamina = Math.min(100, p.stamina + 28 * dt);
  for (const enemy of world.enemies) {
    if (enemy.hp <= 0) continue;
    const d = distance(enemy, p);
    // Sleeping enemies do no steering or collision work outside the active radius.
    if (d > 240) continue;
    enemy.cooldown = Math.max(0, enemy.cooldown - dt);
    const leash = Math.hypot(enemy.x - enemy.homeX, enemy.y - enemy.homeY);
    if (d < 100 && leash < 140) {
      moveBody(enemy, (p.x - enemy.x) / Math.max(d, 1) * 20 * dt, (p.y - enemy.y) / Math.max(d, 1) * 20 * dt, world);
    } else {
      const homeD = Math.hypot(enemy.homeX - enemy.x, enemy.homeY - enemy.y);
      if (homeD > 3) moveBody(enemy, (enemy.homeX - enemy.x) / homeD * 12 * dt, (enemy.homeY - enemy.y) / homeD * 12 * dt, world);
    }
    if (d < 11 && p.invincible === 0 && enemy.cooldown === 0) {
      p.health--; p.invincible = 1.3; enemy.cooldown = 1.5;
      emit({ type: 'hurt', x: p.x, y: p.y });
      if (p.health <= 0) {
        p.x = SPAWN.x; p.y = SPAWN.y; p.health = 6; p.stamina = 100; p.invincible = 3;
        emit({ type: 'respawn', message: 'Rowan found you in the wild. Rested, safe, and ready to try again.' });
      }
    }
  }
}
export function nearestInteraction(state, world) {
  const p = state.player;
  let best = null, range = 26;
  for (const item of [...world.npcs.map(n => ({ ...n, type: 'npc' })), ...world.beacons.map(b => ({ ...b, type: 'beacon' })), ...world.resources]) {
    if (state.collected.has(item.id) || item.type === 'log' || item.type === 'rock') continue;
    const d = distance(p, item);
    if (d < range) { best = item; range = d; }
  }
  return best;
}
export function interact(state, world) {
  const item = nearestInteraction(state, world);
  if (!item) return { type: 'notice', message: 'Get closer to someone or something to interact.' };
  if (item.type === 'npc') {
    if (item.id === 'rowan' && !state.metRowan) { state.metRowan = true; state.inventory.embers += 3; return { type: 'dialogue', id: 'rowan-first', item, changed: true }; }
    if (item.id === 'rowan' && state.lit.size === 3 && !state.won) { state.won = true; return { type: 'win', item, changed: true }; }
    return { type: 'dialogue', id: item.id, item };
  }
  if (item.type === 'beacon') {
    if (state.lit.has(item.id)) { state.player.health = 6; return { type: 'notice', message: `${item.name} burns bright. Your health is restored.`, changed: true }; }
    if (state.inventory.wood < 3 || state.inventory.stone < 2 || state.inventory.embers < 1) return { type: 'notice', message: `To light ${item.name}: 3 wood, 2 stone, and 1 ember. Rowan has the embers.` };
    state.inventory.wood -= 3; state.inventory.stone -= 2; state.inventory.embers--;
    state.lit.add(item.id); state.player.health = 6;
    return { type: 'beacon', x: item.x, y: item.y, message: `${item.name} is alight! ${state.lit.size === 3 ? 'Return to Rowan in Greenhaven.' : `${3 - state.lit.size} beacons remain.`}`, changed: true };
  }
  if (item.type === 'berry') { state.inventory.berries += 2; state.collected.add(item.id); return { type: 'gather', x: item.x, y: item.y, message: '+2 wild berries · Select 5, then Space to eat.', changed: true }; }
  if (item.type === 'chest') { state.inventory.wood += 3; state.inventory.stone += 2; state.inventory.berries += 2; state.collected.add(item.id); return { type: 'chest', x: item.x, y: item.y, message: 'A traveler’s cache! +3 wood, +2 stone, +2 berries.', changed: true }; }
  return null;
}
export function useTool(state, world) {
  if (state.cooldown > 0) return null;
  const p = state.player;
  if (state.tool === 4) {
    if (p.health === 6) return { type: 'notice', message: 'You are already at full health.' };
    if (!state.inventory.berries) return { type: 'notice', message: 'No berries left. Look for red berry bushes.' };
    state.inventory.berries--; p.health = Math.min(6, p.health + 2); state.cooldown = .4;
    return { type: 'heal', message: 'Sweet, wild, and just what you needed. +2 health.', changed: true };
  }
  if (state.tool === 3) return { type: 'notice', message: 'Your lantern lights the way while selected. Keep it close after sunset.' };
  state.cooldown = .3; p.attack = .22;
  if (state.tool === 0) {
    let hit = false;
    for (const enemy of world.enemies) if (enemy.hp > 0 && distance(p, enemy) < 27) {
      const dx = enemy.x - p.x, dy = enemy.y - p.y;
      if (dx * p.facingX + dy * p.facingY < -5) continue;
      enemy.hp--; hit = true;
      moveBody(enemy, p.facingX * 6, p.facingY * 6, world);
      if (enemy.hp === 0) { state.kills++; state.inventory.embers++; }
    }
    return { type: hit ? 'hit' : 'swing', x: p.x + p.facingX * 16, y: p.y + p.facingY * 16, message: hit ? 'A clean hit!' : undefined, changed: hit };
  }
  const wanted = state.tool === 1 ? 'log' : 'rock';
  let target = null, range = 28;
  for (const r of world.resources) if (!state.collected.has(r.id)) {
    const d = distance(p, r);
    if (r.type === wanted && d < range) { target = r; range = d; }
  }
  if (!target) return { type: 'swing', message: wanted === 'log' ? 'Use the axe near a fallen log to gather wood.' : 'Use the pickaxe near a gray rock to gather stone.' };
  state.collected.add(target.id); state.inventory[wanted === 'log' ? 'wood' : 'stone'] += 2;
  return { type: 'gather', x: target.x, y: target.y, message: wanted === 'log' ? '+2 wood' : '+2 stone', changed: true };
}
export function questText(state) {
  if (state.won) return 'The valley is yours to wander. Thank you, keeper.';
  if (!state.metRowan) return 'Speak to Rowan in the village.';
  if (state.lit.size === 3) return 'Return to Rowan in Greenhaven.';
  if (state.inventory.wood < 3 || state.inventory.stone < 2) return 'Gather wood and stone for the beacons.';
  return 'Follow the trails to the three beacons.';
}
