'use strict';
import { state } from './main.js';

export const FIXED_RESEARCH = {
  basic_obs:   { name:'Basic Observation',   icon:'👁️',  cost:{dust:10},          waves:1, unlocks:'lab_radius_+1',      prereqs:[] },
  pattern_rec: { name:'Pattern Recognition', icon:'📜',  cost:{dust:30,stone:5},  waves:3, unlocks:'goblin_translations', prereqs:['basic_obs'] },
  structural:  { name:'Structural Analysis', icon:'🪨',  cost:{dust:20,wood:5},   waves:2, unlocks:'tower_age_counters',  prereqs:['basic_obs'] },
  the_forge:   { name:'The Forge',           icon:'⚒️',  cost:{dust:50,stone:20}, waves:5, unlocks:'steam_age',           prereqs:['pattern_rec','structural'] },
};

export const VARIABLE_RESEARCH = [
  { id:'animal_husb',   name:'Animal Husbandry',     icon:'🐵', cost:{dust:15,wood:5},   waves:2, unlocks:'monkey_capacity_+1', prereqs:['basic_obs'] },
  { id:'crude_optics',  name:'Crude Optics',          icon:'🔭', cost:{dust:20,flint:3},  waves:2, unlocks:'lab_radius_+2',      prereqs:['basic_obs'] },
  { id:'fortification', name:'Fortification',         icon:'🏰', cost:{dust:25,stone:10}, waves:3, unlocks:'tower_wall',         prereqs:['structural'] },
  { id:'bonfire',       name:'Bonfire Theory',        icon:'🔥', cost:{dust:20,wood:8},   waves:2, unlocks:'tower_campfire',     prereqs:['basic_obs'] },
  { id:'cartography',   name:'Prim. Cartography',     icon:'🗺️', cost:{dust:25,flint:5},  waves:3, unlocks:'reveal_5_tiles',     prereqs:['basic_obs'] },
  { id:'rope_craft',    name:'Rope Craft',            icon:'🪢', cost:{dust:15,wood:10},  waves:2, unlocks:'augment_tripwire',   prereqs:['structural'] },
  { id:'fermentation',  name:'Fermentation',          icon:'🍺', cost:{dust:15,wood:5},   waves:2, unlocks:'consumable_ale',     prereqs:['basic_obs'] },
  { id:'tremor_study',  name:'Tremor Analysis',       icon:'🌋', cost:{dust:15},          waves:2, unlocks:'lore_tremor',         prereqs:['basic_obs'], hidden:true, trigger:'tremor_event_seen' },
];

export const UNLOCK_DESC = {
  'lab_radius_+1':      '+1 Lab observation radius',
  'goblin_translations':'Goblin Translations lore',
  'tower_age_counters': 'Age counters on towers',
  'steam_age':          'Steam Age unlocked',
  'monkey_capacity_+1': '+1 Monkey capacity',
  'lab_radius_+2':      '+2 Lab observation radius',
  'tower_wall':         'Wall tower available',
  'tower_campfire':     'Campfire tower available',
  'reveal_5_tiles':     'Reveals 5 map tiles',
  'augment_tripwire':   'Tripwire augment',
  'consumable_ale':     'Consumable: Ale',
  'lore_tremor':        'Tremor lore entry',
};

export function buildResearchGraph() {
  const pool = [...VARIABLE_RESEARCH].sort(() => Math.random() - 0.5);
  const picked = pool.slice(0, 4 + (Math.random() < 0.5 ? 0 : 1));
  const nodes = {};
  for (const [id, def] of Object.entries(FIXED_RESEARCH)) {
    nodes[id] = { ...def, id, status:'locked', wavesLeft:def.waves, wavesTotal:def.waves };
  }
  for (const def of picked) {
    nodes[def.id] = { ...def, status:'locked', wavesLeft:def.waves, wavesTotal:def.waves };
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
  switch (node.unlocks) {
    case 'lab_radius_+1': {
      const lab = state.towers?.find(t => t.type === 'lab');
      if (lab) lab.obsRange = (lab.obsRange || 3) + 1;
      break;
    }
    case 'lab_radius_+2': {
      const lab = state.towers?.find(t => t.type === 'lab');
      if (lab) lab.obsRange = (lab.obsRange || 3) + 2;
      break;
    }
    case 'monkey_capacity_+1':
      state.researchUnlocks = state.researchUnlocks || {};
      state.researchUnlocks.monkeyCapacity = (state.researchUnlocks.monkeyCapacity || 0) + 1;
      break;
  }
}

export function layoutNodes(nodes, W = 520, H = 280) {
  const memo = {};
  function depth(id) {
    if (id in memo) return memo[id];
    const n = nodes[id];
    if (!n || !n.prereqs.length) return (memo[id] = 0);
    const parents = n.prereqs.filter(p => p in nodes);
    return (memo[id] = parents.length ? 1 + Math.max(...parents.map(depth)) : 0);
  }
  const depths = {};
  for (const id of Object.keys(nodes)) depths[id] = depth(id);
  if ('the_forge' in depths) {
    const others = Object.keys(depths).filter(id => id !== 'the_forge').map(id => depths[id]);
    depths['the_forge'] = (others.length ? Math.max(...others) : 0) + 1;
  }
  const colGroups = {};
  for (const [id, d] of Object.entries(depths)) (colGroups[d] = colGroups[d] || []).push(id);

  const COL_GAP = 130, ROW_GAP = 80;
  const maxCol = Math.max(...Object.keys(colGroups).map(Number));
  const maxRowCount = Math.max(...Object.values(colGroups).map(g => g.length));
  const graphW = maxCol * COL_GAP;
  const graphH = (maxRowCount - 1) * ROW_GAP;
  const offX = W / 2 - graphW / 2;
  const offY = H / 2 - graphH / 2;

  const positions = {};
  for (const [col, ids] of Object.entries(colGroups)) {
    const x = offX + parseInt(col) * COL_GAP;
    const colH = (ids.length - 1) * ROW_GAP;
    ids.forEach((id, i) => {
      positions[id] = { x, y: offY + (graphH - colH) / 2 + i * ROW_GAP };
    });
  }
  return positions;
}
