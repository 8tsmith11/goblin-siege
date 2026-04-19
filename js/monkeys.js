'use strict';
import { state, getCell } from './main.js';
import { TD } from './data.js';
import { dropItem, canTileAccept, RTYPES } from './resources.js';
import { mkGain } from './ui.js';
import { placeConsumable } from './craft.js';

// Items that can be auto-placed on path tiles by monkeys (neuron_activation research)
const AUTO_PLACE_IDS = new Set(['stone_trap', 'sticky_sap']);

function tryAutoPlace(mk, gx, gy) {
  if (!state.researchUnlocks?.monkey_auto_place) return false;
  if (!mk.carrying) return false;
  if (!AUTO_PLACE_IDS.has(mk.carrying.type)) return false;
  if (!state.pathSet?.has(gx + ',' + gy)) return false;
  // Don't place if a trap already exists on this tile
  if (state.traps?.some(t => t.x === gx && t.y === gy)) return false;
  // Find matching item in inventory or directly place via craft system
  const fakeItem = { id: mk.carrying.type, output: 'consumable' };
  const placed = placeConsumable(fakeItem, gx, gy);
  if (placed) { mk.carrying = null; mk.trips++; return true; }
  return false;
}

export const MONKEY_NAMES = ['Bongo','Mango','Zazu','Kiki','Popo','Tiko','Wren','Nala',
                              'Figgy','Morsel','Turnip','Widget','Clementine','Nubs'];

const MONKEY_SPEED = 0.04; // tiles per tick (~1.5 tiles/sec at 60fps)
const IDLE_RADIUS  = 0.6;  // orbit radius in tiles
const IDLE_SPEED   = 0.02; // radians per tick

// ─── Factory ─────────────────────────────────────────────────────────────────

export function initMonkeys(capacity) {
  const names = [...MONKEY_NAMES].sort(() => Math.random() - 0.5);
  return Array.from({ length: capacity }, (_, i) => ({
    // persistent
    name: names[i % names.length],
    role: null,
    cfg: { filter: null, dest: null, from: null, boost: null },
    trips: 0,
    // ephemeral (stripped from save)
    x: 0, y: 0,
    st: 'idle',
    carrying: null,
    patrolAngle: Math.random() * Math.PI * 2,
    targetX: null, targetY: null,
    waitCd: 0,
  }));
}

export function reinitMonkeys(towers) {
  for (const tw of towers) {
    if (tw.type !== 'monkey') continue;
    if (!tw.monkeys) tw.monkeys = initMonkeys(TD.monkey?.capacity ?? 2);
    for (const mk of tw.monkeys) {
      const cx = tw.x * state.CELL + state.CELL / 2;
      const cy = tw.y * state.CELL + state.CELL / 2;
      mk.x = cx + Math.cos(mk.patrolAngle || 0) * state.CELL * 0.6;
      mk.y = cy + Math.sin(mk.patrolAngle || 0) * state.CELL * 0.6;
      mk.st = 'idle';
      mk.carrying = null;
      mk.patrolAngle = mk.patrolAngle ?? (Math.random() * Math.PI * 2);
      mk.targetX = null;
      mk.targetY = null;
      mk.waitCd = 0;
    }
  }
}

// ─── Movement helper ──────────────────────────────────────────────────────────

// Raw movement with no water avoidance — for idle orbiting
function moveToRaw(mk, tx, ty) {
  const dx = tx - mk.x, dy = ty - mk.y, d = Math.hypot(dx, dy);
  const weatherMult = state.weather?.id === 'rain' ? 0.8 : 1;
  const spd = MONKEY_SPEED * state.CELL * weatherMult;
  if (d <= spd) { mk.x = tx; mk.y = ty; return true; }
  mk.x += dx / d * spd; mk.y += dy / d * spd;
  return false;
}

