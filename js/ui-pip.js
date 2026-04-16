'use strict';
import { state, _ΨΔ } from './main.js';
import { ARTIFACTS, RARITY_COLORS } from './artifacts.js';
import { addToInventory } from './ui-inventory.js';
import { syncPause, showBanner, hudU, panelU } from './ui.js';

const PIP_CONSUMABLES = [
  { id: 'stone_trap', icon: '🪤', name: 'Stone Trap', desc: 'Place on path: 30 dmg to first enemy that steps on it.', cost: 12 },
  { id: 'sticky_sap', icon: '🍯', name: 'Sticky Sap',  desc: 'Place on path: 40% slow to all enemies crossing for 10s.', cost: 15 },
];

const PIP_BLUEPRINTS = [
  { id: 'bp_clam', icon: '🐚', name: 'Clam Blueprint', desc: 'Unlocks the Clam support building.', cost: 80, unlocks: 'clam', blueprint: true },
];

const SELL_ITEMS = [
  { type: 'stone', icon: '🪨', name: 'Stone', price: 5 },
  { type: 'wood',  icon: '🪵', name: 'Wood',  price: 5 },
];

// ─── Stock management ─────────────────────────────────────────────────────────

export function refreshPipStock() {
  if (!state.pip) state.pip = { cStock: [], cWave: 0, bBought: {}, aSold: {} };
  if (state.pip.cWave === state.wave) return;
  state.pip.cWave = state.wave;
  const shuffled = [...PIP_CONSUMABLES].sort(() => Math.random() - 0.5);
  const count = Math.random() < 0.4 ? 3 : 2;
  state.pip.cStock = shuffled.slice(0, Math.min(count, shuffled.length)).map(c => ({
    ...c, qty: 1 + (Math.random() < 0.5 ? 1 : 0),
  }));
}

