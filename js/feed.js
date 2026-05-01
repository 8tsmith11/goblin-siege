// Unified game feed log — entries stored for Lab Notes tab, no left-panel DOM rendering
// Usage: addFeed('wave', 'Wave 3 begins!');

import { state } from './main.js';

export const FEED_TYPES = {
  wave:       { icon: '⚔️',  color: '#f87171' },
  boss:       { icon: '👑',  color: '#fbbf24' },
  boss_quote: { icon: '👹',  color: '#fb923c' },
  event_good: { icon: '🎉',  color: '#86efac' },
  event_bad:  { icon: '⚠️',  color: '#fca5a5' },
  research:   { icon: '🔬',  color: '#818cf8' },
  lab:        { icon: '🧪',  color: '#a78bfa' },
  craft:      { icon: '⚒️',  color: '#6ee7b7' },
  scribe:     { icon: '📓',  color: '#c084fc' },
  npc:        { icon: '🌳',  color: '#a3e635' },
  system:     { icon: '🏰',  color: '#64748b' },
  weather:    { icon: '🌤️', color: '#7dd3fc' },
  herald:     { icon: '📯',  color: '#f59e0b' },
  obs:        { icon: '🔮',  color: '#c084fc' },
};

let _log = [];

export function addFeed(type, text) {
  _log.push({ type, text, wave: state?.wave ?? 0 });
}

export function getFeedLog() { return _log; }

export function restoreFeed(entries) {
  _log = (entries || []).map(e => ({ wave: 0, ...e }));
}

export function clearFeed() {
  _log = [];
}
