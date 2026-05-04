'use strict';
import { state, getCell } from './main.js';
import { clearEnemiesGrid, addToCell } from './grid.js';
import { ETYPES, BOSS_LINES } from './data.js';
import { spawnParticles, getCenter } from './utils.js';
import { bus } from './bus.js';
import { addFeed } from './feed.js';

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

// Named boss order — consumed in sequence for each regular boss wave (after Herald & Fog).
// 'vanguard' = generic crown boss. After the list is exhausted, falls back to 'vanguard'.
export const BOSS_ORDER = ['herald', 'vanguard', 'vanguard', 'vanguard', 'curious_auditor', 'vanguard', 'patient_watcher'];

const EWEIGHTS = {
  normal: 4, fast: 3, tank: 2, berserker: 2, swarm: 3,
  shield: 1.5, shaman: 1.5, healer: 1.5, spider: 1.5,
  stealth: 1, geologist: 0.3
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
  if (w >= 24 && !state.spiderRitualDone) a.push('spider');
  if (w >= 27) a.push('stealth');
  if (w >= 33) a.push('geologist');
  return a;
}

// Returns exact {em, count, seen}[] for wave w, matching genWave counts without mutating state.
export function waveComposition(w) {
  if (w === 15) return [{ em: '🌫️', label: 'Considerate Fog', seen: true }];
  if (w === 40) return [{ em: '💎', label: 'Weight of Bones', seen: true }];
  if (w === 5)  return [{ em: '📯', label: 'Proud Herald', seen: true }];
  if (isBossWave(w)) {
    const idx = state.namedBossIndex ?? 0;
    const bt = BOSS_ORDER[idx] ?? 'vanguard';
    const em = bt === 'curious_auditor' ? '🏛️' : bt === 'patient_watcher' ? '👁️' : '👑';
    const label = bt === 'curious_auditor' ? 'Curious Auditor' : bt === 'patient_watcher' ? 'Patient Watcher' : 'Vanguard';
    const mc = Math.floor(3 + w * 0.5);
    const result = [{ em, label, count: 1, seen: state.bSen?.has(bt) }];
    const minions = {};
    for (let i = 0; i < mc; i++) {
      const tp = ['normal', 'fast', 'berserker'][i % 3];
      const e = ETYPES[tp]; if (!e) continue;
      const key = e.em || tp;
      if (!minions[key]) minions[key] = { em: key, count: 0, seen: state.bSen?.has(tp) };
      minions[key].count++;
    }
    return result.concat(Object.values(minions));
  }
  const avail = buildAvail(w);
  const earlyScale = w <= 4 ? 1.5 : w <= 7 ? 1.2 : 1;
  const cnt = Math.floor((6 + w * 0.85 + Math.pow(w, 0.75)) * earlyScale);
  const counts = {};
  // Use weighted proportions (same weights as pickType) to estimate exact counts
  const total = avail.reduce((s, t) => s + (EWEIGHTS[t] || 1), 0);
  let rem = cnt;
  for (let i = 0; i < avail.length; i++) {
    const tp = avail[i];
    const share = i === avail.length - 1 ? rem : Math.round(cnt * (EWEIGHTS[tp] || 1) / total);
    if (share <= 0) continue;
    rem -= share;
    const em = ETYPES[tp]?.em || '?';
    const seen = state.bSen?.has(tp) ?? false;
    const actualCount = tp === 'swarm' ? share * 4 : share;
    if (!counts[em]) counts[em] = { em, count: 0, seen };
    counts[em].count += actualCount;
  }
  return Object.values(counts);
}

// Returns a lightweight preview of what types appear in wave w (no state mutation).
export function previewWave(w) {
  if (w === 15) return '🌫️ Considerate Fog';
  if (w === 40) return '💎 Weight of Bones';
  if (w === 5)  return '📯 Proud Herald';
  if (isBossWave(w)) {
    const idx = state.namedBossIndex ?? 0;
    const bt = BOSS_ORDER[idx] ?? 'vanguard';
    if (bt === 'curious_auditor') return '🏛️ Curious Auditor';
    if (bt === 'patient_watcher') return '👁️ Patient Watcher';
    return '👑 Vanguard';
  }
  const avail = buildAvail(w);
  return avail.map(t => ETYPES[t]?.em || '?').join(' ');
}

