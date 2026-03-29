export const TD = {
  squirrel: { name:'Thoughtful Squirrel', icon:'🐿️', clr:'#8b5cf6', cost:40,  dmg:8,  range:3.2, rate:50, pClr:'#a78bfa', pSpd:4,   splash:0,   slow:0,  target:'weakest', cat:'tower', desc:'Long range · targets weakest enemy' },
  lion:     { name:'Rash Lion',           icon:'🦁',  clr:'#ef4444', cost:60,  dmg:15, range:2.0, rate:25, pClr:'#f87171', pSpd:6,   splash:0,   slow:0,  target:'first',   cat:'tower', desc:'Very fast · high single-target DPS' },
  penguin:  { name:'Ambitious Penguin',   icon:'🐧',  clr:'#06b6d4', cost:55,  dmg:5,  range:2.8, rate:35, pClr:'#67e8f9', pSpd:3,   splash:0,   slow:.4, target:'first',   cat:'tower', desc:'Slows enemies on hit' },
  lab:      { name:'Lab',                icon:'🧪', clr:'#a78bfa', cost:120, cat:'support', obsRange: 3, desc:'Gathers Dust 🔮 from enemies slain within 3 tiles' },
  hoard:    { name:'Hoard Pile',         icon:'🏺', clr:'#10b981', cost:60, cat:'support', desc:'Generates gold. Somebody has to do it.' },
  fish:     { name:'Arrogant Fish',       icon:'🐟',  clr:'#f59e0b', cost:75,  dmg:12, range:2.5, rate:60, pClr:'#fcd34d', pSpd:3.5, splash:1.2, slow:0,  target:'first',   cat:'tower', desc:'Splash damage · hits nearby enemies' },
  seahorse: { name:'Insightful Seahorse', icon:'🦑',  clr:'#ec4899', cost:65,  dmg:6,  range:3.5, rate:40, pClr:'#f472b6', pSpd:3,   splash:0,   slow:0,  target:'strongest',pierce:3, cat:'tower', desc:'Piercing shots · passes through enemies' },
  lizard:   { name:'Abhorrent Lizard',    icon:'🦎',  clr:'#84cc16', cost:85,  dmg:45, range:2.5, rate:65, pClr:'#a3e635', pSpd:5,   splash:1.0, slow:0,  target:'first',   speedUp:true, voiceLine:"I DESPISE YOU ALL!", cat:'tower', desc:'Massive damage · splash · speeds up enemies' },
  heron:    { name:'Clever Heron',        icon:'🦩',  clr:'#6366f1', cost:70,  dmg:10, range:3.0, rate:45, pClr:'#818cf8', pSpd:4,   splash:0,   slow:0,  target:'last',    chain:3, cat:'tower', desc:'Chain lightning · hits up to 3 targets' },
  clam:     { name:'Intuitive Clam',     icon:'🐚', clr:'#14b8a6', cost:80,  cat:'support', buffRange:2,  buffDmg:1.5, buffRate:.85, buffDesc:'+50% DMG, -15% CD to nearby', desc:'Buffs nearby towers: +50% DMG, -15% cooldown' },
  beehive:  { name:'Beehive',            icon:'🐝', clr:'#eab308', cost:90,  cat:'support', beeCount:3,  beeDmg:4,    beeRange:3,   beeRate:30,  desc:'Deploys bees that swarm and sting enemies' },
  clown:    { name:'Magnificent Clown',  icon:'🤡', clr:'#f472b6', cost:100, cat:'support', reverseRange:3, reverseDur:80, reverseCD:200, desc:'Reverses nearby enemy movement direction' },
  monkey:   { name:'Monkey Hut',         icon:'🛖', clr:'#fb923c', cost:70, resCost:{ stone:8, wood:8 }, cat:'support', capacity:1, range:4, desc:'Houses Resourceful Monkeys that gather, courier, or boost nearby buildings' },
  stockpile:{ name:'Stockpile',          icon:'📦', clr:'#d97706', cost:50, resCost:{ wood:6 }, cat:'support', desc:'Interface between ground items and your inventory. Monkeys deposit/withdraw here.' },
  robot:    { name:'AI Agent',           icon:'🤖', clr:'#38bdf8', cost:110, cat:'support', autoSpell:true, reqAge: 'iron', desc:'Automatically casts spells during waves' },
};

