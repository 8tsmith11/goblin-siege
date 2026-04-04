'use strict';
import { bus } from './bus.js';
import { getP, freeP, freeBeam } from './pool.js';
import { updateProjectiles } from './projectiles.js';
import { dropItem } from './resources.js';
import { buildPath } from './path.js';

bus.on('enemyDeath', e => {
  state._kills = (state._kills || 0) + 1;
  let rew = e.rew;
  state.gold += rew; sfxKill();
  for (let j = 0; j < (e.boss ? 18 : 6); j++) {
     let p = getP(); p.x = e.x * state.CELL + state.CELL / 2; p.y = e.y * state.CELL + state.CELL / 2;
     p.vx = (Math.random() - 0.5) * (e.boss ? 7 : 4); p.vy = (Math.random() - 0.5) * (e.boss ? 7 : 4);
     p.life = e.boss ? 28 : 16; p.clr = e.clr; p.sz = e.boss ? 4 : 2.5; state.particles.push(p);
  }
  mkF(e.x * state.CELL + state.CELL / 2, e.y * state.CELL + state.CELL / 2 - 12, '+' + rew, '#fbbf24');
  if (e.drops) {
    const cx = Math.max(0, Math.min(state.COLS - 1, Math.round(e.x)));
    const cy = Math.max(0, Math.min(state.ROWS - 1, Math.round(e.y)));
    for (const drop of e.drops) {
      if (Math.random() < drop.chance) dropItem(cx, cy, drop.type);
    }
  }
  
  // Dust Collection (Lab)
  const lab = state.towers.find(t => t.type === 'lab');
  if (lab && state.resources) {
    const dist = Math.hypot(e.x - lab.x, e.y - lab.y);
    if (dist <= lab.obsRange) {
      let dustYield = e.boss ? 5 : Math.floor(rew / 4);
      if (dustYield > 0) {
        state.resources.dust = (state.resources.dust || 0) + dustYield;
        mkGain(e.x * state.CELL + state.CELL / 2, e.y * state.CELL + state.CELL / 2, '🔮', dustYield, '#a855f7');
      }
    }
  }
});
import { buildResearchGraph, tickResearch } from './research.js';
import { tickCraft, updateTraps, cleanupBarricades } from './craft.js';
import { addFeed, clearFeed } from './feed.js';
import { getScribeEntry } from './bestiary.js';
import { TOWER_SKILLS, HOARD_LEVELS } from './data.js';
import { updateEnemies, genWave } from './enemies.js';
import { updateTowers } from './towers.js';
import { updateClam, updateClown, updateRobot, updateBees, updateFactoryLaser } from './support.js';
import { updateMonkeys } from './monkeys.js';
import { render, invalidateBg } from './render.js';
import { triggerEvent } from './events.js';
import { sfxBoss, sfxWave, sfxKill, sfxHit } from './audio.js';
import { hudU, showOv, hideOv, showBanner, showBL, panelU, hideTT, mkF, mkGain, initTabs, showWelcome, initBestiaryUI, initResearchUI, refreshResearch, initInventoryUI, initCraftUI } from './ui.js';
import { initInput, updateCameraKeys } from './input.js';
import { autoSave, clearSave, exportSave, initSaveUI, hasSave, loadGame } from './save.js';
import { placeNodes, updateNodes } from './resources.js';
import { placeNpcs, initNpcUI, updateNpcBubble } from './npc.js';
import { initWeather, tickWeather, updateWeather } from './weather.js';

export const VERSION = 'v1.4';
export const WORLD_COLS = 20;
export const WORLD_ROWS = 12;
export const PAD = 6; // forest border width in tiles

// Unified grid accessors — inner game coords (0-based) map to the full grid via PAD offset.
// Use these everywhere instead of state.grid[y + PAD][x + PAD].
export function getCell(x, y) { return state.grid[y + PAD]?.[x + PAD] ?? null; }
export function setCell(x, y, updates) {
  const cell = state.grid[y + PAD]?.[x + PAD];
  if (cell) Object.assign(cell, updates);
}

// ─── Protected state internals ───────────────────────────────────────────────
// _gg/_ll: actual gold / lives stored in module scope.
// Writes are gated by _φ; any external assignment to state.gold etc. is dropped.
let _gg = 100, _ll = 20, _φ = false;
let _ηG = (_gg * 0x9E3779B9) >>> 16; // integrity markers — updated alongside every write
let _ηL = (_ll * 0xC2B2AE35) >>> 16;
function _wG(v) { _gg = v | 0; _ηG = (_gg * 0x9E3779B9) >>> 16; }
function _wL(v) { _ll = Math.max(0, v | 0); _ηL = (_ll * 0xC2B2AE35) >>> 16; }
// Trusted write executor — pass a fn that may read/write gold/lives
export function _ΨΔ(fn) { const p = _φ; _φ = true; try { fn(); } finally { _φ = p; } }

