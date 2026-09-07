import { createWorld, regionAt, BEACONS, distance } from './engine/world.js';
import { createState, restoreState, serializeState, SAVE_KEY, TOOLS, update, interact, useTool, nearestInteraction, questText } from './engine/simulation.js';
import { Renderer, loadAssets, sprite } from './engine/renderer.js';
import { AudioSystem } from './engine/audio.js';

const $ = selector => document.querySelector(selector);
const world = createWorld();
let saved = null, storageAvailable = true;
try { saved = localStorage.getItem(SAVE_KEY); } catch { storageAvailable = false; }
let state = saved ? restoreState(saved, world) : createState();
let renderer, assets, playing = false, ready = false, dirty = false;
let previous = 0, accumulator = 0, raf = 0, lastUi = 0, lastSave = 0, lastRender = 0;
let region = regionAt(state.player.x, state.player.y), toastTimer, regionTimer;
const keys = new Set(), movementPointers = new Map(), audio = new AudioSystem();
const panel = $('#panel'), panelBody = $('#panel-body');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const FIXED_STEP = 1 / 60;
const ui = { health: -1, stamina: -1, tool: -1, quest: '', count: -1, time: '', prompt: '', berries: -1 };

function toast(message) {
  if (!message) return;
  clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3600);
}
function save(force = false) {
  if ((!dirty && !force) || !playing) return;
  try { localStorage.setItem(SAVE_KEY, serializeState(state)); dirty = false; storageAvailable = true; $('#save-status').textContent = 'ADVENTURE SAVED'; }
  catch { storageAvailable = false; $('#save-status').textContent = 'SAVING UNAVAILABLE'; }
}
function clearInput() { keys.clear(); movementPointers.clear(); }
function openPanel(title, kicker, html) {
  clearInput(); $('#panel-title').textContent = title; $('#panel-kicker').textContent = kicker;
  panelBody.innerHTML = html;
  if (!panel.open) panel.showModal();
  accumulator = 0;
}
function closePanel() { panel.close(); clearInput(); accumulator = 0; $('#world').focus({ preventScroll: true }); }
$('#panel-close').addEventListener('click', closePanel);
panel.addEventListener('cancel', event => { event.preventDefault(); closePanel(); });
panel.addEventListener('click', event => { if (event.target === panel) { const r = panel.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closePanel(); } });

