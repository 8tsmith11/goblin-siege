'use strict';
import { bus } from './bus.js';
import { getP, freeP, freeBeam } from './pool.js';
import { spawnParticles, getCenter } from './utils.js';
import { updateProjectiles } from './projectiles.js';
import { dropItem } from './resources.js';
import { buildPath } from './path.js';
import { RESEARCH_DATA_READY } from './research.js';
import { buildResearchGraph, tickResearch } from './research.js';
import { tickCraft, updateTraps, cleanupBarricades } from './craft.js';
import { addFeed, clearFeed } from './feed.js';
import { getScribeEntry, TRANSLATIONS } from './bestiary.js';
import { TOWER_SKILLS, HOARD_LEVELS, TD, ETYPES } from './data.js';
import { updateEnemies, genWave, mkE, isBossWave, previewWave } from './enemies.js';
import { updateTowers } from './towers.js';
import { updateClam, updateClown, updateRobot, updateBees, updateFactoryLaser, spawnSpiderMother, updateSpiderMother, updateOrbitalBrood, updateFluids, updateTorque, updateInlinePumps } from './support.js';
import { updateMonkeys } from './monkeys.js';
import { render, invalidateBg, clearFogParticles } from './render.js';
import { ARTIFACTS } from './artifacts.js';
import { triggerEvent } from './events.js';
import { sfxBoss, sfxWave, sfxKill, sfxHit, startHum, stopHum, startHum2, stopHum2, isSoundOn, sfxWatcherScreech, speak, resetMusic } from './audio.js';
import { hudU, showOv, hideOv, showBanner, showBL, showResearchPop, panelU, hideTT, mkF, mkGain, initTabs, showWelcome, initBestiaryUI, initResearchUI, refreshResearch, resetResPos, initInventoryUI, initCraftUI, showLedger } from './ui.js';
import { initInput, updateCameraKeys } from './input.js';
import { autoSave, clearSave, exportSave, initSaveUI, hasSave, loadGame } from './save.js';
import { placeNodes, updateNodes, patchIronIcons } from './resources.js';
import { placeNpcs, initNpcUI, updateNpcBubble } from './npc.js';
import { initWeather, tickWeather, updateWeather } from './weather.js';
import { refreshPipStock, syncPipBtn, updatePipPanel, initPipUI } from './ui-pip.js';
import { syncInvBtn, addToInventory } from './ui-inventory.js';

