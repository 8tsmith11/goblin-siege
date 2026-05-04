export const TD = {
  squirrel: { name:'Thoughtful Squirrel', icon:'🐿️', clr:'#8b5cf6', cost:40,  resCost:{stone:5},         dmg:12, range:3.2, rate:40, pClr:'#a78bfa', pSpd:4,   splash:0,   slow:0,  target:'weakest', cat:'tower', desc:'Long range · targets weakest enemy' },
  lion:     { name:'Rash Lion',           icon:'🦁',  clr:'#ef4444', cost:60,  resCost:{wood:4},          dmg:15, range:2.0, rate:25, pClr:'#f87171', pSpd:6,   splash:0,   slow:0,  target:'first',   cat:'tower', desc:'Very fast · high single-target DPS' },
  penguin:  { name:'Ambitious Penguin',   icon:'🐧',  clr:'#06b6d4', cost:55,  resCost:{stone:3},         dmg:5,  range:2.8, rate:35, pClr:'#67e8f9', pSpd:3,   splash:0,   slow:.4, target:'first',   cat:'tower', desc:'Slows enemies on hit' },
  lab:      { name:'Lab',                icon:'🧪', clr:'#a78bfa', cost:50, resCost:{stone:10}, cat:'support', obsRange: 3, desc:'Gathers Dust 🔮 from enemies slain within 3 tiles · Available at Wave 5' },
  hoard:    { name:'Hoard Pile',         icon:'🏺', clr:'#10b981', cost:60, cat:'support', desc:'Deposit resources to earn gold each wave. The pile decays slowly — boost with a monkey to slow the loss.' },
  fish:     { name:'Arrogant Fish',       icon:'🐟',  clr:'#f59e0b', cost:65,  resCost:{wood:2},          dmg:22, range:3.0, rate:38, pClr:'#fcd34d', pSpd:3.5, splash:1.2, slow:0,  target:'first',   cat:'tower', desc:'Splash damage · hits nearby enemies' },
  seahorse: { name:'Insightful Seahorse', icon:'🦑',  clr:'#ec4899', cost:65,  resCost:{stone:2},         dmg:14, range:3.5, rate:40, pClr:'#f472b6', pSpd:3,   splash:0,   slow:0,  target:'strongest',pierce:3, cat:'tower', seeInvis:true, invisPriority:true, desc:'Piercing shots · targets stealth enemies' },
  lizard:   { name:'Abhorrent Lizard',    icon:'🦎',  clr:'#84cc16', cost:85,  resCost:{wood:3},          dmg:45, range:2.5, rate:65, pClr:'#a3e635', pSpd:5,   splash:1.0, slow:0,  target:'first',   speedUp:true, voiceLine:"I DESPISE YOU ALL!", cat:'tower', desc:'Massive damage · splash · speeds up enemies' },
  heron:    { name:'Clever Heron',        icon:'🦩',  clr:'#6366f1', cost:70,  resCost:{stone:2,wood:2},  dmg:26, range:3.2, rate:42, pClr:'#818cf8', pSpd:20,  splash:0,   slow:0,  target:'last',    chain:3, chainRange:3, cat:'tower', desc:'Chain lightning · arcs to 3 targets · hits rearmost first' },
  clam:     { name:'Intuitive Clam',     icon:'🐚', clr:'#14b8a6', cost:80,  resCost:{stone:3},         cat:'support', buffRange:2,  buffDmg:1.5, buffRate:.85, buffDesc:'+50% DMG, -15% CD to nearby', desc:'Buffs nearby towers: +50% DMG, -15% cooldown' },
  beehive:  { name:'Beehive',            icon:'🐝', clr:'#eab308', cost:90,  cat:'support', beeCount:3,  beeDmg:4,    beeRange:3,   beeRate:30,  desc:'Deploys bees that swarm and sting enemies' },
  clown:    { name:'Magnificent Clown',  icon:'🤡', clr:'#f472b6', cost:100, resCost:{wood:3},          cat:'support', reverseRange:2, reverseDur:80, reverseCD:150, desc:'Targets one enemy and reverses their movement direction' },
  monkey:   { name:'Monkey Hut',         icon:'🛖', clr:'#fb923c', cost:70, resCost:{ stone:8, wood:8 }, cat:'support', capacity:1, range:3, desc:'Houses Resourceful Monkeys that gather, courier, or boost nearby buildings' },
  stockpile:{ name:'Stockpile',          icon:'📦', clr:'#d97706', cost:50, resCost:{ wood:6 }, cat:'support', desc:'Interface between ground items and your inventory. Monkeys deposit/withdraw here.' },
  workbench:{ name:'Workbench',          icon:'🛠️', clr:'#a16207', cost:40, resCost:{ wood:5 }, cat:'support', desc:'Crafts augments and consumables over waves' },
  campfire: { name:'Warm Campfire',      icon:'🔥', clr:'#f97316', cost:50,  resCost:{wood:4}, cat:'support', range:1.5, warmRange:1.5, warmRate:0.8, desc:'Boosts fire rate of adjacent towers by 20%' },
  ceasefire_flag: { name:'Ceasefire Flag', icon:'🏳️', clr:'#f0f0f0', cost:20, resCost:{wood:10}, cat:'support', desc:'Click to raise or lower. When raised, all towers hold their fire. Consumable traps still work.' },
  grateful_spider: { name:'Grateful Spider', icon:'🕷️', clr:'#8b5cf6', cost:60, resCost:{wood:3}, cat:'tower', dmg:12, range:3, rate:40, pClr:'#c4b5fd', pSpd:4, splash:0, slow:0.4, target:'first', desc:'Shoots slowing webs · Once per wave: webs a path tile in range (slows + damages) · Blueprint only' },
  robot:    { name:'AI Agent',           icon:'🤖', clr:'#38bdf8', cost:110, cat:'support', autoSpell:true, reqAge: 'iron', desc:'Automatically casts spells during waves' },
  resonating_gem: { name:'Resonating Gem', icon:'💎', clr:'#a78bfa', cost:0, cat:'support', desc:'A gem of unknown purpose. It hums faintly.', noBackground:true },
  furnace:      { name:'Furnace',      icon:'🔥', clr:'#f97316', cost:80,  resCost:{stone:8,wood:4}, cat:'support', reqAge:'steam', desc:'Smelts 2 iron ore + 5 wood → 1 iron ingot per wave.' },
  water_pump:   { name:'Water Pump',   icon:'💧', clr:'#3b82f6', cost:60,  resCost:{stone:4},        cat:'support', reqAge:'steam', fluidRate:0.3, desc:'Placed on water. Pumps water into connected pipes.' },
  pipe:         { name:'Pipe',         icon:'🔩', clr:'#78716c', cost:0,   resCost:{iron_ingot:1},   cat:'support', reqAge:'steam', desc:'Carries fluid. Connects to adjacent fluid containers.' },
  steam_boiler: { name:'Steam Boiler', icon:'♨️',  clr:'#f59e0b', cost:80,  resCost:{stone:6,iron_ingot:2}, cat:'support', reqAge:'steam', desc:'Burns wood + water → steam. Configure input/output sides.' },
  steam_engine:  { name:'Steam Engine', icon:'⚙️', clr:'#f97316', cost:100, resCost:{stone:8,iron_ingot:4}, cat:'support', reqAge:'steam', steamRate:0.04, torqueOut:10, desc:'Consumes steam → produces torque for connected pulleys.' },
  pulley:        { name:'Pulley',       icon:'🔘', clr:'#9ca3af', cost:20,  resCost:{iron_ingot:2},          cat:'support', reqAge:'steam', desc:'Spinning wheel. Transmits torque via belts. Up to 3 belt connections.' },
  belt:          { name:'Belt',         icon:'〰️', clr:'#78716c', cost:0,   resCost:{iron_ingot:1},           cat:'support', reqAge:'steam', desc:'Connects two pulleys. Click first pulley, then second to place.' },
  butcher:       { name:'Inhumane Wheel', icon:'🔪', clr:'#ef4444', cost:80, resCost:{iron_ingot:4},           cat:'support', reqAge:'steam', dmg:18, range:1.2, blades:3, bladeLen:0.58, gearRatio:2, desc:'Spinning blades powered by torque. Damages enemies in range.' },
  tank:          { name:'Tank',         icon:'🪣', clr:'#475569', cost:60,  resCost:{stone:4,iron_ingot:2},   cat:'support', reqAge:'steam', fluidMax:40, desc:'Stores fluid. Has a window showing contents.' },
  inline_pump:   { name:'Inline Pump',  icon:'🔄', clr:'#3b82f6', cost:40,  resCost:{iron_ingot:2},           cat:'support', reqAge:'steam', fluidRate:0.2, desc:'Pumps fluid along pipes. Place in-line; configure input/output sides.' },
};

