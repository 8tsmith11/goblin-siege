'use strict';
import { state, _ΨΔ, clampCam, startPrep, getCell } from './main.js';
import { TOWER_SKILLS } from './data.js';
import { spawnBees } from './support.js';
import { hudU, panelU, showBanner, showOv, hideOv, hideTT, resetResPos } from './ui.js';
import { getFeedLog, restoreFeed } from './feed.js';
import { reinitMonkeys } from './monkeys.js';
import { FIXED_RESEARCH, VARIABLE_RESEARCH, RESEARCH_JSON, refreshStatuses, buildResearchGraph } from './research.js';

// ─── Encode / decode ──────────────────────────────────────────────────────────
const _ψ = [0x47,0x6f,0x62,0x53,0x69,0x65,0x39,0x31,0x78,0x6b,0x37,0x5a];
const _K  = String.fromCharCode(0x5f,0x67,0x62,0x73,0x73,0x76);

function _ξ(s) {
  const b = new TextEncoder().encode(s), r = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) r[i] = b[i] ^ _ψ[i % _ψ.length] ^ (i * 107 & 255);
  return btoa(String.fromCharCode(...r));
}
function _ζ(s) {
  try {
    const b = Uint8Array.from(atob(s), c => c.charCodeAt(0)), r = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) r[i] = b[i] ^ _ψ[i % _ψ.length] ^ (i * 107 & 255);
    return new TextDecoder().decode(r);
  } catch (_e) { return null; }
}
function _χ(s) {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(36);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const _SK = new Set(['cd','_buffed','_rateBuff','laserCD','clownCD','robotCD','_monkeyBoosted','_monkeyBoostCount','webUsed']);
const _MK_SK = new Set(['st','x','y','carrying','patrolAngle','targetX','targetY','waitCd','_itemTarget']);
function _st(tw) {
  const o = {};
  for (const k of Object.keys(tw)) {
    if (_SK.has(k)) continue;
    if (k === 'monkeys' && Array.isArray(tw.monkeys)) {
      o.monkeys = tw.monkeys.map(mk => {
        const m = {};
        for (const mk_k of Object.keys(mk)) if (!_MK_SK.has(mk_k)) m[mk_k] = mk[mk_k];
        return m;
      });
    } else {
      o[k] = tw[k];
    }
  }
  return o;
}

function _build() {
  if (!state.started) return null;
  const ts = {};
  for (const [tp, tree] of Object.entries(TOWER_SKILLS)) {
    for (const [sk, s] of Object.entries(tree)) if (s.owned) { ts[tp] = ts[tp] || {}; ts[tp][sk] = 1; }
  }
  return {
    _ν: 1, _w: state.wave, _r: state.gold, _h: state.lives,
    _t: state.towers.map(_st), _g: state.grid, _a: state.path, ts,
    _va: state.volcanoActive,
    _no: state.nodes.map(n => ({ type: n.type, x: n.x, y: n.y })),
    _bSen: Array.from(state.bSen || ['sleepy_door']),
    _rs: { ...state.resources },
    _res: state.research ? Object.fromEntries(Object.entries(state.research).map(([id, n]) =>
      [id, { status: n.status, wavesLeft: n.wavesLeft, x: n.x, y: n.y, ...(n._sourceId ? { _sourceId: n._sourceId } : {}) }]
    )) : null,
    _rUnlocks: { ...(state.researchUnlocks || {}) },
    _unlocked: Array.from(state.unlockedTowers || []),
    _traps: (state.traps || []).filter(t => t.type !== 'sap'),
    _inv: state.inventory ? JSON.parse(JSON.stringify(state.inventory)) : null,
    _fl: getFeedLog(),
    _npcs: state.npcs || [],
    _ftl: Array.from(state.firedTriggerLines || []),
    _wx: state.weather || { id: 'clear', wavesLeft: 0 },
    _fog: state.fogWave || false,
    _fst: state.fogStartTick || 0,
    _hh: state.hasHeraldHorn || false,
    _pip: state.pip || null,
    _wgc: state.worldGenChoices || {},
    _tgk: state.totalGoblinsKilled || 0,
    _tge: state.totalGoldEarned || 0,
    _fp: state.frequencyPlayed || false,
    _prd: state.patternRecDone || false,
    _trs: state.translationStep || 0,
    _trwc: state._translationWaveCount || 0,
    _nbi: state.namedBossIndex || 0,
    _aud: state.auditorActive || false,
    _we: state.watcherEscaped || false,
    _srd: state.spiderRitualDone || false,
    _ss: state.seedStone || null,
  };
}

function _pack(d) {
  const raw = JSON.stringify(d);
  return _χ(raw) + '~' + _ξ(raw);
}

function _unpack(stored) {
  if (!stored) return null;
  const sep = stored.indexOf('~');
  if (sep < 0) return null;
  const raw = _ζ(stored.slice(sep + 1));
  if (!raw || _χ(raw) !== stored.slice(0, sep)) return null;
  try { return JSON.parse(raw); } catch (_e) { return null; }
}

// Re-point every grid cell's content reference to the live object in towers/nodes.
function _reconnectGrid(grid, towers, nodes) {
  for (const tw of towers) {
    const cell = getCell(tw.x, tw.y);
    if (cell) cell.content = tw;
  }
  for (const nd of nodes) {
    const cell = getCell(nd.x, nd.y);
    if (cell) cell.content = nd;
  }
}

function _apply(d) {
  for (const tree of Object.values(TOWER_SKILLS)) for (const s of Object.values(tree)) s.owned = false;
  for (const [tp, sks] of Object.entries(d.ts || {})) {
    for (const sk of Object.keys(sks)) if (TOWER_SKILLS[tp]?.[sk]) TOWER_SKILLS[tp][sk].owned = true;
  }

  state.path = d._a;
  state.pathSet = new Set(d._a.map(p => p.x + ',' + p.y));
  state.grid = d._g;
  state.pathReady = true;

  state.towers = d._t.map(t => ({ ...t, cd: 0, _buffed: false, _rateBuff: 1 }));
  reinitMonkeys(state.towers);
  state.nodes = (d._no || []).map(n => ({ ...n, wobbleTick: 0, cd: 0 }));
  // Reconnect grid cell.content for all content-bearing objects (towers + nodes).
  // JSON deserialisation produces fresh objects for both state.towers/state.nodes
  // and the embedded grid cells — they are distinct in memory, so mutations to one
  // (e.g. dropItem updating tw.stored, or income decay on state.towers) would
  // silently diverge.  This single pass re-unifies them.
  _reconnectGrid(state.grid, state.towers, state.nodes);
  state.resources = { ...(d._rs || {}) };
  // Rebuild the research graph fresh from current data, then overlay saved
  // progress (status, wavesLeft) and positions for matching nodes.
  // Pool slot content is restored via saved _sourceId before graph generation.
  const _savedRes = d._res || null;
  if (_savedRes) {
    // Collect saved pool slot assignments so buildResearchGraph can use them
    state._savedPoolSlots = {};
    for (const [id, s] of Object.entries(_savedRes)) {
      if (id.startsWith('pool_') && s._sourceId) state._savedPoolSlots[id] = s._sourceId;
    }
  }
  state.research = buildResearchGraph();
  delete state._savedPoolSlots;
  // Overlay saved status/wavesLeft and positions onto the fresh graph
  if (_savedRes && state.research) {
    for (const [id, saved] of Object.entries(_savedRes)) {
      const node = state.research[id];
      if (!node) continue;
      if (saved.status === 'complete' || saved.status === 'active') {
        node.status = saved.status;
        node.wavesLeft = saved.wavesLeft ?? node.wavesLeft;
      }
      if (saved.x !== undefined) node.x = saved.x;
      if (saved.y !== undefined) node.y = saved.y;
    }
    refreshStatuses(state.research);
  }
  resetResPos();
  state.researchUnlocks = { ...(d._rUnlocks || {}) };
  state.unlockedTowers = new Set(d._unlocked || ['squirrel','lion','penguin']);
  state.bSen = new Set(d._bSen || ['sleepy_door']);
  state.bees = [];
  state.towers.filter(tw => tw.type === 'beehive').forEach(tw => spawnBees(tw));

  state.enemies = []; state.projectiles = []; state.particles = []; state.beams = [];
  state.spawnQueue = []; state.spawnTimer = 0; state.freezeActive = 0;
  state.volcanoActive = d._va || null;
  state.traps = d._traps || [];
  state.inventory = d._inv || { artifacts: [], augments: [], blueprints: [], consumables: [], equipped: [null], seenSections: {} };
  if (!state.inventory.equipped) state.inventory.equipped = [null];
  if (!state.inventory.seenSections) state.inventory.seenSections = {};
  for (const bp of (state.inventory.blueprints || [])) {
    if (bp?.unlocks) state.unlockedTowers.add(bp.unlocks);
  }
  state.npcs = d._npcs || [];
  state.firedTriggerLines = new Set(d._ftl || []);
  state.weather = d._wx || { id: 'clear', wavesLeft: 0 };
  state.fogWave = d._fog || false;
  state.fogStartTick = d._fst || 0;
  state.hasHeraldHorn = d._hh || (d._inv?.augments?.some(a => a?.id === 'heralds_horn') ?? false);
  state.pip = d._pip || null;
  state.worldGenChoices = d._wgc || {};
  state.totalGoblinsKilled = d._tgk || 0;
  state.totalGoldEarned = d._tge || 0;
  state.frequencyPlayed = d._fp || false;
  state.patternRecDone = d._prd || false;
  state.translationStep = d._trs || 0;
  state._translationWaveCount = d._trwc || 0;
  state.namedBossIndex = d._nbi ?? 0;
  state.auditorActive = d._aud || false;
  state.watcherEscaped = d._we || false;
  state.spiderRitualDone = d._srd || false;
  state.seedStone = d._ss || null;
  state.ceasefire = state.towers.some(t => t.type === 'ceasefire_flag' && t.raised);
  state.sel = null; state.ttTower = null; state.gameOver = false;
  state.started = true; state.wave = d._w; state.phase = 'idle';
  state.ticks = 0; state.prepTicks = 0;
  _ΨΔ(() => { state.gold = d._r; state.lives = d._h; });
  clampCam(); hideTT(); hudU(); panelU();
  state.syncInvBtn?.();
  restoreFeed(d._fl);
}

// ─── Public API ───────────────────────────────────────────────────────────────
export function hasSave() { return !!localStorage.getItem(_K); }

export function autoSave() {
  const d = _build();
  if (d) localStorage.setItem(_K, _pack(d));
}

export function saveGame() {
  const d = _build();
  if (!d) { showBanner('⚠️ Can\'t save mid-wave'); return; }
  localStorage.setItem(_K, _pack(d));
  showBanner('💾 Saved!');
}

export function loadGame() {
  const d = _unpack(localStorage.getItem(_K));
  if (!d || d._ν !== 1) { localStorage.removeItem(_K); return false; }
  _apply(d);
  return true;
}

export function clearSave() { localStorage.removeItem(_K); }

export function exportSave() {
  const d = _build();
  if (d) localStorage.setItem(_K, _pack(d));
  const stored = localStorage.getItem(_K);
  if (!stored) { showBanner('⚠️ Nothing to export'); return; }
  const blob = new Blob([stored], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'goblin-siege-w' + state.wave + '.sav';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importSave() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.style.display = 'none';
  document.body.appendChild(inp);
  inp.onchange = e => {
    document.body.removeChild(inp);
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const stored = (ev.target.result || '').trim();
      const d = _unpack(stored);
      if (!d || d._ν !== 1) { showBanner('⚠️ Invalid save file'); return; }
      localStorage.setItem(_K, stored);
      _apply(d);
      hideOv(); startPrep();
      showBanner('📂 Wave ' + d._w + ' imported');
    };
    reader.readAsText(file);
  };
  inp.click();
}

export function initSaveUI() {
  document.getElementById('svBtn')?.addEventListener('click', () => exportSave());
  document.getElementById('ldBtn')?.addEventListener('click', () => importSave());
}
