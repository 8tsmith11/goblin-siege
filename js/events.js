'use strict';
import { state, fIncome, _ΨΔ } from './main.js';
import { ETYPES, mkE } from './enemies.js';
import { sfxEvent } from './audio.js';

export const EVENTS = [
  { name:'💰 Gold Rush!',      desc:'+50 gold',                  good:true,  fn:()=>{ state.gold += 50; } },
  { name:'❤️ Reinforcements!', desc:'+3 lives',                  good:true,  fn:()=>{ state.lives += 3; } },
  { name:'⚡ Power Surge!',    desc:'All towers +5 DMG this wave',good:true,  fn:()=>{ state.towers.forEach(t=>{ if(t.dmg) t.dmg += 5; }); } },
  { name:'🏭 Overtime!',       desc:'Double factory income',      good:true,  fn:()=>{ state.gold += fIncome(); } },
  { name:'🐝 Bee Frenzy!',     desc:'All bees fire 2x fast',      good:true,  fn:()=>{ state.bees.forEach(b=>{ b.rate = Math.max(5, Math.floor(b.rate * 0.5)); }); } },
  { name:'💀 Goblin Ambush!',  desc:'5 fast goblins spawn!',      good:false, fn:()=>{ for(let i=0;i<5;i++){ const e=mkE(ETYPES.fast, 20+state.wave*18, 0.6+state.wave*0.035); e.x=state.path[0].x; e.y=state.path[0].y; state.enemies.push(e); } } },
  { name:'🌑 Darkness!',       desc:'All stealth for 3 sec',      good:false, fn:()=>{ state.enemies.forEach(e=>{ e.stealth=true; e.stealthTimer=180; }); } },
  { name:'💸 Tax Collector!',  desc:'-30 gold',                   good:false, fn:()=>{ state.gold = Math.max(0, state.gold - 30); } },
  { name:'🔥 Wildfire!',       desc:'Random tower disabled 1 wave',good:false, fn:()=>{ const t=state.towers.filter(t=>t.type!=='factory'); if(t.length){ const r=t[Math.floor(Math.random()*t.length)]; r.disabled=true; r.disabledWave=state.wave; } } },
  { name:'⚡ Skill Point!',    desc:'+1 free skill point',        good:true,  fn:()=>{ state.skillPts++; } },
];

export function triggerEvent() {
  const ev = EVENTS[Math.floor(Math.random() * EVENTS.length)];
  _ΨΔ(() => ev.fn()); sfxEvent();
  const el = document.getElementById('evBanner');
  el.innerHTML = (ev.good ? '🎉' : '⚠️') + ' <b>' + ev.name + '</b><br>' + ev.desc;
  el.style.borderColor = ev.good ? '#22c55e' : '#ef4444';
  el.classList.add('sh');
  setTimeout(() => el.classList.remove('sh'), 3000);
}