// BFS path around water tiles (inner grid coords)
function bfsPath(fromGx, fromGy, toGx, toGy) {
  const { COLS, ROWS } = state;
  if (fromGx === toGx && fromGy === toGy) return [];
  const prev = new Map();
  const queue = [[fromGx, fromGy]];
  const startKey = `${fromGx},${fromGy}`;
  prev.set(startKey, null);
  while (queue.length) {
    const [x, y] = queue.shift();
    if (x === toGx && y === toGy) {
      const path = [];
      let cur = `${x},${y}`;
      while (cur !== startKey) {
        const [cx, cy] = cur.split(',').map(Number);
        path.unshift({ x: cx, y: cy });
        cur = prev.get(cur);
      }
      return path;
    }
    for (const [ddx, ddy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nx = x + ddx, ny = y + ddy;
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
      const key = `${nx},${ny}`;
      if (prev.has(key)) continue;
      if (getCell(nx, ny)?.type === 'water') continue;
      prev.set(key, `${x},${y}`);
      queue.push([nx, ny]);
    }
  }
  return [];
}

// Check if a straight pixel line from (x1,y1) to (x2,y2) crosses any water cell
function lineCrossesWater(x1, y1, x2, y2, CELL) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / (CELL * 0.5)));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (getCell(Math.floor((x1 + (x2 - x1) * t) / CELL), Math.floor((y1 + (y2 - y1) * t) / CELL))?.type === 'water') return true;
  }
  return false;
}

// Movement: BFS computed once per destination if water is in the way; otherwise direct
function moveTo(mk, tx, ty) {
  const { CELL } = state;
  const dx = tx - mk.x, dy = ty - mk.y, d = Math.hypot(dx, dy);
  const spd = MONKEY_SPEED * CELL * (state.weather?.id === 'rain' ? 0.8 : 1);
  if (d <= spd) { mk.x = tx; mk.y = ty; mk._waterPath = null; mk._waterDst = null; return true; }

  // Follow existing BFS path without re-checking for water
  if (mk._waterPath && mk._waterPath.length) {
    const wp = mk._waterPath[0];
    const wpx = wp.x * CELL + CELL / 2, wpy = wp.y * CELL + CELL / 2;
    const wd = Math.hypot(wpx - mk.x, wpy - mk.y);
    if (wd <= spd) { mk.x = wpx; mk.y = wpy; mk._waterPath.shift(); }
    else { mk.x += (wpx - mk.x) / wd * spd; mk.y += (wpy - mk.y) / wd * spd; }
    return false;
  }

  // Check once per destination whether a BFS detour is needed
  const dstKey = `${Math.floor(tx / CELL)},${Math.floor(ty / CELL)}`;
  if (mk._waterDst !== dstKey) {
    mk._waterDst = dstKey;
    if (lineCrossesWater(mk.x, mk.y, tx, ty, CELL)) {
      mk._waterPath = bfsPath(Math.floor(mk.x / CELL), Math.floor(mk.y / CELL),
                               Math.floor(tx   / CELL), Math.floor(ty   / CELL));
    }
  }

  // If a path was just computed, start following it
  if (mk._waterPath && mk._waterPath.length) {
    const wp = mk._waterPath[0];
    const wpx = wp.x * CELL + CELL / 2, wpy = wp.y * CELL + CELL / 2;
    const wd = Math.hypot(wpx - mk.x, wpy - mk.y);
    if (wd <= spd) { mk.x = wpx; mk.y = wpy; mk._waterPath.shift(); }
    else { mk.x += (wpx - mk.x) / wd * spd; mk.y += (wpy - mk.y) / wd * spd; }
    return false;
  }

  // Direct movement
  mk.x += dx / d * spd; mk.y += dy / d * spd;
  return false;
}

function cellCenter(gx, gy) {
  return { x: gx * state.CELL + state.CELL / 2, y: gy * state.CELL + state.CELL / 2 };
}

// ─── Item helpers ─────────────────────────────────────────────────────────────

// Take 1 item from ground stacks at (gx, gy), respecting filter. Returns { type } or null.
function takeFromCell(gx, gy, filter) {
  const cell = getCell(gx, gy);
  if (!cell?.stacks) return null;
  for (let i = 0; i < 4; i++) {
    const s = cell.stacks[i];
    if (!s) continue;
    if (filter && s.type !== filter) continue;
    const type = s.type;
    s.count--;
    if (s.count <= 0) cell.stacks[i] = null;
    return { type };
  }
  return null;
}

