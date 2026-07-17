import * as THREE from 'three';
import { G } from './state.js';
import { n2, mulberry32, smoothstep, lerp, dist2d } from './util.js';
import { makeHuman, makeSiren, animateHumanoid } from './characters.js';

// ------------------------------------------------------------- islands
export const ISLANDS = [
  { name: 'Cyclops', x: 0, z: 0, r: 95, h: 9, bump: 2.0, f: 0.9, seed: 11, sand: 0xd8c496, grass: 0x7a8a52, rock: 0x8a8578 },
  { name: 'Aeaea', x: 520, z: -180, r: 85, h: 8, bump: 1.6, f: 1.1, seed: 37, sand: 0xdcc9a0, grass: 0x4a7a3f, rock: 0x7a7a6a },
  { name: 'Ithaca', x: 1050, z: 380, r: 130, h: 11, bump: 2.2, f: 0.8, seed: 73, sand: 0xdfcfa2, grass: 0x8a9a5a, rock: 0x92866f },
];

// flattened building sites blended into the terrain
const FLATS = [
  { x: 28, z: -32, r: 16, y: 4.2 },    // cyclops cave
  { x: -30, z: 30, r: 18, y: 2.2 },    // cyclops meadow
  { x: 535, z: -195, r: 15, y: 5.0 },  // circe's house
  { x: 470, z: -150, r: 12, y: 1.8 },  // aeaea landing
  { x: 990, z: 430, r: 13, y: 4.0 },   // eumaeus hut
  { x: 1075, z: 350, r: 26, y: 7.0 },  // palace
  { x: 1040, z: 365, r: 12, y: 5.5 },  // palace approach
  { x: 950, z: 370, r: 12, y: 1.6 },   // ithaca landing
];

export const LOC = {
  start:        { x: -55, z: 58 },
  cycShip:      { x: -70, z: 72 },
  cave:         { x: 28, z: -32 },
  meadow:       { x: -30, z: 30 },
  aeaeaBeach:   { x: 468, z: -148 },
  aeaeaShip:    { x: 448, z: -128 },
  circeHouse:   { x: 535, z: -195 },
  hermesSpot:   { x: 505, z: -172 },
  sirenStrait:  { x: 785, z: 100 },
  ithacaBeach:  { x: 952, z: 372 },
  ithacaShip:   { x: 930, z: 358 },
  hut:          { x: 990, z: 430 },
  palace:       { x: 1075, z: 350 },
  palaceDoor:   { x: 1075, z: 363 },
  argosSpot:    { x: 1048, z: 364 },
};

export function groundHeight(x, z) {
  let h = -3.0;
  for (const isl of ISLANDS) {
    const d = dist2d(x, z, isl.x, isl.z) / isl.r;
    if (d > 1.2) continue;
    const fall = Math.max(0, 1 - d * d);
    const hh = -2.4 + fall * (isl.h + isl.bump * n2(x * isl.f * 0.5 + isl.seed, z * isl.f * 0.5 + isl.seed));
    if (hh > h) h = hh;
  }
  for (const f of FLATS) {
    const d = dist2d(x, z, f.x, f.z);
    if (d < f.r * 1.6) {
      const t = smoothstep(f.r * 1.6, f.r * 0.7, d);
      h = lerp(h, f.y, t);
    }
  }
  return h;
}

export function waveY(x, z, t) {
  return Math.sin(x * 0.08 + t * 1.2) * 0.28 +
         Math.sin(z * 0.07 + t * 0.9) * 0.22 +
         Math.sin((x + z) * 0.045 + t * 0.55) * 0.18;
}

// ------------------------------------------------------------- helpers
const lamb = c => new THREE.MeshLambertMaterial({ color: c });
const box = (w, h, d, c) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lamb(c));
const cylm = (rt, rb, h, c, seg = 8) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), lamb(c));

function circleCollider(x, z, r) { G.colliders.push({ x, z, r }); }
function wallColliders(x1, z1, x2, z2, r = 0.9) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const n = Math.max(2, Math.ceil(len / (r * 1.4)));
  for (let i = 0; i <= n; i++) {
    circleCollider(lerp(x1, x2, i / n), lerp(z1, z2, i / n), r);
  }
}

