'use strict';
import { state, startGame, startWave, startPrep, resetGame, _ΨΔ } from './main.js';
import { RTYPES, BASE_RESOURCES, getResourceIconDataUrl, resIconHtml } from './resources.js';
import { TD, ETYPES } from './data.js';
import { SP, castSpell } from './spells.js';
import { renderSk } from './skills.js';
import { BESTIARY, getScribeLogs } from './bestiary.js';
import { sfxPlace, iA } from './audio.js';
import { addFeed } from './feed.js';
import { isBossWave, waveComposition } from './enemies.js';
import { clearLiveRefresh } from './ui-tower.js';

function _waveComposition(w) {
  const parts = waveComposition(w);
  if (!parts.length) return '';
  // Single special entry (fog, watcher, herald)
  if (parts[0].label) return parts.map(p => (p.seen ? p.em : '❓') + ' ' + (p.label || '')).join('  ');
  return parts.map(p => (p.seen ? p.em : '❓') + (p.count > 1 ? ' x' + p.count : '')).join('  ');
}

// ── Sub-module re-exports (keeps external import sites unchanged) ──────────────
export { showTT, refreshActiveTT, clearLiveRefresh } from './ui-tower.js';
export { showResearch, refreshResearch, initResearchUI, resetResPos, getRPos, setRPos } from './ui-research.js';
export { initInventoryUI, addToInventory } from './ui-inventory.js';
import { activateArtifact } from './ui-inventory.js';
export { openCraftPanel, renderCraftPanel, initCraftUI } from './ui-craft.js';

// ── HUD ───────────────────────────────────────────────────────────────────────
export function hudU() {
  const { lives, gold, enemies, spawnQueue, wave, phase, prepTicks } = state;
  document.getElementById('hHP').textContent = lives;
  document.getElementById('hG').textContent = gold;
  const l = enemies.length + spawnQueue.length;
  const wlEl = document.getElementById('wl');
  if (phase === 'prep') {
    wlEl.textContent = '⚔ Prepare · ' + Math.ceil(prepTicks / 60) + 's';
  } else {
    const _ageLabel = state.age === 'steam' ? ' · Steam Age 🔥' : '';
  wlEl.textContent = phase === 'active' ? 'Wave ' + wave + ' · ' + l + ' left' + _ageLabel : 'Wave ' + wave + _ageLabel;
  }
  // Wave makeup — shows to the right of Start button during prep only
  const makeupEl = document.getElementById('waveMakeup');
  if (makeupEl) {
    const _hasLedger = state.inventory?.equipped?.some(a => a?.id === 'auditors_ledger');
    if (phase === 'prep' && wave > 0 && _hasLedger) {
      const makeup = _waveComposition(wave + 1);
      makeupEl.textContent = makeup;
      makeupEl.style.display = makeup ? '' : 'none';
    } else {
      makeupEl.style.display = 'none';
    }
  }

  const goBtn = document.getElementById('goBtn');
  if (goBtn) goBtn.style.display = phase === 'prep' ? '' : 'none';
  state.syncPipBtn?.();
  state.updatePipPanel?.();
  const hRes = document.getElementById('hRes');
  if (hRes) {
    // Track which resources have been acquired; always show base resources + dev mode
    if (!state._seenResources) state._seenResources = new Set(BASE_RESOURCES);
    for (const [k] of Object.entries(RTYPES)) {
      if ((state.resources[k] || 0) > 0) state._seenResources.add(k);
    }
    const rtKeys = Object.keys(RTYPES).filter(k => state._devMode || state._seenResources.has(k));
    const curKeys = Array.from(hRes.querySelectorAll('[data-res]')).map(el => el.dataset.res);
    if (JSON.stringify(curKeys) !== JSON.stringify(rtKeys)) {
      hRes.innerHTML = rtKeys.map(k => {
        const r = RTYPES[k];
        const iconHtml = (k === 'iron_ore' || k === 'iron_ingot')
          ? `<img src="${getResourceIconDataUrl(k, 36)}" style="width:36px;height:36px;vertical-align:middle;image-rendering:pixelated">`
          : r.icon;
        return `<div class="hi" data-res="${k}">${iconHtml}<span class="v" style="color:${r.clr}">${state.resources[k] || 0}</span></div>`;
      }).join('');
    } else {
      for (const el of hRes.children) {
        const k = el.dataset.res;
        if (k) el.querySelector('.v').textContent = state.resources[k] || 0;
      }
    }
  }
}

