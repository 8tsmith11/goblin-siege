'use strict';
import { state, startGame, startWave, startPrep, resetGame, _ΨΔ } from './main.js';
import { RTYPES } from './resources.js';
import { TD, TOWER_SKILLS } from './data.js';
import { spawnBees } from './support.js';
import { canAfford, spendResources, layoutNodes, UNLOCK_DESC } from './research.js';
import { SP, castSpell } from './spells.js';
import { SKILLS, renderSk, showTowerSkill } from './skills.js';
import { BESTIARY } from './bestiary.js';
import { sfxPlace, iA } from './audio.js';

export function hudU() {
  const { lives, gold, enemies, spawnQueue, wave, phase, prepTicks } = state;
  document.getElementById('hHP').textContent = lives;
  document.getElementById('hG').textContent = gold;
  const l = enemies.length + spawnQueue.length;
  const wlEl = document.getElementById('wl');
  if (phase === 'prep') {
    wlEl.textContent = '⚔ Prepare · ' + Math.ceil(prepTicks / 60) + 's';
  } else {
    wlEl.textContent = phase === 'active' ? 'Wave ' + wave + ' · ' + l + ' left' : 'Wave ' + wave;
  }
  document.getElementById('hI').textContent = '+' + state.fIncome();
  document.getElementById('hSP').textContent = state.skillPts;
  const goBtn = document.getElementById('goBtn');
  if (goBtn) goBtn.style.display = phase === 'prep' ? '' : 'none';
  const hRes = document.getElementById('hRes');
  if (hRes) hRes.innerHTML = Object.entries(RTYPES).map(([k, r]) =>
    `<div class="hi">${r.icon}<span class="v" style="color:${r.clr}">${state.resources[k] || 0}</span></div>`
  ).join('');
}

export function showOv(t, d, b, go, fn, cancelFn) {
  document.getElementById('oT').textContent = t;
  document.getElementById('oD').innerHTML = d;
  document.getElementById('oS').textContent = go ? 'Wave ' + state.wave + ' · Gold ' + state.gold : '';
  const btn = document.getElementById('oB');
  btn.textContent = b;
  btn.onclick = fn ?? (go ? () => { resetGame(); startGame(); } : () => startPrep());
  const cancel = document.getElementById('oCancelBtn');
  if (cancel) {
    cancel.style.display = cancelFn ? '' : 'none';
    cancel.onclick = cancelFn ?? null;
  }
  document.getElementById('ov').classList.remove('hid');
}

export function hideOv() {
  document.getElementById('ov').classList.add('hid');
  const cancel = document.getElementById('oCancelBtn');
  if (cancel) cancel.style.display = 'none';
}

export function showBanner(t) {
  const b = document.getElementById('wb'); b.textContent = t; b.classList.add('sh');
  setTimeout(() => b.classList.remove('sh'), 1500);
}

export function showBL(t) {
  const b = document.getElementById('bL'); b.textContent = '\"' + t + '\"'; b.classList.add('sh');
  import('./audio.js').then(m => m.speak(t));
  setTimeout(() => b.classList.remove('sh'), 3000);
}

let tipTmr = 0;
export function showTip(t) {
  const el = document.getElementById('tip'); el.textContent = t; el.classList.add('sh');
  clearTimeout(tipTmr); tipTmr = setTimeout(() => el.classList.remove('sh'), 2000);
}

