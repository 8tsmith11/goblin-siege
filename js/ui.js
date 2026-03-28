'use strict';
import { state, startGame, startWave, resetGame, _ΨΔ } from './main.js';
import { TD, TOWER_SKILLS } from './towers.js';
import { SD, spawnBees } from './support.js';
import { SP, castSpell } from './spells.js';
import { SKILLS, renderSk, showTowerSkill } from './skills.js';
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
    wlEl.textContent = phase === 'active' ? 'W' + wave + ' · ' + l + ' left' : 'Wave ' + wave;
  }
  document.getElementById('hI').textContent = '+' + state.fIncome();
  document.getElementById('hSP').textContent = state.skillPts;
  const goBtn = document.getElementById('goBtn');
  if (goBtn) goBtn.style.display = phase === 'prep' ? '' : 'none';
}

export function showOv(t, d, b, go, fn) {
  document.getElementById('oT').textContent = t;
  document.getElementById('oD').innerHTML = d;
  document.getElementById('oS').textContent = go ? 'Wave ' + state.wave + ' · Gold ' + state.gold : '';
  const btn = document.getElementById('oB');
  btn.textContent = b;
  btn.onclick = fn ?? (go ? () => { resetGame(); startGame(); } : () => startWave());
  document.getElementById('ov').classList.remove('hid');
}

export function hideOv() { document.getElementById('ov').classList.add('hid'); }

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

function showTdesc(key) {
  const el = document.getElementById('tdesc');
  if (!el) return;
  const bp = document.getElementById('bp');
  el.style.bottom = (bp ? bp.offsetHeight : 0) + 'px';

  let icon, name, desc, catCls, catLabel, stats = '';
  if (key === 'factory') {
    icon = '🏭'; name = 'Factory'; catCls = 'factory'; catLabel = 'Factory';
    desc = 'Generates gold income each wave. Upgrade for higher income or add a laser.';
  } else if (TD[key]) {
    const d = TD[key]; icon = d.icon; name = d.name; desc = d.desc || ''; catCls = 'offense'; catLabel = 'Offense';
    stats = 'DMG ' + d.dmg + ' · RNG ' + d.range + ' · CD ' + d.rate;
    if (d.slow) stats += ' · Slow ' + Math.floor(d.slow * 100) + '%';
    if (d.splash) stats += ' · Splash ' + d.splash;
    if (d.pierce) stats += ' · Pierce ' + d.pierce;
    if (d.chain) stats += ' · Chain ' + d.chain;
  } else if (SD[key]) {
    const d = SD[key]; icon = d.icon; name = d.name; desc = d.desc || ''; catCls = 'support'; catLabel = 'Support';
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
    el.addEventListener('mouseenter', () => showTdesc(key));
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
    for (const k in SD) {
      const d = SD[k];
      const el = mkIB(d.icon, d.name, d.cost, gold >= d.cost, state.sel?.key === k, () => {
        const sel = state.sel?.key === k;
        state.sel = sel ? null : { key:k, type:'support', cost:d.cost };
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
  b.onclick = fn; return b;
}

export function mkF(px, py, val, clr) {
  const el = document.createElement('div'); el.className = 'flt';
  const gcR = document.getElementById('gc').getBoundingClientRect(), cvR = state.cv.getBoundingClientRect();
  const { cam } = state;
  const sx = (px - cam.panX) * cam.zoom, sy = (py - cam.panY) * cam.zoom;
  el.style.left = (cvR.left - gcR.left + sx) + 'px';
  el.style.top = (cvR.top - gcR.top + sy) + 'px';
  el.style.color = clr;
  el.textContent = typeof val === 'number' ? '-' + val : val;
  document.getElementById('gc').appendChild(el);
  setTimeout(() => el.remove(), 600);
}

export function hideTT() { document.getElementById('tt').style.display = 'none'; }

let _ttPx = 0, _ttPy = 0;
function refreshTT(tw) { hudU(); panelU(); showTT(tw, _ttPx, _ttPy); }

export function showTT(tw, px, py) {
  _ttPx = px; _ttPy = py;
  hideTdesc();
  state.ttTower = tw;
  const el = document.getElementById('tt');
  const isF = tw.type === 'factory', def = TD[tw.type] || SD[tw.type];
  document.getElementById('ttT').textContent = (isF ? 'Factory' : def?.name || tw.type) + (tw.level > 0 ? ' ★' + tw.level : '');
  let s = '';
  if (isF) { s = 'Inc:+' + (10 + tw.level * 8) + '/w' + (tw.hasLaser ? ' 🔴Laser Lv' + tw.laserLvl + ' Rng:' + (tw.laserRange || 3) : ''); }
  else if (tw.type === 'clam') { s = 'Buff radius: ' + ((tw.level + 1) * 1.5).toFixed(1) + ' · +50%DMG -15%CD'; }
  else if (tw.type === 'beehive') { s = 'Bees: ' + (tw.beeCount || 3) + ' · Bee DMG: ' + (tw.beeDmg || 4); }
  else if (tw.type === 'clown') { s = 'Reverse rng:' + (tw.reverseRange || 3) + ' dur:' + (tw.reverseDur || 80); }
  else if (tw.type === 'monkey') { s = 'Buffs factories +25% each'; }
  else if (tw.type === 'robot') { s = 'Auto-casts spells!'; }
  else { s = 'DMG:' + tw.dmg + ' RNG:' + tw.range?.toFixed(1) + ' CD:' + tw.rate; if (tw.slow > 0) s += ' Slow:' + Math.floor(tw.slow * 100) + '%'; if (tw.splash > 0) s += ' Spl:' + tw.splash.toFixed(1); if (tw.pierce) s += ' Prc:' + tw.pierce; if (tw.chain) s += ' Chn:' + tw.chain; if (tw._buffed) s += ' 🐚'; }
  document.getElementById('ttS').textContent = s;

  const a = document.getElementById('ttA'); a.innerHTML = '';
  const sell = () => { hideTT(); state.ttTower = null; hudU(); panelU(); };
  if (TD[tw.type]) {
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
  if (TD[tw.type] && TOWER_SKILLS[tw.type]) { addTTB(a, '⚡Skill', 'ttc', state.skillPts > 0, () => { showTowerSkill(tw); hideTT(); state.ttTower = null; }); }
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
  state.grid[tw.y][tw.x] = 0;
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
