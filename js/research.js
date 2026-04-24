'use strict';
import { state } from './main.js';
import { TD } from './data.js';
import { bus } from './bus.js';

bus.on('trigger', ({ type }) => {
  if (type === 'frequency_played' && state.research) {
    const def = VARIABLE_RESEARCH.find(n => n.id === 'acoustic_anomaly');
    if (def && !state.research['acoustic_anomaly']) {
      state.research['acoustic_anomaly'] = { ...def, status: 'available', wavesLeft: def.waves, wavesTotal: def.waves };
    }
  }
});

// Populated from data/research.json at startup
export let FIXED_RESEARCH = {};
export let VARIABLE_RESEARCH = [];
export let RESEARCH_JSON = null; // raw loaded JSON (mutable reference for dev edits)

export const RESEARCH_DATA_READY = fetch('./data/research.json')
  .then(r => r.json())
  .then(data => {
    RESEARCH_JSON = data;
    FIXED_RESEARCH = data.fixed;
    VARIABLE_RESEARCH = data.variable;
  })
  .catch(err => {
    console.warn('Failed to load data/research.json, using empty research data.', err);
  });

export const UNLOCK_DESC = {
  'hoard,lab':          'Hoard Pile & Lab unlocked',
  'fish,seahorse':      'Fish & Seahorse towers',
  'heron':              'Clever Heron tower',
  'robot':              'AI Agent (Robot) tower',
  'monkey,stockpile':   'Monkey Hut & Stockpile',
  'stockpile_interface':'Stockpile Interface Mode',
  'beehive':            'Beehive building',
  'lizard':             'Abhorrent Lizard tower',
  'clown':              'Magnificent Clown tower',
  'lab_radius_+1':      '+1 Lab observation radius',
  'goblin_translations':'Goblin Translations lore',
  'tower_age_counters': 'Age counters on towers; Hoard upgrades unlocked',
  'steam_age':          'Steam Age unlocked',
  'monkey_capacity_+1': '+1 monkey per Monkey Hut',
  'lab_radius_+2':      '+2 Lab observation radius',
  'tower_wall':         'Wall tower available',
  'tower_campfire':     'Campfire tower available',
  'reveal_5_tiles':     'Reveals 5 map tiles',
  'augment_tripwire':   'Tripwire augment',
  'consumable_ale':     'Consumable: Ale',
  'lore_tremor':        'Tremor lore entry',
  'monkey_logistics':   'Round Robin & Harvest roles',
  'monkey_auto_place':  'Monkeys auto-place path consumables',
  'hoard':              'Hoard Pile unlocked',
  'tower_skills':       'Tower skill upgrades unlocked',
  'workbench':          'Workbench available',
  'seahorse_aura_auto': 'Seahorse auto-aura (2-tile invis detection)',
  'insightful_lens_recipe': 'Insightful Lens recipe unlocked at Workbench',
};

// Evaluate a game-state prerequisite string against current state.
export function checkGamePrereq(node) {
  const gp = node.gamePrereq;
  if (!gp) return true;
  if (gp === 'has_lab')    return (state.towers || []).some(t => t.type === 'lab');
  if (gp === 'has_hoard')  return (state.towers || []).some(t => t.type === 'hoard');
  if (gp === 'has_monkey') return (state.towers || []).some(t => t.type === 'monkey');
  if (gp.startsWith('wave>=')) return (state.wave || 0) >= parseInt(gp.slice(6));
  return true;
}

function _resolveSlot(slot) {
  if (slot.selects === 'wave10Blueprint_counterpart') {
    const bpTower = state.worldGenChoices?.wave10Blueprint;
    return VARIABLE_RESEARCH.find(n => slot.nodes.includes(n.id) && n.unlocks !== bpTower);
  }
  return null;
}

