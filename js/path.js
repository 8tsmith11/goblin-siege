'use strict';
import { state } from './main.js';
import { createGrid } from './grid.js';

const PAD = 6; // Playable bounds margin

function genLakes(cols, rows) {
  let x = PAD + Math.floor(Math.random() * (cols - 2 * PAD));
  let y = PAD + Math.floor(Math.random() * (rows - 2 * PAD));
  state.grid[y][x].type = 'water';

  let q = [{ x: x, y: y }];
  let count = 1;
  let limit = 16 + Math.floor(Math.random() * 10);
  while (q.length > 0 && limit > 0) {
    const curr = q.shift();
    limit--;
    [[-1,0],[1,0],[0,-1],[0,1]].sort(() => Math.random() - .5).forEach(([dx, dy]) => {
      const nx = curr.x + dx, ny = curr.y + dy;
      if (nx >= PAD && nx < cols - PAD && ny >= PAD && ny < rows - PAD && state.grid[ny][nx].type === 'empty') {
        if (count < 10 || Math.random() < 0.35) {
          state.grid[ny][nx].type = 'water';
          q.push({ x: nx, y: ny });
          count++;
        }
      }
    });
  }
}

export function buildPath() {
  const { COLS, ROWS } = state;
  state.grid = createGrid(COLS, ROWS);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (r < PAD || r >= ROWS - PAD || c < PAD || c >= COLS - PAD) {
        state.grid[r][c].type = 'forest';
      }
    }
  }
  genLakes(COLS, ROWS);
  // Predetermine world-gen choices
  if (!state.worldGenChoices) state.worldGenChoices = {};
  if (!state.worldGenChoices.wave10Blueprint) {
    state.worldGenChoices.wave10Blueprint = Math.random() < 0.5 ? 'clown' : 'lizard';
  }
  // Precompute water-adjacent tiles for monkey pathfinding
  state.waterBorderTiles = [];
  for (let gy = PAD; gy < ROWS - PAD; gy++) {
    for (let gx = PAD; gx < COLS - PAD; gx++) {
      if (state.grid[gy][gx].type === 'water') continue;
      for (const [ddx, ddy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const bx = gx+ddx, by = gy+ddy;
        if (bx >= PAD && bx < COLS - PAD && by >= PAD && by < ROWS - PAD && state.grid[by][bx].type === 'water') {
          state.waterBorderTiles.push({ x: gx, y: gy }); break;
        }
      }
    }
  }
  state.path = []; state.pathSet.clear();
  const vis = new Set();
  const innerRows = ROWS - 2 * PAD;
  const innerCols = COLS - 2 * PAD;
  let px = PAD, py = PAD + Math.max(1, Math.min(Math.floor(innerRows * 0.3), innerRows - 2));
  state.path.push({ x: px, y: py }); vis.add(px + ',' + py);
  let seg = 0, maxS = Math.max(4, Math.floor(innerCols * 0.30)), lastV = 0;

  while (px < COLS - PAD - 1 && state.path.length < innerCols * innerRows * 0.65) {
    if (seg >= maxS || (Math.random() < 0.15 && seg > 3)) {
      const vd = lastV === 1 ? -1 : lastV === -1 ? 1 : (Math.random() < 0.5 ? 1 : -1);
      const vl = Math.max(4, Math.floor(4 + Math.random() * Math.min(12, Math.floor(innerRows * 0.6))));
      for (let i = 0; i < vl; i++) {
        const ny = py + vd;
        if (ny < PAD + 1 || ny >= ROWS - PAD - 1 || vis.has(px + ',' + ny)) break;
        py = ny; state.path.push({ x: px, y: py }); vis.add(px + ',' + py);
      }
      lastV = vd; seg = 0; maxS = Math.max(4, Math.floor(4 + Math.random() * innerCols * 0.25));
    }
    const nx = px + 1;
    if (nx < COLS - PAD && !vis.has(nx + ',' + py)) { px = nx; state.path.push({ x: px, y: py }); vis.add(px + ',' + py); seg++; }
    else if (nx >= COLS - PAD) break;
    else {
      let escaped = false;
      for (const dy of (Math.random() < 0.5 ? [1, -1] : [-1, 1])) {
        const ny = py + dy;
        if (ny >= PAD + 1 && ny < ROWS - PAD - 1 && !vis.has(px + ',' + ny)) { py = ny; state.path.push({ x: px, y: py }); vis.add(px + ',' + py); escaped = true; break; }
      }
      if (!escaped) break;
      seg = 0;
    }
  }
  while (px < COLS - PAD - 1) { px++; if (!vis.has(px + ',' + py)) { state.path.push({ x: px, y: py }); vis.add(px + ',' + py); } }
  if (state.path.length < 5) { state.path = []; for (let c = PAD; c < COLS - PAD; c++) state.path.push({ x: c, y: PAD + Math.floor(innerRows / 2) }); }
  const cl = [state.path[0]];
  for (let i = 1; i < state.path.length; i++) { if (state.path[i].x !== state.path[i-1].x || state.path[i].y !== state.path[i-1].y) cl.push(state.path[i]); }
  state.path = cl.filter(p => p.x >= PAD && p.x < COLS - PAD && p.y >= PAD && p.y < ROWS - PAD);
  state.pathSet.clear();
  state.path.forEach(p => { state.pathSet.add(p.x + ',' + p.y); state.grid[p.y][p.x].type = 'path'; });
}

function _genForestClusters(cols, rows) {
  const clusterCount = 2 + Math.floor(Math.random() * 2); // 2–3 clusters
  for (let ci = 0; ci < clusterCount; ci++) {
    // Pick a random seed on an empty inner tile
    let sx, sy, attempts = 0;
    do {
      sx = PAD + Math.floor(Math.random() * (state.COLS - 2 * PAD));
      sy = PAD + Math.floor(Math.random() * (state.ROWS - 2 * PAD));
      attempts++;
    } while (state.grid[sy][sx].type !== 'empty' && attempts < 40);
    if (state.grid[sy][sx].type !== 'empty') continue;

    state.grid[sy][sx].type = 'forest';
    const clusterSize = 1 + Math.floor(Math.random() * 4); // 1–4 tiles
    const frontier = [{ x: sx, y: sy }];
    let placed = 1;
    while (frontier.length && placed < clusterSize) {
      const idx = Math.floor(Math.random() * frontier.length);
      const { x, y } = frontier.splice(idx, 1)[0];
      for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]].sort(() => Math.random() - .5)) {
        const nx = x + dx, ny = y + dy;
        if (nx < PAD + 1 || nx >= state.COLS - PAD - 1 || ny < PAD + 1 || ny >= state.ROWS - PAD - 1) continue;
        if (state.grid[ny][nx].type !== 'empty') continue;
        state.grid[ny][nx].type = 'forest';
        frontier.push({ x: nx, y: ny });
        placed++;
        if (placed >= clusterSize) break;
      }
    }
  }
}