function showTdesc(key, btnEl) {
  const el = document.getElementById('tdesc');
  if (!el) return;

  let icon, name, desc, catCls, catLabel, stats = '';
  if (key === 'factory') {
    icon = '🏭'; name = 'Factory'; catCls = 'factory'; catLabel = 'Factory';
    desc = 'Generates gold income each wave. Upgrade for higher income or add a laser.';
  } else if (TD[key]) {
    const d = TD[key]; icon = d.icon; name = d.name; desc = d.desc || '';
    if (d.cat === 'support') {
      catCls = 'support'; catLabel = 'Support';
    } else {
      catCls = 'offense'; catLabel = 'Offense';
      stats = 'DMG ' + d.dmg + ' · RNG ' + d.range + ' · CD ' + d.rate;
      if (d.slow) stats += ' · Slow ' + Math.floor(d.slow * 100) + '%';
      if (d.splash) stats += ' · Splash ' + d.splash;
      if (d.pierce) stats += ' · Pierce ' + d.pierce;
      if (d.chain) stats += ' · Chain ' + d.chain;
    }
  } else if (SP[key]) {
    const d = SP[key]; icon = d.icon; name = d.name; desc = d.desc || ''; catCls = 'spell'; catLabel = 'Spell';
  } else return;

  el.innerHTML = '<div class="tdi">'
    + '<div class="tdico">' + icon + '</div>'
    + '<div class="tdtxt">'
    + '<span class="tdcat ' + catCls + '">' + catLabel + '</span>'
    + '<div class="tdname">' + name + '</div>'
    + '<div class="tddesc">' + desc + '</div>'
    + (stats ? '<div class="tdstats">' + stats + '</div>' : '')
    + '</div></div>';

  el.classList.add('sh');

  if (btnEl) {
    const gcR = document.getElementById('gc').getBoundingClientRect();
    const bR = btnEl.getBoundingClientRect();
    const popW = el.offsetWidth;
    const rawLeft = bR.left - gcR.left + bR.width / 2 - popW / 2;
    el.style.left = Math.max(4, Math.min(rawLeft, gcR.width - popW - 4)) + 'px';
    el.style.bottom = (gcR.bottom - bR.top + 8) + 'px';
    el.style.right = 'auto';
  }
}

function hideTdesc() {
  const el = document.getElementById('tdesc');
  if (el) el.classList.remove('sh');
}

export function panelU() {
  const pc = document.getElementById('pc'); pc.innerHTML = '';
  const { gold, phase } = state;
  const tab = state.tab;

  const addHover = (el, key) => {
    el.addEventListener('mouseenter', () => showTdesc(key, el));
    el.addEventListener('mouseleave', () => hideTdesc());
  };

  if (tab === 'towers') {
    for (const k in TD) {
      const d = TD[k];
      const el = mkIB(d.icon, d.name, d.cost, gold >= d.cost, state.sel?.key === k, () => {
        const sel = state.sel?.key === k;
        state.sel = sel ? null : { key:k, type:'tower', cost:d.cost };
        state.ttTower = null; hideTT();
        panelU();
      });
      addHover(el, k); pc.appendChild(el);
    }
  } else if (tab === 'spells') {
    for (const k in SP) {
      const s = SP[k];
      const cost = SKILLS.spellMaster?.owned ? Math.floor(s.cost * 0.75) : s.cost;
      const el = mkIB(s.icon, s.name, cost, gold >= cost && phase === 'active', false, () => castSpell(k));
      addHover(el, k); pc.appendChild(el);
    }
  } else if (tab === 'factory') {
    const cnt = state.towers.filter(t => t.type === 'factory').length;
    const cost = 50 + cnt * 25;
    const el = mkIB('🏭', 'Factory', cost, gold >= cost, state.sel?.key === 'factory', () => {
      const sel = state.sel?.key === 'factory';
      state.sel = sel ? null : { key:'factory', type:'factory', cost };
      state.ttTower = null; hideTT();
      panelU();
    });
    addHover(el, 'factory'); pc.appendChild(el);
    const i = document.createElement('div');
    i.style.cssText = 'font-size:10px;color:#64748b;padding:4px;line-height:1.4;align-self:center;flex-shrink:0';
    i.innerHTML = '×' + cnt + '<br>Inc:<b style="color:#10b981">+' + state.fIncome() + '</b>/w'; pc.appendChild(i);
  } else if (tab === 'skills') {
    const i = document.createElement('div');
    i.style.cssText = 'font-size:11px;color:#94a3b8;padding:4px;text-align:center;align-self:center';
    i.innerHTML = '⚡' + state.skillPts + ' pts (every 3 waves)'; pc.appendChild(i);
  }
}