export const TOWER_SKILLS = {
  squirrel: {
    A: { name:'Piercing Gaze',  icon:'👁️', desc:'Shots pierce 2 enemies',           excludes:'B', cost:{dust:25,gold:50},  owned:false,              apply:tw=>{ tw.pierce=(tw.pierce||0)+2; } },
    B: { name:'Mind Blast',     icon:'💥', desc:'Shots stun for 40 ticks',          excludes:'A', cost:{dust:25,gold:50},  owned:false,              apply:tw=>{ tw.stun=40; } },
    C: { name:'Wisdom Aura',    icon:'🌀', desc:'+80% range',                       excludes:'D', cost:{dust:50,gold:100}, owned:false, req:'any',   apply:tw=>{ tw.range*=1.8; } },
    D: { name:'Arcane Overload',icon:'⚡', desc:'+130% DMG, -15% range',            excludes:'C', cost:{dust:50,gold:100}, owned:false, req:'any',   apply:tw=>{ tw.dmg=Math.round(tw.dmg*2.3); tw.range*=0.85; } },
    E: { name:'Mastery',        desc:'+25% DMG, range, and rate. Purple aura.', cost:{dust:60}, owned:false, req:'either_cd', apply:tw=>{ tw.dmg=Math.round(tw.dmg*1.25); tw.range=Math.round(tw.range*1.25*10)/10; tw.rate=Math.max(1,Math.round(tw.rate*0.8)); tw._mastery=true; } },
  },
  lion: {
    A: { name:'Frenzy',      icon:'🔥', desc:'Double shot',                                        excludes:'B', cost:{dust:25,gold:50},  owned:false,            apply:tw=>{ tw.frenzy=true; } },
    B: { name:'Savage Bite', icon:'🦷', desc:'Triple damage, halve rate',                          excludes:'A', cost:{dust:25,gold:50},  owned:false,            apply:tw=>{ tw.dmg*=3; tw.rate*=2; } },
    C: { name:'Iron Mane',   icon:'🛡️', desc:'+60% DMG, applies slow on hit',                     excludes:'D', cost:{dust:50,gold:100}, owned:false, req:'any', apply:tw=>{ tw.dmg=Math.round(tw.dmg*1.6); tw.slow=Math.max(tw.slow,0.25); } },
    D: { name:"Lion's Pride",icon:'👑', desc:'+30% DMG per adjacent Lion (diagonals count)',       excludes:'C', cost:{dust:50,gold:100}, owned:false, req:'any', apply:tw=>{ tw.packHunter=true; } },
    E: { name:'Mastery',     desc:'+25% DMG, range, and rate. Purple aura.', cost:{dust:60}, owned:false, req:'either_cd', apply:tw=>{ tw.dmg=Math.round(tw.dmg*1.25); tw.range=Math.round(tw.range*1.25*10)/10; tw.rate=Math.max(1,Math.round(tw.rate*0.8)); tw._mastery=true; } },
  },
  penguin: {
    A: { name:'Cryo Shell',      icon:'💎', desc:'Shots explode on impact (splash 1.2)',              excludes:'B', cost:{dust:25,gold:50},  owned:false,            apply:tw=>{ tw.splash=1.2; } },
    B: { name:'Glacial Bite',    icon:'❄️', desc:'Slow increased to 80%',                             excludes:'A', cost:{dust:25,gold:50},  owned:false,            apply:tw=>{ tw.slow=.8; } },
    C: { name:'Lingering Chill', icon:'🌨️', desc:'Slowed enemies retain 25% slow permanently',        excludes:'D', cost:{dust:50,gold:100}, owned:false, req:'any', apply:tw=>{ tw.lingeringChill=true; } },
    D: { name:'Brittle Ice',     icon:'🧊', desc:'+80% DMG to enemies that are already slowed',       excludes:'C', cost:{dust:50,gold:100}, owned:false, req:'any', apply:tw=>{ tw.brittleIce=true; } },
    E: { name:'Mastery',    desc:'+25% DMG, range, and rate. Purple aura.', cost:{dust:60}, owned:false, req:'either_cd', apply:tw=>{ tw.dmg=Math.round(tw.dmg*1.25); tw.range=Math.round(tw.range*1.25*10)/10; tw.rate=Math.max(1,Math.round(tw.rate*0.8)); tw._mastery=true; } },
  },
  fish: {
    A: { name:'Tidal Wave', icon:'🌊', desc:'Splash radius x2',                     excludes:'B', cost:{dust:25,gold:50},  owned:false,              apply:tw=>{ tw.splash*=2; } },
    B: { name:'Poison',     icon:'☠️', desc:'DoT 3/tick for 60 ticks',              excludes:'A', cost:{dust:25,gold:50},  owned:false,              apply:tw=>{ tw.poison={dmg:3,dur:60}; } },
    C: { name:'Tsunami',    icon:'💣', desc:'+100% DMG',                            excludes:'D', cost:{dust:50,gold:100}, owned:false, req:'any',   apply:tw=>{ tw.dmg*=2; } },
    D: { name:'Toxic Tide', icon:'🧪', desc:'Hits apply poison (3 dmg/t, 50t)',     excludes:'C', cost:{dust:50,gold:100}, owned:false, req:'any',   apply:tw=>{ tw.poison={dmg:3,dur:50}; } },
    E: { name:'Mastery',    desc:'+25% DMG, range, and rate. Purple aura.', cost:{dust:60}, owned:false, req:'either_cd', apply:tw=>{ tw.dmg=Math.round(tw.dmg*1.25); tw.range=Math.round(tw.range*1.25*10)/10; tw.rate=Math.max(1,Math.round(tw.rate*0.8)); tw._mastery=true; } },
  },
  seahorse: {
    A: { name:'Trident',     icon:'🔱', desc:'Pierce +4',                           excludes:'B', cost:{dust:25,gold:50},  owned:false,              apply:tw=>{ tw.pierce+=4; } },
    B: { name:'Ink Cloud',   icon:'🌑', desc:'Hits blind enemies (-50% spd)',        excludes:'A', cost:{dust:25,gold:50},  owned:false,              apply:tw=>{ tw.blind=true; } },
    C: { name:'Aura of Clarity',icon:'✨', desc:'Adjacent towers can target stealth enemies, +2 range', excludes:'D', cost:{dust:50,gold:100}, owned:false, req:'any', apply:tw=>{ tw.range+=2; tw.auraInvis=true; } },
    D: { name:'Void Trap',   icon:'🕳️', desc:'Shots stun enemies 20 ticks',         excludes:'C', cost:{dust:50,gold:100}, owned:false, req:'any',   apply:tw=>{ tw.stun=20; } },
    E: { name:'Mastery',     desc:'+25% DMG, range, and rate. Purple aura.', cost:{dust:60}, owned:false, req:'either_cd', apply:tw=>{ tw.dmg=Math.round(tw.dmg*1.25); tw.range=Math.round(tw.range*1.25*10)/10; tw.rate=Math.max(1,Math.round(tw.rate*0.8)); tw._mastery=true; } },
  },
  lizard: {
    A: { name:'Venom Spit',    icon:'🐍', desc:'DoT 5/tick 80 ticks',               excludes:'B', cost:{dust:25,gold:50},  owned:false,              apply:tw=>{ tw.poison={dmg:5,dur:80}; } },
    B: { name:'Rage Aura',     icon:'😤', desc:'Speed-up enemies 2x BUT dmg x3',    excludes:'A', cost:{dust:25,gold:50},  owned:false,              apply:tw=>{ tw.dmg*=3; tw.megaSpeed=true; } },
    C: { name:'Dragon Form',   icon:'🐲', desc:'Splash x2, range +1',               excludes:'D', cost:{dust:50,gold:100}, owned:false, req:'any',   apply:tw=>{ tw.splash*=2; tw.range+=1; } },
    D: { name:'Scorched Earth',icon:'🌋', desc:'+50% splash radius, -25% DMG',      excludes:'C', cost:{dust:50,gold:100}, owned:false, req:'any',   apply:tw=>{ tw.splash*=1.5; tw.dmg=Math.round(tw.dmg*0.75); } },
    E: { name:'Mastery: Abhorrent Ambush', icon:'👤', desc:'3s idle → stealth mode · next shot: 250% DMG + stun · stays stealthy if target killed', cost:{dust:60}, owned:false, req:'either_cd', apply:tw=>{ tw._mastery=true; tw._abhAssault=true; tw._assaultReady=false; tw._lastFireTick=0; } },
  },
  clown: {
    A: { name:'Wide Act',           icon:'🎪', desc:'Reverses 2 enemies at once, +0.5 range',              excludes:'B', cost:{dust:25,gold:50},  owned:false,            apply:tw=>{ tw.reverseCount=2; tw.reverseRange+=0.5; } },
    B: { name:'Pratfall',           icon:'🤸', desc:'Reversed target also stunned 10 ticks',               excludes:'A', cost:{dust:25,gold:50},  owned:false,            apply:tw=>{ tw.reverseStun=true; } },
    C: { name:'Extended Range',     icon:'📡', desc:'+1.5 reverse range',                                   excludes:'D', cost:{dust:50,gold:100}, owned:false, req:'any', apply:tw=>{ tw.reverseRange+=1.5; } },
    D: { name:'Grand Finale',       icon:'🎭', desc:'Reverse duration x2',                                  excludes:'C', cost:{dust:50,gold:100}, owned:false, req:'any', apply:tw=>{ tw.reverseDur=Math.round(tw.reverseDur*2); } },
    E: { name:"Mastery: Jester's Privilege", desc:'Swaps the strongest and weakest enemy in range by HP. +1 range, −30% CD. Purple aura.', cost:{dust:60}, owned:false, req:'either_cd', apply:tw=>{ tw.reverseRange+=1; tw.reverseCD=Math.max(40,Math.round(tw.reverseCD*0.7)); tw.jesterPriv=true; tw._mastery=true; } },
  },
  heron: {
    A: { name:'Storm Arc',     icon:'⛓️', desc:'Chain to 5 targets · chain hits deal 75% of previous',  excludes:'B', cost:{dust:25,gold:50},  owned:false,              apply:tw=>{ tw.chain=5; tw.chainEfficiency=0.75; } },
    B: { name:'Focused Bolt',  icon:'🎯', desc:'No chain, but ×4 damage · −15% cooldown',                excludes:'A', cost:{dust:25,gold:50},  owned:false,              apply:tw=>{ tw.chain=0; tw.dmg*=4; tw.rate=Math.max(5,Math.round(tw.rate*0.85)); } },
    C: { name:'Static Field',  icon:'⚡', desc:'Chain jumps slow each non-boss enemy 50% for 0.5s',       excludes:'D', cost:{dust:50,gold:100}, owned:false, req:'any',   apply:tw=>{ tw.chainSlowAmt=0.5; tw.chainSlowDur=30; } },
    D: { name:'Overcharge',    icon:'🔋', desc:'+80% DMG · chain jumps release a spark particle burst',  excludes:'C', cost:{dust:50,gold:100}, owned:false, req:'any',   apply:tw=>{ tw.dmg=Math.round(tw.dmg*1.8); tw.chainSparks=true; } },
    E: { name:'Mastery: Tempest', icon:'🌩️', desc:'+30% DMG · +0.5 range · chain hits deal full damage · beams become wide black-core bolts', cost:{dust:60}, owned:false, req:'either_cd', apply:tw=>{ tw.dmg=Math.round(tw.dmg*1.3); tw.range=Math.round((tw.range+0.5)*10)/10; tw.rate=Math.max(1,Math.round(tw.rate*0.85)); tw.chainEfficiency=1.0; tw._mastery=true; tw._tempest=true; } },
  },
  grateful_spider: {
    A: { name:'Sticky',          icon:'🕸️', desc:'Web slow increased to 80%',                          excludes:'B', cost:{dust:20,gold:40},  owned:false,            apply:tw=>{ tw.webSlowBonus=true; } },
    B: { name:'Venom Web',       icon:'☠️', desc:'Web tiles deal 3 dmg/tick',                           excludes:'A', cost:{dust:20,gold:40},  owned:false,            apply:tw=>{ tw.webVenom=true; } },
    C: { name:'Wide Weave',      icon:'🌐', desc:'Once-per-wave web covers 5 tiles',                    excludes:'D', cost:{dust:40,gold:80},  owned:false, req:'any', apply:tw=>{ tw.webSpread=true; } },
    D: { name:'Brood Guard',     icon:'🕷️', desc:'3 spiderlings orbit the tower · latch onto nearby enemies · deal damage until enemy escapes', excludes:'C', cost:{dust:40,gold:80}, owned:false, req:'any', apply:tw=>{ tw.orbitalBrood=true; if (!tw._orbits) tw._orbits=[]; } },
    E: { name:'Mastery: Silk Throne', icon:'🕸️', desc:'+2nd web 10s into wave · web tiles briefly stun · +25% all stats', cost:{dust:60}, owned:false, req:'either_cd', apply:tw=>{ tw.dmg=Math.round(tw.dmg*1.25); tw.range=Math.round(tw.range*1.25*10)/10; tw.rate=Math.max(1,Math.round(tw.rate*0.8)); tw._mastery=true; tw._silkThrone=true; } },
  },
  beehive: {
    A: { name:'Swarm Tactics',      icon:'🐝', desc:'+1 bee',                                                  excludes:'B', cost:{dust:20,gold:40},  owned:false,            apply:tw=>{ tw.beeCount=(tw.beeCount||3)+1; } },
    B: { name:'Venom Sting',        icon:'☠️', desc:'Bees apply poison (3 dmg/tick for 90 ticks)',              excludes:'A', cost:{dust:20,gold:40},  owned:false,            apply:tw=>{ tw.beeVenom=true; } },
    C: { name:'Coordinated Strike', icon:'🎯', desc:'All bees from this hive target the same enemy',            excludes:'D', cost:{dust:40,gold:80},  owned:false, req:'any', apply:tw=>{ tw.beeCoordinated=true; } },
    D: { name:'Wide Range',         icon:'📡', desc:'+1.5 bee range',                                           excludes:'C', cost:{dust:40,gold:80},  owned:false, req:'any', apply:tw=>{ tw.beeRange=(tw.beeRange||3)+1.5; } },
    E: { name:'Mastery: Supercolony', icon:'👑', desc:'+2 bees · +10% bee DMG · bees leave golden pollen trails · on kill: 1s frenzy (1.5× speed)', cost:{dust:60}, owned:false, req:'either_cd', apply:tw=>{ tw.beeCount=(tw.beeCount||3)+2; tw.beeDmg=Math.round((tw.beeDmg||4)*1.1); tw.beeRate=Math.max(5,Math.round((tw.beeRate||30)*0.9)); tw._mastery=true; tw._supercolony=true; } },
  },
};

