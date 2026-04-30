'use strict';
import { state, getCell, dropLoot } from './main.js';
import { bus } from './bus.js';
import { addFeed } from './feed.js';

// ─── NPC speech data ──────────────────────────────────────────────────────────

const NPC_LINES = {
  elderberry: [
    {
      trigger: 'game_start',
      text: "Oh. Hello. You're new. My name is Elder Elderberry, I've been here for a very long time."
    },
    {
      trigger: 'wave_prep',
      wave: 1,
      text: "You'll want to put something on the path to stop the creatures. The creatures don't like it when you put things on the path, but that won't stop them from walking. Nothing will."
    },
    {
      trigger: 'wave_prep',
      wave: 1,
      text: "The rocks around here — try clicking on them. They give things. I used to collect things. I don't remember why I stopped."
    },
    {
      trigger: 'wave_prep',
      wave: 8,
      text: "The Lab can be placed now, if you're inclined toward observation. I've found observation helps. Eventually."
    },
    {
      trigger: 'wave_prep',
      wave: 12,
      text: "Someone set up a shop nearby. Pip. I've seen him before. He doesn't age. I've stopped asking."
    },
    {
      trigger: 'wave_prep',
      wave: 10,
      cond: s => !s.towers?.some(t => t.type === 'lab'),
      text: "No lab yet. That's interesting. Most build one. You haven't. I wonder what you know that they didn't."
    },
    {
      trigger: 'wave_prep',
      wave: 25,
      cond: s => {
        const hasSeahorse = Object.values(s.research || {}).some(n => n.unlocks === 'seahorse' || n.id === 'insightful_seahorse');
        const hasLens = Object.values(s.research || {}).some(n => n.unlocks === 'insightful_lens_recipe' || n.id === 'insightful_lens');
        return hasSeahorse || hasLens || s.unlockedTowers?.has('seahorse');
      },
      text: s => {
        const seahorseUnlocked = s.unlockedTowers?.has('seahorse');
        const hasLens = Object.values(s.research || {}).some(n => n.id === 'insightful_lens');
        if (seahorseUnlocked) return "The shadows have started moving differently. I've seen this before — goblins that your towers cannot see. You have a Seahorse. Place one in their path.";
        if (hasLens) return "The shadows have started moving differently. I've seen this before — goblins that your towers cannot see. The Insightful Lens in your research web will help — and quickly.";
        return "The shadows have started moving differently. I've seen this before — goblins that your towers cannot see. The Seahorse research in your web will reveal them.";
      }
    },
    {
      trigger: 'wave_prep',
      cond: s => s.bSen?.has('spider') && !s.firedTriggerLines?.has('elderberry:spider_lore'),
      text: "The one with many children. She is not hunting you — she is looking for a Seed Stone. Her brood cannot grow without it. You can make one at the Workbench. And build a Ceasefire Flag to stand down your towers. Let her come, let her take it, and she will never lay siege again. I was here when the old builders did this. It worked.",
      onFire: (npc) => {
        setTimeout(() => {
          if (!npc) return;
          if (!state.researchUnlocks) state.researchUnlocks = {};
          state.researchUnlocks['ceasefire_flag_bp_recipe'] = 1;
          dropLoot(npc.x, npc.y, 'blueprints', { id: 'ceasefire_flag_bp', icon: '🟦', bpOverlay: '🏳️', name: 'Ceasefire Flag Blueprint', unlocks: 'ceasefire_flag' });
          dropLoot(npc.x, npc.y, 'blueprints', { id: 'seed_stone_bp', icon: '🟦', bpOverlay: '🪨', name: 'Seed Stone Blueprint', desc: 'Unlocks the Seed Stone recipe at any Workbench.', recipeUnlock: 'seed_stone_recipe' });
        }, 9500);
      }
    },
    {
      trigger: 'wave_prep',
      cond: s => s.bSen?.has('spider'),
      text: "I've left the blueprints at my feet. A Ceasefire Flag, and the recipe for the Seed Stone. The rest is yours."
    }
  ]
};

// ─── Placement ────────────────────────────────────────────────────────────────

