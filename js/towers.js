import { state, _ΨΔ } from './main.js';
import { sfxShoot } from './audio.js';
import { getEnemiesInRadius } from './grid.js';
import { getProj } from './pool.js';
import { TD } from './data.js';
import { spawnParticles, getCenter } from './utils.js';
import { mkF } from './ui.js';

function findTarget(vis, targetStrategy) {
  switch (targetStrategy) {
    case 'weakest': return vis.reduce((a, b) => a.hp < b.hp ? a : b);
    case 'strongest': return vis.reduce((a, b) => a.hp > b.hp ? a : b);
    case 'last': return vis.reduce((a, b) => a.pi < b.pi ? a : b);
    default: return vis.reduce((a, b) => a.pi > b.pi ? a : b); // 'first'
  }
}

function spawnProjectile(tw, tgt, def, isFrenzySecondary = false) {
  let p = getProj();
  let dmg = tw.dmg;
  if (tw._buffed) dmg = Math.ceil(dmg * 1.5);
  if (tw.packHunter) {
    const adjacent = state.towers.filter(t => t !== tw && t.type === 'lion' && Math.abs(t.x - tw.x) <= 1 && Math.abs(t.y - tw.y) <= 1).length;
    if (adjacent > 0) dmg = Math.round(dmg * (1 + adjacent * 0.3));
  }
  if (isFrenzySecondary) {
     Object.assign(p, { x:tw.x, y:tw.y, tgt, dmg, spd:def.pSpd*0.06, clr:def.pClr, splash:tw.splash, slow:tw.slow, pierce:0, chain:0, speedUp:false, hits:[], stun:0, poison:null, blind:false, chainStun:0, bloodlust:tw.bloodlust, lingeringChill:false, brittleIce:false });
  } else {
     Object.assign(p, { x:tw.x, y:tw.y, tgt, dmg, spd:def.pSpd*0.06, clr:def.pClr, splash:tw.splash, slow:tw.slow, pierce:tw.pierce||0, chain:tw.chain||0, speedUp:def.speedUp, hits:[], stun:tw.stun||0, poison:tw.poison||null, blind:tw.blind, chainStun:tw.chainStun||0, bloodlust:tw.bloodlust, lingeringChill:tw.lingeringChill||false, brittleIce:tw.brittleIce||false, mastery:tw._mastery||false });
  }
  return p;
}

