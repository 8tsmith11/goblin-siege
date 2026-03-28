'use strict';
import { state, _ΨΔ, clampCam } from './main.js';
import { iA, sfxPlace, sfxLizard, speak } from './audio.js';
import { TD } from './towers.js';
import { SD, spawnBees } from './support.js';
import { canPlace } from './render.js';
import { showTT, hideTT, showTip, showBanner, panelU, hudU } from './ui.js';

function cell(e) {
  const r = state.cv.getBoundingClientRect();
  const sx = (e.clientX ?? e.touches?.[0]?.clientX ?? e.changedTouches?.[0]?.clientX ?? 0) - r.left;
  const sy = (e.clientY ?? e.touches?.[0]?.clientY ?? e.changedTouches?.[0]?.clientY ?? 0) - r.top;
  const { cam, CELL } = state;
  const wx = sx / cam.zoom + cam.panX;
  const wy = sy / cam.zoom + cam.panY;
  return { x: Math.floor(wx / CELL), y: Math.floor(wy / CELL), px: sx, py: sy };
}

function handleTap(e) {
  iA();
  const c = cell(e);
  if (c.x < 0 || c.x >= state.COLS || c.y < 0 || c.y >= state.ROWS) return;
  const ex = state.towers.find(t => t.x === c.x && t.y === c.y);

  if (state.sel && state.sel.type !== 'spell') {
    if (ex || !canPlace(c.x, c.y)) {
      state.sel = null; hideTT(); state.ttTower = null; panelU();
      if (ex) { showTT(ex, c.px, c.py); }
      else if (state.pathSet?.has(c.x + ',' + c.y)) { showTip("Path tile — towers go on dark squares."); }
      return;
    }
    if (state.gold < state.sel.cost) { showTip('Not enough gold!'); return; }

    let tw;
    _ΨΔ(() => {
      state.gold -= state.sel.cost;
      const def = TD[state.sel.key] || SD[state.sel.key];
      tw = {
        type: state.sel.key, x: c.x, y: c.y, level: 0, cd: 0, _buffed: false, _rateBuff: 1,
        dmg: def?.dmg || 0, range: def?.range || 0, rate: def?.rate || 60,
        splash: def?.splash || 0, slow: def?.slow || 0, pierce: def?.pierce || 0, chain: def?.chain || 0,
        stun: 0, poison: null, blind: false, bloodlust: false, blizzard: false, seeInvis: false,
        chainStun: 0, megaSpeed: false, frenzy: false, disabledWave: -1,
      };
      if (tw.type === 'clown') { tw.reverseRange = SD.clown.reverseRange; tw.reverseDur = SD.clown.reverseDur; tw.reverseCD = SD.clown.reverseCD; }
      if (tw.type === 'robot') tw.cd = 100;
      if (tw.type === 'beehive') { const d = SD.beehive; tw.beeCount = d.beeCount; tw.beeDmg = d.beeDmg; tw.beeRange = d.beeRange; tw.beeRate = d.beeRate; }
      if (tw.type === 'factory') { tw.hasLaser = false; tw.laserCD = 0; }
      state.towers.push(tw);
      state.grid[c.y][c.x] = 2;
    });
    sfxPlace();
    if (tw.type === 'beehive') spawnBees(tw);
    if (tw.type === 'lizard') { sfxLizard(); showBanner('🦎 "' + TD.lizard.voiceLine + '"'); speak(TD.lizard.voiceLine); }

    state.sel = null;
    hudU(); panelU();
    return;
  }

  hideTT(); state.ttTower = null;
  if (ex) { if (state.ttTower === ex) { hideTT(); state.ttTower = null; } else showTT(ex, c.px, c.py); }
}

