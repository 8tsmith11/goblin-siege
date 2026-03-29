'use strict';
import { state } from './main.js';
import { TD } from './data.js';
import { dropItem } from './resources.js';

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
      mk.x = tw.x * state.CELL + state.CELL / 2;
      mk.y = tw.y * state.CELL + state.CELL / 2;
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
  const spd = MONKEY_SPEED * state.CELL;
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
  const cell = state.grid[gy]?.[gx];
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

// Take 1 item from state.resources, respecting filter. Returns { type } or null.
function takeFromResources(filter) {
  const res = state.resources || {};
  const keys = filter ? [filter] : Object.keys(res);
  for (const k of keys) {
    if ((res[k] || 0) > 0) {
      res[k]--;
      return { type: k };
    }
  }
  return null;
}

// Check if the tower at (gx, gy) is a stockpile
function isStockpile(gx, gy) {
  return state.grid[gy]?.[gx]?.content?.type === 'stockpile';
}

// Find nearest cell with a matching stack within range tiles of (ox, oy)
function findNearestStack(ox, oy, range, filter) {
  const { grid, COLS, ROWS } = state;
  let best = null, bestD = Infinity;
  const r = Math.ceil(range);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const gx = ox + dx, gy = oy + dy;
      if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) continue;
      if (Math.hypot(dx, dy) > range) continue;
      const cell = grid[gy]?.[gx];
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

function tickGatherer(mk, tw) {
  const { cfg } = mk;

  // No destination configured — orbit hut
  if (!cfg.dest) { tickIdle(mk, tw); return; }

  if (mk.st === 'idle') {
    // Scan for nearest item in range
    const target = findNearestStack(tw.x, tw.y, tw.range, cfg.filter);
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
      dropItem(cfg.dest.x, cfg.dest.y, mk.carrying.type);
      mk.carrying = null;
      mk.trips++;
      mk.st = 'idle';
    }
  }
}

function tickCourier(mk, tw) {
  const { cfg } = mk;

  if (!cfg.from || !cfg.dest) { tickIdle(mk, tw); return; }

  if (mk.st === 'idle') {
    if (mk.waitCd > 0) { mk.waitCd--; tickIdle(mk, tw); return; }
    const c = cellCenter(cfg.from.x, cfg.from.y);
    mk.targetX = c.x; mk.targetY = c.y;
    mk.st = 'moving';
  } else if (mk.st === 'moving') {
    if (moveTo(mk, mk.targetX, mk.targetY)) {
      // Arrived at source — pick up
      let item = null;
      if (isStockpile(cfg.from.x, cfg.from.y)) {
        item = takeFromResources(cfg.filter);
      } else {
        item = takeFromCell(cfg.from.x, cfg.from.y, cfg.filter);
      }
      if (item) {
        mk.carrying = item;
        const c = cellCenter(cfg.dest.x, cfg.dest.y);
        mk.targetX = c.x; mk.targetY = c.y;
        mk.st = 'carrying';
      } else {
        mk.waitCd = 30; // nothing available, wait before retrying
        mk.st = 'idle';
      }
    }
  } else if (mk.st === 'carrying') {
    if (moveTo(mk, mk.targetX, mk.targetY)) {
      dropItem(cfg.dest.x, cfg.dest.y, mk.carrying.type);
      mk.carrying = null;
      mk.trips++;
      mk.st = 'idle';
    }
  }
}

function tickBooster(mk, tw) {
  const { cfg } = mk;

  if (!cfg.boost) { tickIdle(mk, tw); return; }

  // Check if target tower still exists
  const targetCell = state.grid[cfg.boost.y]?.[cfg.boost.x];
  if (!targetCell?.content || targetCell.content.type === 'monkey') {
    mk.st = 'idle';
    cfg.boost = null;
    return;
  }

  const c = cellCenter(cfg.boost.x, cfg.boost.y);
  if (mk.st !== 'boosting') {
    mk.targetX = c.x; mk.targetY = c.y;
    mk.st = 'boosting';
  }
  // Stay at target (drift back if nudged)
  moveTo(mk, c.x, c.y);
}

// ─── Booster effects ─────────────────────────────────────────────────────────

function applyBoosterEffects() {
  // Clear previous frame's effects
  for (const tw of state.towers) {
    tw._monkeyBoosted = false;
    tw._monkeyBoostCount = 0;
  }
  // Accumulate from active boosters
  for (const hut of state.towers) {
    if (hut.type !== 'monkey' || !hut.monkeys) continue;
    for (const mk of hut.monkeys) {
      if (mk.role !== 'booster' || mk.st !== 'boosting' || !mk.cfg.boost) continue;
      const target = state.towers.find(t => t.x === mk.cfg.boost.x && t.y === mk.cfg.boost.y);
      if (!target) continue;
      target._monkeyBoosted = true;
      target._monkeyBoostCount = (target._monkeyBoostCount || 0) + 1;
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
