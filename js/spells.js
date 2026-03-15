'use strict';
import { state } from './main.js';
import { iA, sfxNuke, sfxVolcano, sfxFreeze, sfxLaser, sfxHeal, sfxGoldBoost, sfxRage } from './audio.js';
import { SKILLS } from './skills.js';
import { showBanner, panelU } from './ui.js';
import * as api from './api.js';

export const SP = {
  nuke:      { icon:'☢️', cost:200, name:'Nuke' },
  volcano:   { icon:'🌋', cost:150, name:'Volcano' },
  freeze:    { icon:'❄️', cost:120, name:'Freeze' },
  heal:      { icon:'💚', cost:50,  name:'Heal (+3❤️)' },
  goldBoost: { icon:'💎', cost:40,  name:'Gold Boost' },
  lightning: { icon:'⚡', cost:80,  name:'Lightning' },
  rage:      { icon:'🔥', cost:60,  name:'Rage' },
};

export async function castSpell(k) {
  const cost = SKILLS.spellMaster?.owned ? Math.floor(SP[k].cost * 0.75) : SP[k].cost;
  if (state.gold < cost || state.phase !== 'active') return;
  iA();
  try {
    const result = await api.castSpell(k);
    state.gold = result.gold;
    // Server may have updated lives (heal) — sync it
    if (result.effect?.lives != null) state.lives = result.effect.lives;
  } catch (e) {
    console.error('castSpell failed:', e.message); return;
  }
  const { enemies, beams, particles, W, H, CELL, wave } = state;

  if (k === 'nuke') {
    sfxNuke();
    const dmg = 50 + wave * 15;
    enemies.forEach(e => { if (!e.dead) { e.hp -= dmg; for (let i=0;i<4;i++) particles.push({ x:e.x*CELL+CELL/2, y:e.y*CELL+CELL/2, vx:(Math.random()-.5)*6, vy:(Math.random()-.5)*6, life:20, clr:'#f43f5e', sz:3 }); } });
    showBanner('☢️ NUKE!');
  } else if (k === 'volcano') {
    if (state.volcanoActive) return;
    sfxVolcano();
    let vx = Math.floor(state.COLS / 2), vy = Math.floor(state.ROWS / 2);
    if (enemies.length) { vx = Math.round(enemies.reduce((s,e)=>s+e.x,0)/enemies.length); vy = Math.round(enemies.reduce((s,e)=>s+e.y,0)/enemies.length); }
    state.volcanoActive = { x:vx, y:vy, rds:2 };
    showBanner('🌋 Volcano!');
  } else if (k === 'freeze') {
    if (state.freezeActive > 0) return;
    sfxFreeze(); state.freezeActive = 180;
    showBanner('❄️ FREEZE!');
    for (let i=0;i<15;i++) particles.push({ x:Math.random()*W, y:Math.random()*H, vx:(Math.random()-.5)*2, vy:-1-Math.random(), life:25, clr:'#38bdf8', sz:3 });
  } else if (k === 'heal') {
    // lives already synced from server result above
    showBanner('💚 +3 Lives!'); sfxHeal();
  } else if (k === 'goldBoost') {
    // gold already synced from server result above
    showBanner('💎 Gold Boost!'); sfxGoldBoost();
  } else if (k === 'lightning') {
    const alive = enemies.filter(e=>!e.dead).sort((a,b)=>b.hp-a.hp);
    if (alive.length) {
      const t = alive[0]; t.hp -= 40 + wave * 8; t.stunned = 60;
      beams.push({ x1:W/2, y1:0, x2:t.x*CELL+CELL/2, y2:t.y*CELL+CELL/2, life:12, clr:'#fbbf24', w:3 });
      for (let i=0;i<8;i++) particles.push({ x:t.x*CELL+CELL/2, y:t.y*CELL+CELL/2, vx:(Math.random()-.5)*5, vy:(Math.random()-.5)*5, life:15, clr:'#fbbf24', sz:3 });
      sfxLaser();
    }
    showBanner('⚡ Lightning!');
  } else if (k === 'rage') {
    state.towers.forEach(t => { if (t.dmg) t.dmg = Math.ceil(t.dmg * 1.3); if (t.rate) t.rate = Math.max(5, Math.floor(t.rate * 0.8)); });
    showBanner('🔥 RAGE!'); sfxRage();
  }
  state.sel = null; panelU();
}
