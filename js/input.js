'use strict';
import { state } from './main.js';
import { iA, sfxPlace, sfxLizard, speak } from './audio.js';
import { TD } from './towers.js';
import { SD, spawnBees } from './support.js';
import { canPlace } from './render.js';
import { showTT, hideTT, showTip, showBanner, panelU, hudU } from './ui.js';
import * as api from './api.js';
import { towerFromServer } from './main.js';

function cell(e) {
  const r = state.cv.getBoundingClientRect();
  const ex = (e.clientX ?? e.touches?.[0]?.clientX ?? e.changedTouches?.[0]?.clientX ?? 0) - r.left;
  const ey = (e.clientY ?? e.touches?.[0]?.clientY ?? e.changedTouches?.[0]?.clientY ?? 0) - r.top;
  return { x: Math.floor(ex / state.CELL), y: Math.floor(ey / state.CELL), px: ex, py: ey };
}

async function handleTap(e) {
  iA();
  const c = cell(e);
  if (c.x < 0 || c.x >= state.COLS || c.y < 0 || c.y >= state.ROWS) return;
  const ex = state.towers.find(t => t.x === c.x && t.y === c.y);
  if (ex && !state.sel) { if (state.ttTower === ex) { hideTT(); state.ttTower = null; } else showTT(ex, c.px, c.py); return; }
  hideTT(); state.ttTower = null;
  if (!state.sel || state.sel.type === 'spell') return;
  if (!canPlace(c.x, c.y)) { showTip("Can't place there!"); return; }
  if (state.gold < state.sel.cost) { showTip('Not enough gold!'); return; }

  try {
    const result = await api.placeTower(state.sel.key, c.x, c.y);
    state.gold = result.gold;
    sfxPlace();

    // Build frontend tower object from server response, with runtime defaults
    const st = result.tower;
    let tw = towerFromServer(st);
    // Support-specific runtime fields
    if (st.type === 'clown') { tw.cd = 0; tw.reverseRange = SD.clown.reverseRange; tw.reverseDur = SD.clown.reverseDur; tw.reverseCD = SD.clown.reverseCD; }
    if (st.type === 'robot') tw.cd = 100;
    if (st.type === 'beehive') { const d = SD.beehive; tw.beeCount = d.beeCount; tw.beeDmg = d.beeDmg; tw.beeRange = d.beeRange; tw.beeRate = d.beeRate; }
    if (st.type === 'factory') { tw.hasLaser = false; tw.laserCD = 0; }

    state.towers.push(tw);
    state.grid[c.y][c.x] = 2;

    if (st.type === 'beehive') spawnBees(tw);
    if (st.type === 'lizard') { sfxLizard(); showBanner('🦎 "' + TD.lizard.voiceLine + '"'); speak(TD.lizard.voiceLine); }

    hudU(); panelU();
  } catch (err) {
    showTip(err.message || 'Placement failed');
  }
}

export function initInput() {
  const cv = state.cv;
  cv.addEventListener('click', handleTap);
  let touchMoved = false;
  cv.addEventListener('touchstart', () => { touchMoved = false; }, { passive: true });
  cv.addEventListener('touchmove', e => { e.preventDefault(); touchMoved = true; const c = cell(e); state.gCell = (c.x >= 0 && c.x < state.COLS && c.y >= 0 && c.y < state.ROWS) ? c : null; }, { passive: false });
  cv.addEventListener('touchend', e => { e.preventDefault(); if (!touchMoved) handleTap(e); state.gCell = null; }, { passive: false });
  cv.addEventListener('mousemove', e => { const c = cell(e); state.gCell = (c.x >= 0 && c.x < state.COLS && c.y >= 0 && c.y < state.ROWS) ? c : null; });
  cv.addEventListener('mouseleave', () => { state.gCell = null; });
  document.addEventListener('click', e => { if (!e.target.closest('#tt') && !e.target.closest('#cv')) { hideTT(); state.ttTower = null; } });
}
