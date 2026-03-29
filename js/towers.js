import { state } from './main.js';
import { sfxShoot } from './audio.js';
import { getEnemiesInRadius } from './grid.js';
import { getProj } from './pool.js';
import { TD } from './data.js';
import { spawnParticles, getCenter } from './utils.js';

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
  
  if (isFrenzySecondary) {
     Object.assign(p, { x:tw.x, y:tw.y, tgt, dmg, spd:def.pSpd*0.06, clr:def.pClr, splash:tw.splash, slow:tw.slow, pierce:0, chain:0, speedUp:false, hits:[], stun:0, poison:null, blind:false, chainStun:0, bloodlust:tw.bloodlust });
  } else {
     Object.assign(p, { x:tw.x, y:tw.y, tgt, dmg, spd:def.pSpd*0.06, clr:def.pClr, splash:tw.splash, slow:tw.slow, pierce:tw.pierce||0, chain:tw.chain||0, speedUp:def.speedUp, hits:[], stun:tw.stun||0, poison:tw.poison||null, blind:tw.blind, chainStun:tw.chainStun||0, bloodlust:tw.bloodlust });
  }
  return p;
}

export function updateTowers() {
  const { towers, projectiles, ticks, wave, CELL, particles, grid } = state;
  towers.forEach(tw => {
    if (tw.type === 'factory' || TD[tw.type]?.cat !== 'tower') return;
    if (tw.disabled && tw.disabledWave === wave) return;
    if (tw.cd > 0) { tw.cd -= (tw._rateBuff < 1 ? 1.2 : 1); return; }
    
    const def = TD[tw.type];
    const vis = getEnemiesInRadius(grid, tw.x, tw.y, tw.range, true, tw.seeInvis);
    if (!vis.length) return;
    
    const tgt = findTarget(vis, def.target);
    
    projectiles.push(spawnProjectile(tw, tgt, def, false));
    sfxShoot(); tw.cd = def.rate;
    
    if (tw.frenzy && vis.length > 1) {
      const t2 = vis.filter(e => e !== tgt);
      if (t2.length) {
        projectiles.push(spawnProjectile(tw, t2[0], def, true));
      }
    }
    
    if (tw.blizzard) vis.forEach(e => { e.slow = Math.max(e.slow, tw.slow); e.st = 80; });
    if (def.speedUp) vis.forEach(e => {
      if (!e.spdBuff) e.spdBuff = tw.megaSpeed ? 2 : 1;
      if (ticks % 12 === 0) spawnParticles(particles, getCenter(e.x, CELL), getCenter(e.y, CELL), 1, { vxBase: (Math.random()-.5)*2, vyBase: -1.5, spreadX: 0, spreadY: 0, life: 10, clr: '#a3e635', sz: 2 });
    });
  });
}