export function mkIB(icon, name, cost, ok, sl2, fn) {
  const b = document.createElement('div');
  b.className = 'ib' + (sl2 ? ' sel' : '') + (ok ? '' : ' off');
  b.innerHTML = '<span class="ic">' + icon + '</span><span class="nm">' + name + '</span><span class="ct">💰' + cost + '</span>';
  b.addEventListener('pointerdown', e => { e.stopPropagation(); fn(); }); return b;
}

const fltPool = [];
export function mkF(px, py, val, clr) {
  let p = fltPool.pop();
  if (!p) {
    const el = document.createElement('div'); el.className = 'flt';
    document.getElementById('gc').appendChild(el);
    p = { el, tmr: null };
  } else { clearTimeout(p.tmr); }
  const gcR = document.getElementById('gc').getBoundingClientRect(), cvR = state.cv.getBoundingClientRect();
  const { cam } = state;
  const sx = (px - cam.panX) * cam.zoom, sy = (py - cam.panY) * cam.zoom;
  p.el.style.left = (cvR.left - gcR.left + sx) + 'px';
  p.el.style.top = (cvR.top - gcR.top + sy) + 'px';
  p.el.style.color = clr;
  p.el.textContent = typeof val === 'number' ? '-' + val : val;
  p.el.style.display = 'block';
  p.tmr = setTimeout(() => { p.el.style.display = 'none'; fltPool.push(p); }, 600);
}

const fltGPool = [];
export function mkGain(px, py, icon, amount, clr) {
  let p = fltGPool.pop();
  if (!p) {
    const el = document.createElement('div'); el.className = 'fltG';
    document.getElementById('gc').appendChild(el);
    p = { el, tmr: null };
  } else { clearTimeout(p.tmr); }
  const gcR = document.getElementById('gc').getBoundingClientRect(), cvR = state.cv.getBoundingClientRect();
  const { cam } = state;
  const sx = (px - cam.panX) * cam.zoom, sy = (py - cam.panY) * cam.zoom;
  p.el.style.left = (cvR.left - gcR.left + sx) + 'px';
  p.el.style.top  = (cvR.top  - gcR.top  + sy) + 'px';
  p.el.style.color = clr;
  p.el.textContent = '+' + amount + '\u202f' + icon;
  p.el.style.display = 'block';
  p.tmr = setTimeout(() => { p.el.style.display = 'none'; fltGPool.push(p); }, 950);
}

export function hideTT() { document.getElementById('tt').style.display = 'none'; }

let _ttPx = 0, _ttPy = 0;
function refreshTT(tw) { hudU(); panelU(); showTT(tw, _ttPx, _ttPy); }