export function initInput() {
  const cv = state.cv;

  // ── Mouse pan + zoom ──────────────────────────────────────────────────────
  let mouseDragStart = null, mouseDragged = false;

  cv.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    mouseDragStart = { x: e.clientX, y: e.clientY, panX: state.cam.panX, panY: state.cam.panY };
    mouseDragged = false;
  });

  cv.addEventListener('mousemove', e => {
    if (mouseDragStart && !state.sel) {
      const dx = e.clientX - mouseDragStart.x, dy = e.clientY - mouseDragStart.y;
      if (!mouseDragged && Math.hypot(dx, dy) > 4) mouseDragged = true;
      if (mouseDragged) {
        state.cam.panX = mouseDragStart.panX - dx / state.cam.zoom;
        state.cam.panY = mouseDragStart.panY - dy / state.cam.zoom;
        clampCam(); state.gCell = null; return;
      }
    }
    const c = cell(e);
    state.gCell = (c.x >= 0 && c.x < state.COLS && c.y >= 0 && c.y < state.ROWS) ? c : null;
  });

  cv.addEventListener('mouseup', () => { mouseDragStart = null; });
  cv.addEventListener('mouseleave', () => { state.gCell = null; mouseDragStart = null; mouseDragged = false; });

  cv.addEventListener('click', e => { if (!mouseDragged) handleTap(e); });

  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const r = cv.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const oldZoom = state.cam.zoom;
    const newZoom = Math.max(0.5, Math.min(4, oldZoom * (e.deltaY < 0 ? 1.12 : 0.89)));
    const wx = sx / oldZoom + state.cam.panX, wy = sy / oldZoom + state.cam.panY;
    state.cam.zoom = newZoom;
    state.cam.panX = wx - sx / newZoom;
    state.cam.panY = wy - sy / newZoom;
    clampCam();
  }, { passive: false });

  // ── Touch pan + pinch zoom ────────────────────────────────────────────────
  let touchMoved = false, touchPanStart = null, lastPinchDist = 0;

  cv.addEventListener('touchstart', e => {
    touchMoved = false;
    if (e.touches.length === 1 && !state.sel) {
      const t = e.touches[0];
      touchPanStart = { x: t.clientX, y: t.clientY, panX: state.cam.panX, panY: state.cam.panY };
    }
    if (e.touches.length === 2) {
      const [a, b] = e.touches;
      lastPinchDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      touchPanStart = null;
    }
  }, { passive: true });

  cv.addEventListener('touchmove', e => {
    e.preventDefault(); touchMoved = true;
    if (e.touches.length === 2) {
      const [a, b] = e.touches;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const r = cv.getBoundingClientRect();
      const mx = (a.clientX + b.clientX) / 2 - r.left, my = (a.clientY + b.clientY) / 2 - r.top;
      const oldZoom = state.cam.zoom;
      const newZoom = Math.max(0.5, Math.min(4, oldZoom * (dist / lastPinchDist)));
      const wx = mx / oldZoom + state.cam.panX, wy = my / oldZoom + state.cam.panY;
      state.cam.zoom = newZoom;
      state.cam.panX = wx - mx / newZoom;
      state.cam.panY = wy - my / newZoom;
      clampCam(); lastPinchDist = dist; touchPanStart = null;
    } else if (e.touches.length === 1 && touchPanStart && !state.sel) {
      const t = e.touches[0];
      state.cam.panX = touchPanStart.panX - (t.clientX - touchPanStart.x) / state.cam.zoom;
      state.cam.panY = touchPanStart.panY - (t.clientY - touchPanStart.y) / state.cam.zoom;
      clampCam(); state.gCell = null;
    } else if (state.sel) {
      const c = cell(e);
      state.gCell = (c.x >= 0 && c.x < state.COLS && c.y >= 0 && c.y < state.ROWS) ? c : null;
    }
  }, { passive: false });

  cv.addEventListener('touchend', e => {
    e.preventDefault();
    if (e.touches.length < 2) touchPanStart = null;
    if (!touchMoved) handleTap(e);
    if (e.touches.length === 0) state.gCell = null;
  }, { passive: false });

  document.addEventListener('click', e => { iA(); if (!e.target.closest('#tt') && !e.target.closest('#cv')) { hideTT(); state.ttTower = null; } });
}
