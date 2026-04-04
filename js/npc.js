'use strict';
import { state, getCell } from './main.js';
import { bus } from './bus.js';

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
    }
  ]
};

// ─── Placement ────────────────────────────────────────────────────────────────

export function placeNpcs() {
  const { COLS, ROWS, path } = state;
  const pathEndY = path.length > 0 ? path[path.length - 1].y : -1;
  // Right border forest tiles adjacent to the inner playfield (inner x = COLS).
  // Skip rows adjacent to water or on the path exit row (right behind the castle).
  const candidates = [];
  for (let y = 0; y < ROWS; y++) {
    if (y === pathEndY) continue;
    if (getCell(COLS - 1, y)?.type === 'water') continue;
    candidates.push(y);
  }
  if (candidates.length === 0) return;
  const row = candidates[Math.floor(Math.random() * candidates.length)];
  state.npcs = [{ id: 'elderberry', icon: '🌳', img: 'elder', name: 'Elder Elderberry', x: COLS, y: row }];
}

// ─── Speech bubble ────────────────────────────────────────────────────────────

let _bubble = null;
let _bubbleActive = false;
let _bubbleQueue = [];
let _bubbleTimer = null;

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
      state.firedTriggerLines.add(key);
      _bubbleQueue.push({ npc, text: line.text });
      _processQueue();
    }
  }
}

bus.on('trigger', ({ type, ...ctx }) => _handleTrigger(type, ctx));
