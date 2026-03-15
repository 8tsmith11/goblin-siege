'use strict';
import { state, _ΨΔ } from './main.js';
import { iA, sfxPlace, sfxLizard, speak } from './audio.js';
import { TD } from './towers.js';
import { SD, spawnBees } from './support.js';
import { canPlace } from './render.js';
import { showTT, hideTT, showTip, showBanner, panelU, hudU } from './ui.js';

function cell(e) {
  const r = state.cv.getBoundingClientRect();
  const ex = (e.clientX ?? e.touches?.[0]?.clientX ?? e.changedTouches?.[0]?.clientX ?? 0) - r.left;
  const ey = (e.clientY ?? e.touches?.[0]?.clientY ?? e.changedTouches?.[0]?.clientY ?? 0) - r.top;
  return { x: Math.floor(ex / state.CELL), y: Math.floor(ey / state.CELL), px: ex, py: ey };
}

function handleTap(e) {
  iA();
  const c = cell(e);
  if (c.x < 0 || c.x >= state.COLS || c.y < 0 || c.y >= state.ROWS) return;
  const ex = state.towers.find(t => t.x === c.x && t.y === c.y);

  // In build mode: clicking an occupied or unplaceable tile exits build mode,
  // then falls through to normal tile behaviour (open tooltip if tower present).
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

    // Deselect after placement — player must re-select to place again
    state.sel = null;
    hudU(); panelU();
    return;
  }

  // Normal mode: toggle tooltip on existing tower
  hideTT(); state.ttTower = null;
  if (ex) { if (state.ttTower === ex) { hideTT(); state.ttTower = null; } else showTT(ex, c.px, c.py); }
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
  document.addEventListener('click', e => { iA(); if (!e.target.closest('#tt') && !e.target.closest('#cv')) { hideTT(); state.ttTower = null; } });
}
