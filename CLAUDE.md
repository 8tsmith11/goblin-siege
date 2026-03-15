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
| `js/main.js` | Exports `state`, canvas setup, game loop (`update`/`loop`), `updateProjectiles`, `startGame`/`startWave`/`resetGame`/`fIncome` |
| `js/audio.js` | Web Audio API: procedural music engine + all `sfx*` exports |
| `js/path.js` | `buildPath()` — procedural winding maze generation, writes to `state.path/pathSet/grid` |
| `js/enemies.js` | `ETYPES`, `mkE`, `genWave`, `updateEnemies` (movement, poison, healer logic) |
| `js/towers.js` | `TD` (tower stat definitions), `TOWER_SKILLS` (A/B/C upgrade trees), `updateTowers` |
| `js/support.js` | `SD` (support definitions), `spawnBees`, `updateClam/Clown/Robot/Bees/FactoryLaser` |
| `js/spells.js` | `SP` (spell definitions), `castSpell` |
| `js/skills.js` | `SKILLS` (player skill tree), `buyS`, `renderSk`, `showTowerSkill` |
| `js/events.js` | `EVENTS` array, `triggerEvent` |
| `js/render.js` | `render()` (all canvas drawing), `canPlace()` |
| `js/ui.js` | HUD, bottom panel, tooltips, overlays, `mkF` (floating numbers), `initTabs` |
| `js/input.js` | Touch/mouse event handlers, `initInput` |

**Key state properties:**
- `state.path` — ordered array of `{x, y}` grid cells forming the goblin route
- `state.pathSet` — `Set` of `"x,y"` strings for O(1) path membership checks
- `state.grid` — 2D array: `0` = empty, `1` = path, `2` = tower
- `state.CELL` — pixel size of each grid cell (computed from canvas dimensions)
- `state.fIncome` — function reference (set to `fIncome` in main.js so ui.js can call `state.fIncome()`)

## Code style

- Compact, direct code — no abstractions for their own sake
- Tower/support/enemy objects are plain JS objects mutated in place; no classes
- `SKILLS` and `TOWER_SKILLS` store `owned: boolean` directly on the definition objects — resetting the game must set these back to `false`
- Spell effects that persist across ticks (volcano, freeze) are stored on `state` directly
- `mkF(x, y, text, color)` in `ui.js` creates floating DOM labels over the canvas for damage numbers/events
