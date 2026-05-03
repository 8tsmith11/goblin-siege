function createPool(createFn, resetFn) {
  const pool = [];
  return {
    get: () => pool.pop() || createFn(),
    free: (item) => {
      if (resetFn) resetFn(item);
      pool.push(item);
    }
  };
}

const _pPool = createPool(() => ({}), null);
export const getP = _pPool.get;
export const freeP = _pPool.free;

const _projPool = createPool(() => ({ hits: [] }), p => { p.hits.length = 0; p.poison = null; p.pierceDir = null; p._assaultTower = null; p._beeHive = null; });
export const getProj = _projPool.get;
export const freeProj = _projPool.free;

const _beamPool = createPool(() => ({}), null);
export const getBeam = _beamPool.get;
export const freeBeam = _beamPool.free;
