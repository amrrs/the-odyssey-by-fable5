import { G } from './state.js';

const $ = id => document.getElementById(id);

export function objective(chapLabel, text) {
  $('obj-chap').textContent = chapLabel;
  $('obj-text').textContent = text;
}

export function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  $('toasts').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .6s'; }, 3600);
  setTimeout(() => el.remove(), 4300);
}

export function banner(chap, title) {
  const b = $('banner');
  b.querySelector('.b-chap').textContent = chap;
  b.querySelector('.b-title').textContent = title;
  b.style.opacity = '1';
  setTimeout(() => { b.style.opacity = '0'; }, 4200);
}

export function fade(toBlack) {
  const f = $('fade');
  f.style.opacity = toBlack ? '1' : '0';
  return new Promise(r => setTimeout(r, 850));
}

// full-screen narration: array of paragraphs, advance on click. Resolves when done.
// Only one narration can be active — starting a new one cancels the old
// (the stale awaiter is dropped, never resolved).
let narrSession = null;
export function cancelNarrate() {
  const n = $('narrate');
  if (narrSession) { n.removeEventListener('click', narrSession); narrSession = null; }
  n.classList.add('hidden');
}
export function narrate(paras) {
  return new Promise(resolve => {
    cancelNarrate();
    const n = $('narrate'), t = n.querySelector('.n-text');
    let i = 0;
    const prevMode = G.mode;
    G.mode = 'cutscene';
    n.classList.remove('hidden');
    t.innerHTML = paras[0];
    const onClick = () => {
      i++;
      if (i >= paras.length) {
        n.classList.add('hidden');
        n.removeEventListener('click', onClick);
        if (narrSession === onClick) narrSession = null;
        G.mode = prevMode === 'cutscene' ? 'walk' : prevMode;
        resolve();
      } else t.innerHTML = paras[i];
    };
    narrSession = onClick;
    n.addEventListener('click', onClick);
  });
}

export function prompt(text) {
  const p = $('prompt');
  if (!text) { p.classList.add('hidden'); return; }
  p.innerHTML = `<b>E</b> — ${text}`;
  p.classList.remove('hidden');
}

export function setHP(frac) { $('hpbar').style.width = `${Math.max(0, frac) * 100}%`; }
export function setShipHP(frac, show) {
  $('shipwrap').classList.toggle('hidden', !show);
  $('shipbar').style.width = `${Math.max(0, frac) * 100}%`;
}
export function crosshair(show) { $('crosshair').classList.toggle('hidden', !show); }
export function hurtVignette(a) { $('vignette-red').style.opacity = a; }

// ---------- dialogue box ----------
let dlgPick = null, dlgOptCount = 0;
export function showDialogue(speaker, text, opts, onPick) {
  G.mode = 'dialogue';
  document.exitPointerLock?.();
  $('dialogue').classList.remove('hidden');
  $('dlg-speaker').textContent = speaker;
  $('dlg-text').textContent = text;
  const box = $('dlg-opts');
  box.innerHTML = '';
  dlgPick = onPick;
  dlgOptCount = opts.length;
  opts.forEach(([label], i) => {
    const b = document.createElement('button');
    b.className = 'dlg-opt';
    b.innerHTML = `<span class="num">${i + 1}.</span>${label}`;
    b.onclick = () => onPick(i);
    box.appendChild(b);
  });
}
export function hideDialogue() {
  $('dialogue').classList.add('hidden');
  $('dlg-opts').innerHTML = '';
  dlgPick = null;
  dlgOptCount = 0;
  if (G.mode === 'dialogue') G.mode = 'walk';
}
export function dialogueKey(n) { if (dlgPick && n >= 0 && n < dlgOptCount) dlgPick(n); }
export function dialogueContinue() { if (dlgPick && dlgOptCount === 1) dlgPick(0); }

// ---------- floating labels ----------
const labels = []; // {el, getPos:()=>Vector3-ish worldpos, until, kind}
export function addLabel(kind, getPos, text, seconds) {
  const el = document.createElement('div');
  el.className = kind;
  el.textContent = text;
  document.getElementById('bubbles').appendChild(el);
  const rec = { el, getPos, until: seconds ? G.time + seconds : Infinity, kind };
  labels.push(rec);
  return rec;
}
export function removeLabel(rec) {
  const i = labels.indexOf(rec);
  if (i >= 0) { rec.el.remove(); labels.splice(i, 1); }
}
const _v = { x: 0, y: 0, z: 0 };
export function updateLabels(camera, THREE) {
  const v = new THREE.Vector3();
  for (let i = labels.length - 1; i >= 0; i--) {
    const L = labels[i];
    if (G.time > L.until) { removeLabel(L); continue; }
    const p = L.getPos();
    if (!p) { L.el.style.display = 'none'; continue; }
    v.set(p.x, p.y, p.z).project(camera);
    const dist = camera.position.distanceTo(p);
    const maxDist = L.kind === 'bark' ? 30 : 26;
    if (v.z > 1 || v.z < -1 || dist > maxDist) { L.el.style.display = 'none'; continue; }
    L.el.style.display = '';
    L.el.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`;
    L.el.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
    L.el.style.opacity = String(Math.max(0.25, 1 - dist / maxDist));
  }
}
