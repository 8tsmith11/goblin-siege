'use strict';
import { state, getCell } from './main.js';
import { TD } from './data.js';
import { dropItem, canTileAccept, RTYPES } from './resources.js';
import { mkGain } from './ui.js';

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

function moveTo(mk, tx, ty) {
  const dx = tx - mk.x, dy = ty - mk.y, d = Math.hypot(dx, dy);
  const weatherMult = state.weather?.id === 'rain' ? 0.8 : 1;
  const spd = MONKEY_SPEED * state.CELL * weatherMult;
  if (d <= spd) { mk.x = tx; mk.y = ty; return true; }
  mk.x += (dx / d) * spd;
  mk.y += (dy / d) * spd;
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
function findNearestStack(ox, oy, range, filter, exclude) {
  const { grid, COLS, ROWS } = state;
  let best = null, bestD = Infinity;
  const r = Math.ceil(range);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const gx = ox + dx, gy = oy + dy;
      if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) continue;
      if (exclude && gx === exclude.x && gy === exclude.y) continue;
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

// ─── Role tickers ─────────────────────────────────────────────────────────────

function tickIdle(mk, tw) {
  mk.patrolAngle += IDLE_SPEED;
  const cx = tw.x * state.CELL + state.CELL / 2;
  const cy = tw.y * state.CELL + state.CELL / 2;
  const tx = cx + Math.cos(mk.patrolAngle) * IDLE_RADIUS * state.CELL;
  const ty = cy + Math.sin(mk.patrolAngle) * IDLE_RADIUS * state.CELL;
  moveTo(mk, tx, ty);
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
  const { towers } = state;
  for (const tw of towers) {
    if (tw.type !== 'monkey' || !tw.monkeys) continue;
    for (const mk of tw.monkeys) {
      if      (mk.role === 'gatherer') tickGatherer(mk, tw);
      else if (mk.role === 'courier')  tickCourier(mk, tw);
      else if (mk.role === 'booster')  tickBooster(mk, tw);
      else                             tickIdle(mk, tw);
    }
  }
  applyBoosterEffects();
}
