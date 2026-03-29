'use strict';
import { state, startGame, startWave, startPrep, resetGame, _ΨΔ } from './main.js';
import { RTYPES, dropItem } from './resources.js';
import { TD, TOWER_SKILLS } from './data.js';
import { spawnBees } from './support.js';
import { canAfford, spendResources, layoutNodes, UNLOCK_DESC } from './research.js';
import { SP, castSpell } from './spells.js';
import { renderSk, showTowerSkill } from './skills.js';
import { BESTIARY, getScribeLogs } from './bestiary.js';
import { sfxPlace, iA } from './audio.js';

const HOARD_UPGS = [
  { c: 100, rs: { stone: 10, wood: 10 }, m: 1.5 },
  { c: 200, rs: { stone: 25, wood: 25 }, m: 2.0 },
  { c: 400, rs: { stone: 50, wood: 50 }, m: 2.5 },
  { c: 800, rs: { stone: 100, wood: 100 }, m: 3.0 },
  { c: 1500, rs: { stone: 250, wood: 250 }, m: 4.0 }
];

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
  if (!el || !state.unlockedTowers) return;

  let icon = '?', name = '?', desc = '', catCls = '', catLabel = '', stats = '', costVal = '';

  if (TD[key]) {
    const d = TD[key], isUnl = state.unlockedTowers.has(key);
    icon = d.icon;
    if (!isUnl) {
      name = '???'; desc = 'Discover this building via research in the Lab.';
      catCls = 'locked'; catLabel = 'Unknown'; costVal = 'Locked';
    } else {
      name = d.name; desc = d.desc;
      const isAgeLocked = d.reqAge && state.age !== d.reqAge && state.age === 'stone';
      if (isAgeLocked) { name = '???'; desc = 'This building requires a future age.'; }
      catCls = d.cat === 'tower' ? 'offense' : d.cat;
      catLabel = d.cat === 'support' ? 'Support' : 'Offense';
      costVal = '💰' + d.cost + (d.resCost ? ' + Mats' : '');
      if (!isAgeLocked && d.cat === 'tower') {
        stats = `DMG ${d.dmg} · RNG ${d.range} · CD ${d.rate}`;
        if (d.slow) stats += ` · Slow ${Math.floor(d.slow * 100)}%`;
        if (d.splash) stats += ` · Splash ${d.splash}`;
        if (d.pierce) stats += ` · Pierce ${d.pierce}`;
        if (d.chain) stats += ` · Chain ${d.chain}`;
      }
    }
  } else if (SP[key]) {
    const s = SP[key]; icon = s.icon; name = s.name; desc = s.desc || '';
    catCls = 'spell'; catLabel = 'Spell'; costVal = '💰' + s.cost;
  } else return;

  el.innerHTML = `<div class="tdi">
    <div class="tdico">${icon}</div>
    <div class="tdtxt">
      <span class="tdcat ${catCls}">${catLabel}</span>
      <div class="tdname">${name} <span style="font-size:11px;color:var(--gold);opacity:0.8">${costVal}</span></div>
      <div class="tddesc">${desc}</div>
      ${stats ? `<div class="tdstats">${stats}</div>` : ''}
    </div>
  </div>`;

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
      const isUnl = state.unlockedTowers && state.unlockedTowers.has(k);
      if (!isUnl) {
        if (k !== 'robot') continue;
        const el = mkIB(d.icon, '???', 'Locked', false, false, () => { });
        addHover(el, k); pc.appendChild(el);
        continue;
      }
      const isAgeLocked = d.reqAge && state.age !== d.reqAge && state.age === 'stone';
      let afford = gold >= d.cost;
      let costStr = '💰' + d.cost;
      if (d.resCost) {
        for (const [res, amt] of Object.entries(d.resCost)) {
          if ((state.resources[res] || 0) < amt) afford = false;
          costStr += ' ' + (RTYPES[res]?.icon || '') + amt;
        }
      }
      const el = mkIB(d.icon, isAgeLocked ? '???' : d.name, costStr, !isAgeLocked && afford, state.sel?.key === k, () => {
        if (isAgeLocked) return;
        const sel = state.sel?.key === k;
        state.sel = sel ? null : { key: k, type: 'tower', cost: d.cost, resCost: d.resCost };
        state.ttTower = null; hideTT();
        panelU();
      });
      addHover(el, k); pc.appendChild(el);
    }
  } else if (tab === 'spells') {
    for (const k in SP) {
      const s = SP[k];
      const cost = s.cost;
      const el = mkIB(s.icon, s.name, '💰' + cost, gold >= cost && phase === 'active', false, () => castSpell(k));
      addHover(el, k); pc.appendChild(el);
    }
  } else if (tab === 'skills') {
    renderSk();
  }
}