// Take 1 item from a stockpile's slots, respecting filter. Returns { type } or null.
function takeFromStockpileSlots(gx, gy, filter) {
  const sp = getCell(gx, gy)?.content;
  if (!sp?.slots) return null;
  for (let i = 0; i < sp.slots.length; i++) {
    const s = sp.slots[i];
    if (!s || s.count <= 0) continue;
    if (filter && s.type !== filter) continue;
    const type = s.type;
    s.count--;
    if (s.count === 0) sp.slots[i] = null;
    return { type };
  }
  return null;
}

// Check if the tower at (gx, gy) is a stockpile in storage mode
function isStorageStockpile(gx, gy) {
  const tw = getCell(gx, gy)?.content;
  return tw?.type === 'stockpile' && tw?.mode !== 'interface';
}

// Find nearest cell with a matching stack within range tiles of (ox, oy)
// exclude can be a single {x,y} or an array of {x,y}
function findNearestStack(ox, oy, range, filter, exclude) {
  const { grid, COLS, ROWS } = state;
  const excArr = !exclude ? [] : Array.isArray(exclude) ? exclude : [exclude];
  let best = null, bestD = Infinity;
  const r = Math.ceil(range);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const gx = ox + dx, gy = oy + dy;
      if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) continue;
      if (excArr.some(e => gx === e.x && gy === e.y)) continue;
      if (Math.hypot(dx, dy) > range) continue;
      const cell = getCell(gx, gy);
      if (!cell?.stacks) continue;
      const hasMatch = cell.stacks.some(s => s && (!filter || s.type === filter));
      if (!hasMatch) continue;
      const d = Math.hypot(dx, dy);
      if (d < bestD) { bestD = d; best = { x: gx, y: gy }; }
    }
  }
  return best;
}

// Find next valid delivery target in round-robin targets array starting from startIdx.
// Trap items additionally require no existing trap on the tile.
function nextRRTarget(targets, startIdx, filter) {
  const n = targets.length;
  const isTrap = AUTO_PLACE_IDS.has(filter);
  for (let i = 0; i < n; i++) {
    const idx = (startIdx + i) % n;
    const t = targets[idx];
    if (!canTileAccept(t.x, t.y, filter)) continue;
    if (isTrap && state.traps?.some(tr => tr.x === t.x && tr.y === t.y)) continue;
    return { idx, t };
  }
  return null;
}

// ─── Role tickers ─────────────────────────────────────────────────────────────

function tickIdle(mk, tw) {
  mk.patrolAngle += IDLE_SPEED;
  const cx = tw.x * state.CELL + state.CELL / 2;
  const cy = tw.y * state.CELL + state.CELL / 2;
  const tx = cx + Math.cos(mk.patrolAngle) * IDLE_RADIUS * state.CELL;
  const ty = cy + Math.sin(mk.patrolAngle) * IDLE_RADIUS * state.CELL;
  moveToRaw(mk, tx, ty);
}

function inRange(tw, gx, gy) {
  return Math.hypot(gx - tw.x, gy - tw.y) <= (tw.range || 4);
}

