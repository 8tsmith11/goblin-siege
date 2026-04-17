'use strict';

export const RARITY_COLORS = {
  common:    '#94a3b8',
  uncommon:  '#22c55e',
  rare:      '#3b82f6',
  epic:      '#a855f7',
  legendary: '#f59e0b',
};

export const ARTIFACTS = [
  {
    id: 'lucky_paw',
    name: 'Lucky Paw',
    icon: '🐾',
    rarity: 'uncommon',
    desc: '+10% resource drop chance from enemies.',
    flavor: '"Fortune favors the persistent."',
    cost: 30,
  },
  {
    id: 'heralds_horn',
    name: "Herald's Horn",
    icon: '📯',
    rarity: 'rare',
    desc: 'Boss waves announced 1 wave early.',
    flavor: '"Blow it before the moment, not during."',
    cost: 0,
    pipShop: false,
  },
  {
    id: 'tally_stick',
    name: 'Tally Stick',
    icon: '🪵',
    rarity: 'uncommon',
    desc: '+15% chance of Dust drops from enemies.',
    flavor: '"The notches are older than the wood."',
    cost: 35,
    pipShop: false,
  },
  {
    id: 'warm_pebble',
    name: 'Warm Pebble',
    icon: '🪨',
    rarity: 'uncommon',
    desc: 'Towers adjacent to the Lab fire 10% faster.',
    flavor: '"Where does the heat come from?"',
    cost: 40,
    pipShop: false,
  },
  {
    id: 'the_bell',
    name: 'The Bell',
    icon: '🔔',
    rarity: 'rare',
    desc: 'Active: Freeze all enemies for 2.5 seconds.',
    flavor: '"It\'s a pause."',
    cost: 0,
    active: true,
    cooldownWaves: 8,
    pipShop: false,
  },
];
