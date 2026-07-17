import * as THREE from 'three';
import { G } from './state.js';
import { groundHeight } from './world.js';
import { animateHumanoid, setPose, giveProp } from './characters.js';
import { angleLerp, dist2d, clamp } from './util.js';
import { sfx } from './sound.js';
import { addLabel, removeLabel } from './ui.js';

// ---------------------------------------------------------------- enemies
export class Enemy {
  constructor({ name, model, x, z, hp = 45, dmg = 9, aggro = 22, speed = 4.2 }) {
    this.name = name;
    this.group = model;
    this.hp = hp; this.maxhp = hp;
    this.dmg = dmg; this.aggro = aggro; this.speed = speed;
    this.heading = 0;
    this.attackT = 0;      // wind-up timer
    this.cooldown = 1 + Math.random();
    this.dead = false;
    this.staggerT = 0;
    giveProp(model, 'sword');
    model.position.set(x, groundHeight(x, z), z);
    G.scene.add(model);
    G.enemies.push(this);
    this.tag = addLabel('nametag', () => {
      const p = this.group.position;
      return this.dead ? null : { x: p.x, y: p.y + 2.1, z: p.z };
    }, name);
  }

  damage(n, fromDir) {
    if (this.dead) return;
    this.hp -= n;
    this.staggerT = 0.25;
    sfx('hit');
    if (fromDir) {
      this.group.position.x += fromDir.x * 0.6;
      this.group.position.z += fromDir.z * 0.6;
    }
    if (this.hp <= 0) this.die();
  }

  die() {
    this.dead = true;
    setPose(this.group, 'dead');
    this.group.position.y = groundHeight(this.group.position.x, this.group.position.z) + 0.3;
    if (this.tag) { removeLabel(this.tag); this.tag = null; }
    if (G.onEnemyDeath) G.onEnemyDeath(this);
  }

  update(dt) {
    if (this.dead) return;
    const p = this.group.position;
    const pl = G.player.group.position;
    const d = dist2d(p.x, p.z, pl.x, pl.z);
    let moveSpeed = 0;

    if (this.staggerT > 0) { this.staggerT -= dt; }
    else if (this.attackT > 0) {
      this.attackT -= dt;
      const rig = this.group.userData.rig;
      rig.swinging = true;
      rig.rArm.rotation.x = -2.2 + (1 - this.attackT / 0.55) * 2.6;
      if (this.attackT <= 0) {
        rig.swinging = false;
        if (dist2d(p.x, p.z, pl.x, pl.z) < 2.6 && G.player.hp > 0) G.player.damage(this.dmg);
        this.cooldown = 1.1 + Math.random() * 0.8;
      }
    } else if (d < this.aggro && G.player.hp > 0) {
      const want = Math.atan2(pl.x - p.x, pl.z - p.z);
      this.heading = angleLerp(this.heading, want, Math.min(1, dt * 8));
      this.group.rotation.y = this.heading;
      if (d > 2.0) {
        moveSpeed = this.speed;
        const nx = p.x + Math.sin(this.heading) * moveSpeed * dt;
        const nz = p.z + Math.cos(this.heading) * moveSpeed * dt;
        // avoid stacking on other enemies
        let ok = true;
        for (const e of G.enemies) {
          if (e !== this && !e.dead && dist2d(nx, nz, e.group.position.x, e.group.position.z) < 1.1) { ok = false; break; }
        }
        if (ok && groundHeight(nx, nz) > -0.6) { p.x = nx; p.z = nz; }
      } else {
        this.cooldown -= dt;
        if (this.cooldown <= 0) { this.attackT = 0.55; sfx('swing'); }
      }
    }
    p.y = Math.max(groundHeight(p.x, p.z), -0.5);
    animateHumanoid(this.group, dt, moveSpeed);
  }

  remove() {
    G.scene.remove(this.group);
    if (this.tag) removeLabel(this.tag);
    const i = G.enemies.indexOf(this);
    if (i >= 0) G.enemies.splice(i, 1);
  }
}

export function clearEnemies() { [...G.enemies].forEach(e => e.remove()); }

