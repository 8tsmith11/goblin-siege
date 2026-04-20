'use strict';
import { state, WORLD_COLS, WORLD_ROWS, getCell } from './main.js';
import { TD } from './data.js';
import { renderNodes, renderStacks, RTYPES, getItemDef } from './resources.js';

// ─── Rain drops (screen-space, persist across frames) ────────────────────────
const _rain = [];
function _ensureRain(W, H) {
  if (_rain.length) return;
  for (let i = 0; i < 140; i++) _rain.push({ x: Math.random() * W, y: Math.random() * H, spd: 14 + Math.random() * 8 });
}

// ─── Fog wisps (screen-space, Considerate Fog wave) ──────────────────────────
const _fogW = [];
export function clearFogParticles() { _fogW.length = 0; }
function _ensureFog(W, H) {
  if (_fogW.length) return;
  for (let i = 0; i < 32; i++) {
    _fogW.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 90 + Math.random() * 130,
      vx: 0.25 + Math.random() * 0.35,
      vy: (Math.random() - 0.5) * 0.12,
    });
  }
}

const _imgPath = new Image(); _imgPath.src = 'assets/tiles/path.png';
const _imgGrassL = new Image(); _imgGrassL.src = 'assets/tiles/lightgrass.png';
const _imgGrassD = new Image(); _imgGrassD.src = 'assets/tiles/darkgrass.png';
const _imgCastle = new Image(); _imgCastle.src = 'assets/tiles/castle.png';
const _imgHoard = new Image(); _imgHoard.src = 'assets/tiles/hoardpile.png';
const _imgForest = new Image(); _imgForest.src = 'assets/tiles/forest.png';
const _imgElder = new Image(); _imgElder.src = 'assets/tiles/elder.png';

export function canPlace(cx2, cy2) {
  const { COLS, ROWS, pathSet, grid } = state;
  if (cx2 < 0 || cx2 >= COLS || cy2 < 0 || cy2 >= ROWS) return false;
  const cell = getCell(cx2, cy2);
  if (!cell) return false;
  if (pathSet.has(cx2 + ',' + cy2)) return false;
  if (cell.type !== 'empty') return false;
  return true;
}

let bgCache = null;

function updateBgCache() {
  const { CELL, path, grid, COLS, ROWS } = state;
  if (!grid || !grid.length) return;
  if (!bgCache) bgCache = document.createElement('canvas');
  bgCache.width = COLS * CELL;
  bgCache.height = ROWS * CELL;
  const bcx = bgCache.getContext('2d');

  const grassReady = _imgGrassL.complete && _imgGrassL.naturalWidth && _imgGrassD.complete && _imgGrassD.naturalWidth;
  const forestReady = _imgForest.complete && _imgForest.naturalWidth;

  // Draw every cell in the full grid — forest cells get the forest tile, others get grass/water.
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const bx = c * CELL, by = r * CELL;
      const cellType = grid[r]?.[c]?.type;
      if (cellType === 'forest') {
        if (forestReady) {
          const ptrn = bcx.createPattern(_imgForest, 'repeat');
          bcx.fillStyle = ptrn;
          bcx.fillRect(bx, by, CELL, CELL);
        } else {
          bcx.fillStyle = '#0a1d1d';
          bcx.fillRect(bx, by, CELL, CELL);
        }
      } else if (cellType === 'water') {
        bcx.fillStyle = '#162d66'; bcx.fillRect(bx, by, CELL, CELL);
        bcx.strokeStyle = 'rgba(255,255,255,0.1)'; bcx.lineWidth = 1;
        bcx.beginPath(); bcx.moveTo(bx + 2, by + CELL / 2); bcx.bezierCurveTo(bx+CELL/4, by+CELL/4, bx+3*CELL/4, by+3*CELL/4, bx+CELL-2, by+CELL/2); bcx.stroke();
      } else {
        if (grassReady) {
          bcx.drawImage((r + c) % 2 === 0 ? _imgGrassD : _imgGrassL, bx, by, CELL, CELL);
        } else {
          bcx.fillStyle = (r + c) % 2 === 0 ? '#131929' : '#151b2b';
          bcx.fillRect(bx, by, CELL, CELL);
        }
      }
    }
  }

  // Path (pixel coords)
  path.forEach(p => {
    const bx = p.x * CELL, by = p.y * CELL;
    if (_imgPath.complete && _imgPath.naturalWidth) bcx.drawImage(_imgPath, bx, by, CELL, CELL);
    else { bcx.fillStyle = '#3a2518'; bcx.fillRect(bx, by, CELL, CELL); }
  });

  // Visual Path Extension — stretch right through forest to canvas edge
  if (path.length > 0) {
    const end = path[path.length - 1];
    bcx.fillStyle = '#3a2518';
    for (let x = end.x + 1; x < COLS; x++) {
      const bx = x * CELL, by = end.y * CELL;
      if (_imgPath.complete && _imgPath.naturalWidth) bcx.drawImage(_imgPath, bx, by, CELL, CELL);
      else bcx.fillRect(bx, by, CELL, CELL);
    }
  }

  if (path.length > 2) {
    const sx = path[0].x * CELL, sy = path[0].y * CELL;
    bcx.fillStyle = 'rgba(34,197,94,.12)'; bcx.fillRect(sx, sy, CELL, CELL);
    bcx.font = Math.floor(CELL * 0.4) + 'px serif'; bcx.textAlign = 'center'; bcx.textBaseline = 'middle';
    bcx.fillStyle = '#22c55e77'; bcx.fillText('▶', sx + CELL / 2, sy + CELL / 2);
  }
}