/* ═══ Shared game state ═══ */
export const state = {
  wave: 0, phase: 'idle', ticks: 0, prepTicks: 0,
  enemies: [], towers: [], projectiles: [], particles: [], beams: [], bees: [],
  spawnQueue: [], spawnTimer: 0,
  nodes: [], resources: {},
  npcs: [], firedTriggerLines: new Set(),
  weather: { id: 'clear', wavesLeft: 1 },
  research: null, researchUnlocks: {},
  traps: [],
  inventory: { artifacts: [], augments: [], blueprints: [], consumables: [], equipped: [null, null, null] },
  unlockedTowers: new Set(['squirrel', 'lion', 'penguin', 'lab', 'workbench']),
  sel: null, tab: 'towers',
  bSen: new Set(['sleepy_door']),
  volcanoActive: null, freezeActive: 0,
  age: 'stone', paused: false,
  gameOver: false, started: false,
  ttTower: null,
  W: 0, H: 0, CELL: 0, COLS: 0, ROWS: 0, pathReady: false,
  cam: { panX: 0, panY: 0, zoom: 1, targetZoom: 1, focalX: 0, focalY: 0, focalSx: 0, focalSy: 0 },
  cv: null, cx: null,
  path: [], pathSet: new Set(), grid: [],
  gCell: null,
  _Σ: 0, _Ω: 0,  // frame consistency markers (internal use)
};
// Protected accessors — console writes are silently discarded
Object.defineProperties(state, {
  gold:  { get: () => _gg, set: v => { if (_φ) _wG(v); }, enumerable: true },
  lives: { get: () => _ll, set: v => { if (_φ) _wL(v); }, enumerable: true },
});

/* ═══ Canvas ═══ */
const cv = document.getElementById('cv');
const cx = cv.getContext('2d');
state.cv = cv; state.cx = cx;

export function measure() {
  const gc = document.getElementById('gc');
  const cv = document.getElementById('cv');
  const hud = document.getElementById('hud');
  const bp = document.getElementById('bp');
  if (!gc || !cv || !hud || !bp) return false;
  const oldW = state.W, oldH = state.H, oldCELL = state.CELL;
  state.W = cv.width = gc.clientWidth - (document.getElementById('feed')?.offsetWidth || 0);
  state.H = cv.height = gc.clientHeight - (hud.offsetHeight || 0) - (bp.offsetHeight || 0);
  state.COLS = WORLD_COLS;
  state.ROWS = WORLD_ROWS;
  state.CELL = Math.floor(Math.min(state.W / WORLD_COLS, state.H / WORLD_ROWS));
  if (state.CELL < 18) state.CELL = 18;
  if (oldCELL > 0 && state.CELL !== oldCELL) {
    const ratio = state.CELL / oldCELL;
    state.cam.panX *= ratio;
    state.cam.panY *= ratio;
  }
  return state.W !== oldW || state.H !== oldH;
}

export function clampCam() {
  const { cam, CELL, W, H } = state;
  const worldW = WORLD_COLS * CELL, worldH = WORLD_ROWS * CELL;
  const pad = PAD * CELL;
  const viewW = W / cam.zoom, viewH = H / cam.zoom;
  cam.panX = viewW >= worldW ? -(viewW - worldW) / 2 : Math.max(-pad, Math.min(cam.panX, worldW + pad - viewW));
  cam.panY = viewH >= worldH ? -(viewH - worldH) / 2 : Math.max(-pad, Math.min(cam.panY, worldH + pad - viewH));
}

export function minZoom() {
  const { CELL, W, H } = state;
  const worldW = WORLD_COLS * CELL, worldH = WORLD_ROWS * CELL;
  return Math.min(W / worldW, H / worldH);
}

export function initSz() {
  measure();
  if (!state.pathReady || !state.grid || !state.grid.length) {
    buildPath();
    state.pathReady = true;
    placeNodes();
    placeNpcs();
  }
  clampCam();
}

window.addEventListener('resize', () => { measure(); clampCam(); invalidateBg(); });

export function fIncome() {
  let t = 0;
  state.towers.forEach(tw => {
    if (tw.type === 'hoard') { /* No passive income per user request */ }
  });
  return t;
}
state.fIncome = fIncome;

