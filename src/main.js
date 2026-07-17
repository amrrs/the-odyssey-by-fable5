import * as THREE from 'three';
import { G } from './state.js';
import { buildWorld } from './world.js';
import { Player } from './player.js';
import { initInput, onKeyPress, onClick, releasePointer } from './input.js';
import { startChapter, updateStory } from './story.js';
import { playerAttack, shootArrow, updateArrows } from './combat.js';
import { initSound } from './sound.js';
import * as UI from './ui.js';
import { dist2d } from './util.js';

// ---------------------------------------------------------------- boot
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 2000);
camera.position.set(-40, 18, 100);
camera.lookAt(0, 6, 0);

G.scene = scene;
G.camera = camera;
G.renderer = renderer;
G.allies = [];

const world = buildWorld(scene);
G.world = world;
G.ship = world.ship;
G.player = new Player(scene);
G.player.teleport(-55, 58, Math.PI * 0.75);

initInput(renderer.domElement);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------------------------------------------------------------- title
const titleEl = document.getElementById('title');
const btnNew = document.getElementById('btn-new');
const btnCont = document.getElementById('btn-continue');
let savedChapter = 1;
try {
  const s = parseInt(localStorage.getItem('odyssey_chapter') || '0', 10);
  if (s > 1 && s <= 4) { savedChapter = s; btnCont.classList.remove('hidden'); btnCont.textContent = `CONTINUE — CHAPTER ${'I'.repeat(0) + ['', 'I', 'II', 'III', 'IV'][s]}`; }
} catch (e) {}

function begin(ch) {
  initSound();
  titleEl.classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  startChapter(ch);
}
btnNew.onclick = () => begin(1);
btnCont.onclick = () => begin(savedChapter);

// ---------------------------------------------------------------- input wiring
onKeyPress(code => {
  if (G.mode === 'dialogue') {
    if (code.startsWith('Digit')) UI.dialogueKey(parseInt(code.slice(5), 10) - 1);
    if (code === 'KeyE' || code === 'Space' || code === 'Enter') UI.dialogueContinue();
    return;
  }
  if (code === 'KeyE' && (G.mode === 'walk' || G.mode === 'sail')) {
    if (currentInteract) currentInteract.use();
  }
  if (code === 'KeyQ' && G.flags.hasBow && !G.axeChallenge) {
    if (G.mode === 'walk') {
      G.mode = 'aim';
      G.player.setWeapon('bow');
      UI.crosshair(true);
    } else if (G.mode === 'aim') {
      G.mode = 'walk';
      G.player.setWeapon('sword');
      UI.crosshair(false);
    }
  }
});

onClick(() => {
  if (G.mode === 'walk') playerAttack();
  else if (G.mode === 'aim') shootArrow();
});

// ---------------------------------------------------------------- interaction scan
let currentInteract = null;
function scanInteract() {
  currentInteract = null;
  if (G.mode !== 'walk' && G.mode !== 'sail') { UI.prompt(null); return; }
  const p = G.player.group.position;
  let best = null, bd = 1e9;
  for (const it of G.interactables) {
    if (it.when && !it.when()) continue;
    const ip = it.pos();
    const d = dist2d(p.x, p.z, ip.x, ip.z);
    if (d < it.r && d < bd) { bd = d; best = it; }
  }
  currentInteract = best;
  UI.prompt(best ? (typeof best.label === 'function' ? best.label() : best.label) : null);
}

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
let scanT = 0;

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  G.time += dt;

  if (G.mode !== 'title') {
    G.player.update(dt);
    for (const n of [...G.npcs]) n.update(dt);
    for (const e of [...G.enemies]) e.update(dt);
    for (const a of G.allies || []) a.update(dt);
    updateArrows(dt);
    updateStory(dt);
    scanT -= dt;
    if (scanT <= 0) { scanT = 0.12; scanInteract(); }
  } else {
    // slow title orbit around the cyclops island
    const t = G.time * 0.05;
    camera.position.set(Math.sin(t) * 120, 26, Math.cos(t) * 120);
    camera.lookAt(0, 8, 0);
  }

  world.update(dt);
  UI.updateLabels(camera, THREE);
  renderer.render(scene, camera);
}
loop();

// debug/testing hooks
window.game = { G, startChapter, THREE, debug: () => ({ interact: currentInteract && currentInteract.id, mode: G.mode }) };
