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

// Movement with water avoidance — follows water border tile chain
function moveTo(mk, tx, ty) {
  const dx = tx - mk.x, dy = ty - mk.y, d = Math.hypot(dx, dy);
  const weatherMult = state.weather?.id === 'rain' ? 0.8 : 1;
  const spd = MONKEY_SPEED * state.CELL * weatherMult;
  if (d <= spd) { mk.x = tx; mk.y = ty; mk._waterWpt = null; return true; }
  const { CELL } = state;
  const nx = dx / d, ny = dy / d;
  const px = mk.x + nx * spd, py = mk.y + ny * spd;
  // Direct step clear — go straight, discard any active waypoint
  if (getCell(Math.floor(px / CELL), Math.floor(py / CELL))?.type !== 'water') {
    mk._waterWpt = null; mk.x = px; mk.y = py; return false;
  }
  // Blocked by water — follow border tile chain
  const borders = state.waterBorderTiles;
  if (!borders?.length) return false;
  // Refresh waypoint: on first block, or when arrived at current waypoint
  const wptX = mk._waterWpt != null ? mk._waterWpt.x * CELL + CELL / 2 : null;
  const wptY = mk._waterWpt != null ? mk._waterWpt.y * CELL + CELL / 2 : null;
  const arrivedAtWpt = wptX !== null && Math.hypot(mk.x - wptX, mk.y - wptY) < CELL * 0.5;
  if (mk._waterWpt == null || arrivedAtWpt) {
    let bestScore = Infinity;
    for (const b of borders) {
      // Exclude the tile we just arrived at to force progress
      if (arrivedAtWpt && mk._waterWpt && b.x === mk._waterWpt.x && b.y === mk._waterWpt.y) continue;
      const bx = b.x * CELL + CELL / 2, by = b.y * CELL + CELL / 2;
      const score = Math.hypot(mk.x - bx, mk.y - by) + Math.hypot(bx - tx, by - ty);
      if (score < bestScore) { bestScore = score; mk._waterWpt = b; }
    }
  }
  if (mk._waterWpt) {
    const gx = mk._waterWpt.x * CELL + CELL / 2, gy = mk._waterWpt.y * CELL + CELL / 2;
    const ddx = gx - mk.x, ddy = gy - mk.y, dd = Math.hypot(ddx, ddy);
    if (dd > spd) { mk.x += ddx / dd * spd; mk.y += ddy / dd * spd; }
    else { mk.x = gx; mk.y = gy; }
  }
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

// Find next valid delivery target in round-robin targets array starting from startIdx
function nextRRTarget(targets, startIdx, filter) {
  const n = targets.length;
  for (let i = 0; i < n; i++) {
    const idx = (startIdx + i) % n;
    const t = targets[idx];
    if (canTileAccept(t.x, t.y, filter)) return { idx, t };
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
      // Auto-place consumables on path tiles if neuron_activation researched
      if (tryAutoPlace(mk, cfg.dest.x, cfg.dest.y)) { mk.st = 'idle'; return; }
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

function tickRoundRobin(mk, tw) {
  const { cfg } = mk;
  const targets = cfg.targets || [];
  if (!targets.length) { tickIdle(mk, tw); return; }
  // Remove out-of-range targets
  const valid = targets.filter(t => inRange(tw, t.x, t.y));
  if (valid.length !== targets.length) {
    cfg.targets = valid;
    if (cfg.rrIdx >= valid.length) cfg.rrIdx = 0;
    if (!valid.length) { tickIdle(mk, tw); return; }
  }

  if (mk.st === 'idle') {
    if (mk.carrying) {
      const result = nextRRTarget(targets, cfg.rrIdx || 0, mk.carrying.type);
      if (!result) { tickIdle(mk, tw); return; }
      mk._rrDest = result.idx;
      const c = cellCenter(result.t.x, result.t.y);
      mk.targetX = c.x; mk.targetY = c.y;
      mk.st = 'carrying';
      return;
    }
    const itemTile = findNearestStack(tw.x, tw.y, tw.range, cfg.filter, targets);
    if (itemTile) {
      const c = cellCenter(itemTile.x, itemTile.y);
      mk.targetX = c.x; mk.targetY = c.y;
      mk._itemTarget = itemTile;
      mk.st = 'moving';
    } else {
      tickIdle(mk, tw);
    }
  } else if (mk.st === 'moving') {
    if (moveTo(mk, mk.targetX, mk.targetY)) {
      const item = takeFromCell(mk._itemTarget.x, mk._itemTarget.y, cfg.filter);
      mk.st = 'idle';
      if (item) mk.carrying = item;
    }
  } else if (mk.st === 'carrying') {
    if (mk.waitCd > 0) { mk.waitCd--; moveTo(mk, mk.targetX, mk.targetY); return; }
    if (moveTo(mk, mk.targetX, mk.targetY)) {
      const destIdx = mk._rrDest ?? 0;
      const t = targets[destIdx];
      if (!t) { mk.st = 'idle'; return; }
      // Auto-place consumables on path tiles if neuron_activation researched
      if (tryAutoPlace(mk, t.x, t.y)) {
        cfg.rrIdx = (destIdx + 1) % targets.length;
        mk._rrDest = undefined;
        mk.st = 'idle';
      } else {
        const dropped = dropItem(t.x, t.y, mk.carrying.type);
        if (dropped) {
          mk.carrying = null;
          mk.trips++;
          cfg.rrIdx = (destIdx + 1) % targets.length;
          mk._rrDest = undefined;
          mk.st = 'idle';
        } else {
          // Try remaining targets
          let found = false;
          for (let i = 1; i < targets.length; i++) {
            const ni = (destIdx + i) % targets.length;
            if (canTileAccept(targets[ni].x, targets[ni].y, mk.carrying.type)) {
              mk._rrDest = ni;
              const c = cellCenter(targets[ni].x, targets[ni].y);
              mk.targetX = c.x; mk.targetY = c.y;
              found = true;
              break;
            }
          }
          if (!found) mk.waitCd = 60;
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
      const prevX = mk.x, prevY = mk.y;
      if      (mk.role === 'gatherer')    tickGatherer(mk, tw);
      else if (mk.role === 'courier')     tickCourier(mk, tw);
      else if (mk.role === 'booster')     tickBooster(mk, tw);
      else if (mk.role === 'round_robin') tickRoundRobin(mk, tw);
      else if (mk.role === 'harvester')   tickHarvester(mk, tw);
      else                                tickIdle(mk, tw);
      // Stuck detection: if on water or barely moved for too long, snap back to hut
      const onWater = state.grid.length && getCell(Math.floor(mk.x / CELL), Math.floor(mk.y / CELL))?.type === 'water';
      if (onWater) { mk.x = hutCx; mk.y = hutCy; mk._stuckTicks = 0; mk._waterWpt = null; continue; }
      if (Math.hypot(mk.x - prevX, mk.y - prevY) < 0.1) {
        mk._stuckTicks = (mk._stuckTicks || 0) + 1;
        if (mk._stuckTicks > 120) { mk.x = hutCx; mk.y = hutCy; mk._stuckTicks = 0; mk._waterWpt = null; mk.st = 'idle'; }
      } else {
        mk._stuckTicks = 0;
      }
    }
  }
  applyBoosterEffects();
}
