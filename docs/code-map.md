# Code Map

Full navigation tree for the goblin-siege codebase. Every JS module listed with its key exports and approximate line locations.

---

## Directory Tree

```
goblin-siege/
├── index.html                    Entry point — loads main.js as ES module
├── CLAUDE.md                     AI assistant instructions + master nav
├── css/
│   └── styles.css                All styles (HUD, panels, tooltips, overlays)
├── assets/
│   ├── tiles/                    Tile sprites (castle, grass, forest, path, hoard, elder)
│   └── Breath_of_the_Cedar.mp3   Background music track
├── data/
│   └── research.json             Research tree node definitions (loaded by research.js)
├── docs/
│   ├── code-map.md               THIS FILE — full code navigation tree
│   ├── towers.md                 Tower stats, upgrade costs, skill effects
│   ├── enemies.md                Enemy types, wave scaling, boss rules
│   ├── mechanics.md              Core game mechanics reference
│   ├── research.md               Research tree node reference
│   ├── resources.md              Resource types and node definitions
│   ├── spells.md                 Spell definitions and effects
│   ├── support.md                Support tower reference
│   ├── skills.md                 Tower skill trees (A/B/C/D/E)
│   └── bestiary.md               Bestiary entry reference
└── js/                           All game logic (flat, no subdirs)
    │
    ├── ── CORE ─────────────────────────────────────────────────────────
    │
    ├── main.js                   State, game loop, gold/lives gate, canvas
    ├── bus.js                    Event bus (bus.on / bus.emit)
    ├── pool.js                   Object pools for projectiles and beams
    └── utils.js                  spawnParticles, getCenter
    │
    ├── ── DATA ──────────────────────────────────────────────────────────
    │
    ├── data.js                   TD, TOWER_SKILLS, ETYPES, HOARD_LEVELS/UPGS, BOSS_LINES
    └── artifacts.js              ARTIFACTS array, RARITY_COLORS map
    │
    ├── ── WORLD ─────────────────────────────────────────────────────────
    │
    ├── path.js                   buildPath (maze gen), genLakes
    ├── grid.js                   createGrid, addToCell, getEnemiesInRadius
    └── render.js                 render(), canPlace(), invalidateBg(), clearFogParticles()
    │
    ├── ── COMBAT ────────────────────────────────────────────────────────
    │
    ├── enemies.js                mkE, genWave, updateEnemies, isBossWave
    ├── towers.js                 updateTowers
    ├── projectiles.js            updateProjectiles
    ├── spells.js                 SP (spell defs), castSpell
    ├── skills.js                 renderSk, showTowerSkill
    └── support.js                spawnBees, updateClam/Clown/Robot/Bees/FactoryLaser
    │
    ├── ── ECONOMY / RESOURCES ───────────────────────────────────────────
    │
    ├── resources.js              RTYPES, NTYPES, placeNodes, updateNodes, dropItem
    ├── monkeys.js                initMonkeys, reinitMonkeys, updateMonkeys, MONKEY_NAMES
    ├── craft.js                  RECIPES, tickCraft, placeConsumable, applyAugment
    └── research.js               FIXED_RESEARCH, VARIABLE_RESEARCH, buildResearchGraph, tickResearch, applyUnlock
    │
    ├── ── WORLD SYSTEMS ─────────────────────────────────────────────────
    │
    ├── events.js                 EVENTS array, triggerEvent
    ├── weather.js                WEATHER_TYPES, initWeather, tickWeather, updateWeather
    ├── npc.js                    placeNpcs, initNpcUI, updateNpcBubble, fireTrigger
    ├── bestiary.js               BESTIARY, TRANSLATIONS, getScribeLogs, getScribeEntry
    ├── save.js                   autoSave, loadGame, exportSave, clearSave, hasSave
    ├── feed.js                   addFeed, clearFeed
    └── audio.js                  sfxBoss/Kill/Hit/Wave/Place, startHum, stopHum, toggleSound
    │
    ├── ── INPUT ─────────────────────────────────────────────────────────
    │
    └── input.js                  initInput, updateCameraKeys (touch + mouse + keyboard)
    │
    └── ── UI ────────────────────────────────────────────────────────────

        ui.js                     hudU, panelU, mkF, mkGain, showOv/hideOv, showBanner,
                                  showTip, initTabs, showWelcome, initBestiaryUI, showLedger
                                  (re-exports showTT/showResearch/initInventoryUI/openCraftPanel)
        ui-tower.js               showTT, refreshActiveTT, TOWER_UPGS, doUpg, doSell
        ui-monkey.js              buildMonkeyTT — monkey config panel (called by ui-tower.js)
        ui-research.js            showResearch, refreshResearch, initResearchUI
        ui-inventory.js           initInventoryUI, addToInventory, openInventoryForAugment, syncInvBtn
        ui-pip.js                 initPipUI, refreshPipStock, syncPipBtn, updatePipPanel
        ui-craft.js               openCraftPanel, renderCraftPanel, initCraftUI
        dev.js                    initDev — dev console commands (loaded last, optional)
```

