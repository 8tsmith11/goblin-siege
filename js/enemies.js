'use strict';
import { state, getCell } from './main.js';
import { clearEnemiesGrid, addToCell } from './grid.js';
import { ETYPES, BOSS_LINES } from './data.js';
import { spawnParticles, getCenter } from './utils.js';

export function mkE(et, bHP, bSpd) {
  const e = {
    tp: et.em, hp: Math.floor(bHP * et.hpM), mhp: Math.floor(bHP * et.hpM),
    spd: bSpd * et.spdM, sz: et.sz, rew: et.rew, clr: et.clr, em: et.em, drops: et.drops || [],
    pi: 0, x: 0, y: 0, slow: 0, _trapSlow: 0, st: 0, dead: false, spdBuff: 0, frozen: 0,
    stealth: et.em === '👤', stealthTimer: 0, healCD: et.em === '💚' ? 120 : 0,
    boss: false, line: '', reversed: false, reverseTimer: 0, poison: null, stunned: 0,
  };
  if (et.noLives) e.noLives = true;
  if (et.em === '💎') { e.gMode = 'walking'; e.gPath = null; e.gTarget = null; e.stolen = []; e.gMaxSteal = 5; }
  if (et.em === '🕷️') e.spiderling = false;
  return e;
}

const BOSS_WAVES = new Set([5, 11, 17, 25, 30, 36, 50]);
export function isBossWave(w) { return BOSS_WAVES.has(w) || (w > 50 && w % 5 === 0); }

const EWEIGHTS = {
  normal: 4, fast: 3, tank: 2, berserker: 2, swarm: 3,
  shield: 1.5, shaman: 1.5, healer: 1.5, spider: 1.5,
  stealth: 1, geologist: 1
};

function pickType(avail) {
  const total = avail.reduce((s, t) => s + (EWEIGHTS[t] || 1), 0);
  let r = Math.random() * total;
  for (const t of avail) { r -= (EWEIGHTS[t] || 1); if (r <= 0) return t; }
  return avail[avail.length - 1];
}

function buildAvail(w) {
  const a = ['normal'];
  if (w >= 4)  a.push('fast');
  if (w >= 6)  a.push('tank');
  if (w >= 9)  a.push('berserker');
  if (w >= 12) a.push('swarm');
  if (w >= 16) a.push('shield');
  if (w >= 19) a.push('shaman');
  if (w >= 22) a.push('healer');
  if (w >= 24) a.push('spider');
  if (w >= 27) a.push('stealth');
  if (w >= 33) a.push('geologist');
  return a;
}

