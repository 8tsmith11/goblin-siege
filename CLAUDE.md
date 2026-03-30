# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the game

No build step. Serve with any static file server and open `index.html`:

```bash
npx serve .
# or
python3 -m http.server
```

Opening `index.html` directly as a `file://` URL won't work — ES modules require HTTP.

## Quick Reference

Jump directly to frequently-needed content:

| What | File : approx line |
|------|-------------------|
| Enemy types & stats (HP/speed/reward/drops) | `js/data.js:56` — `ETYPES` |
| Enemy movement, healer, poison, stealth logic | `js/enemies.js` — `updateEnemies` |
| All tower & support definitions | `js/data.js:1` — `TD` |
| Tower skill upgrade trees (A/B/C) | `js/data.js:18` — `TOWER_SKILLS` |
| Spell definitions & cast logic | `js/spells.js:6` — `SP`, `castSpell` |
| Random events (gold rush, ambush, etc.) | `js/events.js:7` — `EVENTS` |
| World gen: path + lake generation | `js/path.js` — `buildPath`, `genLakes` |
| Fixed research tree nodes | `js/research.js:4` — `FIXED_RESEARCH` |
| Variable (random) research nodes | `js/research.js:15` — `VARIABLE_RESEARCH` |
| Research unlock descriptions | `js/research.js:28` — `UNLOCK_DESC` |
| Bestiary lore entries | `js/bestiary.js:1` — `BESTIARY` |
| Scribe's Journal wave-gated logs | `js/bestiary.js:110` — `getScribeLogs` |
| Save format / encode / decode | `js/save.js` — `_build`, `_pack`, `_unpack`, `_apply` |
| Resource & node types | `js/resources.js` — `RTYPES`, `NTYPES` |
| HUD update | `js/ui.js` — `hudU` |
| Bottom panel update | `js/ui.js` — `panelU` |

## Protected State & Common Patterns

`state.gold` and `state.lives` are **protected properties** — direct assignment outside the trusted executor is silently dropped (the write gate `_φ` rejects it). Always use `_ΨΔ` from `main.js`:

```js
import { _ΨΔ } from './main.js';

// Add gold
_ΨΔ(() => { state.gold += 50; });

// Subtract gold (e.g. spell cost)
_ΨΔ(() => { state.gold -= cost; });

// Set gold/lives (game start/reset)
_ΨΔ(() => { state.gold = 200; state.lives = 20; });

// Gain a life (capped at 30)
_ΨΔ(() => { state.lives = Math.min(state.lives + 1, 30); });
```

Internal write functions in `main.js` (not exported, for reference only):
- `_wG(v)` — writes gold, updates integrity marker `_ηG`
- `_wL(v)` — writes lives (clamped to ≥0), updates `_ηL`

**Save format**: XOR+base64 obfuscation. Key is stored in `save.js` as `_ψ`. The localStorage key is `_gbssv` (`_K` in `save.js`). The save blob is `hash~base64payload` where hash is FNV-1a via `_χ`. Field names in the save payload are intentionally short (`_w`=wave, `_r`=gold, `_h`=lives, `_t`=towers, `_g`=grid, `_a`=path, etc.).

## Architecture

All shared mutable game state lives in a single `const state = {}` object exported from `js/main.js`. Every other module does `import { state } from './main.js'` and mutates properties on that object directly. Circular imports are intentional and safe because imported values are only accessed inside function bodies, never at module evaluation time.

**Module responsibilities:**

