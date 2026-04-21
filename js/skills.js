'use strict';
import { state, _ΨΔ } from './main.js';
import { TOWER_SKILLS, TD } from './data.js';

const MAX_LEVEL = { squirrel:5, lion:5, penguin:5, fish:5, seahorse:5, lizard:5, heron:5, clown:5 };

// Node positions in the skill canvas
const NODE_R = 24;
const SK_NODES = {
  A: { x: 75,  y: 68  },
  B: { x: 175, y: 68  },
  C: { x: 75,  y: 152 },
  D: { x: 175, y: 152 },
  E: { x: 125, y: 236 },
};
const CV_W = 250, CV_H = 290;

let _skTower = null;
let _skSelected = null;
let _skCanvas = null;

function _ownedSet(tw) {
  return tw.ownedSkills || {};
}

function _nodeVisible(k, tree, tw) {
  const owned = _ownedSet(tw);
  if (k === 'A' || k === 'B') return true;
  if (k === 'C' || k === 'D') return Object.keys(owned).some(ok => ok !== 'C' && ok !== 'D' && ok !== 'E');
  if (k === 'E') {
    const hasCOrD = owned['C'] || owned['D'];
    const maxLvl = MAX_LEVEL[tw.type] ?? 5;
    return !!(hasCOrD && (tw.level || 0) >= maxLvl);
  }
  return false;
}

function _nodeState(k, sk, tw) {
  const owned = _ownedSet(tw);
  if (owned[k]) return 'owned';
  const isBlocked = sk.excludes && !!owned[sk.excludes];
  if (isBlocked) return 'blocked';
  const needsReq = sk.req === 'any' && !Object.entries(TOWER_SKILLS[tw.type] || {}).some(([k2]) => k2 !== 'C' && k2 !== 'D' && k2 !== 'E' && owned[k2]);
  const needsEither = sk.req === 'either_cd' && !owned['C'] && !owned['D'];
  const notMaxLevel = sk.req === 'either_cd' && (tw.level || 0) < (MAX_LEVEL[tw.type] ?? 5);
  if (needsReq || needsEither || notMaxLevel) return 'locked';
  const canPay = (state.resources?.dust || 0) >= (sk.cost?.dust || 0) && state.gold >= (sk.cost?.gold || 0);
  return canPay ? 'available' : 'unavailable';
}

function _drawEdge(ctx, from, to, active) {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y + NODE_R);
  ctx.lineTo(to.x, to.y - NODE_R);
  ctx.strokeStyle = active ? '#4a1d96' : '#1e1e30';
  ctx.lineWidth = active ? 2 : 1.5;
  ctx.stroke();
}

