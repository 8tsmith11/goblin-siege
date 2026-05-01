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
        // Path-index-based alternating chain: spread backward and forward from the primary target
        const pi0 = p.tgt.pi ?? 0;
        const unchained = enemies.filter(e => !e.dead && e !== p.tgt && !p.hits.includes(e));
        const before = unchained.filter(e => (e.pi ?? 0) < pi0).sort((a, b) => (b.pi ?? 0) - (a.pi ?? 0));
        const after  = unchained.filter(e => (e.pi ?? 0) > pi0).sort((a, b) => (a.pi ?? 0) - (b.pi ?? 0));
        let bi = 0, ai = 0, remaining = p.chain, turn = 0;
        const chainEff = p.chainEfficiency ?? 0.6;
        const beamClr = p.mastery ? '#38bdf8' : '#818cf8'; // tempest: electric cyan-blue
        const beamW   = p.mastery ? 7 : 5;
        while (remaining > 0 && (bi < before.length || ai < after.length)) {
          let nt = null;
          if (turn === 0 && bi < before.length) { nt = before[bi++]; turn = 1; }
          else if (turn === 1 && ai < after.length) { nt = after[ai++]; turn = 0; }
          else if (bi < before.length) { nt = before[bi++]; }
          else { nt = after[ai++]; }
          if (!nt) break;
          p.hits.push(nt);
          const b = getBeam(); b.x1=p.tgt.x*CELL+CELL/2; b.y1=p.tgt.y*CELL+CELL/2; b.x2=nt.x*CELL+CELL/2; b.y2=nt.y*CELL+CELL/2; b.life=10; b.clr=beamClr; b.w=beamW; beams.push(b);
          nt.hp -= Math.floor(p.dmg * chainEff);
          if (p.chainStun && !nt.boss) nt.stunned = Math.max(nt.stunned, p.chainStun);
          if (p.chainSlowAmt && !nt.boss) { nt.slow = Math.max(nt.slow, p.chainSlowAmt); nt.st = Math.max(nt.st, p.chainSlowDur || 30); }
          if (p.chainSparks) spawnChainSparks(particles, nt, CELL);
          remaining--;
        }
        p.chain = 0;
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
      if (p._beeHive && p.tgt.hp <= 0) p._beeHive._beeFrenzyEnd = (state.ticks || 0) + 300; // 5s frenzy
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
