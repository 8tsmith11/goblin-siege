'use strict';
import { state, WORLD_COLS, WORLD_ROWS, STEAM_ROWS, getCell } from './main.js';
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

// ─── OOB forest fog (world-space, follows camera) ────────────────────────────
const _fogOob = [];
function _ensureFogOob(vL, vT, vR, vB) {
  if (_fogOob.length) return;
  const vW = vR - vL, vH = vB - vT;
  for (let i = 0; i < 32; i++) {
    _fogOob.push({
      x: vL + Math.random() * vW,
      y: vT + Math.random() * vH,
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

export function canPlace(cx2, cy2, towerType) {
  const { COLS, ROWS, pathSet } = state;
  if (cx2 < 0 || cx2 >= COLS || cy2 < 0 || cy2 >= ROWS) return false;
  const cell = getCell(cx2, cy2);
  if (!cell) return false;
  if (pathSet.has(cx2 + ',' + cy2)) return false;
  if (towerType === 'water_pump') return cell.type === 'water';
  if (cell.type !== 'empty') return false;
  return true;
}

let bgCache = null;
let _forestPatternOob = null;

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

export function invalidateBg() { bgCache = null; _forestPatternOob = null; }

export function render() {
  const { cx, W, H, CELL, COLS, ROWS, cam, path, ticks, freezeActive, volcanoActive,
          towers, bees, enemies, projectiles, beams, particles, sel, gCell, ttTower } = state;

  cx.clearRect(0, 0, W, H);
  cx.save();
  const _shake = state.cameraShake > 0 ? (Math.random() - 0.5) * state.cameraShake * 0.4 : 0;
  const _shakeY = state.cameraShake > 0 ? (Math.random() - 0.5) * state.cameraShake * 0.4 : 0;
  cx.setTransform(cam.zoom, 0, 0, cam.zoom, -cam.panX * cam.zoom + _shake, -cam.panY * cam.zoom + _shakeY);
  
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
      if (!_forestPatternOob) _forestPatternOob = cx.createPattern(_imgForest, 'repeat');
      cx.fillStyle = _forestPatternOob;
      cx.fillRect(vL, vT, vR - vL, vB - vT);

      // World-space fog wisps — rendered under camera transform, naturally follow pan/zoom
      _ensureFogOob(vL, vT, vR, vB);
      for (const f of _fogOob) {
        f.x += f.vx; f.y += f.vy;
        const bnd = f.r * 4;
        if (f.x - bnd > vR) { f.x = vL - bnd; f.y = vT + Math.random() * (vB - vT); }
        if (f.y < vT - bnd) f.y = vB + bnd;
        if (f.y > vB + bnd) f.y = vT - bnd;
        const g = cx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
        g.addColorStop(0, 'rgba(210,220,230,0.20)');
        g.addColorStop(1, 'rgba(210,220,230,0)');
        cx.fillStyle = g;
        cx.beginPath(); cx.arc(f.x, f.y, f.r, 0, Math.PI * 2); cx.fill();
      }
      cx.fillStyle = 'rgba(190,205,220,0.25)';
      cx.fillRect(vL, vT, vR - vL, vB - vT);
      
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

  // Web tiles (spider staff / grateful spider) — drawn web + glow tint
  if (state.webs?.length) {
    cx.save();
    for (const web of state.webs) {
      const px = web.x * CELL + CELL / 2, py = web.y * CELL + CELL / 2;
      // Purple tint over the tile
      cx.globalAlpha = 0.22;
      cx.fillStyle = '#a855f7';
      cx.fillRect(web.x * CELL, web.y * CELL, CELL, CELL);
      // Draw a simple radial web using canvas lines
      cx.globalAlpha = 0.7;
      cx.strokeStyle = '#e9d5ff';
      cx.lineWidth = 0.8;
      const r = CELL * 0.42;
      const spokes = 8;
      for (let s = 0; s < spokes; s++) {
        const a = (Math.PI * 2 * s) / spokes;
        cx.beginPath(); cx.moveTo(px, py); cx.lineTo(px + Math.cos(a) * r, py + Math.sin(a) * r); cx.stroke();
      }
      for (let ring = 1; ring <= 3; ring++) {
        const rr = r * ring / 3;
        cx.beginPath();
        for (let s = 0; s <= spokes; s++) {
          const a = (Math.PI * 2 * s) / spokes;
          s === 0 ? cx.moveTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr) : cx.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr);
        }
        cx.stroke();
      }
      // Subtle center dot
      cx.globalAlpha = 0.9; cx.fillStyle = '#d8b4fe';
      cx.beginPath(); cx.arc(px, py, 2, 0, Math.PI * 2); cx.fill();
    }
    cx.globalAlpha = 1;
    cx.restore();
  }

  // NPCs
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

  // Towers
  towers.forEach(tw => {
    const px = tw.x * CELL + CELL / 2, py = tw.y * CELL + CELL / 2;
    if (ttTower === tw && (tw.range || tw.obsRange)) {
      const r = (tw.obsRange || tw.range) * CELL;
      const isLab = tw.type === 'lab';
      const isCampfire = tw.type === 'campfire';
      const rc = isCampfire ? 'rgba(249,115,22,' : isLab ? 'rgba(168,85,247,' : 'rgba(244,63,94,';
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
    if (ttTower === tw && tw.type === 'campfire') {
      const r = (tw.warmRange || TD.campfire.warmRange) * CELL;
      cx.beginPath(); cx.arc(px, py, r, 0, Math.PI * 2);
      cx.fillStyle = 'rgba(249,115,22,.08)'; cx.fill();
      cx.strokeStyle = 'rgba(249,115,22,.7)'; cx.lineWidth = 2; cx.stroke();
    }
    // Ceasefire flag: render like a regular tower box but with emoji offset/scale when raised
    if (tw.type === 'ceasefire_flag') {
      const tx = Math.round(tw.x * CELL), ty = Math.round(tw.y * CELL);
      cx.fillStyle = tw.raised ? '#0f2a1a' : '#171838';
      cx.fillRect(tx, ty, CELL, CELL);
      cx.strokeStyle = tw.raised ? '#22c55e' : '#3730a3'; cx.lineWidth = 1; cx.strokeRect(tx + 0.5, ty + 0.5, CELL - 1, CELL - 1);
      if (tw.raised) {
        cx.font = Math.floor(CELL * 0.72) + 'px serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
        cx.fillText('🏳️', tx + CELL / 2, ty + CELL / 2 - CELL * 0.52);
      } else {
        const cx2 = tx + CELL / 2, cy2 = ty + CELL / 2;
        cx.save();
        cx.translate(cx2, cy2); cx.rotate(Math.PI);
        cx.font = Math.floor(CELL * 0.35) + 'px serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
        cx.globalAlpha = 0.6;
        cx.fillText('🏳️', 0, 0);
        cx.restore();
      }
      return;
    }

    // Resonating gem: no background, just gem + pedestal
    if (tw.type === 'resonating_gem') {
      const tx2 = tw.x * CELL, ty2 = tw.y * CELL;
      const cx2 = tx2 + CELL / 2, cy2 = ty2 + CELL / 2;
      const activated = !!tw._activated;
      const pulse = activated ? 0.7 + 0.3 * Math.sin(ticks / 24 + tw.x * 0.7) : 0.35;
      const vibScale = activated ? 1 + 0.04 * Math.sin(ticks * 0.8) : 1;
      // Pedestal
      cx.fillStyle = activated ? '#484848' : '#333'; cx.globalAlpha = 0.9;
      cx.fillRect(cx2 - CELL * 0.18, cy2 + CELL * 0.18, CELL * 0.36, CELL * 0.18);
      cx.fillRect(cx2 - CELL * 0.12, cy2 + CELL * 0.12, CELL * 0.24, CELL * 0.08);
      cx.globalAlpha = 1;
      cx.save();
      if (activated) { cx.shadowColor = '#c084fc'; cx.shadowBlur = 16 * pulse; }
      const gs = CELL * 0.46 * vibScale;
      const gy = cy2 - CELL * 0.18;
      cx.beginPath();
      cx.moveTo(cx2, gy + gs);
      cx.lineTo(cx2 + gs * 0.6, gy + gs * 0.2);
      cx.lineTo(cx2 + gs * 0.55, gy - gs * 0.3);
      cx.lineTo(cx2, gy - gs * 0.5);
      cx.lineTo(cx2 - gs * 0.55, gy - gs * 0.3);
      cx.lineTo(cx2 - gs * 0.6, gy + gs * 0.2);
      cx.closePath();
      if (activated) {
        const grad = cx.createLinearGradient(cx2, gy - gs * 0.5, cx2, gy + gs);
        grad.addColorStop(0, '#e9d5ff'); grad.addColorStop(0.4, '#a855f7'); grad.addColorStop(1, '#4c1d95');
        cx.fillStyle = grad; cx.globalAlpha = 0.88 * pulse; cx.fill();
        cx.strokeStyle = '#e9d5ff'; cx.lineWidth = 1; cx.globalAlpha = 0.7; cx.stroke();
      } else {
        cx.fillStyle = '#555'; cx.globalAlpha = 0.55; cx.fill();
        cx.strokeStyle = '#777'; cx.lineWidth = 1; cx.globalAlpha = 0.4; cx.stroke();
      }
      cx.restore();
      return;
    }

    // Pipe: directional fluid conduit — arms reach center, color dot at hub
    if (tw.type === 'pipe') {
      const px2 = tw.x * CELL, py2 = tw.y * CELL;
      const pcx = px2 + CELL / 2, pcy = py2 + CELL / 2;
      const _pFT = new Set(['pipe','water_pump','steam_boiler','tank','inline_pump','steam_engine']);
      const myFluid = tw.fluidType || null;
      const _revDir = { N:'S', S:'N', E:'W', W:'E' };
      // Pipes of different (non-null) fluid types don't connect visually
      // Inline pumps only connect on their input/output sides
      function _pipeConnects(nbr, dir) {
        if (!nbr || !_pFT.has(nbr.type)) return false;
        if (nbr.type === 'inline_pump') {
          const fromDir = _revDir[dir];
          return nbr.inputSide === fromDir || nbr.outputSide === fromDir;
        }
        if (nbr.type === 'pipe') {
          const nf = nbr.fluidType || null;
          if (myFluid && nf && myFluid !== nf) return false;
        }
        return true;
      }
      const conn = {
        N: _pipeConnects(getCell(tw.x, tw.y - 1)?.content, 'N'),
        S: _pipeConnects(getCell(tw.x, tw.y + 1)?.content, 'S'),
        E: _pipeConnects(getCell(tw.x + 1, tw.y)?.content, 'E'),
        W: _pipeConnects(getCell(tw.x - 1, tw.y)?.content, 'W'),
      };
      const anyConn = conn.N || conn.S || conn.E || conn.W;
      // For isolated pipes (no connections), still suppress arms toward inline pump perpendicular sides
      function _armOk(dir, dx, dy) {
        const nbr = getCell(tw.x + dx, tw.y + dy)?.content;
        if (!nbr || nbr.type !== 'inline_pump') return true;
        const from = _revDir[dir];
        return nbr.inputSide === from || nbr.outputSide === from;
      }
      const fluidType = tw.fluidType;
      const fluidClr = fluidType === 'water' ? '#60a5fa' : fluidType === 'steam' ? '#f0f4ff' : '#444';
      const pipeClr = '#4b5563';
      const armW = CELL * 0.26;
      cx.save();
      cx.fillStyle = pipeClr;
      // Arms extend from cell edge to center
      if (conn.N || (!anyConn && _armOk('N', 0, -1))) cx.fillRect(pcx - armW/2, py2, armW, CELL / 2);
      if (conn.S || (!anyConn && _armOk('S', 0,  1))) cx.fillRect(pcx - armW/2, pcy, armW, CELL / 2);
      if (conn.E || (!anyConn && _armOk('E', 1,  0))) cx.fillRect(pcx, pcy - armW/2, CELL / 2, armW);
      if (conn.W || (!anyConn && _armOk('W', -1, 0))) cx.fillRect(px2, pcy - armW/2, CELL / 2, armW);
      // Hub circle at center (drawn on top, covers arm overlap)
      const hubR = CELL * 0.17;
      cx.beginPath(); cx.arc(pcx, pcy, hubR, 0, Math.PI * 2);
      cx.fillStyle = pipeClr; cx.fill();
      // Fluid color dot at hub center
      cx.beginPath(); cx.arc(pcx, pcy, CELL * 0.09, 0, Math.PI * 2);
      cx.fillStyle = fluidClr; cx.fill();
      cx.restore();
      return;
    }

    // Pulley: spinning wheel
    if (tw.type === 'pulley') {
      const tx2 = tw.x * CELL, ty2 = tw.y * CELL;
      const pcx = tx2 + CELL / 2, pcy = ty2 + CELL / 2;
      const R = CELL * 0.34, spokes = 6;
      cx.save();
      // Outer ring (no color change when active)
      cx.beginPath(); cx.arc(pcx, pcy, R, 0, Math.PI * 2);
      cx.strokeStyle = '#6b7280'; cx.lineWidth = 3; cx.stroke();
      // Hub
      cx.beginPath(); cx.arc(pcx, pcy, R * 0.18, 0, Math.PI * 2);
      cx.fillStyle = '#374151'; cx.fill();
      // Spokes (rotate with tw.rotation)
      const rot = tw.rotation || 0;
      cx.strokeStyle = '#9ca3af'; cx.lineWidth = 1.5;
      for (let i = 0; i < spokes; i++) {
        const a = rot + (i / spokes) * Math.PI * 2;
        cx.beginPath();
        cx.moveTo(pcx + Math.cos(a) * R * 0.18, pcy + Math.sin(a) * R * 0.18);
        cx.lineTo(pcx + Math.cos(a) * R * 0.9,  pcy + Math.sin(a) * R * 0.9);
        cx.stroke();
      }
      cx.restore();
      return;
    }

    // Steam engine
    if (tw.type === 'steam_engine') {
      const tx2 = tw.x * CELL, ty2 = tw.y * CELL;
      const phase = state._torquePhase || 0;
      cx.save();
      cx.fillStyle = '#111';
      cx.fillRect(tx2 + 2, ty2 + 2, CELL - 4, CELL - 4);
      cx.strokeStyle = '#555'; cx.lineWidth = 2;
      cx.strokeRect(tx2 + 2, ty2 + 2, CELL - 4, CELL - 4);
      // Spinning gear (rotates when active)
      const gearX = tx2 + CELL * 0.5, gearY = ty2 + CELL * 0.5;
      cx.font = Math.floor(CELL * 0.38) + 'px serif';
      cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.translate(gearX, gearY);
      if (tw.torqueActive) cx.rotate(phase * 0.06);
      cx.fillStyle = '#d1d5db';
      cx.fillText('⚙️', 0, 0);
      // Steam cloud particles from top when active
      if (tw.torqueActive && phase % 4 === 0) {
        const topY = ty2 + CELL * 0.1;
        for (let s = 0; s < 2; s++) {
          state.particles.push({ x: gearX + (Math.random() - 0.5) * CELL * 0.4, y: topY, vx: (Math.random() - 0.5) * 0.5, vy: -0.7 - Math.random() * 0.6, life: 28 + Math.floor(Math.random() * 10), clr: 'rgba(220,232,255,0.55)', sz: 3 + Math.random() * 2 });
        }
      }
      cx.restore();
      return;
    }

    // Butcher: spinning blades
    if (tw.type === 'butcher') {
      const tx2 = tw.x * CELL, ty2 = tw.y * CELL;
      const pcx = tx2 + CELL / 2, pcy = ty2 + CELL / 2;
      const spinning = tw.spinRate > 0;
      cx.save();
      cx.fillStyle = '#111';
      cx.fillRect(tx2 + 2, ty2 + 2, CELL - 4, CELL - 4);
      cx.strokeStyle = '#555'; cx.lineWidth = 1.5;
      cx.strokeRect(tx2 + 2, ty2 + 2, CELL - 4, CELL - 4);
      const blades = tw.blades || 3;
      // Mastery: blades grow with spin
      const spinFrac = tw._masteryButcher ? Math.min(1, (tw.spinRate || 0) / 0.15) : 1;
      const baseReach = (tw.range || 1.2) * CELL;
      const reach = tw._masteryButcher ? baseReach * (0.85 + 0.35 * spinFrac) : baseReach;
      const rot = tw.rotation || 0;
      // Blades — asymmetric kitchen-knife shape: curved leading edge, flat trailing edge
      for (let i = 0; i < blades; i++) {
        const a = rot + (i / blades) * Math.PI * 2;
        cx.save();
        cx.translate(pcx, pcy); cx.rotate(a);
        cx.fillStyle = '#6b7280';
        cx.beginPath();
        cx.moveTo(3, -3);                                           // base, leading edge
        cx.quadraticCurveTo(reach * 0.55, -5.5, reach, 0);         // curved leading edge
        cx.lineTo(reach * 0.5, 1.5);                                // flat trailing edge start
        cx.lineTo(3, 2);                                            // base, trailing edge
        cx.closePath(); cx.fill();
        cx.restore();
      }
      // Gear Train visual (no color change)
      if (tw.hasGearTrain) {
        const gR = CELL * 0.13;
        const teeth = 8;
        cx.save(); cx.translate(pcx, pcy); cx.rotate(rot * 1.5);
        cx.fillStyle = '#78716c';
        cx.beginPath();
        for (let i = 0; i < teeth * 2; i++) {
          const ta = (i / (teeth * 2)) * Math.PI * 2;
          const tr = i % 2 === 0 ? gR * 1.35 : gR;
          i === 0 ? cx.moveTo(Math.cos(ta) * tr, Math.sin(ta) * tr) : cx.lineTo(Math.cos(ta) * tr, Math.sin(ta) * tr);
        }
        cx.closePath(); cx.fill();
        cx.restore();
      }
      // Axle hub (no color change)
      cx.beginPath(); cx.arc(pcx, pcy, CELL * 0.11, 0, Math.PI * 2);
      cx.fillStyle = '#1f2937'; cx.fill();
      cx.strokeStyle = '#6b7280'; cx.lineWidth = 1.5;
      cx.beginPath(); cx.arc(pcx, pcy, CELL * 0.11, 0, Math.PI * 2); cx.stroke();
      cx.restore();
      return;
    }

    // Tank: fluid storage with window
    if (tw.type === 'tank') {
      const tx2 = tw.x * CELL, ty2 = tw.y * CELL;
      cx.save();
      cx.fillStyle = '#1e293b';
      cx.fillRect(tx2 + 2, ty2 + 2, CELL - 4, CELL - 4);
      cx.strokeStyle = '#475569'; cx.lineWidth = 2;
      cx.strokeRect(tx2 + 2, ty2 + 2, CELL - 4, CELL - 4);
      // Window showing fluid
      const winX = tx2 + CELL * 0.2, winY = ty2 + CELL * 0.15;
      const winW = CELL * 0.6, winH = CELL * 0.65;
      cx.fillStyle = '#0f172a';
      cx.fillRect(winX, winY, winW, winH);
      const fl = tw.fluid?.amount || 0;
      const fmax = tw.fluidMax || 40;
      if (fl > 0) {
        const ft = tw.fluid.type;
        const fclr = ft === 'water' ? '#60a5fa' : ft === 'steam' ? '#e0e7ff' : '#94a3b8';
        const fh = winH * (fl / fmax);
        cx.fillStyle = fclr; cx.globalAlpha = 0.7;
        cx.fillRect(winX, winY + winH - fh, winW, fh);
        cx.globalAlpha = 1;
      }
      cx.strokeStyle = '#64748b'; cx.lineWidth = 1;
      cx.strokeRect(winX, winY, winW, winH);
      cx.restore();
      return;
    }

    // Inline pump: straight-line directional pipe with arrow hub
    if (tw.type === 'inline_pump') {
      const tx2 = tw.x * CELL, ty2 = tw.y * CELL;
      const pcx = tx2 + CELL / 2, pcy = ty2 + CELL / 2;
      const inSide  = tw.inputSide  || 'W';
      const outSide = tw.outputSide || 'E';
      const _SD = { N:[0,-1], S:[0,1], E:[1,0], W:[-1,0] };
      const [idx, idy] = _SD[inSide];
      const [odx, ody] = _SD[outSide];
      const armW = CELL * 0.26, halfArm = armW / 2;
      const pipeClr = '#4b5563';
      // Fluid-aware colors (matches regular pipe)
      const pumpFluid = tw.fluidType || null;
      const arrowClr = pumpFluid === 'water' ? '#60a5fa' : pumpFluid === 'steam' ? '#f0f4ff' : '#6b7280';
      cx.save();
      cx.fillStyle = pipeClr;
      // Input arm (only input side direction)
      if (idx === -1) cx.fillRect(tx2, pcy - halfArm, CELL / 2, armW);
      else if (idx === 1) cx.fillRect(pcx, pcy - halfArm, CELL / 2, armW);
      else if (idy === -1) cx.fillRect(pcx - halfArm, ty2, armW, CELL / 2);
      else cx.fillRect(pcx - halfArm, pcy, armW, CELL / 2);
      // Output arm (only output side direction)
      if (odx === -1) cx.fillRect(tx2, pcy - halfArm, CELL / 2, armW);
      else if (odx === 1) cx.fillRect(pcx, pcy - halfArm, CELL / 2, armW);
      else if (ody === -1) cx.fillRect(pcx - halfArm, ty2, armW, CELL / 2);
      else cx.fillRect(pcx - halfArm, pcy, armW, CELL / 2);
      // Hub
      const hubR = CELL * 0.22;
      cx.beginPath(); cx.arc(pcx, pcy, hubR, 0, Math.PI * 2);
      cx.fillStyle = '#1e293b'; cx.fill();
      cx.strokeStyle = arrowClr; cx.lineWidth = 1.5;
      cx.beginPath(); cx.arc(pcx, pcy, hubR, 0, Math.PI * 2); cx.stroke();
      // Arrow pointing from input side → output side (fluid-colored)
      const arrowAngle = Math.atan2(ody, odx);
      const aLen = hubR * 0.6, aHead = hubR * 0.38;
      const ax1 = pcx + Math.cos(arrowAngle + Math.PI) * aLen * 0.6;
      const ay1 = pcy + Math.sin(arrowAngle + Math.PI) * aLen * 0.6;
      const ax2 = pcx + Math.cos(arrowAngle) * aLen;
      const ay2 = pcy + Math.sin(arrowAngle) * aLen;
      cx.strokeStyle = arrowClr; cx.lineWidth = 2;
      cx.beginPath(); cx.moveTo(ax1, ay1); cx.lineTo(ax2, ay2); cx.stroke();
      cx.fillStyle = arrowClr;
      cx.beginPath();
      cx.moveTo(ax2 + Math.cos(arrowAngle) * aHead, ay2 + Math.sin(arrowAngle) * aHead);
      cx.lineTo(ax2 + Math.cos(arrowAngle + 2.4) * aHead * 0.7, ay2 + Math.sin(arrowAngle + 2.4) * aHead * 0.7);
      cx.lineTo(ax2 + Math.cos(arrowAngle - 2.4) * aHead * 0.7, ay2 + Math.sin(arrowAngle - 2.4) * aHead * 0.7);
      cx.closePath(); cx.fill();
      cx.restore();
      return;
    }

    const isH = tw.type === 'hoard', def = TD[tw.type];
    const tx = Math.round(tw.x * CELL), ty = Math.round(tw.y * CELL);
    if (isH && _imgHoard.naturalWidth) {
      cx.drawImage(_imgHoard, tx, ty, CELL, CELL);
    } else {
      const _dis = tw.disabled && tw.disabledWave === state.wave;
      const _mst = tw._mastery;
      const _abh = tw._abhAssault; // Abhorrent Ambush mastery
      const _ambushReady = _abh && tw._assaultReady;
      if (_abh) {
        // Abhorrent Ambush: sickly dark green background
        const grad = cx.createLinearGradient(tx, ty, tx + CELL, ty + CELL);
        if (_ambushReady) {
          // Stealth: near-black, predator waiting
          grad.addColorStop(0, '#020501'); grad.addColorStop(0.5, '#040a01'); grad.addColorStop(1, '#020501');
        } else {
          grad.addColorStop(0, '#0d1a00'); grad.addColorStop(0.5, '#111a00'); grad.addColorStop(1, '#0d1a00');
        }
        cx.fillStyle = grad;
      } else if (_mst) {
        // Mastery: deep purple-gold gradient background
        const grad = cx.createLinearGradient(tx, ty, tx + CELL, ty + CELL);
        grad.addColorStop(0, '#1a0d30'); grad.addColorStop(0.5, '#2a1800'); grad.addColorStop(1, '#1a0d30');
        cx.fillStyle = grad;
      } else {
        cx.fillStyle = _dis ? '#1a0a0a' : isH ? '#0a3d2f' : tw._buffed ? '#1a2040' : '#171838';
      }
      cx.fillRect(tx + 2, ty + 2, CELL - 4, CELL - 4);
      if (_abh) {
        const pulse = 0.5 + 0.5 * Math.sin(ticks * 0.07);
        if (_ambushReady) {
          // Stealth: bright acid-green pulsing border, stands out against black bg
          cx.strokeStyle = `rgba(163,230,53,${0.85 + 0.15 * pulse})`; cx.lineWidth = 3;
        } else {
          cx.strokeStyle = `rgba(74,222,128,${0.4 + 0.2 * pulse})`; cx.lineWidth = 1.5;
        }
      } else {
        cx.strokeStyle = _dis ? '#ef4444' : _mst ? '#a855f7' : isH ? '#10b981' : tw._buffed ? '#5eead4' : (def?.clr || '#555');
        cx.lineWidth = _mst ? 2.5 : tw._buffed ? 2 : 1.5;
      }
      cx.strokeRect(tx + 2, ty + 2, CELL - 4, CELL - 4);
      if (_abh && _ambushReady) {
        // Stealth mode: inner pulsing ring
        const p2 = 0.3 + 0.4 * Math.sin(ticks * 0.12);
        cx.strokeStyle = `rgba(74,222,128,${p2})`; cx.lineWidth = 1;
        cx.strokeRect(tx + 5, ty + 5, CELL - 10, CELL - 10);
      } else if (_mst && !_abh) {
        // Gold inner glow corners
        cx.strokeStyle = '#f59e0b44'; cx.lineWidth = 1;
        cx.strokeRect(tx + 4, ty + 4, CELL - 8, CELL - 8);
      }
      cx.font = Math.floor(CELL * 0.35) + 'px serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
      if (_ambushReady) cx.globalAlpha = 0.25;
      cx.fillText(isH ? '🏺' : (def?.icon || '?'), tx + CELL / 2, ty + CELL / 2);
      cx.globalAlpha = 1;
      // Water pump: rising water fill inside the tower cell
      if (tw.type === 'water_pump') {
        const level = Math.min(1, (tw.fluid?.amount || 0) / 10);
        if (level > 0) {
          const innerH = (CELL - 6) * level;
          const innerY = ty + 3 + (CELL - 6) - innerH;
          cx.save();
          cx.globalAlpha = 0.38;
          cx.fillStyle = '#60a5fa';
          cx.fillRect(tx + 3, innerY, CELL - 6, innerH);
          cx.globalAlpha = 1;
          cx.restore();
        }
      }
    }
    if (tw.level > 0) { cx.font = 'bold ' + Math.floor(CELL * 0.16) + 'px Anybody,sans-serif'; cx.fillStyle = '#fbbf24'; cx.fillText('★'.repeat(Math.min(tw.level, 5)), tx + CELL / 2, ty + CELL - 2); }
  });

  // Castle (end of path) — drawn oversized so it overlaps surrounding tiles
  if (path.length > 2 && _imgCastle.naturalWidth) {
    const lp = path[path.length - 1];
    const cs = CELL * 1.2;
    cx.drawImage(_imgCastle, lp.x * CELL + CELL / 2 - cs / 2, lp.y * CELL + CELL / 2 - cs / 2, cs, cs);
  }

  // Seed Stone
  if (state.seedStone && !state.seedStone.carried) {
    const { x, y } = state.seedStone;
    const px = x * CELL + CELL / 2, py = y * CELL + CELL / 2;
    const pulse = 0.7 + 0.3 * Math.sin(ticks / 18);
    cx.save();
    cx.globalAlpha = pulse;
    cx.shadowColor = '#a78bfa'; cx.shadowBlur = 12;
    cx.font = Math.floor(CELL * 0.45) + 'px serif';
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText('🪨', px, py);
    cx.restore();
  }

  // Mastery auras — second pass so they overlap neighboring towers
  cx.save();
  towers.forEach(tw => {
    if (!tw._mastery) return;
    const px = tw.x * CELL + CELL / 2, py = tw.y * CELL + CELL / 2;
    const pulse = 0.5 + Math.sin(ticks * 0.05) * 0.2;
    if (tw._abhAssault) {
      // Abhorrent Ambush mastery aura — dark green instead of purple
      const gpulse = 0.4 + Math.sin(ticks * 0.07) * 0.2;
      if (tw._assaultReady) {
        // Stealth mode: expanding pulse rings
        const ringT = (ticks * 0.05) % 1;
        cx.beginPath(); cx.arc(px, py, CELL * (0.3 + ringT * 0.5), 0, Math.PI * 2);
        cx.strokeStyle = `rgba(74,222,128,${(1 - ringT) * 0.6})`; cx.lineWidth = 2; cx.stroke();
        if (!state.paused && ticks % 8 === 0) state.particles.push({ x: px + (Math.random()-0.5)*CELL*0.6, y: py + (Math.random()-0.5)*CELL*0.6, vx: (Math.random()-0.5)*0.3, vy: -0.2 - Math.random()*0.4, life: 20+Math.random()*15, clr: Math.random()<0.6 ? '#4ade80' : '#1a2e00', sz: 1.5+Math.random() });
      } else {
        // Idle: faint green ring + occasional dark smoke
        cx.beginPath(); cx.arc(px, py, CELL * 0.5, 0, Math.PI * 2);
        cx.strokeStyle = `rgba(74,222,128,${gpulse.toFixed(2)})`; cx.lineWidth = 1.5; cx.stroke();
        if (!state.paused && ticks % 45 === 0) state.particles.push({ x: px + (Math.random()-0.5)*CELL*0.4, y: py + (Math.random()-0.5)*CELL*0.4, vx: (Math.random()-0.5)*0.3, vy: -0.3 - Math.random()*0.3, life: 18+Math.random()*12, clr: '#1a3300', sz: 2 });
      }
    } else if (tw.type === 'clown') {
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
      if (!state.paused && ticks % 20 === 0) {
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
      if (!state.paused && ticks % 30 === 0) {
        const angle = Math.random() * Math.PI * 2;
        const r = CELL * (0.4 + Math.random() * 0.2);
        state.particles.push({ x: px + Math.cos(angle) * r, y: py + Math.sin(angle) * r,
          vx: (Math.random() - 0.5) * 0.5, vy: -0.4 - Math.random() * 0.4,
          life: 25 + Math.random() * 20, clr: Math.random() < 0.5 ? '#a855f7' : '#f59e0b', sz: 2 + Math.random() });
      }
    }
  });
  cx.restore();

  // Belt rendering — drawn after towers so belts appear on top
  if (state.belts?.length) {
    const pulleyR = CELL * 0.32;
    for (const b of state.belts) {
      const x1 = b.fromX * CELL + CELL / 2, y1 = b.fromY * CELL + CELL / 2;
      const x2 = b.toX   * CELL + CELL / 2, y2 = b.toY   * CELL + CELL / 2;
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const perp = angle + Math.PI / 2;
      const dx = Math.cos(perp) * pulleyR, dy = Math.sin(perp) * pulleyR;

      // Torque-scaled dot speed: look up pulley torque at belt endpoints
      const p1tw = getCell(b.fromX, b.fromY)?.content;
      const p2tw = getCell(b.toX,   b.toY  )?.content;
      const effectiveTorque = Math.max(p1tw?.torque || 0, p2tw?.torque || 0);
      const beltSpeed = effectiveTorque > 0 ? (effectiveTorque / 10) * 0.05 : 0;
      const beltPhase = (state._torquePhase || 0) * beltSpeed;

      cx.save();
      cx.globalAlpha = 0.9;
      cx.strokeStyle = '#44403c'; cx.lineWidth = 3;

      // Draw belt as a closed loop: two straight strips + wrap arcs at each pulley
      cx.beginPath();
      cx.moveTo(x1 + dx, y1 + dy);
      cx.lineTo(x2 + dx, y2 + dy);
      // Wrap arc at pulley B — clockwise sweeps far side of B (away from A)
      cx.arc(x2, y2, pulleyR, perp, perp - Math.PI, false);
      cx.lineTo(x1 - dx, y1 - dy);
      // Wrap arc at pulley A — counterclockwise sweeps far side of A (away from B)
      cx.arc(x1, y1, pulleyR, perp - Math.PI, perp, true);
      cx.closePath();
      cx.stroke();

      // Moving bar segments on each outer strip
      const dist = Math.hypot(x2 - x1, y2 - y1);
      if (beltSpeed > 0 && dist > 0) {
        const step = 20;
        cx.fillStyle = '#78716c';
        for (let t = (beltPhase % step) / dist; t < 1; t += step / dist) {
          const bx = x1 + (x2 - x1) * t, by = y1 + (y2 - y1) * t;
          // Bar on top strip
          cx.save();
          cx.translate(bx + dx, by + dy);
          cx.rotate(angle);
          cx.fillRect(-2, -pulleyR * 0.38, 4, pulleyR * 0.76);
          cx.restore();
          // Bar on bottom strip
          cx.save();
          cx.translate(bx - dx, by - dy);
          cx.rotate(angle);
          cx.fillRect(-2, -pulleyR * 0.38, 4, pulleyR * 0.76);
          cx.restore();
        }
      }
      cx.restore();
    }
    // Belt placement preview
    if (state._beltStart) {
      const sx = state._beltStart.x * CELL + CELL / 2, sy = state._beltStart.y * CELL + CELL / 2;
      const mx = (state._mouseWorldX || sx), my = (state._mouseWorldY || sy);
      cx.save(); cx.globalAlpha = 0.45; cx.strokeStyle = '#f59e0b'; cx.lineWidth = 2; cx.setLineDash([6,4]);
      cx.beginPath(); cx.moveTo(sx, sy); cx.lineTo(mx, my); cx.stroke();
      cx.setLineDash([]); cx.restore();
    }
  }

  // Gem sine wave visual
  if (state._gemWave?.active) {
    const gw = state._gemWave;
    const elapsed = state.ticks - gw.startTick;
    const progress = elapsed / 180;
    const castle = path[path.length - 1];
    if (castle) {
      const cpx = castle.x * CELL + CELL / 2, cpy = castle.y * CELL + CELL / 2;
      for (const tw of towers) {
        if (tw.type !== 'resonating_gem') continue;
        const gpx = tw.x * CELL + CELL / 2, gpy = tw.y * CELL + CELL / 2;
        const dist = Math.hypot(gpx - cpx, gpy - cpy);
        const waveFront = progress * (COLS * CELL);
        if (waveFront < 0) continue;
        const drawLen = Math.min(1, waveFront / dist);
        if (drawLen <= 0) continue;
        cx.save();
        cx.strokeStyle = tw._activated ? '#c084fc' : '#e9d5ff';
        cx.lineWidth = 1.5;
        cx.globalAlpha = 0.7;
        cx.beginPath();
        const steps = 40;
        for (let i = 0; i <= steps; i++) {
          const t = (i / steps) * drawLen;
          const bx2 = cpx + (gpx - cpx) * t;
          const by2 = cpy + (gpy - cpy) * t + Math.sin(t * Math.PI * 6) * CELL * 0.3;
          i === 0 ? cx.moveTo(bx2, by2) : cx.lineTo(bx2, by2);
        }
        cx.stroke();
        cx.restore();
      }
    }
  }

  // Stacks (items on ground)
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

  // Spider Mother (neutral entity — separate from enemies array)
  if (state.spiderMother && !state.spiderMother.dead) {
    const sm = state.spiderMother;
    const px = sm.x * CELL + CELL / 2, py = sm.y * CELL + CELL / 2;
    cx.save();
    cx.font = Math.floor(CELL * 1.1) + 'px serif';
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText('🕷️', px, py);
    // Seed stone carried
    if (sm.stonePickedUp && state.seedStone?.carried) {
      cx.font = Math.floor(CELL * 0.4) + 'px serif';
      cx.fillText('🪨', px + CELL * 0.35, py - CELL * 0.35);
    }
    cx.restore();
  }

  // Enemies
  enemies.forEach(e => {
    if (e.dead) return;
    cx.save(); // Ensure any enemy-specific alpha changes are contained
    const px = e.x * CELL + CELL / 2, py = e.y * CELL + CELL / 2, sz = CELL * e.sz;
    // Patient Watcher: custom rendering
    if (e.watcher) {
      cx.save();
      const r = CELL * 1.2;
      const teleporting = e.watcherPhase === 'teleporting';
      // Dark aura — layered radial glow behind body
      const auraRad1 = r * (2.2 + 0.15 * Math.sin(ticks / 22));
      const auraRad2 = r * (1.6 + 0.1 * Math.sin(ticks / 35 + 1));
      const grad = cx.createRadialGradient(px, py, r * 0.8, px, py, auraRad1);
      grad.addColorStop(0, 'rgba(30,5,60,0.55)');
      grad.addColorStop(0.5, 'rgba(15,0,35,0.3)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      cx.beginPath(); cx.arc(px, py, auraRad1, 0, Math.PI * 2);
      cx.fillStyle = grad; cx.fill();
      const grad2 = cx.createRadialGradient(px, py, r * 0.5, px, py, auraRad2);
      grad2.addColorStop(0, 'rgba(80,0,120,0.35)');
      grad2.addColorStop(1, 'rgba(0,0,0,0)');
      cx.beginPath(); cx.arc(px, py, auraRad2, 0, Math.PI * 2);
      cx.fillStyle = grad2; cx.fill();
      // Body
      cx.beginPath(); cx.arc(px, py, r, 0, Math.PI * 2);
      cx.fillStyle = teleporting ? '#ffffff' : '#4c1d95';
      cx.fill();
      cx.strokeStyle = '#7c3aed'; cx.lineWidth = 3; cx.stroke();
      // 8 eyes orbiting in a ring at fixed radius, all upright, spinning clockwise
      if (e._eyes) {
        const ringRad = r * 0.72;
        const ringSpeed = 0.004; // clockwise
        for (let i = 0; i < e._eyes.length; i++) {
          const eye = e._eyes[i];
          const eyeAng = eye.ang + ticks * ringSpeed;
          const ex2 = px + Math.cos(eyeAng) * ringRad;
          const ey2 = py + Math.sin(eyeAng) * ringRad;
          cx.beginPath(); cx.ellipse(ex2, ey2, CELL * 0.12, CELL * 0.09, 0, 0, Math.PI * 2);
          cx.fillStyle = '#f3f4f6'; cx.fill();
          cx.beginPath(); cx.arc(ex2, ey2 + CELL * 0.02, CELL * 0.055, 0, Math.PI * 2);
          cx.fillStyle = '#1e1b4b'; cx.fill();
        }
      }
      // Nose
      cx.beginPath(); cx.ellipse(px, py + CELL * 0.15, CELL * 0.07, CELL * 0.05, 0, 0, Math.PI * 2);
      cx.fillStyle = '#312e81'; cx.fill();
      // Tentacles with varying thickness (different period from wave)
      if (e._tentacles) {
        for (let i = 0; i < e._tentacles.length; i++) {
          const t = e._tentacles[i];
          const ang = t.baseAngle || (Math.PI * 2 * i / 6);
          const tentWave = Math.sin(ticks / 30 + t.phase) * CELL * 0.3;
          const len = CELL * 0.9 + tentWave;
          const tx2 = px + Math.cos(ang) * r;
          const ty2 = py + Math.sin(ang) * r;
          const cpx = tx2 + Math.cos(ang + Math.PI / 4) * len;
          const cpy = ty2 + Math.sin(ang + Math.PI / 4) * len;
          const thick = CELL * 0.045 + CELL * 0.05 * Math.max(0, Math.sin(ticks / 53 + t.phase * 1.7));
          cx.beginPath(); cx.moveTo(tx2, ty2);
          cx.quadraticCurveTo(cpx, cpy, tx2 + Math.cos(ang) * len * 1.5, ty2 + Math.sin(ang) * len * 1.5);
          cx.strokeStyle = '#5b21b6'; cx.lineWidth = Math.max(1, thick); cx.stroke();
        }
      }
      // HP bar
      const bw = r * 2, bh = 4, bx2 = px - bw / 2, by2 = py - r - 8;
      cx.fillStyle = '#0f0f0f'; cx.fillRect(bx2, by2, bw, bh);
      const pct = e.hp / e.mhp; cx.fillStyle = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#f59e0b' : '#ef4444';
      cx.fillRect(bx2, by2, bw * Math.max(0, pct), bh);
      cx.restore();
      return;
    }
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
    cx.restore();
  });

  // Bees
  bees.forEach(bee => {
    if (bee.dead) return;
    const hive = bee.hive;
    if (!hive) return;
    const frenzy = hive?._supercolony && hive?._beeFrenzyEnd > ticks;
    cx.font = Math.floor(CELL * (frenzy ? 0.38 : 0.3)) + 'px serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    if (frenzy) {
      // Frenzy glow ring
      cx.save();
      cx.globalAlpha = 0.5 + 0.3 * Math.sin(ticks * 0.3);
      cx.beginPath(); cx.arc(bee.x, bee.y, CELL * 0.22, 0, Math.PI * 2);
      cx.fillStyle = '#fef08a'; cx.fill();
      cx.restore();
      // Golden pollen particles every frame during frenzy
      if (ticks % 2 === 0) state.particles.push({ x: bee.x, y: bee.y, vx: (Math.random()-0.5)*2.5, vy: (Math.random()-0.5)*2.5, life: 14, clr: '#fbbf24', sz: 2.5 });
    } else if (hive?._supercolony) {
      // Supercolony: persistent golden pollen trail
      if (ticks % 3 === 0) state.particles.push({ x: bee.x, y: bee.y, vx: (Math.random()-0.5)*1.2, vy: -0.8 - Math.random()*0.8, life: 18, clr: '#fde68a', sz: 2 });
    } else {
      if (ticks % 4 === 0) state.particles.push({ x: bee.x, y: bee.y, vx: 0, vy: 0, life: 8, clr: '#fbbf2444', sz: 1.5 });
    }
    cx.fillText('🐝', bee.x, bee.y);
  });

  // Orbital brood (grateful spider D skill)
  cx.font = Math.floor(CELL * 0.28) + 'px serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  for (const tw of towers) {
    if (tw.type !== 'grateful_spider' || !tw._orbits) continue;
    for (const orb of tw._orbits) {
      if (orb.x !== undefined) cx.fillText('🕷️', orb.x, orb.y);
    }
  }

  // Projectiles
  projectiles.forEach(p => {
    if (p.chain > 0) return;
    const px = p.x * CELL + CELL / 2, py = p.y * CELL + CELL / 2;
    if (p.webShot) {
      cx.font = Math.floor(CELL * 0.45) + 'px serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.fillText('🕸️', px, py);
      return;
    }
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

  // Beams — jagged lightning rendering
  beams.forEach(b => {
    const alpha = Math.min(1, b.life / 6);
    const w = b.w || 2;
    const isTemp = b.clr === '#e8e8e8'; // tempest mastery beam (white)
    // Default beams use tight amplitude; mastery uses wider spread
    const segs = 10;
    const spread = Math.hypot(b.x2 - b.x1, b.y2 - b.y1) * (isTemp ? 0.30 : 0.22);
    const pts = [{ x: b.x1, y: b.y1 }];
    for (let si = 1; si < segs; si++) {
      const t = si / segs;
      const mx = b.x1 + (b.x2 - b.x1) * t, my = b.y1 + (b.y2 - b.y1) * t;
      const px = -(b.y2 - b.y1), py = (b.x2 - b.x1);
      const pl = Math.hypot(px, py) || 1;
      const off = (Math.random() - 0.5) * 2 * spread;
      pts.push({ x: mx + px / pl * off, y: my + py / pl * off });
    }
    pts.push({ x: b.x2, y: b.y2 });
    const drawPts = (lw, clr, a) => {
      cx.globalAlpha = a; cx.strokeStyle = clr; cx.lineWidth = lw;
      cx.beginPath(); pts.forEach((p, i) => i ? cx.lineTo(p.x, p.y) : cx.moveTo(p.x, p.y)); cx.stroke();
    };
    if (isTemp) {
      // Tempest mastery: indigo outer, black core
      drawPts(w + 12, '#818cf833', alpha * 0.4); // wide outer indigo glow
      drawPts(w + 8, '#818cf8', alpha * 0.95);   // thick indigo border
      drawPts(w - 3, '#0a0a0a', alpha);           // narrow black core
    } else {
      // Default lightning: thin, subtle
      drawPts(w + 3, b.clr + '44', alpha * 0.4);  // faint outer glow
      drawPts(w + 1, b.clr, alpha * 0.6);          // color mid
      drawPts(w, '#ffffff', alpha);                 // white core
    }
    // Spark dots at endpoints
    cx.globalAlpha = alpha * 0.9; cx.fillStyle = isTemp ? '#818cf8' : '#ffffff';
    cx.beginPath(); cx.arc(b.x1, b.y1, w + 1, 0, Math.PI * 2); cx.fill();
    cx.beginPath(); cx.arc(b.x2, b.y2, w + 1, 0, Math.PI * 2); cx.fill();
  });
  cx.globalAlpha = 1;

  // Particles
  particles.forEach(p => { cx.globalAlpha = Math.min(1, Math.max(0, p.life / 20)); cx.fillStyle = p.clr; cx.beginPath(); cx.arc(p.x, p.y, p.sz, 0, Math.PI * 2); cx.fill(); }); cx.globalAlpha = 1;

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

  // Steam Age announcement — full-screen canvas overlay matching herald scale
  if (state.forgeAnnounce) {
    const elapsed = ticks - state.forgeAnnounce.tick;
    const dur = 300;
    if (elapsed < dur) {
      const alpha = elapsed < 60 ? elapsed / 60 : elapsed > 240 ? (dur - elapsed) / 60 : 1;
      cx.save();
      cx.fillStyle = `rgba(0,0,0,${0.65 * alpha})`;
      cx.fillRect(0, 0, W, H);
      cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.font = `bold ${Math.floor(H * 0.08)}px serif`;
      cx.fillStyle = `rgba(245,158,11,${alpha})`;
      cx.fillText('⚙️ The Age of Steam', W / 2, H / 2 - Math.floor(H * 0.04));
      cx.font = `${Math.floor(H * 0.04)}px serif`;
      cx.fillStyle = `rgba(253,224,130,${alpha * 0.85})`;
      cx.fillText('You have left the Stone Age. You did not know you were in it.', W / 2, H / 2 + Math.floor(H * 0.045));
      cx.restore();
    } else {
      state.forgeAnnounce = null;
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
