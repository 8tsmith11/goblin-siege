'use strict';
import { state, _ΨΔ, clampCam, minZoom } from './main.js';
import { iA, sfxPlace, sfxLizard, speak } from './audio.js';
import { TD } from './data.js';
import { spawnBees } from './support.js';
import { canPlace } from './render.js';
import { showTT, hideTT, showTip, showBanner, panelU, hudU, mkGain } from './ui.js';
import { clickNode, RTYPES } from './resources.js';
import { initMonkeys } from './monkeys.js';

function cell(e) {
  const r = state.cv.getBoundingClientRect();
  const sx = (e.clientX ?? e.touches?.[0]?.clientX ?? e.changedTouches?.[0]?.clientX ?? 0) - r.left;
  const sy = (e.clientY ?? e.touches?.[0]?.clientY ?? e.changedTouches?.[0]?.clientY ?? 0) - r.top;
  const { cam, CELL } = state;
  const wx = sx / cam.zoom + cam.panX;
  const wy = sy / cam.zoom + cam.panY;
  return { x: Math.floor(wx / CELL), y: Math.floor(wy / CELL), px: sx, py: sy };
}

function handleStackInteraction(c, e) {
  const glCell = state.grid[c.y]?.[c.x];
  if (glCell && glCell.stacks) {
    const slots = [
      {dx: 0.25, dy: 0.25}, {dx: 0.75, dy: 0.75}, {dx: 0.75, dy: 0.25}, {dx: 0.25, dy: 0.75}
    ];
    let closestIndex = -1;
    let minDist = Infinity;
    const { cam, CELL } = state;
    const wx = c.px / cam.zoom + cam.panX;
    const wy = c.py / cam.zoom + cam.panY;
    
    for (let i = 0; i < 4; i++) {
      if (!glCell.stacks[i]) continue;
      const sx = c.x * CELL + slots[i].dx * CELL;
      const sy = c.y * CELL + slots[i].dy * CELL;
      const d = Math.hypot(wx - sx, wy - sy);
      if (d < minDist && d < CELL * 0.45) { // generous radius
        minDist = d;
        closestIndex = i;
      }
    }
    
    if (closestIndex !== -1) {
      const stack = glCell.stacks[closestIndex];
      stack.count--;
      state.resources[stack.type] = (state.resources[stack.type] || 0) + 1;
      const rt = RTYPES[stack.type];
      mkGain(c.x * CELL + slots[closestIndex].dx * CELL, c.y * CELL + slots[closestIndex].dy * CELL, rt.icon, 1, rt.clr);
      hudU();
      if (stack.count <= 0) glCell.stacks[closestIndex] = null;
      return true;
    }
  }
  return false;
}

function handleNodeInteraction(c) {
  const node = state.nodes?.find(n => n.x === c.x && n.y === c.y);
  if (node) { clickNode(node); return true; }
  return false;
}

