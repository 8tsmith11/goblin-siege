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

## Architecture

All shared mutable game state lives in a single `const state = {}` object exported from `js/main.js`. Every other module does `import { state } from './main.js'` and mutates properties on that object directly. Circular imports are intentional and safe because imported values are only accessed inside function bodies, never at module evaluation time.

**Module responsibilities:**

| File | Responsibility |
|------|---------------|
| `js/main.js` | Exports `state`, canvas setup, game loop (`update`/`loop`), `startGame`/`startWave`/`startPrep`/`resetGame`/`fIncome` |
| `js/data.js` | `TD` (all tower + support definitions, keyed by type, `cat:'tower'` or `cat:'support'`), `TOWER_SKILLS` (A/B/C upgrade trees), `ETYPES`, `BOSS_LINES` |
| `js/audio.js` | Web Audio API: procedural music engine + all `sfx*` exports |
| `js/path.js` | `buildPath()` — procedural winding maze generation, writes to `state.path/pathSet/grid` |
| `js/enemies.js` | `mkE`, `genWave`, `updateEnemies` (movement, poison, healer logic) |
| `js/towers.js` | `updateTowers` — fires projectiles for `cat:'tower'` entries only |
| `js/support.js` | `spawnBees`, `updateClam/Clown/Robot/Bees/FactoryLaser` |
| `js/spells.js` | `SP` (spell definitions), `castSpell` |
| `js/skills.js` | `SKILLS` (player skill tree), `buyS`, `renderSk`, `showTowerSkill` |
| `js/events.js` | `EVENTS` array, `triggerEvent` |
| `js/render.js` | `render()` (all canvas drawing), `canPlace()`, `invalidateBg()` |
| `js/ui.js` | HUD, bottom panel, tooltips, overlays, research web, `mkF` (floating numbers), `mkGain` (item gain text), `initTabs` |
| `js/input.js` | Touch/mouse event handlers, `initInput` |
| `js/resources.js` | `RTYPES` (resource definitions), `NTYPES` (node definitions), `placeNodes`, `updateNodes`, `clickNode`, `renderNodes`, `renderStacks`, `dropItem` |
| `js/research.js` | `FIXED_RESEARCH`, `VARIABLE_RESEARCH`, `buildResearchGraph`, `tickResearch`, `applyUnlock`, `layoutNodes` |
| `js/bestiary.js` | `BESTIARY` — lore entries for enemies, towers, and events; unlocked via `state.bSen` |
| `js/save.js` | XOR+base64 obfuscated save/load, localStorage auto-save, file export/import |
| `js/grid.js` | `createGrid`, `clearEnemiesGrid`, `addToCell`, `getEnemiesInRadius` — spatial grid helpers |
| `js/projectiles.js` | `updateProjectiles` — projectile movement and hit logic |
| `js/pool.js` | Object pools for projectiles and beams to reduce GC pressure |
| `js/bus.js` | Simple event bus (`bus.on` / `bus.emit`) for decoupled module communication |
| `js/utils.js` | `spawnParticles`, `getCenter` — shared rendering helpers |

**Key state properties:**
- `state.path` — ordered array of `{x, y}` grid cells forming the goblin route
- `state.pathSet` — `Set` of `"x,y"` strings for O(1) path membership checks
- `state.grid` — 2D array of cell objects `{ x, y, type, content, enemies[], stacks[] }`. `type` is `'empty'`, `'path'`, `'node'`, or `'tower'`
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

## Towers vs Supports

All tower and support definitions live together in `TD` in `js/data.js`, distinguished by `cat: 'tower'` or `cat: 'support'`. Both are placed into `state.towers` and rendered the same way. `updateTowers()` skips any entry where `TD[tw.type]?.cat !== 'tower'`. Support-specific logic lives in `js/support.js` and filters by `tw.type`.

The Lab (`cat:'support'`) is a singleton — only one may be placed per map. It has an `obsRange` property (default 3 tiles) and harvests Dust when enemies die within range: `1 + floor(reward/3)` per enemy, 10 per boss.

## Research system

On game start, `buildResearchGraph()` picks 4–5 random nodes from `VARIABLE_RESEARCH` and merges them with `FIXED_RESEARCH` into `state.research`. The fixed tree root is `settlement` (unlocks Hoard + Lab); `the_forge` is forced to the rightmost column. `tickResearch()` is called at wave-end; when a node completes, `applyUnlock()` fires and handles two cases: (1) comma-separated tower keys (e.g. `'fish,seahorse'`) are added to `state.unlockedTowers`; (2) named effects like `lab_radius_+1` are applied directly to state. Only one research may be active at a time. The Research panel (`#resP`) supports zoom (scroll wheel, 0.4×–3×) and pan (drag) with graph-aware clamping; clicking a node shows a floating square tooltip (`#resTip`) positioned next to it.

Most towers start **locked** — only squirrel, lion, penguin, and lab are available at game start. The panel should filter `TD` entries by `state.unlockedTowers` before showing them.

## Hoard building

The Hoard (`tw.type === 'hoard'`) accepts wood and stone deposits stored in `tw.dep.wood` / `tw.dep.stone`. At wave-end, deposits are converted to gold using a level-based multiplier (`1.0` base, up to `4.0` at level 5), then the deposits are zeroed. The Hoard is unlocked via the `settlement` research node.

## Overlays that pause the game

Research (`#resP`), Bestiary (`#beastP`), and Scribe's Journal (`#scribeP`) all call `syncPause()` on open/close. `syncPause()` sets `state.paused` based on whether any of the three panels has the `sh` class (or `display:flex` for scribeP). The Scribe's Journal (`📓` button, `#scribeBtn`) is a separate lore panel styled in purple.

## Code style

- Compact, direct code — no abstractions for their own sake
- Tower/support/enemy objects are plain JS objects mutated in place; no classes
- `SKILLS` and `TOWER_SKILLS` store `owned: boolean` directly on the definition objects — resetting the game must set these back to `false`
- Spell effects that persist across ticks (volcano, freeze) are stored on `state` directly
- `mkF(x, y, text, color)` in `ui.js` creates floating DOM labels over the canvas for damage numbers/events
- `mkGain(worldPx, worldPy, icon, amount, color)` in `ui.js` creates larger floating item-gain labels (accounts for camera zoom/pan)
- `invalidateBg()` in `render.js` must be called whenever the path changes or the canvas resizes, to force the background tile cache to regenerate
- Freeze spell only stops enemy movement — towers, factory lasers, and all other systems continue running. This works because `addToCell` is called before the freeze early-out in `updateEnemies`, keeping frozen enemies in the spatial grid so towers can still target them
