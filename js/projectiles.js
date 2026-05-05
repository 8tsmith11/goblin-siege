import { state, _ΨΔ } from './main.js';
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

    // ── Web shot: fly toward target tile, spawn webs on arrival ──────────────
    if (p.webShot) {
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
      if (d < p.spd) {
        const cx = Math.round(p.tx - 0.5), cy = Math.round(p.ty - 0.5);
        if (!state.webs) state.webs = [];
        const webTiles = state.path.filter(pt => Math.abs(pt.x - cx) + Math.abs(pt.y - cy) <= 1).slice(0, p.count);
        for (const pt of webTiles) state.webs.push({ x: pt.x, y: pt.y, expiry: 9999999, dmg: p.webDmg || 0, slow: p.webSlow || 0.6, stun: p.webStun || 0 });
        for (let j = 0; j < 6; j++) particles.push({ x: p.tx * CELL, y: p.ty * CELL, vx: (Math.random()-0.5)*3, vy: (Math.random()-0.5)*3, life: 14, clr: '#c4b5fd', sz: 2 });
        projectiles.splice(i, 1);
      } else {
        p.x += dx / d * p.spd;
        p.y += dy / d * p.spd;
      }
      continue;
    }

    // ── Pierce: straight-line movement ───────────────────────────────────────
    if (p.pierceDir) {
      // Despawn if traveled beyond pierce range
      const traveled = Math.hypot(p.x - p.startX, p.y - p.startY);
      if (traveled > (p.pierceRange || 6)) { freeProj(p); projectiles.splice(i, 1); continue; }
      if (p.pierce <= 0) { freeProj(p); projectiles.splice(i, 1); continue; }

      // Move in fixed direction
      p.x += p.pierceDir.x * p.spd;
      p.y += p.pierceDir.y * p.spd;

      // Hit enemies in proximity
      for (const e of enemies) {
        if (e.dead || p.hits.includes(e)) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) >= 0.45) continue;
        let dmg = p.dmg;
        if (p.brittleIce && e.slow > 0) dmg = Math.round(dmg * 1.8);
        e.hp -= dmg; sfxHit();
        mkF(e.x * CELL + CELL / 2, e.y * CELL + CELL / 2, dmg, '#fbbf24');
        if (p.slow > 0) { e.slow = Math.max(e.slow, p.slow); e.st = 80; if (p.lingeringChill && !e._permSlow) e._permSlow = e.slow * 0.25; }
        if (p.stun > 0 && !e.boss) e.stunned = Math.max(e.stunned, p.stun);
        if (p.blind) e.slow = Math.max(e.slow, 0.5);
        if (p.poison) e.poison = { dmg: p.poison.dmg, dur: p.poison.dur };
        if (p.bloodlust && e.hp <= 0) _ΨΔ(() => { state.lives = Math.min(state.maxLives || 30, state.lives + 1); });
        p.hits.push(e);
        p.pierce--;
        for (let j = 0; j < 3; j++) {
          let np = getP(); np.x = e.x*CELL+CELL/2; np.y = e.y*CELL+CELL/2;
          np.vx = (Math.random()-0.5)*3; np.vy = (Math.random()-0.5)*3; np.life = 8; np.clr = p.clr; np.sz = 2;
          particles.push(np);
        }
        if (p.pierce <= 0) break;
      }
      // Trail particles
      if (ticks % 3 === 0) {
        let np = getP(); np.x = p.x*CELL+CELL/2; np.y = p.y*CELL+CELL/2;
        np.vx = 0; np.vy = 0; np.life = 6; np.clr = p.clr+'66'; np.sz = 1.5; particles.push(np);
      }
      continue;
    }

    // ── Standard projectile ───────────────────────────────────────────────────
    if (p.tgt.dead && !p.chain) { freeProj(p); projectiles.splice(i, 1); continue; }
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
      if (p.stun > 0 && !p.tgt.boss) p.tgt.stunned = Math.max(p.tgt.stunned, p.stun);
      if (p.blind) p.tgt.slow = Math.max(p.tgt.slow, 0.5);
      if (p.poison) p.tgt.poison = { dmg: p.poison.dmg, dur: p.poison.dur };
      if (p.splash > 0) {
        enemies.forEach(e => { if (e !== p.tgt && !e.dead && Math.hypot(e.x - p.tgt.x, e.y - p.tgt.y) <= p.splash) e.hp -= Math.floor(p.dmg * 0.5); });
      }
      // Abhorrent Ambush: if assault shot, keep stealth if target died
      if (p._assaultTower) {
        p._assaultTower._assaultReady = (p.tgt.hp <= 0);
      }
      if (p.chain > 0) {
        // Initial beam: from tower position to primary target
        const beamClr = p.tempest ? '#e8e8e8' : '#818cf8';
        const beamW   = p.tempest ? 7 : 2;
        const ib = getBeam();
        ib.x1 = p.twX * CELL + CELL / 2; ib.y1 = p.twY * CELL + CELL / 2;
        ib.x2 = p.tgt.x * CELL + CELL / 2; ib.y2 = p.tgt.y * CELL + CELL / 2;
        ib.life = 10; ib.clr = beamClr; ib.w = beamW; beams.push(ib);

        // Sequential chain: each target must be within chainRange of previous
        let prevTarget = p.tgt;
        let remaining = p.chain;
        const chainEff = p.chainEfficiency ?? 0.6;
        const chainRange = p.chainRange || 1;
        while (remaining > 0) {
          const unchained = enemies.filter(e => !e.dead && e !== prevTarget && !p.hits.includes(e));
          // Find nearest enemy within chainRange of prevTarget
          let best = null, bestDist = Infinity;
          for (const e of unchained) {
            const cd = Math.hypot(e.x - prevTarget.x, e.y - prevTarget.y);
            if (cd <= chainRange && cd < bestDist) { best = e; bestDist = cd; }
          }
          if (!best) break;
          p.hits.push(best);
          const b = getBeam();
          b.x1 = prevTarget.x * CELL + CELL / 2; b.y1 = prevTarget.y * CELL + CELL / 2;
          b.x2 = best.x * CELL + CELL / 2; b.y2 = best.y * CELL + CELL / 2;
          b.life = 10; b.clr = beamClr; b.w = beamW; beams.push(b);
          best.hp -= Math.floor(p.dmg * chainEff);
          if (p.chainStun && !best.boss) best.stunned = Math.max(best.stunned, p.chainStun);
          if (p.chainSlowAmt && !best.boss) { best.slow = Math.max(best.slow, p.chainSlowAmt); best.st = Math.max(best.st, p.chainSlowDur || 30); }
          if (p.chainSparks) spawnChainSparks(particles, best, CELL);
          prevTarget = best;
          remaining--;
        }
        p.chain = 0;
      }
      for (let j = 0; j < 4; j++) {
        let np = getP();
        np.x = p.tgt.x*CELL+CELL/2; np.y = p.tgt.y*CELL+CELL/2;
        np.vx = (Math.random()-0.5)*3; np.vy = (Math.random()-0.5)*3;
        np.life = 10; np.clr = p.clr; np.sz = 2;
        particles.push(np);
      }
      if (p.bloodlust && p.tgt.hp <= 0) _ΨΔ(() => { state.lives = Math.min(state.maxLives || 30, state.lives + 1); });
      if (p._beeHive && p.tgt.hp <= 0 && !(p._beeHive._beeFrenzyEnd > state.ticks)) p._beeHive._beeFrenzyEnd = (state.ticks || 0) + 120;
      freeProj(p); projectiles.splice(i, 1);
    } else {
      p.x += dx / d * p.spd; p.y += dy / d * p.spd;
      if (p.chain <= 0 && ticks % 3 === 0) {
         let np = getP();
         np.x = p.x*CELL+CELL/2; np.y = p.y*CELL+CELL/2;
         np.vx = 0; np.vy = 0; np.life = 6; np.clr = p.clr+'66'; np.sz = 1.5;
         particles.push(np);
      }
    }
  }
}
