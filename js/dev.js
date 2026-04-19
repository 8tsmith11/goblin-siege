import { _ΨΔ } from './main.js';
import { RTYPES } from './resources.js';

let devActive = false;
let _st, _hudU;

export function initDev(state, hudU) {
  if (document.getElementById('devBtn')) return;
  _st = state;
  _hudU = hudU;

  const btn = document.createElement('button');
  btn.id = 'devBtn';
  btn.textContent = '🛠️ Dev';
  btn.title = 'Toggle dev mode — click resource counts to add more';
  Object.assign(btn.style, {
    position: 'absolute', top: '60px', left: '10px', zIndex: '9999',
    background: '#374151', color: '#9ca3af', border: '2px solid #4b5563',
    padding: '4px 10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px',
    borderRadius: '4px',
  });

  btn.onclick = () => {
    devActive = !devActive;
    _st._devMode = devActive;
    btn.style.background = devActive ? '#fbbf24' : '#374151';
    btn.style.color = devActive ? 'black' : '#9ca3af';
    btn.style.border = devActive ? '2px solid #f59e0b' : '2px solid #4b5563';
    document.getElementById('hRes')?.style.setProperty('cursor', devActive ? 'pointer' : '');
    document.getElementById('hG')?.parentElement?.style.setProperty('cursor', devActive ? 'pointer' : '');
    const saveBtn = document.getElementById('resSaveBtn');
    if (saveBtn) saveBtn.style.display = devActive ? '' : 'none';
    skipBtn.style.display = devActive ? '' : 'none';
  };

  const skipBtn = document.createElement('button');
  skipBtn.textContent = '⏭ Skip Wave';
  Object.assign(skipBtn.style, {
    position: 'absolute', top: '90px', left: '10px', zIndex: '9999',
    background: '#7c3aed', color: '#fff', border: '2px solid #6d28d9',
    padding: '4px 10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px',
    borderRadius: '4px', display: 'none',
  });
  skipBtn.onclick = () => {
    if (_st.phase !== 'active') return;
    _st.spawnQueue = [];
    _st.enemies = [];
  };

  document.body.appendChild(btn);
  document.body.appendChild(skipBtn);

  document.addEventListener('click', e => {
    if (!devActive) return;

    // HUD resource counts
    const resItem = e.target.closest('[data-res]');
    if (resItem) {
      const key = resItem.dataset.res;
      if (key && _st.resources != null) {
        _st.resources[key] = (_st.resources[key] || 0) + 10;
        _hudU?.();
      }
      return;
    }

    // Gold
    if (e.target.closest('#hG')) {
      _ΨΔ(() => { _st.gold = _st.gold + 10; });
      _hudU?.();
      return;
    }

    // Workbench stock
    const wbItem = e.target.closest('[data-wb-res]');
    if (wbItem) {
      const key = wbItem.dataset.wbRes;
      const twX = parseInt(wbItem.dataset.twX, 10);
      const twY = parseInt(wbItem.dataset.twY, 10);
      const tw = _st.towers?.find(t => t.x === twX && t.y === twY);
      if (tw && key) {
        if (!tw.inv) tw.inv = {};
        tw.inv[key] = (tw.inv[key] || 0) + 20;
        import('./ui.js').then(m => m.renderCraftPanel?.());
      }
    }
  });
}