export function showTT(tw, px, py) {
  _ttPx = px; _ttPy = py;
  hideTdesc();
  state.ttTower = tw;
  const el = document.getElementById('tt');
  const isF = tw.type === 'factory', def = TD[tw.type];
  document.getElementById('ttT').textContent = (isF ? 'Factory' : def?.name || tw.type) + (tw.level > 0 ? ' ★' + tw.level : '');
  let s = '';
  if (isF) { s = 'Inc:+' + (10 + tw.level * 8) + '/w' + (tw.hasLaser ? ' 🔴Laser Lv' + tw.laserLvl + ' Rng:' + (tw.laserRange || 3) : ''); }
  else if (tw.type === 'clam') { s = 'Buff radius: ' + ((tw.level + 1) * 1.5).toFixed(1) + ' · +50%DMG -15%CD'; }
  else if (tw.type === 'beehive') { s = 'Bees: ' + (tw.beeCount || 3) + ' · Bee DMG: ' + (tw.beeDmg || 4); }
  else if (tw.type === 'clown') { s = 'Reverse rng:' + (tw.reverseRange || 3) + ' dur:' + (tw.reverseDur || 80); }
  else if (tw.type === 'monkey') { s = 'Buffs factories +25% each'; }
  else if (tw.type === 'robot') { s = 'Auto-casts spells!'; }
  else if (tw.type === 'lab') { s = 'Observation radius: ' + (tw.obsRange || 3) + ' · Gathers 🔮 Dust'; }
  else { s = 'DMG:' + tw.dmg + ' RNG:' + tw.range?.toFixed(1) + ' CD:' + tw.rate; if (tw.slow > 0) s += ' Slow:' + Math.floor(tw.slow * 100) + '%'; if (tw.splash > 0) s += ' Spl:' + tw.splash.toFixed(1); if (tw.pierce) s += ' Prc:' + tw.pierce; if (tw.chain) s += ' Chn:' + tw.chain; if (tw._buffed) s += ' 🐚'; }
  document.getElementById('ttS').textContent = s;

  const a = document.getElementById('ttA'); a.innerHTML = '';
  const sell = () => { hideTT(); state.ttTower = null; hudU(); panelU(); };
  if (TD[tw.type]?.cat === 'tower') {
    const upg = genUpg(TD[tw.type], tw.level);
    addTTB(a, upg.l + ' 💰' + upg.c, 'ttu', state.gold >= upg.c, () => { _ΨΔ(() => doUpg(tw, upg)); refreshTT(tw); });
  }
  if (isF) {
    if (!tw.hasLaser) { const lc = 60; addTTB(a, '🔴Laser 💰' + lc, 'tts2', state.gold >= lc, () => { _ΨΔ(() => { if (state.gold < lc) return; state.gold -= lc; tw.hasLaser = true; tw.laserCD = 0; tw.laserLvl = 1; tw.laserRange = 3; sfxPlace(); }); refreshTT(tw); }); }
    if (tw.hasLaser) { const lc = 30 + tw.laserLvl * 15; addTTB(a, '⬆Laser 💰' + lc, 'tts2', state.gold >= lc, () => { _ΨΔ(() => { if (state.gold < lc) return; state.gold -= lc; tw.laserLvl++; tw.laserRange = 3 + tw.laserLvl * 0.5; sfxPlace(); }); refreshTT(tw); }); }
    const uc = 30 + tw.level * 20; addTTB(a, '+Inc 💰' + uc, 'ttu', state.gold >= uc, () => { _ΨΔ(() => { if (state.gold < uc) return; state.gold -= uc; tw.level++; }); refreshTT(tw); });
  }
  if (tw.type === 'clam') { const uc = 35 + tw.level * 20; addTTB(a, '+Buff 💰' + uc, 'ttu', state.gold >= uc, () => { _ΨΔ(() => { if (state.gold < uc) return; state.gold -= uc; tw.level++; }); refreshTT(tw); }); }
  if (tw.type === 'beehive') {
    const uc = 40 + tw.level * 25;
    addTTB(a, '+Bees 💰' + uc, 'ttu', state.gold >= uc, () => { _ΨΔ(() => { if (state.gold < uc) return; state.gold -= uc; tw.level++; tw.beeCount = (tw.beeCount || 3) + 1; tw.beeDmg = (tw.beeDmg || 4) + 2; spawnBees(tw); }); refreshTT(tw); });
  }
  if (tw.type === 'clown') { const uc = 40 + tw.level * 25; addTTB(a, '+Range 💰' + uc, 'ttu', state.gold >= uc, () => { _ΨΔ(() => { if (state.gold < uc) return; state.gold -= uc; tw.level++; tw.reverseRange = (tw.reverseRange || 3) + 0.5; tw.reverseDur = (tw.reverseDur || 80) + 20; }); refreshTT(tw); }); }
  if (tw.type === 'lab') { addTTB(a, '🔬 Research', 'tts2', !!state.research, () => { hideTT(); state.ttTower = null; showResearch(); }); }
  if (TD[tw.type]?.cat === 'tower' && TOWER_SKILLS[tw.type]) { addTTB(a, '⚡Skill', 'ttc', state.skillPts > 0, () => { showTowerSkill(tw); hideTT(); state.ttTower = null; }); }
  const sv = Math.floor((isF ? 50 : def?.cost || 50) * 0.5);
  addTTB(a, 'Sell +💰' + sv, 'ttl', true, () => { _ΨΔ(() => doSell(tw, sv)); sell(); });

  const { W } = state;
  el.style.display = 'block';
  let tx = px - el.offsetWidth / 2, ty = py - el.offsetHeight - 10;
  if (ty < 2) ty = py + state.CELL * state.cam.zoom + 4;
  if (tx < 2) tx = 2;
  if (tx + el.offsetWidth > W) tx = W - el.offsetWidth - 2;
  el.style.left = tx + 'px'; el.style.top = ty + 'px';
}

