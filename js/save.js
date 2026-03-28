'use strict';
import { state, _ΨΔ, clampCam } from './main.js';
import { SKILLS } from './skills.js';
import { TOWER_SKILLS } from './towers.js';
import { spawnBees } from './support.js';
import { hudU, panelU, showBanner, showOv, hideTT } from './ui.js';

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
const _SK = new Set(['cd','_buffed','_rateBuff','laserCD','clownCD','robotCD']);
function _st(tw) {
  const o = {};
  for (const k of Object.keys(tw)) if (!_SK.has(k)) o[k] = tw[k];
  return o;
}

function _build() {
  if (!state.started || state.phase === 'active') return null;
  const ps = {}, ts = {};
  for (const [k, s] of Object.entries(SKILLS)) if (s.owned) ps[k] = 1;
  for (const [tp, tree] of Object.entries(TOWER_SKILLS)) {
    for (const [sk, s] of Object.entries(tree)) if (s.owned) { ts[tp] = ts[tp] || {}; ts[tp][sk] = 1; }
  }
  return {
    _ν: 1, _w: state.wave, _r: state.gold, _h: state.lives, _p: state.skillPts,
    _t: state.towers.map(_st), _g: state.grid, _a: state.path, ps, ts,
    _va: state.volcanoActive,
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
  for (const s of Object.values(SKILLS)) s.owned = false;
  for (const k of Object.keys(d.ps || {})) if (SKILLS[k]) SKILLS[k].owned = true;

  state.path = d._a;
  state.pathSet = new Set(d._a.map(p => p.x + ',' + p.y));
  state.grid = d._g;
  state.pathReady = true;

  state.towers = d._t.map(t => ({ ...t, cd: 0, _buffed: false, _rateBuff: 1 }));
  state.bees = [];
  state.towers.filter(tw => tw.type === 'beehive').forEach(tw => spawnBees(tw));

  state.enemies = []; state.projectiles = []; state.particles = []; state.beams = [];
  state.spawnQueue = []; state.spawnTimer = 0; state.freezeActive = 0;
  state.volcanoActive = d._va || null;
  state.sel = null; state.ttTower = null; state.gameOver = false;
  state.started = true; state.wave = d._w; state.phase = 'idle';
  state.ticks = 0; state.prepTicks = 0;

  _ΨΔ(() => { state.gold = d._r; state.lives = d._h; state.skillPts = d._p; });
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
  showOv('⚔️ Continue', 'Wave ' + d._w + ' complete — build & prepare.', 'Next Wave', false);
  return true;
}

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
  a.click();
  URL.revokeObjectURL(url);
}

export function importSave() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const stored = (ev.target.result || '').trim();
      const d = _unpack(stored);
      if (!d || d._ν !== 1) { showBanner('⚠️ Invalid save file'); return; }
      localStorage.setItem(_K, stored);
      _apply(d);
      showOv('📂 Save Imported', 'Wave ' + d._w + ' — build & prepare.', 'Next Wave', false);
    };
    reader.readAsText(file);
  };
  inp.click();
}

export function initSaveUI() {
  document.getElementById('svBtn')?.addEventListener('click', () => exportSave());
  document.getElementById('ldBtn')?.addEventListener('click', () => importSave());
}