// ---------------------------------------------------------------- ally (Telemachus in the fight)
export class Ally {
  constructor(npc) {
    this.npc = npc;
    this.cooldown = 1;
    npc.fixed = true;
  }
  update(dt) {
    const g = this.npc.group, p = g.position;
    let best = null, bd = 1e9;
    for (const e of G.enemies) {
      if (e.dead) continue;
      const d = dist2d(p.x, p.z, e.group.position.x, e.group.position.z);
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) { animateHumanoid(g, dt, 0); return; }
    const t = best.group.position;
    const want = Math.atan2(t.x - p.x, t.z - p.z);
    this.npc.heading = angleLerp(this.npc.heading, want, Math.min(1, dt * 7));
    g.rotation.y = this.npc.heading;
    let sp = 0;
    if (bd > 2.2) {
      sp = 4.6;
      p.x += Math.sin(this.npc.heading) * sp * dt;
      p.z += Math.cos(this.npc.heading) * sp * dt;
      p.y = groundHeight(p.x, p.z);
    } else {
      this.cooldown -= dt;
      if (this.cooldown <= 0) {
        this.cooldown = 1.8;
        sfx('swing');
        best.damage(8, { x: Math.sin(this.npc.heading), z: Math.cos(this.npc.heading) });
      }
    }
    animateHumanoid(g, dt, sp);
  }
}

// ---------------------------------------------------------------- player melee
export function playerAttack() {
  const pl = G.player;
  if (pl.attackT > 0 || pl.hp <= 0) return;
  pl.attackT = 0.32;
  sfx('swing');
  const p = pl.group.position;
  for (const e of G.enemies) {
    if (e.dead) continue;
    const ep = e.group.position;
    const d = dist2d(p.x, p.z, ep.x, ep.z);
    if (d > 3.1) continue;
    const ang = Math.atan2(ep.x - p.x, ep.z - p.z);
    let diff = Math.abs(ang - pl.heading) % (Math.PI * 2);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff < 1.2) {
      e.damage(16 + Math.random() * 10, { x: Math.sin(ang), z: Math.cos(ang) });
    }
  }
}

// ---------------------------------------------------------------- arrows
export function shootArrow() {
  sfx('bow');
  const dir = new THREE.Vector3();
  G.camera.getWorldDirection(dir);
  const p = G.player.group.position;
  // divine aim assist for the contest of the bow: if aiming close enough
  // to the axe line, the arrow flies true along it
  if (G.aimAssist) {
    const a = G.aimAssist;
    const want = new THREE.Vector3(a.dir.x, a.dir.y, a.dir.z).normalize();
    if (dir.angleTo(want) < a.cone) {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.9, 5),
        new THREE.MeshBasicMaterial({ color: 0xdcc9a0 })
      );
      mesh.position.set(a.origin.x, a.origin.y, a.origin.z);
      G.scene.add(mesh);
      const arrow = { mesh, vel: want.multiplyScalar(55), life: 3, passes: 0 };
      G.arrows.push(arrow);
      return arrow;
    }
  }
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.9, 5),
    new THREE.MeshBasicMaterial({ color: 0xdcc9a0 })
  );
  const pos = new THREE.Vector3(p.x, p.y + 1.5, p.z).addScaledVector(dir, 1.2);
  mesh.position.copy(pos);
  G.scene.add(mesh);
  const arrow = {
    mesh,
    vel: dir.clone().multiplyScalar(46),
    life: 4,
    passes: 0,
  };
  G.arrows.push(arrow);
  return arrow;
}

export function updateArrows(dt) {
  for (let i = G.arrows.length - 1; i >= 0; i--) {
    const a = G.arrows[i];
    const prev = a.mesh.position.clone();
    a.vel.y -= (G.axeChallenge ? 0 : 4.5) * dt;
    a.mesh.position.addScaledVector(a.vel, dt);
    a.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), a.vel.clone().normalize());
    a.life -= dt;
    const p = a.mesh.position;

    // axe-ring challenge: count ring passes
    if (G.axeChallenge) {
      for (const ring of G.axeChallenge.rings) {
        if (ring.hit) continue;
        if ((prev.x - ring.x) * (p.x - ring.x) <= 0 && prev.x !== p.x) {
          const t = (ring.x - prev.x) / (p.x - prev.x);
          const iy = prev.y + (p.y - prev.y) * t;
          const iz = prev.z + (p.z - prev.z) * t;
          if (Math.hypot(iy - ring.y, iz - ring.z) < 0.26) { ring.hit = true; a.passes++; }
        }
      }
    }

    // hit enemies
    for (const e of G.enemies) {
      if (e.dead) continue;
      const ep = e.group.position;
      if (p.distanceTo(new THREE.Vector3(ep.x, ep.y + 1.2, ep.z)) < 1.0) {
        e.damage(45, null);
        a.life = 0;
      }
    }

    const done = a.life <= 0 || p.y < groundHeight(p.x, p.z);
    if (done) {
      if (G.axeChallenge && !a.reported) {
        a.reported = true;
        const n = a.passes;
        G.axeChallenge.rings.forEach(r => (r.hit = false));
        G.axeChallenge.onResult(n);
      }
      G.scene.remove(a.mesh);
      G.arrows.splice(i, 1);
    }
  }
}