export function placeNpcs() {
  const { COLS, ROWS, path } = state;
  const PAD = 6;
  const pathEndY = path.length > 0 ? path[path.length - 1].y : -1;
  // Right border forest tiles adjacent to the inner playfield
  const candidates = [];
  for (let y = PAD; y < ROWS - PAD; y++) {
    if (y === pathEndY) continue;
    if (getCell(COLS - PAD - 1, y)?.type === 'water') continue;
    candidates.push(y);
  }
  if (candidates.length === 0) return;
  const row = candidates[Math.floor(Math.random() * candidates.length)];
  state.npcs = [{ id: 'elderberry', icon: '🌳', img: 'elder', name: 'Elder Elderberry', x: COLS - PAD, y: row }];
}

// ─── Speech bubble ────────────────────────────────────────────────────────────

let _bubble = null;
let _bubbleActive = false;
let _bubbleQueue = [];
let _bubbleTimer = null;

let _voices = [];
if (window.speechSynthesis) {
  const _loadVoices = () => { _voices = window.speechSynthesis.getVoices(); };
  _loadVoices();
  window.speechSynthesis.addEventListener('voiceschanged', _loadVoices);
}

function _elderSpeak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 0.68;
  utt.pitch = 0.85;
  utt.volume = 0.82;
  const voices = _voices.length ? _voices : window.speechSynthesis.getVoices();
  const preferred = voices.find(v => /daniel|oliver|arthur|george/i.test(v.name))
    || voices.find(v => v.lang === 'en-GB')
    || voices.find(v => v.lang.startsWith('en'))
    || voices[0];
  if (preferred) utt.voice = preferred;
  window.speechSynthesis.speak(utt);
}

export function initNpcUI() {
  _bubble = document.createElement('div');
  _bubble.id = 'npcBubble';
  document.getElementById('gc').appendChild(_bubble);
}

function _processQueue() {
  if (_bubbleActive || _bubbleQueue.length === 0 || !_bubble) return;
  const { npc, text } = _bubbleQueue.shift();
  _bubbleActive = true;
  _bubble.textContent = text;
  _bubble.classList.add('sh');
  _positionBubble(npc);
  _elderSpeak(text);
  clearTimeout(_bubbleTimer);
  _bubbleTimer = setTimeout(() => {
    _bubble.classList.remove('sh');
    _bubbleActive = false;
    _bubbleTimer = setTimeout(_processQueue, 700);
  }, 9000);
}

function _positionBubble(npc) {
  if (!_bubble || !state.cv) return;
  const { CELL, cam, cv } = state;
  const gcEl = document.getElementById('gc');
  if (!gcEl) return;
  const gcR = gcEl.getBoundingClientRect();
  const cvR = cv.getBoundingClientRect();
  // Anchor to the left edge of the NPC tile, vertically centered
  const wpx = npc.x * CELL;
  const wpy = npc.y * CELL + CELL / 2;
  const sx = (wpx - cam.panX) * cam.zoom;
  const sy = (wpy - cam.panY) * cam.zoom;
  const screenX = cvR.left - gcR.left + sx;
  const screenY = cvR.top - gcR.top + sy;
  _bubble.style.left = (screenX - _bubble.offsetWidth - 10) + 'px';
  _bubble.style.top = (screenY - _bubble.offsetHeight / 2) + 'px';
}

export function updateNpcBubble() {
  if (!_bubble || !_bubbleActive || !state.npcs?.length) return;
  _positionBubble(state.npcs[0]);
}

// ─── Universal trigger system ─────────────────────────────────────────────────

function _handleTrigger(type, ctx) {
  if (!state.npcs?.length) return;
  if (!state.firedTriggerLines) state.firedTriggerLines = new Set();
  for (const npc of state.npcs) {
    const lines = NPC_LINES[npc.id];
    if (!lines) continue;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const key = npc.id + ':' + i;
      if (state.firedTriggerLines.has(key)) continue;
      if (line.trigger !== type) continue;
      if (line.wave !== undefined && line.wave !== ctx.wave) continue;
      if (line.cond && !line.cond(state)) continue;
      state.firedTriggerLines.add(key);
      const text = typeof line.text === 'function' ? line.text(state) : line.text;
      _bubbleQueue.push({ npc, text });
      addFeed('npc', text);
      _processQueue();
      if (line.onFire) line.onFire(npc);
    }
  }
}

bus.on('trigger', ({ type, ...ctx }) => _handleTrigger(type, ctx));
