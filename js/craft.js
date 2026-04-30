'use strict';
import { state, dropLoot } from './main.js';
import { dropItem, _itemRegistry } from './resources.js';
import { TD } from './data.js';

export const RECIPES = [
  {
    id: 'sharpened_flint', name: 'Sharpened Flint', icon: '🗿',
    rarity: 'common',
    cost: { stone: 2 }, waves: 1, output: 'augment',
    desc: '+15% damage to one tower',
    apply:   tw => { tw.dmg = Math.round(tw.dmg * 1.15); },
    unapply: tw => { tw.dmg = Math.round(tw.dmg / 1.15); },
  },
  {
    id: 'polished_stone', name: 'Polished Stone', icon: '⚪',
    rarity: 'common',
    cost: { stone: 2 }, waves: 1, output: 'augment',
    desc: '+10% range to one tower',
    apply:   tw => { tw.range = Math.round(tw.range * 1.1 * 10) / 10; },
    unapply: tw => { tw.range = Math.round(tw.range / 1.1 * 10) / 10; },
  },
  {
    id: 'taut_sinew', name: 'Taut Sinew', icon: '🧵',
    rarity: 'uncommon',
    cost: { wood: 2 }, waves: 1, output: 'augment',
    desc: '-10% cooldown to one tower',
    apply:   tw => { tw.rate = Math.max(1, Math.round(tw.rate * 0.9)); },
    unapply: tw => { tw.rate = Math.round(tw.rate / 0.9); },
  },
  {
    id: 'stone_trap', name: 'Stone Trap', icon: '🪤',
    rarity: 'common',
    cost: { stone: 3 }, waves: 1, output: 'consumable',
    desc: 'Place on path: instantly kills the first enemy that steps on it. Barely scratches bosses.',
    trapType: 'trap',
  },
  {
    id: 'sticky_sap', name: 'Sticky Sap', icon: '🍯',
    rarity: 'uncommon',
    cost: { wood: 2, stone: 1 }, waves: 1, output: 'consumable',
    desc: 'Place on path: 40% slow to all enemies crossing. Lasts until worn down.',
    trapType: 'sap',
  },
  {
    id: 'insightful_lens', name: 'Insightful Lens', icon: '🔭',
    rarity: 'rare',
    cost: { dust: 15, stone: 8 }, waves: 2, output: 'augment',
    desc: 'Apply to a Lab to let all towers in its radius target stealth enemies.',
    unlockKey: 'insightful_lens_recipe',
  },
  {
    id: 'seed_stone', name: 'Seed Stone', icon: '🪨',
    rarity: 'rare',
    cost: { stone: 8, wood: 4 }, waves: 2, output: 'consumable',
    desc: 'Place on a path tile. Invisible to enemies. Only the Spider Mother will notice.',
    trapType: 'seed_stone',
    unlockKey: 'seed_stone_recipe',
  },
  {
    id: 'ceasefire_flag_bp', name: 'Ceasefire Flag Blueprint', icon: '🏳️',
    rarity: 'rare',
    cost: { wood: 5, stone: 3 }, waves: 1, output: 'blueprint',
    desc: 'Unlocks the Ceasefire Flag. When raised, towers stand down.',
    unlockKey: 'ceasefire_flag_bp_recipe',
    buildKey: 'ceasefire_flag',
  },
];

// Register items into the shared registry so resources.js can look them up
for (const r of RECIPES) _itemRegistry[r.id] = { icon: r.icon, name: r.name, output: r.output, rarity: r.rarity, desc: r.desc };

export function canAffordRecipe(recipe) {
  const res = state.resources || {};
  return Object.entries(recipe.cost).every(([r, n]) => (res[r] || 0) >= n);
}

// Check if a workbench's own inventory has enough resources for a recipe.
export function workbenchHasResources(tw, recipeId) {
  const recipe = RECIPES.find(r => r.id === recipeId);
  if (!recipe) return false;
  const inv = tw.inv || {};
  return Object.entries(recipe.cost).every(([r, n]) => (inv[r] || 0) >= n);
}

// Select a recipe on a workbench (or clear with null). Does NOT consume resources.
export function selectRecipe(tw, recipeId) {
  tw.selectedRecipe = recipeId || null;
}

// Cancel crafting on a specific workbench tower — returns resources to tw.inv.
export function cancelCraft(tw) {
  if (!tw.craftQueue) return;
  const recipe = RECIPES.find(r => r.id === tw.craftQueue.recipeId);
  if (recipe) {
    if (!tw.inv) tw.inv = {};
    for (const [r, n] of Object.entries(recipe.cost)) {
      tw.inv[r] = (tw.inv[r] || 0) + n;
    }
  }
  tw.craftQueue = null;
}

