'use strict';

const BASE = 'http://localhost:8000';

function getToken() { return localStorage.getItem('gs_token'); }
function setToken(t) { localStorage.setItem('gs_token', t); }
export function clearToken() { localStorage.removeItem('gs_token'); }
export function isLoggedIn() { return !!getToken(); }

async function req(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { clearToken(); throw new Error('auth'); }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

// Auth
export async function register(username, password) {
  const data = await req('POST', '/auth/register', { username, password });
  setToken(data.access_token);
}

export async function login(username, password) {
  // OAuth2PasswordRequestForm expects form-encoded
  const res = await fetch(BASE + '/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password }),
  });
  if (!res.ok) throw new Error('Invalid username or password');
  const data = await res.json();
  setToken(data.access_token);
}

// Game
export const newGame    = ()       => req('POST', '/game/new');
export const loadState  = ()       => req('GET',  '/game/state');
export const startWave  = ()       => req('POST', '/game/wave/start');
export const completeWave = (body) => req('POST', '/game/wave/complete', body);

// Towers
export const placeTower         = (type, x, y) => req('POST',   '/game/towers',                    { type, x, y });
export const upgradeTower       = (id)          => req('PATCH',  `/game/towers/${id}/upgrade`);
export const sellTower          = (id)          => req('DELETE', `/game/towers/${id}`);
export const addLaser           = (id)          => req('POST',   `/game/towers/${id}/laser`);
export const upgradeLaser       = (id)          => req('PATCH',  `/game/towers/${id}/laser`);
export const upgradeFactoryIncome = (id)        => req('PATCH',  `/game/towers/${id}/upgrade-income`);
export const buyTowerSkill      = (id, skill)   => req('POST',   `/game/towers/${id}/skill`,        { skill });

// Spells + skills
export const castSpell  = (spell) => req('POST', '/game/spells/cast', { spell });
export const buySkill   = (skill) => req('POST', '/game/skills/buy',  { skill });