// ── Overlays & Banners ────────────────────────────────────────────────────────
export function showOv(t, d, b, go, fn, cancelFn, cancelText) {
  document.getElementById('oT').textContent = t;
  document.getElementById('oD').innerHTML = d;
  document.getElementById('oS').textContent = go ? 'Wave ' + state.wave + ' · Gold ' + state.gold : '';
  const btn = document.getElementById('oB');
  btn.textContent = b;
  btn.onclick = fn ?? (go ? () => { resetGame(); startGame(); } : () => startPrep());
  const cancel = document.getElementById('oCancelBtn');
  if (cancel) {
    cancel.style.display = cancelFn ? '' : 'none';
    cancel.textContent = cancelText ?? 'Cancel';
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

export function showResearchPop(name) {
  const b = document.getElementById('rPop');
  b.textContent = '🔬 ' + name + ' complete.';
  b.classList.add('sh');
  setTimeout(() => b.classList.remove('sh'), 3500);
}

export function showForgeAnnounce() {
  const b = document.getElementById('wb');
  b.classList.add('forge');
  b.innerHTML = '⚙️ The Age of Steam.<br><span style="font-size:15px;opacity:0.75">You have left the Stone Age. You did not know you were in it.</span>';
  b.classList.add('sh');
  setTimeout(() => { b.classList.remove('sh'); setTimeout(() => b.classList.remove('forge'), 400); }, 5000);
}

export function showLedger() {
  const el = document.getElementById('ledgerP');
  if (!el) return;
  el.innerHTML = `
    <div id="ledgerBox">
      <div id="ledgerTitle">📜 The Ledger</div>
      <div class="ledger-row"><span class="ledger-label">Goblins Slain</span><span class="ledger-val">${state.totalGoblinsKilled || 0}</span></div>
      <div class="ledger-row"><span class="ledger-label">Gold Earned</span><span class="ledger-val">💰${state.totalGoldEarned || 0}</span></div>
      <div class="ledger-row"><span class="ledger-label">Waves Survived</span><span class="ledger-val">${state.wave}</span></div>
      <div id="ledgerDismiss">Click anywhere to continue</div>
    </div>`;
  el.style.display = 'flex';
  el.onclick = () => { el.style.display = 'none'; };
}

let tipTmr = 0;
export function showTip(t) {
  const el = document.getElementById('tip'); el.textContent = t; el.classList.add('sh');
  clearTimeout(tipTmr); tipTmr = setTimeout(() => el.classList.remove('sh'), 2000);
}

// ── Tower description tooltip (panel hover) ───────────────────────────────────
function showTdesc(key, btnEl) {
  const el = document.getElementById('tdesc');
  if (!el || !state.unlockedTowers) return;

  let icon = '?', name = '?', desc = '', catCls = '', catLabel = '', stats = '', costVal = '';

  if (TD[key]) {
    const d = TD[key], isUnl = state.unlockedTowers.has(key) || state.inventory?.blueprints?.some(bp => bp?.unlocks === key || bp?.id === key + '_bp' || bp?.id === 'bp_' + key);
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
      costVal = (d.cost > 0 ? '💰' + d.cost : '') + (d.resCost ? (d.cost > 0 ? ' + Mats' : 'Mats') : '');
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

export function hideTdesc() {
  const el = document.getElementById('tdesc');
  if (el) el.classList.remove('sh');
}

// ── Bottom panel ──────────────────────────────────────────────────────────────
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
      const isUnl = (state.unlockedTowers && state.unlockedTowers.has(k)) || state.inventory?.blueprints?.some(bp => bp?.unlocks === k || bp?.id === k + '_bp' || bp?.id === 'bp_' + k);
      if (!isUnl) {
        if (k !== 'robot') continue;
        const el = mkIB(d.icon, '???', 'Locked', false, false, () => { });
        addHover(el, k); pc.appendChild(el);
        continue;
      }
      const isAgeLocked = d.reqAge && state.age !== d.reqAge && state.age === 'stone';
      let afford = gold >= d.cost;
      let costStr = d.cost > 0 ? '💰' + d.cost : '';
      if (d.resCost) {
        for (const [res, amt] of Object.entries(d.resCost)) {
          if ((state.resources[res] || 0) < amt) afford = false;
          costStr += ' ' + resIconHtml(res) + amt;
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
    const cons = state.inventory?.consumables || [];
    cons.forEach((item, i) => {
      const countLbl = (item.count && item.count > 1) ? 'x' + item.count : 'Use';
      const n = (item.name || '').toLowerCase();
      const idStr = (item.id || '').toLowerCase();
      const isAxe = item && (idStr.includes('axe') || idStr.includes('lumber') || n.includes('axe') || n.includes('lumber'));
      
      const isSelRR = item.id === 'relocation_charm' ? (state.sel?.type === 'relocate_source' || state.sel?.type === 'relocate_dest') : (isAxe ? (state.sel?.type === 'forest_clear' && state.sel?.invIndex === i) : (state.sel?.type === 'consumable_pick' && state.sel?.index === i));
      const el = mkIB(item.icon, item.name, countLbl, true, isSelRR, () => {
        if (item.id === 'relocation_charm') {
          state.sel = { type: 'relocate_source', invIndex: i };
          showTip('Click the tower you want to move');
        } else if (isAxe) {
          state.sel = { type: 'forest_clear', invIndex: i };
          showTip('Click a forest tile to clear it');
        } else {
          state.sel = { type: 'consumable_pick', item: { ...item }, index: i };
          showTip('Click a path tile to use ' + item.name);
        }
        panelU();
      });
      pc.appendChild(el);
    });
    const activeArts = (state.inventory?.equipped || []).filter(a => a?.active);
    for (const art of activeArts) {
      if (!art.cdWavesLeft) art.cdWavesLeft = 0;
      const canUse = art.cdWavesLeft === 0 && phase === 'active';
      const cdLabel = art.cdWavesLeft > 0 ? art.cdWavesLeft + '🌊' : 'Ready';
      const el = mkIB(art.icon, art.name, cdLabel, canUse, false, () => activateArtifact(art));
      pc.appendChild(el);
    }
  } else if (tab === 'skills') {
    renderSk();
  }
}

// ── Item button & floating text ───────────────────────────────────────────────
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
  const amtStr = (amount >= 0 ? '+' : '') + amount + '\u202f';
  if (icon && icon.startsWith('data:')) {
    p.el.innerHTML = amtStr + `<img src="${icon}" style="width:20px;height:20px;vertical-align:middle;image-rendering:pixelated">`;
  } else {
    p.el.textContent = amtStr + icon;
  }
  p.el.style.display = 'block';
  p.tmr = setTimeout(() => { p.el.style.display = 'none'; fltGPool.push(p); }, 1900);
}

export function hideTT() { document.getElementById('tt').style.display = 'none'; clearLiveRefresh(); }

// ── Welcome / patch notes ─────────────────────────────────────────────────────
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
  state.paused = true;
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
  document.getElementById('welcomeX').onclick = () => {
    el.classList.add('hid');
    syncPause();
    if (onClose) onClose();
  };
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
export function initTabs() {
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    state.tab = t.dataset.t;
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === t));
    state.sel = null; state.ttTower = null; hideTT(); hideTdesc();
    document.getElementById('skP').classList.remove('sh');
    panelU();
  }));
  document.getElementById('skClose').addEventListener('click', () => document.getElementById('skP').classList.remove('sh'));
}