bus.on('enemyDeath', e => {
  state._kills = (state._kills || 0) + 1;
  state.totalGoblinsKilled = (state.totalGoblinsKilled || 0) + 1;
  let rew = e.rew;
  state.totalGoldEarned = (state.totalGoldEarned || 0) + rew;
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
    const luckMult = state.inventory?.equipped?.some(a => a?.id === 'lucky_paw') ? 1.1 : 1;
    for (const drop of e.drops) {
      if (Math.random() < drop.chance * luckMult) dropItem(cx, cy, drop.type);
    }
  }
  
  // Herald drops — Herald's Horn artifact only (1 artifact per boss)
  if (e.herald) {
    const hornArt = ARTIFACTS.find(a => a.id === 'heralds_horn');
    const inv = state.inventory;
    const owned = new Set([...inv.artifacts.map(a => a?.id), ...inv.equipped.map(a => a?.id)].filter(Boolean));
    if (!owned.has('heralds_horn')) {
      dropLoot(e.x, e.y, 'artifacts', { ...hornArt, cdWavesLeft: 0 });
      mkGain(e.x * state.CELL + state.CELL / 2, e.y * state.CELL + state.CELL / 2, '📯', 1, '#f59e0b');

    }
    // Also drop a relocation charm
    dropLoot(e.x, e.y, 'consumables', { id: 'relocation_charm', icon: '✨', name: 'Relocation Charm', desc: 'Move any tower to a new valid tile, preserving all upgrades.' });

  }
  // Regular bosses: 50% chance of relocation charm
  if (e.boss && !e.herald && Math.random() < 0.5) {
    dropLoot(e.x, e.y, 'consumables', { id: 'relocation_charm', icon: '✨', name: 'Relocation Charm', desc: 'Move any tower to a new valid tile, preserving all upgrades.' });
    mkGain(e.x * state.CELL + state.CELL / 2, e.y * state.CELL + state.CELL / 2, '✨', 1, '#a855f7');

  }

  // Dust Collection (Lab)
  const lab = state.towers.find(t => t.type === 'lab');
  if (lab && state.resources) {
    const dist = Math.hypot(e.x - lab.x, e.y - lab.y);
    if (dist <= lab.obsRange) {
      const tallyStick = state.inventory?.equipped?.some(a => a?.id === 'tally_stick');
      const baseDustChance = tallyStick ? 0.32 : 0.25;
      const dustChance = e.boss ? 0.95 : Math.min(0.85, baseDustChance * rew);
      const dustAmount = e.boss ? 5 : Math.max(1, Math.floor(rew / 2));
      let dustYield = Math.random() < dustChance ? dustAmount : 0;
      if (dustYield > 0) {
        state.resources.dust = (state.resources.dust || 0) + dustYield;
        mkGain(e.x * state.CELL + state.CELL / 2, e.y * state.CELL + state.CELL / 2, '🔮', dustYield, '#a855f7');
      }
    }
  }
  // Geologist: drop stolen items (33% each, no dust)
  if (e.em === '💎' && e.stolen?.length && e.gMode !== 'leaving') {
    const cx = Math.max(0, Math.min(state.COLS - 1, Math.round(e.x)));
    const cy = Math.max(0, Math.min(state.ROWS - 1, Math.round(e.y)));
    for (const s of e.stolen) {
      if (s.type === 'dust') continue;
      if (Math.random() < 0.33) {
        if (s.item?.section) dropLoot(cx, cy, s.item.section, s.item.item);
        else if (s.type && s.type !== 'resource' && s.type !== '_artifact') dropItem(cx, cy, s.type);
      }
    }
  }
  // Spider: spawn 2-4 spiderlings (only from parent, not from spiderlings)
  if (e.em === '🕷️' && !e.spiderling) {
    const bHP = 60 + 3 * state.wave + 0.05 * state.wave * state.wave;
    const count = 2 + Math.floor(Math.random() * 3);
    state.bSen.add('spiderling');
    spawnParticles(state.particles, e.x * state.CELL + state.CELL / 2, e.y * state.CELL + state.CELL / 2, 14,
      { spreadX: 5, spreadY: 5, life: 18, clr: '#c4b5fd', sz: 3 });
    for (let i = 0; i < count; i++) {
      // Spread evenly but with random offset, biased off-path for drama
      const angle = (Math.PI * 2 * i / count) + (Math.random() - 0.5) * 1.2;
      const sp = mkE(ETYPES.spiderling, bHP, 1.0);
      sp.spiderling = true; sp.gMode = 'exploding';
      sp.explodeVX = Math.cos(angle) * 0.55;
      sp.explodeVY = Math.sin(angle) * 0.55;
      sp.explodeDist = 1.8 + Math.random() * 2.0; // 1.8–3.8 tiles off-path
      sp.x = e.x; sp.y = e.y; sp.pi = e.pi;
      state.enemies.push(sp);
    }
  }
  // Curious Auditor death: drop Auditor's Ledger
  if (e.auditor) {
    state.auditorActive = false;
    if (state._auditorTimer) { clearInterval(state._auditorTimer); state._auditorTimer = null; }
    const ledger = ARTIFACTS.find(a => a.id === 'auditors_ledger');
    if (ledger) {
      dropLoot(e.x, e.y, 'artifacts', { ...ledger, cdWavesLeft: 0 });
      mkGain(e.x * state.CELL + state.CELL / 2, e.y * state.CELL + state.CELL / 2, '📒', 1, '#f59e0b');
    }
  }
  // Patient Watcher death: stop hum and drop Unblinking Eye if in path phase
  if (e.watcher) {
    stopHum();
    if (e.watcherPhase === 'path') {
      const eye = ARTIFACTS.find(a => a.id === 'unblinking_eye');
      if (eye) {
        dropLoot(e.x, e.y, 'artifacts', { ...eye, cdWavesLeft: 0 });
        mkGain(e.x * state.CELL + state.CELL / 2, e.y * state.CELL + state.CELL / 2, '👁️', 1, '#c084fc');
      }
    }
  }
  // Wave 25 boss: drop blueprint on the ground
  if (e.boss && state.wave === 25 && state.worldGenChoices?.wave10Blueprint) {
    const bpType = state.worldGenChoices.wave10Blueprint;
    const bpDef = TD[bpType];
    if (bpDef) {
      dropLoot(e.x, e.y, 'blueprints', { id: bpType + '_bp', icon: '🟦', bpOverlay: bpDef.icon, name: bpDef.name + ' Blueprint', unlocks: bpType });
      mkGain(e.x * state.CELL + state.CELL / 2, e.y * state.CELL + state.CELL / 2, '🟦', 1, '#3b82f6');
    }
  }
});
// Patient Watcher: teleport to path start, begin path phase
bus.on('watcherTransition', () => {
  sfxWatcherScreech();
  startHum();
  if (!state.secondFrequencyPlayed) {
    state.secondFrequencyPlayed = true;
    setTimeout(() => {
      startHum2();
      setTimeout(() => stopHum2(), 8000);
    }, 3000);
    state._gemWave = { startTick: state.ticks + 180, active: true }; // 3s delay before wave travels
    addFeed('obs', 'A second anomaly. ~330Hz. Resonance detected.');
  }
});

