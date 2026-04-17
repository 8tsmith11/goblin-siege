'use strict';
import { state, _ΨΔ, getCell } from './main.js';

const TRANSLATIONS = [
  '"Do not go past the red stone."',
  '"The hum means the tall ones are near."',
  '"Three clicks: move. Four clicks: run."',
  '"Leave food by the water. They remember."',
  '"The crown does not protect you."',
  '"Some of us do not want to be here either."',
  '"What is a wall to someone with nothing to lose?"',
  '"They built this path. Not for us."',
  '"We are not the first wave."',
  '"The fog remembers everyone who passed through."',
  '"Tell the hatchlings the door was already open."',
  '"We were supposed to arrive at dawn."',
];

function _showObsLog() {
  const el = document.getElementById('obsLogP');
  if (!el) return;
  const step = Math.min(state.translationStep || 0, TRANSLATIONS.length);
  const entries = TRANSLATIONS.slice(0, step).reverse();
  el.innerHTML = `<div style="background:#0d1520;border:2px solid #a78bfa;border-radius:12px;padding:20px;max-width:380px;max-height:60vh;overflow-y:auto">
    <div style="font-size:14px;font-weight:800;color:#a78bfa;margin-bottom:12px">📜 Observation Log — Goblin Translations</div>
    ${entries.map((t, i) => `<div style="font-style:italic;color:#c4b5fd;font-size:13px;padding:8px 0;border-bottom:1px solid rgba(168,85,247,.2)">Step ${step - i}: ${t}</div>`).join('')}
    <button onclick="document.getElementById('obsLogP').style.display='none'" style="margin-top:12px;padding:6px 16px;background:#1a1a3a;border:1px solid #a78bfa;border-radius:6px;color:#a78bfa;cursor:pointer">Close</button>
  </div>`;
  el.style.display = 'flex';
  el.onclick = e => { if (e.target === el) el.style.display = 'none'; };
}
import { TD, TOWER_SKILLS, HOARD_LEVELS, HOARD_UPGS } from './data.js';
import { spawnBees } from './support.js';
import { showTowerSkill } from './skills.js';
import { sfxPlace } from './audio.js';
import { RECIPES, removeAugment } from './craft.js';
import { dropItem, RTYPES, getItemDef, _itemRegistry } from './resources.js';
import { hudU, panelU, hideTT, hideTdesc, showOv, hideOv, showBanner } from './ui.js';
import { addToInventory, openInventoryForAugment } from './ui-inventory.js';
import { showResearch } from './ui-research.js';
import { openCraftPanel } from './ui-craft.js';

let _ttPx = 0, _ttPy = 0;
function refreshTT(tw) { hudU(); panelU(); showTT(tw, _ttPx, _ttPy); }

