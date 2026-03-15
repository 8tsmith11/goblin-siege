'use strict';
import { buildPath } from './path.js';
import { updateEnemies, mkEFromServer } from './enemies.js';
import { updateTowers } from './towers.js';
import { updateClam, updateClown, updateRobot, updateBees, updateFactoryLaser } from './support.js';
import { render } from './render.js';
import { SKILLS, syncSkillsFromServer } from './skills.js';
import { triggerEvent } from './events.js';
import { sfxBoss, sfxWave, sfxKill, sfxHit } from './audio.js';
import { hudU, showOv, hideOv, showBanner, showBL, panelU, hideTT, mkF, initTabs, showAuthOverlay } from './ui.js';
import { initInput } from './input.js';
import * as api from './api.js';

/* ═══ Shared game state ═══ */
export const state = {
  gold: 200, lives: 20, wave: 0, phase: 'idle', ticks: 0,
  enemies: [], towers: [], projectiles: [], particles: [], beams: [], bees: [],
  spawnQueue: [], spawnTimer: 0,
  sel: null, tab: 'towers',
  volcanoActive: null, freezeActive: 0,
  gameOver: false, started: false,
  ttTower: null,
  skillPts: 0,
  W: 0, H: 0, CELL: 0, COLS: 0, ROWS: 0, pathReady: false,
  cv: null, cx: null,
  path: [], pathSet: new Set(), grid: [],
  gCell: null,
  // Wave outcome tracking (reported to server at wave end)
  waveKills: {},   // { enemy_type: count }
  waveLeaks: {},   // { enemy_type: count }
};

/* ═══ Canvas ═══ */
const cv = document.getElementById('cv');
const cx = cv.getContext('2d');
state.cv = cv; state.cx = cx;

function measure() {
  const gc = document.getElementById('gc'), hud = document.getElementById('hud'), bp = document.getElementById('bp');
  state.W = cv.width = gc.clientWidth;
  state.H = cv.height = gc.clientHeight - hud.offsetHeight - bp.offsetHeight;
  state.CELL = Math.floor(Math.min(state.W / 16, state.H / 10));
  if (state.CELL < 18) state.CELL = 18;
  state.COLS = Math.floor(state.W / state.CELL);
  state.ROWS = Math.floor(state.H / state.CELL);
}

export function initSz() {
  measure();
  if (!state.pathReady) { buildPath(); state.pathReady = true; }
}

window.addEventListener('resize', () => {
  const oc = state.COLS, or2 = state.ROWS; measure();
  if ((state.COLS !== oc || state.ROWS !== or2) && state.towers.length === 0) buildPath();
});

/* ═══ Income display (local estimate for HUD only — server is authoritative) ═══ */
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

/* ═══ Sync server tower state into frontend state.towers ═══ */
export function applyServerState(data) {
  state.gold = data.gold;
  state.lives = data.lives;
  state.wave = data.wave;
  state.phase = data.phase;
  state.skillPts = data.skill_pts;
  syncSkillsFromServer(data.player_skills || []);
  if (data.towers) {
    // Rebuild tower objects from server data, preserving runtime fields
    state.towers = data.towers.map(st => towerFromServer(st));
  }
}

export function towerFromServer(st) {
  // Merge server-authoritative fields with frontend runtime fields
  const existing = state.towers.find(t => t.id === st.id);
  return {
    ...(existing || {}),
    id: st.id,
    type: st.type,
    x: st.x,
    y: st.y,
    level: st.level,
    has_laser: st.has_laser,
    hasLaser: st.has_laser,
    laserLvl: st.laser_lvl,
    laserRange: st.laser_range,
    ownedSkills: st.owned_skills || [],
    disabled: st.disabled,
    // Runtime-computed defaults (will be overridden by apply*Skill calls)
    cd: existing?.cd ?? 0,
    _buffed: false, _rateBuff: 1,
    // Stats derived from type (frontend computes these)
    ...deriveStats(st.type, st.level, st.owned_skills || []),
  };
}

function deriveStats(type, _level, ownedSkills) {
  // Import TD lazily to avoid circular at eval time
  const { TD } = window._gs_TD_ref || {};
  if (!TD || !TD[type]) return {};
  const def = TD[type];
  const stats = {
    dmg: def.dmg, range: def.range, rate: def.rate,
    splash: def.splash || 0, slow: def.slow || 0,
    pierce: def.pierce || 0, chain: def.chain || 0,
    stun: 0, poison: null, blind: false, bloodlust: false,
    blizzard: false, seeInvis: false, chainStun: 0, megaSpeed: false,
    frenzy: false, disabledWave: -1,
  };
  // Apply skills
  const { TOWER_SKILLS } = window._gs_TOWER_SKILLS_ref || {};
  if (TOWER_SKILLS?.[type]) {
    for (const sk of ownedSkills) {
      TOWER_SKILLS[type][sk]?.apply(stats);
    }
  }
  // Apply level bonuses (deterministic — matches server upgrade_cost formula)
  // Upgrades are tracked by level count; exact stat delta is frontend-side
  return stats;
}