export function mkIB(icon, name, costHtml, ok, sl2, fn) {
  const b = document.createElement('div');
  b.className = 'ib' + (sl2 ? ' sel' : '') + (ok ? '' : ' off');
  b.innerHTML = '<span class="ic">' + icon + '</span><span class="nm">' + name + '</span><span class="ct">' + costHtml + '</span>';
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
  p.el.style.top = (cvR.top - gcR.top + sy) + 'px';
  p.el.style.color = clr;
  p.el.textContent = (amount >= 0 ? '+' : '') + amount + '\u202f' + icon;
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
  const isH = tw.type === 'hoard', def = TD[tw.type];
  document.getElementById('ttT').textContent = (isH ? 'Hoard Pile' : def?.name || tw.type) + (tw.level > 0 ? ' ★' + tw.level : '');
  let s = '';
  if (isH) {
    const m = (tw.level > 0 ? HOARD_UPGS[tw.level - 1].m : 1.0);
    s = `Mult: ${m.toFixed(1)}x | Storage: 🪵${tw.dep.wood} 🪨${tw.dep.stone}`;
  }
  else if (tw.type === 'clam') { s = 'Buff radius: ' + ((tw.level + 1) * 1.5).toFixed(1) + ' · +50%DMG -15%CD'; }
  else if (tw.type === 'beehive') { s = 'Bees: ' + (tw.beeCount || 3) + ' · Bee DMG: ' + (tw.beeDmg || 4); }
  else if (tw.type === 'clown') { s = 'Reverse rng:' + (tw.reverseRange || 3) + ' dur:' + (tw.reverseDur || 80); }
  else if (tw.type === 'monkey') { const mc = tw.monkeys?.length ?? 0; s = mc + ' Monke' + (mc === 1 ? 'y' : 'ys') + ' · Range:' + (tw.range || 4); }
  else if (tw.type === 'stockpile') { s = 'Monkeys deposit/withdraw resources here'; }
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
  if (isH) {
    // Deposit Buttons
    const canDepW = (state.resources.wood || 0) > 0;
    const canDepS = (state.resources.stone || 0) > 0;
    addTTB(a, '🪵+1', 'tts2', canDepW, () => { _ΨΔ(() => { state.resources.wood--; tw.dep.wood++; }); refreshTT(tw); });
    addTTB(a, '🪵All', 'tts2', canDepW, () => { _ΨΔ(() => { const v = state.resources.wood; state.resources.wood -= v; tw.dep.wood += v; }); refreshTT(tw); });
    addTTB(a, '🪨+1', 'tts2', canDepS, () => { _ΨΔ(() => { state.resources.stone--; tw.dep.stone++; }); refreshTT(tw); });
    addTTB(a, '🪨All', 'tts2', canDepS, () => { _ΨΔ(() => { const v = state.resources.stone; state.resources.stone -= v; tw.dep.stone += v; }); refreshTT(tw); });

    // Upgrade Logic
    if (tw.level < 5) {
      const upg = HOARD_UPGS[tw.level];
      let afford = state.gold >= upg.c;
      let costStr = '💰' + upg.c;
      for (const [r, n] of Object.entries(upg.rs)) {
        if ((state.resources[r] || 0) < n) afford = false;
        costStr += ' ' + (RTYPES[r]?.icon || '') + n;
      }
      addTTB(a, '⬆' + costStr, 'ttu', afford, () => {
        _ΨΔ(() => {
          state.gold -= upg.c;
          for (const [r, n] of Object.entries(upg.rs)) state.resources[r] -= n;
          tw.level++;
        });
        refreshTT(tw);
      });
    }
  }
  if (tw.type === 'clam') { const uc = 35 + tw.level * 20; addTTB(a, '+Buff 💰' + uc, 'ttu', state.gold >= uc, () => { _ΨΔ(() => { if (state.gold < uc) return; state.gold -= uc; tw.level++; }); refreshTT(tw); }); }
  if (tw.type === 'beehive') {
    const uc = 40 + tw.level * 25;
    addTTB(a, '+Bees 💰' + uc, 'ttu', state.gold >= uc, () => { _ΨΔ(() => { if (state.gold < uc) return; state.gold -= uc; tw.level++; tw.beeCount = (tw.beeCount || 3) + 1; tw.beeDmg = (tw.beeDmg || 4) + 2; spawnBees(tw); }); refreshTT(tw); });
  }
  if (tw.type === 'clown') { const uc = 40 + tw.level * 25; addTTB(a, '+Range 💰' + uc, 'ttu', state.gold >= uc, () => { _ΨΔ(() => { if (state.gold < uc) return; state.gold -= uc; tw.level++; tw.reverseRange = (tw.reverseRange || 3) + 0.5; tw.reverseDur = (tw.reverseDur || 80) + 20; }); refreshTT(tw); }); }
  if (tw.type === 'lab') { addTTB(a, '🔬 Research', 'tts2', !!state.research, () => { hideTT(); state.ttTower = null; showResearch(); }); }
  if (tw.type === 'monkey') {
    const uc = 80 + tw.level * 60;
    addTTB(a, '+Range 💰' + uc, 'ttu', state.gold >= uc, () => { _ΨΔ(() => { if (state.gold < uc) return; state.gold -= uc; tw.level++; tw.range = (tw.range || 4) + 1; }); refreshTT(tw); });
    buildMonkeyTT(tw, a);
  }
  if (TD[tw.type]?.cat === 'tower' && TOWER_SKILLS[tw.type]) { addTTB(a, '⚡Skill', 'ttc', true, () => { showTowerSkill(tw); hideTT(); state.ttTower = null; }); }
  const sv = Math.floor(def.cost * 0.75 + (tw.level * def.cost * 0.4));
  addTTB(a, 'Sell +💰' + sv, 'ttl', true, () => {
    showOv('Sell ' + def.name + '?', 'Are you sure you want to sell this tower? You will receive 💰' + sv + '.', 'Sell', false, () => {
      _ΨΔ(() => doSell(tw, sv));
      sell();
      hideOv();
    }, () => hideOv());
  });

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
  if (t === 'dmg') { const v = Math.ceil(def.dmg * 0.3 * (1 + lvl * 0.15)); return { l: '+' + v + 'DMG', s: 'dmg', v, c }; }
  if (t === 'range') { const v = +(0.3 + lvl * 0.1).toFixed(1); return { l: '+' + v + 'RNG', s: 'range', v, c }; }
  const v = Math.max(2, Math.floor(def.rate * 0.12)); return { l: '-' + v + 'CD', s: 'rate', v, c };
}

