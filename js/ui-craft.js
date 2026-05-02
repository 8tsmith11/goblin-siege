'use strict';
import { state } from './main.js';
import { RTYPES } from './resources.js';
import { RECIPES, cancelCraft, selectRecipe } from './craft.js';
import { hudU, syncPause } from './ui.js';

let _craftTw = null; // currently open workbench tower

export function openCraftPanel(tw) {
  _craftTw = tw;
  renderCraftPanel();
  const p = document.getElementById('craftP');
  if (p && !p.classList.contains('sh')) { p.classList.add('sh'); syncPause(); }
}

export function renderCraftPanel() {
  const c = document.getElementById('craftC');
  if (!c || !_craftTw) return;
  const tw = _craftTw;
  c.innerHTML = '';

  const invDiv = document.createElement('div');
  invDiv.style.cssText = 'margin-bottom:10px;';
  const inv = tw.inv || {};
  invDiv.innerHTML = '<div class="craft-queue-title">Workbench Stock</div>';
  const stockRow = document.createElement('div');
  stockRow.style.cssText = 'font-size:12px;color:#94a3b8;margin-top:4px;display:flex;gap:6px;flex-wrap:wrap;align-items:center';
  Object.entries(RTYPES).filter(([k]) => k !== 'dust').forEach(([k, rt]) => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;gap:3px;background:#0d1525;border-radius:4px;padding:2px 5px';
    const lbl = document.createElement('span');
    lbl.dataset.wbRes = k;
    lbl.dataset.twX = tw.x;
    lbl.dataset.twY = tw.y;
    lbl.textContent = rt.icon + ' ' + (inv[k] || 0);
    wrap.appendChild(lbl);
    const have = state.resources[k] || 0;
    if (have > 0) {
      const depBtn = document.createElement('button');
      depBtn.className = 'craft-dep-btn';
      depBtn.title = 'Deposit from inventory (' + have + ' available)';
      depBtn.textContent = '+1';
      depBtn.onclick = () => {
        if ((state.resources[k] || 0) <= 0) return;
        if ((tw.inv?.[k] || 0) >= 20) return;
        state.resources[k]--;
        if (!tw.inv) tw.inv = {};
        tw.inv[k] = (tw.inv[k] || 0) + 1;
        hudU();
        renderCraftPanel();
      };
      wrap.appendChild(depBtn);
    }
    stockRow.appendChild(wrap);
  });
  invDiv.appendChild(stockRow);
  c.appendChild(invDiv);

  const selDiv = document.createElement('div');
  selDiv.style.cssText = 'margin-bottom:10px;display:flex;align-items:center;gap:8px;';
  const sel = tw.selectedRecipe ? RECIPES.find(r => r.id === tw.selectedRecipe) : null;
  if (sel) {
    selDiv.innerHTML = `<span style="font-size:12px;color:#a78bfa">Selected: ${sel.icon} ${sel.name}</span>`;
    const clearBtn = document.createElement('button');
    clearBtn.className = 'craft-cancel';
    clearBtn.textContent = 'Clear';
    clearBtn.onclick = () => { selectRecipe(tw, null); renderCraftPanel(); };
    selDiv.appendChild(clearBtn);
  } else {
    selDiv.innerHTML = '<span style="font-size:12px;color:#475569">No recipe selected</span>';
  }
  c.appendChild(selDiv);

  if (tw.craftQueue) {
    const recipe = RECIPES.find(r => r.id === tw.craftQueue.recipeId);
    const qDiv = document.createElement('div');
    qDiv.className = 'craft-queue';
    const wavesDone = tw.craftQueue.wavesTotal - tw.craftQueue.wavesLeft;
    qDiv.innerHTML = `
      <div class="craft-queue-title">Crafting…</div>
      <div class="craft-queue-row">
        <div class="craft-queue-icon">${recipe?.icon || '?'}</div>
        <div class="craft-queue-info">
          <div class="craft-queue-name">${recipe?.name || '?'}</div>
          <div class="craft-queue-prog">${wavesDone} / ${tw.craftQueue.wavesTotal} waves</div>
        </div>
        <button class="craft-cancel" id="craftCancelBtn">Cancel</button>
      </div>`;
    c.appendChild(qDiv);
    qDiv.querySelector('#craftCancelBtn').onclick = () => { cancelCraft(tw); renderCraftPanel(); };
  }

  for (const recipe of RECIPES.filter(r => !r.unlockKey || state.researchUnlocks?.[r.unlockKey])) {
    const isSelected = tw.selectedRecipe === recipe.id;
    const div = document.createElement('div');
    div.className = 'craft-recipe' + (isSelected ? ' craft-recipe-selected' : '');
    const costParts = Object.entries(recipe.cost).map(([r, n]) => {
      const rt = RTYPES[r];
      return `${rt ? rt.icon : r}×${n}`;
    }).join('  ');
    div.innerHTML = `
      <div class="craft-recipe-icon">${recipe.icon}</div>
      <div class="craft-recipe-info">
        <div class="craft-recipe-name">${recipe.name}</div>
        <div class="craft-recipe-cost">${costParts}</div>
        <div class="craft-recipe-desc">${recipe.desc}</div>
        <div class="craft-recipe-waves">${recipe.waves} wave${recipe.waves > 1 ? 's' : ''} to craft</div>
      </div>
      <button class="craft-btn${isSelected ? ' craft-btn-sel' : ''}">${isSelected ? 'Selected ✓' : 'Select'}</button>`;
    div.querySelector('.craft-btn').onclick = () => {
      selectRecipe(tw, isSelected ? null : recipe.id);
      renderCraftPanel();
    };
    c.appendChild(div);
  }
}

export function initCraftUI() {
  document.getElementById('craftClose')?.addEventListener('click', () => {
    document.getElementById('craftP')?.classList.remove('sh');
    _craftTw = null;
    syncPause();
  });
}