export function genWave(w) {
  const q = [], isBoss = isBossWave(w);
  const bHP = 60 + 3 * w + 0.05 * w * w, bSpd = 0.5;

  // Wave 5: Proud Herald — special boss, announces itself
  if (w === 5) {
    const heraldHP = Math.floor(bHP * 6 + w * 50);
    state.bSen.add('herald');
    q.push({
      tp: 'boss', hp: heraldHP, mhp: heraldHP,
      spd: bSpd * 0.35, sz: 0.65, rew: 40, clr: '#f59e0b', em: '📯', drops: [],
      pi: 0, x: 0, y: 0, slow: 0, _trapSlow: 0, st: 0, dead: false, spdBuff: 0, frozen: 0,
      stealth: false, stealthTimer: 0, healCD: 0, boss: true, herald: true,
      line: 'I am here to announce',
      reversed: false, reverseTimer: 0, poison: null, stunned: 0,
    });
    const mc = Math.floor(3 + w * 0.5);
    for (let i = 0; i < mc; i++) q.push(mkE(ETYPES[['normal', 'fast', 'berserker'][i % 3]], bHP, bSpd));
    return q;
  }

  // Wave 15: Considerate Fog — replaces normal boss, no entity boss
  if (w === 15) {
    state.fogWave = true;
    state.fogStartTick = state.ticks;
    state.bSen.add('fog');
    const avail = buildAvail(w);
    const cnt = 28;
    for (let i = 0; i < cnt; i++) {
      const tp = pickType(avail);
      state.bSen.add(tp);
      if (tp === 'swarm') { for (let j = 0; j < 4; j++) q.push(mkE(ETYPES.swarm, bHP * 1.2, bSpd)); }
      else q.push(mkE(ETYPES[tp], bHP * 1.2, bSpd));
    }
    return q;
  }

  // Wave 40: The Weight of Bones — all enemies become geologists
  if (w === 40) {
    state.weightOfBones = true;
    const avail40 = buildAvail(w);
    const earlyScale40 = 1;
    const cnt40 = Math.floor((6 + w * 0.85 + Math.pow(w, 0.75)) * earlyScale40);
    for (let i = 0; i < cnt40; i++) {
      const tp = pickType(avail40);
      state.bSen.add(tp);
      const base = mkE(ETYPES[tp], bHP, bSpd);
      base.em = '💎'; base.clr = '#a78bfa'; base.gMode = 'walking'; base.gPath = null;
      base.gTarget = null; base.stolen = []; base.gMaxSteal = 10; base.noLives = true;
      q.push(base);
    }
    state.bSen.add('geologist');
    return q;
  }

  if (isBoss) {
    state.bSen.add('boss');
    q.push({
      tp: 'boss', hp: Math.floor(bHP * 8 + w * 80), mhp: Math.floor(bHP * 8 + w * 80),
      spd: bSpd * 0.35, sz: 0.65, rew: 40, clr: '#ef4444', em: '👑', drops: [{ type: 'stone', chance: 0.7 }, { type: 'wood', chance: 0.85 }],
      pi: 0, x: 0, y: 0, slow: 0, _trapSlow: 0, st: 0, dead: false, spdBuff: 0, frozen: 0,
      stealth: false, stealthTimer: 0, healCD: 0, boss: true,
      line: BOSS_LINES[Math.floor(w / 5) % BOSS_LINES.length],
      reversed: false, reverseTimer: 0, poison: null, stunned: 0,
    });
    const mc = Math.floor(3 + w * 0.5);
    for (let i = 0; i < mc; i++) q.push(mkE(ETYPES[['normal', 'fast', 'berserker'][i % 3]], bHP, bSpd));
  } else {
    const avail = buildAvail(w);
    const earlyScale = w <= 3 ? 0.85 : 1;
    const cnt = Math.floor((6 + w * 0.85 + Math.pow(w, 0.75)) * earlyScale);
    for (let i = 0; i < cnt; i++) {
      const tp = pickType(avail);
      state.bSen.add(tp);
      if (tp === 'swarm') { for (let j = 0; j < 4; j++) q.push(mkE(ETYPES.swarm, bHP, bSpd)); }
      else q.push(mkE(ETYPES[tp], bHP, bSpd));
    }
    // Assign per-enemy spawn delays in rhythm runs: burst / normal / slow
    const normalDelay = Math.max(20, 50 - w * 0.7);
    let qi = 0;
    while (qi < q.length) {
      const roll = Math.random();
      if (roll < 0.28) {
        // Burst: 3–7 enemies, 3–6 ticks each
        const len = 3 + Math.floor(Math.random() * 5);
        for (let j = qi; j < Math.min(qi + len, q.length); j++)
          q[j].spawnDelay = 3 + Math.floor(Math.random() * 4);
        qi += len;
      } else if (roll < 0.46) {
        // Slow trickle / dramatic pause: 1–3 enemies, 55–110 ticks each
        const len = 1 + Math.floor(Math.random() * 3);
        for (let j = qi; j < Math.min(qi + len, q.length); j++)
          q[j].spawnDelay = 55 + Math.floor(Math.random() * 56);
        qi += len;
      } else {
        // Normal pace: 2–6 enemies, near-baseTimer with slight jitter
        const len = 2 + Math.floor(Math.random() * 5);
        for (let j = qi; j < Math.min(qi + len, q.length); j++)
          q[j].spawnDelay = normalDelay + Math.floor((Math.random() - 0.5) * 10);
        qi += len;
      }
    }
  }
  return q;
}

