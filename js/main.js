'use strict';
import { buildPath } from './path.js';
import { updateEnemies, genWave } from './enemies.js';
import { updateTowers } from './towers.js';
import { updateClam, updateClown, updateRobot, updateBees, updateFactoryLaser } from './support.js';
import { render } from './render.js';
import { SKILLS } from './skills.js';
import { triggerEvent } from './events.js';
import { sfxBoss, sfxWave, sfxKill, sfxHit } from './audio.js';
import { hudU, showOv, hideOv, showBanner, showBL, panelU, hideTT, mkF, initTabs, showWelcome } from './ui.js';
import { initInput, updateCameraKeys } from './input.js';
import { autoSave, initSaveUI, hasSave, loadGame } from './save.js';

export const VERSION = 'v1.0';
export const WORLD_COLS = 20;
export const WORLD_ROWS = 12;

// ─── Protected state internals ───────────────────────────────────────────────
// _gg/_ll/_ss: actual gold / lives / skillPts stored in module scope.
// Writes are gated by _φ; any external assignment to state.gold etc. is dropped.
let _gg = 200, _ll = 20, _ss = 0, _φ = false;
let _ηG = (_gg * 0x9E3779B9) >>> 16; // integrity markers — updated alongside every write
let _ηL = (_ll * 0xC2B2AE35) >>> 16;
let _ηS = (_ss * 0x85EBCA77) >>> 16;
function _wG(v) { _gg = v | 0; _ηG = (_gg * 0x9E3779B9) >>> 16; }
function _wL(v) { _ll = Math.max(0, v | 0); _ηL = (_ll * 0xC2B2AE35) >>> 16; }
function _wS(v) { _ss = Math.max(0, v | 0); _ηS = (_ss * 0x85EBCA77) >>> 16; }
// Trusted write executor — pass a fn that may read/write gold/lives/skillPts
export function _ΨΔ(fn) { const p = _φ; _φ = true; try { fn(); } finally { _φ = p; } }

/* ═══ Shared game state ═══ */
export const state = {
  wave: 0, phase: 'idle', ticks: 0, prepTicks: 0,
  enemies: [], towers: [], projectiles: [], particles: [], beams: [], bees: [],
  spawnQueue: [], spawnTimer: 0,
  sel: null, tab: 'towers',
  volcanoActive: null, freezeActive: 0,
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
  gold:     { get: () => _gg, set: v => { if (_φ) _wG(v); }, enumerable: true },
  lives:    { get: () => _ll, set: v => { if (_φ) _wL(v); }, enumerable: true },
  skillPts: { get: () => _ss, set: v => { if (_φ) _wS(v); }, enumerable: true },
});

/* ═══ Canvas ═══ */
const cv = document.getElementById('cv');
const cx = cv.getContext('2d');
state.cv = cv; state.cx = cx;

function measure() {
  const gc = document.getElementById('gc'), hud = document.getElementById('hud'), bp = document.getElementById('bp');
  const oldCELL = state.CELL;
  state.W = cv.width = gc.clientWidth;
  state.H = cv.height = gc.clientHeight - hud.offsetHeight - bp.offsetHeight;
  state.COLS = WORLD_COLS;
  state.ROWS = WORLD_ROWS;
  state.CELL = Math.floor(Math.min(state.W / WORLD_COLS, state.H / WORLD_ROWS));
  if (state.CELL < 18) state.CELL = 18;
  if (oldCELL > 0 && state.CELL !== oldCELL) {
    const ratio = state.CELL / oldCELL;
    state.cam.panX *= ratio;
    state.cam.panY *= ratio;
  }
}

export function clampCam() {
  const { cam, CELL, W, H } = state;
  const worldW = WORLD_COLS * CELL, worldH = WORLD_ROWS * CELL;
  const viewW = W / cam.zoom, viewH = H / cam.zoom;
  cam.panX = viewW >= worldW ? -(viewW - worldW) / 2 : Math.max(0, Math.min(cam.panX, worldW - viewW));
  cam.panY = viewH >= worldH ? -(viewH - worldH) / 2 : Math.max(0, Math.min(cam.panY, worldH - viewH));
}

export function minZoom() {
  const { CELL, W, H } = state;
  const worldW = WORLD_COLS * CELL, worldH = WORLD_ROWS * CELL;
  return Math.min(W / worldW, H / worldH);
}

export function initSz() {
  measure();
  if (!state.pathReady) { buildPath(); state.pathReady = true; }
  clampCam();
}

window.addEventListener('resize', () => { measure(); clampCam(); });

export function fIncome() {
  let t = 0;
  const mc = state.towers.filter(tw => tw.type === 'monkey').length;
  state.towers.forEach(tw => {
    if (tw.type === 'factory') { let inc = 10 + tw.level * 8; if (mc > 0) inc = Math.floor(inc * (1 + mc * 0.25)); t += inc; }
  });
  if (SKILLS.goldRush?.owned) t = Math.floor(t * 1.3);
  if (SKILLS.megaFactory?.owned) t = Math.floor(t * 1.5);
  return t;
}
state.fIncome = fIncome;

