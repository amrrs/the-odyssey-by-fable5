import * as THREE from 'three';

const mat = c => new THREE.MeshLambertMaterial({ color: c });
const box = (w, h, d, c) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
const sph = (r, c, seg = 10) => new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), mat(c));
const cyl = (rt, rb, h, c, seg = 8) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(c));

function shadow(o) { o.traverse(m => { if (m.isMesh) { m.castShadow = true; } }); return o; }

// ---------------------------------------------------------------- humanoid
// Returns a Group at feet-origin with userData.rig for animation.
export function makeHuman(opts = {}) {
  const {
    skin = 0xc9976a, tunic = 0xb8b2a0, dress = false, hair = 0x2e2318,
    beard = false, cloak = null, armor = false, scale = 1, female = false,
  } = opts;

  const g = new THREE.Group();

  // torso
  const torso = new THREE.Group();
  torso.position.y = 1.34;
  const chest = box(0.42, 0.5, 0.24, armor ? 0x8a6d3b : tunic);
  chest.position.y = -0.05;
  torso.add(chest);
  if (armor) {
    const trim = box(0.44, 0.08, 0.26, 0xd9b45b);
    trim.position.y = 0.16;
    torso.add(trim);
  }
  if (cloak) {
    const ck = box(0.5, 0.85, 0.06, cloak);
    ck.position.set(0, -0.22, -0.17);
    torso.add(ck);
  }
  g.add(torso);

  // hips / skirt
  if (dress) {
    const skirt = cyl(0.2, 0.34, 0.85, tunic);
    skirt.position.y = 0.62;
    g.add(skirt);
  } else {
    const hips = box(0.38, 0.22, 0.22, tunic);
    hips.position.y = 0.98;
    g.add(hips);
  }

  // head
  const headG = new THREE.Group();
  headG.position.y = 1.68;
  const head = sph(0.15, skin, 12);
  headG.add(head);
  const hairCap = sph(0.155, hair, 10);
  hairCap.scale.set(1, 0.75, 1);
  hairCap.position.y = 0.05;
  headG.add(hairCap);
  if (female) {
    const bun = sph(0.09, hair, 8);
    bun.position.set(0, 0.05, -0.13);
    headG.add(bun);
  }
  if (beard) {
    const b = box(0.16, 0.14, 0.1, hair);
    b.position.set(0, -0.1, 0.08);
    headG.add(b);
  }
  g.add(headG);

  // arms (pivot at shoulder)
  const mkArm = side => {
    const p = new THREE.Group();
    p.position.set(0.27 * side, 1.52, 0);
    const upper = box(0.11, 0.55, 0.11, skin);
    upper.position.y = -0.26;
    p.add(upper);
    const hand = sph(0.065, skin, 6);
    hand.position.y = -0.56;
    p.add(hand);
    g.add(p);
    return p;
  };
  const lArm = mkArm(-1), rArm = mkArm(1);

  // legs (pivot at hip); hidden under dress but still animate
  const mkLeg = side => {
    const p = new THREE.Group();
    p.position.set(0.12 * side, 0.92, 0);
    const leg = box(0.13, 0.9, 0.13, dress ? tunic : skin);
    leg.position.y = -0.45;
    p.add(leg);
    const foot = box(0.14, 0.08, 0.22, 0x6b4a2f);
    foot.position.set(0, -0.88, 0.04);
    p.add(foot);
    g.add(p);
    return p;
  };
  const lLeg = mkLeg(-1), rLeg = mkLeg(1);

  g.scale.setScalar(scale);
  g.userData.rig = { torso, head: headG, lArm, rArm, lLeg, rLeg };
  g.userData.animT = Math.random() * 10;
  g.userData.heightY = 1.85 * scale; // for labels
  return shadow(g);
}

// attach a prop into the right hand
export function giveProp(human, kind) {
  const rig = human.userData.rig;
  // clear old
  if (rig.prop) { rig.rArm.remove(rig.prop); rig.prop = null; }
  if (!kind) return;
  let p;
  if (kind === 'sword') {
    p = new THREE.Group();
    const blade = box(0.05, 0.75, 0.02, 0xcfd6dd);
    blade.position.y = 0.45;
    const hilt = box(0.16, 0.05, 0.05, 0x8a6d3b);
    hilt.position.y = 0.06;
    p.add(blade, hilt);
    p.position.set(0, -0.56, 0.1);
    p.rotation.x = Math.PI / 2.2;
  } else if (kind === 'staff') {
    p = cyl(0.03, 0.03, 1.7, 0x7a5a3a, 6);
    p.position.set(0, -0.45, 0);
  } else if (kind === 'spear') {
    p = new THREE.Group();
    const shaft = cyl(0.025, 0.025, 2.1, 0x7a5a3a, 6);
    const tip = cyl(0, 0.05, 0.25, 0xcfd6dd, 6);
    tip.position.y = 1.15;
    p.add(shaft, tip);
    p.position.set(0, -0.5, 0);
  } else if (kind === 'bow') {
    p = new THREE.Group();
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 6, 12, Math.PI), mat(0x6b4a2f));
    arc.rotation.z = Math.PI / 2;
    p.add(arc);
    p.position.set(0, -0.5, 0.05);
  } else if (kind === 'club') {
    p = cyl(0.16, 0.06, 1.6, 0x5d4327, 7);
    p.position.set(0, -0.9, 0.2);
    p.rotation.x = Math.PI / 2.4;
  } else if (kind === 'winecup') {
    p = cyl(0.09, 0.05, 0.14, 0x8a2f2f, 8);
    p.position.set(0, -0.56, 0.08);
  }
  if (p) { shadow(p); rig.rArm.add(p); rig.prop = p; }
}