---

## Domain Map

### Core state & loop — `main.js`

| Symbol | Line | Notes |
|--------|------|-------|
| `state` | ~148 | Single shared mutable object |
| `_ΨΔ(fn)` | ~145 | Trusted write gate for gold/lives |
| `getCell(x, y)` | 130 | Grid accessor (hides PAD offset) |
| `setCell(x, y, upd)` | 131 | Grid mutator (hides PAD offset) |
| `dropLoot(x,y,sec,item)` | ~438 | Place boss-loot stack on grid |
| `startGame()` | ~454 | Begin run from wave 0 |
| `startWave()` | ~468 | Spawn wave, advance state.wave |
| `startPrep()` | ~498 | Enter 30s prep phase |
| `resetGame()` | ~504 | Full reset + clearSave + startGame |
| `fIncome()` | ~244 | Passive income calculator |
| `measure()` | ~190 | Resize canvas, update CELL |
| `clampCam()` | ~211 | Clamp pan within world bounds |
| `loop()` | ~530 | rAF loop: accumulator + render |

### Tower & support data — `data.js`

| Symbol | Notes |
|--------|-------|
| `TD` | All tower/support definitions. `cat:'tower'` vs `cat:'support'` |
| `TOWER_SKILLS` | A/B/C/D/E upgrade trees (owns `owned: boolean`) |
| `ETYPES` | Enemy type stat multipliers and drop tables |
| `HOARD_LEVELS` | Per-level income/cap for hoard building |
| `HOARD_UPGS` | Upgrade cost table for hoard |
| `BOSS_LINES` | Boss taunt strings |

### Combat — `towers.js`, `enemies.js`, `projectiles.js`

| Function | File | Notes |
|----------|------|-------|
| `updateTowers()` | towers.js | Fires projectiles; skips `cat !== 'tower'` |
| `mkE(type, hp, spdMult)` | enemies.js | Create enemy object |
| `genWave(n)` | enemies.js | Generate spawn queue for wave n; sets `fogWave` for w15 |
| `updateEnemies()` | enemies.js | Movement, poison, healer, stealth, reverse, stun |
| `isBossWave(n)` | enemies.js | Returns true every 5 waves |
| `updateProjectiles()` | projectiles.js | Move + hit logic, splash, pierce, chain |

### Monkey system — `monkeys.js` + `ui-monkey.js`

| Symbol | File | Notes |
|--------|------|-------|
| `initMonkeys(cap)` | monkeys.js | Create monkey array for a hut |
| `reinitMonkeys(towers)` | monkeys.js | Re-home monkeys after load |
| `updateMonkeys()` | monkeys.js | Per-tick AI for all monkey roles |
| `buildMonkeyTT(tw,cont,onRefresh)` | ui-monkey.js | Build monkey config rows in tower tooltip |
| Roles | monkeys.js | `idle` `gatherer` `courier` `booster` `round_robin` `harvester` |

### Research — `research.js` + `data/research.json`

| Symbol | Notes |
|--------|-------|
| `FIXED_RESEARCH` | Static nodes loaded from `data/research.json` |
| `VARIABLE_RESEARCH` | Pool of random nodes picked at game start |
| `buildResearchGraph()` | Merges fixed + 4–5 random nodes into `state.research` |
| `tickResearch()` | Wave-end tick; returns completed node or null |
| `applyUnlock(id)` | Applies unlock effect: adds tower keys or numeric modifiers |
| `UNLOCK_DESC` | Human-readable descriptions for unlocks |

