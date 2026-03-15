'use strict';
import { state } from './main.js';
import { sfxShoot } from './audio.js';

export const TD = {
  squirrel: { name:'Thoughtful Squirrel', icon:'🐿️', clr:'#8b5cf6', cost:40,  dmg:8,  range:3.2, rate:50, pClr:'#a78bfa', pSpd:4,   splash:0,   slow:0,  target:'weakest', cat:'tower', desc:'Long range · targets weakest enemy' },
  lion:     { name:'Rash Lion',           icon:'🦁',  clr:'#ef4444', cost:60,  dmg:15, range:2.0, rate:25, pClr:'#f87171', pSpd:6,   splash:0,   slow:0,  target:'first',   cat:'tower', desc:'Very fast · high single-target DPS' },
  penguin:  { name:'Ambitious Penguin',   icon:'🐧',  clr:'#06b6d4', cost:55,  dmg:5,  range:2.8, rate:35, pClr:'#67e8f9', pSpd:3,   splash:0,   slow:.4, target:'first',   cat:'tower', desc:'Slows enemies on hit' },
  fish:     { name:'Arrogant Fish',       icon:'🐟',  clr:'#f59e0b', cost:75,  dmg:12, range:2.5, rate:60, pClr:'#fcd34d', pSpd:3.5, splash:1.2, slow:0,  target:'first',   cat:'tower', desc:'Splash damage · hits nearby enemies' },
  seahorse: { name:'Insightful Seahorse', icon:'🦑',  clr:'#ec4899', cost:65,  dmg:6,  range:3.5, rate:40, pClr:'#f472b6', pSpd:3,   splash:0,   slow:0,  target:'strongest',pierce:3, cat:'tower', desc:'Piercing shots · passes through enemies' },
  lizard:   { name:'Abhorrent Lizard',    icon:'🦎',  clr:'#84cc16', cost:85,  dmg:45, range:2.5, rate:65, pClr:'#a3e635', pSpd:5,   splash:1.0, slow:0,  target:'first',   speedUp:true, voiceLine:"I DESPISE YOU ALL!", cat:'tower', desc:'Massive damage · splash · speeds up enemies' },
  heron:    { name:'Clever Heron',        icon:'🦩',  clr:'#6366f1', cost:70,  dmg:10, range:3.0, rate:45, pClr:'#818cf8', pSpd:4,   splash:0,   slow:0,  target:'last',    chain:3, cat:'tower', desc:'Chain lightning · hits up to 3 targets' },
};

export const TOWER_SKILLS = {
  squirrel: {
    A: { name:'Piercing Gaze', desc:'Shots pierce 2 enemies',      excludes:'B', cost:1, owned:false, apply:tw=>{ tw.pierce=(tw.pierce||0)+2; } },
    B: { name:'Mind Blast',    desc:'Shots stun for 40 ticks',     excludes:'A', cost:1, owned:false, apply:tw=>{ tw.stun=40; } },
    C: { name:'Wisdom Aura',   desc:'+80% range',                  cost:2, owned:false, req:'any',    apply:tw=>{ tw.range*=1.8; } },
  },
  lion: {
    A: { name:'Frenzy',      desc:'Double shot',                  excludes:'B', cost:1, owned:false, apply:tw=>{ tw.frenzy=true; } },
    B: { name:'Savage Bite', desc:'Triple damage, halve rate',    excludes:'A', cost:1, owned:false, apply:tw=>{ tw.dmg*=3; tw.rate*=2; } },
    C: { name:'Bloodlust',   desc:'Kills heal +1❤️',              cost:2, owned:false, req:'any',    apply:tw=>{ tw.bloodlust=true; } },
  },
  penguin: {
    A: { name:'Avalanche',  desc:'Add splash 1.2',               excludes:'B', cost:1, owned:false, apply:tw=>{ tw.splash=1.2; } },
    B: { name:'Permafrost', desc:'Slow 80%, duration x2',        excludes:'A', cost:1, owned:false, apply:tw=>{ tw.slow=.8; tw.slowDur=160; } },
    C: { name:'Blizzard',   desc:'AoE slow all in range',        cost:2, owned:false, req:'any',    apply:tw=>{ tw.blizzard=true; } },
  },
  fish: {
    A: { name:'Tidal Wave', desc:'Splash radius x2',             excludes:'B', cost:1, owned:false, apply:tw=>{ tw.splash*=2; } },
    B: { name:'Poison',     desc:'DoT 3/tick for 60 ticks',      excludes:'A', cost:1, owned:false, apply:tw=>{ tw.poison={dmg:3,dur:60}; } },
    C: { name:'Tsunami',    desc:'+100% DMG',                    cost:2, owned:false, req:'any',    apply:tw=>{ tw.dmg*=2; } },
  },
  seahorse: {
    A: { name:'Trident',     desc:'Pierce +4',                   excludes:'B', cost:1, owned:false, apply:tw=>{ tw.pierce+=4; } },
    B: { name:'Ink Cloud',   desc:'Hits blind enemies (-50% spd)',excludes:'A', cost:1, owned:false, apply:tw=>{ tw.blind=true; } },
    C: { name:'Deep Insight',desc:'Reveal+target stealth, +range',cost:2, owned:false, req:'any',   apply:tw=>{ tw.range+=2; tw.seeInvis=true; } },
  },
  lizard: {
    A: { name:'Venom Spit', desc:'DoT 5/tick 80 ticks',          excludes:'B', cost:1, owned:false, apply:tw=>{ tw.poison={dmg:5,dur:80}; } },
    B: { name:'Rage Aura',  desc:'Speed-up enemies 2x BUT dmg x3',excludes:'A',cost:1, owned:false, apply:tw=>{ tw.dmg*=3; tw.megaSpeed=true; } },
    C: { name:'Dragon Form',desc:'Splash x2, range +1',          cost:2, owned:false, req:'any',    apply:tw=>{ tw.splash*=2; tw.range+=1; } },
  },
  heron: {
    A: { name:'Storm Chain',   desc:'Chain to 5 targets',        excludes:'B', cost:1, owned:false, apply:tw=>{ tw.chain=5; } },
    B: { name:'Focus Fire',    desc:'No chain, but x4 damage',   excludes:'A', cost:1, owned:false, apply:tw=>{ tw.chain=0; tw.dmg*=4; } },
    C: { name:'Thunderstrike', desc:'Chain hits stun 30 ticks',  cost:2, owned:false, req:'any',    apply:tw=>{ tw.chainStun=30; } },
  },
};

