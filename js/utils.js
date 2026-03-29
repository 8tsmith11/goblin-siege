export function spawnParticles(particlesArr, cx, cy, count, { spreadX = 3, spreadY = 3, vxBase = 0, vyBase = 0, life = 15, clr, sz = 2 }) {
  for (let i = 0; i < count; i++) {
    particlesArr.push({
      x: cx, y: cy,
      vx: vxBase + (Math.random() - 0.5) * spreadX,
      vy: vyBase + (Math.random() - 0.5) * spreadY,
      life, clr, sz
    });
  }
}

export function getCenter(gridPos, CELL) {
  return gridPos * CELL + CELL / 2;
}
