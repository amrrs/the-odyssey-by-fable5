// Procedural WebAudio: sea ambience, siren song, combat sfx. No assets needed.
let ctx = null, master = null, sirenBus = null, sirenOscs = [];

export function initSound() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    startSea();
    startSiren();
  } catch (e) { /* audio unavailable — game still works */ }
}

function startSea() {
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass'; filt.frequency.value = 420; filt.Q.value = 0.6;
  const g = ctx.createGain(); g.gain.value = 0.12;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11;
  const lfoG = ctx.createGain(); lfoG.gain.value = 0.05;
  lfo.connect(lfoG); lfoG.connect(g.gain);
  src.connect(filt); filt.connect(g); g.connect(master);
  src.start(); lfo.start();
}

function startSiren() {
  sirenBus = ctx.createGain();
  sirenBus.gain.value = 0;
  sirenBus.connect(master);
  // eerie detuned choir
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = 'sine'; o.frequency.value = f * 0.5;
    const vib = ctx.createOscillator(); vib.frequency.value = 0.6 + i * 0.13;
    const vibG = ctx.createGain(); vibG.gain.value = 3 + i;
    vib.connect(vibG); vibG.connect(o.frequency);
    const g = ctx.createGain(); g.gain.value = 0.08;
    o.connect(g); g.connect(sirenBus);
    o.start(); vib.start();
    sirenOscs.push(o);
  });
}
export function setSirenLevel(v) {
  if (sirenBus) sirenBus.gain.linearRampToValueAtTime(v * 0.9, ctx.currentTime + 0.3);
}

function env(gainNode, peak, attack, decay) {
  const t = ctx.currentTime;
  gainNode.gain.cancelScheduledValues(t);
  gainNode.gain.setValueAtTime(0.0001, t);
  gainNode.gain.exponentialRampToValueAtTime(peak, t + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

export function sfx(name) {
  if (!ctx) return;
  const t = ctx.currentTime;
  if (name === 'swing') {
    const src = ctx.createBufferSource();
    const len = ctx.sampleRate * 0.25;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.18);
    const g = ctx.createGain(); env(g, 0.25, 0.01, 0.2);
    src.connect(f); f.connect(g); g.connect(master); src.start();
  } else if (name === 'hit' || name === 'hurt') {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(name === 'hit' ? 180 : 120, t);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.18);
    const g = ctx.createGain(); env(g, 0.4, 0.005, 0.2);
    o.connect(g); g.connect(master); o.start(); o.stop(t + 0.25);
  } else if (name === 'pickup' || name === 'blip') {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(name === 'pickup' ? 660 : 440, t);
    o.frequency.exponentialRampToValueAtTime(name === 'pickup' ? 990 : 440, t + 0.09);
    const g = ctx.createGain(); env(g, 0.18, 0.01, 0.15);
    o.connect(g); g.connect(master); o.start(); o.stop(t + 0.2);
  } else if (name === 'bow') {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(300, t + 0.06);
    const g = ctx.createGain(); env(g, 0.22, 0.005, 0.12);
    o.connect(g); g.connect(master); o.start(); o.stop(t + 0.18);
  } else if (name === 'thunder') {
    const src = ctx.createBufferSource();
    const len = ctx.sampleRate * 1.6;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
    src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
    const g = ctx.createGain(); g.gain.value = 0.8;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  } else if (name === 'roar') {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(70, t);
    o.frequency.linearRampToValueAtTime(45, t + 0.9);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
    const g = ctx.createGain(); env(g, 0.5, 0.05, 1.1);
    o.connect(f); f.connect(g); g.connect(master); o.start(); o.stop(t + 1.2);
  }
}
