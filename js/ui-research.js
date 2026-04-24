'use strict';
import { state } from './main.js';
import { canAfford, spendResources, layoutNodes, UNLOCK_DESC, checkGamePrereq, applyUnlock, refreshStatuses, RESEARCH_JSON, FIXED_RESEARCH, VARIABLE_RESEARCH } from './research.js';
import { hudU, syncPause } from './ui.js';
import { TRANSLATIONS } from './bestiary.js';

const RES_ICONS = { dust: '🔮', stone: '🪨', wood: '🪵', flint: '🗿' };
const NODE_R = 22;
let _rPos = null;
const _rCam = { panX: 0, panY: 0, zoom: 1 };
const R_ZOOM_MIN = 0.4, R_ZOOM_MAX = 3;
let _openNodeId = null;
let _resView = 'web'; // 'web' | 'translations'

const RES_GRID_STEP = () => RESEARCH_JSON?.gridStep ?? 120;

function fmtCost(cost) {
  return Object.entries(cost).map(([r, n]) => (RES_ICONS[r] || r) + n).join(' ');
}

function isNodeVisible(node) {
  if (!node.hidden) return true;
  return state.bSen?.has(node.trigger);
}

function shouldShowNode(id, nodes) {
  const node = nodes[id];
  if (!node) return false;
  if (node.hidden && !state.bSen?.has(node.trigger)) return false;
  if (!checkGamePrereq(node)) return false;
  return node.prereqs.every(p => nodes[p]?.status !== 'locked');
}

function clampResCam(W, H) {
  if (!_rPos) return;
  const { zoom } = _rCam;
  const xs = Object.values(_rPos).map(p => p.x);
  const ys = Object.values(_rPos).map(p => p.y);
  const pad = NODE_R + 30;
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad + 20;
  const margin = 40;
  _rCam.panX = Math.max(margin - maxX * zoom, Math.min(W - margin - minX * zoom, _rCam.panX));
  _rCam.panY = Math.max(margin - maxY * zoom, Math.min(H - margin - minY * zoom, _rCam.panY));
}

function toWorld(sx, sy) {
  return { x: (sx - _rCam.panX) / _rCam.zoom, y: (sy - _rCam.panY) / _rCam.zoom };
}

