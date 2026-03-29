'use strict';

let AC = null, MG = null, sOn = true, mOn = false;

export function iA() {
  if (AC) return;
  AC = new (window.AudioContext || window.webkitAudioContext)();
  MG = AC.createGain();
  MG.gain.value = 0.25;
  MG.connect(AC.destination);
  startMusic();
}

export function toggleSound() {
  sOn = !sOn;
  document.getElementById('snd').textContent = sOn ? '🔊' : '🔇';
  if (MG) MG.gain.value = sOn ? 0.25 : 0;
  if (window.bgm) {
    window.bgm.volume = sOn ? 0.3 : 0;
    if (sOn) {
      if (!window.bgmWaiting && window.bgm.paused) window.bgm.play().catch(()=>{});
    } else {
      window.bgm.pause();
    }
  }
}

function pT(f, d, t, v) {
  if (!AC || !sOn) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = t || 'square'; o.frequency.value = f;
  g.gain.setValueAtTime((v || 0.12) * 0.5, AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + d);
  o.connect(g); g.connect(MG); o.start(); o.stop(AC.currentTime + d);
}

export function sfxPlace() { pT(520, 0.07, 'square', 0.18); setTimeout(() => pT(700, 0.05, 'square', 0.13), 40); }
export function sfxShoot() { pT(900 + Math.random() * 200, 0.03, 'sawtooth', 0.06); }
export function sfxHit() { pT(200, 0.05, 'triangle', 0.08); }
export function sfxKill() { pT(600, 0.04, 'square', 0.1); setTimeout(() => pT(800, 0.06, 'square', 0.08), 35); }
export function sfxNuke() { pT(80, 0.35, 'sawtooth', 0.2); setTimeout(() => pT(120, 0.25, 'sawtooth', 0.15), 80); }
export function sfxVolcano() { pT(60, 0.4, 'sawtooth', 0.18); setTimeout(() => pT(90, 0.3, 'triangle', 0.12), 120); }
export function sfxFreeze() { pT(1200, 0.12, 'sine', 0.12); setTimeout(() => pT(1500, 0.15, 'sine', 0.08), 60); }
export function sfxBoss() { pT(100, 0.25, 'sawtooth', 0.18); setTimeout(() => pT(80, 0.3, 'sawtooth', 0.2), 150); setTimeout(() => pT(60, 0.4, 'sawtooth', 0.18), 300); }
export function sfxWave() { pT(523, 0.08, 'square', 0.12); setTimeout(() => pT(659, 0.08, 'square', 0.12), 80); setTimeout(() => pT(784, 0.12, 'square', 0.12), 160); }
export function sfxLaser() { pT(1800, 0.06, 'sawtooth', 0.08); pT(1600, 0.1, 'square', 0.04); }
export function sfxLizard() { pT(150, 0.15, 'sawtooth', 0.15); setTimeout(() => pT(100, 0.25, 'sawtooth', 0.2), 80); }
export function sfxClown() { pT(800, 0.08, 'sine', 0.15); setTimeout(() => pT(1000, 0.06, 'sine', 0.12), 60); setTimeout(() => pT(600, 0.1, 'sine', 0.1), 120); }
export function sfxMine()  { pT(160, 0.07, 'triangle', 0.16); setTimeout(() => pT(110, 0.09, 'triangle', 0.11), 45); }
export function sfxEvent() { pT(440, 0.1, 'triangle', 0.15); setTimeout(() => pT(550, 0.1, 'triangle', 0.12), 100); setTimeout(() => pT(660, 0.15, 'triangle', 0.1), 200); }
export function sfxBee() { pT(1400, 0.02, 'sawtooth', 0.03); }
export function sfxHeal() { pT(440, 0.15, 'sine', 0.12); }
export function sfxGoldBoost() { pT(660, 0.1, 'triangle', 0.1); }
export function sfxRage() { pT(300, 0.2, 'sawtooth', 0.15); }

window.bgm = null;
window.bgmWaiting = false;

function startMusic() {
  if (mOn) return; mOn = true;
  window.bgm = new Audio('assets/Breath_of_the_Cedar.mp3');
  window.bgm.volume = sOn ? 0.3 : 0;
  window.bgm.addEventListener('ended', () => {
    window.bgmWaiting = true;
    setTimeout(() => {
      window.bgmWaiting = false;
      window.bgm.currentTime = 0;
      if (sOn) window.bgm.play().catch(()=>{});
    }, 5000);
  });
  if (sOn) window.bgm.play().catch(()=>{});
}

export function speak(text) {
  if (!sOn || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.85; u.pitch = 0.5; u.volume = 0.6;
  speechSynthesis.speak(u);
}