function buildStockpileTT(tw, a) {
  if (!tw.slots) tw.slots = [null, null, null, null];
  const ifaceUnlocked = !!state.researchUnlocks?.stockpile_interface;
  const isInterface = tw.mode === 'interface';
  const cap = 64 << (tw.level || 0);

  if (!isInterface) {
    const slotWrap = document.createElement('div');
    slotWrap.style.cssText = 'width:100%;display:flex;flex-direction:column;gap:3px';
    for (let i = 0; i < 4; i++) {
      const slot = tw.slots[i];
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:5px;background:#0d1525;border-radius:4px;padding:3px 6px;min-height:24px';
      if (slot) {
        const def = getItemDef(slot.type);
        const isCrafted = !RTYPES[slot.type];
        const lbl = document.createElement('span');
        lbl.style.cssText = 'flex:1;font-size:11px;color:#e2e8f0';
        lbl.textContent = def.icon + ' ' + slot.count + ' / ' + cap;
        row.appendChild(lbl);
        const _withdraw = (amount) => {
          const s = tw.slots[i]; if (!s) return;
          if (isCrafted) {
            const section = _itemRegistry[s.type]?.output === 'consumable' ? 'consumables' : 'augments';
            for (let n = 0; n < amount; n++) addToInventory(section, { id: s.type, name: def.name, icon: def.icon });
          } else {
            state.resources[s.type] = (state.resources[s.type] || 0) + amount;
          }
          s.count -= amount;
          if (s.count <= 0) tw.slots[i] = null;
          refreshTT(tw);
        };
        const take1Btn = document.createElement('button');
        take1Btn.className = 'ttb tts2';
        take1Btn.style.cssText = 'min-width:28px;padding:2px 4px;font-size:9px;flex-shrink:0';
        take1Btn.textContent = '+1';
        take1Btn.onclick = e => { e.stopPropagation(); _withdraw(1); };
        row.appendChild(take1Btn);
        const takeAllBtn = document.createElement('button');
        takeAllBtn.className = 'ttb tts2';
        takeAllBtn.style.cssText = 'min-width:36px;padding:2px 4px;font-size:9px;flex-shrink:0';
        takeAllBtn.textContent = 'All';
        takeAllBtn.onclick = e => { e.stopPropagation(); _withdraw(tw.slots[i]?.count ?? 0); };
        row.appendChild(takeAllBtn);
      } else {
        const lbl = document.createElement('span');
        lbl.style.cssText = 'flex:1;font-size:10px;color:#374151;font-style:italic';
        lbl.textContent = 'Empty';
        row.appendChild(lbl);
      }
      slotWrap.appendChild(row);
    }
    a.appendChild(slotWrap);

    const res = state.resources || {};
    const depKeys = Object.keys(RTYPES).filter(k => k !== 'dust' && (res[k] || 0) > 0);
    if (depKeys.length > 0) {
      const depRow = document.createElement('div');
      depRow.style.cssText = 'width:100%;display:flex;flex-wrap:wrap;gap:3px;margin-top:2px';
      for (const k of depKeys) {
        const rt = RTYPES[k];
        const hasRoom = tw.slots.some(s => !s) || tw.slots.some(s => s?.type === k && s.count < cap);
        const btn = document.createElement('button');
        btn.className = 'ttb tts2' + (hasRoom ? '' : ' off2');
        btn.style.cssText = 'font-size:9px;padding:2px 5px';
        btn.textContent = (rt?.icon || k) + ' +1';
        btn.onclick = e => {
          e.stopPropagation();
          if ((state.resources[k] || 0) <= 0) return;
          const cap2 = 64 << (tw.level || 0);
          for (let si = 0; si < tw.slots.length; si++) {
            const s = tw.slots[si];
            if (s && s.type === k && s.count < cap2) { s.count++; state.resources[k]--; refreshTT(tw); return; }
          }
          for (let si = 0; si < tw.slots.length; si++) {
            if (!tw.slots[si]) { tw.slots[si] = { type: k, count: 1 }; state.resources[k]--; refreshTT(tw); return; }
          }
        };
        depRow.appendChild(btn);
      }
      a.appendChild(depRow);
    }

    if (tw.level < 3) {
      const uc = 30 + tw.level * 40;
      addTTB(a, '⬆ Capacity 💰' + uc, 'ttu', state.gold >= uc, () => {
        _ΨΔ(() => { if (state.gold < uc) return; state.gold -= uc; tw.level++; });
        refreshTT(tw);
      });
    }
  }

  if (ifaceUnlocked) {
    if (!isInterface) {
      addTTB(a, '→ Interface Mode', 'tts2', true, () => {
        const hasItems = tw.slots?.some(s => s && s.count > 0);
        if (hasItems) {
          showOv('Switch to Interface Mode?', 'Stored items will be destroyed. Continue?', 'Switch', false, () => {
            tw.mode = 'interface'; tw.slots = [null, null, null, null];
            hideOv(); refreshTT(tw);
          }, () => hideOv());
        } else {
          tw.mode = 'interface'; refreshTT(tw);
        }
      });
    } else {
      addTTB(a, '→ Storage Mode', 'tts2', true, () => {
        tw.mode = 'storage'; tw.slots = [null, null, null, null];
        refreshTT(tw);
      });
    }
  }
}