function olive(rng) {
  const g = new THREE.Group();
  const trunk = cylm(0.14, 0.24, 1.6, 0x6b5236, 6);
  trunk.position.y = 0.8;
  trunk.rotation.z = (rng() - 0.5) * 0.3;
  g.add(trunk);
  for (let i = 0; i < 3; i++) {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7 + rng() * 0.5, 1), lamb(0x5d7a45));
    blob.position.set((rng() - 0.5) * 1.4, 1.8 + rng() * 0.8, (rng() - 0.5) * 1.4);
    g.add(blob);
  }
  return g;
}
function cypress() {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.6, 7), lamb(0x3a5a34));
  c.position.y = 2.2;
  const t = cylm(0.1, 0.14, 0.9, 0x5d4327, 5);
  t.position.y = 0.45;
  g.add(c, t);
  return g;
}
function rock(rng, s = 1) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6 * s + rng() * 0.7 * s, 0), lamb(0x8a8578));
  m.rotation.set(rng() * 3, rng() * 3, rng() * 3);
  return m;
}

// ------------------------------------------------------------- build
export function buildWorld(scene) {
  // light & sky
  scene.background = new THREE.Color(0x9cc4dd);
  scene.fog = new THREE.Fog(0x9cc4dd, 80, 780);
  const hemi = new THREE.HemisphereLight(0xcfe4f0, 0x4a5a3f, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -80;
  sun.shadow.camera.right = sun.shadow.camera.top = 80;
  sun.shadow.camera.far = 400;
  sun.shadow.bias = -0.0015;
  scene.add(sun, sun.target);

  // sun disc
  const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(14, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff0c0, fog: false }));
  scene.add(sunDisc);

  // ---------------- water
  const wgeo = new THREE.PlaneGeometry(3400, 3400, 150, 150);
  wgeo.rotateX(-Math.PI / 2);
  wgeo.translate(525, 0, 100);
  const wmat = new THREE.MeshPhongMaterial({
    color: 0x1e5a7a, shininess: 90, specular: 0x88bbdd,
    transparent: true, opacity: 0.92, flatShading: true,
  });
  const waterUniforms = { uTime: { value: 0 } };
  wmat.onBeforeCompile = sh => {
    sh.uniforms.uTime = waterUniforms.uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       transformed.y += sin(position.x * 0.08 + uTime * 1.2) * 0.28
                      + sin(position.z * 0.07 + uTime * 0.9) * 0.22
                      + sin((position.x + position.z) * 0.045 + uTime * 0.55) * 0.18;`
    );
  };
  const water = new THREE.Mesh(wgeo, wmat);
  scene.add(water);

  // ---------------- island terrain
  for (const isl of ISLANDS) {
    const res = 88, ext = isl.r * 1.22;
    const geo = new THREE.PlaneGeometry(ext * 2, ext * 2, res, res);
    geo.rotateX(-Math.PI / 2);
    geo.translate(isl.x, 0, isl.z);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cSand = new THREE.Color(isl.sand), cGrass = new THREE.Color(isl.grass),
          cRock = new THREE.Color(isl.rock), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = groundHeight(x, z);
      pos.setY(i, h);
      if (h < 0.9) tmp.copy(cSand);
      else if (h < 2) tmp.copy(cSand).lerp(cGrass, (h - 0.9) / 1.1);
      else if (h < 7.5) tmp.copy(cGrass).lerp(cRock, Math.max(0, (h - 4.5) / 3));
      else tmp.copy(cRock);
      tmp.offsetHSL(0, 0, (n2(x * 3.1, z * 3.1)) * 0.015);
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    mesh.receiveShadow = true;
    scene.add(mesh);

    // vegetation
    const rng = mulberry32(isl.seed * 999);
    let placed = 0, tries = 0;
    while (placed < 42 && tries < 400) {
      tries++;
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * isl.r * 0.85;
      const x = isl.x + Math.cos(a) * d, z = isl.z + Math.sin(a) * d;
      const h = groundHeight(x, z);
      if (h < 1.6) continue;
      if (FLATS.some(f => dist2d(x, z, f.x, f.z) < f.r + 4)) continue;
      let obj;
      const roll = rng();
      if (roll < 0.45) obj = olive(rng);
      else if (roll < 0.7) obj = cypress();
      else obj = rock(rng, 1 + rng());
      obj.position.set(x, h - 0.1, z);
      obj.traverse(m => { if (m.isMesh) m.castShadow = true; });
      scene.add(obj);
      if (roll >= 0.7) circleCollider(x, z, 1.1);
      else circleCollider(x, z, 0.5);
      placed++;
    }
  }

  // ---------------- cyclops cave (hollow dome with an entrance gap)
  const caveApi = buildCave(scene);

  // ---------------- circe's house
  buildCirceHouse(scene);

  // ---------------- eumaeus hut
  buildHut(scene);

  // ---------------- palace of ithaca
  const palaceApi = buildPalace(scene);

  // ---------------- siren rocks
  const sirens = buildSirens(scene);

  // ---------------- the ship
  const ship = buildShip(scene);

  // ---------------- objective beacon
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 320, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd77a, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })
  );
  beacon.visible = false;
  scene.add(beacon);

  // objective marker diamond (near-range)
  const markerMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.45),
    new THREE.MeshBasicMaterial({ color: 0xffd77a, fog: false }));
  markerMesh.visible = false;
  scene.add(markerMesh);

  const api = {
    ship, sirens, ...caveApi, ...palaceApi,
    setBeacon(x, z) { beacon.visible = true; beacon.position.set(x, 0, z); },
    clearBeacon() { beacon.visible = false; },
    update(dt) {
      const t = G.time;
      waterUniforms.uTime.value = t;
      // sun follows player so shadows stay crisp
      const p = G.player ? G.player.group.position : { x: 0, z: 0 };
      sun.position.set(p.x + 60, 110, p.z + 40);
      sun.target.position.set(p.x, 0, p.z);
      sunDisc.position.set(G.camera.position.x + 400, 260, G.camera.position.z + 260);
      // marker
      if (G.marker) {
        markerMesh.visible = true;
        const my = Math.max(groundHeight(G.marker.x, G.marker.z), 0) + 2.6 + Math.sin(t * 2.5) * 0.25;
        markerMesh.position.set(G.marker.x, my, G.marker.z);
        markerMesh.rotation.y = t * 1.5;
      } else markerMesh.visible = false;
      beacon.material.opacity = 0.22 + Math.sin(t * 2) * 0.08;
      // ship bob when idle
      if (!ship.sailing) {
        ship.group.position.y = waveY(ship.group.position.x, ship.group.position.z, t) * 0.4 - 0.1;
        ship.group.rotation.z = Math.sin(t * 0.7) * 0.02;
      }
      ship.crewFigs.forEach(c => animateHumanoid(c, dt, 0));
      // sirens sway and sing
      sirens.figs.forEach((s, i) => {
        const r = s.userData.rig;
        r.lArm.rotation.z = 0.9 + Math.sin(t * 1.3 + i) * 0.25;
        r.rArm.rotation.z = -0.9 - Math.sin(t * 1.3 + i + 1) * 0.25;
        r.head.rotation.x = Math.sin(t * 0.9 + i) * 0.15 - 0.1;
      });
    },
  };
  return api;
}

// ------------------------------------------------------------- cave
function buildCave(scene) {
  const C = LOC.cave, floorY = 4.2, R = 14;
  const gapDir = Math.atan2(LOC.start.z - C.z, LOC.start.x - C.x); // entrance faces the beach
  const phiLen = Math.PI * 1.72;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(R, 20, 12, 0, phiLen, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0x6e675c, side: THREE.DoubleSide, flatShading: true })
  );
  // local gap centre direction (see three.js sphere param: x=-cos(phi)sin(theta), z=sin(phi)sin(theta))
  const gapPhi = phiLen + (Math.PI * 2 - phiLen) / 2;
  const localGapAngle = Math.atan2(Math.sin(gapPhi), -Math.cos(gapPhi));
  dome.rotation.y = localGapAngle - gapDir;
  dome.position.set(C.x, floorY, C.z);
  scene.add(dome);

  // wall colliders around dome except at the gap
  for (let a = 0; a < Math.PI * 2; a += 0.24) {
    let dd = Math.abs(a - ((gapDir % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
    if (dd > Math.PI) dd = Math.PI * 2 - dd;
    if (dd < 0.5) continue;
    circleCollider(C.x + Math.cos(a) * (R - 0.5), C.z + Math.sin(a) * (R - 0.5), 1.7);
  }

  // fire pit + light inside
  const fire = new THREE.Group();
  fire.position.set(C.x - 3, floorY, C.z + 2);
  const pit = cylm(1.1, 1.3, 0.4, 0x4a4038, 10);
  pit.position.y = 0.2;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.3, 7),
    new THREE.MeshBasicMaterial({ color: 0xff8c33 }));
  flame.position.y = 1.0;
  const fl = new THREE.PointLight(0xff9944, 1.6, 26, 1.6);
  fl.position.y = 2;
  fire.add(pit, flame, fl);
  fire.userData.flame = flame;
  scene.add(fire);

  // the olive stake
  const stake = new THREE.Group();
  const pole = cylm(0.09, 0.13, 3.2, 0x7a5a3a, 7);
  pole.rotation.z = Math.PI / 2.3;
  pole.position.y = 0.5;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.4, 7), lamb(0xcc6622));
  tip.rotation.z = Math.PI / 2.3;
  tip.position.set(1.45, 1.15, 0);
  stake.add(pole, tip);
  stake.position.set(C.x + 4, floorY, C.z + 4);
  scene.add(stake);

  // boulder (sealed / rolled aside)
  const entrX = C.x + Math.cos(gapDir) * (R - 1), entrZ = C.z + Math.sin(gapDir) * (R - 1);
  const boulder = new THREE.Mesh(new THREE.IcosahedronGeometry(4.4, 1), lamb(0x7a7268));
  boulder.castShadow = true;
  scene.add(boulder);
  const boulderCol = { x: entrX, z: entrZ, r: 3.9 };
  const asideX = C.x + Math.cos(gapDir + 0.7) * (R + 4), asideZ = C.z + Math.sin(gapDir + 0.7) * (R + 4);

  function setBoulder(state) { // 'open' | 'sealed' | 'aside'
    const i = G.colliders.indexOf(boulderCol);
    if (state === 'sealed') {
      boulder.position.set(entrX, floorY + 2.2, entrZ);
      boulder.visible = true;
      if (i < 0) G.colliders.push(boulderCol);
    } else {
      if (i >= 0) G.colliders.splice(i, 1);
      boulder.visible = state === 'aside';
      boulder.position.set(asideX, groundHeight(asideX, asideZ) + 2.2, asideZ);
    }
  }
  setBoulder('open');

  LOC.caveEntrance = { x: C.x + Math.cos(gapDir) * (R + 3), z: C.z + Math.sin(gapDir) * (R + 3) };
  LOC.caveInside = { x: C.x - Math.cos(gapDir) * 5, z: C.z - Math.sin(gapDir) * 5 };
  LOC.stake = { x: C.x + 4, z: C.z + 4 };
  LOC.caveFire = { x: C.x - 3, z: C.z + 2 };
  return { setBoulder, stake, caveFire: fire };
}

// ------------------------------------------------------------- circe
function buildCirceHouse(scene) {
  const P = LOC.circeHouse, y = 5.0;
  const g = new THREE.Group();
  const base = box(12, 0.8, 9, 0xcfc8ba);
  base.position.y = 0.4;
  g.add(base);
  for (const [cx, cz] of [[-5, -3.5], [5, -3.5], [-5, 3.5], [5, 3.5], [0, 3.5], [0, -3.5]]) {
    const col = cylm(0.35, 0.42, 4.2, 0xe3dccb, 9);
    col.position.set(cx, 2.9, cz);
    g.add(col);
  }
  const roof = box(13.5, 0.7, 10.5, 0xb8a888);
  roof.position.y = 5.3;
  g.add(roof);
  const ped = box(13.8, 0.5, 2, 0xb8a888);
  ped.position.y = 5.9;
  g.add(ped);
  // inner cella
  const cella = box(7, 3.6, 5.5, 0xd8d0c0);
  cella.position.set(0, 2.2, -0.5);
  g.add(cella);
  // loom hint: colored hanging cloth
  const cloth = box(2.2, 2.4, 0.1, 0x7a3a6a);
  cloth.position.set(0, 2.2, 2.35);
  g.add(cloth);
  g.position.set(P.x, y - 0.76, P.z); // platform top a hair above the terrain (avoids z-fighting)
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  scene.add(g);
  circleCollider(P.x, P.z - 0.5, 4.6); // cella block
  LOC.circeFront = { x: P.x, z: P.z + 8 };
}

// ------------------------------------------------------------- eumaeus hut
function buildHut(scene) {
  const P = LOC.hut, y = 4.0;
  const g = new THREE.Group();
  const walls = box(6, 2.6, 5, 0x8a7355);
  walls.position.y = 1.3;
  g.add(walls);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(4.8, 2.2, 4), lamb(0xa8905e));
  roof.position.y = 3.6;
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  g.position.set(P.x, y, P.z);
  g.traverse(m => { if (m.isMesh) m.castShadow = true; });
  scene.add(g);
  circleCollider(P.x, P.z, 3.4);
  // pig pen fence
  const fenceR = 5;
  for (let a = 0; a < Math.PI * 2; a += 0.5) {
    const px = P.x + 9 + Math.cos(a) * fenceR, pz = P.z + 2 + Math.sin(a) * fenceR;
    const post = cylm(0.08, 0.08, 1.1, 0x6b5236, 5);
    post.position.set(px, groundHeight(px, pz) + 0.5, pz);
    scene.add(post);
  }
  LOC.hutFront = { x: P.x, z: P.z + 4.5 };
  LOC.pigPen = { x: P.x + 9, z: P.z + 2 };
}

// ------------------------------------------------------------- palace
function buildPalace(scene) {
  const P = LOC.palace, y = 7.0;
  const g = new THREE.Group();
  const plat = box(36, 1.2, 26, 0xcfc4ac);
  plat.position.y = 0.1;
  g.add(plat);
  // steps toward door (front = +z)
  for (let i = 0; i < 3; i++) {
    const st = box(10, 0.4, 1.4, 0xc4b89e);
    st.position.set(0, -0.3 - i * 0.4, 13.6 + i * 1.3);
    g.add(st);
  }
  // walls: back, left, right, front-with-door
  const wallMat = 0xdad0b8;
  const back = box(34, 6, 1, wallMat); back.position.set(0, 3.5, -12); g.add(back);
  const left = box(1, 6, 24, wallMat); left.position.set(-16.5, 3.5, 0); g.add(left);
  const right = box(1, 6, 24, wallMat); right.position.set(16.5, 3.5, 0); g.add(right);
  const frontL = box(13, 6, 1, wallMat); frontL.position.set(-10, 3.5, 12); g.add(frontL);
  const frontR = box(13, 6, 1, wallMat); frontR.position.set(10, 3.5, 12); g.add(frontR);
  const lintel = box(8, 1.4, 1.2, 0xb8a888); lintel.position.set(0, 6.0, 12); g.add(lintel);
  // columns at door
  for (const s of [-1, 1]) {
    const col = cylm(0.5, 0.6, 6.2, 0xe3dccb, 10);
    col.position.set(3.6 * s, 3.5, 12.8);
    g.add(col);
  }
  const roof = box(38, 0.8, 28, 0xa89878);
  roof.position.y = 7.2;
  g.add(roof);
  const ped2 = box(38, 2.2, 1.2, 0xb8a888);
  ped2.position.set(0, 8.2, 13.8);
  g.add(ped2);

  // hearth
  const hearth = cylm(1.4, 1.6, 0.5, 0x5a5048, 10);
  hearth.position.set(0, 0.9, 2);
  g.add(hearth);
  const hflame = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.4, 7), new THREE.MeshBasicMaterial({ color: 0xff8c33 }));
  hflame.position.set(0, 1.8, 2);
  g.add(hflame);
  const hl = new THREE.PointLight(0xffa055, 1.8, 40, 1.4);
  hl.position.set(0, 4, 2);
  g.add(hl);
  const hl2 = new THREE.PointLight(0xffc088, 1.0, 30, 1.4);
  hl2.position.set(0, 4, -7);
  g.add(hl2);

  // throne
  const throne = new THREE.Group();
  const seat = box(1.4, 0.6, 1.2, 0x8a6d3b);
  seat.position.y = 0.9;
  const backr = box(1.4, 1.6, 0.25, 0x8a6d3b);
  backr.position.set(0, 1.9, -0.5);
  throne.add(seat, backr);
  throne.position.set(0, 0.6, -9.5);
  g.add(throne);

  // feast tables along the sides
  for (const s of [-1, 1]) {
    const table = box(3, 0.25, 14, 0x7a5a3a);
    table.position.set(9.5 * s, 1.5, 0);
    g.add(table);
    for (let zi = -6; zi <= 6; zi += 3) {
      const cup = cylm(0.12, 0.08, 0.22, 0x8a2f2f, 6);
      cup.position.set(9.5 * s + (zi % 2 ? 0.6 : -0.5), 1.75, zi);
      g.add(cup);
    }
  }

  g.position.set(P.x, y - 0.66, P.z); // platform top a hair above the terrain flat (avoids z-fighting)
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  scene.add(g);

  // colliders (world space)
  wallColliders(P.x - 17, P.z - 12, P.x + 17, P.z - 12);
  wallColliders(P.x - 16.5, P.z - 12, P.x - 16.5, P.z + 12);
  wallColliders(P.x + 16.5, P.z - 12, P.x + 16.5, P.z + 12);
  wallColliders(P.x - 16.5, P.z + 12, P.x - 3.4, P.z + 12);
  wallColliders(P.x + 3.4, P.z + 12, P.x + 16.5, P.z + 12);
  circleCollider(P.x, P.z + 2, 1.7);      // hearth
  circleCollider(P.x - 9.5, P.z, 1.6);    // tables (approx, center)
  circleCollider(P.x - 9.5, P.z - 5, 1.6);
  circleCollider(P.x - 9.5, P.z + 5, 1.6);
  circleCollider(P.x + 9.5, P.z, 1.6);
  circleCollider(P.x + 9.5, P.z - 5, 1.6);
  circleCollider(P.x + 9.5, P.z + 5, 1.6);

  // twelve axes (hidden until the contest)
  const axes = new THREE.Group();
  const axePos = [];
  for (let i = 0; i < 12; i++) {
    const ax = new THREE.Group();
    const post = cylm(0.06, 0.08, 1.2, 0x6b5236, 6);
    post.position.y = 0.6;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.045, 6, 14), lamb(0xb8b8c0));
    ring.position.y = 1.35;
    ring.rotation.y = Math.PI / 2;
    ax.add(post, ring);
    const wx = P.x - 8.25 + i * 1.5, wz = P.z - 5;
    ax.position.set(wx, y, wz);
    axes.add(ax);
    axePos.push({ x: wx, y: y + 1.35, z: wz });
  }
  axes.visible = false;
  scene.add(axes);

  // the great bow on a rack
  const rack = new THREE.Group();
  const rpost = cylm(0.08, 0.1, 1.6, 0x6b5236, 6);
  rpost.position.y = 0.8;
  const bowArc = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.05, 6, 14, Math.PI), lamb(0x8a6a3a));
  bowArc.position.y = 1.4;
  rack.add(rpost, bowArc);
  rack.position.set(P.x - 4, y, P.z - 9);
  scene.add(rack);

  LOC.hearth = { x: P.x, z: P.z + 2 };
  LOC.throne = { x: P.x, z: P.z - 9.5 };
  LOC.bowRack = { x: P.x - 4, z: P.z - 9 };
  LOC.axeShootFrom = { x: P.x - 8.25 - 6, z: P.z - 5 };
  LOC.palaceInside = { x: P.x, z: P.z + 6 };
  return {
    showAxes(v) { axes.visible = v; },
    hideBowRack() { rack.visible = false; },
    axePos,
  };
}

// ------------------------------------------------------------- sirens
function buildSirens(scene) {
  const S = LOC.sirenStrait;
  const figs = [];
  const rng = mulberry32(4242);
  const rocks = [
    [S.x - 30, S.z - 34], [S.x + 15, S.z + 38], [S.x + 55, S.z - 20],
    [S.x - 60, S.z + 15], [S.x + 90, S.z + 26], [S.x - 5, S.z - 5],
    [S.x + 40, S.z - 45], [S.x - 35, S.z + 45],
  ];
  const rockCols = [];
  for (const [rx, rz] of rocks) {
    const h = 5 + rng() * 6;
    const m = new THREE.Mesh(new THREE.ConeGeometry(3 + rng() * 2.5, h, 6), lamb(0x5f5a52));
    m.position.set(rx, h / 2 - 2.5, rz);
    m.rotation.y = rng() * 3;
    m.castShadow = true;
    scene.add(m);
    rockCols.push({ x: rx, z: rz, r: 4.5 });
  }
  // three sirens on the central rocks
  [[S.x - 30, S.z - 34], [S.x + 15, S.z + 38], [S.x - 5, S.z - 5]].forEach(([rx, rz], i) => {
    const s = makeSiren();
    s.position.set(rx, 3.4 + i * 0.8, rz);
    s.rotation.y = rng() * Math.PI * 2;
    scene.add(s);
    figs.push(s);
  });
  return { figs, rockCols, zone: { x: S.x, z: S.z, r: 105 } };
}

// ------------------------------------------------------------- ship
function buildShip(scene) {
  const g = new THREE.Group();
  // hull
  const hull = box(3.4, 1.5, 13, 0x7a5230);
  hull.position.y = 0.5;
  g.add(hull);
  const keelF = new THREE.Mesh(new THREE.ConeGeometry(1.2, 3.4, 4), lamb(0x7a5230));
  keelF.rotation.x = Math.PI / 2;
  keelF.rotation.y = Math.PI / 4;
  keelF.position.set(0, 0.55, 8.1);
  g.add(keelF);
  const stern = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.6, 4), lamb(0x7a5230));
  stern.rotation.x = -Math.PI / 2;
  stern.rotation.y = Math.PI / 4;
  stern.position.set(0, 0.7, -7.6);
  g.add(stern);
  // curled prow ornament
  const prow = cylm(0.15, 0.2, 2.4, 0x8a6d3b, 6);
  prow.position.set(0, 2, 8.6);
  prow.rotation.x = 0.4;
  g.add(prow);
  // deck
  const deck = box(3, 0.15, 12.6, 0x9a7248);
  deck.position.y = 1.3;
  g.add(deck);
  // gunwale strips with painted eye
  for (const s of [-1, 1]) {
    const rail = box(0.18, 0.5, 12.8, 0x5d3f24);
    rail.position.set(1.65 * s, 1.55, 0);
    g.add(rail);
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.3, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    eye.position.set(1.78 * s, 0.9, 6.4);
    eye.rotation.y = s * Math.PI / 2;
    g.add(eye);
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.13, 8), new THREE.MeshBasicMaterial({ color: 0x1a2a4a }));
    pupil.position.set(1.79 * s, 0.9, 6.5);
    pupil.rotation.y = s * Math.PI / 2;
    g.add(pupil);
  }
  // mast + yard + sail
  const mast = cylm(0.14, 0.18, 7.5, 0x6b4a2f, 8);
  mast.position.y = 4.8;
  g.add(mast);
  const yard = cylm(0.08, 0.08, 5.6, 0x6b4a2f, 6);
  yard.rotation.z = Math.PI / 2;
  yard.position.y = 7.6;
  g.add(yard);
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 4.4, 6, 4), new THREE.MeshLambertMaterial({ color: 0xe8dfc8, side: THREE.DoubleSide }));
  // slight belly
  const sp = sail.geometry.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i), yv = sp.getY(i);
    sp.setZ(i, Math.cos(x / 5.2 * Math.PI) * 0.001 + (1 - Math.abs(x) / 2.6) * (1 - Math.abs(yv) / 2.2) * -0.8);
  }
  sail.geometry.computeVertexNormals();
  sail.position.y = 5.3;
  g.add(sail);
  // red stripe on sail
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.6), new THREE.MeshLambertMaterial({ color: 0x8c2f2f, side: THREE.DoubleSide }));
  stripe.position.set(0, 5.3, -0.85);
  g.add(stripe);

  g.traverse(m => { if (m.isMesh) m.castShadow = true; });
  g.position.set(LOC.cycShip.x, 0, LOC.cycShip.z);
  g.rotation.y = Math.PI / 4;
  scene.add(g);

  const ship = {
    group: g, sail, mast,
    heading: Math.PI / 4, speed: 0, hp: 100, sailing: false,
    crewFigs: [],
    setCrew(n) {
      for (const c of ship.crewFigs) g.remove(c);
      ship.crewFigs = [];
      const rng = mulberry32(77);
      for (let i = 0; i < n; i++) {
        const c = makeHuman({ skin: 0xb98a60, tunic: [0x707a6a, 0x5a6a7a, 0x6a7a5a][i % 3], hair: 0x241a12, beard: rng() > 0.4 });
        c.position.set((i % 2 ? 0.9 : -0.9), 1.35, -4 + (i * 1.9) % 9);
        c.rotation.y = (i % 2 ? -1 : 1) * Math.PI / 2;
        g.add(c);
        ship.crewFigs.push(c);
      }
    },
  };
  return ship;
}