| File | Responsibility |
|------|---------------|
| `js/main.js` | Exports `state`, `_ΨΔ` (gold/lives write gate), canvas setup, game loop (`update`/`loop`), `startGame`/`startWave`/`startPrep`/`resetGame`/`fIncome` |
| `js/data.js` | `TD` (all tower + support definitions, keyed by type, `cat:'tower'` or `cat:'support'`), `TOWER_SKILLS` (A/B/C upgrade trees), `ETYPES`, `BOSS_LINES` |
| `js/audio.js` | Web Audio API: procedural music engine + all `sfx*` exports |
| `js/path.js` | `buildPath()` — procedural winding maze generation + `genLakes()` lake placement; writes to `state.path/pathSet/grid` |
| `js/enemies.js` | `mkE`, `genWave`, `updateEnemies` (movement, poison, healer logic, stealth, reverse, stun) |
| `js/towers.js` | `updateTowers` — fires projectiles for `cat:'tower'` entries only |
| `js/support.js` | `spawnBees`, `updateClam/Clown/Robot/Bees/FactoryLaser` |
| `js/spells.js` | `SP` (spell definitions), `castSpell` |
| `js/skills.js` | `renderSk`, `showTowerSkill` — per-tower A/B/C upgrade UI |
| `js/events.js` | `EVENTS` array, `triggerEvent` |
| `js/render.js` | `render()` (all canvas drawing), `canPlace()`, `invalidateBg()` |
| `js/ui.js` | HUD, bottom panel, tooltips, overlays, research web, `mkF` (floating numbers), `mkGain` (item gain text), `initTabs`, `showWelcome`, `initBestiaryUI`, `initResearchUI` |
| `js/input.js` | Touch/mouse event handlers, `initInput` |
| `js/resources.js` | `RTYPES` (resource definitions), `NTYPES` (node definitions), `placeNodes`, `updateNodes`, `clickNode`, `renderNodes`, `renderStacks`, `dropItem` |
| `js/research.js` | `FIXED_RESEARCH`, `VARIABLE_RESEARCH`, `UNLOCK_DESC`, `buildResearchGraph`, `tickResearch`, `applyUnlock`, `layoutNodes` |
| `js/bestiary.js` | `BESTIARY` (lore entries for enemies/towers/NPCs), `getScribeLogs` (wave-gated journal entries); unlocked via `state.bSen` |
| `js/save.js` | XOR+base64 obfuscated save/load, localStorage auto-save, file export/import |
| `js/grid.js` | `createGrid`, `clearEnemiesGrid`, `addToCell`, `getEnemiesInRadius` — spatial grid helpers |
| `js/projectiles.js` | `updateProjectiles` — projectile movement and hit logic |
| `js/pool.js` | Object pools for projectiles and beams to reduce GC pressure |
| `js/bus.js` | Simple event bus (`bus.on` / `bus.emit`) for decoupled module communication |
| `js/utils.js` | `spawnParticles`, `getCenter` — shared rendering helpers |

**Key state properties:**
- `state.path` — ordered array of `{x, y}` grid cells forming the goblin route
- `state.pathSet` — `Set` of `"x,y"` strings for O(1) path membership checks
- `state.grid` — 2D array of cell objects `{ x, y, type, content, enemies[], stacks[] }`. `type` is `'empty'`, `'path'`, `'node'`, `'tower'`, or `'water'`
- `state.CELL` — pixel size of each grid cell (computed from canvas dimensions)
- `state.fIncome` — function reference (set to `fIncome` in main.js so ui.js can call `state.fIncome()`)
- `state.nodes` — array of active resource nodes `{ type, x, y, wobbleTick, cd }`
- `state.resources` — plain object keyed by resource type e.g. `{ stone: 3, wood: 1, dust: 5 }`
- `state.phase` — `'idle'` | `'prep'` | `'active'`; prep phase lasts 1800 ticks (30s) between waves
- `state.age` — current age string: `'stone'` (more planned); used for age-gated logic
- `state.paused` — `true` while Research, Bestiary, or Scribe's Journal overlay is open; `update()` returns immediately
- `state.unlockedTowers` — `Set` of tower/building keys the player may place; starts as `['squirrel','lion','penguin','lab']`; expanded by research unlocks
- `state.research` — the current run's research graph: object keyed by node id, each node has `status`, `wavesLeft`, `wavesTotal`, `cost`, `prereqs`, `unlocks`
- `state.researchUnlocks` — plain object for numeric research effects (e.g. future capacity bonuses)
- `state.bSen` — `Set` of string keys for bestiary entries the player has seen (enemies spawned, towers built, events triggered)
- `state._kills` — running kill counter incremented in the `enemyDeath` bus handler

## Enemy Types (ETYPES in js/data.js:56)

| Key | Emoji | HP mult | Speed mult | Reward | Special |
|-----|-------|---------|------------|--------|---------|
| `normal` | 👺 | 1× | 1× | 4g | — |
| `fast` | 👺 | 0.4× | 1.6× | 3g | — |
| `tank` | 👹 | 2.5× | 0.6× | 8g | drops stone |
| `berserker` | 😤 | 1.8× | 1.2× | 7g | high damage if it reaches walls |
| `shaman` | 🧙 | 1.2× | 0.9× | 6g | rhythmic vocalizations, may buff nearby |
| `stealth` | 👤 | 0.6× | 1.4× | 5g | invisible to towers unless `seeInvis`; see Seahorse-C |
| `healer` | 💚 | 0.8× | 0.8× | 6g | heals nearby enemies each tick |
| `swarm` | 🐜 | 0.18× | 1.7× | 1g | tiny, numerous |
| `shield` | 🛡️ | 2× | 0.7× | 9g | drops stone; shield absorbs damage first |

Boss waves occur every 5 waves. Boss entities have `e.boss = true`, reward 18 particles and `rew` gold on death, yield 10 dust to Lab.

## World Generation (js/path.js)