// walk/idle animation. speed: 0 = idle
export function animateHumanoid(g, dt, speed) {
  const rig = g.userData.rig;
  if (!rig) return;
  g.userData.animT += dt * (speed > 0.1 ? 5 + speed * 0.8 : 1.2);
  const t = g.userData.animT;
  if (g.userData.pose === 'sleep' || g.userData.pose === 'dead') return;
  if (g.userData.pose === 'sit') {
    rig.lLeg.rotation.x = rig.rLeg.rotation.x = -Math.PI / 2.1;
    rig.lArm.rotation.x = rig.rArm.rotation.x = -0.5;
    return;
  }
  if (speed > 0.1) {
    const amp = Math.min(0.75, 0.3 + speed * 0.06);
    rig.lLeg.rotation.x = Math.sin(t) * amp;
    rig.rLeg.rotation.x = Math.sin(t + Math.PI) * amp;
    rig.lArm.rotation.x = Math.sin(t + Math.PI) * amp * 0.8;
    rig.rArm.rotation.x = rig.swinging ? rig.rArm.rotation.x : Math.sin(t) * amp * 0.8;
  } else {
    // idle breathing
    rig.lLeg.rotation.x = rig.rLeg.rotation.x = 0;
    rig.lArm.rotation.x = Math.sin(t * 0.7) * 0.05;
    if (!rig.swinging) rig.rArm.rotation.x = Math.sin(t * 0.7 + 1) * 0.05;
    rig.torso.position.y = 1.34 + Math.sin(t * 0.9) * 0.008;
  }
}

export function setPose(g, pose) {
  const rig = g.userData.rig;
  g.userData.pose = pose;
  if (!rig) return;
  if (pose === 'sleep' || pose === 'dead') {
    g.rotation.x = 0;
    g.rotation.z = pose === 'sleep' ? Math.PI / 2 : -Math.PI / 2;
    rig.lArm.rotation.x = rig.rArm.rotation.x = 0.3;
    rig.lLeg.rotation.x = rig.rLeg.rotation.x = 0.15;
  } else {
    g.rotation.z = 0;
    g.rotation.x = 0;
  }
}

// ---------------------------------------------------------------- cyclops
export function makeCyclops() {
  const g = makeHuman({ skin: 0x9a7f5a, tunic: 0x6e5a3f, hair: 0x3a2c1c, beard: true, scale: 4.6 });
  const rig = g.userData.rig;
  // replace eyes with one great eye
  const eye = sph(0.055, 0xffffff, 8);
  eye.position.set(0, 0.02, 0.135);
  const iris = sph(0.028, 0x3a6a2f, 6);
  iris.position.set(0, 0.02, 0.175);
  rig.head.add(eye, iris);
  rig.eye = eye; rig.iris = iris;
  giveProp(g, 'club');
  g.userData.heightY = 8.6;
  return g;
}
export function blindCyclops(g) {
  const rig = g.userData.rig;
  rig.eye.material.color.set(0x5a1010);
  rig.iris.visible = false;
}

// ---------------------------------------------------------------- animals
export function makeSheep(ram = false) {
  const g = new THREE.Group();
  const s = ram ? 1.25 : 1;
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45 * s, 1), mat(0xe8e3d6));
  body.scale.set(1.3, 1, 1);
  body.position.y = 0.62 * s;
  g.add(body);
  const head = box(0.22 * s, 0.22 * s, 0.28 * s, 0x2e2a26);
  head.position.set(0, 0.72 * s, 0.55 * s);
  g.add(head);
  for (const [x, z] of [[-0.2, 0.25], [0.2, 0.25], [-0.2, -0.25], [0.2, -0.25]]) {
    const leg = cyl(0.05 * s, 0.05 * s, 0.45 * s, 0x2e2a26, 5);
    leg.position.set(x * s, 0.22 * s, z * s);
    g.add(leg);
  }
  if (ram) {
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.045, 6, 10, Math.PI * 1.5), mat(0xb59a6a));
      horn.position.set(0.14 * side, 0.85, 0.5);
      horn.rotation.y = Math.PI / 2;
      g.add(horn);
    }
  }
  g.userData.heightY = 1.1 * s;
  g.userData.animal = true;
  return shadow(g);
}

