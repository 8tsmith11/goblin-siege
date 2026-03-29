'use strict';
import { state } from './main.js';
import { TD } from './data.js';
import { renderNodes, renderStacks } from './resources.js';

const _imgPath = new Image(); _imgPath.src = 'assets/tiles/path.png';
const _imgGrassL = new Image(); _imgGrassL.src = 'assets/tiles/lightgrass.png';
const _imgGrassD = new Image(); _imgGrassD.src = 'assets/tiles/darkgrass.png';
const _imgCastle = new Image(); _imgCastle.src = 'assets/tiles/castle.png';

export function canPlace(cx2, cy2) {
  const { COLS, ROWS, pathSet, grid } = state;
  if (cx2 < 0 || cx2 >= COLS || cy2 < 0 || cy2 >= ROWS) return false;
  if (pathSet.has(cx2 + ',' + cy2)) return false;
  if (grid[cy2] && grid[cy2][cx2].type !== 'empty' && grid[cy2][cx2].type !== 'node') return false;
  return true;
}

let bgCache = null;

function updateBgCache() {
  const { CELL, COLS, ROWS, path } = state;
  if (!bgCache) bgCache = document.createElement('canvas');
  bgCache.width = COLS * CELL;
  bgCache.height = ROWS * CELL;
  const bcx = bgCache.getContext('2d');
  
  const grassReady = _imgGrassL.complete && _imgGrassL.naturalWidth && _imgGrassD.complete && _imgGrassD.naturalWidth;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (grassReady) {
      bcx.drawImage((r + c) % 2 === 0 ? _imgGrassD : _imgGrassL, c * CELL, r * CELL, CELL, CELL);
    } else {
      bcx.fillStyle = (r + c) % 2 === 0 ? '#131929' : '#151b2b';
      bcx.fillRect(c * CELL, r * CELL, CELL, CELL);
    }
  }

  // Path
  path.forEach(p => {
    if (_imgPath.complete && _imgPath.naturalWidth) {
      bcx.drawImage(_imgPath, p.x * CELL, p.y * CELL, CELL, CELL);
    } else {
      bcx.fillStyle = '#3a2518'; bcx.fillRect(p.x * CELL, p.y * CELL, CELL, CELL);
    }
  });
  if (path.length > 2) {
    bcx.fillStyle = 'rgba(34,197,94,.12)'; bcx.fillRect(path[0].x * CELL, path[0].y * CELL, CELL, CELL);
    bcx.font = Math.floor(CELL * 0.4) + 'px serif'; bcx.textAlign = 'center'; bcx.textBaseline = 'middle';
    bcx.fillStyle = '#22c55e77'; bcx.fillText('▶', path[0].x * CELL + CELL / 2, path[0].y * CELL + CELL / 2);
  }
}

const reqBgUpdate = () => { bgCache = null; };
_imgPath.onload = reqBgUpdate;
_imgGrassL.onload = reqBgUpdate;
_imgGrassD.onload = reqBgUpdate;

export function invalidateBg() { bgCache = null; }