/* ═══ Update ═══ */
function update() {
  if (!state.started || state.gameOver) return;
  _φ = true;
  state.ticks++;

  // Prep phase — player places towers, no enemies yet
  if (state.phase === 'prep') {
    state.prepTicks--;
    if (state.prepTicks <= 0) { _φ = false; startWave(); return; }
    if (state.ticks % 60 === 0) { _φ = false; hudU(); }
    else _φ = false;
    return;
  }
  if (state.freezeActive > 0) state.freezeActive--;

  // Spawn
  if (state.spawnQueue.length > 0) {
    state.spawnTimer--;
    if (state.spawnTimer <= 0) {
      const e = state.spawnQueue.shift();
      e.x = state.path[0].x; e.y = state.path[0].y; e.pi = 0;
      state.enemies.push(e);
      if (e.boss) { sfxBoss(); showBL(e.line); }
      state.spawnTimer = Math.max(6, 22 - state.wave * 0.7);
    }
  }

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

  updateClam(); updateClown(); updateRobot(); updateBees(); updateFactoryLaser(); updateTowers();
  updateProjectiles();

  // Kill check
  for (const e of state.enemies) {
    if (!e.dead && e.hp <= 0) {
      e.dead = true;
      let rew = e.rew; if (SKILLS.greed?.owned) rew += 3;
      state.gold += rew; sfxKill();
      for (let j = 0; j < (e.boss ? 18 : 6); j++) state.particles.push({ x: e.x * state.CELL + state.CELL / 2, y: e.y * state.CELL + state.CELL / 2, vx: (Math.random() - 0.5) * (e.boss ? 7 : 4), vy: (Math.random() - 0.5) * (e.boss ? 7 : 4), life: e.boss ? 28 : 16, clr: e.clr, sz: e.boss ? 4 : 2.5 });
      mkF(e.x * state.CELL + state.CELL / 2, e.y * state.CELL + state.CELL / 2 - 12, '+' + rew, '#fbbf24');
    }
  }
  state.enemies = state.enemies.filter(e => !e.dead);
  state.beams = state.beams.filter(b => { b.life--; return b.life > 0; });
  state.bees = state.bees.filter(b => !b.dead);
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.03; p.life--;
    if (p.life <= 0) state.particles.splice(i, 1);
  }

  if (state.lives <= 0) {
    state.lives = 0; state.gameOver = true;
    _φ = false;
    showOv('💀 Game Over', 'Survived ' + state.wave + ' waves!', 'Retry', true); return;
  }

  // Wave complete
  if (state.phase === 'active' && state.spawnQueue.length === 0 && state.enemies.length === 0) {
    if (state.volcanoActive) { state.volcanoActive.rds--; if (state.volcanoActive.rds <= 0) state.volcanoActive = null; }
    const inc = fIncome(); state.gold += inc;
    if (inc > 0) mkF(state.W / 2, state.H / 2, '+' + inc + ' 🏭', '#10b981');
    if (state.wave % 3 === 0) { state.skillPts++; mkF(state.W / 2, state.H / 3, '+1 ⚡ Skill!', '#a78bfa'); }
    state.phase = 'idle'; sfxWave();
    _φ = false;
    autoSave();
    if (Math.random() < 0.4 && state.wave > 1) setTimeout(() => triggerEvent(), 500);
    showOv('✅ Wave ' + state.wave, (state.wave + 1) % 5 === 0 ? '⚠️ BOSS next!' : 'Build & prepare.', 'Next Wave', false);
    hudU(); panelU();
    return;
  }

  // Update frame consistency markers
  state._Σ = (state.ticks * _ηG ^ _ηL) & 0xFFFF;
  state._Ω = (_ηS * state.wave + _ηG ^ state.ticks) & 0xFFFF;
  _φ = false;
  hudU();
}