function tryPlaceTower(c, ex) {
  if (ex || !canPlace(c.x, c.y)) {
    state.sel = null; hideTT(); state.ttTower = null; panelU();
    if (ex) { showTT(ex, c.px, c.py); }
    else if (state.pathSet?.has(c.x + ',' + c.y)) { showTip("Path tile — towers go on dark squares."); }
    return;
  }
  
  if (state.gold < state.sel.cost) { showTip('Not enough gold!'); return; }
  if (state.sel.resCost) {
    for (const [res, amt] of Object.entries(state.sel.resCost)) {
      if ((state.resources[res] || 0) < amt) {
        showTip('Not enough ' + res + '!'); return;
      }
    }
  }

  if (state.sel.key === 'lab' && state.towers.some(t => t.type === 'lab')) { 
    showTip('Only one Lab allowed per map!'); 
    state.sel = null; hideTT(); state.ttTower = null; panelU();
    return; 
  }

  let tw;
  _ΨΔ(() => {
    state.gold -= state.sel.cost;
    if (state.sel.resCost) {
      for (const [res, amt] of Object.entries(state.sel.resCost)) {
        state.resources[res] -= amt;
      }
    }
    const def = TD[state.sel.key];
    tw = {
      type: state.sel.key, x: c.x, y: c.y, level: 0, cd: 0, _buffed: false, _rateBuff: 1,
      dmg: def?.dmg || 0, range: def?.range || 0, rate: def?.rate || 60,
      splash: def?.splash || 0, slow: def?.slow || 0, pierce: def?.pierce || 0, chain: def?.chain || 0,
      stun: 0, poison: null, blind: false, bloodlust: false, blizzard: false, seeInvis: false,
      chainStun: 0, megaSpeed: false, frenzy: false, disabledWave: -1,
    };
    if (tw.type === 'clown') { tw.reverseRange = TD.clown.reverseRange; tw.reverseDur = TD.clown.reverseDur; tw.reverseCD = TD.clown.reverseCD; }
    if (tw.type === 'robot') tw.cd = 100;
    if (tw.type === 'beehive') { const d = TD.beehive; tw.beeCount = d.beeCount; tw.beeDmg = d.beeDmg; tw.beeRange = d.beeRange; tw.beeRate = d.beeRate; }
    if (tw.type === 'hoard') { tw.dep = { wood: 0, stone: 0 }; }
    if (tw.type === 'stockpile') { tw.slots = [null, null, null, null]; tw.mode = 'storage'; }
    if (tw.type === 'lab') { tw.obsRange = TD.lab.obsRange; }
    if (tw.type === 'monkey') {
      tw.range = TD.monkey.range;
      const cap = 1 + (state.researchUnlocks?.monkey_capacity || 0);
      tw.monkeys = initMonkeys(cap);
      const hcx = c.x * state.CELL + state.CELL / 2, hcy = c.y * state.CELL + state.CELL / 2;
      tw.monkeys.forEach(mk => {
        mk.x = hcx + Math.cos(mk.patrolAngle) * state.CELL * 0.6;
        mk.y = hcy + Math.sin(mk.patrolAngle) * state.CELL * 0.6;
      });
    }
    state.towers.push(tw);
    state.grid[c.y][c.x].type = 'tower';
    state.grid[c.y][c.x].content = tw;
    state.bSen.add(tw.type);
  });
  sfxPlace();
  if (tw.type === 'beehive') spawnBees(tw);
  if (tw.type === 'lizard') { sfxLizard(); showBanner('🦎 "' + TD.lizard.voiceLine + '"'); speak(TD.lizard.voiceLine); }

  // Remove any resource node on this tile
  state.nodes = state.nodes?.filter(n => !(n.x === c.x && n.y === c.y)) ?? [];
  state.sel = null;
  hudU(); panelU();
}

function handleTap(e) {
  iA();
  const c = cell(e);
  if (c.x < 0 || c.x >= state.COLS || c.y < 0 || c.y >= state.ROWS) return;
  const ex = state.towers.find(t => t.x === c.x && t.y === c.y);

  // Tile-pick mode: record clicked tile for monkey role config
  if (state.sel?.type === 'tile_pick') {
    const { monkey, hut, field } = state.sel;
    if (hut && Math.hypot(c.x - hut.x, c.y - hut.y) > (hut.range || 4)) {
      showTip('Out of range!');
      return;
    }
    monkey.cfg[field] = { x: c.x, y: c.y };
    monkey.st = 'idle';
    state.sel = null;
    showTip('Position set!');
    panelU();
    return;
  }

  if (!state.sel) {
    if (handleStackInteraction(c, e)) return;
    if (handleNodeInteraction(c)) return;
  }

  if (state.sel && state.sel.type !== 'spell') {
    tryPlaceTower(c, ex);
    return;
  }

  hideTT(); state.ttTower = null;
  if (ex) { if (state.ttTower === ex) { hideTT(); state.ttTower = null; } else showTT(ex, c.px, c.py); }
}