function m32(a) {
  return function () {
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
  // Drop any items carried toward this tile by monkeys
  _cleanupMonkeysForSoldTile(tw.x, tw.y);
}

function _cleanupMonkeysForSoldTile(sx, sy) {
  for (const hut of state.towers) {
    if (hut.type !== 'monkey' || !hut.monkeys) continue;
    for (const mk of hut.monkeys) {
      if (!mk.carrying) continue;
      const dest = mk.role === 'gatherer' ? mk.cfg.dest
                 : mk.role === 'courier'  ? (mk.st === 'carrying' ? mk.cfg.dest : mk.cfg.from)
                 : null;
      if (dest?.x === sx && dest?.y === sy) {
        // Tower already removed from grid.content, so dropItem lands as ground stack
        dropItem(sx, sy, mk.carrying.type);
        mk.carrying = null;
        mk.st = 'idle';
      }
    }
  }
}

export function refreshActiveTT() { if (state.ttTower) refreshTT(state.ttTower); }

const ROLE_CYCLE = [null, 'gatherer', 'courier', 'booster'];
const ROLE_LABEL = { null: 'Idle 💤', gatherer: 'Gather 🌿', courier: 'Courier 🚚', booster: 'Boost 💪' };
const FILTER_CYCLE = [null, 'wood', 'stone'];
const FILTER_LABEL = { null: 'All', wood: '🪵', stone: '🪨' };

function buildMonkeyTT(tw, container) {
  if (!tw.monkeys) return;
  for (const mk of tw.monkeys) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:4px;align-items:center;margin:2px 0';
    const nameEl = document.createElement('span');
    nameEl.style.cssText = 'color:#fb923c;font-size:10px;min-width:44px;font-weight:700';
    nameEl.textContent = mk.name;
    row.appendChild(nameEl);
    container.appendChild(row);

    // Role cycle button
    addTTB(container, ROLE_LABEL[mk.role] ?? 'Idle 💤', 'tts2', true, () => {
      const idx = ROLE_CYCLE.indexOf(mk.role);
      mk.role = ROLE_CYCLE[(idx + 1) % ROLE_CYCLE.length];
      mk.cfg = { filter: null, dest: null, from: null, boost: null };
      mk.st = 'idle'; mk.carrying = null;
      refreshTT(tw);
    });

    if (mk.role === 'gatherer') {
      // Filter toggle
      addTTB(container, 'Filter:' + FILTER_LABEL[mk.cfg.filter ?? null], 'tts2', true, () => {
        const fi = FILTER_CYCLE.indexOf(mk.cfg.filter ?? null);
        mk.cfg.filter = FILTER_CYCLE[(fi + 1) % FILTER_CYCLE.length] ?? null;
        refreshTT(tw);
      });
      // Destination tile pick
      const destLbl = mk.cfg.dest ? `Dest:(${mk.cfg.dest.x},${mk.cfg.dest.y})` : 'Set Dest 📍';
      addTTB(container, destLbl, 'tts2', true, () => {
        state.sel = { type: 'tile_pick', monkey: mk, hut: tw, field: 'dest' };
        hideTT(); state.ttTower = null; panelU();
      });
    }

    if (mk.role === 'courier') {
      addTTB(container, 'Filter:' + FILTER_LABEL[mk.cfg.filter ?? null], 'tts2', true, () => {
        const fi = FILTER_CYCLE.indexOf(mk.cfg.filter ?? null);
        mk.cfg.filter = FILTER_CYCLE[(fi + 1) % FILTER_CYCLE.length] ?? null;
        refreshTT(tw);
      });
      const fromLbl = mk.cfg.from ? `From:(${mk.cfg.from.x},${mk.cfg.from.y})` : 'Set From 📍';
      addTTB(container, fromLbl, 'tts2', true, () => {
        state.sel = { type: 'tile_pick', monkey: mk, hut: tw, field: 'from' };
        hideTT(); state.ttTower = null; panelU();
      });
      const toLbl = mk.cfg.dest ? `To:(${mk.cfg.dest.x},${mk.cfg.dest.y})` : 'Set To 📍';
      addTTB(container, toLbl, 'tts2', true, () => {
        state.sel = { type: 'tile_pick', monkey: mk, hut: tw, field: 'dest' };
        hideTT(); state.ttTower = null; panelU();
      });
    }

    if (mk.role === 'booster') {
      const bLbl = mk.cfg.boost ? `Boost:(${mk.cfg.boost.x},${mk.cfg.boost.y})` : 'Set Target 📍';
      addTTB(container, bLbl, 'tts2', true, () => {
        state.sel = { type: 'tile_pick', monkey: mk, hut: tw, field: 'boost' };
        hideTT(); state.ttTower = null; panelU();
      });
    }

    if (mk.trips > 0) {
      const tripEl = document.createElement('div');
      tripEl.style.cssText = 'color:#64748b;font-size:9px;margin-left:2px';
      tripEl.textContent = mk.trips + ' trip' + (mk.trips === 1 ? '' : 's');
      container.appendChild(tripEl);
    }
  }
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
  } catch (_) {
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

  const entries = { ...BESTIARY };

  for (const [k, d] of Object.entries(entries)) {
    if (!state.bSen.has(k) && k !== 'sleepy_door') continue;

    // Determine locked presentation
    const lock = !state.bSen.has(k) && k === 'sleepy_door';

    const el = document.createElement('div');
    el.id = 'beast-ent-' + k;
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
  const resOpen = document.getElementById('resP')?.classList.contains('sh');
  const beastOpen = document.getElementById('beastP')?.classList.contains('sh');
  const scribeOpen = document.getElementById('scribeP')?.style.display === 'flex';
  state.paused = !!(resOpen || beastOpen || scribeOpen);
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

  document.getElementById('scribeBtn')?.addEventListener('click', () => {
    const sp = document.getElementById('scribeP');
    if (!sp) return;
    if (sp.style.display === 'none' || sp.style.display === '') {
      sp.style.display = 'flex';
      document.getElementById('scribeC').innerHTML = getScribeLogs(state) || "<div style='color:#94a3b8; font-style:italic;'>The journal is empty.</div>";
    } else {
      sp.style.display = 'none';
    }
    syncPause();
  });

  document.getElementById('scribeClose')?.addEventListener('click', () => {
    const sp = document.getElementById('scribeP');
    if (sp) sp.style.display = 'none';
    syncPause();
  });
}

// ── Research Web ──────────────────────────────────────────────────────────────
const RES_ICONS = { dust: '🔮', stone: '🪨', wood: '🪵', flint: '🗿' };
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

function hideResTip() {
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

    if (node.status === 'locked') {
      const prereqNames = node.prereqs.map(p => nodes[p]?.name || p).join(', ');
      const s = document.createElement('span'); s.className = 'rdlocked'; s.textContent = '🔒 ' + prereqNames;
      tip.appendChild(s);
    } else if (node.status === 'available') {
      const c = document.createElement('span'); c.className = 'rdcost';
      c.textContent = fmtCost(node.cost) + ' · ' + node.wavesTotal + 'w';
      tip.appendChild(c);
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
      tip.appendChild(btn);
    } else if (node.status === 'active') {
      const s = document.createElement('span'); s.className = 'rdprog';
      s.textContent = '⏳ ' + node.wavesLeft + ' wave' + (node.wavesLeft !== 1 ? 's' : '') + ' left';
      tip.appendChild(s);
    } else if (node.status === 'complete') {
      const s = document.createElement('span'); s.className = 'rddone';
      s.textContent = '✓ ' + (UNLOCK_DESC[node.unlocks] || node.unlocks);
      tip.appendChild(s);
    }
  }

  tip.classList.add('sh');
  positionResTip(tip, id);
  // Reposition after render so height is accurate
  requestAnimationFrame(() => positionResTip(tip, id));
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
  hideResTip();
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
    hideResTip();
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
    // Tap/click — hit test in world coords
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
    hideResTip(); // clicked background
  });
}

