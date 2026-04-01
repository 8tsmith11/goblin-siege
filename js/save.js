'use strict';
import { state, _ΨΔ, clampCam, startPrep } from './main.js';
import { TOWER_SKILLS } from './data.js';
import { spawnBees } from './support.js';
import { hudU, panelU, showBanner, showOv, hideOv, hideTT } from './ui.js';
import { reinitMonkeys } from './monkeys.js';

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
const _SK = new Set(['cd','_buffed','_rateBuff','laserCD','clownCD','robotCD','_monkeyBoosted','_monkeyBoostCount']);
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
    _res: state.research ? JSON.parse(JSON.stringify(state.research)) : null,
    _rUnlocks: { ...(state.researchUnlocks || {}) },
    _unlocked: Array.from(state.unlockedTowers || []),
    _traps: (state.traps || []).filter(t => t.type !== 'sap'),
    _inv: state.inventory ? JSON.parse(JSON.stringify(state.inventory)) : null,
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
  state.resources = { ...(d._rs || {}) };
  state.research = d._res || null;
  state.researchUnlocks = { ...(d._rUnlocks || {}) };
  state.unlockedTowers = new Set(d._unlocked || ['squirrel','lion','penguin','lab']);
  state.bSen = new Set(d._bSen || ['sleepy_door']);
  state.bees = [];
  state.towers.filter(tw => tw.type === 'beehive').forEach(tw => spawnBees(tw));

  state.enemies = []; state.projectiles = []; state.particles = []; state.beams = [];
  state.spawnQueue = []; state.spawnTimer = 0; state.freezeActive = 0;
  state.volcanoActive = d._va || null;
  state.traps = d._traps || [];
  state.inventory = d._inv || { artifacts: [], augments: [], blueprints: [], consumables: [], equipped: [null, null, null] };
  state.sel = null; state.ttTower = null; state.gameOver = false;
  state.started = true; state.wave = d._w; state.phase = 'idle';
  state.ticks = 0; state.prepTicks = 0;

  _ΨΔ(() => { state.gold = d._r; state.lives = d._h; });
  clampCam(); hideTT(); hudU(); panelU();
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