function tickGatherer(mk, tw) {
  const { cfg } = mk;

  // No destination configured or dest out of range — orbit hut
  if (!cfg.dest || !inRange(tw, cfg.dest.x, cfg.dest.y)) { tickIdle(mk, tw); return; }

  if (mk.st === 'idle') {
    // Orbit if dest is full or can't accept the item type
    if (!canTileAccept(cfg.dest.x, cfg.dest.y, cfg.filter)) { tickIdle(mk, tw); return; }
    // Already carrying — dest has space now, go deliver
    if (mk.carrying) {
      const c = cellCenter(cfg.dest.x, cfg.dest.y);
      mk.targetX = c.x; mk.targetY = c.y;
      mk.st = 'carrying';
      return;
    }
    // Scan for nearest item in range, skip destination tile to avoid pickup loop
    const target = findNearestStack(tw.x, tw.y, tw.range, cfg.filter, cfg.dest);
    if (target) {
      const c = cellCenter(target.x, target.y);
      mk.targetX = c.x; mk.targetY = c.y;
      mk._itemTarget = target;
      mk.st = 'moving';
    } else {
      tickIdle(mk, tw);
    }
  } else if (mk.st === 'moving') {
    if (moveTo(mk, mk.targetX, mk.targetY)) {
      // Arrived at item cell — try to pick up
      const item = takeFromCell(mk._itemTarget.x, mk._itemTarget.y, cfg.filter);
      if (item) {
        mk.carrying = item;
        const c = cellCenter(cfg.dest.x, cfg.dest.y);
        mk.targetX = c.x; mk.targetY = c.y;
        mk.st = 'carrying';
      } else {
        mk.st = 'idle'; // item already gone
      }
    }
  } else if (mk.st === 'carrying') {
    if (moveTo(mk, mk.targetX, mk.targetY)) {
      const dropped = dropItem(cfg.dest.x, cfg.dest.y, mk.carrying.type);
      if (dropped) { mk.carrying = null; mk.trips++; }
      mk.st = 'idle';
    }
  }
}

function tickCourier(mk, tw) {
  const { cfg } = mk;

  if (!cfg.from || !cfg.dest || !inRange(tw, cfg.from.x, cfg.from.y) || !inRange(tw, cfg.dest.x, cfg.dest.y)) { tickIdle(mk, tw); return; }

  if (mk.st === 'idle') {
    // Travel to from tile
    const c = cellCenter(cfg.from.x, cfg.from.y);
    mk.targetX = c.x; mk.targetY = c.y;
    mk.st = 'moving';
  } else if (mk.st === 'at_from') {
    // Orbit from tile, retry pickup periodically
    mk.patrolAngle += IDLE_SPEED;
    const c = cellCenter(cfg.from.x, cfg.from.y);
    const tx = c.x + Math.cos(mk.patrolAngle) * IDLE_RADIUS * state.CELL;
    const ty = c.y + Math.sin(mk.patrolAngle) * IDLE_RADIUS * state.CELL;
    moveTo(mk, tx, ty);
    if (mk.waitCd > 0) { mk.waitCd--; return; }
    // Try pickup
    let item = null;
    if (isStorageStockpile(cfg.from.x, cfg.from.y)) {
      item = takeFromStockpileSlots(cfg.from.x, cfg.from.y, cfg.filter);
      if (item) {
        const rt = RTYPES[item.type];
        if (rt) mkGain(cfg.from.x * state.CELL + state.CELL / 2, cfg.from.y * state.CELL + state.CELL / 2, rt.icon, -1, '#ef4444');
      }
    } else {
      item = takeFromCell(cfg.from.x, cfg.from.y, cfg.filter);
    }
    if (item) {
      mk.carrying = item;
      const dest = cellCenter(cfg.dest.x, cfg.dest.y);
      mk.targetX = dest.x; mk.targetY = dest.y;
      mk.st = 'carrying';
    } else {
      mk.waitCd = 30;
    }
  } else if (mk.st === 'moving') {
    if (moveTo(mk, mk.targetX, mk.targetY)) {
      // Arrived at from tile — try pickup
      let item = null;
      if (isStorageStockpile(cfg.from.x, cfg.from.y)) {
        item = takeFromStockpileSlots(cfg.from.x, cfg.from.y, cfg.filter);
        if (item) {
          const rt = RTYPES[item.type];
          if (rt) mkGain(cfg.from.x * state.CELL + state.CELL / 2, cfg.from.y * state.CELL + state.CELL / 2, rt.icon, -1, '#ef4444');
        }
      } else {
        item = takeFromCell(cfg.from.x, cfg.from.y, cfg.filter);
      }
      if (item) {
        mk.carrying = item;
        const c = cellCenter(cfg.dest.x, cfg.dest.y);
        mk.targetX = c.x; mk.targetY = c.y;
        mk.st = 'carrying';
      } else {
        mk.waitCd = 30;
        mk.st = 'at_from';
      }
    }
  } else if (mk.st === 'carrying') {
    if (moveTo(mk, mk.targetX, mk.targetY)) {
      if (mk.waitCd > 0) { mk.waitCd--; return; }
      if (mk.carrying && AUTO_PLACE_IDS.has(mk.carrying.type) && state.researchUnlocks?.monkey_auto_place && state.pathSet?.has(`${cfg.dest.x},${cfg.dest.y}`)) {
        if (state.traps?.some(t => t.x === cfg.dest.x && t.y === cfg.dest.y)) {
          mk.waitCd = 60; return; // trap already there — wait for it to be consumed
        }
        const placed = placeConsumable({ id: mk.carrying.type, output: 'consumable' }, cfg.dest.x, cfg.dest.y);
        if (placed) { mk.carrying = null; mk.trips++; mk.st = 'idle'; return; }
      }
      const dropped = dropItem(cfg.dest.x, cfg.dest.y, mk.carrying.type);
      if (dropped) {
        mk.carrying = null;
        mk.trips++;
        mk.st = 'idle';
      } else {
        mk.waitCd = 60; // dest full — retry in ~1s
      }
    }
  }
}