export function genWave(w) {
  const q = [], isBoss = isBossWave(w);
  const bHP = 60 + 3 * w + 0.05 * w * w, bSpd = 0.5;

  // Wave 5: Proud Herald — special boss, announces itself
  if (w === 5) {
    const heraldHP = Math.floor(bHP * 6 + w * 50);
    (state._pendingBSen ??= new Set()).add('herald');
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
    state.namedBossIndex = (state.namedBossIndex || 0) + 1; // advance past 'herald' slot
    return q;
  }

  // Wave 15: Considerate Fog — replaces normal boss, no entity boss
  if (w === 15) {
    state.fogWave = true;
    state.fogStartTick = state.ticks;
    (state._pendingBSen ??= new Set()).add('fog');
    const avail = buildAvail(w);
    const cnt = 28;
    for (let i = 0; i < cnt; i++) {
      const tp = pickType(avail);
      (state._pendingBSen ??= new Set()).add(tp);
      if (tp === 'swarm') { for (let j = 0; j < 4; j++) q.push(mkE(ETYPES.swarm, bHP * 1.2, bSpd)); }
      else q.push(mkE(ETYPES[tp], bHP * 1.2, bSpd));
    }
    return q;
  }

  // Wave 40: The Weight of Bones — all enemies become geologists
  if (w === 40) {
    state.weightOfBones = true;
    const avail40 = buildAvail(w);
    const cnt40 = Math.floor(6 + w * 0.85 + Math.pow(w, 0.75));
    for (let i = 0; i < cnt40; i++) {
      const tp = pickType(avail40);
      (state._pendingBSen ??= new Set()).add(tp);
      const base = mkE(ETYPES[tp], bHP, bSpd);
      base.em = '💎'; base.clr = '#a78bfa'; base.sz = 0.30; base.gMode = 'walking'; base.gPath = null;
      base.gTarget = null; base.stolen = []; base.gMaxSteal = 10; base.noLives = true;
      q.push(base);
    }
    (state._pendingBSen ??= new Set()).add('geologist');
    return q;
  }

  if (isBoss) {
    // Named boss rotation: consume BOSS_ORDER in sequence, fall back to 'vanguard' when exhausted
    state.namedBossIndex = state.namedBossIndex || 0;
    const bossType = BOSS_ORDER[state.namedBossIndex] ?? 'vanguard';
    state.namedBossIndex++;

    if (bossType === 'curious_auditor') {
      const audHP = Math.floor(bHP * 15);
      (state._pendingBSen ??= new Set()).add('curious_auditor');
      state.auditorActive = true;
      q.push({
        tp: 'boss', hp: audHP, mhp: audHP,
        spd: bSpd * 0.35, sz: 0.65, rew: 40, clr: '#ef4444', em: '🏛️', drops: [],
        pi: 0, x: 0, y: 0, slow: 0, _trapSlow: 0, st: 0, dead: false, spdBuff: 0, frozen: 0,
        stealth: false, stealthTimer: 0, healCD: 0, boss: true, auditor: true,
        line: 'How much did that one cost you?',
        reversed: false, reverseTimer: 0, poison: null, stunned: 0,
      });
      const mc = Math.floor(3 + w * 0.5);
      for (let i = 0; i < mc; i++) q.push(mkE(ETYPES[['normal', 'fast', 'berserker'][i % 3]], bHP, bSpd));
      return q;
    }

    if (bossType === 'patient_watcher') {
      const watchHP = Math.floor((bHP * 8 + w * 80) * 6); // 50% = 3× a normal boss
      (state._pendingBSen ??= new Set()).add('patient_watcher');
      state.watcherAppeared = true;
      bus.emit('watcherAppeared');
      // Start on the first path tile (left edge of path) — always valid
      const corner = state.path[0] ?? { x: state.COLS >> 1, y: state.ROWS >> 1 };
      const numPts = 6;
      const validTiles = [];
      for (let gy = 0; gy < state.ROWS; gy++) {
        for (let gx = 0; gx < state.COLS; gx++) {
          const t = getCell(gx, gy)?.type;
          if (t === 'empty' || t === 'path') validTiles.push({ x: gx, y: gy });
        }
      }
      // Fisher-Yates shuffle then take first numPts
      for (let i = validTiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [validTiles[i], validTiles[j]] = [validTiles[j], validTiles[i]];
      }
      const watcherPoints = validTiles.slice(0, numPts);
      q.push({
        tp: 'boss', hp: watchHP, mhp: watchHP,
        spd: 0.28, sz: 1.2, rew: 40, clr: '#7c3aed', em: '🔮', drops: [],
        pi: 0, x: corner.x, y: corner.y, slow: 0, _trapSlow: 0, st: 0, dead: false, spdBuff: 0, frozen: 0,
        stealth: false, stealthTimer: 0, healCD: 0, boss: true, watcher: true,
        watcherPhase: 'roam', watcherPoints, watcherTargetIdx: 0, damageTimer: 0, prevHp: watchHP, everAttacked: false,
        line: '', reversed: false, reverseTimer: 0, poison: null, stunned: 0, em: '👁️',
        // Eye offsets and tentacle data initialised here
        _eyes: Array.from({ length: 8 }, (_, i) => ({
          ang: (Math.PI * 2 * i / 8),
        })),
        _tentacles: Array.from({ length: 6 }, (_, i) => ({
          baseAngle: (Math.PI * 2 * i) / 6, phase: i * 1.1,
        })),
      });
      return q;
    }

    // Vanguard: generic crown boss
    (state._pendingBSen ??= new Set()).add('boss');
    q.push({
      tp: 'boss', hp: Math.floor(bHP * 8 + w * 80), mhp: Math.floor(bHP * 8 + w * 80),
      spd: bSpd * 0.35, sz: 0.65, rew: 40, clr: '#ef4444', em: '👑', drops: [{ type: 'stone', chance: 0.7 }, { type: 'wood', chance: 0.85 }],
      pi: 0, x: 0, y: 0, slow: 0, _trapSlow: 0, st: 0, dead: false, spdBuff: 0, frozen: 0,
      stealth: false, stealthTimer: 0, healCD: 0, boss: true,
      line: BOSS_LINES[Math.floor(w / 5) % BOSS_LINES.length],
      reversed: false, reverseTimer: 0, poison: null, stunned: 0,
    });
    const mc2 = Math.floor(3 + w * 0.5);
    for (let i = 0; i < mc2; i++) q.push(mkE(ETYPES[['normal', 'fast', 'berserker'][i % 3]], bHP, bSpd));
  } else {
    const avail = buildAvail(w);
    // Early waves: more enemies, well-spaced, no burst clumping
    const earlyScale = w <= 4 ? 1.5 : w <= 7 ? 1.2 : 1;
    const cnt = Math.floor((6 + w * 0.85 + Math.pow(w, 0.75)) * earlyScale);
    for (let i = 0; i < cnt; i++) {
      const tp = pickType(avail);
      const _wasNewSpider = tp === 'spider' && !state.bSen.has('spider') && !state._pendingBSen?.has('spider');
      (state._pendingBSen ??= new Set()).add(tp);
      if (_wasNewSpider) bus.emit('firstSpider');
      if (tp === 'swarm') { for (let j = 0; j < 4; j++) q.push(mkE(ETYPES.swarm, bHP, bSpd)); }
      else q.push(mkE(ETYPES[tp], bHP, bSpd));
    }
    // Spawn delay rhythm: burst forbidden in early waves, wide spacing throughout
    const isEarly = w <= 7;
    const minBurstGap = isEarly ? 45 : 3;
    const normalDelay = isEarly ? Math.max(65, 100 - w * 5) : Math.max(20, 50 - w * 0.7);
    let qi = 0;
    while (qi < q.length) {
      const roll = Math.random();
      if (!isEarly && roll < 0.28) {
        // Burst: 3–7 enemies, tight spacing (not in early waves)
        const len = 3 + Math.floor(Math.random() * 5);
        for (let j = qi; j < Math.min(qi + len, q.length); j++)
          q[j].spawnDelay = minBurstGap + Math.floor(Math.random() * 10);
        qi += len;
      } else if (roll < 0.46) {
        // Slow trickle: 1–3 enemies, long gap
        const len = 1 + Math.floor(Math.random() * 3);
        for (let j = qi; j < Math.min(qi + len, q.length); j++)
          q[j].spawnDelay = (isEarly ? 100 : 55) + Math.floor(Math.random() * 56);
        qi += len;
      } else {
        // Normal pace
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
  // Goblin Lullaby: enemies in lab radius move 10% slower
  const _lullaby = state.inventory?.equipped?.some(a => a?.id === 'goblin_lullaby');
  const _lulabyLab = _lullaby ? state.towers?.find(t => t.type === 'lab') : null;
  for (const e of enemies) {
    if (e.dead) continue;
    if (_lulabyLab) {
      if (Math.hypot(e.x - _lulabyLab.x, e.y - _lulabyLab.y) <= (_lulabyLab.obsRange || 3)) {
        e._labSlow = 0.1;
      } else {
        e._labSlow = 0;
      }
    } else {
      e._labSlow = 0;
    }

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

    if (e.auditor) {
      if (!e._audLines) {
        e._audLines = ['How much did that one cost you?', 'And that one? And that one?', 'All quite expensive. Fascinating.', 'I will need a full accounting when this is over.'];
        e._audIndex = 0;
        e._audFirstHit = false;
        e._audDelay = Infinity;
        e._audWaveStart = ticks;
      } else {
        // Only start speaking after the first confirmed hit
        if (!e._audFirstHit && e.hp < e.mhp) {
          e._audFirstHit = true;
          // Enforce 5s (300 tick) minimum from wave start before generated lines begin
          e._audDelay = Math.max(ticks + 60, e._audWaveStart + 300);
        }
        if (e._audFirstHit && ticks >= e._audDelay) {
          const line = e._audLines[e._audIndex % e._audLines.length];
          e._audIndex++;
          addFeed('boss', '🏛️ ' + line);
          bus.emit('bossLine', { line });
          e._audDelay = ticks + 300;
        }
      }
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

    // Patient Watcher: roaming boss — custom movement, no path-following in roam phase
    if (e.watcher) {
      if (e.watcherPhase === 'roam') {
        // Damage timer — reset on hit
        if (e.hp < e.prevHp) { e.everAttacked = true; e.damageTimer = 0; e.prevHp = e.hp; }
        else if (!e.everAttacked) e.damageTimer++;
        // 50% HP: violent teleport to path start — at this point remaining HP = 3× a normal boss
        if (e.hp <= e.mhp * 0.5) {
          e.watcherPhase = 'path'; e.x = path[0].x; e.y = path[0].y; e.pi = 0;
          state.cameraShake = 120;
          bus.emit('watcherTransition', { watcher: e });
        }
        // After 30s with NO damage ever (timer stops once first hit lands)
        else if (!e.everAttacked && e.damageTimer > 1800) {
          e.watcherPhase = 'escaping';
          e.x = path[path.length - 1].x; e.y = path[path.length - 1].y; e.pi = path.length - 1;
          state.cameraShake = 80;
          state.watcherEscaped = true;
          bus.emit('watcherEscaped');
        }
        // Roam: drift toward current waypoint
        else if (e.watcherPoints?.length) {
          const tgt = e.watcherPoints[e.watcherTargetIdx % e.watcherPoints.length];
          const dx = tgt.x - e.x, dy = tgt.y - e.y, d = Math.hypot(dx, dy);
          const spd = e.spd * 0.04;
          if (d < spd + 0.05) {
            e.watcherTargetIdx = (e.watcherTargetIdx + 1) % e.watcherPoints.length;
          } else {
            e.x += dx / d * spd; e.y += dy / d * spd;
          }
        }
        if (grid.length > 0) addToCell(grid, e);
        continue;
      }
      // Escaping: walk backward to path start then remove (no lives penalty)
      if (e.watcherPhase === 'escaping') {
        if (e.pi <= 0) { e.dead = true; continue; }
        const prevI = e.pi - 1;
        const t = path[prevI];
        const dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy);
        const spd = e.spd * 0.04;
        if (d < spd + 0.01) { e.x = t.x; e.y = t.y; e.pi = prevI; }
        else { e.x += dx / d * spd; e.y += dy / d * spd; }
        if (grid.length > 0) addToCell(grid, e);
        continue;
      }
      // 'path' phase: falls through to normal boss movement below
    }

    if (e.pi >= path.length - 1 && !e.reversed) {
      e.dead = true;
      if (!e.noLives) state.lives -= e.boss ? 3 : 1;
      if (e.auditor) state.auditorActive = false;
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

// Steal one ground stack from a tile. Returns true if taken. Dust is never stolen.
function _stealOneGroundItem(e, tx, ty) {
  const cell = getCell(tx, ty);
  if (!cell?.stacks) return false;
  for (let i = 0; i < cell.stacks.length; i++) {
    const s = cell.stacks[i];
    if (!s || s.bossLoot || e.stolen.length >= e.gMaxSteal) continue;
    if (s.type === 'dust') continue;
    e.stolen.push({ type: s.type || (s.section === 'artifacts' ? '_artifact' : '_item'), item: s });
    cell.stacks[i] = null;
    return true;
  }
  return false;
}

// Returns true if any lootable non-dust item exists at this tile (tower or ground).
function _hasTowerLoot(tx, ty) {
  const tw = state.towers.find(t => Math.round(t.x) === tx && Math.round(t.y) === ty);
  if (!tw) return false;
  if (tw.stored > 0) return true;
  if (tw.inv) return Object.entries(tw.inv).some(([k, v]) => k !== 'dust' && v > 0);
  if (tw.slots) return tw.slots.some(s => s && s.count > 0 && s.type !== 'dust');
  return false;
}

// Steal one non-dust item from any tower at tile. Returns true if taken.
function _stealFromTower(e, tx, ty) {
  const tw = state.towers.find(t => Math.round(t.x) === tx && Math.round(t.y) === ty);
  if (!tw) return false;
  // Hoard
  if (tw.stored > 0) {
    tw.stored--;
    e.stolen.push({ type: 'resource', label: tw.type });
    return true;
  }
  // inv-based towers (workbench, etc.)
  if (tw.inv) {
    for (const [res, amt] of Object.entries(tw.inv)) {
      if (res === 'dust' || amt <= 0) continue;
      tw.inv[res]--;
      e.stolen.push({ type: res });
      return true;
    }
  }
  // slot-based towers (stockpile, etc.)
  if (tw.slots) {
    for (let i = 0; i < tw.slots.length; i++) {
      const s = tw.slots[i];
      if (!s || s.count <= 0 || s.type === 'dust') continue;
      s.count--;
      e.stolen.push({ type: s.type });
      if (s.count <= 0) tw.slots[i] = null;
      return true;
    }
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
    // Only scan for off-path loot when snapped to a whole tile (avoids mid-step jitter)
    const atTile = Math.abs(e.x - tx) < 0.08 && Math.abs(e.y - ty) < 0.08;
    let found = false;
    for (let cy = atTile ? 0 : state.ROWS; cy < state.ROWS; cy++) {
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
  if (e.stunned > 0) { e.stunned--; e._stunSlow = true; }

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
  let sp = e.spd * (1 - Math.max(e.slow, e._trapSlow || 0, e._labSlow || 0)) * 0.04;
  if (e._stunSlow) { sp *= 0.15; e._stunSlow = false; }
  if (e.spdBuff > 0) sp *= 1.3;
  if (d < sp + 0.001) { e.x = t.x; e.y = t.y; e.pi = nextI; }
  else { e.x += dx / d * sp; e.y += dy / d * sp; }

  // stealth enemies do not auto-reveal near end of path
}
