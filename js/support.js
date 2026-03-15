'use strict';
import { state } from './main.js';
import { sfxClown, sfxBee, sfxLaser } from './audio.js';
import { SKILLS } from './skills.js';
import { mkF } from './ui.js';

export const SD = {
  clam:    { name:'Intuitive Clam',    icon:'🐚', clr:'#14b8a6', cost:80,  cat:'support', buffRange:2,  buffDmg:1.5, buffRate:.85, buffDesc:'+50% DMG, -15% CD to nearby', desc:'Buffs nearby towers: +50% DMG, -15% cooldown' },
  beehive: { name:'Beehive',           icon:'🐝', clr:'#eab308', cost:90,  cat:'support', beeCount:3,  beeDmg:4,    beeRange:3,   beeRate:30,  desc:'Deploys bees that swarm and sting enemies' },
  clown:   { name:'Magnificent Clown',icon:'🤡', clr:'#f472b6', cost:100, cat:'support', reverseRange:3, reverseDur:80, reverseCD:200, desc:'Reverses nearby enemy movement direction' },
  monkey:  { name:'Resourceful Monkey',icon:'🐵', clr:'#fb923c', cost:70,  cat:'support', factoryBuff:true, desc:'Boosts all factory income by +25% each' },
  robot:   { name:'AI Agent',          icon:'🤖', clr:'#38bdf8', cost:110, cat:'support', autoSpell:true,  desc:'Automatically casts spells during waves' },
};

