import { PAD } from './main.js';

export function createGrid(cols, rows) {
  const G = [];
  const c = Math.max(1, cols || 20);
  const r = Math.max(1, rows || 12);
  for (let y = 0; y < r; y++) {
    const row = [];
    for (let x = 0; x < c; x++) {
      row.push({
        x, y,
        type: 'empty', 
        content: null,
        enemies: [],
        stacks: [null, null, null, null]
      });
    }
    G.push(row);
  }
  return G;
}

export function clearEnemiesGrid(grid) {
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      grid[y][x].enemies.length = 0;
    }
  }
}

export function addToCell(grid, e) {
  // Enemy positions are in inner (buildable) coords; offset by PAD to reach full-grid indices.
  const icols = grid[0].length - 2 * PAD;
  const irows = grid.length - 2 * PAD;
  const cx = Math.max(0, Math.min(icols - 1, Math.round(e.x))) + PAD;
  const cy = Math.max(0, Math.min(irows - 1, Math.round(e.y))) + PAD;
  grid[cy][cx].enemies.push(e);
}

export function getEnemiesInRadius(grid, px, py, radius, stealthFilter = false, seeInvis = false) {
  const result = [];
  const rCeil = Math.ceil(radius);
  // px, py are inner coords; shift by PAD for full-grid indexing.
  const startX = Math.max(PAD, Math.floor(px + PAD) - rCeil);
  const endX = Math.min(grid[0].length - 1 - PAD, Math.floor(px + PAD) + rCeil);
  const startY = Math.max(PAD, Math.floor(py + PAD) - rCeil);
  const endY = Math.min(grid.length - 1 - PAD, Math.floor(py + PAD) + rCeil);

  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      const cell = grid[y][x];
      for (let i = 0; i < cell.enemies.length; i++) {
        const e = cell.enemies[i];
        if (e.dead || (stealthFilter && e.stealth && !seeInvis)) continue;
        if (Math.hypot(e.x - px, e.y - py) <= radius) {
          result.push(e);
        }
      }
    }
  }
  return result;
}
