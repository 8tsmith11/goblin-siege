'use strict';
import { state } from './main.js';
import { showTip, syncPause } from './ui.js';
import { RARITY_COLORS } from './artifacts.js';

const INV_MAX = 512;
let _invSel = null; // { source: 'inv'|'equip', section: string, index: number }

const INV_ROW = 6; // slots per row

function _slotsToShow(arr) {
  const filled = arr.length;
  const rows = Math.max(1, Math.ceil((filled + 1) / INV_ROW));
  return rows * INV_ROW;
}

function renderInventory() {
  const c = document.getElementById('invC');
  if (!c) return;
  const inv = state.inventory;
  if (!inv) return;
  c.innerHTML = '';

  const artSec = document.createElement('div');
  artSec.className = 'inv-section';
  const artTitle = document.createElement('div');
  artTitle.className = 'inv-section-title';
  artTitle.textContent = 'Artifacts';
  artSec.appendChild(artTitle);

  const eqLabel = document.createElement('div');
  eqLabel.className = 'inv-equipped-label';
  eqLabel.textContent = 'Equipped';
  artSec.appendChild(eqLabel);
  const eqGrid = document.createElement('div');
  eqGrid.className = 'inv-grid';
  eqGrid.style.marginBottom = '12px';
  for (let i = 0; i < 3; i++) {
    const item = inv.equipped[i];
    const isSel = _invSel?.source === 'equip' && _invSel?.index === i;
    const cell = document.createElement('div');
    cell.className = 'inv-cell equip-slot' + (item ? ' filled' : '') + (isSel ? ' sel' : '');
    if (item) {
      cell.innerHTML = '<div class="inv-ic">' + item.icon + '</div><div class="inv-nm">' + item.name + '</div>';
    } else {
      cell.innerHTML = '<div style="font-size:22px;opacity:.25">○</div><div class="inv-nm" style="color:#374151">Empty</div>';
    }
    cell.addEventListener('click', () => _invClickEquip(i));
    eqGrid.appendChild(cell);
  }
  artSec.appendChild(eqGrid);

  const artGrid = document.createElement('div');
  artGrid.className = 'inv-grid';
  const artSlots = _slotsToShow(inv.artifacts);
  for (let i = 0; i < artSlots; i++) {
    const item = inv.artifacts[i];
    if (item) {
      const isSel = _invSel?.source === 'inv' && _invSel?.section === 'artifacts' && _invSel?.index === i;
      const cell = _mkInvCell(item, isSel);
      cell.addEventListener('click', () => _invClickItem('artifacts', i));
      artGrid.appendChild(cell);
    } else {
      const cell = document.createElement('div');
      cell.className = 'inv-cell empty-slot';
      artGrid.appendChild(cell);
    }
  }
  artSec.appendChild(artGrid);
  c.appendChild(artSec);

  const sections = [
    { key: 'augments',    label: 'Tower Augments' },
    { key: 'blueprints',  label: 'Blueprints' },
    { key: 'consumables', label: 'Consumables' },
  ];
  for (const { key, label } of sections) {
    const sec = document.createElement('div');
    sec.className = 'inv-section';
    const title = document.createElement('div');
    title.className = 'inv-section-title';
    title.textContent = label;
    sec.appendChild(title);
    const grid = document.createElement('div');
    grid.className = 'inv-grid';
    const arr = inv[key] || [];
    const slots = _slotsToShow(arr);
    for (let i = 0; i < slots; i++) {
      const item = arr[i];
      if (item) {
        const isSel = _invSel?.source === 'inv' && _invSel?.section === key && _invSel?.index === i;
        const cell = _mkInvCell(item, isSel);
        cell.addEventListener('click', () => _invClickItem(key, i));
        grid.appendChild(cell);
      } else {
        const cell = document.createElement('div');
        cell.className = 'inv-cell empty-slot';
        grid.appendChild(cell);
      }
    }
    sec.appendChild(grid);
    c.appendChild(sec);
  }
}

function _mkInvCell(item, selected) {
  const cell = document.createElement('div');
  cell.className = 'inv-cell' + (selected ? ' sel' : '');
  const countBadge = (item.count && item.count > 1) ? '<div class="inv-cnt">x' + item.count + '</div>' : '';
  const rarityBadge = item.rarity
    ? '<div class="inv-rarity" style="color:' + (RARITY_COLORS[item.rarity] || '#94a3b8') + '">●</div>'
    : '';
  const iconHtml = item.bpOverlay
    ? '<div class="inv-ic pip-bp-ic"><span class="pip-bp-base">' + item.icon + '</span><span class="pip-bp-overlay">' + item.bpOverlay + '</span></div>'
    : '<div class="inv-ic">' + item.icon + '</div>';
  cell.innerHTML = iconHtml + '<div class="inv-nm">' + item.name + '</div>' + countBadge + rarityBadge;
  return cell;
}

