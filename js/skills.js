'use strict';
import { state, _ΨΔ } from './main.js';
import { TOWER_SKILLS, TD } from './data.js';

// Max level per tower type (must match TOWER_UPGS in ui-tower.js)
const MAX_LEVEL = { squirrel:5, lion:5, penguin:5, fish:5, seahorse:5, lizard:5, heron:5, clown:5 };

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
  note.textContent = 'A & B are mutually exclusive. C or D requires A or B. Mastery (E) requires C or D + max level.'; c.appendChild(note);
  const row = document.createElement('div'); row.className = 'skr';
  const maxLvl = MAX_LEVEL[tw.type] ?? 5;
  for (const [k, sk] of Object.entries(tree)) {
    const owned = !!tw.ownedSkills[k];
    if (sk.req === 'either_cd') {
      if (!tw.ownedSkills['C'] && !tw.ownedSkills['D']) continue;
      if ((tw.level || 0) < maxLvl) continue; // mastery needs max level
    }
    const isBlocked = sk.excludes && !!tw.ownedSkills[sk.excludes];
    const needsReq = sk.req === 'any' && !Object.entries(tree).some(([k2]) => k2 !== 'C' && k2 !== 'D' && k2 !== 'E' && tw.ownedSkills[k2]);
    const affordable = !isBlocked && !needsReq && !owned &&
      (state.resources?.dust || 0) >= (sk.cost.dust || 0) && state.gold >= (sk.cost.gold || 0);
    const b = document.createElement('div');
    const isMastery = k === 'E';
    if (isMastery) {
      b.className = 'skb' + (owned ? ' owned' : affordable ? '' : ' locked');
      b.style.cssText = 'background:linear-gradient(135deg,#1a1200,#2a1f00);border:2px solid ' + (owned ? '#f59e0b' : '#78580a') + ';position:relative;overflow:hidden';
      const shimmer = document.createElement('div');
      shimmer.style.cssText = 'position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(245,158,11,.07),transparent);pointer-events:none';
      b.appendChild(shimmer);
    } else {
      b.className = 'skb' + (owned ? ' owned' : isBlocked ? ' blocked' : affordable ? '' : ' locked');
    }
    const costStr = owned ? 'Owned' : isBlocked ? 'Blocked' : '🔮' + (sk.cost.dust || 0) + (sk.cost.gold ? ' 💰' + sk.cost.gold : '');
    const label = isMastery
      ? '<div class="skn" style="color:#f59e0b;font-size:11px">⭐ ' + (owned ? '✅ ' : '') + sk.name + '</div>'
      : '<div class="skn">[' + k + '] ' + (owned ? '✅ ' : '') + sk.name + '</div>';
    const inner = document.createElement('div');
    inner.innerHTML = label + '<div style="' + (isMastery ? 'color:#fde68a;font-size:10px' : '') + '">' + sk.desc + '</div><div class="skc" style="' + (isMastery ? 'color:#f59e0b' : '') + '">' + costStr + '</div>';
    b.appendChild(inner);
    if (!owned && !isBlocked && affordable) b.onclick = () => {
      _ΨΔ(() => {
        if (!tw.ownedSkills) tw.ownedSkills = {};
        if ((state.resources?.dust || 0) < (sk.cost.dust || 0) || state.gold < (sk.cost.gold || 0)) return;
        if (sk.cost.dust) state.resources.dust = (state.resources.dust || 0) - sk.cost.dust;
        if (sk.cost.gold) state.gold -= sk.cost.gold;
        tw.ownedSkills[k] = true;
        sk.owned = true;
        sk.apply(tw);
      });
      showTowerSkill(tw);
    };
    row.appendChild(b);
  }
  c.appendChild(row);
}