function addTTB(parent, txt, cls, ok, fn) {
  const b = document.createElement('button');
  b.className = 'ttb ' + cls + (ok ? '' : ' off2');
  b.textContent = txt; b.onclick = e => { e.stopPropagation(); fn(); };
  parent.appendChild(b);
}

function genUpg(def, lvl) {
  const r = m32(state.wave * 7 + lvl * 13 + def.cost);
  const ts = ['dmg', 'range', 'rate'], t = ts[Math.floor(r() * ts.length)];
  const c = Math.floor(def.cost * 0.5 * (1 + lvl * 0.4));
  if (t === 'dmg') { const v = Math.ceil(def.dmg * 0.3 * (1 + lvl * 0.15)); return { l:'+'+v+'DMG', s:'dmg', v, c }; }
  if (t === 'range') { const v = +(0.3 + lvl * 0.1).toFixed(1); return { l:'+'+v+'RNG', s:'range', v, c }; }
  const v = Math.max(2, Math.floor(def.rate * 0.12)); return { l:'-'+v+'CD', s:'rate', v, c };
}

function m32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a); t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function doUpg(tw, upg) {
  if (state.gold < upg.c) return;
  state.gold -= upg.c; tw.level++;
  if (upg.s === 'dmg') tw.dmg += upg.v;
  else if (upg.s === 'range') tw.range += upg.v;
  else if (upg.s === 'rate') tw.rate = Math.max(5, tw.rate - upg.v);
  sfxPlace();
}

function doSell(tw, val) {
  state.gold += val;
  state.grid[tw.y][tw.x].type = 'empty';
  state.grid[tw.y][tw.x].content = null;
  state.towers = state.towers.filter(x => x !== tw);
  state.bees = state.bees.filter(b => b.hive !== tw);
}

function mdToHtml(md) {
  let html = '', inList = false;
  for (const line of md.split('\n')) {
    if (line.startsWith('## ')) {
      if (inList) { html += '</ul>'; inList = false; }
      html += '<h2>' + line.slice(3) + '</h2>';
    } else if (line.startsWith('### ')) {
      if (inList) { html += '</ul>'; inList = false; }
      html += '<h3>' + line.slice(4) + '</h3>';
    } else if (line.startsWith('- ')) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += '<li>' + line.slice(2) + '</li>';
    } else if (line.trim() === '') {
      if (inList) { html += '</ul>'; inList = false; }
    }
  }
  if (inList) html += '</ul>';
  return html;
}