export function syncPipBtn() {
  const btn = document.getElementById('pipBtn');
  if (!btn) return;
  btn.style.display = (state.started && state.wave >= 4) ? '' : 'none';
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function _mkSec(title) {
  const sec = document.createElement('div');
  sec.className = 'pip-section';
  const h = document.createElement('div');
  h.className = 'pip-section-title';
  h.textContent = title;
  sec.appendChild(h);
  return sec;
}

function _mkNote(text) {
  const el = document.createElement('div');
  el.className = 'pip-note';
  el.textContent = text;
  return el;
}

function _mkEmpty(text) {
  const el = document.createElement('div');
  el.className = 'pip-empty';
  el.textContent = text;
  return el;
}

function _mkBuyRow(item, canBuy, onBuy, soldText) {
  const row = document.createElement('div');
  row.className = 'pip-row' + (canBuy ? '' : ' pip-row-sold');

  const left = document.createElement('div');
  left.className = 'pip-row-left';

  const ic = document.createElement('span');
  ic.className = 'pip-row-ic';
  if (item.blueprint) {
    ic.className += ' pip-bp-ic';
    ic.innerHTML = '<span class="pip-bp-base">🟦</span><span class="pip-bp-overlay">' + item.icon + '</span>';
  } else {
    ic.textContent = item.icon;
  }
  left.appendChild(ic);

  const info = document.createElement('div');
  info.className = 'pip-row-info';

  const nm = document.createElement('div');
  nm.className = 'pip-row-nm';
  nm.textContent = item.name;
  if (item.rarity) {
    const dot = document.createElement('span');
    dot.className = 'pip-rarity';
    dot.style.color = RARITY_COLORS[item.rarity] || '#94a3b8';
    dot.textContent = ' ● ' + item.rarity;
    nm.appendChild(dot);
  }
  info.appendChild(nm);

  if (item.desc) {
    const desc = document.createElement('div');
    desc.className = 'pip-row-desc';
    desc.textContent = item.desc;
    info.appendChild(desc);
  }
  if (item.qty !== undefined) {
    const qty = document.createElement('div');
    qty.className = 'pip-row-qty';
    qty.textContent = 'Stock: ' + item.qty;
    info.appendChild(qty);
  }
  left.appendChild(info);
  row.appendChild(left);

  const btn = document.createElement('button');
  btn.className = 'pip-buy-btn';
  if (!canBuy) {
    btn.textContent = soldText || 'Sold';
    btn.disabled = true;
  } else {
    btn.textContent = item.cost + 'g';
    btn.addEventListener('click', onBuy);
  }
  row.appendChild(btn);

  return row;
}

// ─── Live update ─────────────────────────────────────────────────────────────

export function updatePipPanel() {
  const p = document.getElementById('pipP');
  if (!p?.classList.contains('sh')) return;
  for (const it of SELL_ITEMS) {
    const qty = state.resources[it.type] || 0;
    const lbl = p.querySelector('[data-sell-label="' + it.type + '"]');
    if (lbl) lbl.textContent = it.icon + ' ' + it.name + ' ×' + qty;
    const btn = p.querySelector('[data-sell-btn="' + it.type + '"]');
    if (btn) btn.disabled = qty <= 0;
  }
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderPip() {
  const c = document.getElementById('pipC');
  if (!c || !state.pip) return;
  c.innerHTML = '';

  // Portrait
  const portrait = document.createElement('div');
  portrait.className = 'pip-portrait';
  const img = document.createElement('img');
  img.src = 'assets/pip.png';
  img.alt = 'Pip';
  img.onerror = () => { portrait.style.display = 'none'; };
  portrait.appendChild(img);
  c.appendChild(portrait);

  // Sell Resources
  const sellSec = _mkSec('💰 Sell Resources');
  const sellGrid = document.createElement('div');
  sellGrid.className = 'pip-sell-grid';
  for (const it of SELL_ITEMS) {
    const qty = state.resources[it.type] || 0;
    const row = document.createElement('div');
    row.className = 'pip-sell-row';
    const lbl = document.createElement('span');
    lbl.className = 'pip-sell-label';
    lbl.dataset.sellLabel = it.type;
    lbl.textContent = it.icon + ' ' + it.name + ' ×' + qty;
    const btn = document.createElement('button');
    btn.className = 'pip-sell-btn';
    btn.dataset.sellBtn = it.type;
    btn.textContent = 'Sell 1 · +' + it.price + 'g';
    btn.disabled = qty <= 0;
    btn.addEventListener('click', () => {
      if ((state.resources[it.type] || 0) <= 0) return;
      state.resources[it.type]--;
      _ΨΔ(() => { state.gold += it.price; });
      renderPip();
      hudU();
    });
    row.appendChild(lbl);
    row.appendChild(btn);
    sellGrid.appendChild(row);
  }
  sellSec.appendChild(sellGrid);
  c.appendChild(sellSec);

  // Consumables
  const conSec = _mkSec('🧪 Consumables');
  conSec.appendChild(_mkNote('Stock refreshes each wave'));
  const cStock = state.pip.cStock || [];
  if (cStock.length === 0) {
    conSec.appendChild(_mkEmpty('Nothing in stock.'));
  } else {
    for (const item of cStock) {
      conSec.appendChild(_mkBuyRow(item, item.qty > 0, () => {
        if (state.gold < item.cost) { showBanner('⚠️ Not enough gold'); return; }
        _ΨΔ(() => { state.gold -= item.cost; });
        item.qty--;
        addToInventory('consumables', { id: item.id, icon: item.icon, name: item.name, desc: item.desc, output: 'consumable' });
        renderPip(); hudU();
      }, 'Out of stock'));
    }
  }
  c.appendChild(conSec);

  // Blueprints
  const bpSec = _mkSec('📋 Blueprints');
  bpSec.appendChild(_mkNote('One-time purchase'));
  for (const bp of PIP_BLUEPRINTS) {
    const bought = !!(state.pip.bBought[bp.id]);
    const alreadyOwned = state.unlockedTowers?.has(bp.unlocks);
    bpSec.appendChild(_mkBuyRow(bp, !bought && !alreadyOwned, () => {
      if (state.gold < bp.cost) { showBanner('⚠️ Not enough gold'); return; }
      _ΨΔ(() => { state.gold -= bp.cost; });
      state.pip.bBought[bp.id] = true;
      state.unlockedTowers.add(bp.unlocks);
      addToInventory('blueprints', { id: bp.id, icon: '🟦', bpOverlay: bp.icon, name: bp.name });
      renderPip(); hudU(); panelU();
      showBanner('📋 ' + bp.name + ' acquired!');
    }, bought || alreadyOwned ? 'Owned' : 'Sold'));
  }
  c.appendChild(bpSec);

  // Artifacts
  const artSec = _mkSec('✨ Artifacts');
  artSec.appendChild(_mkNote('Rare items — never restocks'));
  for (const art of ARTIFACTS) {
    const sold = !!(state.pip.aSold[art.id]);
    artSec.appendChild(_mkBuyRow(art, !sold, () => {
      if (state.gold < art.cost) { showBanner('⚠️ Not enough gold'); return; }
      _ΨΔ(() => { state.gold -= art.cost; });
      state.pip.aSold[art.id] = true;
      addToInventory('artifacts', { id: art.id, icon: art.icon, name: art.name, rarity: art.rarity, desc: art.desc });
      renderPip(); hudU();
      showBanner('✨ ' + art.name + ' acquired!');
    }));
  }
  c.appendChild(artSec);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initPipUI() {
  document.getElementById('pipBtn')?.addEventListener('click', () => {
    const p = document.getElementById('pipP');
    if (!p) return;
    if (p.classList.contains('sh')) {
      p.classList.remove('sh');
    } else {
      if (!state.pip) refreshPipStock();
      renderPip();
      p.classList.add('sh');
    }
    syncPause();
  });
  document.getElementById('pipClose')?.addEventListener('click', () => {
    document.getElementById('pipP')?.classList.remove('sh');
    syncPause();
  });
}