export function buildResearchGraph() {
  const bpTower = state.worldGenChoices?.wave10Blueprint;
  const nodes = {};
  const usedIds = new Set();

  // Fixed research (skip if unlocked via blueprint drop)
  for (const [id, def] of Object.entries(FIXED_RESEARCH)) {
    if (bpTower && def.unlocks === bpTower) continue;
    nodes[id] = { ...def, id, status:'locked', wavesLeft:def.waves, wavesTotal:def.waves };
  }

  const pools = RESEARCH_JSON?.pools || {};
  for (const [poolId, poolCfg] of Object.entries(pools)) {
    const candidates = VARIABLE_RESEARCH.filter(n => n.pool === poolId && !n.hidden);
    let picks;
    if (poolId === 'parity_1') {
      picks = candidates.filter(n => n.unlocks !== bpTower);
      picks = picks.length ? [picks[Math.floor(Math.random() * picks.length)]] : [];
    } else {
      const shuffled = [...candidates].sort(() => Math.random() - 0.5);
      picks = shuffled.slice(0, poolCfg.size || 1);
    }
    const positions = poolCfg.positions || [];
    // Use stable slot IDs so pool positions are constant between runs; content varies
    picks.forEach((def, i) => {
      const slotId = `pool_${poolId}_${i}`;
      const pos = positions[i] || {};
      nodes[slotId] = { ...def, id: slotId, _sourceId: def.id, ...pos, status:'locked', wavesLeft:def.waves, wavesTotal:def.waves };
      usedIds.add(slotId);
    });
  }

  // General pool nodes without explicit pool field (legacy fallback - none expected)
  const nonPooled = VARIABLE_RESEARCH.filter(n => !n.pool && !n.hidden && n.unlocks !== bpTower);
  if (nonPooled.length) {
    const picked = [...nonPooled].sort(() => Math.random() - 0.5).slice(0, 3);
    for (const def of picked) {
      nodes[def.id] = { ...def, status:'locked', wavesLeft:def.waves, wavesTotal:def.waves };
    }
  }

  // Add triggered hidden nodes if conditions are met
  for (const def of VARIABLE_RESEARCH.filter(n => n.hidden)) {
    if (def.trigger === 'frequency_played' && state.frequencyPlayed) {
      nodes[def.id] = { ...def, status:'locked', wavesLeft:def.waves, wavesTotal:def.waves };
    } else if (def.trigger === 'tremor_event_seen' && state.bSen?.has('tremor_event')) {
      nodes[def.id] = { ...def, status:'locked', wavesLeft:def.waves, wavesTotal:def.waves };
    }
  }
  refreshStatuses(nodes);
  return nodes;
}

export function refreshStatuses(nodes) {
  for (const node of Object.values(nodes)) {
    if (node.status === 'complete' || node.status === 'active') continue;
    const prereqsMet = node.prereqs.every(p => nodes[p]?.status === 'complete');
    node.status = prereqsMet ? 'available' : 'locked';
  }
}

export function canAfford(cost) {
  const res = state.resources || {};
  return Object.entries(cost).every(([r, n]) => (res[r] || 0) >= n);
}

export function spendResources(cost) {
  for (const [r, n] of Object.entries(cost)) {
    state.resources[r] = Math.max(0, (state.resources[r] || 0) - n);
  }
}

// Returns the completed node if research finished this wave, otherwise null.
export function tickResearch() {
  const nodes = state.research;
  if (!nodes) return null;
  const active = Object.values(nodes).find(n => n.status === 'active');
  if (!active) return null;
  active.wavesLeft--;
  if (active.wavesLeft <= 0) {
    active.status = 'complete';
    applyUnlock(active);
    refreshStatuses(nodes);
    return active;
  }
  return null;
}

export function applyUnlock(node) {
  const u = node.unlocks;
  if (!u) return;

  // Check if it's a tower unlock (csv of tower keys)
  u.split(',').forEach(key => {
    if (state.unlockedTowers && state.unlockedTowers.has(key) === false && TD[key]) {
      state.unlockedTowers.add(key);
    }
  });

  switch (u) {
    case 'lab_radius_+1': {
      state.researchUnlocks.lab_radius = (state.researchUnlocks.lab_radius || 0) + 1;
      const lab = state.towers?.find(t => t.type === 'lab');
      if (lab) lab.obsRange = TD.lab.obsRange + state.researchUnlocks.lab_radius;
      break;
    }
    case 'lab_radius_+2': {
      state.researchUnlocks.lab_radius = (state.researchUnlocks.lab_radius || 0) + 2;
      const lab = state.towers?.find(t => t.type === 'lab');
      if (lab) lab.obsRange = TD.lab.obsRange + state.researchUnlocks.lab_radius;
      break;
    }
    case 'monkey_capacity_+1': {
      state.researchUnlocks.monkey_capacity = (state.researchUnlocks.monkey_capacity || 0) + 1;
      const maxCap = 1 + state.researchUnlocks.monkey_capacity;
      const _names = ['Bongo','Mango','Zazu','Kiki','Popo','Tiko','Wren','Nala','Figgy','Morsel','Turnip','Widget'];
      for (const hut of (state.towers || [])) {
        if (hut.type !== 'monkey' || !hut.monkeys) continue;
        while (hut.monkeys.length < maxCap) {
          const angle = Math.random() * Math.PI * 2;
          const cx = hut.x * state.CELL + state.CELL / 2;
          const cy = hut.y * state.CELL + state.CELL / 2;
          hut.monkeys.push({
            name: _names[Math.floor(Math.random() * _names.length)],
            role: null, cfg: { filter: null, dest: null, from: null, boost: null }, trips: 0,
            x: cx + Math.cos(angle) * state.CELL * 0.6,
            y: cy + Math.sin(angle) * state.CELL * 0.6,
            st: 'idle', carrying: null, patrolAngle: angle,
            targetX: null, targetY: null, waitCd: 0,
          });
        }
      }
      break;
    }
    case 'stockpile_interface': {
      state.researchUnlocks.stockpile_interface = true;
      break;
    }
    case 'monkey_logistics': {
      state.researchUnlocks.monkey_round_robin = true;
      state.researchUnlocks.monkey_harvester = true;
      break;
    }
    case 'monkey_auto_place': {
      state.researchUnlocks.monkey_auto_place = true;
      break;
    }
    case 'tower_age_counters': {
      state.researchUnlocks.tower_age_counters = true;
      state.researchUnlocks.hoard_upgrades = true;
      break;
    }
    case 'goblin_translations': {
      state.patternRecDone = true;
      break;
    }
    case 'tower_skills': {
      state.researchUnlocks.tower_skills = true;
      break;
    }
    case 'tower_campfire': {
      state.unlockedTowers?.add('campfire');
      break;
    }
    case 'seahorse_aura_auto': {
      state.researchUnlocks.seahorse_aura_auto = true;
      break;
    }
    case 'insightful_lens_recipe': {
      state.researchUnlocks.insightful_lens_recipe = true;
      break;
    }
    case 'artifact_slot_+1': {
      state.researchUnlocks.artifact_slots = (state.researchUnlocks.artifact_slots || 0) + 1;
      const inv = state.inventory;
      if (inv) {
        const targetLen = 1 + state.researchUnlocks.artifact_slots;
        while (inv.equipped.length < targetLen) inv.equipped.push(null);
      }
      break;
    }
  }
  // Handle patternRecDone for translation system
  if (node.id === 'pattern_rec') state.patternRecDone = true;
}