export function updateEnemies() {
  const { enemies, path, freezeActive, ticks, CELL, particles, grid } = state;
  if (grid.length > 0) clearEnemiesGrid(grid);
  for (const e of enemies) {
    if (e.dead) continue;

    // Spiderling explosion phase
    if (e.spiderling && e.gMode === 'exploding') {
      e.x += e.explodeVX; e.y += e.explodeVY;
      e.explodeDist -= Math.hypot(e.explodeVX, e.explodeVY);
      if (e.explodeDist <= 0) {
        // Find nearest path tile and walk there instead of teleporting
        let bestPi = 0, bestDist = Infinity;
        for (let i = 0; i < path.length; i++) {
          const d = Math.hypot(path[i].x - e.x, path[i].y - e.y);
          if (d < bestDist) { bestDist = d; bestPi = i; }
        }
        e._pathTarget = bestPi;
        e.gMode = 'walking_to_path';
      }
      if (grid.length > 0) addToCell(grid, e);
      continue;
    }
    if (e.spiderling && e.gMode === 'walking_to_path') {
      const tgt = path[e._pathTarget];
      const dx = tgt.x - e.x, dy = tgt.y - e.y, d = Math.hypot(dx, dy);
      const sp = e.spd * 0.04;
      if (d < sp + 0.01) { e.x = tgt.x; e.y = tgt.y; e.pi = e._pathTarget; e.gMode = 'on_path'; }
      else { e.x += dx / d * sp; e.y += dy / d * sp; }
      if (grid.length > 0) addToCell(grid, e);
      continue;
    }
    if (e.spiderling && e.gMode === 'on_path') {
      if (grid.length > 0) addToCell(grid, e);
      if (applyStatusEffects(e, freezeActive, ticks, CELL, particles, enemies)) continue;
      if (e.pi >= path.length - 1) { e.dead = true; state.lives -= 1; continue; }
      moveEnemy(e, path);
      continue;
    }

    // Geologist AI
    if (e.gMode !== undefined) {
      updateGeologist(e, path, CELL);
      if (grid.length > 0 && !e.dead) addToCell(grid, e);
      continue;
    }

    if (e.pi >= path.length - 1 && !e.reversed) {
      e.dead = true;
      if (!e.noLives) state.lives -= (e.boss || state.fogWave) ? 3 : 1;
      continue;
    }
    if (e.pi <= 0 && e.reversed) { e.reversed = false; e.reverseTimer = 0; }
    if (grid.length > 0) addToCell(grid, e);

    if (applyStatusEffects(e, freezeActive, ticks, CELL, particles, enemies)) continue;

    moveEnemy(e, path);
  }
}