export function render() {
  const { cx, W, H, CELL, COLS, ROWS, cam, path, ticks, freezeActive, volcanoActive,
          towers, bees, enemies, projectiles, beams, particles, sel, gCell, ttTower } = state;

  cx.clearRect(0, 0, W, H);
  cx.save();
  cx.setTransform(cam.zoom, 0, 0, cam.zoom, -cam.panX * cam.zoom, -cam.panY * cam.zoom);
  
  if (!bgCache && state.pathReady && CELL > 0) updateBgCache();
  if (bgCache) cx.drawImage(bgCache, 0, 0);

  // Resource Nodes & Stacks
  renderNodes();
  renderStacks();

  // Volcano
  if (volcanoActive) {
    const vx = volcanoActive.x * CELL + CELL / 2, vy = volcanoActive.y * CELL + CELL / 2;
    const pu = Math.sin(ticks * 0.1) * 0.15 + 0.85;
    cx.fillStyle = 'rgba(239,68,68,' + (0.08 * pu).toFixed(3) + ')';
    cx.beginPath(); cx.arc(vx, vy, CELL * 3, 0, Math.PI * 2); cx.fill();
    cx.font = Math.floor(CELL * 0.9) + 'px serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText('🌋', vx, vy);
  }

  // Towers
  towers.forEach(tw => {
    const px = tw.x * CELL + CELL / 2, py = tw.y * CELL + CELL / 2;
    if (ttTower === tw && tw.range) {
      cx.beginPath(); cx.arc(px, py, tw.range * CELL, 0, Math.PI * 2);
      cx.fillStyle = 'rgba(244,63,94,.04)'; cx.fill();
      cx.strokeStyle = 'rgba(244,63,94,.15)'; cx.lineWidth = 1; cx.stroke();
    }

    if (tw.type === 'clam') {
      const br = (tw.level + 1) * 1.5;
      cx.beginPath(); cx.arc(px, py, br * CELL, 0, Math.PI * 2);
      cx.fillStyle = 'rgba(94,234,212,.05)'; cx.fill();
      cx.strokeStyle = 'rgba(94,234,212,.12)'; cx.lineWidth = 1; cx.stroke();
    }
    if (tw.type === 'clown') {
      cx.beginPath(); cx.arc(px, py, (tw.reverseRange || 3) * CELL, 0, Math.PI * 2);
      cx.fillStyle = 'rgba(244,114,182,.04)'; cx.fill();
      cx.strokeStyle = 'rgba(244,114,182,.1)'; cx.lineWidth = 1; cx.stroke();
    }
    const isH = tw.type === 'hoard', def = TD[tw.type];
    const tx = Math.round(tw.x * CELL), ty = Math.round(tw.y * CELL);
    cx.fillStyle = tw.disabled ? '#1a0a0a' : isH ? '#0a3d2f' : tw._buffed ? '#1a2040' : '#171838';
    cx.fillRect(tx + 2, ty + 2, CELL - 4, CELL - 4);
    cx.strokeStyle = tw.disabled ? '#ef4444' : isH ? '#10b981' : tw._buffed ? '#5eead4' : (def?.clr || '#555');
    cx.lineWidth = tw._buffed ? 2 : 1.5; cx.strokeRect(tx + 2, ty + 2, CELL - 4, CELL - 4);
    cx.font = Math.floor(CELL * 0.35) + 'px serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText(isH ? '🏺' : (def?.icon || '?'), tx + CELL / 2, ty + CELL / 2);
    if (tw.level > 0) { cx.font = 'bold ' + Math.floor(CELL * 0.16) + 'px Anybody,sans-serif'; cx.fillStyle = '#fbbf24'; cx.fillText('★'.repeat(Math.min(tw.level, 5)), tx + CELL / 2, ty + CELL - 2); }
  });

  // Castle (end of path) — drawn oversized so it overlaps surrounding tiles
  if (path.length > 2 && _imgCastle.naturalWidth) {
    const lp = path[path.length - 1];
    const cs = CELL * 1.2;
    cx.drawImage(_imgCastle, lp.x * CELL + CELL / 2 - cs / 2, lp.y * CELL + CELL / 2 - cs / 2, cs, cs);
  }

  // Bees
  bees.forEach(bee => {
    if (bee.dead) return;
    cx.font = Math.floor(CELL * 0.3) + 'px serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText('🐝', bee.x, bee.y);
    if (ticks % 4 === 0) state.particles.push({ x: bee.x, y: bee.y, vx: 0, vy: 0, life: 8, clr: '#fbbf2444', sz: 1.5 });
  });

  // Enemies
  enemies.forEach(e => {
    if (e.dead) return;
    const px = e.x * CELL + CELL / 2, py = e.y * CELL + CELL / 2, sz = CELL * e.sz;
    if (e.stealth) cx.globalAlpha = 0.25;
    cx.fillStyle = 'rgba(0,0,0,.2)'; cx.beginPath(); cx.ellipse(px, py + sz * 0.3, sz * 0.4, sz * 0.12, 0, 0, Math.PI * 2); cx.fill();
    cx.fillStyle = e.clr + '22'; cx.beginPath(); cx.arc(px, py, sz + 2, 0, Math.PI * 2); cx.fill();
    cx.fillStyle = e.clr; cx.beginPath(); cx.arc(px, py, sz, 0, Math.PI * 2); cx.fill();
    cx.font = Math.floor(sz * (e.boss ? 1.3 : 1)) + 'px serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(e.em, px, py);
    if (e.stealth) cx.globalAlpha = 1;
    if (e.slow > 0) { cx.strokeStyle = '#67e8f9'; cx.lineWidth = 1; cx.beginPath(); cx.arc(px, py, sz + 2, 0, Math.PI * 2); cx.stroke(); }
    if (e.frozen > 0 || e.stunned > 0) { cx.strokeStyle = '#38bdf8'; cx.lineWidth = 2; cx.beginPath(); cx.arc(px, py, sz + 3, 0, Math.PI * 2); cx.stroke(); }
    if (e.reversed) { cx.strokeStyle = '#f472b6'; cx.lineWidth = 1.5; cx.setLineDash([3,3]); cx.beginPath(); cx.arc(px, py, sz + 4, 0, Math.PI * 2); cx.stroke(); cx.setLineDash([]); }
    if (e.poison) { cx.strokeStyle = '#84cc1666'; cx.lineWidth = 1; cx.beginPath(); cx.arc(px, py, sz + 5, 0, Math.PI * 2); cx.stroke(); }
    if (e.spdBuff > 0) { cx.strokeStyle = '#a3e63544'; cx.lineWidth = 1; cx.beginPath(); cx.arc(px, py, sz + 6, 0, Math.PI * 2); cx.stroke(); }
    const bw = CELL * 0.6, bh = e.boss ? 4 : 2.5, bx = px - bw / 2, by = py - sz - 5;
    cx.fillStyle = '#0f0f0f'; cx.fillRect(bx, by, bw, bh);
    const pct = e.hp / e.mhp; cx.fillStyle = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#f59e0b' : '#ef4444';
    cx.fillRect(bx, by, bw * Math.max(0, pct), bh);
    if (e.boss && ticks % 2 === 0) { cx.fillStyle = 'rgba(255,215,0,.12)'; cx.beginPath(); cx.arc(px, py, sz + 8 + Math.sin(ticks * 0.1) * 3, 0, Math.PI * 2); cx.fill(); }
  });

  // Projectiles
  projectiles.forEach(p => {
    const px = p.x * CELL + CELL / 2, py = p.y * CELL + CELL / 2;
    cx.fillStyle = p.clr; cx.beginPath(); cx.arc(px, py, 2.5, 0, Math.PI * 2); cx.fill();
    cx.fillStyle = p.clr + '44'; cx.beginPath(); cx.arc(px, py, 4, 0, Math.PI * 2); cx.fill();
  });

  // Beams
  beams.forEach(b => {
    cx.strokeStyle = b.clr; cx.lineWidth = b.w || 2; cx.globalAlpha = Math.min(1, b.life / 6);
    cx.beginPath(); cx.moveTo(b.x1, b.y1); cx.lineTo(b.x2, b.y2); cx.stroke();
    cx.strokeStyle = b.clr + '33'; cx.lineWidth = (b.w || 2) + 4;
    cx.beginPath(); cx.moveTo(b.x1, b.y1); cx.lineTo(b.x2, b.y2); cx.stroke();
  });
  cx.globalAlpha = 1;

  // Particles
  particles.forEach(p => { cx.globalAlpha = Math.max(0, p.life / 20); cx.fillStyle = p.clr; cx.beginPath(); cx.arc(p.x, p.y, p.sz, 0, Math.PI * 2); cx.fill(); }); cx.globalAlpha = 1;

  // Ghost placement preview
  if (sel && sel.type !== 'spell' && gCell) {
    const gx = gCell.x * CELL, gy = gCell.y * CELL, gpx = gx + CELL / 2, gpy = gy + CELL / 2;
    const ok = canPlace(gCell.x, gCell.y);
    // Range preview
    if (sel && sel.type !== 'spell') {
      const def = TD[sel.key];
      const previewRange = def?.range || 0;
      if (previewRange) {
        cx.beginPath(); cx.arc(gpx, gpy, previewRange * CELL, 0, Math.PI * 2);
        cx.fillStyle = 'rgba(244,63,94,.04)'; cx.fill();
        cx.strokeStyle = 'rgba(244,63,94,.15)';
        cx.lineWidth = 1; cx.stroke();
      }
    }
    cx.globalAlpha = ok ? 0.4 : 0.15;
    cx.fillStyle = ok ? '#ffffff11' : '#ff000022'; cx.fillRect(gx, gy, CELL, CELL);
    cx.font = Math.floor(CELL * 0.4) + 'px serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    const icon = TD[sel.key]?.icon || '?';
    cx.fillText(icon, gpx, gpy); cx.globalAlpha = 1;
  }

  cx.restore();
  if (freezeActive > 0) { cx.fillStyle = 'rgba(56,189,248,' + (0.06 + 0.03 * Math.sin(ticks * 0.2)) + ')'; cx.fillRect(0, 0, W, H); }
}