// ── Bestiary ──────────────────────────────────────────────────────────────────
export function renderBestiary() {
  const c = document.getElementById('beastC');
  if (!c) return;
  c.innerHTML = '';

  const entries = { ...BESTIARY };

  for (const [k, d] of Object.entries(entries)) {
    if (!state.bSen.has(k) && k !== 'sleepy_door') continue;

    const lock = !state.bSen.has(k) && k === 'sleepy_door';

    const el = document.createElement('div');
    el.id = 'beast-ent-' + k;
    el.className = 'beast-ent' + (d.boss ? ' boss' : '') + (lock ? ' locked' : '');

    let statsHtml = '';
    const et = ETYPES[k];
    if (et) {
      const hp = et.hpM >= 2.5 ? 'Very High' : et.hpM >= 1.5 ? 'High' : et.hpM >= 1.0 ? 'Above Avg' : et.hpM >= 0.8 ? 'Standard' : et.hpM >= 0.4 ? 'Low' : 'Minimal';
      const spd = et.spdM >= 1.6 ? 'Very Fast' : et.spdM >= 1.2 ? 'Fast' : et.spdM >= 0.9 ? 'Moderate' : et.spdM >= 0.7 ? 'Slow' : 'Very Slow';
      statsHtml = '<div class="beast-stats">HP: ' + hp + ' | Speed: ' + spd + ' | Reward: ' + et.rew + 'g' + (et.noLives ? ' | Deals 0 lives' : '') + (k === 'spider' ? ' | Spawns spiderlings' : '') + '</div>';
    } else if (d.stats) {
      statsHtml = '<div class="beast-stats">' + d.stats + '</div>';
    }

    el.innerHTML = '<div class="beast-ic">' + d.icon + '</div>'
      + '<div class="beast-txt">'
      + '<div class="beast-nm">' + d.name + '</div>'
      + '<div class="beast-cls" style="color:' + d.clr + '">' + d.cls + '</div>'
      + '<div class="beast-desc">' + d.desc + '</div>'
      + statsHtml
      + '</div>';
    c.appendChild(el);
  }
}

export function syncPause() {
  const resOpen = document.getElementById('resP')?.classList.contains('sh');
  const beastOpen = document.getElementById('beastP')?.classList.contains('sh');
  const scribeOpen = document.getElementById('scribeP')?.style.display === 'flex';
  const welcomeOpen = !document.getElementById('welcome')?.classList.contains('hid');
  const invOpen = document.getElementById('invP')?.classList.contains('sh');
  const craftOpen = document.getElementById('craftP')?.classList.contains('sh');
  const labNotesOpen = document.getElementById('obsLogP')?.classList.contains('sh');
  state.paused = !!(resOpen || beastOpen || scribeOpen || welcomeOpen || invOpen || craftOpen || labNotesOpen);
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