export async function showWelcome(version, onClose) {
  const el = document.getElementById('welcome');
  document.getElementById('welcomeTitle').textContent = '⚔️ Welcome to Goblin Siege ' + version + ' ⚔️';
  const notesEl = document.getElementById('welcomeNotes');
  try {
    const res = await fetch('patch-notes/' + version + '.md');
    if (!res.ok) throw new Error();
    notesEl.innerHTML = mdToHtml(await res.text());
  } catch(_) {
    notesEl.textContent = 'No patch notes available.';
  }
  const box = document.getElementById('welcomeBox');
  const startAudio = () => { iA(); box.removeEventListener('pointerdown', startAudio); };
  box.addEventListener('pointerdown', startAudio);
  document.getElementById('welcomeX').onclick = () => { el.classList.add('hid'); if (onClose) onClose(); };
}

export function initTabs() {
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    state.tab = t.dataset.t;
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === t));
    state.sel = null; state.ttTower = null; hideTT(); hideTdesc();
    if (state.tab === 'skills') { renderSk(); document.getElementById('skP').classList.add('sh'); }
    else document.getElementById('skP').classList.remove('sh');
    panelU();
  }));
  document.getElementById('skClose').addEventListener('click', () => document.getElementById('skP').classList.remove('sh'));
}

export function renderBestiary() {
  const c = document.getElementById('beastC');
  if (!c) return;
  c.innerHTML = '';
  for (const [k, d] of Object.entries(BESTIARY)) {
    if (!state.bSen.has(k) && k !== 'sleepy_door') continue;
    
    // Determine locked presentation
    const lock = !state.bSen.has(k) && k === 'sleepy_door';
    
    const el = document.createElement('div');
    el.className = 'beast-ent' + (d.boss ? ' boss' : '') + (lock ? ' locked' : '');
    el.innerHTML = '<div class="beast-ic">' + d.icon + '</div>'
      + '<div class="beast-txt">'
      + '<div class="beast-nm">' + d.name + '</div>'
      + '<div class="beast-cls" style="color:' + d.clr + '">' + d.cls + '</div>'
      + '<div class="beast-desc">' + d.desc + '</div>'
      + (d.stats ? '<div class="beast-stats">' + d.stats + '</div>' : '')
      + '</div>';
    c.appendChild(el);
  }
}

function syncPause() {
  const resOpen   = document.getElementById('resP')?.classList.contains('sh');
  const beastOpen = document.getElementById('beastP')?.classList.contains('sh');
  state.paused = !!(resOpen || beastOpen);
}

export function toggleBestiary() {
  const p = document.getElementById('beastP');
  if (!p) return;
  if (p.classList.contains('sh')) {
    p.classList.remove('sh');
  } else {
    renderBestiary();
    p.classList.add('sh');
  }
  syncPause();
}

export function initBestiaryUI() {
  document.getElementById('beastBtn')?.addEventListener('click', toggleBestiary);
  document.getElementById('beastClose')?.addEventListener('click', () => {
    document.getElementById('beastP')?.classList.remove('sh');
    syncPause();
  });
}

// ── Research Web ──────────────────────────────────────────────────────────────
const RES_ICONS = { dust:'🔮', stone:'🪨', wood:'🪵', flint:'🗿' };
const NODE_R = 22;
let _rPos = null; // cached layout positions (world coords)
const _rCam = { panX: 0, panY: 0, zoom: 1 };
const R_ZOOM_MIN = 0.4, R_ZOOM_MAX = 3;

function fmtCost(cost) {
  return Object.entries(cost).map(([r, n]) => (RES_ICONS[r] || r) + n).join(' ');
}

function isNodeVisible(node) {
  if (!node.hidden) return true;
  return state.bSen?.has(node.trigger);
}

// Clamp pan so the graph never goes fully off-screen
function clampResCam(W, H) {
  if (!_rPos) return;
  const { zoom } = _rCam;
  const xs = Object.values(_rPos).map(p => p.x);
  const ys = Object.values(_rPos).map(p => p.y);
  const pad = NODE_R + 30;
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad + 20;
  // Keep at least 40px of graph visible on each axis
  const margin = 40;
  _rCam.panX = Math.max(margin - maxX * zoom, Math.min(W - margin - minX * zoom, _rCam.panX));
  _rCam.panY = Math.max(margin - maxY * zoom, Math.min(H - margin - minY * zoom, _rCam.panY));
}

