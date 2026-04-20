'use strict';
import { state, _ΨΔ } from './main.js';
import { showTip, syncPause } from './ui.js';
import { RARITY_COLORS } from './artifacts.js';
import { applyAugment } from './craft.js';
import { sfxFreeze } from './audio.js';

const INV_MAX = 512;
let _invSel = null; // { source: 'inv'|'equip', section: string, index: number }
let _augTarget = null; // { tower, onApplied } — set when tower panel triggers augment pick

const INV_ROW = 6; // slots per row

function _slotsToShow(arr) {
  const filled = arr.length;
  const rows = Math.max(1, Math.ceil((filled + 1) / INV_ROW));
  return rows * INV_ROW;
}

export function syncInvBtn() {
  const btn = document.getElementById('invBtn');
  if (!btn) return;
  const inv = state.inventory;
  if (!inv) { btn.style.display = 'none'; return; }
  const seen = inv.seenSections || {};
  const hasAnything = seen.artifacts || seen.augments || seen.blueprints || seen.consumables;
  btn.style.display = hasAnything ? '' : 'none';
}

function _applyRarityStyle(cell, rarity) {
  if (!rarity) return;
  cell.dataset.rarity = rarity;
}

function renderInventory() {
  const c = document.getElementById('invC');
  if (!c) return;
  const inv = state.inventory;
  if (!inv) return;
  c.innerHTML = '';
  const seen = inv.seenSections || {};

  if (seen.artifacts) {
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
    for (let i = 0; i < inv.equipped.length; i++) {
      const item = inv.equipped[i];
      const isSel = _invSel?.source === 'equip' && _invSel?.index === i;
      const cell = document.createElement('div');
      cell.className = 'inv-cell equip-slot' + (item ? ' filled' : '') + (isSel ? ' sel' : '');
      if (item) {
        _applyRarityStyle(cell, item.rarity);
        cell.dataset.tipName = item.name;
        if (item.rarity) cell.dataset.tipRarity = item.rarity;
        if (item.desc) cell.dataset.tipDesc = item.desc;
        cell.innerHTML = '<div class="inv-ic">' + item.icon + '</div><div class="inv-nm">' + item.name + '</div>';
      } else {
        cell.innerHTML = '<div style="font-size:22px;opacity:.25">○</div><div class="inv-nm" style="color:#374151">Empty</div>';
      }
      cell.addEventListener('click', () => _invClickEquip(i));
      eqGrid.appendChild(cell);
    }
    artSec.appendChild(eqGrid);

    // Active artifact action buttons
    const activeArts = inv.equipped.filter(a => a?.active);
    if (activeArts.length > 0) {
      const actRow = document.createElement('div');
      actRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px';
      for (const art of activeArts) {
        if (!art.cdWavesLeft) art.cdWavesLeft = 0;
        const canUse = art.cdWavesLeft === 0 && state.phase === 'active';
        const btn = document.createElement('button');
        btn.className = 'inv-use-btn' + (canUse ? '' : ' off2');
        btn.style.cssText = 'position:relative;padding:6px 12px;font-size:12px';
        btn.textContent = art.icon + ' ' + art.name;
        if (art.cdWavesLeft > 0) {
          const cd = document.createElement('div');
          cd.style.cssText = 'font-size:9px;color:#f87171';
          cd.textContent = art.cdWavesLeft + ' waves';
          btn.appendChild(cd);
        }
        if (canUse) btn.onclick = () => _activateArtifact(art);
        actRow.appendChild(btn);
      }
      artSec.appendChild(actRow);
    }

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
  }

  const sections = [
    { key: 'augments',    label: 'Tower Augments' },
    { key: 'blueprints',  label: 'Blueprints' },
    { key: 'consumables', label: 'Consumables' },
  ];
  for (const { key, label } of sections) {
    if (!seen[key]) continue;
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
  if (item.rarity) _applyRarityStyle(cell, item.rarity);
  cell.dataset.tipName = item.name;
  if (item.rarity) cell.dataset.tipRarity = item.rarity;
  if (item.desc) cell.dataset.tipDesc = item.desc;
  const countBadge = (item.count && item.count > 1) ? '<div class="inv-cnt">×' + item.count + '</div>' : '';
  const iconHtml = item.bpOverlay
    ? '<div class="inv-ic pip-bp-ic"><span class="pip-bp-base">' + item.icon + '</span><span class="pip-bp-overlay">' + item.bpOverlay + '</span></div>'
    : '<div class="inv-ic">' + item.icon + '</div>';
  cell.innerHTML = iconHtml + '<div class="inv-nm">' + item.name + '</div>' + countBadge;
  return cell;
}

function _renderInvActions() {
  const el = document.getElementById('invActions');
  if (!el) return;
  el.innerHTML = '';
  if (!_invSel) return;

  if (_invSel.source === 'equip') {
    const item = state.inventory.equipped[_invSel.index];
    if (!item) return;
    if (item.desc) {
      const desc = document.createElement('div');
      desc.style.cssText = 'font-size:11px;color:#94a3b8;margin-bottom:8px;line-height:1.5';
      desc.textContent = item.desc;
      el.appendChild(desc);
    }
    const btn = document.createElement('button');
    btn.className = 'inv-use-btn';
    btn.style.cssText = 'background:#374151;color:#f87171;border-color:#4b5563';
    btn.textContent = '↩ Unequip';
    btn.onclick = () => {
      const inv = state.inventory;
      const art = inv.equipped[_invSel.index];
      if (!art) return;
      inv.equipped[_invSel.index] = null;
      inv.artifacts.push(art);
      _invSel = null;
      renderInventory();
      _renderInvActions();
    };
    el.appendChild(btn);
    return;
  }

  if (_invSel.source !== 'inv') return;
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
    const it = state.inventory.consumables[_invSel.index];
    const isAxe = it && (it.id === 'lumber_axe' || it.id === 'axe' || (it.name || '').toLowerCase().includes('axe'));
    if (isAxe) {
      const btn = document.createElement('button');
      btn.className = 'inv-use-btn inv-use-con';
      btn.textContent = '🪓 Use';
      btn.onclick = () => {
        const i = _invSel.index;
        const item = state.inventory.consumables[i];
        if (!item) return;
        document.getElementById('invP')?.classList.remove('sh');
        _invSel = null;
        syncPause();
        state.sel = { type: 'forest_clear', invIndex: i };
        showTip('Click a forest tile to clear it');
      };
      el.appendChild(btn);
    } else if (it?.id === 'relocation_charm') {
      const btn = document.createElement('button');
      btn.className = 'inv-use-btn inv-use-con';
      btn.textContent = '🏗️ Move Tower';
      btn.onclick = () => {
        const i = _invSel.index;
        const item = state.inventory.consumables[i];
        if (!item) return;
        document.getElementById('invP')?.classList.remove('sh');
        _invSel = null;
        syncPause();
        state.sel = { type: 'relocate_source', invIndex: i };
        showTip('Click the tower you want to move');
      };
      el.appendChild(btn);
    } else {
      const btn = document.createElement('button');
      btn.className = 'inv-use-btn inv-use-con';
      const _cnt = it.count && it.count > 1 ? ' ×' + it.count : '';
      btn.textContent = '📍 Use' + _cnt;
      btn.onclick = () => {
        const i = _invSel.index;
        const item = state.inventory.consumables[i];
        if (!item) return;
        document.getElementById('invP')?.classList.remove('sh');
        _invSel = null;
        syncPause();
        state.sel = { type: 'consumable_pick', item: { ...item }, index: i };
        
        const isPath = item?.id?.includes('trap') || item?.id?.includes('sap');
        showTip(isPath ? 'Click a path tile to place ' + item.name : 'Click a valid tile to use ' + item.name);
      };
      el.appendChild(btn);
    }
  }
}

