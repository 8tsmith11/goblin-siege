'use strict';
import { state } from './main.js';

let AC = null, MG = null, sOn = true, mOn = false;

export function iA() {
  if (AC) return;
  AC = new (window.AudioContext || window.webkitAudioContext)();
  MG = AC.createGain();
  MG.gain.value = 0.25;
  MG.connect(AC.destination);
  startMusic();
}

export function isSoundOn() { return sOn; }

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
export function sfxResearch() {
  // Upbeat ascending arpeggio: 4 notes, sine, curious tone
  pT(523, 0.12, 'sine', 0.12);
  setTimeout(() => pT(659, 0.12, 'sine', 0.11), 90);
  setTimeout(() => pT(784, 0.14, 'sine', 0.10), 180);
  setTimeout(() => pT(1047, 0.18, 'sine', 0.13), 270);
}

export function sfxElderSpeak() {
  if (!AC || !sOn) return;
  const now = AC.currentTime;
  // Two gentle harmonics for a warmer, more voice-like tone
  for (const [freq, vol] of [[220, 0.28], [330, 0.14]]) {
    const o = AC.createOscillator(), lfo = AC.createOscillator(), lfoG = AC.createGain(), g = AC.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    lfo.type = 'sine'; lfo.frequency.value = 4.5;
    lfoG.gain.value = 5;
    lfo.connect(lfoG); lfoG.connect(o.frequency);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.06);
    g.gain.setValueAtTime(vol, now + 0.22);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    o.connect(g); g.connect(MG);
    o.start(now); lfo.start(now); o.stop(now + 0.55); lfo.stop(now + 0.55);
  }
}

let _humOsc = null, _humGain = null;
export function startHum() {
  if (!AC || !sOn || _humOsc?.length) return;
  // Duck BGM while hum plays
  if (window.bgm && sOn) { window.bgm.volume = 0.075; }
  _humGain = AC.createGain();
  _humGain.gain.setValueAtTime(0, AC.currentTime);
  _humGain.gain.linearRampToValueAtTime(0.85, AC.currentTime + 3);
  _humGain.connect(MG);
  _humOsc = [];
  for (const [freq, vol] of [[220, 0.5], [440, 0.3], [660, 0.15], [880, 0.08]]) {
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g); g.connect(_humGain);
    o.start(); _humOsc.push(o);
  }
}
export function stopHum() {
  if (!_humOsc?.length || !_humGain) return;
  _humGain.gain.setValueAtTime(_humGain.gain.value, AC.currentTime);
  _humGain.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + 1.5);
  _humOsc.forEach(o => o.stop(AC.currentTime + 1.5));
  _humOsc = null; _humGain = null;
  // Restore BGM
  if (window.bgm && sOn) { window.bgm.volume = 0.3; }
}

window.bgm = null;
window.bgmWaiting = false;

function startMusic() {
  if (mOn) return; mOn = true;
  const isForgeComplete = state?.research?.the_forge?.status === 'complete';
  const song = isForgeComplete ? "assets/The_Inventor's_Midnight.mp3" : "assets/Breath_of_the_Cedar.mp3";
  window.bgm = new Audio(song);
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

export function switchToMidnight() {
  if (!window.bgm) return;
  const old = window.bgm;
  // Fade out over 3 seconds
  const fadeStep = () => {
    if (old.volume > 0.02) { old.volume = Math.max(0, old.volume - 0.01); setTimeout(fadeStep, 60); }
    else {
      old.pause();
      window.bgm = new Audio("assets/The_Inventor's_Midnight.mp3");
      window.bgm.volume = sOn ? 0.3 : 0;
      window.bgm.addEventListener('ended', () => {
        window.bgmWaiting = true;
        setTimeout(() => {
          window.bgmWaiting = false;
          window.bgm.currentTime = 0;
          if (sOn) window.bgm.play().catch(() => {});
        }, 5000);
      });
      if (sOn) window.bgm.play().catch(() => {});
    }
  };
  fadeStep();
}

export function sfxWatcherScreech() {
  if (!AC || !sOn) return;
  const now = AC.currentTime;
  for (const [freq, vol, dur] of [[1600, 0.3, 0.9], [900, 0.25, 1.1], [2400, 0.2, 0.7]]) {
    const o = AC.createOscillator(), g = AC.createGain(), lfo = AC.createOscillator(), lfoG = AC.createGain();
    o.type = 'sawtooth'; o.frequency.value = freq;
    lfo.type = 'square'; lfo.frequency.value = 14 + Math.random() * 8;
    lfoG.gain.value = freq * 0.3;
    lfo.connect(lfoG); lfoG.connect(o.frequency);
    g.gain.setValueAtTime(vol * 0.7, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    o.connect(g); g.connect(MG);
    o.start(now); lfo.start(now); o.stop(now + dur); lfo.stop(now + dur);
  }
  const sub = AC.createOscillator(), subG = AC.createGain();
  sub.type = 'sine'; sub.frequency.value = 50;
  sub.frequency.exponentialRampToValueAtTime(20, now + 0.5);
  subG.gain.setValueAtTime(0.4, now); subG.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  sub.connect(subG); subG.connect(MG); sub.start(now); sub.stop(now + 0.5);
}

export function speak(text) {
  if (!sOn || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.85; u.pitch = 0.5; u.volume = 0.6;
  speechSynthesis.speak(u);
}