// Shared: drop or place-trap at a destination tile, advance rrIdx/rrFromIdx
function _rrDeliver(mk, cfg, dx, dy, idxKey, listKey) {
  const list = cfg[listKey] || [];
  const idx = mk._rrDest ?? 0;
  if (mk.carrying && AUTO_PLACE_IDS.has(mk.carrying.type) && state.researchUnlocks?.monkey_auto_place && state.pathSet?.has(`${dx},${dy}`)) {
    if (state.traps?.some(tr => tr.x === dx && tr.y === dy)) {
      cfg[idxKey] = (idx + 1) % Math.max(1, list.length);
      mk._rrDest = undefined; mk.st = 'idle'; return;
    }
    const placed = placeConsumable({ id: mk.carrying.type, output: 'consumable' }, dx, dy);
    if (placed) { mk.carrying = null; mk.trips++; cfg[idxKey] = (idx + 1) % Math.max(1, list.length); mk._rrDest = undefined; mk.st = 'idle'; return; }
  }
  const dropped = dropItem(dx, dy, mk.carrying.type);
  if (dropped) {
    mk.carrying = null; mk.trips++;
    cfg[idxKey] = (idx + 1) % Math.max(1, list.length);
    mk._rrDest = undefined; mk.st = 'idle';
  } else {
    mk.waitCd = 60;
  }
}

// Orbit a tile center while waiting for pickup
function _orbitTile(mk, cx, cy) {
  mk.patrolAngle = (mk.patrolAngle || 0) + IDLE_SPEED;
  const tx = cx + Math.cos(mk.patrolAngle) * IDLE_RADIUS * state.CELL;
  const ty = cy + Math.sin(mk.patrolAngle) * IDLE_RADIUS * state.CELL;
  moveTo(mk, tx, ty);
}

function _tryPickup(src, filter) {
  if (!src) return null;
  if (isStorageStockpile(src.x, src.y)) return takeFromStockpileSlots(src.x, src.y, filter);
  return takeFromCell(src.x, src.y, filter);
}

