'use strict';
import { state } from './main.js';
import { hideTT, panelU } from './ui.js';

function _btn(parent, txt, cls, ok, fn) {
  const b = document.createElement('button');
  b.className = 'ttb ' + cls + (ok ? '' : ' off2');
  b.textContent = txt; b.onclick = e => { e.stopPropagation(); fn(); };
  parent.appendChild(b);
}

const ROLE_LABEL = { null: 'Idle 💤', gatherer: 'Gather 🌿', courier: 'Courier 🚚', booster: 'Boost 💪', round_robin: 'Round Robin 🔄', harvester: 'Harvest ⛏️' };

function getRoleCycle() {
  const roles = [null, 'gatherer', 'courier', 'booster'];
  if (state.researchUnlocks?.monkey_round_robin) roles.push('round_robin');
  if (state.researchUnlocks?.monkey_harvester) roles.push('harvester');
  return roles;
}

const FILTER_CYCLE = [null, 'wood', 'stone'];
const FILTER_LABEL = { null: 'All', wood: '🪵', stone: '🪨' };

// onRefresh: () => void — call to rebuild the whole tower tooltip (provided by ui-tower.js)
export function buildMonkeyTT(tw, container, onRefresh) {
  if (!tw.monkeys) return;
  for (const mk of tw.monkeys) {
    const block = document.createElement('div');
    block.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;align-items:center;margin:4px 0 2px;padding:4px 6px;border:1px solid #334155;border-radius:5px;background:#0d1520;width:100%;box-sizing:border-box';

    const nameEl = document.createElement('span');
    nameEl.style.cssText = 'color:#fb923c;font-size:10px;font-weight:700;flex-shrink:0;min-width:44px';
    nameEl.textContent = mk.name;
    block.appendChild(nameEl);

    const roleBtn = document.createElement('button');
    roleBtn.className = 'ttb tts2';
    roleBtn.style.cssText = 'font-size:10px;padding:3px 5px';
    roleBtn.textContent = ROLE_LABEL[mk.role] ?? 'Idle 💤';
    roleBtn.onclick = e => {
      e.stopPropagation();
      const cycle = getRoleCycle();
      const idx = cycle.indexOf(mk.role);
      mk.role = cycle[(idx + 1) % cycle.length];
      mk.cfg = { filter: null, dest: null, from: null, boost: null, targets: [], rrIdx: 0, froms: [], rrFromIdx: 0, rrMode: 'tos' };
      mk.st = 'idle'; mk.carrying = null;
      onRefresh();
    };
    block.appendChild(roleBtn);

    if (mk.trips > 0) {
      const tripEl = document.createElement('span');
      tripEl.style.cssText = 'color:#64748b;font-size:9px;flex-shrink:0;order:99';
      tripEl.textContent = mk.trips + (mk.trips === 1 ? ' trip' : ' trips');
      block.appendChild(tripEl);
    }

    const addCtrl = (label, cb) => _btn(block, label, 'tts2', true, cb);

    if (mk.role === 'gatherer') {
      addCtrl('Filter: ' + FILTER_LABEL[mk.cfg.filter ?? null], () => {
        const fi = FILTER_CYCLE.indexOf(mk.cfg.filter ?? null);
        mk.cfg.filter = FILTER_CYCLE[(fi + 1) % FILTER_CYCLE.length] ?? null;
        onRefresh();
      });
      addCtrl(mk.cfg.dest ? `Dest: (${mk.cfg.dest.x}, ${mk.cfg.dest.y}) 📍` : 'Set Dest 📍', () => {
        state.sel = { type: 'tile_pick', monkey: mk, hut: tw, field: 'dest' };
        hideTT(); state.ttTower = null; panelU();
      });
    }

    if (mk.role === 'courier') {
      addCtrl('Filter: ' + FILTER_LABEL[mk.cfg.filter ?? null], () => {
        const fi = FILTER_CYCLE.indexOf(mk.cfg.filter ?? null);
        mk.cfg.filter = FILTER_CYCLE[(fi + 1) % FILTER_CYCLE.length] ?? null;
        onRefresh();
      });
      addCtrl(mk.cfg.from ? `From: (${mk.cfg.from.x}, ${mk.cfg.from.y}) 📍` : 'Set From 📍', () => {
        state.sel = { type: 'tile_pick', monkey: mk, hut: tw, field: 'from' };
        hideTT(); state.ttTower = null; panelU();
      });
      addCtrl(mk.cfg.dest ? `To: (${mk.cfg.dest.x}, ${mk.cfg.dest.y}) 📍` : 'Set To 📍', () => {
        state.sel = { type: 'tile_pick', monkey: mk, hut: tw, field: 'dest' };
        hideTT(); state.ttTower = null; panelU();
      });
    }

    if (mk.role === 'booster') {
      addCtrl(mk.cfg.boost ? `Target: (${mk.cfg.boost.x}, ${mk.cfg.boost.y}) 📍` : 'Set Target 📍', () => {
        state.sel = { type: 'tile_pick', monkey: mk, hut: tw, field: 'boost' };
        hideTT(); state.ttTower = null; panelU();
      });
    }

    if (mk.role === 'harvester') {
      const src = mk.cfg.harvestSrc;
      addCtrl(src ? (src.isForest ? `Forest: (${src.x}, ${src.y}) 📍` : `Rock: (${src.x}, ${src.y}) 📍`) : 'Set Source 📍', () => {
        state.sel = { type: 'tile_pick', monkey: mk, hut: tw, field: 'harvestSrc' };
        hideTT(); state.ttTower = null; panelU();
      });
      addCtrl(mk.cfg.dest ? `Dest: (${mk.cfg.dest.x}, ${mk.cfg.dest.y}) 📍` : 'Set Dest 📍', () => {
        state.sel = { type: 'tile_pick', monkey: mk, hut: tw, field: 'dest' };
        hideTT(); state.ttTower = null; panelU();
      });
    }

    if (mk.role === 'round_robin') {
      if (!mk.cfg.rrMode) mk.cfg.rrMode = 'tos';
      if (!mk.cfg.froms) mk.cfg.froms = [];
      addCtrl('Filter: ' + FILTER_LABEL[mk.cfg.filter ?? null], () => {
        const fi = FILTER_CYCLE.indexOf(mk.cfg.filter ?? null);
        mk.cfg.filter = FILTER_CYCLE[(fi + 1) % FILTER_CYCLE.length] ?? null;
        onRefresh();
      });
      addCtrl('Mode: ' + (mk.cfg.rrMode === 'froms' ? 'Multi-From →1 Dest' : '1 From → Multi-To'), () => {
        mk.cfg.rrMode = mk.cfg.rrMode === 'froms' ? 'tos' : 'froms';
        mk.cfg.targets = []; mk.cfg.rrIdx = 0;
        mk.cfg.froms = []; mk.cfg.rrFromIdx = 0;
        mk.cfg.from = null; mk.cfg.dest = null;
        mk.st = 'idle'; mk.carrying = null;
        onRefresh();
      });
      if (mk.cfg.rrMode === 'froms') {
        const froms = mk.cfg.froms || [];
        froms.forEach((f, i) => {
          addCtrl(`From ${i + 1}: (${f.x},${f.y}) ✕`, () => {
            mk.cfg.froms.splice(i, 1);
            if ((mk.cfg.rrFromIdx || 0) >= mk.cfg.froms.length) mk.cfg.rrFromIdx = 0;
            onRefresh();
          });
        });
        if (froms.length < 5) {
          addCtrl('+ Add From 📍', () => {
            state.sel = { type: 'tile_pick', monkey: mk, hut: tw, field: 'rr_add_from' };
            hideTT(); state.ttTower = null; panelU();
          });
        }
        addCtrl(mk.cfg.dest ? `To: (${mk.cfg.dest.x},${mk.cfg.dest.y}) 📍` : 'Set Dest 📍', () => {
          state.sel = { type: 'tile_pick', monkey: mk, hut: tw, field: 'dest' };
          hideTT(); state.ttTower = null; panelU();
        });
      } else {
        addCtrl(mk.cfg.from ? `From: (${mk.cfg.from.x},${mk.cfg.from.y}) 📍` : 'Set From 📍', () => {
          state.sel = { type: 'tile_pick', monkey: mk, hut: tw, field: 'from' };
          hideTT(); state.ttTower = null; panelU();
        });
        const targets = mk.cfg.targets || [];
        targets.forEach((t, i) => {
          addCtrl(`To ${i + 1}: (${t.x},${t.y}) ✕`, () => {
            mk.cfg.targets.splice(i, 1);
            if ((mk.cfg.rrIdx || 0) >= mk.cfg.targets.length) mk.cfg.rrIdx = 0;
            onRefresh();
          });
        });
        if (targets.length < 5) {
          addCtrl('+ Add To 📍', () => {
            state.sel = { type: 'tile_pick', monkey: mk, hut: tw, field: 'rr_add_target' };
            hideTT(); state.ttTower = null; panelU();
          });
        }
      }
    }

    container.appendChild(block);
  }
}