// Convert a canvas-pixel point to world coords
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

  // Draw edges
  for (const [id, node] of Object.entries(nodes)) {
    const to = _rPos[id];
    if (!to) continue;
    for (const pid of node.prereqs) {
      const from = _rPos[pid];
      if (!from) continue;
      const complete = nodes[pid]?.status === 'complete';
      cx.strokeStyle = complete ? '#3b1878' : '#1e1e2e';
      cx.lineWidth = 1.5 / _rCam.zoom;
      cx.beginPath(); cx.moveTo(from.x, from.y); cx.lineTo(to.x, to.y); cx.stroke();
    }
  }

  // Draw nodes
  for (const [id, node] of Object.entries(nodes)) {
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
    if (status === 'complete') { cx.strokeStyle = '#22c55e'; cx.lineWidth = 2 / _rCam.zoom; }
    else if (status === 'active') { cx.strokeStyle = '#a78bfa'; cx.lineWidth = 2 / _rCam.zoom; }
    else if (status === 'available') { cx.strokeStyle = '#7c3aed'; cx.lineWidth = 1.5 / _rCam.zoom; }
    else { cx.strokeStyle = '#1e1e30'; cx.lineWidth = 1 / _rCam.zoom; }
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
}

function showResearchDetail(id) {
  const nodes = state.research;
  if (!nodes || !nodes[id]) return;
  const node = nodes[id];
  const visible = isNodeVisible(node);
  const det = document.getElementById('resDetail');
  det.innerHTML = '';

  if (!visible) {
    const s = document.createElement('span'); s.className = 'rdlocked'; s.textContent = '??? — conditions not yet met';
    det.appendChild(s); return;
  }

  const nm = document.createElement('span'); nm.className = 'rdname'; nm.textContent = node.icon + ' ' + node.name;
  det.appendChild(nm);

  if (node.status === 'locked') {
    const prereqNames = node.prereqs.map(p => nodes[p]?.name || p).join(', ');
    const s = document.createElement('span'); s.className = 'rdlocked'; s.textContent = '🔒 Requires: ' + prereqNames;
    det.appendChild(s);
  } else if (node.status === 'available') {
    const cost = document.createElement('span'); cost.className = 'rdcost';
    cost.textContent = 'Cost: ' + fmtCost(node.cost) + '  ·  ' + node.wavesTotal + ' wave' + (node.wavesTotal > 1 ? 's' : '');
    det.appendChild(cost);
    const hasActive = Object.values(nodes).some(n => n.status === 'active');
    const affordable = canAfford(node.cost);
    const btn = document.createElement('button'); btn.className = 'rdbtn';
    btn.textContent = 'Begin Research';
    btn.disabled = hasActive || !affordable;
    if (hasActive) btn.title = 'Research already in progress';
    else if (!affordable) btn.title = 'Not enough resources';
    btn.onclick = () => {
      spendResources(node.cost);
      node.status = 'active';
      renderResearch();
      showResearchDetail(id);
      hudU();
    };
    det.appendChild(btn);
  } else if (node.status === 'active') {
    const s = document.createElement('span'); s.className = 'rdprog';
    s.textContent = '⏳ In progress — ' + node.wavesLeft + ' wave' + (node.wavesLeft !== 1 ? 's' : '') + ' remaining';
    det.appendChild(s);
  } else if (node.status === 'complete') {
    const s = document.createElement('span'); s.className = 'rddone';
    s.textContent = '✓ Complete — ' + (UNLOCK_DESC[node.unlocks] || node.unlocks);
    det.appendChild(s);
  }
}