function _invClickItem(section, index) {
  if (section !== 'artifacts') {
    if (_augTarget && section === 'augments') {
      const it = state.inventory.augments[index];
      if (!it) return;
      if (!applyAugment(it, _augTarget.tower)) return;
      it.count = (it.count || 1) - 1;
      if (it.count <= 0) state.inventory.augments.splice(index, 1);
      const cb = _augTarget.onApplied;
      _augTarget = null;
      document.getElementById('invP')?.classList.remove('sh');
      syncPause();
      cb?.();
      return;
    }
    if (_invSel?.source === 'inv' && _invSel?.section === section && _invSel?.index === index) {
      _invSel = null;
    } else {
      _invSel = { source: 'inv', section, index };
    }
    renderInventory();
    _renderInvActions();
    return;
  }
  // Artifacts: clicking an inv artifact when an equip slot is selected → equip it
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
    // Equip artifact from inventory into this slot
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
    // Clicking the already-selected equip slot → unequip to inventory
    const art = inv.equipped[slotIndex];
    if (art) {
      inv.equipped[slotIndex] = null;
      inv.artifacts.push(art);
    }
    _invSel = null;
  } else if (_invSel?.source === 'equip') {
    // Swap between equip slots
    const other = _invSel.index;
    [inv.equipped[slotIndex], inv.equipped[other]] = [inv.equipped[other], inv.equipped[slotIndex]];
    _invSel = null;
  } else {
    if (inv.equipped[slotIndex]) {
      _invSel = { source: 'equip', index: slotIndex };
    }
  }
  renderInventory();
  _renderInvActions();
}