export const ETYPES = {
  normal:  { hpM:1,   spdM:1,   sz:.30, rew:1,  clr:'#22c55e', em:'👺', drops: [{ type: 'wood', chance: 0.13 }] },
  fast:    { hpM:.4,  spdM:1.6, sz:.24, rew:1,  clr:'#4ade80', em:'👺', drops: [{ type: 'wood', chance: 0.15 }] },
  tank:    { hpM:2.5, spdM:.6,  sz:.45, rew:2,  clr:'#a855f7', em:'👹', drops: [{ type: 'stone', chance: 0.14 }] },
  berserker:{ hpM:1.8,spdM:1.2, sz:.38, rew:1,  clr:'#ef4444', em:'😤', drops: [{ type: 'wood', chance: 0.18 }] },
  shaman:  { hpM:1.2, spdM:.9,  sz:.33, rew:1,  clr:'#f97316', em:'🧙', drops: [] },
  stealth: { hpM:.6,  spdM:1.4, sz:.22, rew:1,  clr:'#64748b', em:'👤', drops: [{ type: 'wood', chance: 0.15 }] },
  healer:  { hpM:.8,  spdM:.8,  sz:.30, rew:1,  clr:'#22d3ee', em:'💚', drops: [{ type: 'wood', chance: 0.13 }] },
  swarm:   { hpM:.18, spdM:1.7, sz:.18, rew:1,  clr:'#a3e635', em:'🐜', drops: [] },
  shield:    { hpM:2,   spdM:.7,  sz:.40, rew:3,  clr:'#3b82f6', em:'🛡️', drops: [{ type: 'stone', chance: 0.16 }] },
  geologist:  { hpM:2.0, spdM:1.6, sz:.30, rew:1,  clr:'#a78bfa', em:'💎',  drops: [], noLives: true },
  spider:     { hpM:1.4, spdM:0.9, sz:.35, rew:2,  clr:'#8b5cf6', em:'🕷️', drops: [] },
  spiderling: { hpM:0.15, spdM:1.8, sz:.14, rew:0, clr:'#c4b5fd', em:'🕷️', drops: [] },
};

