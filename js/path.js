'use strict';
import { state } from './main.js';
import { createGrid } from './grid.js';

function genLakes(cols, rows) {
  let x = Math.floor(Math.random() * cols);
  let y = Math.floor(Math.random() * rows);
  state.grid[y][x].type = 'water';

  let q = [{ x: x, y: y }];
  let count = 1;
  let limit = 16 + Math.floor(Math.random() * 10); 
  while (q.length > 0 && limit > 0) {
    const curr = q.shift();
    limit--;
    [[-1,0],[1,0],[0,-1],[0,1]].sort(() => Math.random() - .5).forEach(([dx, dy]) => {
      const nx = curr.x + dx, ny = curr.y + dy;
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && state.grid[ny][nx].type === 'empty') {
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
  genLakes(COLS, ROWS);
  state.path = []; state.pathSet.clear();
  const vis = new Set();
  let px = 0, py = Math.max(1, Math.min(Math.floor(ROWS * 0.3), ROWS - 2));
  state.path.push({ x: px, y: py }); vis.add(px + ',' + py);
  let seg = 0, maxS = Math.max(4, Math.floor(COLS * 0.30)), lastV = 0;

  while (px < COLS - 1 && state.path.length < COLS * ROWS * 0.65) {
    if (seg >= maxS || (Math.random() < 0.15 && seg > 3)) {
      const vd = lastV === 1 ? -1 : lastV === -1 ? 1 : (Math.random() < 0.5 ? 1 : -1);
      const vl = Math.max(4, Math.floor(4 + Math.random() * Math.min(12, Math.floor(ROWS * 0.6))));
      for (let i = 0; i < vl; i++) {
        const ny = py + vd;
        if (ny < 1 || ny >= ROWS - 1 || vis.has(px + ',' + ny)) break;
        py = ny; state.path.push({ x: px, y: py }); vis.add(px + ',' + py);
      }
      lastV = vd; seg = 0; maxS = Math.max(4, Math.floor(4 + Math.random() * COLS * 0.25));
    }
    const nx = px + 1;
    if (nx < COLS && !vis.has(nx + ',' + py)) { px = nx; state.path.push({ x: px, y: py }); vis.add(px + ',' + py); seg++; }
    else if (nx >= COLS) break;
    else {
      let escaped = false;
      for (const dy of (Math.random() < 0.5 ? [1, -1] : [-1, 1])) {
        const ny = py + dy;
        if (ny >= 1 && ny < ROWS - 1 && !vis.has(px + ',' + ny)) { py = ny; state.path.push({ x: px, y: py }); vis.add(px + ',' + py); escaped = true; break; }
      }
      if (!escaped) break;
      seg = 0;
    }
  }
  while (px < COLS - 1) { px++; if (!vis.has(px + ',' + py)) { state.path.push({ x: px, y: py }); vis.add(px + ',' + py); } }
  if (state.path.length < 5) { state.path = []; for (let c = 0; c < COLS; c++) state.path.push({ x: c, y: Math.floor(ROWS / 2) }); }
  const cl = [state.path[0]];
  for (let i = 1; i < state.path.length; i++) { if (state.path[i].x !== state.path[i-1].x || state.path[i].y !== state.path[i-1].y) cl.push(state.path[i]); }
  state.path = cl.filter(p => p.x >= 0 && p.x < COLS && p.y >= 0 && p.y < ROWS);
  state.pathSet.clear();
  state.path.forEach(p => { state.pathSet.add(p.x + ',' + p.y); state.grid[p.y][p.x].type = 'path'; });
}