export function updateTowers() {
  if (state.ceasefire) return;
  const { towers, projectiles, ticks, wave, CELL, particles, grid } = state;

  // Clear per-frame derived flags
  towers.forEach(tw => { tw._auraInvisActive = false; tw._labInvisActive = false; tw._warmBoost = 1; });

  // Campfire: boost fire rate of towers within warmRange + ambient embers
  const EMBER_CLRS = ['#f97316','#ef4444','#fbbf24','#fb923c','#fde68a'];
  towers.filter(tw => tw.type === 'campfire').forEach(cf => {
    const wr = cf.warmRange || 1.5;
    towers.forEach(tw2 => {
      if (tw2 === cf || TD[tw2.type]?.cat !== 'tower') return;
      if (Math.hypot(tw2.x - cf.x, tw2.y - cf.y) <= wr) tw2._warmBoost = cf.warmRate ?? 0.8;
    });
    if (ticks % 3 === 0) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * wr * CELL;
      particles.push({
        x: getCenter(cf.x, CELL) + Math.cos(angle) * r,
        y: getCenter(cf.y, CELL) + Math.sin(angle) * r,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -0.6 - Math.random() * 0.8,
        life: 18 + Math.floor(Math.random() * 18),
        clr: EMBER_CLRS[Math.floor(Math.random() * EMBER_CLRS.length)],
        sz: 1 + Math.random() * 1.5,
      });
    }
  });

  // Seahorse aura: adjacent towers (1 tile, 8-dir) gain seeInvis
  towers.filter(tw => tw.type === 'seahorse' && tw.auraInvis).forEach(sh => {
    towers.forEach(tw2 => {
      if (tw2 === sh) return;
      if (Math.abs(tw2.x - sh.x) <= 1 && Math.abs(tw2.y - sh.y) <= 1) tw2._auraInvisActive = true;
    });
  });
  // Seahorse aura auto (from research): 2-tile radius, no skill needed
  if (state.researchUnlocks?.seahorse_aura_auto) {
    towers.filter(tw => tw.type === 'seahorse').forEach(sh => {
      towers.forEach(tw2 => {
        if (tw2 === sh) return;
        if (Math.hypot(tw2.x - sh.x, tw2.y - sh.y) <= 2) tw2._auraInvisActive = true;
      });
    });
  }

  // Insightful Lens (lab augment): towers in lab obsRange get labInvis
  towers.filter(tw => tw.type === 'lab' && tw.insightfulLens).forEach(lab => {
    towers.forEach(tw2 => {
      if (Math.hypot(tw2.x - lab.x, tw2.y - lab.y) <= (lab.obsRange || 3)) tw2._labInvisActive = true;
    });
  });

  towers.forEach(tw => {
    if (tw.type === 'factory' || TD[tw.type]?.cat !== 'tower') return;
    if (tw.disabled && tw.disabledWave === wave) return;
    if (tw.cd > 0) { tw.cd -= (tw._rateBuff < 1 ? 1.2 : 1); return; }

    const def = TD[tw.type];
    // Warm Pebble: towers adjacent to Lab fire 10% faster
    let warmPebbleBoost = 1;
    if (state.inventory?.equipped?.some(a => a?.id === 'warm_pebble')) {
      const lab = towers.find(t => t.type === 'lab');
      if (lab && Math.abs(tw.x - lab.x) <= 1 && Math.abs(tw.y - lab.y) <= 1) warmPebbleBoost = 0.9;
    }
    warmPebbleBoost = Math.min(warmPebbleBoost, tw._warmBoost ?? 1);
    const canSeeInvis = def.seeInvis || tw.seeInvis || tw._auraInvisActive || tw._labInvisActive;
    const unblinkingEye = state.inventory?.equipped?.some(a => a?.id === 'unblinking_eye');
    const effectiveRange = (state.fogWave ? Math.max(1, tw.range * 0.55) : tw.range) + (unblinkingEye ? 0.5 : 0);
    const vis = getEnemiesInRadius(grid, tw.x, tw.y, effectiveRange, true, canSeeInvis);
    if (!vis.length) return;

    // invisPriority: prefer stealth enemies first
    let tgtPool = vis;
    if (def.invisPriority) {
      const invisible = vis.filter(e => e.stealth);
      if (invisible.length) tgtPool = invisible;
    }
    const tgt = findTarget(tgtPool, def.target);
    
    projectiles.push(spawnProjectile(tw, tgt, def, false));
    sfxShoot(); tw.cd = Math.round(def.rate * warmPebbleBoost);
    if (state.enemies.some(e => e.auditor && !e.dead)) {
      _ΨΔ(() => { state.gold = Math.max(0, state.gold - 1); });
      mkF(getCenter(tw.x, CELL), getCenter(tw.y, CELL), '-1', '#ef4444');
    }
    
    if (tw.frenzy && vis.length > 1) {
      const t2 = vis.filter(e => e !== tgt);
      if (t2.length) {
        projectiles.push(spawnProjectile(tw, t2[0], def, true));
      }
    }
    
    if (tw.blizzard) vis.forEach(e => { e.slow = Math.max(e.slow, 0.2); e.st = Math.max(e.st, 20); });
    if (def.speedUp) vis.forEach(e => {
      if (!e.spdBuff) e.spdBuff = tw.megaSpeed ? 2 : 1;
      if (ticks % 12 === 0) spawnParticles(particles, getCenter(e.x, CELL), getCenter(e.y, CELL), 1, { vxBase: (Math.random()-.5)*2, vyBase: -1.5, spreadX: 0, spreadY: 0, life: 10, clr: '#a3e635', sz: 2 });
    });
    // Grateful Spider: once-per-wave web shot
    if (tw.type === 'grateful_spider') {
      if (!tw.webUsed && state.phase === 'active' && ticks % 180 === 1) {
        const pathInRange = state.path.filter(p => Math.hypot(p.x - tw.x, p.y - tw.y) <= effectiveRange);
        if (pathInRange.length) {
          const center = pathInRange[Math.floor(pathInRange.length / 2)];
          const webTiles = state.path.filter(p => Math.abs(p.x - center.x) + Math.abs(p.y - center.y) <= 2).slice(0, tw.webSpread ? 5 : 3);
          if (!state.webs) state.webs = [];
          const duration = tw.webLasting ? 7200 : 120;
          for (const pt of webTiles) state.webs.push({ x: pt.x, y: pt.y, expiry: ticks + duration, dmg: tw.webVenom ? 3 : 0, slow: tw.webSlowBonus ? 0.8 : 0.6 });
          tw.webUsed = true;
        }
      }
      return;
    }
  });
  // Apply web effects to enemies
  if (state.webs?.length) {
    for (let i = state.webs.length - 1; i >= 0; i--) {
      if (ticks >= state.webs[i].expiry) { state.webs.splice(i, 1); continue; }
      const web = state.webs[i];
      for (const e of state.enemies) {
        if (e.dead) continue;
        if (Math.abs(e.x - web.x) < 0.75 && Math.abs(e.y - web.y) < 0.75) {
          e._trapSlow = Math.max(e._trapSlow || 0, web.slow);
          if (web.dmg && ticks % 20 === 0) e.hp -= web.dmg;
        }
      }
    }
  }
}