function fitResCv() {
  const cv = document.getElementById('resCv');
  if (!cv || !state.research) return;
  cv.width = cv.clientWidth || 520;
  cv.height = cv.clientHeight || 280;
  _rPos = layoutNodes(state.research, cv.width, cv.height);
  _rCam.zoom = 1; _rCam.panX = 0; _rCam.panY = 0;
  clampResCam(cv.width, cv.height);
  renderResearch();
}

export function showResearch() {
  const p = document.getElementById('resP');
  if (!p) return;
  p.classList.add('sh');
  syncPause();
  document.getElementById('resDetail').innerHTML = '<span class="rdhint">Click a node to see details</span>';
  // Wait one frame for the panel to finish layout before measuring
  requestAnimationFrame(fitResCv);
}

export function refreshResearch() {
  if (!document.getElementById('resP')?.classList.contains('sh')) return;
  renderResearch();
}

export function initResearchUI() {
  const cv = document.getElementById('resCv');
  if (!cv) return;

  document.getElementById('resClose')?.addEventListener('click', () => {
    document.getElementById('resP')?.classList.remove('sh');
    syncPause();
  });

  // Re-fit canvas when window resizes while panel is open
  new ResizeObserver(() => {
    if (document.getElementById('resP')?.classList.contains('sh')) fitResCv();
  }).observe(cv.parentElement);

  // ── Zoom (wheel) ──
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = cv.getBoundingClientRect();
    const cssX = e.clientX - rect.left, cssY = e.clientY - rect.top;
    const scaleX = cv.width / rect.width, scaleY = cv.height / rect.height;
    const sx = cssX * scaleX, sy = cssY * scaleY; // canvas pixels
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const newZoom = Math.max(R_ZOOM_MIN, Math.min(R_ZOOM_MAX, _rCam.zoom * factor));
    // Zoom toward the mouse position
    _rCam.panX = sx - (sx - _rCam.panX) * (newZoom / _rCam.zoom);
    _rCam.panY = sy - (sy - _rCam.panY) * (newZoom / _rCam.zoom);
    _rCam.zoom = newZoom;
    clampResCam(cv.width, cv.height);
    renderResearch();
  }, { passive: false });

  // ── Pan (drag) ──
  let _drag = null;
  cv.addEventListener('pointerdown', e => {
    e.preventDefault();
    cv.setPointerCapture(e.pointerId);
    const rect = cv.getBoundingClientRect();
    _drag = { startX: e.clientX, startY: e.clientY, panX: _rCam.panX, panY: _rCam.panY, moved: false };
  });
  cv.addEventListener('pointermove', e => {
    if (!_drag) return;
    const rect = cv.getBoundingClientRect();
    const scaleX = cv.width / rect.width, scaleY = cv.height / rect.height;
    const dx = (e.clientX - _drag.startX) * scaleX;
    const dy = (e.clientY - _drag.startY) * scaleY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) _drag.moved = true;
    _rCam.panX = _drag.panX + dx;
    _rCam.panY = _drag.panY + dy;
    clampResCam(cv.width, cv.height);
    renderResearch();
  });
  cv.addEventListener('pointerup', e => {
    if (!_drag) return;
    const wasDrag = _drag.moved;
    _drag = null;
    if (wasDrag || !_rPos || !state.research) return;
    // It was a tap/click — hit test in world coords
    const rect = cv.getBoundingClientRect();
    const scaleX = cv.width / rect.width, scaleY = cv.height / rect.height;
    const sx = (e.clientX - rect.left) * scaleX, sy = (e.clientY - rect.top) * scaleY;
    const { x: wx, y: wy } = toWorld(sx, sy);
    for (const [id, pos] of Object.entries(_rPos)) {
      if (Math.hypot(wx - pos.x, wy - pos.y) <= NODE_R) {
        showResearchDetail(id);
        return;
      }
    }
  });
}

