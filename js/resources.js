'use strict';
import { state } from './main.js';
import { sfxMine } from './audio.js';
import { mkGain, hudU } from './ui.js';

// ─── Resource type definitions ─────────────────────────────────────────────
// Each entry is one collectable resource that exists in the player's inventory.
// Add new resources here — the HUD and save system pick them up automatically.
export const RTYPES = {
  stone: { icon: '🪨', name: 'Stone', clr: '#94a3b8' },
  sticks: { icon: '🪵', name: 'Sticks', clr: '#92400e' },
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
