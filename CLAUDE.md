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
| `js/audio.js` | Web Audio API: procedural music engine + all `sfx*` exports |
| `js/path.js` | `buildPath()` — procedural winding maze generation, writes to `state.path/pathSet/grid` |
| `js/enemies.js` | `ETYPES`, `mkE`, `genWave`, `updateEnemies` (movement, poison, healer logic) |
| `js/towers.js` | `TD` (tower stat definitions), `TOWER_SKILLS` (A/B/C upgrade trees), `updateTowers` |
| `js/support.js` | `SD` (support definitions), `spawnBees`, `updateClam/Clown/Robot/Bees/FactoryLaser` |
| `js/spells.js` | `SP` (spell definitions), `castSpell` |
| `js/skills.js` | `SKILLS` (player skill tree), `buyS`, `renderSk`, `showTowerSkill` |
| `js/events.js` | `EVENTS` array, `triggerEvent` |
| `js/render.js` | `render()` (all canvas drawing), `canPlace()`, `invalidateBg()` |
| `js/ui.js` | HUD, bottom panel, tooltips, overlays, `mkF` (floating numbers), `mkGain` (item gain text), `initTabs` |
| `js/input.js` | Touch/mouse event handlers, `initInput` |
| `js/resources.js` | `RTYPES` (resource definitions), `NTYPES` (node definitions), `placeNodes`, `updateNodes`, `clickNode`, `renderNodes`, `renderStacks`, `dropItem` |
| `js/save.js` | XOR+base64 obfuscated save/load, localStorage auto-save, file export/import |
| `js/grid.js` | `createGrid`, `clearEnemiesGrid`, `addToCell`, `getEnemiesInRadius` — spatial grid helpers |
| `js/projectiles.js` | `updateProjectiles` — projectile movement and hit logic |
| `js/pool.js` | Object pools for projectiles and beams to reduce GC pressure |
| `js/bus.js` | Simple event bus (`bus.on` / `bus.emit`) for decoupled module communication |

**Key state properties:**
- `state.path` — ordered array of `{x, y}` grid cells forming the goblin route
- `state.pathSet` — `Set` of `"x,y"` strings for O(1) path membership checks
- `state.grid` — 2D array of cell objects `{ x, y, type, content, enemies[], stacks[] }`. `type` is `'empty'`, `'path'`, `'node'`, or `'tower'`
- `state.CELL` — pixel size of each grid cell (computed from canvas dimensions)
- `state.fIncome` — function reference (set to `fIncome` in main.js so ui.js can call `state.fIncome()`)
- `state.nodes` — array of active resource nodes `{ type, x, y, wobbleTick, cd }`
- `state.resources` — plain object keyed by resource type e.g. `{ stone: 3 }`
- `state.phase` — `'idle'` | `'prep'` | `'active'`; prep phase lasts 1800 ticks (30s) between waves

## Code style

- Compact, direct code — no abstractions for their own sake
- Tower/support/enemy objects are plain JS objects mutated in place; no classes
- `SKILLS` and `TOWER_SKILLS` store `owned: boolean` directly on the definition objects — resetting the game must set these back to `false`
- Spell effects that persist across ticks (volcano, freeze) are stored on `state` directly
- `mkF(x, y, text, color)` in `ui.js` creates floating DOM labels over the canvas for damage numbers/events
- `mkGain(worldPx, worldPy, icon, amount, color)` in `ui.js` creates larger floating item-gain labels (accounts for camera zoom/pan)
- `invalidateBg()` in `render.js` must be called whenever the path changes or the canvas resizes, to force the background tile cache to regenerate
- Freeze spell only stops enemy movement — towers, factory lasers, and all other systems continue running. This works because `addToCell` is called before the freeze early-out in `updateEnemies`, keeping frozen enemies in the spatial grid so towers can still target them
