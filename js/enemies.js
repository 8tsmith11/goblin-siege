'use strict';
import { state } from './main.js';
import { clearEnemiesGrid, addToCell } from './grid.js';
import { ETYPES, BOSS_LINES } from './data.js';
import { spawnParticles, getCenter } from './utils.js';

export function mkE(et, bHP, bSpd) {
  return {
    tp: et.em, hp: Math.floor(bHP * et.hpM), mhp: Math.floor(bHP * et.hpM),
    spd: bSpd * et.spdM, sz: et.sz, rew: et.rew, clr: et.clr, em: et.em, drops: et.drops || [],
    pi: 0, x: 0, y: 0, slow: 0, _trapSlow: 0, st: 0, dead: false, spdBuff: 0, frozen: 0,
    stealth: et.em === '👤', stealthTimer: 0, healCD: et.em === '💚' ? 120 : 0,
    boss: false, line: '', reversed: false, reverseTimer: 0, poison: null, stunned: 0,
  };
}

export function genWave(w) {
  const q = [], isBoss = w % 5 === 0 && w > 0;
  const bHP = 50 + 2 * w + 0.03 * w * w, bSpd = 0.5;

  // Wave 5: Proud Herald — special boss, announces itself
  if (w === 5) {
    const heraldHP = Math.floor(bHP * 8 + w * 80);
    state.bSen.add('boss');
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
    const avail = ['normal','fast','tank','berserker','shaman','stealth','healer','swarm','shield'];
    const cnt = 28;
    for (let i = 0; i < cnt; i++) {
      const tp = avail[Math.floor(Math.random() * avail.length)];
      state.bSen.add(tp);
      if (tp === 'swarm') { for (let j = 0; j < 4; j++) q.push(mkE(ETYPES.swarm, bHP * 1.2, bSpd)); }
      else q.push(mkE(ETYPES[tp], bHP * 1.2, bSpd));
    }
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
    const avail = ['normal'];
    if (w >= 3) avail.push('fast'); if (w >= 6) avail.push('tank');
    if (w >= 8) avail.push('berserker'); if (w >= 10) avail.push('shaman');
    if (w >= 12) avail.push('stealth'); if (w >= 14) avail.push('healer');
    if (w >= 17) avail.push('swarm'); if (w >= 19) avail.push('shield');
    const cnt = Math.floor(4 + w * 1.1 + Math.pow(w, 0.82));
    for (let i = 0; i < cnt; i++) {
      const tp = avail[Math.floor(Math.random() * avail.length)];
      state.bSen.add(tp);
      if (tp === 'swarm') { for (let j = 0; j < 4; j++) q.push(mkE(ETYPES.swarm, bHP, bSpd)); }
      else q.push(mkE(ETYPES[tp], bHP, bSpd));
    }
  }
  return q;
}

export function updateEnemies() {
  const { enemies, path, freezeActive, ticks, CELL, particles, grid } = state;
  if (grid.length > 0) clearEnemiesGrid(grid);
  for (const e of enemies) {
    if (e.dead) continue;
    if (e.pi >= path.length - 1 && !e.reversed) {
      e.dead = true;
      state.lives -= (e.boss || state.fogWave) ? 3 : 1;
      continue;
    }
    if (e.pi <= 0 && e.reversed) { e.reversed = false; e.reverseTimer = 0; }
    if (grid.length > 0) addToCell(grid, e);

    if (applyStatusEffects(e, freezeActive, ticks, CELL, particles, enemies)) continue;

    moveEnemy(e, path);
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
    enemies.forEach(e2 => { if (e2 !== e && !e2.dead && Math.hypot(e2.x - e.x, e2.y - e.y) < 2) e2.hp = Math.min(e2.mhp, e2.hp + Math.floor(e2.mhp * 0.03)); });
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

  if (e.stealth && e.pi > path.length * 0.6) e.stealth = false;
}