### Save format — `save.js`

Key: `_gbssv` in localStorage. Format: `hash~base64payload` where payload is XOR+base64 obfuscated JSON. Short field names: `_w`=wave, `_r`=gold, `_h`=lives, `_t`=towers, `_g`=grid, `_a`=path.

### UI layer — `ui.js` and sub-modules

`ui.js` is the public face of the UI — it re-exports from `ui-tower.js`, `ui-research.js`, `ui-inventory.js`, `ui-craft.js` so most callers only need to import from `ui.js`.

| Module | Responsibility |
|--------|---------------|
| `ui-tower.js` | Tower tooltip (`showTT`), upgrade logic, sell logic, `TOWER_UPGS` data |
| `ui-monkey.js` | Monkey role/config panel built inside tower tooltip |
| `ui-research.js` | Research web overlay |
| `ui-inventory.js` | Inventory panel (artifacts, augments, blueprints, consumables) |
| `ui-pip.js` | Pip Pip shop panel |
| `ui-craft.js` | Workbench crafting panel |

### Event bus usage — `bus.js`

| Event | Emitter | Listener |
|-------|---------|----------|
| `enemyDeath` | main.js (`update`) | main.js (`bus.on` at top) — handles gold, loot, spider spawn |
| `trigger` | main.js (`startGame`, wave-end), npc.js | npc.js `fireTrigger` |

---

## Import Graph (simplified)

```
index.html
  └─ main.js
       ├─ bus.js
       ├─ pool.js
       ├─ projectiles.js ── pool.js
       ├─ path.js
       ├─ enemies.js ─────── data.js
       ├─ towers.js
       ├─ support.js
       ├─ monkeys.js ──────── resources.js, craft.js, ui.js
       ├─ render.js ─────────  resources.js
       ├─ research.js
       ├─ craft.js ────────── resources.js
       ├─ artifacts.js
       ├─ events.js
       ├─ audio.js
       ├─ input.js ─────────── ui.js, render.js, resources.js
       ├─ resources.js ──────── (no game imports)
       ├─ save.js
       ├─ npc.js ────────────── bus.js
       ├─ weather.js
       ├─ feed.js
       ├─ ui.js
       │    ├─ ui-tower.js ──── ui-monkey.js, skills.js, ui-research.js, ui-craft.js
       │    ├─ ui-research.js
       │    ├─ ui-inventory.js
       │    └─ ui-craft.js
       └─ ui-pip.js / ui-inventory.js (direct in main.js)
```

---

## Key State Properties Quick Ref

| Property | Type | Notes |
|----------|------|-------|
| `state.gold` | protected number | Read/write only via `_ΨΔ` |
| `state.lives` | protected number | Read/write only via `_ΨΔ`; clamped ≥ 0 |
| `state.wave` | number | Current wave number (0 before start) |
| `state.phase` | string | `'idle'` \| `'prep'` \| `'active'` |
| `state.paused` | boolean | True when research/bestiary/scribe overlay open |
| `state.grid` | Cell[][] | Full `(COLS+2PAD) × (ROWS+2PAD)` grid |
| `state.path` | `{x,y}[]` | Ordered goblin route |
| `state.pathSet` | Set | `"x,y"` strings for O(1) membership |
| `state.towers` | Tower[] | All placed towers + supports |
| `state.enemies` | Enemy[] | Active enemy entities |
| `state.CELL` | number | Pixel size of each grid cell |
| `state.COLS` / `ROWS` | number | Full grid dims (32×24, includes PAD) |
| `state.unlockedTowers` | Set | Tower keys player may place |
| `state.research` | object | Current research graph |
| `state.researchUnlocks` | object | Numeric/boolean research effects |
| `state.inventory` | object | `{ artifacts, augments, blueprints, consumables, equipped }` |
| `state.resources` | object | `{ stone, wood, dust, ... }` |
| `state.fogWave` | boolean | True during Considerate Fog (wave 15) |
| `state.cam` | object | `{ panX, panY, zoom, targetZoom, ... }` |