/* ═══ Update ═══ */
function update() {
  if (!state.started || state.gameOver) return;
  state.ticks++;
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

  // Kill check — track for server report
  for (const e of state.enemies) {
    if (!e.dead && e.hp <= 0) {
      e.dead = true;
      const eType = e.boss ? 'boss' : (e.enemyType || 'normal');
      state.waveKills[eType] = (state.waveKills[eType] || 0) + 1;
      // Optimistic gold update for responsive feel; server confirms at wave end
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
    // Still report to server so it marks session inactive
    api.completeWave({ kills: state.waveKills, leaks: state.waveLeaks }).catch(() => {});
    showOv('💀 Game Over', 'Survived ' + state.wave + ' waves!', 'Retry', true); return;
  }

  // Wave complete — hand off to server
  if (state.phase === 'active' && state.spawnQueue.length === 0 && state.enemies.length === 0) {
    state.phase = 'settling'; // prevent re-trigger
    if (state.volcanoActive) { state.volcanoActive.rds--; if (state.volcanoActive.rds <= 0) state.volcanoActive = null; }
    if (Math.random() < 0.4 && state.wave > 1) setTimeout(() => triggerEvent(), 500);
    api.completeWave({ kills: state.waveKills, leaks: state.waveLeaks }).then(result => {
      state.gold = result.gold;
      state.lives = result.lives;
      state.skillPts = result.skill_pts;
      state.wave = result.wave;
      if (result.skill_pts > state.skillPts) mkF(state.W / 2, state.H / 3, '+1 ⚡ Skill!', '#a78bfa');
      const inc = fIncome();
      if (inc > 0) mkF(state.W / 2, state.H / 2, '+' + inc + ' 🏭', '#10b981');
      state.phase = 'idle'; sfxWave();
      showOv('✅ Wave ' + state.wave, (state.wave + 1) % 5 === 0 ? '⚠️ BOSS next!' : 'Build & prepare.', 'Next Wave', false);
      hudU(); panelU();
    }).catch(err => {
      console.error('Wave complete failed:', err);
      state.phase = 'idle'; sfxWave();
      showOv('✅ Wave ' + state.wave, 'Build & prepare.', 'Next Wave', false);
    });
  }
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
export async function startGame() {
  try {
    const data = await api.newGame();
    applyServerState(data);
    state.started = true; initSz(); hideOv();
    setTimeout(() => showOv('⚔️ Prepare!', 'Place towers on dark tiles. Support tab has Clam, Beehive, Clown, Monkey & AI Robot!', 'Start Wave 1', false), 200);
  } catch (e) {
    if (e.message === 'auth') { showAuthOverlay(); return; }
    console.error(e);
  }
}

export async function startWave() {
  try {
    const waveData = await api.startWave();
    state.wave = waveData.wave;
    state.waveKills = {}; state.waveLeaks = {};
    // Build spawn queue from server-provided enemy list
    state.spawnQueue = buildSpawnQueue(waveData);
    state.spawnTimer = 30; state.phase = 'active';
    hideOv();
    const boss = waveData.is_boss;
    showBanner(boss ? '👑 BOSS W' + state.wave : '⚔️ Wave ' + state.wave);
    if (boss) sfxBoss();
    hudU(); panelU();
  } catch (e) {
    if (e.message === 'auth') { showAuthOverlay(); return; }
    console.error(e);
  }
}

function buildSpawnQueue(waveData) {
  const queue = [];
  const bHP = 25 + waveData.wave * 20 + Math.pow(waveData.wave, 1.5) * 5;
  const bSpd = 0.55 + Math.min(waveData.wave * 0.035, 0.9);
  for (const entry of waveData.enemies) {
    for (let i = 0; i < entry.count; i++) {
      queue.push(mkEFromServer(entry.type, bHP, bSpd, waveData.wave));
    }
  }
  return queue;
}

export async function resetGame() {
  import('./towers.js').then(({ TOWER_SKILLS }) => {
    for (const k in TOWER_SKILLS) for (const sk of Object.values(TOWER_SKILLS[k])) sk.owned = false;
  });
  Object.assign(state, {
    gold: 200, lives: 20, wave: 0, phase: 'idle', ticks: 0,
    enemies: [], towers: [], projectiles: [], particles: [], beams: [], bees: [],
    spawnQueue: [], volcanoActive: null, freezeActive: 0,
    gameOver: false, started: false, pathReady: false, sel: null, ttTower: null, skillPts: 0,
    waveKills: {}, waveLeaks: {},
  });
  state.pathSet.clear(); state.grid = [];
  Object.values(SKILLS).forEach(s => s.owned = false);
  hideTT(); await startGame();
}

/* ═══ Loop ═══ */
let lastP = 0;
function loop() {
  update(); render();
  if (state.ticks - lastP > 10) { panelU(); lastP = state.ticks; }
  requestAnimationFrame(loop);
}

/* ═══ Boot ═══ */
document.getElementById('snd').addEventListener('click', () => import('./audio.js').then(m => m.toggleSound()));
initTabs(); initInput(); initSz(); panelU(); hudU(); loop();
// Show auth overlay or jump straight in if already logged in
if (api.isLoggedIn()) {
  showOv('⚔️ Goblin Siege ⚔️', '11 towers · Boss waves · Skill trees · Spells · Random events<br>Build, upgrade, survive!', 'Begin Battle', false);
} else {
  showAuthOverlay();
}
