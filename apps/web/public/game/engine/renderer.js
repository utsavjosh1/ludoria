import { TILE, WIDTH, HEIGHT } from './world.js';
const CHUNK = 16;
const PALETTE = ['#81b862', '#d9ac72', '#4b8d94', '#a3ac71', '#a6774e'];
const hash = (x, y) => { let n = Math.imul(x + 71, 374761393) ^ Math.imul(y + 127, 668265263); n = Math.imul(n ^ n >>> 13, 1274126177); return (n ^ n >>> 16) >>> 0; };
export function sprite(ctx, atlas, id, x, y, size = 16, flip = false) {
  if (flip) { ctx.save(); ctx.translate(Math.round(x) + size, Math.round(y)); ctx.scale(-1, 1); ctx.drawImage(atlas, id % 12 * 16, Math.floor(id / 12) * 16, 16, 16, 0, 0, size, size); ctx.restore(); }
  else ctx.drawImage(atlas, id % 12 * 16, Math.floor(id / 12) * 16, 16, 16, Math.round(x), Math.round(y), size, size);
}
export async function loadAssets() {
  const load = src => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error(`Could not load ${src}`)); img.src = src; });
  const [town, dungeon] = await Promise.all([load('./assets/town.png'), load('./assets/dungeon.png')]);
  return { town, dungeon };
}
export class Renderer {
  constructor(canvas, world, assets) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false }); this.world = world; this.assets = assets;
    this.camera = { x: 0, y: 0 }; this.chunks = new Map(); this.particles = []; this.drawables = [];
    this.decorBuckets = new Map(); this.lastMap = -1;
    for (const item of [...world.trees, ...world.buildings.map(b => ({ ...b, type: 'house', x: (b.x + b.w / 2) * TILE, y: (b.y + b.h) * TILE, tileX: b.x, tileY: b.y }))]) {
      const key = `${Math.floor(item.x / 256)},${Math.floor(item.y / 256)}`;
      if (!this.decorBuckets.has(key)) this.decorBuckets.set(key, []);
      this.decorBuckets.get(key).push(item);
    }
    this.baseMap = document.createElement('canvas'); this.baseMap.width = WIDTH; this.baseMap.height = HEIGHT;
    const mc = this.baseMap.getContext('2d');
    for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) { mc.fillStyle = PALETTE[world.tiles[y * WIDTH + x]]; mc.fillRect(x, y, 1, 1); }
    mc.fillStyle = '#47704a'; for (const tree of world.trees) mc.fillRect(Math.floor(tree.x / TILE), Math.floor(tree.y / TILE), 1, 1);
    mc.fillStyle = '#915c47'; for (const b of world.buildings) mc.fillRect(b.x, b.y, b.w, b.h);
    this.resize();
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    // Fixed pixel density, independent of DPR: a Retina display cannot quadruple our fill rate.
    const scale = Math.max(2, Math.min(4, Math.floor(rect.width / 440)));
    this.canvas.width = Math.max(160, Math.ceil(rect.width / scale));
    this.canvas.height = Math.max(120, Math.ceil(rect.height / scale));
    this.ctx.imageSmoothingEnabled = false;
  }
  terrainChunk(cx, cy) {
    const key = `${cx},${cy}`;
    if (this.chunks.has(key)) { const tile = this.chunks.get(key); this.chunks.delete(key); this.chunks.set(key, tile); return tile; }
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d', { alpha: false }); ctx.imageSmoothingEnabled = false;
    const { world, assets } = this;
    for (let y = 0; y < CHUNK; y++) for (let x = 0; x < CHUNK; x++) {
      const tx = cx * CHUNK + x, ty = cy * CHUNK + y, i = ty * WIDTH + tx;
      const terrain = world.tiles[i] ?? 2, px = x * TILE, py = y * TILE, n = hash(tx, ty);
      if (terrain === 2) {
        ctx.fillStyle = n % 5 === 0 ? '#488c91' : '#43898e'; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = '#82b7a1';
        if (tx > 0 && world.tiles[i - 1] !== 2) ctx.fillRect(px, py, 2, TILE);
        if (tx < WIDTH - 1 && world.tiles[i + 1] !== 2) ctx.fillRect(px + 14, py, 2, TILE);
        if (ty > 0 && world.tiles[i - WIDTH] !== 2) ctx.fillRect(px, py, TILE, 2);
        if (ty < HEIGHT - 1 && world.tiles[i + WIDTH] !== 2) ctx.fillRect(px, py + 14, TILE, 2);
      } else if (terrain === 4) {
        ctx.fillStyle = '#855c3e'; ctx.fillRect(px, py, 16, 16); ctx.fillStyle = '#b9915e';
        for (let a = 0; a < 4; a++) ctx.fillRect(px + 1, py + a * 4, 14, 3);
        ctx.fillStyle = '#62583a'; ctx.fillRect(px + 1, py + 1, 1, 1); ctx.fillRect(px + 14, py + 13, 1, 1);
      } else {
        sprite(ctx, assets.town, n % 47 === 0 ? 2 : n % 4 === 0 ? 1 : 0, px, py);
        if (terrain === 1 || terrain === 3) {
          const isPath = j => [1, 3, 4].includes(world.tiles[j]);
          const left = isPath(i - 1), right = isPath(i + 1), top = isPath(i - WIDTH), bottom = isPath(i + WIDTH);
          let id = 25;
          if (!top && !left) id = 12; else if (!top && !right) id = 14; else if (!bottom && !left) id = 36; else if (!bottom && !right) id = 38; else if (!top) id = 13; else if (!bottom) id = 37; else if (!left) id = 24; else if (!right) id = 26;
          sprite(ctx, assets.town, id, px, py);
          if (terrain === 3 && n % 4 === 0) sprite(ctx, assets.town, 43, px, py);
          if (n % 5 === 0) { ctx.fillStyle = '#bc996933'; ctx.fillRect(px + 3, py + 8, 3, 2); }
        } else if (n % 13 === 0) { ctx.fillStyle = '#60934a66'; ctx.fillRect(px + 6, py + 9, 1, 3); ctx.fillRect(px + 5, py + 8, 1, 2); ctx.fillRect(px + 8, py + 10, 1, 2); }
      }
    }
    // One static color grade per cached chunk gives the valley a cohesive, softer palette.
    ctx.fillStyle = '#1a443327'; ctx.fillRect(0, 0, 256, 256);
    this.chunks.set(key, canvas);
    if (this.chunks.size > 16) this.chunks.delete(this.chunks.keys().next().value);
    return canvas;
  }
  burst(x, y, color = '#edcf83', count = 12) {
    for (let i = 0; i < count && this.particles.length < 100; i++) this.particles.push({ x, y, vx: Math.sin(i * 2.4) * (14 + i), vy: Math.cos(i * 2.4) * 20 - 12, life: .7, color });
  }
  render(state, dt, menu = false, reducedMotion = false) {
    const { ctx, canvas, world, camera } = this, w = canvas.width, h = canvas.height, p = state.player;
    const targetX = p.x - w / 2 + (menu ? w * .17 : 0), targetY = p.y - h / 2;
    const smooth = reducedMotion ? 1 : 1 - Math.exp(-dt * 8);
    camera.x += (targetX - camera.x) * smooth; camera.y += (targetY - camera.y) * smooth;
    camera.x = Math.max(0, Math.min(WIDTH * TILE - w, camera.x)); camera.y = Math.max(0, Math.min(HEIGHT * TILE - h, camera.y));
    const ox = Math.floor(camera.x), oy = Math.floor(camera.y);
    ctx.fillStyle = '#41848b'; ctx.fillRect(0, 0, w, h); ctx.save(); ctx.translate(-ox, -oy);
    const cx0 = Math.floor(ox / 256), cy0 = Math.floor(oy / 256), cx1 = Math.floor((ox + w) / 256), cy1 = Math.floor((oy + h) / 256);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) ctx.drawImage(this.terrainChunk(cx, cy), cx * 256, cy * 256);
    const visible = (item, pad = 48) => item.x > ox - pad && item.x < ox + w + pad && item.y > oy - pad && item.y < oy + h + pad;
    const t = state.time;
    // Animate only water inside the viewport, in sparse 3-tile intervals.
    ctx.fillStyle = '#c2e4ba50';
    for (let ty = Math.floor(oy / 48) * 3; ty < (oy + h) / 16; ty += 3) for (let tx = Math.floor(ox / 48) * 3; tx < (ox + w) / 16; tx += 3) {
      if (world.tiles[ty * WIDTH + tx] === 2) { const n = hash(tx, ty); const ripple = reducedMotion ? 0 : Math.floor(Math.sin(t * 1.3 + n) * 2); ctx.fillRect(tx * 16 + n % 9 + ripple, ty * 16 + 8, 5, 1); ctx.fillRect(tx * 16 + n % 9 + 4 + ripple, ty * 16 + 11, 2, 1); }
    }
    this.drawables.length = 0;
    for (let cy = cy0 - 1; cy <= cy1 + 1; cy++) for (let cx = cx0 - 1; cx <= cx1 + 1; cx++) for (const item of this.decorBuckets.get(`${cx},${cy}`) || []) if (visible(item, 80)) this.drawables.push(item);
    for (const item of world.resources) if (visible(item) && !state.collected.has(item.id)) this.drawables.push(item);
    for (const item of world.beacons) if (visible(item)) this.drawables.push({ ...item, type: 'beacon' });
    for (const item of world.npcs) if (visible(item)) this.drawables.push({ ...item, type: 'npc' });
    for (const item of world.enemies) if (item.hp > 0 && visible(item)) this.drawables.push({ ...item, type: 'slime' });
    this.drawables.push({ ...p, type: 'player' });
    this.drawables.sort((a, b) => a.y - b.y);
    for (const item of this.drawables) this.draw(item, state, reducedMotion);
    // A campfire marks the safe village center.
    this.fire(46.5 * TILE, 42.5 * TILE, t, .8, reducedMotion);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const a = this.particles[i]; a.life -= dt;
      if (a.life <= 0) { this.particles[i] = this.particles[this.particles.length - 1]; this.particles.pop(); continue; }
      if (!reducedMotion) { a.x += a.vx * dt; a.y += a.vy * dt; a.vy += 40 * dt; }
      ctx.globalAlpha = Math.min(1, a.life * 2); ctx.fillStyle = a.color; ctx.fillRect(Math.floor(a.x), Math.floor(a.y), 2, 2);
    }
    ctx.globalAlpha = 1;
    // Ambient insects and drifting leaves use deterministic phases, with no per-frame allocation.
    if (!reducedMotion) for (let i = 0; i < 26; i++) {
      const ax = ox + ((i * 73 + Math.sin(t * .12 + i) * 25 + w) % w), ay = oy + ((i * 47 + t * (i % 2 ? 1 : -1) * 2 + h * 100) % h);
      ctx.globalAlpha = .22 + Math.sin(t * 1.6 + i) ** 2 * .3; ctx.fillStyle = i % 3 ? '#e9df9a' : '#c0d099'; ctx.fillRect(Math.floor(ax), Math.floor(ay), i % 3 ? 1 : 2, 1);
    }
    ctx.globalAlpha = 1; ctx.restore();
    const dayPhase = (state.time % 480) / 480;
    const darkness = Math.max(0, Math.sin((dayPhase - .5) * Math.PI * 2)) * .34;
    if (darkness > .01) {
      ctx.fillStyle = `rgba(15,24,61,${darkness})`; ctx.fillRect(0, 0, w, h);
      if (state.tool === 3) { const light = ctx.createRadialGradient(p.x - ox, p.y - oy, 3, p.x - ox, p.y - oy, 62); light.addColorStop(0, '#f4d38539'); light.addColorStop(1, '#f4d38500'); ctx.fillStyle = light; ctx.fillRect(p.x - ox - 62, p.y - oy - 62, 124, 124); }
    }
  }
  shadow(x, y, width = 12, height = 4) { const c = this.ctx; c.fillStyle = '#193b3644'; c.fillRect(Math.floor(x - width / 2), Math.floor(y), width, height); }
  draw(item, state, reduced) {
    const c = this.ctx, { town, dungeon } = this.assets, { x, y } = item, t = state.time;
    if (item.type === 'house') {
      const px = item.tileX * TILE, py = item.tileY * TILE;
      c.fillStyle = '#183a3555'; c.fillRect(px + 4, py + 7, item.w * 16 + 4, item.h * 16 - 3);
      for (let ry = 0; ry < item.h; ry++) for (let rx = 0; rx < item.w; rx++) {
        const edge = rx === 0 ? 0 : rx === item.w - 1 ? 2 : 1;
        let id = (ry === 0 ? 52 : ry === 1 ? 64 : 72) + edge;
        if (ry < 2 && item.roof === 'blue') id -= 4;
        if (ry === item.h - 1 && rx === Math.floor(item.w / 2)) id = 85;
        else if (ry === item.h - 1 && rx % 2 === 0 && rx > 0) id = 84;
        sprite(c, town, id, px + rx * 16, py + ry * 16);
      }
      // Chimney and a few small smoke pixels.
      c.fillStyle = '#695f5b'; c.fillRect(px + 12, py - 5, 5, 12); c.fillStyle = '#8b8981'; c.fillRect(px + 11, py - 6, 7, 3);
      if (!reduced) for (let i = 0; i < 3; i++) { const rise = (t * 6 + i * 8) % 26; c.globalAlpha = (1 - rise / 26) * .2; c.fillStyle = '#dde4ce'; c.fillRect(px + 13 + Math.floor(Math.sin(rise * .2 + t) * 3), py - 7 - rise, 4, 3); }
      c.globalAlpha = 1; return;
    }
    if (item.type === 'tree') {
      this.shadow(x + 4, y - 1, 22, 6);
      // Feet remain visible behind a canopy when the player steps beneath it.
      const behind = Math.abs(state.player.x - x) < 21 && state.player.y < y && state.player.y > y - 32;
      c.globalAlpha = behind ? .48 : 1;
      if (item.style === 0) for (let ry = 0; ry < 2; ry++) for (let rx = 0; rx < 3; rx++) sprite(c, town, (ry ? 30 : 18) + rx, x - 24 + rx * 16, y - 27 + ry * 16);
      else { sprite(c, town, 4, x - 8, y - 27); sprite(c, town, 16, x - 8, y - 11); }
      c.globalAlpha = 1; return;
    }
    if (item.type === 'log') { this.shadow(x, y, 15, 3); sprite(c, town, 106, x - 8, y - 9); return; }
    if (item.type === 'rock') { this.shadow(x, y, 12, 3); sprite(c, dungeon, 74, x - 8, y - 10); return; }
    if (item.type === 'berry') { this.shadow(x, y, 15, 4); sprite(c, town, 5, x - 8, y - 13); c.fillStyle = '#ed867d'; for (const [a, b] of [[-4, -8], [2, -6], [-1, -11]]) c.fillRect(Math.floor(x + a), Math.floor(y + b), 2, 2); return; }
    if (item.type === 'chest') { this.shadow(x, y, 13, 3); sprite(c, dungeon, 89, x - 8, y - 12); c.fillStyle = '#f1d788'; c.fillRect(x - 1, y - 18 + (reduced ? 0 : Math.round(Math.sin(t * 2) * 2)), 2, 2); return; }
    if (item.type === 'beacon') {
      this.shadow(x, y, 22, 5); sprite(c, dungeon, 31, x - 8, y - 7); sprite(c, dungeon, 7, x - 8, y - 21);
      if (state.lit.has(item.id)) this.fire(x, y - 17, t, 1, reduced);
      else { c.fillStyle = '#bbd6bc'; c.globalAlpha = .5 + Math.sin(t * 2) * .15; c.fillRect(x - 1, y - 17, 2, 3); c.globalAlpha = 1; }
      return;
    }
    const bob = reduced ? 0 : item.type === 'player' ? (item.moving ? Math.round(Math.sin(item.walk) * 1) : 0) : Math.round(Math.sin(t * 2 + x) * .5);
    this.shadow(x, y, 10, 3);
    if (item.type === 'slime') {
      const hop = reduced ? 0 : Math.max(0, Math.sin(t * 4 + item.phase) * 3);
      sprite(c, dungeon, 108, x - 8, y - 13 - hop);
      if (item.hp < 3) { c.fillStyle = '#223b39'; c.fillRect(x - 6, y - 20 - hop, 12, 2); c.fillStyle = '#e2a585'; c.fillRect(x - 6, y - 20 - hop, item.hp * 4, 2); }
      return;
    }
    if (item.type === 'npc') {
      sprite(c, dungeon, item.sprite, x - 8, y - 14 + bob);
      if (item.id === 'rowan' && (!state.metRowan || state.lit.size === 3 && !state.won)) { c.fillStyle = '#f3d27f'; c.font = 'bold 12px monospace'; c.textAlign = 'center'; c.fillText('!', x, y - 21 + bob); }
      return;
    }
    if (item.type === 'player') {
      c.globalAlpha = item.invincible > 0 && Math.floor(item.invincible * 12) % 2 ? .4 : 1;
      sprite(c, dungeon, 97, x - 8, y - 14 + bob, 16, item.facingX < 0);
      // A warm scarf gives Ludoria's wanderer a distinct silhouette.
      c.fillStyle = '#e4b675'; c.fillRect(Math.floor(x - 3), Math.floor(y - 7 + bob), 6, 2);
      c.globalAlpha = 1;
      if (state.tool === 3) { sprite(c, town, 93, x + 5, y - 9 + bob, 10); c.fillStyle = '#fff0ad'; c.fillRect(x + 9, y - 6 + bob, 1, 2); }
      if (item.attack > 0) {
        const angle = Math.atan2(item.facingY, item.facingX) - .8 + (1 - item.attack / .22) * 1.6;
        c.save(); c.translate(x, y - 5); c.rotate(angle + Math.PI / 2);
        sprite(c, state.tool === 0 ? dungeon : town, state.tool === 0 ? 104 : state.tool === 1 ? 129 : 114, -8, -23); c.restore();
        c.strokeStyle = '#f5edbaaa'; c.lineWidth = 2; c.beginPath(); c.arc(x, y - 4, 18, angle - .4, angle + .4); c.stroke();
      }
    }
  }
  fire(x, y, t, scale, reduced) {
    const c = this.ctx, f = reduced ? 0 : Math.floor(Math.sin(t * 11 + x) * 1.5);
    c.fillStyle = '#533f2e'; c.fillRect(x - 6 * scale, y + 2, 12 * scale, 3);
    c.fillStyle = '#dc8951'; c.fillRect(x - 4 * scale, y - 5, 8 * scale, 9); c.fillRect(x - 2 * scale + f, y - 9, 4 * scale, 5);
    c.fillStyle = '#f3c370'; c.fillRect(x - 2 * scale, y - 4 + f, 4 * scale, 7); c.fillStyle = '#fff0b5'; c.fillRect(x - 1, y, 2, 3);
    if (!reduced) { c.fillStyle = '#f7d88988'; c.fillRect(x + 3, y - 12 - (t * 7 % 9), 1, 1); }
  }
  map(canvas, state, large = false) {
    const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false;
    c.drawImage(this.baseMap, 0, 0, canvas.width, canvas.height);
    const sx = canvas.width / WIDTH / TILE, sy = canvas.height / HEIGHT / TILE;
    const dot = large ? 5 : 3;
    for (const b of this.world.beacons) { c.fillStyle = state.lit.has(b.id) ? '#ffe9a4' : '#192e37'; c.fillRect(Math.floor(b.x * sx) - dot, Math.floor(b.y * sy) - dot, dot * 2 + 1, dot * 2 + 1); c.fillStyle = state.lit.has(b.id) ? '#f2c965' : '#e3d49d'; c.fillRect(Math.floor(b.x * sx) - dot + 1, Math.floor(b.y * sy) - dot + 1, dot * 2 - 1, dot * 2 - 1); }
    c.fillStyle = '#f0bba6'; c.fillRect(44.5 * TILE * sx - 2, 40.5 * TILE * sy - 2, 4, 4);
    const px = Math.floor(state.player.x * sx), py = Math.floor(state.player.y * sy);
    c.fillStyle = '#183430'; c.fillRect(px - 3, py - 3, 7, 7); c.fillStyle = '#fff8dd'; c.fillRect(px - 1, py - 2, 3, 5); c.fillRect(px - 2, py - 1, 5, 3);
    if (large) {
      c.font = '12px system-ui'; c.textAlign = 'center'; c.fillStyle = '#fff2d2'; c.strokeStyle = '#203829'; c.lineWidth = 3;
      for (const b of [...this.world.beacons, { name: 'Greenhaven', x: 44.5 * TILE, y: 42.5 * TILE }]) { const x = b.x * sx, y = b.y * sy + 20; c.strokeText(b.name, x, y); c.fillText(b.name, x, y); }
    }
  }
  snap(state) { this.camera.x = state.player.x - this.canvas.width / 2; this.camera.y = state.player.y - this.canvas.height / 2; }
}