/* ═══ Update ═══ */
function update() {
  if (!state.started || state.gameOver || state.paused) return;
  _φ = true;
  state.ticks++;

  // Prep phase countdown
  if (state.phase === 'prep') {
    state.prepTicks--;
    if (state.prepTicks <= 0) { startWave(); }
    else if (state.ticks % 60 === 0) { _φ = false; hudU(); _φ = true; } // Temporarily flip φ if needed for hud
  }

  updateNodes();
  updateWeather();
  if (state.freezeActive > 0) state.freezeActive--;

  // Spawn
  if (state.spawnQueue.length > 0) {
    state.spawnTimer--;
    if (state.spawnTimer <= 0) {
      const e = state.spawnQueue.shift();
      e.x = state.path[0].x; e.y = state.path[0].y; e.pi = 0;
      state.enemies.push(e);
      if (e.boss) { sfxBoss(); showBL(e.line); }
      state.spawnTimer = Math.max(8, 28 - state.wave * 0.6);
    }
  }

  updateTraps();
  updateEnemies();

  // Volcano
  if (state.volcanoActive) {
    if (state.ticks % 10 === 0) {
      const vd = 6 + state.wave * 2;
      state.enemies.forEach(e => { if (!e.dead && Math.hypot(e.x - state.volcanoActive.x, e.y - state.volcanoActive.y) < 3) e.hp -= vd; });
    }
    if (state.ticks % 3 === 0) {
      const vx = state.volcanoActive.x * state.CELL + state.CELL / 2, vy = state.volcanoActive.y * state.CELL + state.CELL / 2;
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * Math.PI * 2;
        state.particles.push({ x: vx + Math.cos(a) * state.CELL * 2, y: vy + Math.sin(a) * state.CELL * 2, vx: Math.cos(a) * 0.4, vy: -1.5 - Math.random(), life: 16, clr: Math.random() > 0.5 ? '#ef4444' : '#f97316', sz: 2 + Math.random() * 3 });
      }
    }
  }

  updateClam(); updateClown(); updateRobot(); updateBees(); updateMonkeys(); updateTowers();
  updateProjectiles();

  // Kill check
  for (const e of state.enemies) {
    if (!e.dead && e.hp <= 0) {
      e.dead = true;
      bus.emit('enemyDeath', e);
    }
  }
  state.enemies = state.enemies.filter(e => !e.dead);
  for (let i = state.beams.length - 1; i >= 0; i--) {
    const b = state.beams[i]; b.life--;
    if (b.life <= 0) { freeBeam(b); state.beams.splice(i, 1); }
  }
  state.bees = state.bees.filter(b => !b.dead);
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.03; p.life--;
    if (p.life <= 0) { freeP(p); state.particles.splice(i, 1); }
  }

  if (state.lives <= 0) {
    state.lives = 0; state.gameOver = true;
    _φ = false;
    showOv('💀 Game Over', 'Survived ' + state.wave + ' waves!', 'Retry', true); return;
  }

  // Wave complete
  if (state.phase === 'active' && state.spawnQueue.length === 0 && state.enemies.length === 0) {
    if (state.volcanoActive) { state.volcanoActive.rds--; if (state.volcanoActive.rds <= 0) state.volcanoActive = null; }
    let hInc = 0;
    state.towers.forEach(tw => {
      if (tw.type === 'hoard') {
        const stored = tw.stored || 0;
        const hl = HOARD_LEVELS[tw.level || 0] ?? HOARD_LEVELS[0];
        const income = hl.base + Math.floor(stored * hl.m);
        hInc += income;
        // Decay: 10% per wave (halved to 5% when monkey-boosted)
        const decayRate = tw._monkeyBoosted ? 0.05 : 0.1;
        const decay = Math.max(1, Math.floor(stored * decayRate));
        tw.stored = Math.max(0, stored - decay);
        if (income > 0) mkGain(tw.x * state.CELL + state.CELL / 2, tw.y * state.CELL + state.CELL / 2, '💰', income, '#fbbf24');
      }
    });
    const inc = fIncome() + hInc; state.gold += inc;
    if (inc > 0) mkF(state.W / 2, state.H / 2, '+' + inc + ' 🏺', '#10b981');
    // Research tick
    const _done = tickResearch();
    if (_done) { showBanner('🔬 ' + _done.name + ' complete!'); addFeed('research', _done.name + ' complete.'); }
    refreshResearch();
    // Craft tick
    cleanupBarricades();
    const _craftDone = tickCraft();
    for (const { recipe } of _craftDone) showBanner('⚒️ ' + recipe.name + ' crafted!');
    // Clear wildfire-disabled towers whose disable wave just ended
    state.towers.forEach(tw => { if (tw.disabled && tw.disabledWave === state.wave) tw.disabled = false; });
    tickWeather();
    // Transition seamlessly into the prep phase without a blocking modal.
    bus.emit('trigger', { type: 'wave_prep', wave: state.wave + 1 });
    state.phase = 'prep'; state.prepTicks = 1800; sfxWave(); _φ = false;
    autoSave();
    const _scribe = getScribeEntry(state.wave, state);
    if (_scribe) addFeed('scribe', _scribe);
    if (Math.random() < 0.4 && state.wave > 1) setTimeout(() => triggerEvent(), 500);
    showBanner('✅ Wave ' + state.wave + ' Complete!');
    hudU(); panelU();
    return;
  }

  // Update frame consistency markers
  state._Σ = (state.ticks * _ηG ^ _ηL) & 0xFFFF;
  state._Ω = 0;
  _φ = false;
  hudU();
}