// Look up a node's position from the authoritative RESEARCH_JSON source.
// This ensures reloaded saves always reflect the current data/research.json,
// not the stale x/y values serialised into the localStorage save blob.
function posFromJSON(id) {
  if (!RESEARCH_JSON) return null;
  if (RESEARCH_JSON.fixed[id]) return { x: RESEARCH_JSON.fixed[id].x, y: RESEARCH_JSON.fixed[id].y };
  const vn = RESEARCH_JSON.variable.find(n => n.id === id);
  return vn ? { x: vn.x, y: vn.y } : null;
}

export function layoutNodes(nodes, W = 520, H = 280) {
  const GRID_STEP = RESEARCH_JSON?.gridStep ?? 120;
  const positions = {};
  const noPos = [];

  for (const id of Object.keys(nodes)) {
    const p = posFromJSON(id);
    const node = nodes[id];
    const px = (p?.x !== undefined ? p.x : node?.x);
    const py = (p?.y !== undefined ? p.y : node?.y);
    if (px !== undefined && py !== undefined) {
      positions[id] = { x: px, y: py };
    } else {
      noPos.push(id);
    }
  }

  if (!noPos.length) return positions;

  // Algorithmic fallback for nodes without stored positions
  const memo = {};
  function depth(id) {
    if (id in memo) return memo[id];
    const n = nodes[id];
    if (!n || !n.prereqs.length) return (memo[id] = 0);
    const parents = n.prereqs.filter(p => p in nodes);
    return (memo[id] = parents.length ? 1 + Math.max(...parents.map(depth)) : 0);
  }
  const depths = {};
  for (const id of noPos) depths[id] = depth(id);
  if ('the_forge' in depths) {
    const others = Object.keys(depths).filter(id => id !== 'the_forge').map(id => depths[id]);
    depths['the_forge'] = (others.length ? Math.max(...others) : 0) + 1;
  }
  const colGroups = {};
  for (const [id, d] of Object.entries(depths)) (colGroups[d] = colGroups[d] || []).push(id);

  const COL_GAP = GRID_STEP, ROW_GAP = GRID_STEP;
  const maxCol = Math.max(...Object.keys(colGroups).map(Number));
  const maxRowCount = Math.max(...Object.values(colGroups).map(g => g.length));
  const graphW = maxCol * COL_GAP;
  const graphH = (maxRowCount - 1) * ROW_GAP;
  const offX = W / 2 - graphW / 2;
  const offY = H / 2 - graphH / 2;

  for (const [col, ids] of Object.entries(colGroups)) {
    const x = offX + parseInt(col) * COL_GAP;
    const colH = (ids.length - 1) * ROW_GAP;
    ids.forEach((id, i) => {
      positions[id] = { x, y: offY + (graphH - colH) / 2 + i * ROW_GAP };
    });
  }

  return positions;
}
