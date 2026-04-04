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
  const el = document.getElementById('skP'); el.classList.add('sh');
  const c = document.getElementById('skC'); c.innerHTML = '';
  const h = document.createElement('div');
  h.style.cssText = 'color:var(--accent);font-size:14px;font-weight:800;margin:6px';
  h.textContent = TD[tw.type].icon + ' ' + TD[tw.type].name + ' Skills'; c.appendChild(h);
  const note = document.createElement('div');
  note.style.cssText = 'color:#64748b;font-size:9px;margin-bottom:6px';
  note.textContent = 'A & B are mutually exclusive. Pick C or D (both require A or B).'; c.appendChild(note);
  const row = document.createElement('div'); row.className = 'skr';
  for (const [k, sk] of Object.entries(tree)) {
    const isBlocked = sk.excludes && tree[sk.excludes]?.owned;
    const needsReq = sk.req === 'any' && !Object.entries(tree).some(([k2, s2]) => k2 !== 'C' && k2 !== 'D' && s2.owned);
    const affordable = !isBlocked && !needsReq &&
      (state.resources?.dust || 0) >= (sk.cost.dust || 0) && state.gold >= (sk.cost.gold || 0);
    const b = document.createElement('div');
    b.className = 'skb' + (sk.owned ? ' owned' : isBlocked ? ' blocked' : affordable ? '' : ' locked');
    const costStr = sk.owned ? 'Owned' : isBlocked ? 'Blocked' : '🔮' + (sk.cost.dust || 0) + ' 💰' + (sk.cost.gold || 0);
    b.innerHTML = '<div class="skn">[' + k + '] ' + (sk.owned ? '✅ ' : '') + sk.name + '</div><div>' + sk.desc + '</div><div class="skc">' + costStr + '</div>';
    if (!sk.owned && !isBlocked && affordable) b.onclick = () => {
      _ΨΔ(() => {
        if ((state.resources?.dust || 0) < (sk.cost.dust || 0) || state.gold < (sk.cost.gold || 0)) return;
        if (sk.cost.dust) state.resources.dust = (state.resources.dust || 0) - sk.cost.dust;
        if (sk.cost.gold) state.gold -= sk.cost.gold;
        sk.owned = true;
        for (const t of state.towers) { if (t.type === tw.type) sk.apply(t); }
      });
      showTowerSkill(tw);
    };
    row.appendChild(b);
  }
  c.appendChild(row);
}