export function makePig() {
  const g = new THREE.Group();
  const body = sph(0.38, 0xd98f8f, 8);
  body.scale.set(1.5, 1, 1.05);
  body.position.y = 0.42;
  body.rotation.y = Math.PI / 2;
  g.add(body);
  const snout = cyl(0.09, 0.11, 0.12, 0xc27676, 8);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, 0.45, 0.6);
  g.add(snout);
  for (const side of [-1, 1]) {
    const ear = box(0.1, 0.12, 0.03, 0xc27676);
    ear.position.set(0.14 * side, 0.66, 0.42);
    g.add(ear);
  }
  for (const [x, z] of [[-0.18, 0.3], [0.18, 0.3], [-0.18, -0.3], [0.18, -0.3]]) {
    const leg = cyl(0.05, 0.05, 0.3, 0xc27676, 5);
    leg.position.set(x, 0.15, z);
    g.add(leg);
  }
  g.userData.heightY = 0.9;
  g.userData.animal = true;
  return shadow(g);
}

export function makeDog() {
  const g = new THREE.Group();
  const body = box(0.7, 0.3, 0.28, 0x7a5a3a);
  body.position.y = 0.42;
  body.rotation.y = Math.PI / 2;
  g.add(body);
  const head = box(0.24, 0.22, 0.3, 0x6b4a2f);
  head.position.set(0, 0.62, 0.4);
  g.add(head);
  const tail = box(0.05, 0.05, 0.3, 0x6b4a2f);
  tail.position.set(0, 0.55, -0.45);
  tail.rotation.x = -0.6;
  g.add(tail);
  g.userData.tail = tail;
  for (const [x, z] of [[-0.1, 0.25], [0.1, 0.25], [-0.1, -0.25], [0.1, -0.25]]) {
    const leg = cyl(0.04, 0.04, 0.32, 0x6b4a2f, 5);
    leg.position.set(x, 0.16, z);
    g.add(leg);
  }
  g.userData.heightY = 0.9;
  g.userData.animal = true;
  return shadow(g);
}

export function makeSiren() {
  const g = makeHuman({ skin: 0xd8b090, tunic: 0x8fa8b8, hair: 0x1c1c28, female: true, dress: true, scale: 0.95 });
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.3, 4), mat(0xb9c8d4));
    wing.position.set(0.4 * side, 1.35, -0.15);
    wing.rotation.z = side * 2.3;
    g.add(wing);
  }
  return g;
}

// named character presets ------------------------------------------------
export const PRESETS = {
  odysseus:   () => { const h = makeHuman({ skin: 0xc08a5a, tunic: 0x8c2f2f, hair: 0x3a2c1c, beard: true, armor: true, cloak: 0x5a1f1f }); giveProp(h, 'sword'); return h; },
  eurylochus: () => { const h = makeHuman({ skin: 0xb98a60, tunic: 0x5a6a7a, hair: 0x1c1410, beard: true }); giveProp(h, 'spear'); return h; },
  polites:    () => makeHuman({ skin: 0xc9976a, tunic: 0x6a7a5a, hair: 0x2e2318 }),
  crew:       () => makeHuman({ skin: 0xb98a60, tunic: 0x707a6a, hair: 0x241a12, beard: true }),
  hermes:     () => { const h = makeHuman({ skin: 0xe0c090, tunic: 0xf0ead8, hair: 0xd9b45b, cloak: 0xf0ead8 }); giveProp(h, 'staff'); return h; },
  circe:      () => { const h = makeHuman({ skin: 0xe0c090, tunic: 0x7a3a6a, hair: 0x8a3a1c, female: true, dress: true }); giveProp(h, 'staff'); return h; },
  athena:     () => { const h = makeHuman({ skin: 0xe8d0a8, tunic: 0xd9d9e8, hair: 0x4a3a1c, female: true, dress: true, armor: true }); giveProp(h, 'spear'); return h; },
  eumaeus:    () => { const h = makeHuman({ skin: 0xb07a4a, tunic: 0x7a6a4a, hair: 0x5a5048, beard: true }); giveProp(h, 'staff'); return h; },
  telemachus: () => { const h = makeHuman({ skin: 0xc9976a, tunic: 0x3a5a7a, hair: 0x3a2c1c }); giveProp(h, 'spear'); return h; },
  penelope:   () => makeHuman({ skin: 0xe0c090, tunic: 0x4a3a6a, hair: 0x2e2318, female: true, dress: true }),
  eurycleia:  () => makeHuman({ skin: 0xd0a880, tunic: 0x6a6258, hair: 0xcfc8ba, female: true, dress: true }),
  antinous:   () => { const h = makeHuman({ skin: 0xc9976a, tunic: 0xb8862f, hair: 0x1c1410, cloak: 0x8a6d3b }); giveProp(h, 'winecup'); return h; },
  eurymachus: () => makeHuman({ skin: 0xc9976a, tunic: 0x8a4a2f, hair: 0x2e1c10 }),
  suitor:     () => makeHuman({ skin: 0xc9976a, tunic: 0x9a8a5a, hair: 0x241a12 }),
};
