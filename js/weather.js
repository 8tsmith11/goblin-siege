'use strict';
import { state, getCell } from './main.js';

// ─── Weather type definitions ─────────────────────────────────────────────────

export const WEATHER_TYPES = [
  { id: 'clear', name: 'Clear Skies', icon: '☀️',  weight: 40, min: 1, max: 3, desc: 'No effects.' },
  { id: 'rain',  name: 'Heavy Rain',  icon: '🌧️', weight: 30, min: 2, max: 4, desc: 'Monkeys slow. Items may wash away.' },
];

const _TOTAL_W = WEATHER_TYPES.reduce((s, w) => s + w.weight, 0);

function _roll() {
  let r = Math.random() * _TOTAL_W;
  for (const w of WEATHER_TYPES) { r -= w.weight; if (r <= 0) return w; }
  return WEATHER_TYPES[0];
}

// ─── State init ───────────────────────────────────────────────────────────────

export function initWeather() {
  // Wave 1 is always clear; wavesLeft=1 means it expires after wave 1 ends
  state.weather = { id: 'clear', wavesLeft: 1 };
}

// ─── Wave-end tick ────────────────────────────────────────────────────────────

export function tickWeather() {
  if (!state.weather) { initWeather(); return; }
  state.weather.wavesLeft--;
  if (state.weather.wavesLeft > 0) return;
  const prevId = state.weather.id;
  const next = _roll();
  const waves = next.min + Math.floor(Math.random() * (next.max - next.min + 1));
  state.weather = { id: next.id, wavesLeft: waves };
}

// ─── Per-tick rain wash-away ──────────────────────────────────────────────────

let _washCd = 0;

export function updateWeather() {
  if (state.weather?.id !== 'rain' || !state.started) return;
  if (--_washCd > 0) return;
  _washCd = 90 + Math.floor(Math.random() * 60); // every 1.5–2.5 s

  const x = Math.floor(Math.random() * state.COLS);
  const y = Math.floor(Math.random() * state.ROWS);
  const cell = getCell(x, y);
  if (!cell?.stacks) return;
  const filled = cell.stacks.reduce((a, s, i) => { if (s) a.push(i); return a; }, []);
  if (!filled.length) return;
  const idx = filled[Math.floor(Math.random() * filled.length)];
  const s = cell.stacks[idx];
  if (s.bossLoot) return;
  const remove = 1 + Math.floor(Math.random() * Math.min(3, s.count));
  s.count -= remove;
  if (s.count <= 0) cell.stacks[idx] = null;
}
