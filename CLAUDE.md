# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the game

**Backend (FastAPI):**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
# Runs on http://localhost:8000
```

**Frontend:** No build step. Serve with any static file server from the repo root:
```bash
npx serve .
# or
python3 -m http.server
```

Opening `index.html` directly as a `file://` URL won't work — ES modules require HTTP. The frontend expects the backend at `http://localhost:8000` (configured in `js/api.js`).

## Backend architecture

`backend/` is a FastAPI app with SQLite (via SQLAlchemy). JWT auth stored in `localStorage` as `gs_token`.

| File | Responsibility |
|------|---------------|
| `main.py` | App entry, CORS, router registration |
| `db.py` | SQLAlchemy engine, `SessionLocal`, `get_db` dependency |
| `models.py` | `User`, `GameSession`, `Tower` ORM models |
| `schemas.py` | Pydantic request/response models |
| `security.py` | `hash_password`, `verify_password`, `create_access_token`, `get_current_user` |
| `game.py` | Cost constants, income logic, wave generation, spend/validate helpers |
| `routers/auth.py` | `POST /auth/register`, `POST /auth/token` |
| `routers/game.py` | All game endpoints (towers, spells, skills, wave start/complete) |

**Authority split:**
- Server owns: gold, lives, wave number, tower state (type/position/level/skills), player skill tree
- Frontend owns: enemy positions/health, projectiles, particles, beams, bees (real-time simulation)
- Wave boundary: frontend sends `{ kills, leaks }` to `POST /game/wave/complete`; server reconciles gold/lives and returns authoritative values

**Tower IDs:** Server generates UUIDs; frontend tower objects carry an `id` field used for all upgrade/sell/skill API calls.

`js/api.js` is the sole API boundary — all fetch calls go through `req()` which attaches the JWT and throws on non-2xx.

## Architecture

All shared mutable game state lives in a single `const state = {}` object exported from `js/main.js`. Every other module does `import { state } from './main.js'` and mutates properties on that object directly. Circular imports are intentional and safe because imported values are only accessed inside function bodies, never at module evaluation time.

**Module responsibilities:**

| File | Responsibility |
|------|---------------|
| `js/main.js` | Exports `state`, canvas setup, game loop, `startGame`/`startWave`/`resetGame`/`fIncome`, `towerFromServer`, `applyServerState` |
| `js/audio.js` | Web Audio API: procedural music engine + all `sfx*` exports |
| `js/path.js` | `buildPath()` — procedural winding maze generation, writes to `state.path/pathSet/grid` |
| `js/enemies.js` | `ETYPES`, `mkE`, `mkEFromServer`, `genWave`, `updateEnemies` (movement, poison, healer logic) |
| `js/towers.js` | `TD` (tower stat definitions), `TOWER_SKILLS` (A/B/C upgrade trees), `updateTowers` (targeting + shooting) |
| `js/support.js` | `SD` (support definitions), `spawnBees`, `updateClam/Clown/Robot/Bees/FactoryLaser` |
| `js/spells.js` | `SP` (spell definitions), `castSpell` |
| `js/skills.js` | `SKILLS` (player skill tree), `buyS`, `renderSk`, `showTowerSkill` |
| `js/events.js` | `EVENTS` array, `triggerEvent` |
| `js/render.js` | `render()` (all canvas drawing), `canPlace()` |
| `js/ui.js` | HUD, bottom panel, tooltips, overlays, `mkF` (floating numbers), `initTabs`, `showAuthOverlay` |
| `js/input.js` | Touch/mouse event handlers, `initInput` |
| `js/api.js` | Fetch wrapper with JWT, `isLoggedIn`, `login`, `register`, all game API calls |

**Key state properties:**
- `state.path` — ordered array of `{x, y}` grid cells forming the goblin route
- `state.pathSet` — `Set` of `"x,y"` strings for O(1) path membership checks
- `state.grid` — 2D array: `0` = empty, `1` = path, `2` = tower
- `state.CELL` — pixel size of each grid cell (computed from canvas dimensions)

## Code style

- Compact, direct code — no abstractions for their own sake
- Tower/support/enemy objects are plain JS objects mutated in place; no classes
- `SKILLS` and `TOWER_SKILLS` store `owned: boolean` directly on the definition objects — resetting the game must set these back to `false`
- Spell effects that persist across ticks (volcano, freeze) are stored on `state` directly
- `mkF(x, y, text, color)` in `ui.js` creates floating DOM labels over the canvas for damage numbers/events