1. **`genLakes(cols, rows)`** runs first — random-walks a BFS flood fill starting from a random cell, painting cells `type:'water'` (10–25 cells). Water blocks tower placement (`canPlace()` returns false) and is rendered as dark navy (#162d66) with a wavy white bezier stroke.
2. **`buildPath()`** generates a winding path left→right with vertical zigzags, avoiding water and previously visited cells. Path cells are stamped `type:'path'` into the grid and added to `state.pathSet`.
3. `invalidateBg()` must be called after `buildPath()` (or any grid change) to flush the background tile cache in `render.js`.

Grid cell type values: `'empty'` · `'path'` · `'node'` · `'tower'` · `'water'`

## Towers vs Supports

All tower and support definitions live together in `TD` in `js/data.js`, distinguished by `cat: 'tower'` or `cat: 'support'`. Both are placed into `state.towers` and rendered the same way. `updateTowers()` skips any entry where `TD[tw.type]?.cat !== 'tower'`. Support-specific logic lives in `js/support.js` and filters by `tw.type`.

The Lab (`cat:'support'`) is a singleton — only one may be placed per map. It has an `obsRange` property (default 3 tiles) and harvests Dust when enemies die within range: `1 + floor(reward/3)` per enemy, 10 per boss.

## Research system

On game start, `buildResearchGraph()` picks 4–5 random nodes from `VARIABLE_RESEARCH` and merges them with `FIXED_RESEARCH` into `state.research`. The fixed tree root is `settlement` (unlocks Hoard + Lab); `the_forge` is forced to the rightmost column. `tickResearch()` is called at wave-end; when a node completes, `applyUnlock()` fires and handles two cases: (1) comma-separated tower keys (e.g. `'fish,seahorse'`) are added to `state.unlockedTowers`; (2) named effects like `lab_radius_+1` are applied directly to state. Only one research may be active at a time. The Research panel (`#resP`) supports zoom (scroll wheel, 0.4×–3×) and pan (drag) with graph-aware clamping; clicking a node shows a floating square tooltip (`#resTip`) positioned next to it.

Most towers start **locked** — only squirrel, lion, penguin, and lab are available at game start. The panel should filter `TD` entries by `state.unlockedTowers` before showing them.

## Hoard building

The Hoard (`tw.type === 'hoard'`) stores resources in a single `tw.stored` integer (resource-type agnostic, capped at `HOARD_LEVELS[level].cap`, starting at 20). Accepts any resource type via monkey delivery or manual deposit (cannot withdraw). At wave-end: income = `base + floor(stored × multiplier)` per `HOARD_LEVELS`; decay = `max(1, floor(stored × 0.1))` removed (halved to 5% when monkey-boosted). `HOARD_LEVELS` and `HOARD_UPGS` are exported from `js/data.js`. Unlocked via the `settlement` research node.

## Bestiary & Scribe's Journal

**Bestiary** (`js/bestiary.js` — `BESTIARY`): lore entries keyed by entity ID (enemy types, allied towers, NPCs, bosses). Entries unlock when the entity key is added to `state.bSen`. The `sleepy_door` entry is pre-unlocked (mystery). Panel is `#beastP`.

**Scribe's Journal** (`js/bestiary.js:110` — `getScribeLogs(state)`): wave-gated lore notes rendered as HTML. Entries unlock progressively (wave 1 → wave 25+). Some entries branch on game state (e.g. whether a Lab was built). Panel is `#scribeP`, triggered by `#scribeBtn` (📓), styled in purple. `state._kills` is referenced in the wave-20 log entry.

Both panels call `syncPause()` on open/close, setting `state.paused`.

## Overlays that pause the game

Research (`#resP`), Bestiary (`#beastP`), and Scribe's Journal (`#scribeP`) all call `syncPause()` on open/close. `syncPause()` sets `state.paused` based on whether any of the three panels has the `sh` class (or `display:flex` for scribeP). The Scribe's Journal (`📓` button, `#scribeBtn`) is a separate lore panel styled in purple.

## Code style

- Compact, direct code — no abstractions for their own sake
- Tower/support/enemy objects are plain JS objects mutated in place; no classes
- `TOWER_SKILLS` stores `owned: boolean` directly on the definition objects — resetting the game must set these back to `false`
- Spell effects that persist across ticks (volcano, freeze) are stored on `state` directly
- `mkF(x, y, text, color)` in `ui.js` creates floating DOM labels over the canvas for damage numbers/events
- `mkGain(worldPx, worldPy, icon, amount, color)` in `ui.js` creates larger floating item-gain labels (accounts for camera zoom/pan)
- `invalidateBg()` in `render.js` must be called whenever the path changes or the canvas resizes, to force the background tile cache to regenerate
- Freeze spell only stops enemy movement — towers, factory lasers, and all other systems continue running. This works because `addToCell` is called before the freeze early-out in `updateEnemies`, keeping frozen enemies in the spatial grid so towers can still target them