function tickRoundRobin(mk, tw) {
  const { cfg } = mk;
  const mode = cfg.rrMode || 'tos'; // 'tos' = single-from multi-to, 'froms' = multi-from single-to

  if (mode === 'froms') {
    // ── MULTI-FROM mode: cycle through froms, deliver to single dest ──
    const froms = cfg.froms || [];
    if (!froms.length || !cfg.dest || !inRange(tw, cfg.dest.x, cfg.dest.y)) { tickIdle(mk, tw); return; }
    const validFroms = froms.filter(f => inRange(tw, f.x, f.y));
    if (validFroms.length !== froms.length) {
      cfg.froms = validFroms;
      if ((cfg.rrFromIdx || 0) >= validFroms.length) cfg.rrFromIdx = 0;
      if (!validFroms.length) { tickIdle(mk, tw); return; }
    }
    const src = froms[cfg.rrFromIdx || 0];
    const sc = cellCenter(src.x, src.y);

    if (mk.st === 'idle') {
      if (mk.carrying) {
        const dc = cellCenter(cfg.dest.x, cfg.dest.y);
        mk.targetX = dc.x; mk.targetY = dc.y; mk._rrDest = 0; mk.st = 'carrying';
      } else {
        mk.targetX = sc.x; mk.targetY = sc.y; mk.st = 'moving';
      }
    } else if (mk.st === 'moving') {
      if (moveTo(mk, mk.targetX, mk.targetY)) {
        const item = _tryPickup(src, cfg.filter);
        if (item) { mk.carrying = item; mk.st = 'idle'; }
        else {
          // Source empty — immediately try next from
          cfg.rrFromIdx = ((cfg.rrFromIdx || 0) + 1) % froms.length;
          mk.st = 'idle';
        }
      }
    } else if (mk.st === 'at_from') {
      _orbitTile(mk, sc.x, sc.y);
      if (mk.waitCd > 0) { mk.waitCd--; return; }
      const item = _tryPickup(src, cfg.filter);
      if (item) { mk.carrying = item; mk.st = 'idle'; }
      else {
        // Source still empty — advance to next from
        cfg.rrFromIdx = ((cfg.rrFromIdx || 0) + 1) % froms.length;
        mk.st = 'idle';
      }
    } else if (mk.st === 'carrying') {
      if (mk.waitCd > 0) { mk.waitCd--; return; }
      if (moveTo(mk, mk.targetX, mk.targetY)) {
        _rrDeliver(mk, cfg, cfg.dest.x, cfg.dest.y, 'rrFromIdx', 'froms');
      }
    }
    return;
  }

  // ── TOS mode: single-from (optional), multi-target ──
  const targets = cfg.targets || [];
  if (!targets.length) { tickIdle(mk, tw); return; }
  const valid = targets.filter(t => inRange(tw, t.x, t.y));
  if (valid.length !== targets.length) {
    cfg.targets = valid;
    if ((cfg.rrIdx || 0) >= valid.length) cfg.rrIdx = 0;
    if (!valid.length) { tickIdle(mk, tw); return; }
  }

  // Helper: orbit the "from" tile or the hut while waiting
  const _waitNear = () => {
    if (cfg.from && inRange(tw, cfg.from.x, cfg.from.y)) {
      const c = cellCenter(cfg.from.x, cfg.from.y); _orbitTile(mk, c.x, c.y);
    } else { tickIdle(mk, tw); }
  };

  if (mk.st === 'idle') {
    if (mk.carrying) {
      const result = nextRRTarget(targets, cfg.rrIdx || 0, mk.carrying.type);
      if (!result) { _waitNear(); return; } // nowhere to deliver — wait at from
      mk._rrDest = result.idx;
      const c = cellCenter(result.t.x, result.t.y);
      mk.targetX = c.x; mk.targetY = c.y; mk.st = 'carrying'; return;
    }
    // Before picking up a trap item, confirm at least one target has room
    if (cfg.filter && AUTO_PLACE_IDS.has(cfg.filter)) {
      if (!nextRRTarget(targets, cfg.rrIdx || 0, cfg.filter)) { _waitNear(); return; }
    }
    if (cfg.from && inRange(tw, cfg.from.x, cfg.from.y)) {
      const c = cellCenter(cfg.from.x, cfg.from.y);
      mk.targetX = c.x; mk.targetY = c.y; mk._itemTarget = cfg.from; mk.st = 'moving';
    } else {
      const itemTile = findNearestStack(tw.x, tw.y, tw.range, cfg.filter, targets);
      if (itemTile) {
        const c = cellCenter(itemTile.x, itemTile.y);
        mk.targetX = c.x; mk.targetY = c.y; mk._itemTarget = itemTile; mk.st = 'moving';
      } else { tickIdle(mk, tw); }
    }
  } else if (mk.st === 'moving') {
    if (moveTo(mk, mk.targetX, mk.targetY)) {
      const item = _tryPickup(mk._itemTarget, cfg.filter);
      if (item) { mk.carrying = item; mk.st = 'idle'; }
      else if (cfg.from) { mk.waitCd = 30; mk.st = 'at_from'; }
      else mk.st = 'idle';
    }
  } else if (mk.st === 'at_from') {
    // Orbit the from tile while waiting for items
    if (cfg.from) {
      const c = cellCenter(cfg.from.x, cfg.from.y);
      _orbitTile(mk, c.x, c.y);
    }
    if (mk.waitCd > 0) { mk.waitCd--; return; }
    const item = _tryPickup(cfg.from, cfg.filter);
    if (item) { mk.carrying = item; mk.st = 'idle'; }
    else mk.waitCd = 30;
  } else if (mk.st === 'carrying') {
    if (mk.waitCd > 0) { mk.waitCd--; moveTo(mk, mk.targetX, mk.targetY); return; }
    if (moveTo(mk, mk.targetX, mk.targetY)) {
      const destIdx = mk._rrDest ?? 0;
      const t = targets[destIdx];
      if (!t) { mk.st = 'idle'; return; }
      mk._rrDest = destIdx; // keep for _rrDeliver
      _rrDeliver(mk, cfg, t.x, t.y, 'rrIdx', 'targets');
      // If _rrDeliver didn't deliver, try remaining targets
      if (mk.st !== 'idle' && mk.waitCd <= 0) {
        for (let i = 1; i < targets.length; i++) {
          const ni = (destIdx + i) % targets.length;
          if (canTileAccept(targets[ni].x, targets[ni].y, mk.carrying?.type)) {
            mk._rrDest = ni;
            const c = cellCenter(targets[ni].x, targets[ni].y);
            mk.targetX = c.x; mk.targetY = c.y; break;
          }
        }
      }
    }
  }
}