function _activateArtifact(art) {
  if (!art?.active || art.cdWavesLeft > 0 || state.phase !== 'active') return;
  if (art.id === 'the_bell') {
    _ΨΔ(() => { state.freezeActive = Math.max(state.freezeActive, 150); });
    sfxFreeze();
    art.cdWavesLeft = art.cooldownWaves || 8;
    renderInventory();
  }
}

export function openInventoryForAugment(tw, onApplied) {
  _augTarget = { tower: tw, onApplied };
  _invSel = null;
  const p = document.getElementById('invP');
  if (!p) return;
  renderInventory();
  p.classList.add('sh');
  syncPause();
}

export function initInventoryUI() {
  document.getElementById('invBtn')?.addEventListener('click', () => {
    const p = document.getElementById('invP');
    if (!p) return;
    if (p.classList.contains('sh')) {
      p.classList.remove('sh');
      _augTarget = null;
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
    _augTarget = null;
    syncPause();
  });

  // JS tooltip: positioned relative to #invP to avoid overflow-y clipping
  const invP = document.getElementById('invP');
  const invC = document.getElementById('invC');
  if (!invP || !invC) return;

  const tip = document.createElement('div');
  tip.id = 'invTooltip';
  invP.appendChild(tip);

  invC.addEventListener('mouseover', e => {
    const cell = e.target.closest('[data-tip-name]');
    if (!cell) { tip.style.display = 'none'; return; }
    const name = cell.dataset.tipName;
    const rarity = cell.dataset.tipRarity;
    const desc = cell.dataset.tipDesc;
    const rarColor = rarity ? (RARITY_COLORS[rarity] || '#94a3b8') : null;

    let html = '<div class="itip-name">' + name + '</div>';
    if (rarity) html += '<div class="itip-rarity" style="color:' + rarColor + '">◆ ' + rarity.charAt(0).toUpperCase() + rarity.slice(1) + '</div>';
    if (desc) html += '<div class="itip-desc">' + desc + '</div>';
    tip.innerHTML = html;
    tip.style.display = 'block';

    // Position relative to invP, above the cell
    const pRect = invP.getBoundingClientRect();
    const cRect = cell.getBoundingClientRect();
    const tipH = tip.offsetHeight;
    const tipW = tip.offsetWidth;

    let tipTop = cRect.top - pRect.top - tipH - 8;
    if (tipTop < 4) tipTop = cRect.bottom - pRect.top + 8;
    let tipLeft = cRect.left - pRect.left;
    tipLeft = Math.max(6, Math.min(tipLeft, pRect.width - tipW - 6));

    tip.style.top = tipTop + 'px';
    tip.style.left = tipLeft + 'px';
  });

  invC.addEventListener('mouseout', e => {
    if (!e.relatedTarget?.closest?.('[data-tip-name]')) tip.style.display = 'none';
  });
}

export function addToInventory(section, item) {
  const inv = state.inventory;
  if (!inv) return;
  const arr = inv[section];
  if (!arr) return;
  if ((section === 'augments' || section === 'consumables') && item.id) {
    const existing = arr.find(e => e.id === item.id);
    if (existing) { existing.count = (existing.count || 1) + 1; }
    else if (arr.length < INV_MAX) arr.push({ ...item, count: 1 });
  } else {
    if (arr.length < INV_MAX) arr.push(item);
  }
  if (!inv.seenSections) inv.seenSections = {};
  inv.seenSections[section] = true;
  syncInvBtn();
}
