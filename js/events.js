'use strict';
import { state, _ΨΔ, getCell } from './main.js';
import { addFeed } from './feed.js';
import { mkE } from './enemies.js';
import { ETYPES, TD } from './data.js';
import { sfxEvent } from './audio.js';

export const EVENTS = [
  // ── Good ──────────────────────────────────────────────────────────────────
  {
    name: '💰 Gold Rush!',
    desc: '+50 gold',
    good: true,
    fn: () => { state.gold += 50; },
  },
  {
    name: '🪨 Scattered Stones!',
    desc: '5 stone appear on the path',
    good: true,
    fn: () => {
      const pathCells = state.path.slice();
      for (let i = pathCells.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pathCells[i], pathCells[j]] = [pathCells[j], pathCells[i]];
      }
      let placed = 0;
      for (const { x, y } of pathCells) {
        if (placed >= 5) break;
        const cell = getCell(x, y);
        if (!cell) continue;
        if (!cell.stacks) cell.stacks = [null, null, null, null];
        const ei = cell.stacks.findIndex(s => !s);
        if (ei === -1) continue;
        cell.stacks[ei] = { type: 'stone', count: 1 };
        placed++;
      }
    },
  },
  // ── Bad ───────────────────────────────────────────────────────────────────
  {
    name: '💸 Tax Collector!',
    desc: '−10% gold',
    good: false,
    fn: () => { state.gold = Math.max(0, Math.floor(state.gold * 0.9)); },
  },
  {
    name: '🔥 Wildfire!',
    desc: 'A random tower is disabled for the next wave',
    good: false,
    guard: () => state.towers.length > 2,
    fn: () => {
      const eligible = state.towers.filter(t => TD[t.type]?.cat === 'tower');
      if (!eligible.length) return;
      const r = eligible[Math.floor(Math.random() * eligible.length)];
      r.disabled = true;
      r.disabledWave = state.wave + 1;
    },
  },
  {
    name: '💀 Goblin Ambush!',
    desc: '5 fast goblins spawn!',
    good: false,
    fn: () => {
      for (let i = 0; i < 5; i++) {
        const e = mkE(ETYPES.fast, 20 + state.wave * 18, 0.6 + state.wave * 0.035);
        e.x = state.path[0].x; e.y = state.path[0].y;
        state.enemies.push(e);
      }
    },
  },
];

export function triggerEvent() {
  const available = EVENTS.filter(ev => !ev.guard || ev.guard());
  if (!available.length) return;
  const ev = available[Math.floor(Math.random() * available.length)];
  _ΨΔ(() => ev.fn()); sfxEvent();
  const el = document.getElementById('evBanner');
  el.innerHTML = (ev.good ? '🎉' : '⚠️') + ' <b>' + ev.name + '</b><br>' + ev.desc;
  el.style.borderColor = ev.good ? '#22c55e' : '#ef4444';
  el.classList.add('sh');
  setTimeout(() => el.classList.remove('sh'), 3000);
  addFeed(ev.good ? 'event_good' : 'event_bad', ev.name + ' — ' + ev.desc);
}