// All non-carrying harvesters targeting same source (for orbit spacing + max-2 enforcement)
function getActiveMinersOnSrc(src) {
  const miners = [];
  for (const hut of state.towers) {
    if (hut.type !== 'monkey' || !hut.monkeys) continue;
    for (const m of hut.monkeys) {
      if (m.role === 'harvester' && m.cfg.harvestSrc?.x === src.x && m.cfg.harvestSrc?.y === src.y && m.st !== 'carrying') miners.push(m);
    }
  }
  return miners;
}

function tickHarvester(mk, tw) {
  const { cfg } = mk;
  if (!cfg.harvestSrc || !cfg.dest) { tickIdle(mk, tw); return; }
  if (!inRange(tw, cfg.dest.x, cfg.dest.y)) { tickIdle(mk, tw); return; }

  const src = cfg.harvestSrc;
  const { CELL } = state;

  // Validate rock node still exists
  if (!src.isForest && getCell(src.x, src.y)?.type !== 'node') {
    cfg.harvestSrc = null; mk.st = 'idle'; return;
  }

  // Deliver
  if (mk.st === 'carrying') {
    if (mk.waitCd > 0) { mk.waitCd--; return; }
    const dc = cellCenter(cfg.dest.x, cfg.dest.y);
    if (moveTo(mk, dc.x, dc.y)) {
      const dropped = dropItem(cfg.dest.x, cfg.dest.y, mk.carrying.type);
      if (dropped) { mk.carrying = null; mk.trips++; mk._harvestCd = 0; mk.st = 'idle'; }
      else mk.waitCd = 30;
    }
    return;
  }

  // Slot check — max 2 active miners per source
  const miners = getActiveMinersOnSrc(src);
  const myIdx = miners.indexOf(mk);
  if (myIdx < 0 || myIdx >= 2) { tickIdle(mk, tw); return; }
  const n = Math.min(miners.length, 2);

  if (src.isForest) {
    // Move to forest tile, then mine invisibly
    const fx = src.x * CELL + CELL / 2, fy = src.y * CELL + CELL / 2;
    if (Math.hypot(mk.x - fx, mk.y - fy) > CELL * 0.4) { moveTo(mk, fx, fy); mk.st = 'moving'; return; }
    mk.st = 'orbiting'; // signals renderer to hide monkey
    if (mk._harvestCd > 0) { mk._harvestCd--; return; }
    mk._harvestCd = 180;
    if (Math.random() < 0.08) {
      mk.carrying = { type: 'wood' };
      mk.st = 'carrying';
      mkGain(fx, fy, RTYPES.wood.icon, 1, RTYPES.wood.clr);
    }
  } else {
    // Sit still on a fixed corner of the rock tile
    const nc = cellCenter(src.x, src.y);
    const OFF = 0.28 * CELL;
    const corners = [{ x: nc.x - OFF, y: nc.y - OFF }, { x: nc.x + OFF, y: nc.y + OFF }];
    const pos = corners[myIdx] || corners[0];
    if (Math.hypot(mk.x - pos.x, mk.y - pos.y) > CELL * 0.15) { moveTo(mk, pos.x, pos.y); mk.st = 'moving'; return; }
    mk.st = 'orbiting'; // reusing state to signal renderer that miner is at work
    if (mk._harvestCd > 0) { mk._harvestCd--; return; }
    const node = getCell(src.x, src.y)?.content;
    if (!node || node.cd > 0) return;
    node.wobbleTick = 8; node.cd = 12;
    mk._harvestCd = 120;
    if (Math.random() < 0.20) {
      mk.carrying = { type: 'stone' };
      mk.st = 'carrying';
      mkGain(nc.x, nc.y, RTYPES.stone.icon, 1, RTYPES.stone.clr);
    }
  }
}