function journal() {
  openPanel('A light in the wild', 'YOUR JOURNAL', `<p>The valley’s old beacons have fallen dark. Rowan has entrusted you with the last three embers. Follow the trails, gather supplies, and carry their light home.</p><div class="quest-row"><span>${state.metRowan ? '✓' : '◇'}</span><div><b>Meet the keeper</b><small>Speak to Rowan beside the Greenhaven square.</small></div></div>${BEACONS.map(b => `<div class="quest-row"><span>${state.lit.has(b.id) ? '✦' : '◇'}</span><div><b>${b.name} ${state.lit.has(b.id) ? '· Alight' : ''}</b><small>${b.hint}</small></div></div>`).join('')}<div class="quest-row"><span>${state.won ? '✓' : '◇'}</span><div><b>Bring the news home</b><small>Return to Rowan after lighting all three beacons.</small></div></div><p class="notice" style="margin-top:20px">Each beacon needs 3 wood, 2 stone, and 1 ember. Light a beacon with E. Their warmth also restores health.</p><div class="panel-buttons"><button class="secondary" id="journal-map">Open valley map</button></div>`);
  $('#journal-map').onclick = mapPanel;
}
function mapPanel() {
  openPanel('The Wandering Valley', 'YOUR MAP', '<canvas class="map-large" id="large-map" width="576" height="480" aria-label="World map showing Greenhaven in the center, Pinewatch to the northwest, Stillwater to the east, Mossheart to the south, and your current position."></canvas><div class="map-legend"><span>✚ You</span><span>◇ Unlit beacon</span><span>✦ Lit beacon</span></div><p class="notice" style="margin-top:14px">Pinewatch: northwest · Stillwater: east across the bridge · Mossheart: south. Pale trails connect all three.</p>');
  renderer.map($('#large-map'), state, true);
}
function inventory() {
  const entries = [['wood', 'Wood', 'Fallen logs · Axe + Space'], ['stone', 'Stone', 'Gray rocks · Pickaxe + Space'], ['berries', 'Wild berries', 'Restore 2 health · Select 5, then Space'], ['embers', 'Embers', 'A gift from Rowan. Also dropped by forest slimes.']];
  openPanel('Your satchel', 'TRAVEL LIGHT', `${entries.map(([key, label, help]) => `<div class="bag-row"><canvas data-item="${key}" width="20" height="20" aria-hidden="true"></canvas><div>${label}<div class="notice">${help}</div></div><b>${state.inventory[key]}</b></div>`).join('')}<p class="notice" style="margin-top:20px">Supplies stay with you if you fall in the wild. Progress is saved on this device${storageAvailable ? '.' : ' when browser storage is available.'}</p><div class="panel-buttons"><button class="secondary" id="eat-berry">Eat a berry</button></div>`);
  panelBody.querySelectorAll('[data-item]').forEach(canvas => drawIcon(canvas, canvas.dataset.item));
  $('#eat-berry').onclick = () => { const old = state.tool; state.tool = 4; state.cooldown = 0; handle(useTool(state, world)); state.tool = old; inventory(); refreshUi(); };
}
function controls() {
  const rows = [['WASD / ↑ ← ↓ →', 'Move'], ['Shift', 'Sprint'], ['E', 'Talk, collect, open, rekindle'], ['Space / Click world', 'Use selected tool'], ['1 — 5', 'Choose a tool'], ['M / J / I', 'Map / Journal / Bag'], ['Esc', 'Pause or close a panel']];
  openPanel('Make yourself at home', 'HOW TO PLAY', `${rows.map(([key, action]) => `<div class="control-row"><kbd>${key}</kbd><span>${action}</span></div>`).join('')}<p class="notice" style="margin-top:20px">On a touch screen, use the direction pad, E to interact, and Use for your selected tool. The valley is a solo adventure. Audio starts only when you turn it on.</p><h3>A few things to know</h3><p class="notice">Chop fallen logs for wood. Mine gray rocks for stone. Pick red berry bushes with E. Face slimes and swing your sword three times. Treasure chests hold useful supplies. There is no time limit.</p>`);
}
function pauseMenu() {
  if (!playing) return;
  save(true);
  openPanel('A moment of quiet', 'ADVENTURE PAUSED', `<p>Take your time. The valley will be here.</p><div class="panel-buttons"><button id="resume-game" class="primary">Keep wandering</button><button id="pause-controls" class="secondary">Controls</button><button id="save-game" class="secondary">Save adventure</button><button id="title-screen" class="secondary">Return to title</button></div><p class="notice" style="margin-top:22px">${storageAvailable ? 'Your progress is saved on this device.' : 'Your browser is blocking local saves. Keep this tab open to preserve your progress.'}</p>`);
  $('#resume-game').onclick = closePanel; $('#pause-controls').onclick = controls;
  $('#save-game').onclick = () => { save(true); toast(storageAvailable ? 'Your adventure is saved.' : 'This browser is blocking local saves.'); };
  $('#title-screen').onclick = () => { save(true); closePanel(); playing = false; document.body.classList.remove('playing'); $('#start-screen').hidden = false; $('#start').textContent = 'Continue your adventure'; $('#new-game').hidden = false; };
}
function credits() {
  openPanel('Small pixels. A whole valley.', 'CREDITS', '<p><b>Ludoria</b><br>A game by Utsav Joshi.</p><p>Pixel assets: <a href="https://kenney.nl/assets/tiny-town" target="_blank" rel="noopener noreferrer">Tiny Town</a> and <a href="https://kenney.nl/assets/tiny-dungeon" target="_blank" rel="noopener noreferrer">Tiny Dungeon</a> by Kenney, used under CC0.</p><p class="notice">Geist font by Vercel, licensed under SIL Open Font License 1.1. Sound is synthesized in your browser.</p><a href="https://github.com/utsavjosh1/ludoria" target="_blank" rel="noopener noreferrer">Ludoria on GitHub ↗</a>');
}
function dialogue(event) {
  const lines = {
    'rowan-first': ['“The light used to reach every corner of this valley. I think it still can.”', 'Take these three embers. Each beacon needs three pieces of wood and two stones to hold its flame. Start with the fallen logs west of the square and the rocks to the east. I left you a supply chest just northwest of here.', '+3 embers added to your satchel.'],
    rowan: ['“A little light goes a long way, wanderer.”', state.lit.size ? `You’ve rekindled ${state.lit.size} of the old beacons. Keep following the trails. Come back when all three are burning.` : 'Look for Pinewatch in the northwest, Stillwater beyond the eastern bridge, and Mossheart deep in the southern grove. Your map marks them all.', 'Tip: Treasure chests contain wood, stone, and berries.'],
    mira: ['“Everything out here has a use. Especially the things you almost walked past.”', 'The red bushes hold wild berries. Pick them with E, then select berries and use them when you need a little strength. And keep a lantern close after sundown.', 'Berries restore two hearts.'],
    finch: ['“The river takes its time. You should try it.”', 'Stillwater’s beacon is north of here. Take the trail along the eastern shore. You can only cross the river at the wooden bridge, so follow the path.', 'Tip: A lit beacon restores all your health.'],
  };
  const [quote, text, note] = lines[event.id];
  openPanel(event.item.name, event.item.role, `<div class="dialogue-quote">${quote}</div><p>${text}</p><p class="notice">${note}</p><div class="panel-buttons"><button class="primary" id="dialogue-done">${event.id === 'rowan-first' ? 'I’ll bring the light back' : 'See you on the trail'}</button></div>`);
  $('#dialogue-done').onclick = closePanel;
}
function handle(event) {
  if (!event) return;
  if (event.changed) { dirty = true; save(); }
  audio.play(event.type);
  if (event.x !== undefined) renderer.burst(event.x, event.y, event.type === 'hurt' ? '#e29986' : event.type === 'hit' ? '#b9ddb0' : '#f0d798', event.type === 'beacon' ? 40 : 10);
  if (event.type === 'dialogue') dialogue(event);
  else if (event.type === 'win') {
    openPanel('The valley glows again.', 'JOURNEY COMPLETE', '<div class="dialogue-quote">“I knew the light was still out there. Turns out it was walking around in you.”</div><p>Three beacons. One wandering soul. Greenhaven has its light back, and Rowan has a story worth telling.</p><p class="notice">Your completed adventure is saved. There are still quiet trails, hidden caches, and little corners of the valley to discover.</p><div class="panel-buttons"><button class="primary" id="keep-exploring">Keep exploring</button></div>');
    $('#keep-exploring').onclick = closePanel;
  } else toast(event.message);
  if (event.type === 'respawn') { renderer.snap(state); dirty = true; save(); }
  refreshUi();
}
function selectTool(index) { state.tool = index; dirty = true; refreshUi(); }
function drawIcon(canvas, item) {
  const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false; c.clearRect(0, 0, canvas.width, canvas.height);
  const icons = { Sword: ['dungeon', 104], Axe: ['town', 129], Pickaxe: ['town', 114], Lantern: ['town', 93], Berries: ['town', 29], wood: ['town', 106], stone: ['dungeon', 74], berries: ['town', 29], embers: ['town', 93] };
  const [atlas, id] = icons[item]; sprite(c, assets[atlas], id, 2, 2, 16);
}
function refreshUi() {
  if (!renderer) return;
  const p = state.player;
  if (ui.health !== p.health) { $('#hearts').innerHTML = '♥'.repeat(p.health) + `<span class="empty">${'♥'.repeat(6 - p.health)}</span>`; $('#hearts').setAttribute('aria-label', `${p.health} of 6 health`); ui.health = p.health; }
  const stamina = Math.round(p.stamina);
  if (ui.stamina !== stamina) { $('#stamina-fill').style.width = `${stamina}%`; ui.stamina = stamina; }
  if (ui.tool !== state.tool) { document.querySelectorAll('[data-tool]').forEach(button => { const active = Number(button.dataset.tool) === state.tool; button.classList.toggle('selected', active); button.setAttribute('aria-pressed', String(active)); }); ui.tool = state.tool; }
  const quest = questText(state);
  if (ui.quest !== quest) { $('#quest-summary').textContent = quest; ui.quest = quest; }
  if (ui.count !== state.lit.size) { $('#quest-fill').style.width = `${state.lit.size / 3 * 100}%`; $('#beacon-count').textContent = `${state.lit.size} / 3 BEACONS REKINDLED`; ui.count = state.lit.size; }
  if (ui.berries !== state.inventory.berries) { $('#berry-count').textContent = `Berries · ${state.inventory.berries}`; ui.berries = state.inventory.berries; }
  const day = Math.floor(state.time / 480) + 1, phase = state.time % 480;
  const time = `DAY ${day} · ${phase < 120 ? 'MORNING' : phase < 240 ? 'AFTERNOON' : phase < 340 ? 'DUSK' : 'NIGHT'}`;
  if (ui.time !== time) { $('#world-time').textContent = time; ui.time = time; }
  const nextRegion = regionAt(p.x, p.y);
  if (region !== nextRegion) {
    region = nextRegion; $('#region').textContent = region;
    if (!state.visited.has(region)) { state.visited.add(region); dirty = true; $('#region-toast span').textContent = region; $('#region-toast').hidden = false; clearTimeout(regionTimer); regionTimer = setTimeout(() => { $('#region-toast').hidden = true; }, 3000); }
  }
  const target = nearestInteraction(state, world);
  let prompt = target ? target.type === 'npc' ? `Talk to ${target.name}` : target.type === 'beacon' ? `${state.lit.has(target.id) ? 'Rest at' : 'Rekindle'} ${target.name}` : target.type === 'berry' ? 'Pick wild berries' : 'Open traveler’s cache' : '';
  if (!prompt && (state.tool === 1 || state.tool === 2)) {
    const resource = world.resources.find(r => r.type === (state.tool === 1 ? 'log' : 'rock') && !state.collected.has(r.id) && distance(p, r) < 28);
    if (resource) prompt = state.tool === 1 ? 'Gather wood' : 'Gather stone';
  }
  if (ui.prompt !== prompt) { $('#interact-prompt').hidden = !prompt || !playing; $('#interact-prompt span').textContent = prompt; $('#interact-prompt kbd').textContent = target ? 'E' : 'SPACE'; ui.prompt = prompt; }
  renderer.map($('#minimap'), state);
}
function startGame(fresh = false) {
  if (!ready) return;
  if (fresh) {
    state = createState(); for (const enemy of world.enemies) { enemy.x = enemy.homeX; enemy.y = enemy.homeY; enemy.hp = 3; enemy.cooldown = 0; }
    renderer.particles.length = 0; region = 'Greenhaven'; $('#region').textContent = region;
  }
  clearInput(); playing = true; $('#start-screen').hidden = true; document.body.classList.add('playing');
  renderer.snap(state); dirty = true; save(); ui.prompt = null; refreshUi(); $('#world').focus({ preventScroll: true });
  toast(state.metRowan ? 'Welcome back, wanderer.' : 'Welcome to Greenhaven. Rowan is waiting just north of you.');
}
$('#start').onclick = () => startGame();
$('#new-game').onclick = () => {
  openPanel('A new beginning?', 'START OVER', '<p>This will replace the adventure saved on this device.</p><div class="panel-buttons"><button class="secondary danger" id="confirm-new">Start a new adventure</button><button class="secondary" id="cancel-new">Keep this adventure</button></div>');
  $('#confirm-new').onclick = () => { closePanel(); startGame(true); }; $('#cancel-new').onclick = closePanel;
};
$('#quest-open').onclick = journal; $('#journal-open').onclick = journal; $('#minimap-open').onclick = mapPanel;
$('#inventory-open').onclick = inventory; $('#help-open').onclick = controls; $('#pause').onclick = pauseMenu; $('#credits-open').onclick = credits;
$('#sound').onclick = async () => { const enabled = await audio.toggle(); $('#sound').textContent = enabled ? '♫' : '♪'; $('#sound').setAttribute('aria-label', enabled ? 'Mute sound' : 'Enable sound'); $('#sound').setAttribute('aria-pressed', String(enabled)); toast(enabled ? 'Sound on. A little atmosphere for the road.' : 'Sound off.'); };
document.querySelectorAll('[data-tool]').forEach(button => button.onclick = () => selectTool(Number(button.dataset.tool)));
window.addEventListener('keydown', event => {
  if (event.code === 'Escape') { if (!panel.open) { event.preventDefault(); pauseMenu(); } return; }
  if (!playing || panel.open || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) event.preventDefault();
  keys.add(event.code);
  if (event.repeat) return;
  if (event.code === 'KeyE') handle(interact(state, world));
  if (event.code === 'Space') handle(useTool(state, world));
  if (event.code === 'KeyM') mapPanel();
  if (event.code === 'KeyJ') journal();
  if (event.code === 'KeyI') inventory();
  if (event.code === 'Slash') controls();
  if (/^Digit[1-5]$/.test(event.code)) selectTool(Number(event.code.slice(5)) - 1);
});
window.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', () => { clearInput(); save(); });
$('#world').addEventListener('pointerdown', event => { if (playing && !panel.open && event.pointerType !== 'touch') { $('#world').focus({ preventScroll: true }); handle(useTool(state, world)); } });
document.querySelectorAll('[data-move]').forEach(button => {
  button.addEventListener('pointerdown', event => { event.preventDefault(); button.setPointerCapture(event.pointerId); movementPointers.set(event.pointerId, button.dataset.move); });
  const release = event => movementPointers.delete(event.pointerId);
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
});
$('#touch-interact').onclick = () => { if (playing && !panel.open) handle(interact(state, world)); };
$('#touch-action').onclick = () => { if (playing && !panel.open) handle(useTool(state, world)); };
window.addEventListener('resize', () => { renderer?.resize(); renderer?.snap(state); });
window.addEventListener('pagehide', () => { save(true); clearInput(); cancelAnimationFrame(raf); audio.suspend(); });
window.addEventListener('pageshow', event => { if (event.persisted && ready) { previous = 0; raf = requestAnimationFrame(frame); } });
document.addEventListener('visibilitychange', () => {
  clearInput(); accumulator = 0;
  if (document.hidden) { save(); cancelAnimationFrame(raf); audio.suspend(); }
  else if (ready) { previous = 0; audio.resume(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
});
function frame(now) {
  if (document.hidden) return;
  const elapsed = previous ? Math.min((now - previous) / 1000, .1) : 0;
  previous = now;
  const active = playing && !panel.open;
  if (active) {
    accumulator += elapsed;
    const pressed = (...codes) => codes.some(code => keys.has(code));
    const touch = new Set(movementPointers.values());
    const input = { x: Number(pressed('KeyD', 'ArrowRight') || touch.has('right')) - Number(pressed('KeyA', 'ArrowLeft') || touch.has('left')), y: Number(pressed('KeyS', 'ArrowDown') || touch.has('down')) - Number(pressed('KeyW', 'ArrowUp') || touch.has('up')), sprint: pressed('ShiftLeft', 'ShiftRight') };
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps++ < 6) { update(state, world, input, FIXED_STEP, handle); accumulator -= FIXED_STEP; }
    if (steps >= 6) accumulator = 0;
    dirty = true;
    audio.ambient(state.time);
  } else { accumulator = 0; if (!playing && !panel.open) state.time += elapsed * .25; }
  if (now - lastRender >= (active ? 0 : 32)) { renderer.render(state, Math.min((now - lastRender) / 1000 || .016, .1), !playing, reducedMotion.matches); lastRender = now; }
  if (active && now - lastUi > 125) { refreshUi(); lastUi = now; }
  if (active && now - lastSave > 10000) { save(); lastSave = now; }
  raf = requestAnimationFrame(frame);
}
async function initialize() {
  try {
    assets = await loadAssets(); renderer = new Renderer($('#world'), world, assets); renderer.snap(state);
    document.querySelectorAll('[data-tool]').forEach(button => drawIcon(button.querySelector('canvas'), TOOLS[Number(button.dataset.tool)]));
    const portrait = $('#portrait').getContext('2d'); portrait.imageSmoothingEnabled = false; sprite(portrait, assets.dungeon, 97, 4, 4, 16);
    $('#region').textContent = region; refreshUi(); ready = true;
    $('#start').disabled = false; $('#start').onclick = () => startGame(); $('#start').textContent = saved ? 'Continue your adventure' : 'Begin your journey'; $('#new-game').hidden = !saved;
    raf = requestAnimationFrame(frame);
  } catch (error) {
    console.error('Ludoria failed to initialize:', error); $('#start').textContent = 'Try loading again'; $('#start').disabled = false;
    $('#start').onclick = () => { $('#start').disabled = true; $('#start').textContent = 'Preparing the valley…'; initialize(); };
    toast('The valley could not load. Check your connection, then try again.');
  }
}
initialize();