// Called at wave-end. Auto-starts and ticks all workbench craft queues.
// Returns array of { tw, recipe } completions.
export function tickCraft() {
  const results = [];
  for (const tw of state.towers) {
    if (tw.type !== 'workbench') continue;
    // Auto-start if selected recipe and resources available
    if (!tw.craftQueue && tw.selectedRecipe) {
      const recipe = RECIPES.find(r => r.id === tw.selectedRecipe);
      if (recipe && workbenchHasResources(tw, tw.selectedRecipe)) {
        if (!tw.inv) tw.inv = {};
        const freeCraft = tw._monkeyBoosted && Math.random() < 0.25;
        if (!freeCraft) {
          for (const [r, n] of Object.entries(recipe.cost)) {
            tw.inv[r] = Math.max(0, (tw.inv[r] || 0) - n);
          }
        }
        tw.craftQueue = { recipeId: tw.selectedRecipe, wavesLeft: recipe.waves, wavesTotal: recipe.waves };
      }
    }
    if (!tw.craftQueue) continue;
    tw.craftQueue.wavesLeft -= tw._monkeyBoosted ? 2 : 1;
    if (tw.craftQueue.wavesLeft <= 0) {
      const recipe = RECIPES.find(r => r.id === tw.craftQueue.recipeId);
      tw.craftQueue = null;
      if (recipe) {
        if (recipe.output === 'blueprint' && recipe.buildKey) {
          dropLoot(tw.x, tw.y, 'blueprints', { id: recipe.buildKey + '_bp', icon: '🟦', bpOverlay: TD[recipe.buildKey]?.icon || recipe.icon, name: recipe.name, unlocks: recipe.buildKey });
        } else {
          dropItem(tw.x, tw.y, recipe.id);
        }
        results.push({ tw, recipe });
      }
    }
  }
  return results;
}

// Apply an augment item to a tower. Returns true on success.
export function applyAugment(item, tower) {
  // Special augment: Insightful Lens — Lab only
  if (item.id === 'insightful_lens') {
    if (tower.type !== 'lab') return false;
    tower.insightfulLens = true;
    if (!tower.augments) tower.augments = [];
    tower.augments.push({ id: item.id, name: item.name, icon: item.icon });
    return true;
  }
  const recipe = RECIPES.find(r => r.id === item.id);
  if (!recipe?.apply) return false;
  const slots = (tower.level || 0) >= 5 ? 2 : (tower.level || 0) >= 3 ? 1 : 0;
  if (!tower.augments) tower.augments = [];
  if (tower.augments.length >= slots) return false;
  recipe.apply(tower);
  tower.augments.push({ id: item.id, name: item.name, icon: item.icon });
  return true;
}

// Remove augment at index from a tower, reversing its stat effect. Returns the augment object.
export function removeAugment(tower, index) {
  if (!tower.augments?.[index]) return null;
  const aug = tower.augments[index];
  const recipe = RECIPES.find(r => r.id === aug.id);
  if (recipe?.unapply) recipe.unapply(tower);
  tower.augments.splice(index, 1);
  return aug;
}

// Place a consumable at grid position (gx, gy). Returns true on success.
export function placeConsumable(item, gx, gy) {
  const recipe = RECIPES.find(r => r.id === item.id);
  if (!recipe || recipe.output !== 'consumable') return false;
  if (!state.pathSet?.has(gx + ',' + gy)) return false;
  if (recipe.trapType === 'seed_stone') {
    state.seedStone = { x: gx, y: gy, wavesLeft: 10, carried: false };
    return true;
  }
  const trap = { type: recipe.trapType, x: gx, y: gy };
  if (recipe.trapType === 'trap') {
    trap.dmg = 9999; // insta-kill non-bosses; capped vs bosses in updateTraps
  } else if (recipe.trapType === 'barricade') {
    trap.wave = state.wave;
  } else if (recipe.trapType === 'sap') {
    trap.expiry = Infinity; // lasts the whole wave; cleared by cleanupBarricades
    trap.slow = 0.55;
  }
  if (!state.traps) state.traps = [];
  state.traps.push(trap);
  return true;
}

// Reset transient trap slows, apply sap slows, trigger stone traps. Call before updateEnemies.
export function updateTraps() {
  for (const e of state.enemies) e._trapSlow = 0;
  if (!state.traps?.length) return;

  const toRemove = [];
  for (let ti = 0; ti < state.traps.length; ti++) {
    const trap = state.traps[ti];
    if (trap.type === 'sap') {
      if (state.ticks >= trap.expiry) { toRemove.push(ti); continue; }
      for (const e of state.enemies) {
        if (e.dead) continue;
        if (Math.abs(e.x - trap.x) < 0.75 && Math.abs(e.y - trap.y) < 0.75) {
          e._trapSlow = Math.max(e._trapSlow, trap.slow);
        }
      }
    } else if (trap.type === 'trap') {
      for (const e of state.enemies) {
        if (e.dead) continue;
        if (Math.abs(e.x - trap.x) < 0.75 && Math.abs(e.y - trap.y) < 0.75) {
          e.hp -= e.boss ? Math.min(e.mhp * 0.04, 80) : e.mhp;
          toRemove.push(ti);
          break;
        }
      }
    }
  }
  for (let i = toRemove.length - 1; i >= 0; i--) state.traps.splice(toRemove[i], 1);
}

// Remove barricades at wave end.
export function cleanupBarricades() {
  if (state.traps) state.traps = state.traps.filter(t => t.type !== 'barricade' && t.type !== 'sap');
}