function _drawNode(ctx, k, sk, tw, isSelected) {
  if (!_nodeVisible(k, null, tw)) return;
  const pos = SK_NODES[k];
  const ns = _nodeState(k, sk, tw);
  const isMastery = k === 'E';

  const fills    = { owned:'#0a2d1f', available:'#0d0d2a', blocked:'#200a0a', locked:'#0b0b14', unavailable:'#0d0d1f' };
  const borders  = { owned:'#22c55e', available:'#7c3aed', blocked:'#ef4444', locked:'#2a2a40', unavailable:'#374151' };
  const textClrs = { owned:'#22c55e', available:'#a78bfa', blocked:'#f87171', locked:'#334155', unavailable:'#64748b' };

  ctx.save();
  // Glow for owned/selected
  if (ns === 'owned' || isSelected) {
    ctx.shadowColor = ns === 'owned' ? '#22c55e' : '#7c3aed';
    ctx.shadowBlur = 10;
  }
  // Node circle
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, NODE_R, 0, Math.PI * 2);
  ctx.fillStyle = isMastery ? '#1a1200' : fills[ns];
  ctx.fill();
  ctx.strokeStyle = isSelected ? '#c4b5fd' : (isMastery && ns === 'owned' ? '#f59e0b' : borders[ns]);
  ctx.lineWidth = isSelected ? 2.5 : 2;
  ctx.stroke();
  ctx.restore();

  // Label: skill icon or star for mastery
  ctx.fillStyle = isMastery ? (ns === 'owned' ? '#f59e0b' : '#78580a') : textClrs[ns];
  ctx.font = `bold ${isMastery ? '16px' : '14px'} sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(isMastery ? '⭐' : (sk.icon || k), pos.x, pos.y);

  // Owned checkmark overlay
  if (ns === 'owned') {
    ctx.fillStyle = 'rgba(34,197,94,0.25)';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, NODE_R - 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function _renderSkCanvas(tw) {
  if (!_skCanvas) return;
  const tree = TOWER_SKILLS[tw.type];
  if (!tree) return;
  const ctx = _skCanvas.getContext('2d');
  ctx.clearRect(0, 0, CV_W, CV_H);
  const owned = _ownedSet(tw);

  // Edges first (behind nodes) — only draw from owned nodes
  const ownedA = !!owned.A, ownedB = !!owned.B;
  const ownedC = !!owned.C, ownedD = !!owned.D;
  if (ownedA) { _drawEdge(ctx, SK_NODES.A, SK_NODES.C, true); _drawEdge(ctx, SK_NODES.A, SK_NODES.D, true); }
  if (ownedB) { _drawEdge(ctx, SK_NODES.B, SK_NODES.C, true); _drawEdge(ctx, SK_NODES.B, SK_NODES.D, true); }
  if (_nodeVisible('E', tree, tw)) {
    if (ownedC) _drawEdge(ctx, SK_NODES.C, SK_NODES.E, true);
    if (ownedD) _drawEdge(ctx, SK_NODES.D, SK_NODES.E, true);
  }

  // Nodes
  for (const [k, sk] of Object.entries(tree)) {
    _drawNode(ctx, k, sk, tw, _skSelected === k);
  }
}

function _renderInfo(tw, k) {
  const info = document.getElementById('skInfo');
  if (!info) return;
  const tree = TOWER_SKILLS[tw.type];
  if (!k || !tree?.[k]) { info.innerHTML = ''; return; }
  const sk = tree[k];
  const ns = _nodeState(k, sk, tw);
  const owned = _ownedSet(tw);
  const tree2 = TOWER_SKILLS[tw.type];
  const excIcon = sk.excludes ? (tree2?.[sk.excludes]?.icon || sk.excludes) : '';
  const costStr = owned[k] ? '✅ Owned' : ns === 'blocked' ? '🚫 Blocked (chose ' + excIcon + ')' : ns === 'locked' ? '🔒 Not available yet' : `🔮${sk.cost?.dust||0}${sk.cost?.gold ? ' 💰'+sk.cost.gold : ''}`;
  const canBuy = ns === 'available';
  info.innerHTML = `
    <div style="font-size:12px;font-weight:700;color:#a78bfa;margin-bottom:2px">${k === 'E' ? '⭐' : (sk.icon || k)} ${sk.name}</div>
    <div style="font-size:11px;color:#94a3b8;margin-bottom:4px">${sk.desc}</div>
    <div style="font-size:11px;color:${ns==='owned'?'#22c55e':ns==='blocked'?'#f87171':'#64748b'}">${costStr}</div>
    ${canBuy ? `<button id="skBuyBtn" style="margin-top:6px;padding:3px 10px;background:#1a0a40;border:1px solid #7c3aed;border-radius:4px;color:#a78bfa;cursor:pointer;font-size:11px">Buy</button>` : ''}
  `;
  if (canBuy) {
    document.getElementById('skBuyBtn')?.addEventListener('click', () => {
      _ΨΔ(() => {
        if (!tw.ownedSkills) tw.ownedSkills = {};
        if ((state.resources?.dust || 0) < (sk.cost?.dust || 0) || state.gold < (sk.cost?.gold || 0)) return;
        if (sk.cost?.dust) state.resources.dust = (state.resources.dust || 0) - sk.cost.dust;
        if (sk.cost?.gold) state.gold -= sk.cost.gold;
        tw.ownedSkills[k] = true;
        sk.apply(tw);
      });
      _skSelected = k;
      _renderSkCanvas(tw);
      _renderInfo(tw, k);
    });
  }
}

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
  const c = document.getElementById('skC'); c.innerHTML = '';
  _skTower = tw;

  if (!state.researchUnlocks?.tower_skills) {
    const msg = document.createElement('div');
    msg.style.cssText = 'color:#94a3b8;font-size:12px;padding:20px 12px;text-align:center;line-height:1.6';
    msg.innerHTML = '🔒 <b>Skills locked</b><br>Research <b>Combat Training</b> to unlock tower upgrades.';
    c.appendChild(msg);
    return;
  }

  // Header
  const h = document.createElement('div');
  h.style.cssText = 'color:var(--accent);font-size:13px;font-weight:800;margin:6px 6px 4px';
  h.textContent = TD[tw.type].icon + ' ' + TD[tw.type].name + ' Skills'; c.appendChild(h);

  // Canvas
  const cv = document.createElement('canvas');
  cv.width = CV_W; cv.height = CV_H;
  cv.style.cssText = `width:${CV_W}px;height:${CV_H}px;display:block;margin:0 auto;cursor:pointer`;
  cv.style.maxWidth = '100%';
  c.appendChild(cv);
  _skCanvas = cv;
  _skSelected = null;

  // Info panel below canvas
  const info = document.createElement('div');
  info.id = 'skInfo';
  info.style.cssText = 'padding:6px 10px;min-height:60px;font-size:11px;color:#94a3b8;border-top:1px solid #1e293b;margin-top:4px';
  c.appendChild(info);

  _renderSkCanvas(tw);

  // Hit test
  cv.addEventListener('click', evt => {
    const rect = cv.getBoundingClientRect();
    const scaleX = CV_W / rect.width, scaleY = CV_H / rect.height;
    const mx = (evt.clientX - rect.left) * scaleX;
    const my = (evt.clientY - rect.top)  * scaleY;
    for (const [k] of Object.entries(tree)) {
      if (!_nodeVisible(k, tree, tw)) continue;
      const pos = SK_NODES[k];
      if (Math.hypot(mx - pos.x, my - pos.y) <= NODE_R + 4) {
        _skSelected = (_skSelected === k) ? null : k;
        _renderSkCanvas(tw);
        _renderInfo(tw, _skSelected);
        return;
      }
    }
    _skSelected = null;
    _renderSkCanvas(tw);
    _renderInfo(tw, null);
  });
}
