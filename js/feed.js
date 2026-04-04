// Unified game feed log
// Usage: import { addFeed } from './feed.js';
//        addFeed('wave', 'Wave 3 begins!');
//
// To add new message types, add an entry to FEED_TYPES.

// Type registry — extend by adding entries here
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
  system:     { icon: '🏰',  color: '#64748b' },
  weather:    { icon: '🌤️', color: '#7dd3fc' },
};

let _log = [];

function _renderEntry(log, type, text, animate) {
  const def = FEED_TYPES[type] ?? FEED_TYPES.system;
  const el = document.createElement('div');
  el.className = animate ? 'fe' : 'fe fe-no-anim';
  el.innerHTML = `<span class="fe-i">${def.icon}</span><span class="fe-t" style="color:${def.color}">${text}</span>`;
  log.appendChild(el);
}

export function addFeed(type, text) {
  _log.push({ type, text });

  const log = document.getElementById('feedLog');
  if (!log) return;

  _renderEntry(log, type, text, true);

  // Auto-scroll unless player has scrolled up to read history
  const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
  if (atBottom) log.scrollTop = log.scrollHeight;
}

// Returns the full log for saving
export function getFeedLog() { return _log; }

// Restores from a saved array and re-renders the panel
export function restoreFeed(entries) {
  _log = entries || [];
  const log = document.getElementById('feedLog');
  if (!log) return;
  log.innerHTML = '';
  for (const { type, text } of _log) _renderEntry(log, type, text, false);
  log.scrollTop = log.scrollHeight;
}

// Clears log on reset/death
export function clearFeed() {
  _log = [];
  const log = document.getElementById('feedLog');
  if (log) log.innerHTML = '';
}