bus.on('bossLine', ({ line }) => { showBL(line); });

bus.on('firstSpider', () => {
  addFeed('obs', 'Entity classification: arachnid. Non-hostile posture. She is looking for something. We do not know what.');
});

bus.on('watcherEscaped', () => {
  state.watcherEscaped = true;
  sfxWatcherScreech();
  startHum();
  setTimeout(() => stopHum(), 11000);
  showBanner('👁️ The Patient Watcher walked away.');
  addFeed('obs', 'The Patient Watcher left without engaging. Its route was not random. It was methodical. It was looking at us.');
});



export const VERSION = 'v1.9';
export const WORLD_COLS = 32;
export const WORLD_ROWS = 36; // expanded: +12 upward for steam age zone
export const STEAM_ROWS = 12; // number of new rows above stone age zone

const _BOSS_STRIP_ORDER = ['herald','vanguard','vanguard','vanguard','curious_auditor','vanguard','patient_watcher'];
const _BOSS_STRIP_DESC = {
  herald:          '📯 The Proud Herald — Announces itself. Flanked by minions. Does not fight.',
  curious_auditor: '🏛️ The Curious Auditor — Counts your spending. Speaks when hurt. Slow but persistent.',
  patient_watcher: '👁️ The Patient Watcher — Roams the map for 30 seconds. If undisturbed, it leaves. At 20% HP it joins the path.',
  vanguard:        '👑 Vanguard — A crowned goblin chieftain. Tough, well-supplied, leading a warband.',
  fog:             '🌫️ Considerate Fog — All tower range reduced to 1 tile. Enemies that break through deal 3 lives each.',
  weight:          '💎 Weight of Bones — All enemies become geologists, stealing your stone and wood.',
};
function _updateBossStrip(nextW) {
  const el = document.getElementById('bossStrip');
  if (!el) return;
  const hornEquipped = state.inventory?.equipped?.some(a => a?.id === 'heralds_horn');
  if (!hornEquipped) { el.style.display = 'none'; return; }
  let desc = null;
  if (nextW === 5) desc = _BOSS_STRIP_DESC.herald;
  else if (nextW === 15) desc = _BOSS_STRIP_DESC.fog;
  else if (nextW === 40) desc = _BOSS_STRIP_DESC.weight;
  else if (isBossWave(nextW)) {
    const bossType = _BOSS_STRIP_ORDER[state.namedBossIndex ?? 0] ?? 'vanguard';
    desc = _BOSS_STRIP_DESC[bossType] ?? _BOSS_STRIP_DESC.vanguard;
  }
  if (desc) {
    el.textContent = desc;
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

export function getCell(x, y) { return state.grid[y]?.[x] ?? null; }
export function setCell(x, y, updates) {
  const cell = state.grid[y]?.[x];
  if (cell) Object.assign(cell, updates);
}

// ─── Protected state internals ───────────────────────────────────────────────
// _gg/_ll: actual gold / lives stored in module scope.
// Writes are gated by _φ; any external assignment to state.gold etc. is dropped.
let _gg = 100, _ll = 20, _φ = false;
let _ηG = (_gg * 0x9E3779B9) >>> 16; // integrity markers — updated alongside every write
let _ηL = (_ll * 0xC2B2AE35) >>> 16;
function _wG(v) { _gg = v | 0; _ηG = (_gg * 0x9E3779B9) >>> 16; }
function _wL(v) { _ll = Math.max(0, Math.min(state?.maxLives || 3, v | 0)); _ηL = (_ll * 0xC2B2AE35) >>> 16; }
// Trusted write executor — pass a fn that may read/write gold/lives
export function _ΨΔ(fn) { const p = _φ; _φ = true; try { fn(); } finally { _φ = p; } }

/* ═══ Shared game state ═══ */
export const state = {
  wave: 0, phase: 'idle', ticks: 0, prepTicks: 0,
  enemies: [], towers: [], projectiles: [], particles: [], beams: [], bees: [],
  spawnQueue: [], spawnTimer: 0,
  nodes: [], resources: {}, _seenResources: new Set(['stone', 'wood', 'dust']),
  npcs: [], firedTriggerLines: new Set(),
  weather: { id: 'clear', wavesLeft: 1 },
  fogWave: false, fogStartTick: 0,
  heraldWarn: null, hasHeraldHorn: false,
  pip: null,
  research: null, researchUnlocks: {},
  traps: [], webs: [],
  inventory: { artifacts: [], augments: [], blueprints: [], consumables: [], equipped: [null], seenSections: {} },
  unlockedTowers: new Set(['squirrel', 'lion', 'penguin']),
  sel: null, tab: 'towers',
  bSen: new Set(['sleepy_door']),
  volcanoActive: null, freezeActive: 0,
  age: 'stone', paused: false,
  gameOver: false, started: false,
  ttTower: null,
  W: 0, H: 0, CELL: 0, COLS: 0, ROWS: 0, pathReady: false,
  cam: { panX: undefined, panY: undefined, zoom: 1, targetZoom: 1, focalX: 0, focalY: 0, focalSx: 0, focalSy: 0 },
  cv: null, cx: null,
  path: [], pathSet: new Set(), grid: [],
  gCell: null,
  worldGenChoices: {},
  totalGoblinsKilled: 0, totalGoldEarned: 0,
  maxLives: 3,
  frequencyPlayed: false, secondFrequencyPlayed: false, _gemWave: null, belts: [], _beltStart: null, _torquePhase: 0,
  _forgeScriberFired: false, forgeAnnounce: null,
  patternRecDone: false, translationStep: 0, _translationWaveCount: 0,
  namedBossIndex: 0,
  auditorActive: false,
  watcherEscaped: false,
  spiderRitualDone: false,
  spiderMother: null,
  ceasefire: false,
  seedStone: null,
  cameraShake: 0,
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
  state.CELL = Math.floor(Math.min(state.W / 20, state.H / 12));
  if (state.CELL < 18) state.CELL = 18;
  state.COLS = WORLD_COLS;
  state.ROWS = WORLD_ROWS;
  if (oldCELL > 0 && state.CELL !== oldCELL) {
    const ratio = state.CELL / oldCELL;
    state.cam.panX *= ratio;
    state.cam.panY *= ratio;
  }
  return state.W !== oldW || state.H !== oldH;
}

export function clampCam() {
  const { cam, CELL, W, H } = state;
  const worldW = state.COLS * CELL, worldH = state.ROWS * CELL;
  const viewW = W / cam.zoom, viewH = H / cam.zoom;
  
  if (state.cam.panX === undefined) {
    state.cam.panX = -Math.floor((viewW - worldW) / 2);
    state.cam.panY = (STEAM_ROWS + 6) * CELL; // PAD=6, skip steam zone to show stone age zone
  }
  
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
state.syncPipBtn = syncPipBtn;
state.updatePipPanel = updatePipPanel;
state.syncInvBtn = syncInvBtn;

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
    if (state.heraldWarn && state.ticks - state.heraldWarn.tick > 300) state.heraldWarn = null;
  }

  updateNodes();
  updateWeather();
  if (state.freezeActive > 0) state.freezeActive--;

  // Spawn
  if (state.spawnQueue.length > 0) {
    state.spawnTimer--;
    if (state.spawnTimer <= 0) {
      const e = state.spawnQueue.shift();
      if (!e.watcher) { e.x = state.path[0].x; e.y = state.path[0].y; e.pi = 0; }
      state.enemies.push(e);
      if (e.boss) { sfxBoss(); showBL(e.line); }
      state.spawnTimer = e.spawnDelay ?? (state.wave <= 4 ? Math.max(40, 90 - state.wave * 8) : Math.max(20, 50 - state.wave * 0.7));
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

  updateClam(); updateClown(); updateRobot(); updateBees(); updateOrbitalBrood(); updateFluids(); updateTorque(); updateInlinePumps(); state._torquePhase = (state._torquePhase || 0) + 1; updateMonkeys(); updateTowers();
  // Gem wave activation + knowing bloom spawning
  if (state._gemWave?.active) {
    const gw = state._gemWave;
    const elapsed = state.ticks - gw.startTick;
    const mapPx = state.COLS * state.CELL;
    const progress = elapsed / 180; // 3s travel across full map width
    const castle = state.path[state.path.length - 1];
    if (castle) {
      const cpx = castle.x * state.CELL + state.CELL / 2, cpy = castle.y * state.CELL + state.CELL / 2;
      for (const tw of state.towers) {
        if (tw.type !== 'resonating_gem' || tw._activated) continue;
        const gpx = tw.x * state.CELL + state.CELL / 2, gpy = tw.y * state.CELL + state.CELL / 2;
        const dist = Math.hypot(gpx - cpx, gpy - cpy);
        if (progress * mapPx >= dist) {
          tw._activated = true;
          import('./audio.js').then(m => m.sfxResearch?.());
          state._seenResources?.add('knowing_bloom');
        }
      }
    }
    if (progress >= 1.5) gw.active = false;
  }
  // Knowing bloom growth from activated gems
  if (state.ticks % 3600 === 1) {
    for (const tw of state.towers) {
      if (tw.type !== 'resonating_gem' || !tw._activated) continue;
      const candidates = [];
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          const cell = getCell(tw.x + dx, tw.y + dy);
          if (cell && cell.type === 'empty' && !cell.content && (!cell.stacks || cell.stacks.every(s => !s))) {
            candidates.push({ x: tw.x + dx, y: tw.y + dy });
          }
        }
      }
      if (candidates.length) {
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        dropItem(pick.x, pick.y, 'knowing_bloom');
        state._seenResources?.add('knowing_bloom');
      }
    }
  }
  updateSpiderMother();
  // Silence BGM while Patient Watcher is alive (any phase)
  const _watcherPresent = state.enemies.some(e => e.watcher);
  if (window.bgm) window.bgm.volume = _watcherPresent ? 0 : (isSoundOn() ? 0.3 : 0);
  // Camera shake
  if (state.cameraShake > 0) state.cameraShake = Math.max(0, state.cameraShake - 0.5);
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
    if (b.life <= 0) { freeBeam(b); state.beams[i] = state.beams[state.beams.length - 1]; state.beams.pop(); }
  }
  state.bees = state.bees.filter(b => !b.dead);
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.03; p.life--;
    if (p.life <= 0) { freeP(p); state.particles[i] = state.particles[state.particles.length - 1]; state.particles.pop(); }
  }

  if (state.lives <= 0) {
    state.lives = 0; state.gameOver = true;
    _φ = false;
    const _hasSv = hasSave();
    const _showDeath = () => showOv('💀 Game Over', 'Survived ' + state.wave + ' waves!', 'Restart Run', true,
      () => showOv('Restart run?', 'All progress will be lost.', 'Confirm Restart', false,
        () => { resetGame(); startGame(); }, _showDeath, 'Go Back'),
      _hasSv ? () => { loadGame(); hideOv(); startPrep(); } : null,
      _hasSv ? 'Retry Wave' : null
    );
    _showDeath(); return;
  }

  // Wave complete
  if (state.phase === 'active' && state.spawnQueue.length === 0 && state.enemies.length === 0 && !state.spiderMother) {
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
    if (_done) {
      if (_done.id === 'the_forge') { state.forgeAnnounce = { tick: state.ticks }; } else { showBanner('🔬 ' + _done.name + ' complete!'); }
      showResearchPop(_done.name);
      addFeed('research', _done.name + ' complete.');
    }
    refreshResearch();
    // Craft tick
    cleanupBarricades();
    // Seed stone erosion
    if (state.seedStone && !state.seedStone.carried) {
      state.seedStone.wavesLeft--;
      if (state.seedStone.wavesLeft <= 0) { state.seedStone = null; addFeed('event', '🪨 The Seed Stone crumbled.'); }
    }
    // Reset grateful spider once-per-wave web ability
    state.towers.forEach(tw => { if (tw.type === 'grateful_spider') { tw.webUsed = false; tw._web2Used = false; tw._web2Tick = 0; } });
    // Honey production: beehives produce 1 honey per wave when research is unlocked — drops on tile
    if (state.researchUnlocks?.honey_production) {
      const hives = state.towers.filter(tw => tw.type === 'beehive');
      for (const hive of hives) {
        dropItem(hive.x, hive.y, 'honey');
      }
    }
    // Clear expired webs
    if (state.webs?.length) state.webs = [];
    const _craftDone = tickCraft();
    for (const { recipe } of _craftDone) showBanner('⚒️ ' + recipe.name + ' crafted!');
    // Clear wildfire-disabled towers whose disable wave just ended
    state.towers.forEach(tw => { if (tw.disabled && tw.disabledWave === state.wave) tw.disabled = false; });
    tickWeather();
    refreshPipStock();
    // Fog wave clear
    const _wasFog = state.fogWave;
    if (_wasFog) {
      state.fogWave = false;
      state.fogStartTick = 0;
      clearFogParticles();
      const _inv = state.inventory;
      const _owned = new Set([..._inv.artifacts.map(a => a?.id), ..._inv.equipped.map(a => a?.id)].filter(Boolean));
      const _avail = ARTIFACTS.filter(a => !a.unique && !_owned.has(a.id));
      const art = _avail.length ? _avail[Math.floor(Math.random() * _avail.length)] : null;
      if (art) {
        const exit = state.path[state.path.length - 1];
        if (exit) dropLoot(exit.x, exit.y, 'artifacts', { ...art, cdWavesLeft: 0 });
        else addToInventory('artifacts', { ...art, cdWavesLeft: 0 });
      }
      addFeed('boss', art ? '🌫️ Fog cleared — artifact landed at the gate. Pick it up!' : '🌫️ Fog cleared.');
    }
    // Decrement active artifact cooldowns
    if (state.inventory?.equipped) {
      for (const art of state.inventory.equipped) {
        if (art?.active && art.cdWavesLeft > 0) art.cdWavesLeft--;
      }
    }
    // Translation tick
    if (state.patternRecDone) {
      state._translationWaveCount = (state._translationWaveCount || 0) + 1;
      if (state._translationWaveCount % 2 === 0 && (state.translationStep || 0) < 12) {
        state.translationStep = (state.translationStep || 0) + 1;
        const _tEntry = TRANSLATIONS[state.translationStep - 1];
        if (_tEntry) {
          addFeed('translations', `Goblin Translation: 👺 ${_tEntry.text}`);
          if (_tEntry.full) showBanner(`👺 "${_tEntry.text}"`);
        }
      }
    }
    // Ledger overlay at wave 20
    if (state.wave === 20) { _φ = false; showLedger(); _φ = true; }
    // Heal to max lives at end of each wave
    _ΨΔ(() => { state.lives = state.maxLives || 3; });
    // Transition seamlessly into the prep phase without a blocking modal.
    // Flush pending bestiary entries now that the wave is over
    if (state._pendingBSen) { for (const k of state._pendingBSen) state.bSen.add(k); state._pendingBSen = null; }
    // Unlock lab at end of wave 7 so it's available during prep
    if (state.wave >= 7 && !state.unlockedTowers.has('lab')) {
      state.unlockedTowers.add('lab');
      showBanner('🧪 Lab Unlocked');
    }
    bus.emit('trigger', { type: 'wave_prep', wave: state.wave + 1 });
    state.phase = 'prep'; state.prepTicks = 1800; sfxWave(); _φ = false;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (state.wave === 22 && !state.frequencyPlayed) {
      state.frequencyPlayed = true;
      startHum();
      setTimeout(() => stopHum(), 10000);
      bus.emit('trigger', { type: 'frequency_played' });
      addFeed('obs', 'During prep phase: an audio anomaly. ~40Hz. Duration: 11 seconds. Source: unknown. Towers did not respond. Goblins did not respond. The Lab recorded it anyway.');
    }
    autoSave();
    const _scribe = getScribeEntry(state.wave, state);
    if (_scribe) {
      addFeed('npc', 'The scribe has written in the journal.');
      showBanner('📓 The scribe has written in the journal.');
    }
    if (Math.random() < 0.4 && state.wave > 1) setTimeout(() => triggerEvent(), 500);
    const _hasLedger = state.inventory?.equipped?.some(a => a?.id === 'auditors_ledger');
    const _nextPreview = _hasLedger ? ' — Next: ' + previewWave(state.wave + 1) : '';
    if (_done?.id !== 'the_forge') showBanner(_wasFog ? '🌫️ The fog clears. An artifact glints at the castle gate.' : '✅ Wave ' + state.wave + ' Complete!' + _nextPreview);
    // Herald / Horn warning — announce upcoming boss wave during prep
    const _nextW = state.wave + 1;
    const _isHeraldNext = _nextW === 5;
    const _isBossNext = isBossWave(_nextW) && _nextW !== 5 && _nextW !== 15;
    const _hornEquipped = state.inventory?.equipped?.some(a => a?.id === 'heralds_horn');
    if (_isHeraldNext || (_isBossNext && _hornEquipped)) {
      const _warnTxt = _isHeraldNext ? '📯 The Proud Herald Approaches' : '👑 Boss Wave ' + _nextW + ' Approaches';
      const _warnSub = _isHeraldNext ? 'Prepare for Wave ' + _nextW : 'A powerful foe comes next wave';
      state.heraldWarn = { tick: state.ticks, text: _warnTxt, sub: _warnSub };
    }
    // Boss strip — show description at bottom of screen for all boss/special upcoming waves
    _updateBossStrip(_nextW);
    // Observations feed entries
    if (state.wave === 1 && !state._obs1) { state._obs1 = true; addFeed('obs', 'Castle defense initiated. First wave approaching. Towers: ' + state.towers.filter(t=>t.type!=='castle').length + '. Lives: ' + state.lives + '. The path comes from the forest.'); }
    if (state.wave === 5 && !state._obs5) { state._obs5 = true; addFeed('obs', 'The path continues past the castle. The path does not stop at the castle wall. It continues for several tiles and then the map ends. The map ending is not the same as the path ending. We do not know what is on the other side of the map edge. We have been assuming the goblins do not know either. We are less sure of this than we were.'); }
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

export function dropLoot(x, y, section, item) {
  x = Math.max(0, Math.min(state.COLS, Math.round(x)));
  y = Math.max(0, Math.min(state.ROWS - 1, Math.round(y)));
  const cell = getCell(x, y);
  if (!cell) return;
  if (!cell.stacks) cell.stacks = [null, null, null, null];
  // Find an empty slot; if full, evict a non-bossLoot stack
  let slot = cell.stacks.findIndex(s => !s);
  if (slot === -1) {
    slot = cell.stacks.findIndex(s => !s?.bossLoot);
    if (slot === -1) slot = 0; // all boss loot — overwrite slot 0
  }
  cell.stacks[slot] = { bossLoot: true, section, item, count: 1 };
}

/* ═══ Game flow ═══ */
export function startGame() {
  patchIronIcons();
  _ΨΔ(() => { _wG(100); _wL(state.maxLives || 3); });
  if (!state.worldGenChoices.wave10Blueprint)
    state.worldGenChoices.wave10Blueprint = Math.random() < 0.5 ? 'clown' : 'lizard';
  if (!state.research) state.research = buildResearchGraph();
  resetResPos();
  state.started = true; state.phase = 'prep'; state.prepTicks = 3600;
  invalidateBg(); initSz(); hideOv(); hudU(); panelU();
  initWeather();
  syncInvBtn();
  addFeed('system', 'The siege begins.');
  bus.emit('trigger', { type: 'game_start' });
  bus.emit('trigger', { type: 'wave_prep', wave: 1 });
}

export function startWave() {
  const _stripEl = document.getElementById('bossStrip');
  if (_stripEl) _stripEl.style.display = 'none';
  if (state.wave !== 22) stopHum(); // let hum run through wave 23 (started at end of wave 22)
  state.wave++;
  for (const tw of state.towers) tw.wavesAlive = (tw.wavesAlive || 0) + 1;
  // Spider Mother event: if ceasefire raised + seed stone placed + spider wave incoming
  const _spiderWave = state.wave >= 24 && !state.spiderRitualDone && !isBossWave(state.wave);
  if (_spiderWave && state.ceasefire && state.seedStone && !state.seedStone.carried) {
    state.spawnQueue = [];
    state.spawnTimer = 30; state.phase = 'active';
    spawnSpiderMother();
    showBanner('🕷️ Spider Mother');
    addFeed('event', '🕷️ The Spider Mother approaches. Towers are standing down.');
    hideOv(); hudU(); panelU();
    return;
  }
  state.spawnQueue = genWave(state.wave); // may set state.fogWave for wave 15
  state.spawnTimer = 30; state.phase = 'active';
  hideOv();
  if (state.fogWave) {
    showBanner('🌫️ Considerate Fog');
    addFeed('boss', '🌫️ The Considerate Fog rolls in...');
    sfxBoss();
  } else {
    const heraldWave = state.spawnQueue.some(e => e.herald);
    const boss = isBossWave(state.wave) && state.wave !== 5 && state.wave !== 15;
    if (heraldWave) {
      showBanner('📯 Proud Herald');
      sfxBoss();
    } else {
      // Check if this is an auditor wave
      const _auditorWave = state.spawnQueue.some(e => e.auditor);
      const _watcherWave = state.spawnQueue.some(e => e.watcher);
      if (_auditorWave) {
        showBanner('🏛️ Curious Auditor');
        sfxBoss();
        // Speak initial arrival line
        speak("I have arrived to audit your expenditures.");
        addFeed('boss', '🏛️ "I have arrived to audit your expenditures."');
        { const _el = document.getElementById('bossStrip'); if (_el) { _el.textContent = '🏛️ "I have arrived to audit your expenditures."'; _el.style.display = 'block'; } }
      } else if (_watcherWave) {
        showBanner('🔮 The Patient Watcher');
      } else {
        showBanner(boss ? '👑 BOSS W' + state.wave : '⚔️ Wave ' + state.wave);
        addFeed(boss ? 'boss' : 'wave', boss ? 'Boss Wave ' + state.wave + '!' : 'Wave ' + state.wave + ' begins.');
        if (boss) sfxBoss();
      }
    }
  }
  hudU(); panelU();
}

export function startPrep() {
  state.phase = 'prep'; state.prepTicks = 1800;
  invalidateBg();
  clampCam(); hideTT(); hudU(); panelU();
}

export function resetGame() {
  _ΨΔ(() => { _wG(100); _wL(state.maxLives || 3); });
  Object.assign(state, {
    wave: 0, phase: 'idle', ticks: 0, prepTicks: 0,
    enemies: [], towers: [], projectiles: [], particles: [], beams: [], bees: [],
    spawnQueue: [], volcanoActive: null, freezeActive: 0,
    gameOver: false, started: false, pathReady: false, paused: false, sel: null, ttTower: null,
    nodes: [], resources: {}, npcs: [], firedTriggerLines: new Set(), weather: { id: 'clear', wavesLeft: 1 }, fogWave: false, fogStartTick: 0, heraldWarn: null, hasHeraldHorn: false, pip: null, research: null, researchUnlocks: {}, unlockedTowers: new Set(['squirrel','lion','penguin']), bSen: new Set(['sleepy_door']), age: 'stone', weightOfBones: false,
    traps: [], webs: [],
    namedBossIndex: 0, auditorActive: false, watcherEscaped: false, watcherAppeared: false, _acAnomalyDone: false, spiderRitualDone: false, spiderMother: null, ceasefire: false, seedStone: null, cameraShake: 0,
    inventory: { artifacts: [], augments: [], blueprints: [], consumables: [], equipped: [null], seenSections: {} },
    worldGenChoices: {}, totalGoblinsKilled: 0, totalGoldEarned: 0, maxLives: 3,
    frequencyPlayed: false, secondFrequencyPlayed: false, _gemWave: null, belts: [], _beltStart: null, _torquePhase: 0,
    _seenResources: new Set(['stone', 'wood', 'dust']),
    patternRecDone: false, translationStep: 0, _translationWaveCount: 0, _forgeScriberFired: false, _pendingBSen: null, forgeAnnounce: null,
    _obs1: false, _obs5: false,
    cam: { panX: undefined, panY: undefined, zoom: 1, targetZoom: 1, focalX: 0, focalY: 0, focalSx: 0, focalSy: 0 },
    _Σ: 0, _Ω: 0,
  });

  for (const tree of Object.values(TOWER_SKILLS)) for (const s of Object.values(tree)) s.owned = false;
  state.pathSet.clear(); state.grid = [];
  clearFeed();
  initSz();
  resetMusic();
  clearSave(); hideTT(); startGame();
}

/* ═══ Loop ═══ */
const TICK_MS = 1000 / 60;
let lastP = 0, _lastTime = 0, _accum = 0;
function loop(timestamp) {
  const now = typeof timestamp === 'number' ? timestamp : performance.now();
  const dt = Math.min(now - (_lastTime || now), 50); // clamp spike frames
  _lastTime = now;
  _accum += dt;
  if (measure()) invalidateBg();
  updateCameraKeys();
  const cam = state.cam;
  if (Math.abs(cam.zoom - cam.targetZoom) > 0.0005) {
    cam.zoom += (cam.targetZoom - cam.zoom) * 0.18;
    cam.panX = cam.focalX - cam.focalSx / cam.zoom;
    cam.panY = cam.focalY - cam.focalSy / cam.zoom;
    clampCam();
  }
  try {
    while (_accum >= TICK_MS) { update(); _accum -= TICK_MS; }
    render(); updateNpcBubble();
  } catch (e) {
    console.error('[goblin-siege] loop error:', e);
    _accum = 0;
  }
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
initSaveUI(); initBestiaryUI(); initResearchUI(); initInventoryUI(); initCraftUI(); initNpcUI(); initPipUI();
RESEARCH_DATA_READY.then(() => {
  const _sv = hasSave() && loadGame();
  initSz(); panelU(); hudU(); loop();
  showWelcome(VERSION, _sv ? startPrep : startGame);
  import('./dev.js').then(m => m.initDev(state, hudU)).catch(() => {});
});
