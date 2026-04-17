'use strict';
import { state, _ΨΔ } from './main.js';
import { TOWER_SKILLS, TD } from './data.js';

export function renderSk() {
  const c = document.getElementById('skC'); c.innerHTML = '';
  const h = document.createElement('div');
  h.style.cssText = 'color:#94a3b8;font-size:11px;padding:16px 8px;text-align:center';
  h.textContent = 'Tap a tower on the map to upgrade its skills'; c.appendChild(h);
}

export function showTowerSkill(tw) {
  const tree = TOWER_SKILLS[tw.type]; if (!tree) return;
  if (!tw.ownedSkills) tw.ownedSkills = {};
  const el = document.getElementById('skP'); el.classList.add('sh');
  if (!state.researchUnlocks?.tower_skills) {
    const c = document.getElementById('skC'); c.innerHTML = '';
    const msg = document.createElement('div');
    msg.style.cssText = 'color:#94a3b8;font-size:12px;padding:20px 12px;text-align:center;line-height:1.6';
    msg.innerHTML = '🔒 <b>Skills locked</b><br>Research <b>Combat Training</b> to unlock tower upgrades.';
    c.appendChild(msg);
    return;
  }
  const c = document.getElementById('skC'); c.innerHTML = '';
  const h = document.createElement('div');
  h.style.cssText = 'color:var(--accent);font-size:14px;font-weight:800;margin:6px';
  h.textContent = TD[tw.type].icon + ' ' + TD[tw.type].name + ' Skills'; c.appendChild(h);
  const note = document.createElement('div');
  note.style.cssText = 'color:#64748b;font-size:9px;margin-bottom:6px';
  note.textContent = 'A & B are mutually exclusive. Pick C or D (both require A or B). E requires both C and D.'; c.appendChild(note);
  const row = document.createElement('div'); row.className = 'skr';
  for (const [k, sk] of Object.entries(tree)) {
    const owned = !!tw.ownedSkills[k];
    // E skill: only show if both C and D are owned on this tower
    if (sk.req === 'both_cd') {
      if (!tw.ownedSkills['C'] || !tw.ownedSkills['D']) continue;
    }
    const isBlocked = sk.excludes && !!tw.ownedSkills[sk.excludes];
    const needsReq = sk.req === 'any' && !Object.entries(tree).some(([k2, _]) => k2 !== 'C' && k2 !== 'D' && k2 !== 'E' && tw.ownedSkills[k2]);
    const affordable = !isBlocked && !needsReq && !owned &&
      (state.resources?.dust || 0) >= (sk.cost.dust || 0) && state.gold >= (sk.cost.gold || 0);
    const b = document.createElement('div');
    b.className = 'skb' + (owned ? ' owned' : isBlocked ? ' blocked' : affordable ? '' : ' locked');
    const costStr = owned ? 'Owned' : isBlocked ? 'Blocked' : '🔮' + (sk.cost.dust || 0) + (sk.cost.gold ? ' 💰' + sk.cost.gold : '');
    b.innerHTML = '<div class="skn">[' + k + '] ' + (owned ? '✅ ' : '') + sk.name + '</div><div>' + sk.desc + '</div><div class="skc">' + costStr + '</div>';
    if (!owned && !isBlocked && affordable) b.onclick = () => {
      _ΨΔ(() => {
        if (!tw.ownedSkills) tw.ownedSkills = {};
        if ((state.resources?.dust || 0) < (sk.cost.dust || 0) || state.gold < (sk.cost.gold || 0)) return;
        if (sk.cost.dust) state.resources.dust = (state.resources.dust || 0) - sk.cost.dust;
        if (sk.cost.gold) state.gold -= sk.cost.gold;
        tw.ownedSkills[k] = true;
        sk.owned = true; // keep definition in sync for legacy compat
        sk.apply(tw);
      });
      showTowerSkill(tw);
    };
    row.appendChild(b);
  }
  c.appendChild(row);
}
