export const pPool = [];
export function getP() { return pPool.pop() || {}; }
export function freeP(p) { pPool.push(p); }

export const projPool = [];
export function getProj() { return projPool.pop() || { hits: [] }; }
export function freeProj(p) { p.hits.length = 0; p.poison = null; projPool.push(p); }

export const beamPool = [];
export function getBeam() { return beamPool.pop() || {}; }
export function freeBeam(b) { beamPool.push(b); }