export const TOWER_SKILLS = {
  squirrel: {
    A: { name:'Piercing Gaze', desc:'Shots pierce 2 enemies',      excludes:'B', cost:{dust:15,gold:50}, owned:false, apply:tw=>{ tw.pierce=(tw.pierce||0)+2; } },
    B: { name:'Mind Blast',    desc:'Shots stun for 40 ticks',     excludes:'A', cost:{dust:15,gold:50}, owned:false, apply:tw=>{ tw.stun=40; } },
    C: { name:'Wisdom Aura',   desc:'+80% range',                  cost:{dust:30,gold:100}, owned:false, req:'any',    apply:tw=>{ tw.range*=1.8; } },
  },
  lion: {
    A: { name:'Frenzy',      desc:'Double shot',                  excludes:'B', cost:{dust:15,gold:50}, owned:false, apply:tw=>{ tw.frenzy=true; } },
    B: { name:'Savage Bite', desc:'Triple damage, halve rate',    excludes:'A', cost:{dust:15,gold:50}, owned:false, apply:tw=>{ tw.dmg*=3; tw.rate*=2; } },
    C: { name:'Bloodlust',   desc:'Kills heal +1❤️',              cost:{dust:30,gold:100}, owned:false, req:'any',    apply:tw=>{ tw.bloodlust=true; } },
  },
  penguin: {
    A: { name:'Avalanche',  desc:'Add splash 1.2',               excludes:'B', cost:{dust:15,gold:50}, owned:false, apply:tw=>{ tw.splash=1.2; } },
    B: { name:'Permafrost', desc:'Slow 80%, duration x2',        excludes:'A', cost:{dust:15,gold:50}, owned:false, apply:tw=>{ tw.slow=.8; tw.slowDur=160; } },
    C: { name:'Blizzard',   desc:'AoE slow all in range',        cost:{dust:30,gold:100}, owned:false, req:'any',    apply:tw=>{ tw.blizzard=true; } },
  },
  fish: {
    A: { name:'Tidal Wave', desc:'Splash radius x2',             excludes:'B', cost:{dust:15,gold:50}, owned:false, apply:tw=>{ tw.splash*=2; } },
    B: { name:'Poison',     desc:'DoT 3/tick for 60 ticks',      excludes:'A', cost:{dust:15,gold:50}, owned:false, apply:tw=>{ tw.poison={dmg:3,dur:60}; } },
    C: { name:'Tsunami',    desc:'+100% DMG',                    cost:{dust:30,gold:100}, owned:false, req:'any',    apply:tw=>{ tw.dmg*=2; } },
  },
  seahorse: {
    A: { name:'Trident',     desc:'Pierce +4',                   excludes:'B', cost:{dust:15,gold:50}, owned:false, apply:tw=>{ tw.pierce+=4; } },
    B: { name:'Ink Cloud',   desc:'Hits blind enemies (-50% spd)',excludes:'A', cost:{dust:15,gold:50}, owned:false, apply:tw=>{ tw.blind=true; } },
    C: { name:'Deep Insight',desc:'Reveal+target stealth, +range',cost:{dust:30,gold:100}, owned:false, req:'any',   apply:tw=>{ tw.range+=2; tw.seeInvis=true; } },
  },
  lizard: {
    A: { name:'Venom Spit', desc:'DoT 5/tick 80 ticks',          excludes:'B', cost:{dust:15,gold:50}, owned:false, apply:tw=>{ tw.poison={dmg:5,dur:80}; } },
    B: { name:'Rage Aura',  desc:'Speed-up enemies 2x BUT dmg x3',excludes:'A',cost:{dust:15,gold:50}, owned:false, apply:tw=>{ tw.dmg*=3; tw.megaSpeed=true; } },
    C: { name:'Dragon Form',desc:'Splash x2, range +1',          cost:{dust:30,gold:100}, owned:false, req:'any',    apply:tw=>{ tw.splash*=2; tw.range+=1; } },
  },
  heron: {
    A: { name:'Storm Chain',   desc:'Chain to 5 targets',        excludes:'B', cost:{dust:15,gold:50}, owned:false, apply:tw=>{ tw.chain=5; } },
    B: { name:'Focus Fire',    desc:'No chain, but x4 damage',   excludes:'A', cost:{dust:15,gold:50}, owned:false, apply:tw=>{ tw.chain=0; tw.dmg*=4; } },
    C: { name:'Thunderstrike', desc:'Chain hits stun 30 ticks',  cost:{dust:30,gold:100}, owned:false, req:'any',    apply:tw=>{ tw.chainStun=30; } },
  },
};

export const ETYPES = {
  normal:  { hpM:1,   spdM:1,   sz:.30, rew:4,  clr:'#22c55e', em:'👺', drops: [{ type: 'wood', chance: 0.15 }] },
  fast:    { hpM:.4,  spdM:1.6, sz:.24, rew:3,  clr:'#4ade80', em:'👺', drops: [{ type: 'wood', chance: 0.2 }] },
  tank:    { hpM:2.5, spdM:.6,  sz:.45, rew:8,  clr:'#a855f7', em:'👹', drops: [{ type: 'stone', chance: 0.3 }] },
  berserker:{ hpM:1.8,spdM:1.2, sz:.38, rew:7,  clr:'#ef4444', em:'😤', drops: [{ type: 'wood', chance: 0.25 }] },
  shaman:  { hpM:1.2, spdM:.9,  sz:.33, rew:6,  clr:'#f97316', em:'🧙', drops: [] },
  stealth: { hpM:.6,  spdM:1.4, sz:.22, rew:5,  clr:'#64748b', em:'👤', drops: [{ type: 'wood', chance: 0.2 }] },
  healer:  { hpM:.8,  spdM:.8,  sz:.30, rew:6,  clr:'#22d3ee', em:'💚', drops: [{ type: 'wood', chance: 0.15 }] },
  swarm:   { hpM:.18, spdM:1.7, sz:.18, rew:1,  clr:'#a3e635', em:'🐜', drops: [] },
  shield:  { hpM:2,   spdM:.7,  sz:.40, rew:9,  clr:'#3b82f6', em:'🛡️', drops: [{ type: 'stone', chance: 0.35 }] },
};

export const BOSS_LINES = [
  "You think walls can stop ME?!","I will FEAST on your towers!","Your defenses are PATHETIC!",
  "TREMBLE before Grak'thul!","No tower stands against my might!",
  "I've eaten squirrels bigger than your army!","Your clever birds won't save you now!","The horde is ETERNAL!",
];