export function updateTowers() {
  const { towers, enemies, projectiles, ticks, wave, CELL, particles } = state;
  towers.forEach(tw => {
    if (tw.type === 'factory' || !TD[tw.type]) return;
    if (tw.disabled && tw.disabledWave === wave) return;
    if (tw.cd > 0) { tw.cd -= (tw._rateBuff < 1 ? 1.2 : 1); return; }
    const def = TD[tw.type];
    const vis = enemies.filter(e => !e.dead && (!e.stealth || tw.seeInvis) && Math.hypot(e.x - tw.x, e.y - tw.y) <= tw.range);
    if (!vis.length) return;
    let tgt;
    if (def.target === 'weakest') tgt = vis.reduce((a,b) => a.hp < b.hp ? a : b);
    else if (def.target === 'strongest') tgt = vis.reduce((a,b) => a.hp > b.hp ? a : b);
    else if (def.target === 'last') tgt = vis.reduce((a,b) => a.pi < b.pi ? a : b);
    else tgt = vis.reduce((a,b) => a.pi > b.pi ? a : b);
    let dmg = tw.dmg; if (tw._buffed) dmg = Math.ceil(dmg * 1.5);
    projectiles.push({ x:tw.x, y:tw.y, tgt, dmg, spd:def.pSpd*0.06, clr:def.pClr, splash:tw.splash, slow:tw.slow, pierce:tw.pierce||0, chain:tw.chain||0, speedUp:def.speedUp, hits:[], stun:tw.stun||0, poison:tw.poison||null, blind:tw.blind, chainStun:tw.chainStun||0, bloodlust:tw.bloodlust });
    tw.cd = tw.rate; sfxShoot();
    if (tw.frenzy && vis.length > 1) {
      const t2 = vis.filter(e => e !== tgt);
      if (t2.length) projectiles.push({ x:tw.x, y:tw.y, tgt:t2[0], dmg, spd:def.pSpd*0.06, clr:def.pClr, splash:tw.splash, slow:tw.slow, pierce:0, chain:0, speedUp:false, hits:[], stun:0, poison:null, blind:false, chainStun:0, bloodlust:tw.bloodlust });
    }
    if (tw.blizzard) vis.forEach(e => { e.slow = Math.max(e.slow, tw.slow); e.st = 80; });
    if (def.speedUp) vis.forEach(e => {
      if (!e.spdBuff) e.spdBuff = tw.megaSpeed ? 2 : 1;
      if (ticks % 12 === 0) particles.push({ x:e.x*CELL+CELL/2, y:e.y*CELL+CELL/2, vx:(Math.random()-.5)*2, vy:-1.5, life:10, clr:'#a3e635', sz:2 });
    });
  });
}