// ── Geologist BFS (tile-space, avoids water) ─────────────────────────────────
function geologistBfs(fromX, fromY, toX, toY) {
  fromX = Math.round(fromX); fromY = Math.round(fromY);
  toX = Math.round(toX); toY = Math.round(toY);
  if (fromX === toX && fromY === toY) return [];
  const { COLS, ROWS } = state;
  const prev = new Map();
  const queue = [[fromX, fromY]];
  const startKey = `${fromX},${fromY}`;
  prev.set(startKey, null);
  while (queue.length) {
    const [x, y] = queue.shift();
    if (x === toX && y === toY) {
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

// Steal one ground stack from a tile. Returns true if taken.
function _stealOneGroundItem(e, tx, ty) {
  const cell = getCell(tx, ty);
  if (!cell?.stacks) return false;
  for (let i = 0; i < cell.stacks.length; i++) {
    const s = cell.stacks[i];
    if (!s || s.bossLoot || e.stolen.length >= e.gMaxSteal) continue;
    e.stolen.push({ type: s.type || (s.section === 'artifacts' ? '_artifact' : '_item'), item: s });
    cell.stacks[i] = null;
    return true;
  }
  return false;
}

// Returns true if a lootable tower exists at this tile.
function _hasTowerLoot(tx, ty) {
  const tw = state.towers.find(t => Math.round(t.x) === tx && Math.round(t.y) === ty);
  if (!tw) return false;
  if (tw.type === 'hoard') return (tw.stored || 0) > 0;
  if (tw.type === 'workbench' && tw.inv) return Object.values(tw.inv).some(v => v > 0);
  if (tw.type === 'lab') return (state.resources.dust || 0) > 0;
  return false;
}

// Steal one item from a tower at tile. Returns true if taken.
function _stealFromTower(e, tx, ty) {
  const tw = state.towers.find(t => Math.round(t.x) === tx && Math.round(t.y) === ty);
  if (!tw) return false;
  if (tw.type === 'hoard' && tw.stored > 0) {
    tw.stored--;
    e.stolen.push({ type: 'resource', label: 'hoard' });
    return true;
  }
  if (tw.type === 'workbench' && tw.inv) {
    for (const [res, amt] of Object.entries(tw.inv)) {
      if (amt > 0) { tw.inv[res]--; e.stolen.push({ type: res }); return true; }
    }
  }
  if (tw.type === 'lab' && (state.resources.dust || 0) > 0) {
    state.resources.dust--;
    e.stolen.push({ type: 'dust' });
    return true;
  }
  return false;
}

function _startRetracing(e, path) {
  let bestPi = e.pi, bestDist = Infinity;
  for (let i = 0; i < path.length; i++) {
    const d = Math.hypot(path[i].x - e.x, path[i].y - e.y);
    if (d < bestDist) { bestDist = d; bestPi = i; }
  }
  e.gReturnTile = { x: path[bestPi].x, y: path[bestPi].y, pi: bestPi };
  e.gPath = geologistBfs(Math.round(e.x), Math.round(e.y), path[bestPi].x, path[bestPi].y);
  e._stealCD = undefined;
  e._stealInit = undefined;
  e.gMode = 'retracing';
}

function updateGeologist(e, path, CELL) {
  const SPD = 0.04 * (e.spd || 0.8);
  if (e.gMode === 'walking') {
    const tx = Math.round(e.x), ty = Math.round(e.y);
    // Detour only when a loot tile is in the same column (same x)
    let found = false;
    for (let cy = 0; cy < state.ROWS; cy++) {
      const cell = getCell(tx, cy);
      if (!cell) continue;
      const hasStacks = cell.stacks?.some(s => s && !s.bossLoot);
      if (!hasStacks && !_hasTowerLoot(tx, cy)) continue;
      const claimed = state.enemies.some(o =>
        o !== e && !o.dead && o.gMode === 'stealing' &&
        Math.round(o.x) === tx && Math.round(o.y) === cy
      );
      if (claimed) continue;
      e.gTarget = { x: tx, y: cy };
      e.gMode = 'detouring';
      e.gPath = geologistBfs(tx, ty, tx, cy);
      found = true; break;
    }
    if (!found) {
      if (e.pi >= path.length - 1) { e.dead = true; return; }
      moveEnemy(e, path);
    }
  } else if (e.gMode === 'detouring') {
    if (!e.gPath || e.gPath.length === 0) { e.gMode = 'stealing'; return; }
    const wp = e.gPath[0];
    const dx = wp.x - e.x, dy = wp.y - e.y, d = Math.hypot(dx, dy);
    if (d < SPD + 0.01) { e.x = wp.x; e.y = wp.y; e.gPath.shift(); }
    else { e.x += dx / d * SPD; e.y += dy / d * SPD; }
    if (e.gPath.length === 0) e.gMode = 'stealing';
  } else if (e.gMode === 'stealing') {
    const tx = Math.round(e.x), ty = Math.round(e.y);
    if (!e._stealInit) {
      e._stealInit = true;
      e._stealCD = 0;
    }
    if (e._stealCD > 0) { e._stealCD--; return; }
    const didSteal = _stealOneGroundItem(e, tx, ty) || _stealFromTower(e, tx, ty);
    if (!didSteal || e.stolen.length >= e.gMaxSteal) { _startRetracing(e, path); return; }
    const cell = getCell(tx, ty);
    const stillHas = cell?.stacks?.some(s => s && !s.bossLoot) || _hasTowerLoot(tx, ty);
    if (!stillHas) { _startRetracing(e, path); return; }
    e._stealCD = 60;
  } else if (e.gMode === 'retracing') {
    if (!e.gPath || e.gPath.length === 0) {
      if (e.gReturnTile) { e.x = e.gReturnTile.x; e.y = e.gReturnTile.y; e.pi = e.gReturnTile.pi; }
      e.gMode = 'leaving'; return;
    }
    const wp = e.gPath[0];
    const dx = wp.x - e.x, dy = wp.y - e.y, d = Math.hypot(dx, dy);
    if (d < SPD + 0.01) { e.x = wp.x; e.y = wp.y; e.gPath.shift(); }
    else { e.x += dx / d * SPD; e.y += dy / d * SPD; }
  } else if (e.gMode === 'leaving') {
    // Walk backward along path (reversed)
    if (e.pi <= 0) { e.dead = true; return; }
    const prevI = e.pi - 1;
    const t = path[prevI];
    const dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy);
    if (d < SPD + 0.01) { e.x = t.x; e.y = t.y; e.pi = prevI; }
    else { e.x += dx / d * SPD; e.y += dy / d * SPD; }
  }
}

function applyStatusEffects(e, freezeActive, ticks, CELL, particles, enemies) {
  if (freezeActive > 0 && !e.boss) { e.frozen = 2; return true; }
  if (e.frozen > 0) { e.frozen--; return true; }
  if (e.stunned > 0) { e.stunned--; return true; }

  if (e.reverseTimer > 0) { e.reverseTimer--; if (e.reverseTimer <= 0) e.reversed = false; }
  if (e.stealthTimer > 0) { e.stealthTimer--; if (e.stealthTimer <= 0) e.stealth = false; }
  if (e.st > 0) { e.st--; if (e.st <= 0) e.slow = e._permSlow || 0; }

  if (e.poison) {
    e.hp -= e.poison.dmg; e.poison.dur--;
    if (e.poison.dur <= 0) e.poison = null;
    if (ticks % 8 === 0) spawnParticles(particles, getCenter(e.x, CELL), getCenter(e.y, CELL), 1, { vxBase: 0, vyBase: -1, spreadX: 0, spreadY: 0, life: 12, clr: '#84cc16', sz: 2 });
  }

  if (e.em === '💚' && e.healCD <= 0) {
    const healFrac = 0.03 + state.wave * 0.001;
    enemies.forEach(e2 => { if (e2 !== e && !e2.dead && Math.hypot(e2.x - e.x, e2.y - e.y) < 2) e2.hp = Math.min(e2.mhp, e2.hp + Math.floor(e2.mhp * healFrac)); });
    e.healCD = 60;
    spawnParticles(particles, getCenter(e.x, CELL), getCenter(e.y, CELL), 1, { vxBase: 0, vyBase: -1, spreadX: 0, spreadY: 0, life: 15, clr: '#22d3ee', sz: 3 });
  }
  if (e.healCD > 0) e.healCD--;
  return false;
}

function moveEnemy(e, path) {
  // Jester's Privilege rush: zip quickly to swap destination
  if (e._rushToX !== undefined) {
    const dx = e._rushToX - e.x, dy = e._rushToY - e.y, d = Math.sqrt(dx*dx + dy*dy);
    if (d < 0.32) { e.x = e._rushToX; e.y = e._rushToY; e.pi = e._rushToPi; delete e._rushToX; delete e._rushToY; delete e._rushToPi; }
    else { e.x += dx/d * 0.3; e.y += dy/d * 0.3; }
    return;
  }
  const nextI = e.reversed ? Math.max(0, e.pi - 1) : Math.min(path.length - 1, e.pi + 1);
  const t = path[nextI];

  const dx = t.x - e.x, dy = t.y - e.y, d = Math.sqrt(dx * dx + dy * dy);
  let sp = e.spd * (1 - Math.max(e.slow, e._trapSlow || 0)) * 0.04;
  if (e.spdBuff > 0) sp *= 1.3;
  if (d < sp + 0.001) { e.x = t.x; e.y = t.y; e.pi = nextI; }
  else { e.x += dx / d * sp; e.y += dy / d * sp; }

  // stealth enemies do not auto-reveal near end of path
}