function tickBooster(mk, tw) {
  const { cfg } = mk;

  if (!cfg.boost || !inRange(tw, cfg.boost.x, cfg.boost.y)) { tickIdle(mk, tw); return; }

  // Check if target tower still exists
  const targetCell = getCell(cfg.boost.x, cfg.boost.y);
  if (!targetCell?.content || targetCell.content.type === 'monkey') {
    mk.st = 'idle';
    cfg.boost = null;
    return;
  }

  const c = cellCenter(cfg.boost.x, cfg.boost.y);
  if (mk.st !== 'boosting' && mk.st !== 'going_boost') {
    mk.targetX = c.x; mk.targetY = c.y;
    mk.st = 'going_boost';
  }
  if (mk.st === 'going_boost') {
    if (moveTo(mk, c.x, c.y)) mk.st = 'boosting';
  } else {
    // Stay at target (drift back if nudged)
    moveTo(mk, c.x, c.y);
  }
}

// ─── Booster effects ─────────────────────────────────────────────────────────

function applyBoosterEffects() {
  // Clear previous frame's effects
  for (const tw of state.towers) {
    tw._monkeyBoosted = false;
    tw._monkeyBoostCount = 0;
  }
  // Only the first booster per building counts — no stacking
  const boostedKeys = new Set();
  for (const hut of state.towers) {
    if (hut.type !== 'monkey' || !hut.monkeys) continue;
    for (const mk of hut.monkeys) {
      if (mk.role !== 'booster' || mk.st !== 'boosting' || !mk.cfg.boost) continue;
      const target = state.towers.find(t => t.x === mk.cfg.boost.x && t.y === mk.cfg.boost.y);
      if (!target) continue;
      const key = `${target.x},${target.y}`;
      if (boostedKeys.has(key)) continue; // already boosted — ignore extra monkey
      boostedKeys.add(key);
      target._monkeyBoosted = true;
      target._monkeyBoostCount = 1;
    }
  }
}

// ─── Main update ─────────────────────────────────────────────────────────────

export function updateMonkeys() {
  const { towers, CELL } = state;
  for (const tw of towers) {
    if (tw.type !== 'monkey' || !tw.monkeys) continue;
    const hutCx = tw.x * CELL + CELL / 2, hutCy = tw.y * CELL + CELL / 2;
    for (const mk of tw.monkeys) {
      if      (mk.role === 'gatherer')    tickGatherer(mk, tw);
      else if (mk.role === 'courier')     tickCourier(mk, tw);
      else if (mk.role === 'booster')     tickBooster(mk, tw);
      else if (mk.role === 'round_robin') tickRoundRobin(mk, tw);
      else if (mk.role === 'harvester')   tickHarvester(mk, tw);
      else                                tickIdle(mk, tw);
    }
  }
  applyBoosterEffects();
}
