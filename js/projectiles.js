import { state } from './main.js';
import { sfxHit } from './audio.js';
import { mkF } from './ui.js';
import { getP, freeProj, getBeam } from './pool.js';

function spawnChainSparks(particles, e, CELL) {
  for (let i = 0; i < 5; i++) {
    particles.push({ x: e.x*CELL+CELL/2, y: e.y*CELL+CELL/2, vx: (Math.random()-0.5)*4, vy: (Math.random()-0.5)*4, life: 10, clr: '#c7d2fe', sz: 2 });
  }
}

export function updateProjectiles() {
  const { projectiles, enemies, particles, beams, ticks, CELL } = state;
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    if (p.tgt.dead && !p.chain && !p.pierce) { freeProj(p); projectiles.splice(i, 1); continue; }
    if (p.tgt.dead) {
      const next = enemies.filter(e => !e.dead && !p.hits.includes(e) && Math.hypot(e.x - p.x, e.y - p.y) < 3);
      if (next.length) { p.tgt = next[0]; p.hits.push(p.tgt); } else { freeProj(p); projectiles.splice(i, 1); continue; }
    }
    const dx = p.tgt.x - p.x, dy = p.tgt.y - p.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d < p.spd + 0.02) {
      let dmg = p.dmg;
      if (p.brittleIce && p.tgt.slow > 0) dmg = Math.round(dmg * 1.8);
      p.tgt.hp -= dmg; sfxHit();
      mkF(p.tgt.x * CELL + CELL / 2, p.tgt.y * CELL + CELL / 2, dmg, '#fbbf24');
      if (p.slow > 0) {
        p.tgt.slow = Math.max(p.tgt.slow, p.slow); p.tgt.st = 80;
        if (p.lingeringChill && !p.tgt._permSlow) p.tgt._permSlow = p.tgt.slow * 0.25;
      }
      if (p.stun > 0) p.tgt.stunned = Math.max(p.tgt.stunned, p.stun);
      if (p.blind) p.tgt.slow = Math.max(p.tgt.slow, 0.5);
      if (p.poison) p.tgt.poison = { dmg: p.poison.dmg, dur: p.poison.dur };
      if (p.splash > 0) {
        enemies.forEach(e => { if (e !== p.tgt && !e.dead && Math.hypot(e.x - p.tgt.x, e.y - p.tgt.y) <= p.splash) e.hp -= Math.floor(p.dmg * 0.5); });
      }
      if (p.chain > 0) {
        const nx = enemies.filter(e => !e.dead && e !== p.tgt && !p.hits.includes(e) && Math.hypot(e.x - p.tgt.x, e.y - p.tgt.y) < 2.5);
        if (nx.length) {
          const nt = nx[0]; p.hits.push(nt);
          const b = getBeam(); b.x1=p.tgt.x*CELL+CELL/2; b.y1=p.tgt.y*CELL+CELL/2; b.x2=nt.x*CELL+CELL/2; b.y2=nt.y*CELL+CELL/2; b.life=8; b.clr='#818cf8'; b.w=5; beams.push(b);
          const chainEff = p.chainEfficiency ?? 0.6;
          nt.hp -= Math.floor(p.dmg * chainEff);
          if (p.chainStun && !nt.boss) nt.stunned = Math.max(nt.stunned, p.chainStun);
          if (p.chainSlowAmt && !nt.boss) { nt.slow = Math.max(nt.slow, p.chainSlowAmt); nt.st = Math.max(nt.st, p.chainSlowDur || 30); }
          if (p.chainSparks) spawnChainSparks(particles, nt, CELL);
          p.chain--;
        }
      }
      if (p.pierce > 0) {
        p.hits.push(p.tgt); p.pierce--;
        const nx = enemies.filter(e => !e.dead && !p.hits.includes(e) && Math.hypot(e.x - p.tgt.x, e.y - p.tgt.y) < 1.5);
        if (nx.length) { p.tgt = nx[0]; continue; }
      }
      for (let j = 0; j < 4; j++) {
        let np = getP();
        np.x = p.tgt.x*CELL+CELL/2; np.y = p.tgt.y*CELL+CELL/2;
        np.vx = (Math.random()-0.5)*3; np.vy = (Math.random()-0.5)*3;
        np.life = 10; np.clr = p.clr; np.sz = 2;
        particles.push(np);
      }
      if (p.bloodlust && p.tgt.hp <= 0) state.lives = Math.min(30, state.lives + 1);
      freeProj(p); projectiles.splice(i, 1);
    } else {
      p.x += dx / d * p.spd; p.y += dy / d * p.spd;
      if (ticks % 3 === 0) {
         let np = getP();
         np.x = p.x*CELL+CELL/2; np.y = p.y*CELL+CELL/2;
         np.vx = 0; np.vy = 0; np.life = 6; np.clr = p.clr+'66'; np.sz = 1.5;
         particles.push(np);
      }
    }
  }
}