// updateProjectiles removed to projectiles.js

/* ═══ Game flow ═══ */
export function startGame() {
  _ΨΔ(() => { _wG(100); _wL(20); });
  if (!state.research) state.research = buildResearchGraph();
  state.started = true; state.phase = 'prep'; state.prepTicks = 1800;
  invalidateBg(); initSz(); hideOv(); hudU(); panelU();
  initWeather();
  addFeed('system', 'The siege begins.');
  bus.emit('trigger', { type: 'game_start' });
  bus.emit('trigger', { type: 'wave_prep', wave: 1 });
}

export function startWave() {
  state.wave++;
  state.spawnQueue = genWave(state.wave);
  state.spawnTimer = 30; state.phase = 'active';
  hideOv();
  const boss = state.wave % 5 === 0 && state.wave > 0;
  showBanner(boss ? '👑 BOSS W' + state.wave : '⚔️ Wave ' + state.wave);
  addFeed(boss ? 'boss' : 'wave', boss ? 'Boss Wave ' + state.wave + '!' : 'Wave ' + state.wave + ' begins.');
  if (boss) sfxBoss();
  hudU(); panelU();
}

export function startPrep() {
  state.phase = 'prep'; state.prepTicks = 1800;
  invalidateBg();
  clampCam(); hideTT(); hudU(); panelU();
}

export function resetGame() {
  _ΨΔ(() => { _wG(100); _wL(20); });
  Object.assign(state, {
    wave: 0, phase: 'idle', ticks: 0, prepTicks: 0,
    enemies: [], towers: [], projectiles: [], particles: [], beams: [], bees: [],
    spawnQueue: [], volcanoActive: null, freezeActive: 0,
    gameOver: false, started: false, pathReady: false, paused: false, sel: null, ttTower: null,
    nodes: [], resources: {}, npcs: [], firedTriggerLines: new Set(), weather: { id: 'clear', wavesLeft: 1 }, research: null, researchUnlocks: {}, unlockedTowers: new Set(['squirrel','lion','penguin','lab','workbench']), bSen: new Set(['sleepy_door']), age: 'stone',
    traps: [],
    inventory: { artifacts: [], augments: [], blueprints: [], consumables: [], equipped: [null, null, null] },
    cam: { panX: 0, panY: 0, zoom: 1, targetZoom: 1, focalX: 0, focalY: 0, focalSx: 0, focalSy: 0 },
    _Σ: 0, _Ω: 0,
  });

  for (const tree of Object.values(TOWER_SKILLS)) for (const s of Object.values(tree)) s.owned = false;
  state.pathSet.clear(); state.grid = [];
  clearFeed();
  initSz();
  clearSave(); hideTT(); startGame();
}

/* ═══ Loop ═══ */
let lastP = 0;
function loop() {
  if (measure()) invalidateBg();
  updateCameraKeys();
  const cam = state.cam;
  if (Math.abs(cam.zoom - cam.targetZoom) > 0.0005) {
    cam.zoom += (cam.targetZoom - cam.zoom) * 0.18;
    cam.panX = cam.focalX - cam.focalSx / cam.zoom;
    cam.panY = cam.focalY - cam.focalSy / cam.zoom;
    clampCam();
  }
  update(); render(); updateNpcBubble();
  if (state.ticks - lastP > 10) { panelU(); lastP = state.ticks; }
  requestAnimationFrame(loop);
}

/* ═══ Boot ═══ */
document.getElementById('snd').addEventListener('click', () => import('./audio.js').then(m => m.toggleSound()));
document.getElementById('rstBtn').addEventListener('click', () => {
  showOv('🔄 Restart?', '<label id="exportLbl"><input type="checkbox" id="chkExport" checked> Export save file before restarting</label>', 'Restart', false, () => {
    if (document.getElementById('chkExport')?.checked) exportSave();
    resetGame();
  }, () => hideOv());
});
document.getElementById('goBtn').addEventListener('click', () => { if (state.phase === 'prep') startWave(); });
initTabs(); initInput(); measure();
initSaveUI(); initBestiaryUI(); initResearchUI(); initInventoryUI(); initCraftUI(); initNpcUI();
const _sv = hasSave() && loadGame();
initSz(); panelU(); hudU(); loop();
showWelcome(VERSION, _sv ? startPrep : startGame);
import('./dev.js').then(m => m.initDev(state, hudU)).catch(() => {});
