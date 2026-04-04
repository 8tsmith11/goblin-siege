'use strict';
import { state } from './main.js';
import { sfxClown, sfxBee, sfxLaser } from './audio.js';
import { getEnemiesInRadius } from './grid.js';
import { mkF } from './ui.js';
import { getProj } from './pool.js';
import { spawnParticles, getCenter } from './utils.js';

export function spawnBees(hive) {
  state.bees = state.bees.filter(b => b.hive !== hive);
  const cnt = hive.beeCount || 3;
  for (let i = 0; i < cnt; i++) {
    state.bees.push({
      hive, x: getCenter(hive.x, state.CELL), y: getCenter(hive.y, state.CELL),
      angle: i * (Math.PI * 2 / cnt), orbitSpd: 0.03 + Math.random() * 0.01,
      dmg: hive.beeDmg || 4, range: hive.beeRange || 3, rate: hive.beeRate || 30,
      cd: Math.floor(Math.random() * 20), dead: false,
    });
  }
}

export function updateClam() {
  const { towers, ticks, CELL, particles } = state;
  towers.forEach(tw => { tw._buffed = false; tw._rateBuff = 1; });
  towers.filter(tw => tw.type === 'clam').forEach(cl => {
    const br = (cl.level + 1) * 1.5;
    towers.forEach(tw => {
      if (tw === cl || tw.type === 'factory') return;
      if (Math.hypot(tw.x - cl.x, tw.y - cl.y) <= br) { tw._buffed = true; tw._rateBuff = 0.85; }
    });
    if (ticks % 15 === 0) for (let i = 0; i < 2; i++) {
      const a = Math.random() * Math.PI * 2;
      particles.push({ 
        x: getCenter(cl.x, CELL) + Math.cos(a)*CELL*br*0.5, 
        y: getCenter(cl.y, CELL) + Math.sin(a)*CELL*br*0.5, 
        vx: 0, vy: -.4, life: 18, clr: '#5eead4', sz: 2 
      });
    }
  });
}

export function updateClown() {
  const { towers, CELL, particles, grid } = state;
  towers.filter(tw => tw.type === 'clown').forEach(cl => {
    if (cl.cd > 0) { cl.cd--; return; }
    const inR = getEnemiesInRadius(grid, cl.x, cl.y, cl.reverseRange).filter(e => !e.reversed && !e.boss);
    if (!inR.length) return;
    // Single target — furthest along the path
    const tgt = inR.reduce((a, b) => a.pi > b.pi ? a : b);
    tgt.reversed = true; tgt.reverseTimer = cl.reverseDur;
    cl.cd = cl.reverseCD; sfxClown();
    spawnParticles(particles, getCenter(cl.x, CELL), getCenter(cl.y, CELL), 8, { spreadX: 4, spreadY: 4, life: 20, clr: '#f472b6', sz: 3 });
    mkF(getCenter(cl.x, CELL), getCenter(cl.y, CELL), '🤡 REVERSE!', '#f472b6');
  });
}

export function updateRobot() {
  const { towers, enemies, beams, wave, CELL, particles } = state;
  towers.filter(tw => tw.type === 'robot').forEach(rb => {
    if (rb.cd > 0) { rb.cd--; return; }
    if (enemies.length < 3) return;
    const spells = ['lightning', 'freeze', 'heal'];
    const pick = spells[Math.floor(Math.random() * spells.length)];
    const cd = 300;
    
    const cx = getCenter(rb.x, CELL);
    const cy = getCenter(rb.y, CELL);
    
    if (pick === 'lightning' && enemies.length > 0) {
      const tgt = enemies.filter(e => !e.dead).sort((a,b) => b.hp - a.hp)[0];
      if (tgt) {
        tgt.hp -= 20 + wave * 5;
        beams.push({ x1: cx, y1: cy, x2: getCenter(tgt.x, CELL), y2: getCenter(tgt.y, CELL), life: 10, clr: '#38bdf8' });
        mkF(cx, cy, '🤖⚡', '#38bdf8'); sfxLaser();
      }
    } else if (pick === 'freeze' && state.freezeActive <= 0) {
      state.freezeActive = 90;
      mkF(cx, cy, '🤖❄️', '#38bdf8');
    } else if (pick === 'heal') {
      state.lives = Math.min(state.lives + 1, 30);
      mkF(cx, cy, '🤖💚', '#22c55e');
    }
    rb.cd = cd;
    spawnParticles(particles, cx, cy, 5, { spreadX: 3, spreadY: 3, life: 15, clr: '#38bdf8', sz: 2 });
  });
}

export function updateBees() {
  const { bees, enemies, projectiles, CELL, grid } = state;
  for (const bee of bees) {
    const hive = state.towers.find(t => t === bee.hive);
    if (!hive) { bee.dead = true; continue; }
    bee.angle += bee.orbitSpd;
    bee.x = getCenter(hive.x, CELL) + Math.cos(bee.angle) * CELL * 1.5;
    bee.y = getCenter(hive.y, CELL) + Math.sin(bee.angle) * CELL * 1.5;
    if (bee.cd > 0) { bee.cd--; continue; }
    const wx = (bee.x - CELL / 2) / CELL, wy = (bee.y - CELL / 2) / CELL;
    const inR = getEnemiesInRadius(grid, wx, wy, bee.range, true, false);
    if (!inR.length) continue;
    let bProj = getProj();
    Object.assign(bProj, { x: bee.x / CELL - .5, y: bee.y / CELL - .5, tgt: inR[0], dmg: bee.dmg, spd: .08, clr: '#fbbf24', splash: 0, slow: 0, pierce: 0, chain: 0, speedUp: false, hits: [] });
    projectiles.push(bProj);
    bee.cd = bee.rate; sfxBee();
  }
}

export function updateFactoryLaser() {
  const { towers, enemies, beams, wave, CELL, particles, grid } = state;
  towers.filter(tw => tw.type === 'factory' && tw.hasLaser).forEach(tw => {
    if (tw.laserCD > 0) { tw.laserCD--; return; }
    const lr = tw.laserRange || 3;
    const inR = getEnemiesInRadius(grid, tw.x, tw.y, lr, true, false);
    if (!inR.length) return;
    const tgt = inR.reduce((a,b) => a.pi > b.pi ? a : b);
    const ldmg = 10 + wave * 1.5 + tw.laserLvl * 5;
    tgt.hp -= Math.floor(ldmg);
    beams.push({ x1: getCenter(tw.x, CELL), y1: getCenter(tw.y, CELL), x2: getCenter(tgt.x, CELL), y2: getCenter(tgt.y, CELL), life: 6 + tw.laserLvl * 2, clr: '#ef4444', w: 1.5 + tw.laserLvl * 0.8 });
    spawnParticles(particles, getCenter(tgt.x, CELL), getCenter(tgt.y, CELL), 3, { spreadX: 3, spreadY: 3, life: 8, clr: '#ef4444', sz: 2 });
    sfxLaser(); tw.laserCD = Math.max(8, 25 - tw.laserLvl * 4);
  });
}