// ── Keyboard pan ──────────────────────────────────────────────────────────────
const keysDown = new Set();

export function updateCameraKeys() {
  if (!keysDown.size) return;
  const PAN = 20 / state.cam.zoom;
  let dx = 0, dy = 0;
  if (keysDown.has('ArrowLeft')  || keysDown.has('a') || keysDown.has('A')) dx -= PAN;
  if (keysDown.has('ArrowRight') || keysDown.has('d') || keysDown.has('D')) dx += PAN;
  if (keysDown.has('ArrowUp')    || keysDown.has('w') || keysDown.has('W')) dy -= PAN;
  if (keysDown.has('ArrowDown')  || keysDown.has('s') || keysDown.has('S')) dy += PAN;
  if (dx || dy) { state.cam.panX += dx; state.cam.panY += dy; clampCam(); }
}

export function initInput() {
  const cv = state.cv;

  document.addEventListener('keydown', e => {
    const nav = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
    if (nav.includes(e.key)) e.preventDefault();
    if (e.key === 'Escape' && state.sel?.type === 'tile_pick') { state.sel = null; panelU(); return; }
    keysDown.add(e.key);
  });
  document.addEventListener('keyup', e => keysDown.delete(e.key));
  window.addEventListener('blur', () => keysDown.clear());

  // ── Mouse pan + zoom ────────────────────────────────────────────────────────
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
    const cam = state.cam;
    const mz = minZoom(), newTarget = Math.max(mz, Math.min(4, cam.targetZoom * (e.deltaY < 0 ? 1.12 : 0.89)));
    // Store focal world point at CURRENT zoom (before target changes)
    cam.focalX = sx / cam.zoom + cam.panX;
    cam.focalY = sy / cam.zoom + cam.panY;
    cam.focalSx = sx; cam.focalSy = sy;
    cam.targetZoom = newTarget;
  }, { passive: false });

  // ── Touch pan + pinch ───────────────────────────────────────────────────────
  let touchMoved = false, touchPanStart = null, lastPinchDist = 0, lastPinchMid = null;

  cv.addEventListener('touchstart', e => {
    touchMoved = false;
    if (e.touches.length === 1 && !state.sel) {
      const t = e.touches[0];
      touchPanStart = { x: t.clientX, y: t.clientY, panX: state.cam.panX, panY: state.cam.panY };
    }
    if (e.touches.length === 2) {
      const [a, b] = e.touches;
      lastPinchDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const r = cv.getBoundingClientRect();
      lastPinchMid = { sx: (a.clientX + b.clientX) / 2 - r.left, sy: (a.clientY + b.clientY) / 2 - r.top };
      touchPanStart = null;
    }
  }, { passive: true });

  cv.addEventListener('touchmove', e => {
    e.preventDefault(); touchMoved = true;
    const cam = state.cam;
    if (e.touches.length === 2) {
      const [a, b] = e.touches;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const r = cv.getBoundingClientRect();
      const sx = (a.clientX + b.clientX) / 2 - r.left, sy = (a.clientY + b.clientY) / 2 - r.top;
      const mz = minZoom(), newTarget = Math.max(mz, Math.min(4, cam.targetZoom * (dist / lastPinchDist)));
      cam.focalX = lastPinchMid.sx / cam.zoom + cam.panX;
      cam.focalY = lastPinchMid.sy / cam.zoom + cam.panY;
      cam.focalSx = lastPinchMid.sx; cam.focalSy = lastPinchMid.sy;
      cam.targetZoom = newTarget;
      lastPinchDist = dist; lastPinchMid = { sx, sy }; touchPanStart = null;
    } else if (e.touches.length === 1 && touchPanStart && !state.sel) {
      const t = e.touches[0];
      cam.panX = touchPanStart.panX - (t.clientX - touchPanStart.x) / cam.zoom;
      cam.panY = touchPanStart.panY - (t.clientY - touchPanStart.y) / cam.zoom;
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
