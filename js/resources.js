'use strict';
import { state, getCell } from './main.js';
import { sfxMine } from './audio.js';
import { mkGain, hudU, addToInventory } from './ui.js';
import { HOARD_LEVELS } from './data.js';

// ─── Crafted item icon registry (populated by craft.js at module init) ────────
export const _itemRegistry = {}; // maps itemId -> { icon, name }

// ─── Resource type definitions ─────────────────────────────────────────────
// Each entry is one collectable resource that exists in the player's inventory.
// Add new resources here — the HUD and save system pick them up automatically.
export const RTYPES = {
  stone: { icon: '🪨', name: 'Stone', clr: '#94a3b8' },
  wood: { icon: '🪵', name: 'Wood', clr: '#92400e' },
  dust: { icon: '🔮', name: 'Dust', clr: '#a855f7' }
};

// Returns { icon, name } for any item type — RTYPE or crafted item.
export function getItemDef(type) {
  return RTYPES[type] ?? _itemRegistry[type] ?? { icon: '❓', name: type };
}

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
    const PAD = 6;
    for (let y = PAD; y < ROWS - PAD; y++) {
      for (let x = PAD; x < COLS - PAD; x++) {
        const k = x + ',' + y;
        if (!pathSet.has(k) && !used.has(k) && getCell(x, y)?.type === 'empty') grass.push({ x, y });
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
      const nc = getCell(gNode.x, gNode.y);
      nc.type = 'node'; nc.content = nd;
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
    if (getCell(n.x, n.y)?.type === 'tower') continue; // hidden under a tower
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

// ─── Unified tile accept check ────────────────────────────────────────────────
// Returns true if the tile at (gx, gy) can accept one item of the given type.
// Used by both dropItem and the monkey system to stay in sync.
export function canTileAccept(gx, gy, type) {
  const cell = getCell(gx, gy);
  if (!cell || cell.type === 'forest') return false;
  const tw = cell.content;
  if (tw?.type === 'stockpile') {
    if (tw.mode === 'interface') return true;
    if (!tw.slots) return true;
    const cap = 64 << (tw.level || 0);
    return tw.slots.some(s => !s) || tw.slots.some(s => s && (!type || s.type === type) && s.count < cap);
  }
  if (tw?.type === 'hoard') {
    if (!RTYPES[type] || type === 'dust') return false;
    const cap = (HOARD_LEVELS[tw.level || 0] ?? HOARD_LEVELS[0]).cap;
    return (tw.stored || 0) < cap;
  }
  if (tw?.type === 'workbench') return !!RTYPES[type] && (tw.inv?.[type] || 0) < 20;
  const stacks = cell.stacks;
  if (!stacks) return true;
  return stacks.some(s => !s) || stacks.some(s => s && (!type || s.type === type) && s.count < 64);
}

// ─── Ground Loot Drop ─────────────────────────────────────────────────────
export function dropItem(cx, cy, type) {
  const cell = getCell(cx, cy);
  if (!cell) return false;
  // Tower-aware routing: deliver directly to tower if applicable
  const tw = cell.content;
  if (tw?.type === 'stockpile') {
    const isCrafted = !RTYPES[type];
    if (tw.mode === 'interface') {
      if (isCrafted) {
        // Crafted items go to player inventory
        const def = getItemDef(type);
        const section = _itemRegistry[type]?.output === 'consumable' ? 'consumables' : 'augments';
        addToInventory(section, { id: type, name: def.name, icon: def.icon, rarity: def.rarity, desc: def.desc });
        mkGain(cx * state.CELL + state.CELL / 2, cy * state.CELL + state.CELL / 2, def.icon, 1, '#6ee7b7');
      } else {
        state.resources[type] = (state.resources[type] || 0) + 1;
        const rt = RTYPES[type]; if (rt) mkGain(cx * state.CELL + state.CELL / 2, cy * state.CELL + state.CELL / 2, rt.icon, 1, rt.clr);
      }
      return true;
    }
    // Storage mode — deposit into slots
    if (type === 'dust') return false;
    if (!tw.slots) tw.slots = [null, null, null, null];
    const cap = 64 << (tw.level || 0);
    const def = getItemDef(type);
    for (let i = 0; i < tw.slots.length; i++) {
      const s = tw.slots[i];
      if (s && s.type === type && s.count < cap) { s.count++; mkGain(cx * state.CELL + state.CELL / 2, cy * state.CELL + state.CELL / 2, def.icon, 1, '#94a3b8'); return true; }
    }
    for (let i = 0; i < tw.slots.length; i++) {
      if (!tw.slots[i]) { tw.slots[i] = { type, count: 1 }; mkGain(cx * state.CELL + state.CELL / 2, cy * state.CELL + state.CELL / 2, def.icon, 1, '#94a3b8'); return true; }
    }
    return false; // all slots full
  }
  if (tw?.type === 'hoard') {
    if (!RTYPES[type] || type === 'dust') return false;
    const cap = (HOARD_LEVELS[tw.level || 0] ?? HOARD_LEVELS[0]).cap;
    if ((tw.stored || 0) >= cap) return false;
    tw.stored = (tw.stored || 0) + 1;
    mkGain(cx * state.CELL + state.CELL / 2, cy * state.CELL + state.CELL / 2, '🏺', 1, '#10b981');
    return true;
  }
  if (tw?.type === 'workbench' && RTYPES[type]) {
    if (!tw.inv) tw.inv = {};
    if ((tw.inv[type] || 0) >= 20) return false;
    tw.inv[type] = (tw.inv[type] || 0) + 1;
    const rt = RTYPES[type];
    mkGain(cx * state.CELL + state.CELL / 2, cy * state.CELL + state.CELL / 2, rt.icon, 1, rt.clr);
    return true;
  }
  // Non-RTYPE items (crafted items) on workbench tiles fall through to ground stacks below
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
      const cell = getCell(c, r);
      if (!cell?.stacks) continue;
      
      for (let i = 0; i < 4; i++) {
        const stack = cell.stacks[i];
        if (!stack) continue;
        const basex = c * CELL + slots[i].dx * CELL;
        const basey = r * CELL + slots[i].dy * CELL;

        if (stack.bossLoot) {
          cx.save();
          const pulse = 0.55 + Math.sin(state.ticks * 0.08) * 0.45;
          const grad = cx.createRadialGradient(basex, basey, 0, basex, basey, CELL * 0.45);
          grad.addColorStop(0, 'rgba(253,230,138,' + (pulse * 0.7).toFixed(2) + ')');
          grad.addColorStop(1, 'rgba(253,230,138,0)');
          cx.fillStyle = grad;
          cx.beginPath(); cx.arc(basex, basey, CELL * 0.45, 0, Math.PI * 2); cx.fill();

          const isBp = stack.section === 'blueprints';
          if (isBp) {
            const bsz = Math.round(CELL * 0.38);
            cx.fillStyle = '#1d4ed8';
            cx.beginPath();
            cx.roundRect(basex - bsz * 0.6, basey - bsz * 0.6, bsz * 1.2, bsz * 1.2, 3);
            cx.fill();
            cx.font = Math.round(CELL * 0.28) + 'px serif';
            cx.fillText(stack.item.bpOverlay || stack.item.icon || '🎁', basex, basey);
          } else {
            cx.font = Math.round(CELL * 0.38) + 'px serif';
            cx.fillText(stack.item.icon || '🎁', basex, basey);
          }
          cx.restore();
          continue;
        }

        const icon = RTYPES[stack.type]?.icon ?? _itemRegistry[stack.type]?.icon ?? '❓';
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

