'use strict';
import { state } from './main.js';
import { createGrid } from './grid.js';

export function buildPath() {
  const { COLS, ROWS } = state;
  state.grid = createGrid(COLS, ROWS);
  state.path = []; state.pathSet.clear();
  const vis = new Set();
  let px = 0, py = Math.max(1, Math.min(Math.floor(ROWS * 0.3), ROWS - 2));
  state.path.push({ x: px, y: py }); vis.add(px + ',' + py);
  let seg = 0, maxS = Math.max(2, Math.floor(COLS * 0.15)), lastV = 0;

  while (px < COLS - 1 && state.path.length < COLS * ROWS * 0.65) {
    if (seg >= maxS || (Math.random() < 0.45 && seg > 1)) {
      const vd = lastV === 1 ? -1 : lastV === -1 ? 1 : (Math.random() < 0.5 ? 1 : -1);
      const vl = Math.max(2, Math.floor(2 + Math.random() * Math.min(5, ROWS * 0.3)));
      for (let i = 0; i < vl; i++) {
        const ny = py + vd;
        if (ny < 1 || ny >= ROWS - 1 || vis.has(px + ',' + ny)) break;
        py = ny; state.path.push({ x: px, y: py }); vis.add(px + ',' + py);
      }
      lastV = vd; seg = 0; maxS = Math.max(2, Math.floor(2 + Math.random() * COLS * 0.12));
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
