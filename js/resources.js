'use strict';
import { state } from './main.js';
import { sfxMine } from './audio.js';
import { mkGain, hudU } from './ui.js';

// ─── Resource type definitions ─────────────────────────────────────────────
// Each entry is one collectable resource that exists in the player's inventory.
// Add new resources here — the HUD and save system pick them up automatically.
export const RTYPES = {
  stone: { icon: '🪨', name: 'Stone', clr: '#94a3b8' },
  wood: { icon: '🪵', name: 'Wood', clr: '#92400e' },
  dust: { icon: '🔮', name: 'Dust', clr: '#a855f7' }
};

// ─── Resource node type definitions ───────────────────────────────────────
// Each entry is a clickable world node that drops a resource.
// resource  — key into RTYPES
// count     — how many nodes to place per map
// chance    — drop probability per click (0–1)
// yield     — amount added on success
// wobble    — animation duration in ticks
// cooldown  — ticks before the node can be clicked again
export const NTYPES = {
  stone: { resource: 'stone', count: 3, chance: 0.20, yield: 1, wobble: 8, cooldown: 12 },
};

// ─── Placement ────────────────────────────────────────────────────────────
export function placeNodes() {
  const { grid, COLS, ROWS, pathSet } = state;
  const used = new Set();
  const nodes = [];
  for (const [type, nt] of Object.entries(NTYPES)) {
    const grass = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const k = x + ',' + y;
        if (!pathSet.has(k) && !used.has(k) && grid[y]?.[x]?.type === 'empty') grass.push({ x, y });
      }
    }
    // Fisher-Yates shuffle for random selection
    for (let i = grass.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [grass[i], grass[j]] = [grass[j], grass[i]];
    }
    for (let i = 0; i < Math.min(nt.count, grass.length); i++) {
      const gNode = grass[i];
      used.add(gNode.x + ',' + gNode.y);
      const nd = { type, x: gNode.x, y: gNode.y, wobbleTick: 0, cd: 0 };
      nodes.push(nd);
      grid[gNode.y][gNode.x].type = 'node';
      grid[gNode.y][gNode.x].content = nd;
    }
  }
  state.nodes = nodes;
}

// ─── Per-tick update ──────────────────────────────────────────────────────
export function updateNodes() {
  for (const n of state.nodes) {
    if (n.wobbleTick > 0) n.wobbleTick--;
    if (n.cd > 0) n.cd--;
  }
}

// ─── Click interaction ────────────────────────────────────────────────────
export function clickNode(node) {
  if (node.cd > 0) return;
  const nt = NTYPES[node.type];
  const rt = RTYPES[nt.resource];
  node.wobbleTick = nt.wobble;
  node.cd = nt.cooldown;
  sfxMine();
  if (Math.random() < nt.chance) {
    state.resources[nt.resource] = (state.resources[nt.resource] || 0) + nt.yield;
    mkGain(node.x * state.CELL + state.CELL / 2, node.y * state.CELL + state.CELL / 2,
      rt.icon, nt.yield, rt.clr);
    hudU();
  }
}

// ─── Rendering (called inside world camera transform) ─────────────────────
export function renderNodes() {
  const { cx, nodes, CELL, grid } = state;
  if (!nodes.length) return;
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.fillStyle = '#fff';
  const fs = Math.round(CELL * 0.55);
  cx.font = fs + 'px serif';
  for (const n of nodes) {
    if (grid[n.y]?.[n.x]?.type === 'tower') continue; // hidden under a tower
    const wx = n.x * CELL + CELL / 2, wy = n.y * CELL + CELL / 2;
    const icon = RTYPES[NTYPES[n.type].resource].icon;
    if (n.wobbleTick > 0) {
      cx.save();
      cx.translate(wx, wy);
      cx.rotate(Math.sin(n.wobbleTick * 1.4) * 0.08);
      cx.fillText(icon, 0, 0);
      cx.restore();
    } else {
      cx.fillText(icon, wx, wy);
    }
  }
}

// ─── Ground Loot Drop ─────────────────────────────────────────────────────
export function dropItem(cx, cy, type) {
  const cell = state.grid[cy]?.[cx];
  if (!cell) return false;
  // Tower-aware routing: deliver directly to tower if applicable
  const tw = cell.content;
  if (tw?.type === 'stockpile') {
    state.resources[type] = (state.resources[type] || 0) + 1;
    const rt = RTYPES[type]; if (rt) mkGain(cx * state.CELL + state.CELL / 2, cy * state.CELL + state.CELL / 2, rt.icon, 1, rt.clr);
    return true;
  }
  if (tw?.type === 'hoard' && (type === 'wood' || type === 'stone')) {
    tw.dep[type] = (tw.dep[type] || 0) + 1;
    const rt = RTYPES[type]; if (rt) mkGain(cx * state.CELL + state.CELL / 2, cy * state.CELL + state.CELL / 2, rt.icon, 1, rt.clr);
    return true;
  }
  // Default: place as ground stack
  if (!cell.stacks) cell.stacks = [null, null, null, null];
  let existingIndex = cell.stacks.findIndex(s => s && s.type === type && s.count < 64);
  if (existingIndex !== -1) { cell.stacks[existingIndex].count++; return true; }
  let emptyIndices = [];
  cell.stacks.forEach((s, idx) => { if (!s) emptyIndices.push(idx); });
  if (emptyIndices.length > 0) {
    cell.stacks[emptyIndices[Math.floor(Math.random() * emptyIndices.length)]] = { type, count: 1 };
    return true;
  }
  return false; // all slots full
}

// ─── Ground Loot Renderer ──────────────────────────────────────────────────
export function renderStacks() {
  const { cx, CELL, grid, COLS, ROWS } = state;
  if (!grid.length) return;
  
  const slots = [
    {dx: 0.25, dy: 0.25},
    {dx: 0.75, dy: 0.75},
    {dx: 0.75, dy: 0.25},
    {dx: 0.25, dy: 0.75}
  ];
  
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  const fs = Math.round(CELL * 0.45);
  cx.font = fs + 'px serif';

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = grid[r]?.[c];
      if (!cell?.stacks) continue;
      
      for (let i = 0; i < 4; i++) {
        const stack = cell.stacks[i];
        if (!stack) continue;
        const icon = RTYPES[stack.type]?.icon || '❓';
        const basex = c * CELL + slots[i].dx * CELL;
        const basey = r * CELL + slots[i].dy * CELL;
        
        cx.save();
        cx.translate(basex, basey);
        const sc = 1 + Math.min(stack.count, 20) * 0.02;
        cx.scale(sc, sc);
        cx.fillText(icon, 0, 0);
        cx.restore();
        
        if (stack.count > 1) {
          cx.save();
          cx.font = '900 ' + Math.floor(CELL * 0.18) + 'px sans-serif';
          cx.strokeStyle = '#000';
          cx.lineWidth = 2;
          cx.strokeText('x' + stack.count, basex + CELL * 0.15, basey + CELL * 0.15);
          cx.fillStyle = '#fff';
          cx.fillText('x' + stack.count, basex + CELL * 0.15, basey + CELL * 0.15);
          cx.restore();
        }
      }
    }
  }
}