// Per-level stats for the Hoard Pile (tw.level 0 = Level 1, etc.)
// income = base + floor(stored × m)  |  decay = max(1, floor(stored × 0.1))
export const HOARD_LEVELS = [
  { cap: 20, m: 1.0, base: 0 }, // level 1
  { cap: 30, m: 1.4, base: 0 }, // level 2
  { cap: 40, m: 1.8, base: 0 }, // level 3
  { cap: 50, m: 2.2, base: 0 }, // level 4
  { cap: 60, m: 2.6, base: 0 }, // level 5
];

// Gold + resource cost to upgrade hoard from level N to N+1
export const HOARD_UPGS = [
  { c: 40,  rs: { wood: 8,  stone: 8  } }, // → level 2
  { c: 70,  rs: { wood: 12, stone: 12 } }, // → level 3
  { c: 110, rs: { wood: 18, stone: 18 } }, // → level 4
  { c: 160, rs: { wood: 25, stone: 25 } }, // → level 5
];

export const BOSS_LINES = [
  "You think walls can stop ME?!","I will FEAST on your towers!","Your defenses are PATHETIC!",
  "TREMBLE before Grak'thul!","No tower stands against my might!",
  "I've eaten squirrels bigger than your army!","Your clever birds won't save you now!","The horde is ETERNAL!",
];