function updateProjectiles() {
  const { projectiles, enemies, particles, beams, ticks, CELL } = state;
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    if (p.tgt.dead && !p.chain && !p.pierce) { projectiles.splice(i, 1); continue; }
    if (p.tgt.dead) {
      const next = enemies.filter(e => !e.dead && !p.hits.includes(e) && Math.hypot(e.x - p.x, e.y - p.y) < 3);
      if (next.length) { p.tgt = next[0]; p.hits.push(p.tgt); } else { projectiles.splice(i, 1); continue; }
    }
    const dx = p.tgt.x - p.x, dy = p.tgt.y - p.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d < p.spd + 0.02) {
      p.tgt.hp -= p.dmg; sfxHit();
      mkF(p.tgt.x * CELL + CELL / 2, p.tgt.y * CELL + CELL / 2, p.dmg, '#fbbf24');
      if (p.slow > 0) { p.tgt.slow = Math.max(p.tgt.slow, p.slow); p.tgt.st = 80; }
      if (p.stun > 0) p.tgt.stunned = Math.max(p.tgt.stunned, p.stun);
      if (p.blind) p.tgt.slow = Math.max(p.tgt.slow, 0.5);
      if (p.poison) p.tgt.poison = { dmg: p.poison.dmg, dur: p.poison.dur };
      if (p.splash > 0) enemies.forEach(e => { if (e !== p.tgt && !e.dead && Math.hypot(e.x - p.tgt.x, e.y - p.tgt.y) <= p.splash) e.hp -= Math.floor(p.dmg * 0.5); });
      if (p.chain > 0) {
        const nx = enemies.filter(e => !e.dead && e !== p.tgt && !p.hits.includes(e) && Math.hypot(e.x - p.tgt.x, e.y - p.tgt.y) < 2.5);
        if (nx.length) { const nt = nx[0]; p.hits.push(nt); beams.push({ x1: p.tgt.x*CELL+CELL/2, y1: p.tgt.y*CELL+CELL/2, x2: nt.x*CELL+CELL/2, y2: nt.y*CELL+CELL/2, life: 6, clr: '#818cf8', w: 2 }); nt.hp -= Math.floor(p.dmg * 0.6); if (p.chainStun) nt.stunned = p.chainStun; p.chain--; }
      }
      if (p.pierce > 0) {
        p.hits.push(p.tgt); p.pierce--;
        const nx = enemies.filter(e => !e.dead && !p.hits.includes(e) && Math.hypot(e.x - p.tgt.x, e.y - p.tgt.y) < 1.5);
        if (nx.length) { p.tgt = nx[0]; continue; }
      }
      for (let j = 0; j < 4; j++) particles.push({ x: p.tgt.x*CELL+CELL/2, y: p.tgt.y*CELL+CELL/2, vx: (Math.random()-0.5)*3, vy: (Math.random()-0.5)*3, life: 10, clr: p.clr, sz: 2 });
      if (p.bloodlust && p.tgt.hp <= 0) state.lives = Math.min(30, state.lives + 1);
      projectiles.splice(i, 1);
    } else {
      p.x += dx / d * p.spd; p.y += dy / d * p.spd;
      if (ticks % 3 === 0) particles.push({ x: p.x*CELL+CELL/2, y: p.y*CELL+CELL/2, vx:0, vy:0, life:6, clr: p.clr+'66', sz:1.5 });
    }
  }
}

/* ═══ Game flow ═══ */
export function startGame() {
  _ΨΔ(() => { _wG(200); _wL(20); _wS(0); });
  state.started = true; state.phase = 'prep'; state.prepTicks = 1800;
  initSz(); hideOv(); hudU(); panelU();
}

export function startWave() {
  state.wave++;
  state.spawnQueue = genWave(state.wave);
  state.spawnTimer = 30; state.phase = 'active';
  hideOv();
  const boss = state.wave % 5 === 0 && state.wave > 0;
  showBanner(boss ? '👑 BOSS W' + state.wave : '⚔️ Wave ' + state.wave);
  if (boss) sfxBoss();
  hudU(); panelU();
}

export function startPrep() {
  state.phase = 'prep'; state.prepTicks = 1800;
  hideOv(); hudU(); panelU();
}

export function resetGame() {
  import('./towers.js').then(({ TOWER_SKILLS }) => {
    for (const k in TOWER_SKILLS) for (const sk of Object.values(TOWER_SKILLS[k])) sk.owned = false;
  });
  _ΨΔ(() => { _wG(200); _wL(20); _wS(0); });
  Object.assign(state, {
    wave: 0, phase: 'idle', ticks: 0, prepTicks: 0,
    enemies: [], towers: [], projectiles: [], particles: [], beams: [], bees: [],
    spawnQueue: [], volcanoActive: null, freezeActive: 0,
    gameOver: false, started: false, pathReady: false, sel: null, ttTower: null,
    cam: { panX: 0, panY: 0, zoom: 1, targetZoom: 1, focalX: 0, focalY: 0, focalSx: 0, focalSy: 0 },
    _Σ: 0, _Ω: 0,
  });
  state.pathSet.clear(); state.grid = [];
  Object.values(SKILLS).forEach(s => s.owned = false);
  hideTT(); startGame();
}

/* ═══ Loop ═══ */
let lastP = 0;
function loop() {
  updateCameraKeys();
  const cam = state.cam;
  if (Math.abs(cam.zoom - cam.targetZoom) > 0.0005) {
    cam.zoom += (cam.targetZoom - cam.zoom) * 0.18;
    cam.panX = cam.focalX - cam.focalSx / cam.zoom;
    cam.panY = cam.focalY - cam.focalSy / cam.zoom;
    clampCam();
  }
  update(); render();
  if (state.ticks - lastP > 10) { panelU(); lastP = state.ticks; }
  requestAnimationFrame(loop);
}

/* ═══ Boot ═══ */
document.getElementById('snd').addEventListener('click', () => import('./audio.js').then(m => m.toggleSound()));
document.getElementById('goBtn').addEventListener('click', () => { if (state.phase === 'prep') startWave(); });
initTabs(); initInput(); initSz(); panelU(); hudU(); loop();
initSaveUI();
const _sv = hasSave() && loadGame();
showWelcome(VERSION, _sv ? null : startGame);