export function invalidateBg() { bgCache = null; }

export function render() {
  const { cx, W, H, CELL, COLS, ROWS, cam, path, ticks, freezeActive, volcanoActive,
          towers, bees, enemies, projectiles, beams, particles, sel, gCell, ttTower } = state;

  cx.clearRect(0, 0, W, H);
  cx.save();
  cx.setTransform(cam.zoom, 0, 0, cam.zoom, -cam.panX * cam.zoom, -cam.panY * cam.zoom);
  
  if (!bgCache && state.pathReady && CELL > 0) updateBgCache();
  if (bgCache) cx.drawImage(bgCache, 0, 0);

  // Infinite OOB Foggy Forest bounds
  if (_imgForest.complete && _imgForest.naturalWidth) {
    const gw = COLS * CELL, gh = ROWS * CELL;
    const vL = cam.panX, vT = cam.panY, vR = cam.panX + W / cam.zoom, vB = cam.panY + H / cam.zoom;
    
    // Quick bounds check if ANY of the viewport is outside the game grid
    if (vL < 0 || vT < 0 || vR > gw || vB > gh) {
      cx.save();
      // Create a geometric inverted mask over the game grid
      cx.beginPath();
      cx.rect(vL, vT, vR - vL, vB - vT);
      cx.rect(0, 0, gw, gh);
      cx.clip("evenodd");
      
      // Draw base repeating forest
      cx.fillStyle = cx.createPattern(_imgForest, 'repeat');
      cx.fillRect(vL, vT, vR - vL, vB - vT);

      // Transition to screen space for fog, but factor in camera zoom/pan for infinite dimensionality
      _ensureFog(W, H);
      cx.save();
      cx.setTransform(1, 0, 0, 1, 0, 0);
      
      const radScale = cam.zoom;
      const oX = cam.panX * cam.zoom;
      const oY = cam.panY * cam.zoom;

      for (const f of _fogW) {
        f.x += f.vx; f.y += f.vy;
        const bnd = f.r * 4;
        if (f.x - bnd > W) { f.x = -bnd; f.y = Math.random() * H; }
        if (f.y < -bnd) f.y = H + bnd;
        if (f.y > H + bnd) f.y = -bnd;
        
        let dx = (f.x - oX) % (W + bnd);
        if (dx < -bnd) dx += (W + bnd);
        let dy = (f.y - oY) % (H + bnd);
        if (dy < -bnd) dy += (H + bnd);
        
        const rad = Math.max(1, f.r * radScale * 1.3);
        const g = cx.createRadialGradient(dx, dy, 0, dx, dy, rad);
        g.addColorStop(0, 'rgba(210,220,230,0.20)');
        g.addColorStop(1, 'rgba(210,220,230,0)');
        cx.fillStyle = g;
        cx.beginPath(); cx.arc(dx, dy, rad, 0, Math.PI * 2); cx.fill();
      }
      cx.fillStyle = 'rgba(190,205,220,0.25)'; // Light wash base
      cx.fillRect(0, 0, W, H);
      cx.restore();
      
      cx.restore();
    }
  }

  // Monkey hut tile highlights
  if (ttTower?.type === 'monkey' && ttTower.monkeys) {
    for (const mk of ttTower.monkeys) {
      if (mk.role === 'courier' && mk.cfg.from) {
        cx.strokeStyle = 'rgba(59,130,246,1)'; cx.lineWidth = 4;
        cx.strokeRect(mk.cfg.from.x * CELL + 1, mk.cfg.from.y * CELL + 1, CELL - 2, CELL - 2);
      }
      if ((mk.role === 'gatherer' || mk.role === 'courier') && mk.cfg.dest) {
        cx.strokeStyle = 'rgba(244,63,94,1)'; cx.lineWidth = 4;
        cx.strokeRect(mk.cfg.dest.x * CELL + 1, mk.cfg.dest.y * CELL + 1, CELL - 2, CELL - 2);
      }
      if (mk.role === 'booster' && mk.cfg.boost) {
        cx.strokeStyle = 'rgba(244,63,94,1)'; cx.lineWidth = 4;
        cx.strokeRect(mk.cfg.boost.x * CELL + 1, mk.cfg.boost.y * CELL + 1, CELL - 2, CELL - 2);
      }
      if (mk.role === 'harvester' && mk.cfg.harvestSrc) {
        cx.strokeStyle = 'rgba(16,185,129,1)'; cx.lineWidth = 4;
        cx.strokeRect(mk.cfg.harvestSrc.x * CELL + 1, mk.cfg.harvestSrc.y * CELL + 1, CELL - 2, CELL - 2);
      }
      if (mk.role === 'harvester' && mk.cfg.dest) {
        cx.strokeStyle = 'rgba(244,63,94,1)'; cx.lineWidth = 4;
        cx.strokeRect(mk.cfg.dest.x * CELL + 1, mk.cfg.dest.y * CELL + 1, CELL - 2, CELL - 2);
      }
      if (mk.role === 'round_robin') {
        if (mk.cfg.rrMode === 'froms') {
          cx.strokeStyle = 'rgba(59,130,246,1)'; cx.lineWidth = 4;
          for (const f of (mk.cfg.froms || [])) cx.strokeRect(f.x * CELL + 1, f.y * CELL + 1, CELL - 2, CELL - 2);
          if (mk.cfg.dest) { cx.strokeStyle = 'rgba(244,63,94,1)'; cx.strokeRect(mk.cfg.dest.x * CELL + 1, mk.cfg.dest.y * CELL + 1, CELL - 2, CELL - 2); }
        } else {
          if (mk.cfg.from) { cx.strokeStyle = 'rgba(59,130,246,1)'; cx.lineWidth = 4; cx.strokeRect(mk.cfg.from.x * CELL + 1, mk.cfg.from.y * CELL + 1, CELL - 2, CELL - 2); }
          if (mk.cfg.targets) { cx.strokeStyle = 'rgba(168,85,247,1)'; cx.lineWidth = 4; for (const t of mk.cfg.targets) cx.strokeRect(t.x * CELL + 1, t.y * CELL + 1, CELL - 2, CELL - 2); }
        }
      }
    }
  }

  // Resource Nodes
  renderNodes();

  // Volcano
  if (volcanoActive) {
    const vx = volcanoActive.x * CELL + CELL / 2, vy = volcanoActive.y * CELL + CELL / 2;
    const pu = Math.sin(ticks * 0.1) * 0.15 + 0.85;
    cx.fillStyle = 'rgba(239,68,68,' + (0.08 * pu).toFixed(3) + ')';
    cx.beginPath(); cx.arc(vx, vy, CELL * 3, 0, Math.PI * 2); cx.fill();
    cx.font = Math.floor(CELL * 0.9) + 'px serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText('🌋', vx, vy);
  }

  // Traps
  if (state.traps?.length) {
    cx.font = Math.floor(CELL * 0.45) + 'px serif';
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    for (const trap of state.traps) {
      const px = trap.x * CELL + CELL / 2, py = trap.y * CELL + CELL / 2;
      if (trap.type === 'trap') cx.fillText('🪤', px, py);
      else if (trap.type === 'sap') cx.fillText('🍯', px, py);
    }
  }

  // Towers
  towers.forEach(tw => {
    const px = tw.x * CELL + CELL / 2, py = tw.y * CELL + CELL / 2;
    if (ttTower === tw && (tw.range || tw.obsRange)) {
      const r = (tw.obsRange || tw.range) * CELL;
      const isLab = tw.type === 'lab';
      const rc = isLab ? 'rgba(168,85,247,' : 'rgba(244,63,94,';
      cx.beginPath(); cx.arc(px, py, r, 0, Math.PI * 2);
      cx.fillStyle = rc + '.08)'; cx.fill();
      cx.strokeStyle = rc + '.7)'; cx.lineWidth = 2; cx.stroke();
    }

    if (ttTower === tw && tw.type === 'clam') {
      const br = (tw.level + 1) * 1.5;
      cx.beginPath(); cx.arc(px, py, br * CELL, 0, Math.PI * 2);
      cx.fillStyle = 'rgba(244,63,94,.08)'; cx.fill();
      cx.strokeStyle = 'rgba(244,63,94,.7)'; cx.lineWidth = 2; cx.stroke();
    }
    if (ttTower === tw && tw.type === 'clown') {
      cx.beginPath(); cx.arc(px, py, (tw.reverseRange || 3) * CELL, 0, Math.PI * 2);
      cx.fillStyle = 'rgba(244,63,94,.08)'; cx.fill();
      cx.strokeStyle = 'rgba(244,63,94,.7)'; cx.lineWidth = 2; cx.stroke();
    }
    const isH = tw.type === 'hoard', def = TD[tw.type];
    const tx = Math.round(tw.x * CELL), ty = Math.round(tw.y * CELL);
    if (isH && _imgHoard.naturalWidth) {
      cx.drawImage(_imgHoard, tx, ty, CELL, CELL);
    } else {
      const _dis = tw.disabled && tw.disabledWave === state.wave;
      const _mst = tw._mastery;
      if (_mst) {
        // Mastery: deep purple-gold gradient background
        const grad = cx.createLinearGradient(tx, ty, tx + CELL, ty + CELL);
        grad.addColorStop(0, '#1a0d30'); grad.addColorStop(0.5, '#2a1800'); grad.addColorStop(1, '#1a0d30');
        cx.fillStyle = grad;
      } else {
        cx.fillStyle = _dis ? '#1a0a0a' : isH ? '#0a3d2f' : tw._buffed ? '#1a2040' : '#171838';
      }
      cx.fillRect(tx + 2, ty + 2, CELL - 4, CELL - 4);
      cx.strokeStyle = _dis ? '#ef4444' : _mst ? '#a855f7' : isH ? '#10b981' : tw._buffed ? '#5eead4' : (def?.clr || '#555');
      cx.lineWidth = _mst ? 2.5 : tw._buffed ? 2 : 1.5; cx.strokeRect(tx + 2, ty + 2, CELL - 4, CELL - 4);
      if (_mst) {
        // Gold inner glow corners
        cx.strokeStyle = '#f59e0b44'; cx.lineWidth = 1;
        cx.strokeRect(tx + 4, ty + 4, CELL - 8, CELL - 8);
      }
      cx.font = Math.floor(CELL * 0.35) + 'px serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.fillText(isH ? '🏺' : (def?.icon || '?'), tx + CELL / 2, ty + CELL / 2);
    }
    if (tw.level > 0) { cx.font = 'bold ' + Math.floor(CELL * 0.16) + 'px Anybody,sans-serif'; cx.fillStyle = '#fbbf24'; cx.fillText('★'.repeat(Math.min(tw.level, 5)), tx + CELL / 2, ty + CELL - 2); }
  });

  // Castle (end of path) — drawn oversized so it overlaps surrounding tiles
  if (path.length > 2 && _imgCastle.naturalWidth) {
    const lp = path[path.length - 1];
    const cs = CELL * 1.2;
    cx.drawImage(_imgCastle, lp.x * CELL + CELL / 2 - cs / 2, lp.y * CELL + CELL / 2 - cs / 2, cs, cs);
  }

  // Mastery auras — second pass so they overlap neighboring towers
  cx.save();
  towers.forEach(tw => {
    if (!tw._mastery) return;
    const px = tw.x * CELL + CELL / 2, py = tw.y * CELL + CELL / 2;
    const pulse = 0.5 + Math.sin(ticks * 0.05) * 0.2;
    if (tw.type === 'clown') {
      const JCLR = ['#f472b6','#facc15','#34d399','#60a5fa','#f87171','#a78bfa'];
      const spinAngle = ticks * 0.04;
      const r = CELL * 0.65;
      for (let i = 0; i < 4; i++) {
        const a = spinAngle + i * Math.PI / 2;
        const bx = px + Math.cos(a) * r, by = py + Math.sin(a) * r;
        cx.fillStyle = JCLR[i % JCLR.length];
        cx.beginPath(); cx.arc(bx, by, 5, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = JCLR[i % JCLR.length] + '55';
        cx.beginPath(); cx.arc(bx, by, 8, 0, Math.PI * 2); cx.fill();
      }
      cx.beginPath(); cx.arc(px, py, r, 0, Math.PI * 2);
      cx.strokeStyle = `rgba(244,114,182,${pulse.toFixed(2)})`; cx.lineWidth = 2; cx.stroke();
      if (ticks % 20 === 0) {
        const a = Math.random() * Math.PI * 2;
        state.particles.push({ x: px + Math.cos(a) * r, y: py + Math.sin(a) * r,
          vx: Math.cos(a) * (0.5 + Math.random() * 0.5), vy: -0.6 - Math.random() * 0.6,
          life: 20 + Math.random() * 15, clr: JCLR[Math.floor(Math.random() * JCLR.length)], sz: 2.5 });
      }
    } else {
      cx.beginPath(); cx.arc(px, py, CELL * 0.54, 0, Math.PI * 2);
      cx.strokeStyle = `rgba(168,85,247,${pulse.toFixed(2)})`; cx.lineWidth = 2.5; cx.stroke();
      cx.beginPath(); cx.arc(px, py, CELL * 0.48, 0, Math.PI * 2);
      cx.strokeStyle = `rgba(245,158,11,${(pulse * 0.5).toFixed(2)})`; cx.lineWidth = 1; cx.stroke();
      if (ticks % 30 === 0) {
        const angle = Math.random() * Math.PI * 2;
        const r = CELL * (0.4 + Math.random() * 0.2);
        state.particles.push({ x: px + Math.cos(angle) * r, y: py + Math.sin(angle) * r,
          vx: (Math.random() - 0.5) * 0.5, vy: -0.4 - Math.random() * 0.4,
          life: 25 + Math.random() * 20, clr: Math.random() < 0.5 ? '#a855f7' : '#f59e0b', sz: 2 + Math.random() });
      }
    }
  });
  cx.restore();

  // Bees
  bees.forEach(bee => {
    if (bee.dead) return;
    cx.font = Math.floor(CELL * 0.3) + 'px serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText('🐝', bee.x, bee.y);
    if (ticks % 4 === 0) state.particles.push({ x: bee.x, y: bee.y, vx: 0, vy: 0, life: 8, clr: '#fbbf2444', sz: 1.5 });
  });

  // Stacks (rendered above towers) + ground loot
  renderStacks();

  // Monkeys — hidden while boosting (monkey "disappears" into the target building)
  for (const tw of towers) {
    if (tw.type !== 'monkey' || !tw.monkeys) continue;
    const hutSelected = tw === ttTower;
    for (const mk of tw.monkeys) {
      if (mk.st === 'boosting') continue;
      if (mk.role === 'harvester' && mk.cfg.harvestSrc?.isForest && mk.st === 'orbiting') continue;
      if (hutSelected) {
        cx.beginPath(); cx.arc(mk.x, mk.y, CELL * 0.34, 0, Math.PI * 2);
        cx.strokeStyle = 'rgba(251,191,36,0.9)'; cx.lineWidth = 2; cx.stroke();
      }
      if (cam.zoom >= 0.75) {
        cx.font = Math.floor(CELL * 0.5) + 'px serif';
        cx.textAlign = 'center'; cx.textBaseline = 'middle';
        cx.fillText('🐵', mk.x, mk.y);
      }
      if (mk.carrying) {
        cx.font = Math.floor(CELL * 0.45) + 'px serif';
        cx.textAlign = 'center'; cx.textBaseline = 'bottom';
        cx.fillText(getItemDef(mk.carrying.type).icon, mk.x, mk.y - CELL * 0.28);
      }
    }
  }
  // Monkey icon on boosted buildings
  for (const tw of towers) {
    if (!tw._monkeyBoosted) continue;
    const tx = tw.x * CELL, ty = tw.y * CELL;
    cx.font = Math.floor(CELL * 0.25) + 'px serif';
    cx.textAlign = 'right'; cx.textBaseline = 'top';
    cx.fillText('🐵', tx + CELL - 2, ty + 2);
  }

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
    if (p.mastery) {
      // Mastery projectile: larger core + purple outer glow + gold inner
      cx.fillStyle = '#f59e0b'; cx.beginPath(); cx.arc(px, py, 3.5, 0, Math.PI * 2); cx.fill();
      cx.fillStyle = p.clr + 'cc'; cx.beginPath(); cx.arc(px, py, 5.5, 0, Math.PI * 2); cx.fill();
      cx.fillStyle = '#a855f744'; cx.beginPath(); cx.arc(px, py, 8, 0, Math.PI * 2); cx.fill();
    } else {
      cx.fillStyle = p.clr; cx.beginPath(); cx.arc(px, py, 2.5, 0, Math.PI * 2); cx.fill();
      cx.fillStyle = p.clr + '44'; cx.beginPath(); cx.arc(px, py, 4, 0, Math.PI * 2); cx.fill();
    }
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

  // Consumable placement preview
  if (sel?.type === 'consumable_pick' && gCell) {
    const gx = gCell.x * CELL, gy = gCell.y * CELL, gpx = gx + CELL / 2, gpy = gy + CELL / 2;
    const onPath = state.pathSet?.has(gCell.x + ',' + gCell.y);
    cx.globalAlpha = onPath ? 1.0 : 0.8;
    cx.fillStyle = onPath ? 'rgba(34,197,94,.35)' : 'rgba(239,68,68,.35)';
    cx.fillRect(gx, gy, CELL, CELL);
    cx.strokeStyle = onPath ? '#22c55e' : '#ef4444';
    cx.lineWidth = 2; cx.setLineDash([4, 3]);
    cx.strokeRect(gx + 1, gy + 1, CELL - 2, CELL - 2);
    cx.setLineDash([]);
    cx.font = Math.floor(CELL * 0.45) + 'px serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText(sel.item?.icon || '?', gpx, gpy);
    cx.globalAlpha = 1;
  }

  // Lumber axe forest-clear preview
  if (sel?.type === 'forest_clear' && gCell) {
    const fc = getCell(gCell.x, gCell.y);
    const isForest = fc?.type === 'forest';
    const gx = gCell.x * CELL, gy = gCell.y * CELL, gpx = gx + CELL / 2, gpy = gy + CELL / 2;
    cx.globalAlpha = isForest ? 1.0 : 0.8;
    cx.fillStyle = isForest ? 'rgba(34,197,94,.35)' : 'rgba(239,68,68,.35)';
    cx.fillRect(gx, gy, CELL, CELL);
    cx.strokeStyle = isForest ? '#22c55e' : '#ef4444';
    cx.lineWidth = 2; cx.setLineDash([4, 3]);
    cx.strokeRect(gx + 1, gy + 1, CELL - 2, CELL - 2);
    cx.setLineDash([]);
    cx.font = Math.floor(CELL * 0.45) + 'px serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText('🪓', gpx, gpy);
    cx.globalAlpha = 1;
  }

  // Augment placement preview
  if (sel?.type === 'augment_pick' && gCell) {
    const tw2 = towers.find(t => t.x === gCell.x && t.y === gCell.y);
    if (tw2) {
      const gx = gCell.x * CELL, gy = gCell.y * CELL;
      cx.strokeStyle = '#a855f7'; cx.lineWidth = 2;
      cx.strokeRect(gx + 2, gy + 2, CELL - 4, CELL - 4);
    }
  }

  // Ghost placement preview
  if (sel && sel.type !== 'spell' && sel.type !== 'consumable_pick' && sel.type !== 'augment_pick' && sel.type !== 'relocate_source' && sel.type !== 'relocate_dest' && sel.type !== 'forest_clear' && gCell) {
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
    cx.globalAlpha = ok ? 0.8 : 0.5;
    cx.fillStyle = ok ? '#ffffff11' : '#ff000022'; cx.fillRect(gx, gy, CELL, CELL);
    cx.font = Math.floor(CELL * 0.4) + 'px serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    const icon = TD[sel.key]?.icon || '?';
    cx.fillText(icon, gpx, gpy); cx.globalAlpha = 1;
  }

  // NPCs (drawn in world space — may be outside inner grid, e.g. forest border)
  if (state.npcs?.length) {
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    for (const npc of state.npcs) {
      if (npc.img === 'elder' && _imgElder.complete && _imgElder.naturalWidth) {
        cx.drawImage(_imgElder, npc.x * CELL, npc.y * CELL, CELL, CELL);
      } else {
        cx.font = Math.floor(CELL * 0.7) + 'px serif';
        cx.fillText(npc.icon, npc.x * CELL + CELL / 2, npc.y * CELL + CELL / 2);
      }
    }
  }

  cx.restore();
  if (freezeActive > 0) { cx.fillStyle = 'rgba(56,189,248,' + (0.06 + 0.03 * Math.sin(ticks * 0.2)) + ')'; cx.fillRect(0, 0, W, H); }

  // Fog overlay — Considerate Fog wave, screen space
  if (state.fogWave) {
    _ensureFog(W, H);
    const density = Math.min(1, (ticks - (state.fogStartTick || 0)) / 360);
    cx.save();
    for (const f of _fogW) {
      f.x += f.vx; f.y += f.vy;
      if (f.x - f.r > W) { f.x = -f.r; f.y = Math.random() * H; }
      if (f.y < -f.r) f.y = H + f.r;
      if (f.y > H + f.r) f.y = -f.r;
      const g = cx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
      g.addColorStop(0, `rgba(210,220,230,${0.14 * density})`);
      g.addColorStop(1, 'rgba(210,220,230,0)');
      cx.fillStyle = g;
      cx.beginPath(); cx.arc(f.x, f.y, f.r, 0, Math.PI * 2); cx.fill();
    }
    cx.fillStyle = `rgba(190,205,220,${0.28 * density})`;
    cx.fillRect(0, 0, W, H);
    cx.restore();
  }

  // Herald / Boss warning overlay — darkens screen with announcement text
  if (state.heraldWarn) {
    const elapsed = ticks - state.heraldWarn.tick;
    const dur = 300;
    if (elapsed < dur) {
      const alpha = elapsed < 60 ? elapsed / 60 : elapsed > 240 ? (dur - elapsed) / 60 : 1;
      cx.save();
      cx.fillStyle = `rgba(0,0,0,${0.65 * alpha})`;
      cx.fillRect(0, 0, W, H);
      cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.font = `bold ${Math.floor(H * 0.08)}px serif`;
      cx.fillStyle = `rgba(245,158,11,${alpha})`;
      cx.fillText(state.heraldWarn.text, W / 2, H / 2 - Math.floor(H * 0.04));
      if (state.heraldWarn.sub) {
        cx.font = `${Math.floor(H * 0.04)}px serif`;
        cx.fillStyle = `rgba(255,220,130,${alpha * 0.85})`;
        cx.fillText(state.heraldWarn.sub, W / 2, H / 2 + Math.floor(H * 0.045));
      }
      cx.restore();
    }
  }

  // Rain overlay — screen space, drawn after camera restore
  if (state.weather?.id === 'rain') {
    _ensureRain(W, H);
    cx.save();
    cx.strokeStyle = 'rgba(147,210,255,0.3)';
    cx.lineWidth = 1;
    cx.beginPath();
    for (const d of _rain) {
      d.y += d.spd; d.x += d.spd * 0.22;
      if (d.y > H) { d.y = -10; d.x = Math.random() * W; }
      if (d.x > W) d.x -= W;
      cx.moveTo(d.x, d.y); cx.lineTo(d.x + 3, d.y + 18);
    }
    cx.stroke();
    // Dim overlay
    cx.fillStyle = 'rgba(10,20,50,0.10)';
    cx.fillRect(0, 0, W, H);
    cx.restore();
  }
}
