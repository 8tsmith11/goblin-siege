'use strict';
import { state, dropLoot } from './main.js';
import { TD } from './data.js';
import { sfxClown, sfxBee, sfxLaser, speak } from './audio.js';
import { getEnemiesInRadius } from './grid.js';
import { mkF, mkGain, showBanner } from './ui.js';
import { getProj } from './pool.js';
import { spawnParticles, getCenter } from './utils.js';
import { addFeed } from './feed.js';
import { ARTIFACTS } from './artifacts.js';

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
    const br = Math.min(cl.buffRange || TD.clam.buffRange, 3.5);
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
  const CONFETTI = ['#f472b6','#facc15','#34d399','#60a5fa','#f87171','#a78bfa'];
  towers.filter(tw => tw.type === 'clown').forEach(cl => {
    if (cl.cd > 0) { cl.cd--; return; }
    const inR = getEnemiesInRadius(grid, cl.x, cl.y, cl.reverseRange).filter(e => !e.reversed && !e.boss && (!e.stealth || cl.seeInvis));
    if (!inR.length) return;

    const sorted = [...inR].sort((a, b) => b.pi - a.pi);
    const targets = sorted.slice(0, cl.reverseCount || 1);

    targets.forEach(tgt => {
      tgt.reversed = true; tgt.reverseTimer = cl.reverseDur;
      if (cl.reverseStun) tgt.stunned = Math.max(tgt.stunned, 10);
    });

    // Jester's Privilege (Mastery): swaps strongest and weakest enemy in range by current HP
    if (cl.jesterPriv) {
      const pool = inR.filter(e => !e.boss);
      if (pool.length >= 2) {
        const strongest = pool.reduce((a, b) => a.hp > b.hp ? a : b);
        const weakest   = pool.reduce((a, b) => a.hp < b.hp ? a : b);
        const front = strongest, back = weakest;
        if (front !== back) {
          // spawn huge confetti bursts at both positions + midpoint
          const mx = (front.x + back.x) / 2, my = (front.y + back.y) / 2;
          for (const pos of [[front.x, front.y],[back.x, back.y],[mx, my]]) {
            spawnParticles(particles, getCenter(pos[0], CELL), getCenter(pos[1], CELL), 20,
              { spreadX: 3, spreadY: 3, life: 30, clr: CONFETTI[Math.floor(Math.random() * CONFETTI.length)], sz: 5 });
          }
          // give each a rush destination toward the other's current position
          const [fx, fy, fpi] = [front.x, front.y, front.pi];
          front._rushToX = back.x; front._rushToY = back.y; front._rushToPi = back.pi;
          back._rushToX  = fx;     back._rushToY  = fy;     back._rushToPi  = fpi;
          mkF(getCenter(mx, CELL), getCenter(my, CELL), '🎪 SWAP!', '#f472b6');
        }
      }
    }

    cl.cd = cl.reverseCD; sfxClown();
    spawnParticles(particles, getCenter(cl.x, CELL), getCenter(cl.y, CELL), cl.jesterPriv ? 20 : 8, { spreadX: 4, spreadY: 4, life: 20, clr: '#f472b6', sz: 3 });
    mkF(getCenter(cl.x, CELL), getCenter(cl.y, CELL), cl.jesterPriv ? '🤡 REVERSE + SWAP!' : '🤡 REVERSE!', '#f472b6');
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
  const { bees, enemies, projectiles, CELL, grid, ticks } = state;
  for (const bee of bees) {
    const hive = state.towers.find(t => t === bee.hive);
    if (!hive) { bee.dead = true; continue; }
    bee.angle += bee.orbitSpd;
    bee.x = getCenter(hive.x, CELL) + Math.cos(bee.angle) * CELL * 1.5;
    bee.y = getCenter(hive.y, CELL) + Math.sin(bee.angle) * CELL * 1.5;
    if (bee.cd > 0) { bee.cd--; continue; }
    if (state.ceasefire) continue;
    // Coordinated Strike: all bees lock onto the same hive-chosen target
    if (hive.beeCoordinated) {
      if (!hive._beeTarget || hive._beeTarget.dead || ticks % 60 === 0) {
        const wx2 = hive.x, wy2 = hive.y;
        const pool = getEnemiesInRadius(grid, wx2, wy2, (hive.beeRange || 3) + 1.5, true, false);
        hive._beeTarget = pool.length ? pool.reduce((a, b) => a.pi > b.pi ? a : b) : null;
      }
      if (!hive._beeTarget) continue;
      let bProj = getProj();
      const frenzyMult = (hive._supercolony && hive._beeFrenzyEnd > ticks) ? 1.5 : 1;
      Object.assign(bProj, { x: bee.x / CELL - .5, y: bee.y / CELL - .5, tgt: hive._beeTarget, dmg: bee.dmg * frenzyMult, spd: .08, clr: '#fbbf24', splash: 0, slow: 0, pierce: 0, chain: 0, speedUp: false, hits: [], poison: hive.beeVenom ? { dmg: 3, dur: 90 } : null, _beeHive: hive._supercolony ? hive : null });
      projectiles.push(bProj);
      bee.cd = Math.round(bee.rate / frenzyMult); sfxBee();
      continue;
    }
    const wx = (bee.x - CELL / 2) / CELL, wy = (bee.y - CELL / 2) / CELL;
    const inR = getEnemiesInRadius(grid, wx, wy, bee.range, true, false);
    if (!inR.length) continue;
    let bProj = getProj();
    const frenzyMult2 = (hive._supercolony && hive._beeFrenzyEnd > ticks) ? 1.5 : 1;
    Object.assign(bProj, { x: bee.x / CELL - .5, y: bee.y / CELL - .5, tgt: inR[0], dmg: bee.dmg * frenzyMult2, spd: .08, clr: '#fbbf24', splash: 0, slow: 0, pierce: 0, chain: 0, speedUp: false, hits: [], poison: hive.beeVenom ? { dmg: 3, dur: 90 } : null, _beeHive: hive._supercolony ? hive : null });
    projectiles.push(bProj);
    bee.cd = Math.round(bee.rate / frenzyMult2); sfxBee();
  }
}

export function updateOrbitalBrood() {
  const { towers, enemies, CELL, particles, ticks } = state;
  towers.filter(tw => tw.type === 'grateful_spider' && tw.orbitalBrood).forEach(tw => {
    if (!tw._orbits) tw._orbits = [];
    // Initialise 3 orbital spiderlings if not present
    while (tw._orbits.length < 3) {
      const i = tw._orbits.length;
      tw._orbits.push({ angle: i * Math.PI * 2 / 3, orbitSpd: 0.04, latched: null, x: getCenter(tw.x, CELL), y: getCenter(tw.y, CELL), cd: 0 });
    }
    for (const orb of tw._orbits) {
      // If latched onto an enemy, follow and damage it
      if (orb.latched) {
        const e = orb.latched;
        if (e.dead || Math.hypot(e.x - tw.x, e.y - tw.y) > 8) {
          orb.latched = null; // return to orbit
        } else {
          orb.x = getCenter(e.x, CELL) + (Math.random() - 0.5) * 4;
          orb.y = getCenter(e.y, CELL) + (Math.random() - 0.5) * 4;
          orb.cd++;
          if (orb.cd >= 30) {
            e.hp -= 2;
            orb.cd = 0;
            spawnParticles(particles, orb.x, orb.y, 2, { spreadX: 2, spreadY: 2, life: 6, clr: '#c4b5fd', sz: 1 });
          }
        }
      } else {
        // Orbit the tower
        orb.angle += orb.orbitSpd;
        orb.x = getCenter(tw.x, CELL) + Math.cos(orb.angle) * CELL * 1.2;
        orb.y = getCenter(tw.y, CELL) + Math.sin(orb.angle) * CELL * 1.2;
        // Check for nearby enemies to latch onto
        const latchRange = 1.5;
        const candidate = enemies.find(e => !e.dead && !e.boss && Math.hypot(e.x - tw.x, e.y - tw.y) <= latchRange && !tw._orbits.some(o => o.latched === e));
        if (candidate) { orb.latched = candidate; orb.cd = 0; }
      }
    }
  });
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

// ─── Spider Mother ────────────────────────────────────────────────────────────

export function spawnSpiderMother() {
  const { path, CELL } = state;
  if (!path?.length) return;
  const start = path[0];
  state.spiderMother = {
    x: start.x, y: start.y,
    pi: 0,
    phase: 'forward',
    spd: 0.10,
    dead: false,
    stonePickedUp: false,
  };
  state.bSen.add('spider_mother');
}

export function updateSpiderMother() {
  const sm = state.spiderMother;
  if (!sm || sm.dead) return;
  const { path, CELL, ticks } = state;
  if (!path?.length) return;

  if (sm.phase === 'forward') {
    const target = path[sm.pi];
    if (!target) { sm.phase = 'return'; return; }
    const dx = target.x - sm.x, dy = target.y - sm.y;
    const dist = Math.hypot(dx, dy);
    if (dist < sm.spd) {
      // Check if we're on the seed stone tile
      if (state.seedStone && !sm.stonePickedUp && target.x === state.seedStone.x && target.y === state.seedStone.y) {
        sm.stonePickedUp = true;
        state.seedStone.carried = true;
        addFeed('npc', '🕷️ The Spider Mother takes the Seed Stone.', '🕷️');
      }
      sm.x = target.x; sm.y = target.y;
      sm.pi++;
      if (sm.pi >= path.length) {
        sm.phase = 'return';
        sm.pi = path.length - 1;
        addFeed('npc', '🕷️ "Thank you." The Spider Mother turns to leave.', '🕷️');
        speak('Thank you.');
      }
    } else {
      sm.x += (dx / dist) * sm.spd;
      sm.y += (dy / dist) * sm.spd;
    }
  } else if (sm.phase === 'return') {
    const target = path[sm.pi];

    if (!sm.droppedItems && sm.pi <= Math.floor(path.length / 2)) {
      sm.droppedItems = true;
      // Drop Spider Staff artifact
      const staff = ARTIFACTS.find(a => a.id === 'spider_staff');
      if (staff) {
        const mid = path[Math.floor(path.length / 2)];
        if (mid) {
          dropLoot(mid.x, mid.y, 'artifacts', { ...staff, cdWavesLeft: 0 });
          mkGain(mid.x * state.CELL + state.CELL / 2, mid.y * state.CELL + state.CELL / 2, '🕸️', 1, '#f59e0b');
        }
      }
      // Drop Grateful Spider blueprint
      const gsBp = path[Math.floor(path.length / 2)];
      if (gsBp) {
        dropLoot(gsBp.x, gsBp.y, 'blueprints', { id: 'grateful_spider_bp', icon: '🟦', bpOverlay: '🕷️', name: 'Grateful Spider Blueprint', unlocks: 'grateful_spider' });
        mkGain(gsBp.x * state.CELL + state.CELL / 2, gsBp.y * state.CELL + state.CELL / 2, '🕷️', 1, '#8b5cf6');
      }
      showBanner('🕷️ The Spider Mother leaves a gift.');
    }

    if (!target || sm.pi < 0) {
      // Ritual complete — leave
      sm.dead = true;
      state.spiderMother = null;
      state.seedStone = null;
      state.spiderRitualDone = true;
      showBanner('🕷️ The Spider Mother has gone. Spiders will come no more.');
      addFeed('npc', '🕷️ The ritual is complete. The spiders are done here.', '🕷️');
      return;
    }
    const dx = target.x - sm.x, dy = target.y - sm.y;
    const dist = Math.hypot(dx, dy);
    if (dist < sm.spd) {
      sm.x = target.x; sm.y = target.y;
      sm.pi--;
    } else {
      sm.x += (dx / dist) * sm.spd;
      sm.y += (dy / dist) * sm.spd;
    }
  }
}
