'use strict';
import { state } from './main.js';
import { clearEnemiesGrid, addToCell } from './grid.js';

export const ETYPES = {
  normal:  { hpM:1,   spdM:1,   sz:.30, rew:4,  clr:'#22c55e', em:'👺' },
  fast:    { hpM:.4,  spdM:1.6, sz:.24, rew:3,  clr:'#4ade80', em:'👺' },
  tank:    { hpM:2.5, spdM:.6,  sz:.45, rew:8,  clr:'#a855f7', em:'👹' },
  berserker:{ hpM:1.8,spdM:1.2, sz:.38, rew:7,  clr:'#ef4444', em:'😤' },
  shaman:  { hpM:1.2, spdM:.9,  sz:.33, rew:6,  clr:'#f97316', em:'🧙' },
  stealth: { hpM:.6,  spdM:1.4, sz:.22, rew:5,  clr:'#64748b', em:'👤' },
  healer:  { hpM:.8,  spdM:.8,  sz:.30, rew:6,  clr:'#22d3ee', em:'💚' },
  swarm:   { hpM:.18, spdM:1.7, sz:.18, rew:1,  clr:'#a3e635', em:'🐜' },
  shield:  { hpM:2,   spdM:.7,  sz:.40, rew:9,  clr:'#3b82f6', em:'🛡️' },
};

export const BOSS_LINES = [
  "You think walls can stop ME?!","I will FEAST on your towers!","Your defenses are PATHETIC!",
  "TREMBLE before Grak'thul!","No tower stands against my might!",
  "I've eaten squirrels bigger than your army!","Your clever birds won't save you now!","The horde is ETERNAL!",
];

export function mkE(et, bHP, bSpd) {
  return {
    tp: et.em, hp: Math.floor(bHP * et.hpM), mhp: Math.floor(bHP * et.hpM),
    spd: bSpd * et.spdM, sz: et.sz, rew: et.rew, clr: et.clr, em: et.em,
    pi: 0, x: 0, y: 0, slow: 0, st: 0, dead: false, spdBuff: 0, frozen: 0,
    stealth: et.em === '👤', stealthTimer: 0, healCD: et.em === '💚' ? 120 : 0,
    boss: false, line: '', reversed: false, reverseTimer: 0, poison: null, stunned: 0,
  };
}


export function genWave(w) {
  const q = [], isBoss = w % 5 === 0 && w > 0;
  const bHP = 25 + w * 20 + Math.pow(w, 1.5) * 5, bSpd = 0.55 + Math.min(w * 0.035, 0.9);
  if (isBoss) {
    q.push({
      tp: 'boss', hp: Math.floor(bHP * 8 + w * 50), mhp: Math.floor(bHP * 8 + w * 50),
      spd: bSpd * 0.35, sz: 0.65, rew: 50 + w * 5, clr: '#ef4444', em: '👑',
      pi: 0, x: 0, y: 0, slow: 0, st: 0, dead: false, spdBuff: 0, frozen: 0,
      stealth: false, stealthTimer: 0, healCD: 0, boss: true,
      line: BOSS_LINES[Math.floor(w / 5) % BOSS_LINES.length],
      reversed: false, reverseTimer: 0, poison: null, stunned: 0,
    });
    const mc = Math.floor(3 + w * 0.5);
    for (let i = 0; i < mc; i++) q.push(mkE(ETYPES[['normal','fast','berserker'][i % 3]], bHP, bSpd));
  } else {
    const avail = ['normal'];
    if (w >= 2) avail.push('fast'); if (w >= 3) avail.push('tank');
    if (w >= 4) avail.push('berserker'); if (w >= 5) avail.push('shaman');
    if (w >= 6) avail.push('stealth'); if (w >= 7) avail.push('healer');
    if (w >= 8) avail.push('swarm'); if (w >= 9) avail.push('shield');
    const cnt = Math.floor(6 + w * 2.2 + Math.pow(w, 1.1));
    for (let i = 0; i < cnt; i++) {
      const tp = avail[Math.floor(Math.random() * avail.length)];
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
      state.lives -= e.boss ? 3 : 1;
      continue;
    }
    if (e.pi <= 0 && e.reversed) { e.reversed = false; e.reverseTimer = 0; }
    if (freezeActive > 0 && !e.boss) { e.frozen = 2; continue; }
    if (e.frozen > 0) { e.frozen--; continue; }
    if (e.stunned > 0) { e.stunned--; continue; }
    if (e.reverseTimer > 0) { e.reverseTimer--; if (e.reverseTimer <= 0) e.reversed = false; }
    if (e.stealthTimer > 0) { e.stealthTimer--; if (e.stealthTimer <= 0) e.stealth = false; }

    const nextI = e.reversed ? Math.max(0, e.pi - 1) : Math.min(path.length - 1, e.pi + 1);
    const t = path[nextI], dx = t.x - e.x, dy = t.y - e.y, d = Math.sqrt(dx * dx + dy * dy);
    let sp = e.spd * (1 - e.slow) * 0.04;
    if (e.spdBuff > 0) sp *= 1.3;
    if (d < sp + 0.001) { e.x = t.x; e.y = t.y; e.pi = nextI; }
    else { e.x += dx / d * sp; e.y += dy / d * sp; }
    if (e.st > 0) { e.st--; if (e.st <= 0) e.slow = 0; }

    if (e.poison) {
      e.hp -= e.poison.dmg; e.poison.dur--;
      if (e.poison.dur <= 0) e.poison = null;
      if (ticks % 8 === 0) particles.push({ x: e.x * CELL + CELL / 2, y: e.y * CELL + CELL / 2, vx: 0, vy: -1, life: 12, clr: '#84cc16', sz: 2 });
    }
    if (e.em === '💚' && e.healCD <= 0) {
      enemies.forEach(e2 => { if (e2 !== e && !e2.dead && Math.hypot(e2.x - e.x, e2.y - e.y) < 2) e2.hp = Math.min(e2.mhp, e2.hp + Math.floor(e2.mhp * 0.03)); });
      e.healCD = 60;
      particles.push({ x: e.x * CELL + CELL / 2, y: e.y * CELL + CELL / 2, vx: 0, vy: -1, life: 15, clr: '#22d3ee', sz: 3 });
    }
    if (e.healCD > 0) e.healCD--;
    if (e.stealth && e.pi > path.length * 0.6) e.stealth = false;

    if (grid.length > 0) addToCell(grid, e);
  }
}
