'use strict';
import { state, _ΨΔ } from './main.js';
import { panelU } from './ui.js';

export const SP = {};

export function castSpell(k) {
  if (!SP[k]) return;
  const cost = SP[k].cost;
  if (state.gold < cost || state.phase !== 'active') return;
  state.sel = null; panelU();
}
