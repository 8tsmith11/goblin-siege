'use strict';
import { state, _ΨΔ } from './main.js';
import { TOWER_SKILLS, TD } from './data.js';

export const SKILLS = {
  sharpShot:     { name:'Sharp Shot',      desc:'+20% all tower DMG',       cost:1, tier:1, owned:false },
  thickWalls:    { name:'Thick Walls',     desc:'+5 lives',                 cost:1, tier:1, owned:false },
  goldRush:      { name:'Gold Rush',       desc:'+30% factory income',      cost:1, tier:1, owned:false },
  quickDraw:     { name:'Quick Draw',      desc:'-15% tower cooldowns',     cost:1, tier:1, owned:false },
  spellMaster:   { name:'Spell Master',    desc:'-25% spell costs',         cost:1, tier:1, owned:false },
  beeKeeper:     { name:'Bee Keeper',      desc:'+2 bees per hive',         cost:2, tier:2, owned:false },
  doomCannon:    { name:'Doom Laser',      desc:'Factory lasers x2 dmg',   cost:2, tier:2, owned:false },
  greed:         { name:'Greed',           desc:'+3 gold per kill',         cost:2, tier:2, owned:false },
  clownMaster:   { name:'Clown Master',    desc:'Clown reverse lasts 2x',   cost:2, tier:2, owned:false },
  robotOverclock:{ name:'Robot Overclock', desc:'AI casts spells 2x fast',  cost:3, tier:3, owned:false },
  megaFactory:   { name:'Mega Factory',    desc:'Factories +50% income',    cost:3, tier:3, owned:false },
};

function t1c() { return Object.values(SKILLS).filter(s => s.tier === 1 && s.owned).length; }
function t2c() { return Object.values(SKILLS).filter(s => s.tier === 2 && s.owned).length; }

export function canBuyS(s) {
  if (s.owned || state.skillPts < s.cost) return false;
  if (s.tier === 2 && t1c() < 2) return false;
  if (s.tier === 3 && t2c() < 2) return false;
  return true;
}

export function buyS(k) {
  const s = SKILLS[k];
  if (!canBuyS(s)) return;
  _ΨΔ(() => {
    state.skillPts -= s.cost;
    s.owned = true;
    if (k === 'thickWalls') state.lives += 5;
    if (k === 'sharpShot') state.towers.forEach(t => { if (t.dmg) t.dmg = Math.ceil(t.dmg * 1.2); });
    if (k === 'quickDraw') state.towers.forEach(t => { if (t.rate) t.rate = Math.max(5, Math.floor(t.rate * 0.85)); });
  });
  renderSk();
}

export function renderSk() {
  const c = document.getElementById('skC'); c.innerHTML = '';
  const h = document.createElement('div');
  h.style.cssText = 'color:#a78bfa;font-size:11px;font-weight:800;margin:4px 0';
  h.textContent = '— PLAYER SKILLS (⚡' + state.skillPts + ') —'; c.appendChild(h);
  for (const tier of [1, 2, 3]) {
    const lb = document.createElement('div');
    lb.style.cssText = 'color:#475569;font-size:8px;margin:3px 0';
    lb.textContent = 'Tier ' + tier + (tier > 1 ? ' (need 2× prev tier)' : ''); c.appendChild(lb);
    const row = document.createElement('div'); row.className = 'skr';
    for (const [k, s] of Object.entries(SKILLS)) {
      if (s.tier !== tier) continue;
      const b = document.createElement('div');
      b.className = 'skb' + (s.owned ? ' owned' : canBuyS(s) ? '' : ' locked');
      b.innerHTML = '<div class="skn">' + (s.owned ? '✅ ' : '') + s.name + '</div><div>' + s.desc + '</div><div class="skc">' + (s.owned ? 'Owned' : '⚡' + s.cost) + '</div>';
      if (!s.owned && canBuyS(s)) b.onclick = () => buyS(k);
      row.appendChild(b);
    }
    c.appendChild(row);
  }
  const h2 = document.createElement('div');
  h2.style.cssText = 'color:#f43f5e;font-size:11px;font-weight:800;margin:8px 0 4px';
  h2.textContent = '— TOWER SKILLS (tap tower → Skill) —'; c.appendChild(h2);
  const note = document.createElement('div');
  note.style.cssText = 'color:#475569;font-size:8px;margin-bottom:4px';
  note.textContent = 'A & B are mutually exclusive. C requires either A or B.'; c.appendChild(note);
}

export function showTowerSkill(tw) {
  const tree = TOWER_SKILLS[tw.type]; if (!tree) return;
  const el = document.getElementById('skP'); el.classList.add('sh');
  const c = document.getElementById('skC'); c.innerHTML = '';
  const h = document.createElement('div');
  h.style.cssText = 'color:var(--accent);font-size:14px;font-weight:800;margin:6px';
  h.textContent = TD[tw.type].icon + ' ' + TD[tw.type].name + ' Skills'; c.appendChild(h);
  const note = document.createElement('div');
  note.style.cssText = 'color:#64748b;font-size:9px;margin-bottom:6px';
  note.textContent = '⚡ ' + state.skillPts + ' pts · A & B are exclusive · C needs A or B'; c.appendChild(note);
  const row = document.createElement('div'); row.className = 'skr';
  for (const [k, sk] of Object.entries(tree)) {
    const isBlocked = sk.excludes && tree[sk.excludes]?.owned;
    const needsReq = sk.req === 'any' && !Object.entries(tree).some(([k2, s2]) => k2 !== 'C' && s2.owned);
    const b = document.createElement('div');
    b.className = 'skb' + (sk.owned ? ' owned' : isBlocked ? ' blocked' : (state.skillPts >= sk.cost && !needsReq) ? '' : ' locked');
    b.innerHTML = '<div class="skn">[' + k + '] ' + (sk.owned ? '✅ ' : '') + sk.name + '</div><div>' + sk.desc + '</div><div class="skc">' + (sk.owned ? 'Owned' : isBlocked ? 'Blocked' : '⚡' + sk.cost) + '</div>';
    if (!sk.owned && !isBlocked && state.skillPts >= sk.cost && !needsReq) b.onclick = () => {
      _ΨΔ(() => { state.skillPts -= sk.cost; sk.owned = true; sk.apply(tw); });
      showTowerSkill(tw);
    };
    row.appendChild(b);
  }
  c.appendChild(row);
}
