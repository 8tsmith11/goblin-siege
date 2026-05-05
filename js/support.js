'use strict';
import { state, dropLoot, _ΨΔ, getCell } from './main.js';
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
      _ΨΔ(() => { state.lives = Math.min(state.lives + 1, state.maxLives || 3); });
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
      if (!hive._beeTarget || hive._beeTarget.dead || !enemies.length || ticks % 60 === 0) {
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
        if (e.dead) {
          orb.latched = null;
        } else {
          orb.x = getCenter(e.x, CELL) + (Math.random() - 0.5) * 4;
          orb.y = getCenter(e.y, CELL) + (Math.random() - 0.5) * 4;
          orb.cd++;
          if (orb.cd >= 20) {
            e.hp -= Math.max(2, Math.ceil(tw.dmg * 0.35));
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
    spd: 0.035,
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

// ─── Fluid system ─────────────────────────────────────────────────────────────
const _FLUID_TYPES = new Set(['water_pump','pipe','steam_boiler','tank','inline_pump','steam_engine']);
const _SIDE_D = { N:[0,-1], S:[0,1], E:[1,0], W:[-1,0] };

function _fluidNeighbors(tw) {
  const result = [];
  for (const [side, [dx, dy]] of Object.entries(_SIDE_D)) {
    const nbr = getCell(tw.x + dx, tw.y + dy)?.content;
    if (nbr && _FLUID_TYPES.has(nbr.type)) result.push({ tw: nbr, side });
  }
  return result;
}

// BFS through pipes from a starting fluid node; returns all reachable non-pipe containers
function _findContainers(start) {
  const visited = new Set([start]);
  const queue = [start];
  const containers = [];
  while (queue.length) {
    const cur = queue.shift();
    for (const { tw: nbr } of _fluidNeighbors(cur)) {
      if (visited.has(nbr)) continue;
      visited.add(nbr);
      if (nbr.type === 'pipe') {
        // Don't cross steam pipes with water BFS
        if (!nbr.fluidType || nbr.fluidType === 'water') queue.push(nbr);
      } else {
        containers.push(nbr);
      }
    }
  }
  return { visited, containers };
}

export function updateFluids() {
  const towers = state.towers;

  // Step 1: Water pumps generate water, then equalize with connected containers
  for (const tw of towers) {
    if (tw.type !== 'water_pump') continue;
    if (!tw.fluid) tw.fluid = { type: 'water', amount: 0 };
    tw.fluid.amount = Math.min(10, (tw.fluid.amount || 0) + (TD.water_pump?.fluidRate || 0.3));
    tw.fluid.type = 'water';

    // Find all containers connected via pipes; push water to equalize
    const { visited, containers } = _findContainers(tw);
    // Mark empty pipes as water-typed (don't overwrite steam pipes)
    for (const p of visited) {
      if (p.type === 'pipe' && !p.fluidType) p.fluidType = 'water';
    }
    // Equalize water across pump + boiler water buffers
    const waterNodes = [tw, ...containers.filter(c => c.type === 'steam_boiler')];
    const waterAmounts = waterNodes.map(n => n.type === 'water_pump' ? n.fluid.amount : (n.waterFluid?.amount || 0));
    const totalWater = waterAmounts.reduce((a, b) => a + b, 0);
    const avg = totalWater / waterNodes.length;
    for (const n of waterNodes) {
      if (n.type === 'water_pump') {
        n.fluid.amount = avg;
      } else {
        if (!n.waterFluid) n.waterFluid = { type: 'water', amount: 0 };
        n.waterFluid.amount = avg;
      }
    }
  }

  // Step 2: Steam boiler — consume water + wood → steam, flood steam to ALL adjacent pipes
  for (const tw of towers) {
    if (tw.type !== 'steam_boiler') continue;
    if (!tw.waterFluid) tw.waterFluid = { type: 'water', amount: 0 };
    if (!tw.steamFluid) tw.steamFluid = { type: 'steam', amount: 0 };
    if (!tw.woodStock) tw.woodStock = 0;
    // Convert water + wood → steam (improved rates: 0.03 steam/tick, 2 boilers sustain 1 engine)
    if (tw.waterFluid.amount > 0.1 && tw.woodStock > 0) {
      const rate = 0.02;
      tw.waterFluid.amount = Math.max(0, tw.waterFluid.amount - rate);
      tw.woodStock = Math.max(0, tw.woodStock - rate * 0.75);
      tw.steamFluid.amount = Math.min(10, tw.steamFluid.amount + rate * 1.5);
    }
    // Push steam into ALL adjacent pipes (boiler connects in all directions)
    if (tw.steamFluid.amount > 0) {
      for (const [, [dx, dy]] of Object.entries(_SIDE_D)) {
        const outNbr = getCell(tw.x + dx, tw.y + dy)?.content;
        if (outNbr?.type === 'pipe' && (!outNbr.fluidType || outNbr.fluidType === 'steam')) {
          // BFS to mark all connected empty/steam pipes as steam
          const q = [outNbr]; const vs = new Set([outNbr]);
          while (q.length) {
            const cur = q.shift();
            cur.fluidType = 'steam';
            for (const { tw: nbr } of _fluidNeighbors(cur)) {
              if (nbr.type === 'pipe' && !vs.has(nbr) && (!nbr.fluidType || nbr.fluidType === 'steam')) {
                vs.add(nbr); q.push(nbr);
              }
            }
          }
        }
      }
    }
  }

  // Wood delivery to boilers (monkey drops wood on boiler tile → woodStock)
  for (const tw of towers) {
    if (tw.type !== 'steam_boiler') continue;
    const cell = getCell(tw.x, tw.y);
    if (!cell?.stacks) continue;
    for (let i = 0; i < 4; i++) {
      const s = cell.stacks[i];
      if (s?.type === 'wood') {
        tw.woodStock = Math.min(50, (tw.woodStock || 0) + s.count);
        cell.stacks[i] = null;
      }
    }
  }
}

// ─── Torque system ────────────────────────────────────────────────────────────

function _torqueNeighbors(tw) {
  const result = [];
  for (const [, [dx, dy]] of Object.entries(_SIDE_D)) {
    const nbr = getCell(tw.x + dx, tw.y + dy)?.content;
    if (nbr && (nbr.type === 'pulley' || nbr.type === 'steam_engine')) result.push(nbr);
  }
  return result;
}

export function updateTorque() {
  const { towers, belts } = state;
  if (!belts) return;

  // Reset torque on all pulleys and engines
  for (const tw of towers) {
    if (tw.type === 'pulley') tw.torque = 0;
    if (tw.type === 'steam_engine') { tw.torqueActive = false; }
  }

  // Each steam engine: consume steam from adjacent boiler or steam pipe, output torque
  for (const tw of towers) {
    if (tw.type !== 'steam_engine') continue;
    const steamRate = TD.steam_engine?.steamRate || 0.04;
    let steamSrc = null;
    // Check adjacent boiler first (direct connection)
    for (const [, [dx, dy]] of Object.entries(_SIDE_D)) {
      const nbr = getCell(tw.x + dx, tw.y + dy)?.content;
      if (nbr?.type === 'steam_boiler' && (nbr.steamFluid?.amount || 0) >= steamRate) { steamSrc = nbr; break; }
    }
    // Also accept steam from adjacent pipes — BFS back to find a boiler to deduct from
    if (!steamSrc) {
      for (const [, [dx, dy]] of Object.entries(_SIDE_D)) {
        const nbr = getCell(tw.x + dx, tw.y + dy)?.content;
        if (nbr?.type === 'pipe' && nbr.fluidType === 'steam') {
          // BFS through steam pipes to find a boiler with enough steam
          const visited = new Set([nbr]);
          const q = [nbr];
          while (q.length && !steamSrc) {
            const cur = q.shift();
            for (const { tw: pnbr } of _fluidNeighbors(cur)) {
              if (visited.has(pnbr)) continue;
              visited.add(pnbr);
              if (pnbr.type === 'steam_boiler' && (pnbr.steamFluid?.amount || 0) >= steamRate) {
                steamSrc = pnbr; break;
              }
              if (pnbr.type === 'pipe' && pnbr.fluidType === 'steam') q.push(pnbr);
            }
          }
          if (steamSrc) break;
        }
      }
    }
    if (steamSrc) {
      steamSrc.steamFluid.amount = Math.max(0, steamSrc.steamFluid.amount - steamRate);
      tw.torqueActive = true;
    }
  }

  // BFS: spread torque through belt-connected pulley networks
  const beltMap = new Map(); // pulley key -> Set of connected pulley keys
  for (const b of belts) {
    const ka = b.fromX + ',' + b.fromY, kb = b.toX + ',' + b.toY;
    if (!beltMap.has(ka)) beltMap.set(ka, new Set());
    if (!beltMap.has(kb)) beltMap.set(kb, new Set());
    beltMap.get(ka).add(kb);
    beltMap.get(kb).add(ka);
  }

  const pulleyMap = new Map();
  for (const tw of towers) {
    if (tw.type === 'pulley') pulleyMap.set(tw.x + ',' + tw.y, tw);
  }

  const visited = new Set();
  for (const tw of towers) {
    if (tw.type !== 'pulley' || visited.has(tw)) continue;
    // BFS to find network
    const cluster = [];
    const queue = [tw];
    while (queue.length) {
      const cur = queue.shift();
      const key = cur.x + ',' + cur.y;
      if (visited.has(cur)) continue;
      visited.add(cur);
      cluster.push(cur);
      for (const nk of (beltMap.get(key) || [])) {
        const nbr = pulleyMap.get(nk);
        if (nbr && !visited.has(nbr)) queue.push(nbr);
      }
    }

    // Check if any pulley in cluster is adjacent to an active steam engine
    let totalTorque = 0;
    for (const p of cluster) {
      for (const [, [dx, dy]] of Object.entries(_SIDE_D)) {
        const nbr = getCell(p.x + dx, p.y + dy)?.content;
        if (nbr?.type === 'steam_engine' && nbr.torqueActive) {
          totalTorque += TD.steam_engine?.torqueOut || 10;
        }
      }
    }

    for (const p of cluster) {
      p.torque = totalTorque;
      p.torqueNetworkSize = cluster.length;
    }
  }

  // Butcher: consume torque, spin, attack enemies in range
  for (const tw of towers) {
    if (tw.type !== 'butcher') continue;
    if (!tw.rotation) tw.rotation = 0;
    if (!tw.blades) tw.blades = TD.butcher.blades;
    if (!tw.bladeLen) tw.bladeLen = TD.butcher.bladeLen;
    if (!tw.gearRatio) tw.gearRatio = TD.butcher.gearRatio;

    // Find adjacent pulley with torque
    let available = 0;
    for (const [, [dx, dy]] of Object.entries(_SIDE_D)) {
      const nbr = getCell(tw.x + dx, tw.y + dy)?.content;
      if (nbr?.type === 'pulley' && nbr.torque > 0) { available = nbr.torque; break; }
    }

    const spinCap = tw.hasGearTrain ? 0.22 : 0.15;
    const spinRate = available > 0 ? Math.min(spinCap, (available / 10) * 0.08 * tw.gearRatio) : 0;
    tw.spinRate = spinRate;
    tw.rotation = (tw.rotation + spinRate) % (Math.PI * 2);

    if (spinRate > 0 && (!tw.cd || tw.cd <= 0)) {
      const { CELL, enemies } = state;
      const reach = (tw.range || tw.bladeLen || 0.58) * CELL;
      const cx = tw.x * CELL + CELL / 2, cy = tw.y * CELL + CELL / 2;
      for (const e of enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x * CELL + CELL / 2 - cx, e.y * CELL + CELL / 2 - cy) <= reach) {
          e.hp -= tw.dmg || TD.butcher.dmg;
        }
      }
      tw.cd = Math.max(1, Math.round(60 / (spinRate * tw.blades * 10)));
    }
    if (tw.cd > 0) tw.cd--;
  }

  // Spin pulleys visually
  for (const tw of towers) {
    if (tw.type === 'pulley') {
      if (!tw.rotation) tw.rotation = 0;
      const spinRate = tw.torque > 0 ? (tw.torque / 10) * 0.05 : 0;
      tw.rotation = (tw.rotation + spinRate) % (Math.PI * 2);
      tw.spinRate = spinRate;
    }
  }
}

export function updateInlinePumps() {
  const { towers } = state;
  for (const tw of towers) {
    if (tw.type !== 'inline_pump') continue;
    if (!tw.inputSide) tw.inputSide = 'W';
    if (!tw.outputSide) tw.outputSide = 'E';
    const [idx, idy] = _SIDE_D[tw.inputSide];
    const [odx, ody] = _SIDE_D[tw.outputSide];
    const inNbr = getCell(tw.x + idx, tw.y + idy)?.content;
    const outNbr = getCell(tw.x + odx, tw.y + ody)?.content;
    if (!inNbr || !outNbr) continue;

    // Pull from tank or pipe on input side
    let srcAmount = 0, srcType = null;
    if (inNbr.type === 'tank' && (inNbr.fluid?.amount || 0) > 0) {
      srcAmount = inNbr.fluid.amount; srcType = inNbr.fluid.type;
    } else if (inNbr.type === 'pipe' && inNbr.fluidType) {
      // pipes are conduits; pump pulls conceptually from its network
      srcAmount = 10; srcType = inNbr.fluidType;
    }
    if (!srcType || srcAmount <= 0) continue;

    const rate = TD.inline_pump?.fluidRate || 0.2;
    // Push to tank or pipe on output side
    if (outNbr.type === 'tank') {
      if (!outNbr.fluid) outNbr.fluid = { type: null, amount: 0 };
      if (!outNbr.fluid.type || outNbr.fluid.type === srcType) {
        const space = (outNbr.fluidMax || 40) - (outNbr.fluid.amount || 0);
        const push = Math.min(rate, space, srcAmount);
        outNbr.fluid.amount = (outNbr.fluid.amount || 0) + push;
        outNbr.fluid.type = srcType;
        if (inNbr.type === 'tank') inNbr.fluid.amount = Math.max(0, inNbr.fluid.amount - push);
      }
    } else if (outNbr.type === 'pipe') {
      outNbr.fluidType = srcType;
      if (inNbr.type === 'tank') inNbr.fluid.amount = Math.max(0, inNbr.fluid.amount - rate);
    }
  }
}