function renderResearch() {
  const nodes = state.research;
  if (!nodes) return;
  const cv = document.getElementById('resCv');
  if (!cv) return;
  const cx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  if (!W || !H) return;
  if (!_rPos) _rPos = layoutNodes(nodes, W, H);
  cx.clearRect(0, 0, W, H);

  cx.save();
  cx.translate(_rCam.panX, _rCam.panY);
  cx.scale(_rCam.zoom, _rCam.zoom);

  for (const [id, node] of Object.entries(nodes)) {
    if (!shouldShowNode(id, nodes)) continue;
    const to = _rPos[id];
    if (!to) continue;
    for (const pid of node.prereqs) {
      if (!shouldShowNode(pid, nodes)) continue;
      const from = _rPos[pid];
      if (!from) continue;
      const complete = nodes[pid]?.status === 'complete';
      cx.strokeStyle = complete ? '#3b1878' : '#1e1e2e';
      cx.lineWidth = 1.5 / _rCam.zoom;
      cx.beginPath(); cx.moveTo(from.x, from.y); cx.lineTo(to.x, to.y); cx.stroke();
    }
  }

  for (const [id, node] of Object.entries(nodes)) {
    if (!shouldShowNode(id, nodes)) continue;
    const pos = _rPos[id];
    if (!pos) continue;
    const visible = isNodeVisible(node);
    const { status } = node;

    cx.beginPath(); cx.arc(pos.x, pos.y, NODE_R, 0, Math.PI * 2);
    if (status === 'complete') cx.fillStyle = '#0a2d1f';
    else if (status === 'active') cx.fillStyle = '#1a0a40';
    else if (status === 'available') cx.fillStyle = '#0d0d1f';
    else cx.fillStyle = '#0b0b14';
    cx.fill();

    if (status === 'active') {
      const pct = 1 - node.wavesLeft / node.wavesTotal;
      cx.beginPath();
      cx.moveTo(pos.x, pos.y);
      cx.arc(pos.x, pos.y, NODE_R, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
      cx.closePath();
      cx.fillStyle = 'rgba(124,58,237,0.35)';
      cx.fill();
    }

    cx.beginPath(); cx.arc(pos.x, pos.y, NODE_R, 0, Math.PI * 2);
    const isSelected = id === _pinnedNodeId;
    if (isSelected)            { cx.strokeStyle = '#c4b5fd'; cx.lineWidth = 2.5 / _rCam.zoom; }
    else if (status === 'complete')  { cx.strokeStyle = '#22c55e'; cx.lineWidth = 2 / _rCam.zoom; }
    else if (status === 'active')    { cx.strokeStyle = '#a78bfa'; cx.lineWidth = 2 / _rCam.zoom; }
    else if (status === 'available') { cx.strokeStyle = '#7c3aed'; cx.lineWidth = 1.5 / _rCam.zoom; }
    else                             { cx.strokeStyle = '#1e1e30'; cx.lineWidth = 1 / _rCam.zoom; }
    cx.stroke();

    cx.font = '14px serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    if (!visible) { cx.fillStyle = '#4b5563'; cx.fillText('?', pos.x, pos.y); }
    else {
      cx.globalAlpha = status === 'locked' ? 0.35 : 1;
      cx.fillText(node.icon, pos.x, pos.y);
      cx.globalAlpha = 1;
    }

    if (status === 'complete') {
      cx.font = 'bold 10px sans-serif'; cx.fillStyle = '#22c55e';
      cx.fillText('✓', pos.x + NODE_R - 7, pos.y - NODE_R + 7);
    }

    cx.font = '9px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'top';
    cx.fillStyle = !visible ? '#374151' : status === 'locked' ? '#374151' : status === 'complete' ? '#22c55e' : '#94a3b8';
    const label = visible ? node.name : '???';
    if (label.length > 14) {
      const mid = label.lastIndexOf(' ', Math.floor(label.length / 2) + 4);
      const l1 = mid > 0 ? label.slice(0, mid) : label.slice(0, 12);
      const l2 = mid > 0 ? label.slice(mid + 1) : label.slice(12);
      cx.fillText(l1, pos.x, pos.y + NODE_R + 2);
      cx.fillText(l2, pos.x, pos.y + NODE_R + 12);
    } else {
      cx.fillText(label, pos.x, pos.y + NODE_R + 2);
    }
  }

  cx.restore();

  if (state._devMode && _pinnedNodeId && _rPos?.[_pinnedNodeId]) {
    const pp = _rPos[_pinnedNodeId];
    const step = RES_GRID_STEP();
    const sx = pp.x * _rCam.zoom + _rCam.panX;
    const sy = pp.y * _rCam.zoom + _rCam.panY;
    cx.save();
    cx.font = 'bold 10px monospace'; cx.textAlign = 'center'; cx.textBaseline = 'bottom';
    cx.fillStyle = '#fbbf24';
    cx.fillText(`⬆⬇⬅➡  (${pp.x / step},${pp.y / step})`, sx, sy - NODE_R * _rCam.zoom - 4);
    cx.restore();
  }
}

let _pinnedNodeId = null;

function hideResTip() {
  _openNodeId = null;
  _pinnedNodeId = null;
  const tip = document.getElementById('resTip');
  if (tip) { tip.classList.remove('sh'); tip.innerHTML = ''; }
}

function positionResTip(tip, nodeId) {
  const pos = _rPos?.[nodeId];
  const cv = document.getElementById('resCv');
  if (!pos || !cv) return;
  const nodeCSS_x = pos.x * _rCam.zoom + _rCam.panX;
  const nodeCSS_y = pos.y * _rCam.zoom + _rCam.panY;
  const nodeR_css = NODE_R * _rCam.zoom;
  const TIP_W = 180, wrapW = cv.clientWidth, wrapH = cv.clientHeight;
  let left = nodeCSS_x + nodeR_css + 8;
  if (left + TIP_W > wrapW - 4) left = nodeCSS_x - nodeR_css - TIP_W - 8;
  left = Math.max(4, left);
  const h = tip.offsetHeight || 90;
  const top = Math.max(4, Math.min(wrapH - h - 4, nodeCSS_y - h / 2));
  tip.style.left = left + 'px';
  tip.style.top = top + 'px';
}

function showResearchDetail(id) {
  const nodes = state.research;
  if (!nodes || !nodes[id]) return;
  const node = nodes[id];
  const visible = isNodeVisible(node);
  const tip = document.getElementById('resTip');
  if (!tip) return;

  tip.innerHTML = '';

  if (!visible) {
    const s = document.createElement('span'); s.className = 'rdlocked'; s.textContent = '??? — conditions not yet met';
    tip.appendChild(s);
  } else {
    const nm = document.createElement('span'); nm.className = 'rdname'; nm.textContent = node.icon + ' ' + node.name;
    tip.appendChild(nm);

    const unlockText = UNLOCK_DESC[node.unlocks] || node.unlocks || '';
    if (unlockText) {
      const d = document.createElement('span');
      if (node.status === 'complete') {
        d.className = 'rddone'; d.textContent = '✓ ' + unlockText;
      } else {
        d.className = 'rddesc'; d.textContent = unlockText;
      }
      tip.appendChild(d);
    }

    if (node.status === 'locked') {
      const prereqNames = node.prereqs.map(p => nodes[p]?.name || p).join(', ');
      const s = document.createElement('span'); s.className = 'rdlocked'; s.textContent = '🔒 ' + prereqNames;
      tip.appendChild(s);
    } else if (node.status === 'available') {
      const c = document.createElement('span'); c.className = 'rdcost';
      c.textContent = fmtCost(node.cost) + ' · ⏱ ' + node.wavesTotal + ' wave' + (node.wavesTotal !== 1 ? 's' : '');
      tip.appendChild(c);
      const hasActive = Object.values(nodes).some(n => n.status === 'active');
      const affordable = canAfford(node.cost);
      const devMode = !!state._devMode;
      const btn = document.createElement('button'); btn.className = 'rdbtn';
      btn.textContent = devMode ? '⚡ Instant (Dev)' : 'Begin Research';
      if (!devMode) {
        btn.disabled = hasActive || !affordable;
        if (hasActive) btn.title = 'Research already in progress';
        else if (!affordable) btn.title = 'Not enough resources';
      }
      btn.onclick = () => {
        if (devMode) {
          node.status = 'complete'; node.wavesLeft = 0;
          applyUnlock(node); refreshStatuses(nodes);
        } else {
          spendResources(node.cost);
          node.status = 'active';
        }
        renderResearch();
        showResearchDetail(id);
        hudU();
      };
      tip.appendChild(btn);
    } else if (node.status === 'active') {
      const s = document.createElement('span'); s.className = 'rdprog';
      s.textContent = '⏳ ' + node.wavesLeft + ' wave' + (node.wavesLeft !== 1 ? 's' : '') + ' left';
      tip.appendChild(s);
    }
    if (node.tooltip) {
      const t = document.createElement('span'); t.className = 'rdtooltip'; t.textContent = node.tooltip;
      tip.appendChild(t);
    }
  }

  _openNodeId = id;
  tip.classList.add('sh');
  positionResTip(tip, id);
  requestAnimationFrame(() => positionResTip(tip, id));
}

function fitResCv() {
  const cv = document.getElementById('resCv');
  if (!cv || !state.research) return;
  cv.width = cv.clientWidth || 520;
  cv.height = cv.clientHeight || 280;
  if (!_rPos) {
    _rPos = layoutNodes(state.research, cv.width, cv.height);
    const rootId = Object.keys(state.research).find(id => state.research[id].prereqs.length === 0 && _rPos[id]);
    _rCam.zoom = 1;
    if (rootId) {
      _rCam.panX = cv.width / 2 - _rPos[rootId].x;
      _rCam.panY = cv.height / 2 - _rPos[rootId].y;
    } else {
      _rCam.panX = 0; _rCam.panY = 0;
    }
  }
  clampResCam(cv.width, cv.height);
  renderResearch();
}

function renderTranslations() {
  const el = document.getElementById('resTranslations');
  if (!el) return;
  const step = Math.min(state.translationStep || 0, TRANSLATIONS.length);
  const entries = TRANSLATIONS.slice(0, step).reverse();
  el.innerHTML = `<div style="padding:20px;font-family:'Courier New',monospace;font-size:14px;color:#c4b5fd;max-height:60vh;overflow-y:auto">
    <div style="font-size:15px;font-weight:800;color:#a78bfa;margin-bottom:16px">📜 Goblin Translations — Observation Log</div>
    ${entries.length ? entries.map((t, i) => `<div style="font-style:italic;padding:8px 0;border-bottom:1px solid rgba(168,85,247,.2)">Step ${step - i}: ${t}</div>`).join('') : '<div style="color:#6b7280;font-style:italic">No translations recorded yet.</div>'}
  </div>`;
}

function setResView(view) {
  _resView = view;
  const cv = document.getElementById('resCv');
  const tr = document.getElementById('resTranslations');
  if (cv) cv.style.display = view === 'web' ? '' : 'none';
  if (tr) { tr.style.display = view === 'translations' ? '' : 'none'; if (view === 'translations') renderTranslations(); }
  // Update tab highlight styles
  for (const [id, active] of [['resWebBtn', view === 'web'], ['resTransBtn', view === 'translations']]) {
    const btn = document.getElementById(id);
    if (!btn) continue;
    btn.style.color = active ? '#c4b5fd' : '#64748b';
    btn.style.borderBottom = active ? '2px solid #a78bfa' : '2px solid transparent';
    btn.style.background = active ? 'rgba(124,58,237,0.15)' : 'transparent';
  }
}

export function showResearch() {
  const p = document.getElementById('resP');
  if (!p) return;
  if (_rPos && state.research && !Object.keys(state.research).some(id => _rPos[id])) _rPos = null;
  p.classList.add('sh');
  syncPause();
  hideResTip();
  const saveBtn = document.getElementById('resSaveBtn');
  if (saveBtn) saveBtn.style.display = state._devMode ? '' : 'none';
  const devUnlockBtn = document.getElementById('resDevUnlockBtn');
  if (devUnlockBtn) devUnlockBtn.style.display = state._devMode ? '' : 'none';
  const transBtn = document.getElementById('resTransBtn');
  if (transBtn) transBtn.style.display = state.patternRecDone ? 'flex' : 'none';
  setResView(_resView);
  if (_resView === 'web') requestAnimationFrame(fitResCv);
}

export function refreshResearch() {
  if (!document.getElementById('resP')?.classList.contains('sh')) return;
  renderResearch();
}

export function resetResPos() { _rPos = null; }

export function initResearchUI() {
  const cv = document.getElementById('resCv');
  if (!cv) return;

  document.getElementById('resClose')?.addEventListener('click', () => {
    document.getElementById('resP')?.classList.remove('sh');
    hideResTip();
    syncPause();
  });

  new ResizeObserver(() => {
    if (document.getElementById('resP')?.classList.contains('sh')) fitResCv();
  }).observe(cv.parentElement);

  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = cv.getBoundingClientRect();
    const cssX = e.clientX - rect.left, cssY = e.clientY - rect.top;
    const scaleX = cv.width / rect.width, scaleY = cv.height / rect.height;
    const sx = cssX * scaleX, sy = cssY * scaleY;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const newZoom = Math.max(R_ZOOM_MIN, Math.min(R_ZOOM_MAX, _rCam.zoom * factor));
    _rCam.panX = sx - (sx - _rCam.panX) * (newZoom / _rCam.zoom);
    _rCam.panY = sy - (sy - _rCam.panY) * (newZoom / _rCam.zoom);
    _rCam.zoom = newZoom;
    clampResCam(cv.width, cv.height);
    renderResearch();
  }, { passive: false });

  let _drag = null;
  cv.addEventListener('pointerdown', e => {
    e.preventDefault();
    cv.setPointerCapture(e.pointerId);
    const rect = cv.getBoundingClientRect();
    _drag = { startX: e.clientX, startY: e.clientY, panX: _rCam.panX, panY: _rCam.panY, moved: false };
  });
  let _hoverNodeId = null;
  cv.addEventListener('pointermove', e => {
    const rect = cv.getBoundingClientRect();
    const scaleX = cv.width / rect.width, scaleY = cv.height / rect.height;
    if (_drag) {
      const dx = (e.clientX - _drag.startX) * scaleX;
      const dy = (e.clientY - _drag.startY) * scaleY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) _drag.moved = true;
      _rCam.panX = _drag.panX + dx;
      _rCam.panY = _drag.panY + dy;
      clampResCam(cv.width, cv.height);
      renderResearch();
      if (_openNodeId) {
        const tip = document.getElementById('resTip');
        if (tip?.classList.contains('sh')) positionResTip(tip, _openNodeId);
      }
      return;
    }
    if (_pinnedNodeId || !_rPos || !state.research) return;
    const sx = (e.clientX - rect.left) * scaleX, sy = (e.clientY - rect.top) * scaleY;
    const { x: wx, y: wy } = toWorld(sx, sy);
    let hit = null;
    for (const [id, pos] of Object.entries(_rPos)) {
      if (Math.hypot(wx - pos.x, wy - pos.y) <= NODE_R) { hit = id; break; }
    }
    if (hit && state.research[hit]?.status === 'locked') hit = null;
    if (hit !== _hoverNodeId) {
      _hoverNodeId = hit;
      if (hit) showResearchDetail(hit);
      else hideResTip();
    }
  });
  let _hideDelay = null;
  const tip = document.getElementById('resTip');
  if (tip) {
    tip.addEventListener('pointerenter', () => { clearTimeout(_hideDelay); _hideDelay = null; });
    tip.addEventListener('pointerleave', () => {
      if (!_pinnedNodeId) { _hoverNodeId = null; hideResTip(); }
    });
  }
  cv.addEventListener('mouseleave', () => {
    if (_pinnedNodeId) return;
    _hideDelay = setTimeout(() => { _hoverNodeId = null; hideResTip(); }, 120);
  });
  cv.addEventListener('pointerup', e => {
    if (!_drag) return;
    const wasDrag = _drag.moved;
    _drag = null;
    if (wasDrag || !_rPos || !state.research) return;
    const rect = cv.getBoundingClientRect();
    const scaleX = cv.width / rect.width, scaleY = cv.height / rect.height;
    const sx = (e.clientX - rect.left) * scaleX, sy = (e.clientY - rect.top) * scaleY;
    const { x: wx, y: wy } = toWorld(sx, sy);
    for (const [id, pos] of Object.entries(_rPos)) {
      if (Math.hypot(wx - pos.x, wy - pos.y) <= NODE_R) {
        if (state.research[id]?.status === 'locked' && !state._devMode) return;
        _pinnedNodeId = id;
        _hoverNodeId = null;
        showResearchDetail(id);
        renderResearch();
        return;
      }
    }
    _pinnedNodeId = null;
    _hoverNodeId = null;
    hideResTip();
    renderResearch();
  });

  document.addEventListener('keydown', e => {
    if (!state._devMode) return;
    if (!document.getElementById('resP')?.classList.contains('sh')) return;
    if (!_pinnedNodeId || !_rPos) return;
    const DIRS = { ArrowUp:[0,-1], ArrowDown:[0,1], ArrowLeft:[-1,0], ArrowRight:[1,0] };
    const dir = DIRS[e.key];
    if (!dir) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const step = RES_GRID_STEP();
    const pos = _rPos[_pinnedNodeId];
    const nx = Math.round(pos.x / step) * step + dir[0] * step;
    const ny = Math.round(pos.y / step) * step + dir[1] * step;
    pos.x = nx;
    pos.y = ny;
    if (state.research[_pinnedNodeId]) {
      state.research[_pinnedNodeId].x = nx;
      state.research[_pinnedNodeId].y = ny;
    }
    if (RESEARCH_JSON) {
      if (RESEARCH_JSON.fixed[_pinnedNodeId]) {
        RESEARCH_JSON.fixed[_pinnedNodeId].x = nx;
        RESEARCH_JSON.fixed[_pinnedNodeId].y = ny;
      } else {
        const vn = RESEARCH_JSON.variable.find(n => n.id === _pinnedNodeId);
        if (vn) { vn.x = nx; vn.y = ny; }
      }
    }
    clampResCam(cv.width, cv.height);
    renderResearch();
    if (_openNodeId) {
      const tip = document.getElementById('resTip');
      if (tip?.classList.contains('sh')) positionResTip(tip, _openNodeId);
    }
  }, true);

  // Create translations view container (inserted after canvas)
  const cv2 = document.getElementById('resCv');
  if (cv2 && !document.getElementById('resTranslations')) {
    const trDiv = document.createElement('div');
    trDiv.id = 'resTranslations';
    trDiv.style.cssText = 'display:none;flex:1;overflow:hidden';
    cv2.parentElement.insertBefore(trDiv, cv2.nextSibling);
  }

  const resHeader = document.getElementById('resH');
  if (resHeader) {
    // Replace h2 with evenly-split section tab headings
    const h2 = resHeader.querySelector('h2');
    const tabBar = document.createElement('div');
    tabBar.style.cssText = 'display:flex;flex:1;align-self:stretch;margin:0 8px 0 -16px';

    const makeTab = (id, icon, label, view) => {
      const btn = document.createElement('button');
      btn.id = id;
      btn.style.cssText = 'flex:1;background:transparent;border:none;border-bottom:2px solid transparent;color:#64748b;cursor:pointer;padding:0 8px;font-size:13px;font-weight:700;font-family:MedievalSharp,cursive;display:flex;align-items:center;justify-content:center;gap:6px;transition:color .15s,border-color .15s,background .15s';
      btn.innerHTML = `<span style="font-size:15px">${icon}</span><span>${label}</span>`;
      btn.onclick = () => setResView(view);
      tabBar.appendChild(btn);
      return btn;
    };

    makeTab('resWebBtn', '🔬', 'Research Web', 'web');
    const transTab = makeTab('resTransBtn', '📜', 'Goblin Translations', 'translations');
    transTab.style.display = 'none';

    if (h2) h2.replaceWith(tabBar);
    else resHeader.prepend(tabBar);

    // Dev: Unlock All button
    const devUnlockBtn = document.createElement('button');
    devUnlockBtn.id = 'resDevUnlockBtn';
    devUnlockBtn.textContent = '🔓 Unlock All';
    devUnlockBtn.title = 'Dev: mark all research as complete';
    Object.assign(devUnlockBtn.style, {
      display: 'none', marginLeft: '8px', background: '#374151', color: '#34d399',
      border: '1px solid #34d399', padding: '2px 7px', cursor: 'pointer',
      fontSize: '12px', borderRadius: '3px', alignSelf: 'center',
    });
    devUnlockBtn.onclick = () => {
      if (!state.research) return;
      // Unlock nodes in the graph (they appear and are complete)
      for (const node of Object.values(state.research)) {
        node.status = 'complete'; node.wavesLeft = 0;
        applyUnlock(node);
      }
      // Apply effects of all fixed/variable nodes NOT in the graph (no graph entry added)
      const inGraph = new Set(Object.values(state.research).map(n => n._sourceId || n.id));
      for (const [id, def] of Object.entries(FIXED_RESEARCH)) {
        if (!inGraph.has(id)) applyUnlock({ ...def, id });
      }
      for (const def of VARIABLE_RESEARCH) {
        if (!inGraph.has(def.id)) applyUnlock({ ...def });
      }
      _rPos = null;
      refreshStatuses(state.research);
      fitResCv();
    };
    resHeader.appendChild(devUnlockBtn);

    const saveBtn = document.createElement('button');
    saveBtn.id = 'resSaveBtn';
    saveBtn.textContent = '💾';
    saveBtn.title = 'Dev: download updated research.json with current node positions';
    Object.assign(saveBtn.style, {
      display: 'none', marginLeft: '8px', background: '#374151', color: '#fbbf24',
      border: '1px solid #f59e0b', padding: '2px 7px', cursor: 'pointer',
      fontSize: '14px', borderRadius: '3px', alignSelf: 'center',
    });
    saveBtn.onclick = () => {
      if (!RESEARCH_JSON) return;
      if (_rPos && state.research) {
        for (const [id, pos] of Object.entries(_rPos)) {
          if (RESEARCH_JSON.fixed[id]) {
            RESEARCH_JSON.fixed[id].x = pos.x;
            RESEARCH_JSON.fixed[id].y = pos.y;
          } else {
            const vn = RESEARCH_JSON.variable.find(n => n.id === id);
            if (vn) { vn.x = pos.x; vn.y = pos.y; }
          }
        }
      }
      const blob = new Blob([JSON.stringify(RESEARCH_JSON, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'research.json';
      a.click();
      URL.revokeObjectURL(a.href);
    };
    resHeader.appendChild(saveBtn);
  }
}