export function spawnBees(hive) {
  state.bees = state.bees.filter(b => b.hive !== hive);
  const cnt = (hive.beeCount || 3) + (SKILLS.beeKeeper?.owned ? 2 : 0);
  for (let i = 0; i < cnt; i++) {
    state.bees.push({
      hive, x: hive.x * state.CELL + state.CELL / 2, y: hive.y * state.CELL + state.CELL / 2,
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
    const br = (cl.level + 1) * (SKILLS.beeKeeper?.owned ? 1.5 : 1) * 1.5;
    towers.forEach(tw => {
      if (tw === cl || tw.type === 'factory') return;
      if (Math.hypot(tw.x - cl.x, tw.y - cl.y) <= br) { tw._buffed = true; tw._rateBuff = 0.85; }
    });
    if (ticks % 15 === 0) for (let i = 0; i < 2; i++) {
      const a = Math.random() * Math.PI * 2;
      particles.push({ x: cl.x*CELL+CELL/2 + Math.cos(a)*CELL*br*0.5, y: cl.y*CELL+CELL/2 + Math.sin(a)*CELL*br*0.5, vx:0, vy:-.4, life:18, clr:'#5eead4', sz:2 });
    }
  });
}

export function updateClown() {
  const { towers, enemies, CELL, particles } = state;
  towers.filter(tw => tw.type === 'clown').forEach(cl => {
    if (cl.cd > 0) { cl.cd--; return; }
    const inR = enemies.filter(e => !e.dead && !e.reversed && !e.boss && Math.hypot(e.x - cl.x, e.y - cl.y) <= cl.reverseRange);
    if (!inR.length) return;
    const dur = cl.reverseDur * (SKILLS.clownMaster?.owned ? 2 : 1);
    inR.forEach(e => { e.reversed = true; e.reverseTimer = dur; });
    cl.cd = cl.reverseCD; sfxClown();
    for (let i = 0; i < 8; i++) particles.push({ x:cl.x*CELL+CELL/2, y:cl.y*CELL+CELL/2, vx:(Math.random()-.5)*4, vy:(Math.random()-.5)*4, life:20, clr:'#f472b6', sz:3 });
    mkF(cl.x * CELL + CELL / 2, cl.y * CELL + CELL / 2, '🤡 REVERSE!', '#f472b6');
  });
}

export function updateRobot() {
  const { towers, enemies, beams, wave, CELL, particles } = state;
  towers.filter(tw => tw.type === 'robot').forEach(rb => {
    if (rb.cd > 0) { rb.cd--; return; }
    if (enemies.length < 3) return;
    const spells = ['lightning', 'freeze', 'heal'];
    const pick = spells[Math.floor(Math.random() * spells.length)];
    const cd = SKILLS.robotOverclock?.owned ? 150 : 300;
    if (pick === 'lightning' && enemies.length > 0) {
      const tgt = enemies.filter(e => !e.dead).sort((a,b) => b.hp - a.hp)[0];
      if (tgt) {
        tgt.hp -= 20 + wave * 5;
        beams.push({ x1:rb.x*CELL+CELL/2, y1:rb.y*CELL+CELL/2, x2:tgt.x*CELL+CELL/2, y2:tgt.y*CELL+CELL/2, life:10, clr:'#38bdf8' });
        mkF(rb.x * CELL + CELL / 2, rb.y * CELL + CELL / 2, '🤖⚡', '#38bdf8'); sfxLaser();
      }
    } else if (pick === 'freeze' && state.freezeActive <= 0) {
      state.freezeActive = 90;
      mkF(rb.x * CELL + CELL / 2, rb.y * CELL + CELL / 2, '🤖❄️', '#38bdf8');
    } else if (pick === 'heal') {
      state.lives = Math.min(state.lives + 1, 30);
      mkF(rb.x * CELL + CELL / 2, rb.y * CELL + CELL / 2, '🤖💚', '#22c55e');
    }
    rb.cd = cd;
    for (let i = 0; i < 5; i++) particles.push({ x:rb.x*CELL+CELL/2, y:rb.y*CELL+CELL/2, vx:(Math.random()-.5)*3, vy:(Math.random()-.5)*3, life:15, clr:'#38bdf8', sz:2 });
  });
}

export function updateBees() {
  const { bees, enemies, projectiles, CELL } = state;
  for (const bee of bees) {
    const hive = state.towers.find(t => t === bee.hive);
    if (!hive) { bee.dead = true; continue; }
    bee.angle += bee.orbitSpd;
    bee.x = hive.x * CELL + CELL / 2 + Math.cos(bee.angle) * CELL * 1.5;
    bee.y = hive.y * CELL + CELL / 2 + Math.sin(bee.angle) * CELL * 1.5;
    if (bee.cd > 0) { bee.cd--; continue; }
    const inR = enemies.filter(e => !e.dead && !e.stealth && Math.hypot(e.x*CELL+CELL/2 - bee.x, e.y*CELL+CELL/2 - bee.y) <= bee.range * CELL);
    if (!inR.length) continue;
    projectiles.push({ x:bee.x/CELL-.5, y:bee.y/CELL-.5, tgt:inR[0], dmg:bee.dmg, spd:.08, clr:'#fbbf24', splash:0, slow:0, pierce:0, chain:0, speedUp:false, hits:[] });
    bee.cd = bee.rate; sfxBee();
  }
}

export function updateFactoryLaser() {
  const { towers, enemies, beams, wave, CELL, particles } = state;
  towers.filter(tw => tw.type === 'factory' && tw.hasLaser).forEach(tw => {
    if (tw.laserCD > 0) { tw.laserCD--; return; }
    const lr = tw.laserRange || 3;
    const inR = enemies.filter(e => !e.dead && !e.stealth && Math.hypot(e.x - tw.x, e.y - tw.y) <= lr);
    if (!inR.length) return;
    const tgt = inR.reduce((a,b) => a.pi > b.pi ? a : b);
    const ldmg = (SKILLS.doomCannon?.owned ? 2 : 1) * (10 + wave * 1.5 + tw.laserLvl * 5);
    tgt.hp -= Math.floor(ldmg);
    beams.push({ x1:tw.x*CELL+CELL/2, y1:tw.y*CELL+CELL/2, x2:tgt.x*CELL+CELL/2, y2:tgt.y*CELL+CELL/2, life:6+tw.laserLvl*2, clr:'#ef4444', w:1.5+tw.laserLvl*0.8 });
    for (let i = 0; i < 3; i++) particles.push({ x:tgt.x*CELL+CELL/2, y:tgt.y*CELL+CELL/2, vx:(Math.random()-.5)*3, vy:(Math.random()-.5)*3, life:8, clr:'#ef4444', sz:2 });
    sfxLaser(); tw.laserCD = Math.max(8, 25 - tw.laserLvl * 4);
  });
}