function _renderInvActions() {
  const el = document.getElementById('invActions');
  if (!el) return;
  el.innerHTML = '';
  if (!_invSel || _invSel.source !== 'inv') return;
  const inv = state.inventory;
  const item = inv[_invSel.section]?.[_invSel.index];
  if (!item) return;
  if (_invSel.section === 'augments') {
    const btn = document.createElement('button');
    btn.className = 'inv-use-btn inv-use-aug';
    btn.textContent = '⚡ Apply to Tower';
    btn.onclick = () => {
      const i = _invSel.index;
      const it = state.inventory.augments[i];
      if (!it) return;
      document.getElementById('invP')?.classList.remove('sh');
      _invSel = null;
      syncPause();
      state.sel = { type: 'augment_pick', item: it, invIndex: i };
      showTip('Click a tower to apply the augment');
    };
    el.appendChild(btn);
  } else if (_invSel.section === 'consumables') {
    const btn = document.createElement('button');
    btn.className = 'inv-use-btn inv-use-con';
    btn.textContent = '📍 Place on Path';
    btn.onclick = () => {
      const i = _invSel.index;
      const it = state.inventory.consumables[i];
      if (!it) return;
      document.getElementById('invP')?.classList.remove('sh');
      _invSel = null;
      syncPause();
      state.sel = { type: 'consumable_pick', item: { ...it }, index: i };
      showTip('Click a path tile to place the consumable');
    };
    el.appendChild(btn);
  }
}

function _invClickItem(section, index) {
  if (section !== 'artifacts') {
    if (_invSel?.source === 'inv' && _invSel?.section === section && _invSel?.index === index) {
      _invSel = null;
    } else {
      _invSel = { source: 'inv', section, index };
    }
    renderInventory();
    _renderInvActions();
    return;
  }
  if (_invSel?.source === 'equip') {
    const eqIdx = _invSel.index;
    const inv = state.inventory;
    const artifact = inv.artifacts[index];
    const was = inv.equipped[eqIdx];
    inv.equipped[eqIdx] = artifact;
    if (was) {
      inv.artifacts[index] = was;
    } else {
      inv.artifacts.splice(index, 1);
    }
    _invSel = null;
  } else if (_invSel?.source === 'inv' && _invSel?.section === 'artifacts' && _invSel?.index === index) {
    _invSel = null;
  } else {
    _invSel = { source: 'inv', section: 'artifacts', index };
  }
  renderInventory();
  _renderInvActions();
}

function _invClickEquip(slotIndex) {
  const inv = state.inventory;
  if (_invSel?.source === 'inv' && _invSel?.section === 'artifacts') {
    const artIdx = _invSel.index;
    const artifact = inv.artifacts[artIdx];
    const was = inv.equipped[slotIndex];
    inv.equipped[slotIndex] = artifact;
    if (was) {
      inv.artifacts[artIdx] = was;
    } else {
      inv.artifacts.splice(artIdx, 1);
    }
    _invSel = null;
  } else if (_invSel?.source === 'equip' && _invSel?.index === slotIndex) {
    _invSel = null;
  } else if (_invSel?.source === 'equip') {
    const other = _invSel.index;
    [inv.equipped[slotIndex], inv.equipped[other]] = [inv.equipped[other], inv.equipped[slotIndex]];
    _invSel = null;
  } else {
    if (inv.equipped[slotIndex]) {
      _invSel = { source: 'equip', index: slotIndex };
    }
  }
  renderInventory();
}

export function initInventoryUI() {
  document.getElementById('invBtn')?.addEventListener('click', () => {
    const p = document.getElementById('invP');
    if (!p) return;
    if (p.classList.contains('sh')) {
      p.classList.remove('sh');
    } else {
      _invSel = null;
      renderInventory();
      p.classList.add('sh');
    }
    syncPause();
  });
  document.getElementById('invClose')?.addEventListener('click', () => {
    document.getElementById('invP')?.classList.remove('sh');
    _invSel = null;
    syncPause();
  });
}

export function addToInventory(section, item) {
  const inv = state.inventory;
  if (!inv) return;
  const arr = inv[section];
  if (!arr) return;
  if ((section === 'augments' || section === 'consumables') && item.id) {
    const existing = arr.find(e => e.id === item.id);
    if (existing) { existing.count = (existing.count || 1) + 1; return; }
    if (arr.length < INV_MAX) arr.push({ ...item, count: 1 });
  } else {
    if (arr.length < INV_MAX) arr.push(item);
  }
}