export function showTT(tw, px, py) {
  _ttPx = px; _ttPy = py;
  hideTdesc();
  state.ttTower = tw;
  const el = document.getElementById('tt');
  const isH = tw.type === 'hoard', def = TD[tw.type];
  document.getElementById('ttT').textContent = (isH ? 'Hoard Pile' : def?.name || tw.type) + (tw.level > 0 ? ' ★' + tw.level : '');
  let s = '';
  if (isH) {
    const hl = HOARD_LEVELS[tw.level || 0] ?? HOARD_LEVELS[0];
    const stored = tw.stored || 0;
    const income = hl.base + Math.floor(stored * hl.m);
    const decay = Math.max(1, Math.floor(stored * (tw._monkeyBoosted ? 0.05 : 0.1)));
    s = `${stored}/${hl.cap} · +${income}💰/wave · -${decay}⬇${tw._monkeyBoosted ? ' 🐵' : ''}`;
  }
  else if (tw.type === 'clam') { s = 'Buff radius: ' + (tw.buffRange || 2).toFixed(1) + ' · +50%DMG -15%CD'; }
  else if (tw.type === 'beehive') { s = 'Bees: ' + (tw.beeCount || 3) + ' · Bee DMG: ' + (tw.beeDmg || 4); }
  else if (tw.type === 'clown') { s = 'Reverse rng:' + (tw.reverseRange || 3) + ' dur:' + (tw.reverseDur || 80); }
  else if (tw.type === 'monkey') { const mc = tw.monkeys?.length ?? 0; s = mc + ' Monke' + (mc === 1 ? 'y' : 'ys') + ' · Range:' + (tw.range || 4); }
  else if (tw.type === 'stockpile') {
    const ifaceUnlocked = !!state.researchUnlocks?.stockpile_interface;
    const cap = 64 << (tw.level || 0);
    if (ifaceUnlocked) {
      s = tw.mode === 'interface' ? 'Interface · Items → Inventory' : 'Storage · ' + cap + '/slot · 4 slots';
    } else {
      s = 'Resource storage · ' + cap + '/slot · 4 slots';
    }
  }
  else if (tw.type === 'robot') { s = 'Auto-casts spells!'; }
  else if (tw.type === 'lab') { s = 'Observation radius: ' + (tw.obsRange || 3) + ' · Gathers 🔮 Dust'; }
  else if (tw.type === 'workbench') {
    const qi = tw.craftQueue ? RECIPES.find(r => r.id === tw.craftQueue.recipeId)?.name || '?' : null;
    const sel = tw.selectedRecipe ? RECIPES.find(r => r.id === tw.selectedRecipe)?.name || '?' : null;
    s = (qi ? 'Crafting: ' + qi : sel ? 'Ready: ' + sel : 'Idle — select recipe');
  }
  else { s = 'DMG:' + tw.dmg + ' RNG:' + tw.range?.toFixed(1) + ' CD:' + tw.rate; if (tw.slow > 0) s += ' Slow:' + Math.floor(tw.slow * 100) + '%'; if (tw.splash > 0) s += ' Spl:' + tw.splash.toFixed(1); if (tw.pierce) s += ' Prc:' + tw.pierce; if (tw.chain) s += ' Chn:' + tw.chain; if (tw._buffed) s += ' 🐚'; }
  document.getElementById('ttS').textContent = s;

  const a = document.getElementById('ttA'); a.innerHTML = '';
  const sell = () => { hideTT(); state.ttTower = null; hudU(); panelU(); };
  {
    const upgs = TOWER_UPGS[tw.type];
    if (upgs && tw.level < upgs.length) {
      const upg = upgs[tw.level];
      addTTB(a, upg.name + '  💰' + upg.cost, 'ttu', state.gold >= upg.cost, () => { _ΨΔ(() => doUpg(tw)); refreshTT(tw); });
    }
  }
  if (isH) {
    const hl = HOARD_LEVELS[tw.level || 0] ?? HOARD_LEVELS[0];
    const cap = hl.cap;
    const stored = tw.stored || 0;
    const space = cap - stored;
    for (const [rk, rt] of Object.entries(RTYPES)) {
      if (rk === 'dust') continue;
      const have = state.resources[rk] || 0;
      if (have <= 0) continue;
      const depOne = space > 0;
      const depAll = space > 0;
      const allAmt = Math.min(have, space);
      addTTB(a, rt.icon + '+1', 'tts2', depOne, () => {
        _ΨΔ(() => { state.resources[rk]--; tw.stored = (tw.stored || 0) + 1; });
        refreshTT(tw);
      });
      if (allAmt > 1) addTTB(a, rt.icon + 'All(' + allAmt + ')', 'tts2', depAll, () => {
        _ΨΔ(() => { state.resources[rk] -= allAmt; tw.stored = (tw.stored || 0) + allAmt; });
        refreshTT(tw);
      });
    }
    if (tw.level < HOARD_UPGS.length) {
      const upg = HOARD_UPGS[tw.level];
      let afford = state.gold >= upg.c;
      let costStr = '💰' + upg.c;
      for (const [r, n] of Object.entries(upg.rs)) {
        if ((state.resources[r] || 0) < n) afford = false;
        costStr += ' ' + (RTYPES[r]?.icon || r) + n;
      }
      const nextHl = HOARD_LEVELS[tw.level + 1];
      addTTB(a, `⬆ ${costStr} → cap${nextHl.cap} ${nextHl.m.toFixed(1)}x`, 'ttu', afford, () => {
        _ΨΔ(() => {
          state.gold -= upg.c;
          for (const [r, n] of Object.entries(upg.rs)) state.resources[r] -= n;
          tw.level++;
        });
        refreshTT(tw);
      });
    }
  }
  if (tw.type === 'stockpile') buildStockpileTT(tw, a);
  if (tw.type === 'lab') {
    addTTB(a, '🔬 Research', 'tts2', !!state.research, () => { hideTT(); state.ttTower = null; showResearch(); });
    if (state.patternRecDone && state.translationStep > 0) {
      addTTB(a, '📜 Observation Log', 'tts2', true, () => _showObsLog());
    }
  }
  if (tw.type === 'monkey') buildMonkeyTT(tw, a);
  if (tw.type === 'workbench') {
    const inv = tw.inv || {};
    const stockRow = document.createElement('div');
    stockRow.style.cssText = 'width:100%;display:flex;gap:4px;flex-wrap:wrap;margin-bottom:2px';
    for (const k of ['wood', 'stone']) {
      const rt = RTYPES[k];
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;align-items:center;gap:3px;background:#0d1525;border-radius:4px;padding:2px 6px;font-size:10px;color:#94a3b8';
      const lbl = document.createElement('span');
      lbl.textContent = rt.icon + ' ' + (inv[k] || 0) + '/20';
      wrap.appendChild(lbl);
      const have = state.resources[k] || 0;
      if (have > 0) {
        const btn = document.createElement('button');
        btn.className = 'ttb tts2';
        btn.style.cssText = 'font-size:9px;padding:1px 4px';
        btn.textContent = '+1';
        btn.onclick = e => {
          e.stopPropagation();
          if ((state.resources[k] || 0) <= 0) return;
          state.resources[k]--;
          if (!tw.inv) tw.inv = {};
          tw.inv[k] = (tw.inv[k] || 0) + 1;
          refreshTT(tw);
        };
        wrap.appendChild(btn);
      }
      stockRow.appendChild(wrap);
    }
    a.appendChild(stockRow);
    addTTB(a, '⚒️ Open', 'ttc', true, () => { hideTT(); state.ttTower = null; openCraftPanel(tw); });
  }
  if (TD[tw.type]?.cat === 'tower') {
    const slots = (tw.level || 0) >= 5 ? 2 : (tw.level || 0) >= 3 ? 1 : 0;
    const augs = tw.augments || [];
    for (let i = 0; i < slots; i++) {
      if (augs[i]) {
        addTTB(a, '🔧 ' + augs[i].icon + ' ' + augs[i].name + ' ✕', 'tts2', true, () => {
          const removed = removeAugment(tw, i);
          if (removed) {
            addToInventory('augments', { id: removed.id, icon: removed.icon, name: removed.name });
            showBanner('🔧 ' + removed.name + ' removed');
            refreshTT(tw);
          }
        });
      } else {
        const hasAugs = (state.inventory?.augments?.length || 0) > 0;
        addTTB(a, '🔧 + Augment', 'tts2', hasAugs, () => {
          openInventoryForAugment(tw, () => refreshTT(tw));
        });
      }
    }
  }
  if (TOWER_SKILLS[tw.type]) { addTTB(a, '⚡Skill', 'ttc', true, () => { showTowerSkill(tw); hideTT(); state.ttTower = null; }); }
  const sv = Math.floor(def.cost * 0.5);
  addTTB(a, 'Sell +💰' + sv, 'ttl', true, () => {
    const hasStored = tw.type === 'stockpile' && tw.mode !== 'interface' && tw.slots?.some(s => s);
    const sellMsg = hasStored
      ? 'Selling this stockpile will destroy all stored items. You will receive 💰' + sv + '.'
      : 'Are you sure you want to sell this tower? You will receive 💰' + sv + '.';
    showOv('Sell ' + def.name + '?', sellMsg, 'Sell', false, () => {
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

const TOWER_UPGS = {
  squirrel: [
    { name:'+6 DMG',               cost: 30,  apply: tw => { tw.dmg += 6; } },
    { name:'+1.0 Range',            cost: 55,  apply: tw => { tw.range += 1.0; } },
    { name:'-14 Cooldown',          cost: 85,  apply: tw => { tw.rate = Math.max(5, tw.rate - 14); } },
    { name:'+10 DMG',               cost: 130, apply: tw => { tw.dmg += 10; } },
    { name:'+1.4 Range  −12 CD',    cost: 200, apply: tw => { tw.range += 1.4; tw.rate = Math.max(5, tw.rate - 12); } },
  ],
  lion: [
    { name:'+10 DMG',               cost: 45,  apply: tw => { tw.dmg += 10; } },
    { name:'-6 Cooldown',           cost: 75,  apply: tw => { tw.rate = Math.max(5, tw.rate - 6); } },
    { name:'+0.6 Range',            cost: 115, apply: tw => { tw.range += 0.6; } },
    { name:'+20 DMG',               cost: 170, apply: tw => { tw.dmg += 20; } },
    { name:'+15 DMG  −6 CD',        cost: 260, apply: tw => { tw.dmg += 15; tw.rate = Math.max(5, tw.rate - 6); } },
  ],
  penguin: [
    { name:'+20% Slow',             cost: 40,  apply: tw => { tw.slow = Math.min(0.95, tw.slow + 0.20); } },
    { name:'+4 DMG',                cost: 65,  apply: tw => { tw.dmg += 4; } },
    { name:'+0.8 Range',            cost: 100, apply: tw => { tw.range += 0.8; } },
    { name:'-10 Cooldown  +15% Slow',cost:150, apply: tw => { tw.rate = Math.max(5, tw.rate - 10); tw.slow = Math.min(0.95, tw.slow + 0.15); } },
    { name:'+6 DMG  +10% Slow',     cost: 230, apply: tw => { tw.dmg += 6; tw.slow = Math.min(0.95, tw.slow + 0.10); } },
  ],
  fish: [
    { name:'+8 DMG',                cost: 55,  apply: tw => { tw.dmg += 8; } },
    { name:'+0.6 Splash',           cost: 85,  apply: tw => { tw.splash += 0.6; } },
    { name:'-15 Cooldown',          cost: 130, apply: tw => { tw.rate = Math.max(5, tw.rate - 15); } },
    { name:'+12 DMG',               cost: 190, apply: tw => { tw.dmg += 12; } },
    { name:'+0.8 Splash',           cost: 280, apply: tw => { tw.splash += 0.8; } },
  ],
  seahorse: [
    { name:'+3 Pierce',             cost: 50,  apply: tw => { tw.pierce += 3; } },
    { name:'+6 DMG',                cost: 80,  apply: tw => { tw.dmg += 6; } },
    { name:'+1.0 Range',            cost: 125, apply: tw => { tw.range += 1.0; } },
    { name:'+4 Pierce  −10 CD',     cost: 180, apply: tw => { tw.pierce += 4; tw.rate = Math.max(5, tw.rate - 10); } },
    { name:'+10 DMG',               cost: 270, apply: tw => { tw.dmg += 10; } },
  ],
  lizard: [
    { name:'+20 DMG',               cost: 70,  apply: tw => { tw.dmg += 20; } },
    { name:'+0.6 Splash',           cost: 110, apply: tw => { tw.splash += 0.6; } },
    { name:'-18 Cooldown',          cost: 160, apply: tw => { tw.rate = Math.max(5, tw.rate - 18); } },
    { name:'+30 DMG',               cost: 240, apply: tw => { tw.dmg += 30; } },
    { name:'+0.5 Range  +0.6 Splash',cost:360, apply: tw => { tw.range += 0.5; tw.splash += 0.6; } },
  ],
  heron: [
    { name:'+2 Chain',              cost: 55,  apply: tw => { tw.chain += 2; } },
    { name:'+8 DMG',                cost: 90,  apply: tw => { tw.dmg += 8; } },
    { name:'+0.8 Range',            cost: 135, apply: tw => { tw.range += 0.8; } },
    { name:'+2 Chain',              cost: 200, apply: tw => { tw.chain += 2; } },
    { name:'+12 DMG  −12 CD',       cost: 300, apply: tw => { tw.dmg += 12; tw.rate = Math.max(5, tw.rate - 12); } },
  ],
  clam: [
    { name:'+0.5 Buff Range',       cost: 65,  apply: tw => { tw.buffRange += 0.5; } },
    { name:'+25% DMG Bonus',        cost: 110, apply: tw => { tw.buffDmg = +((tw.buffDmg + 0.25).toFixed(2)); } },
    { name:'+0.5 Buff Range',       cost: 165, apply: tw => { tw.buffRange += 0.5; } },
    { name:'−10% Cooldown Bonus',   cost: 240, apply: tw => { tw.buffRate = Math.max(0.5, +(tw.buffRate - 0.10).toFixed(2)); } },
    { name:'+0.5 Range  +25% DMG',  cost: 350, apply: tw => { tw.buffRange += 0.5; tw.buffDmg = +((tw.buffDmg + 0.25).toFixed(2)); } },
  ],
  beehive: [
    { name:'+3 Bees',               cost: 70,  apply: tw => { tw.beeCount += 3; spawnBees(tw); } },
    { name:'+5 Bee DMG',            cost: 110, apply: tw => { tw.beeDmg += 5; } },
    { name:'+3 Bees',               cost: 165, apply: tw => { tw.beeCount += 3; spawnBees(tw); } },
    { name:'+8 Bee DMG',            cost: 240, apply: tw => { tw.beeDmg += 8; } },
    { name:'+4 Bees  Faster Sting', cost: 350, apply: tw => { tw.beeCount += 4; tw.beeRate = Math.max(5, tw.beeRate - 8); spawnBees(tw); } },
  ],
  clown: [
    { name:'+0.5 Reverse Range',    cost: 75,  apply: tw => { tw.reverseRange += 0.5; } },
    { name:'+50 Reverse Duration',  cost: 115, apply: tw => { tw.reverseDur += 50; } },
    { name:'+0.5 Reverse Range',    cost: 170, apply: tw => { tw.reverseRange += 0.5; } },
    { name:'−60 Recharge',          cost: 245, apply: tw => { tw.reverseCD = Math.max(40, tw.reverseCD - 60); } },
    { name:'+0.5 Range  +80 Duration',cost:360, apply: tw => { tw.reverseRange += 0.5; tw.reverseDur += 80; } },
  ],
  monkey: [
    { name:'+0.5 Range',            cost: 80,  apply: tw => { tw.range += 0.5; } },
    { name:'+0.5 Range',            cost: 130, apply: tw => { tw.range += 0.5; } },
    { name:'+0.5 Range',            cost: 195, apply: tw => { tw.range += 0.5; } },
    { name:'+0.5 Range',            cost: 280, apply: tw => { tw.range += 0.5; } },
    { name:'+1 Range',              cost: 400, apply: tw => { tw.range += 1; } },
  ],
};

function doUpg(tw) {
  const upgs = TOWER_UPGS[tw.type];
  if (!upgs || tw.level >= upgs.length) return;
  const upg = upgs[tw.level];
  if (state.gold < upg.cost) return;
  state.gold -= upg.cost;
  upg.apply(tw);
  tw.level++;
  sfxPlace();
}

function doSell(tw, val) {
  state.gold += val;
  const sc = getCell(tw.x, tw.y); sc.type = 'empty'; sc.content = null;
  state.towers = state.towers.filter(x => x !== tw);
  state.bees = state.bees.filter(b => b.hive !== tw);
  _cleanupMonkeysForSoldTile(tw.x, tw.y);
}

function _cleanupMonkeysForSoldTile(sx, sy) {
  for (const hut of state.towers) {
    if (hut.type !== 'monkey' || !hut.monkeys) continue;
    for (const mk of hut.monkeys) {
      if (mk.role === 'harvester') {
        const src = mk.cfg.harvestSrc;
        if (src?.x === sx && src?.y === sy) { mk.cfg.harvestSrc = null; mk.st = 'idle'; }
        if (mk.cfg.dest?.x === sx && mk.cfg.dest?.y === sy) {
          if (mk.carrying) { dropItem(sx, sy, mk.carrying.type); mk.carrying = null; }
          mk.st = 'idle';
        }
        continue;
      }
      if (mk.role === 'round_robin' && mk.cfg.targets) {
        const before = mk.cfg.targets.length;
        mk.cfg.targets = mk.cfg.targets.filter(t => !(t.x === sx && t.y === sy));
        if (mk.cfg.targets.length !== before) {
          if ((mk.cfg.rrIdx || 0) >= mk.cfg.targets.length) mk.cfg.rrIdx = 0;
          if (mk.st === 'carrying' && mk.carrying) {
            dropItem(sx, sy, mk.carrying.type);
            mk.carrying = null;
          }
          mk.st = 'idle';
        }
        continue;
      }
      if (!mk.carrying) continue;
      const dest = mk.role === 'gatherer' ? mk.cfg.dest
                 : mk.role === 'courier'  ? (mk.st === 'carrying' ? mk.cfg.dest : mk.cfg.from)
                 : null;
      if (dest?.x === sx && dest?.y === sy) {
        dropItem(sx, sy, mk.carrying.type);
        mk.carrying = null;
        mk.st = 'idle';
      }
    }
  }
}

export function refreshActiveTT() { if (state.ttTower) refreshTT(state.ttTower); }

const ROLE_LABEL = { null: 'Idle 💤', gatherer: 'Gather 🌿', courier: 'Courier 🚚', booster: 'Boost 💪', round_robin: 'Round Robin 🔄', harvester: 'Harvest ⛏️' };
function getRoleCycle() {
  const roles = [null, 'gatherer', 'courier', 'booster'];
  if (state.researchUnlocks?.monkey_round_robin) roles.push('round_robin');
  if (state.researchUnlocks?.monkey_harvester) roles.push('harvester');
  return roles;
}
const FILTER_CYCLE = [null, 'wood', 'stone'];
const FILTER_LABEL = { null: 'All', wood: '🪵', stone: '🪨' };

function buildMonkeyTT(tw, container) {
  if (!tw.monkeys) return;
  for (const mk of tw.monkeys) {
    const block = document.createElement('div');
    block.style.cssText = 'display:flex;flex-direction:column;gap:3px;margin:4px 0;border-top:1px solid #334155;padding-top:4px';

    // Row 1: name + role cycle + trip count
    const row1 = document.createElement('div');
    row1.style.cssText = 'display:flex;gap:4px;align-items:center';
    const nameEl = document.createElement('span');
    nameEl.style.cssText = 'color:#fb923c;font-size:10px;font-weight:700;flex-shrink:0';
    nameEl.textContent = mk.name;
    row1.appendChild(nameEl);
    addTTB(row1, ROLE_LABEL[mk.role] ?? 'Idle 💤', 'tts2', true, () => {
      const cycle = getRoleCycle();
      const idx = cycle.indexOf(mk.role);
      mk.role = cycle[(idx + 1) % cycle.length];
      mk.cfg = { filter: null, dest: null, from: null, boost: null, targets: [], rrIdx: 0 };
      mk.st = 'idle'; mk.carrying = null;
      refreshTT(tw);
    });
    if (mk.trips > 0) {
      const tripEl = document.createElement('span');
      tripEl.style.cssText = 'color:#64748b;font-size:9px;margin-left:2px';
      tripEl.textContent = mk.trips + ' trip' + (mk.trips === 1 ? '' : 's');
      row1.appendChild(tripEl);
    }
    block.appendChild(row1);

    // Row 2: role-specific controls all on one row
    if (mk.role === 'gatherer') {
      const row2 = document.createElement('div');
      row2.style.cssText = 'display:flex;gap:4px;align-items:center;flex-wrap:wrap';
      addTTB(row2, 'Filter:' + FILTER_LABEL[mk.cfg.filter ?? null], 'tts2', true, () => {
        const fi = FILTER_CYCLE.indexOf(mk.cfg.filter ?? null);
        mk.cfg.filter = FILTER_CYCLE[(fi + 1) % FILTER_CYCLE.length] ?? null;
        refreshTT(tw);
      });
      const destLbl = mk.cfg.dest ? `Dest:(${mk.cfg.dest.x},${mk.cfg.dest.y})` : 'Set Dest 📍';
      addTTB(row2, destLbl, 'tts2', true, () => {
        state.sel = { type: 'tile_pick', monkey: mk, hut: tw, field: 'dest' };
        hideTT(); state.ttTower = null; panelU();
      });
      block.appendChild(row2);
    }

    if (mk.role === 'courier') {
      const row2 = document.createElement('div');
      row2.style.cssText = 'display:flex;gap:4px;align-items:center;flex-wrap:wrap';
      addTTB(row2, 'Filter:' + FILTER_LABEL[mk.cfg.filter ?? null], 'tts2', true, () => {
        const fi = FILTER_CYCLE.indexOf(mk.cfg.filter ?? null);
        mk.cfg.filter = FILTER_CYCLE[(fi + 1) % FILTER_CYCLE.length] ?? null;
        refreshTT(tw);
      });
      const fromLbl = mk.cfg.from ? `From:(${mk.cfg.from.x},${mk.cfg.from.y})` : 'Set From 📍';
      addTTB(row2, fromLbl, 'tts2', true, () => {
        state.sel = { type: 'tile_pick', monkey: mk, hut: tw, field: 'from' };
        hideTT(); state.ttTower = null; panelU();
      });
      const toLbl = mk.cfg.dest ? `To:(${mk.cfg.dest.x},${mk.cfg.dest.y})` : 'Set To 📍';
      addTTB(row2, toLbl, 'tts2', true, () => {
        state.sel = { type: 'tile_pick', monkey: mk, hut: tw, field: 'dest' };
        hideTT(); state.ttTower = null; panelU();
      });
      block.appendChild(row2);
    }

    if (mk.role === 'booster') {
      const row2 = document.createElement('div');
      row2.style.cssText = 'display:flex;gap:4px;align-items:center';
      const bLbl = mk.cfg.boost ? `Boost:(${mk.cfg.boost.x},${mk.cfg.boost.y})` : 'Set Target 📍';
      addTTB(row2, bLbl, 'tts2', true, () => {
        state.sel = { type: 'tile_pick', monkey: mk, hut: tw, field: 'boost' };
        hideTT(); state.ttTower = null; panelU();
      });
      block.appendChild(row2);
    }

    if (mk.role === 'harvester') {
      const row2 = document.createElement('div');
      row2.style.cssText = 'display:flex;gap:4px;align-items:center;flex-wrap:wrap';
      const src = mk.cfg.harvestSrc;
      const srcLbl = src ? (src.isForest ? `Forest(${src.x},${src.y})` : `Rock(${src.x},${src.y})`) : 'Set Source 📍';
      addTTB(row2, srcLbl, 'tts2', true, () => {
        state.sel = { type: 'tile_pick', monkey: mk, hut: tw, field: 'harvestSrc' };
        hideTT(); state.ttTower = null; panelU();
      });
      const destLbl = mk.cfg.dest ? `Dest(${mk.cfg.dest.x},${mk.cfg.dest.y})` : 'Set Dest 📍';
      addTTB(row2, destLbl, 'tts2', true, () => {
        state.sel = { type: 'tile_pick', monkey: mk, hut: tw, field: 'dest' };
        hideTT(); state.ttTower = null; panelU();
      });
      block.appendChild(row2);
    }

    if (mk.role === 'round_robin') {
      const row2 = document.createElement('div');
      row2.style.cssText = 'display:flex;gap:4px;align-items:center;flex-wrap:wrap';
      addTTB(row2, 'Filter:' + FILTER_LABEL[mk.cfg.filter ?? null], 'tts2', true, () => {
        const fi = FILTER_CYCLE.indexOf(mk.cfg.filter ?? null);
        mk.cfg.filter = FILTER_CYCLE[(fi + 1) % FILTER_CYCLE.length] ?? null;
        refreshTT(tw);
      });
      const targets = mk.cfg.targets || [];
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        addTTB(row2, `T${i+1}:(${t.x},${t.y}) ✕`, 'tts2', true, () => {
          mk.cfg.targets.splice(i, 1);
          if ((mk.cfg.rrIdx || 0) >= mk.cfg.targets.length) mk.cfg.rrIdx = 0;
          refreshTT(tw);
        });
      }
      if (targets.length < 5) {
        addTTB(row2, '+ Target 📍', 'tts2', true, () => {
          state.sel = { type: 'tile_pick', monkey: mk, hut: tw, field: 'rr_add_target' };
          hideTT(); state.ttTower = null; panelU();
        });
      }
      block.appendChild(row2);
    }

    container.appendChild(block);
  }
}
