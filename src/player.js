import * as THREE from 'three';
import { G } from './state.js';
import { keys, consumeMouseDelta } from './input.js';
import { groundHeight, waveY, LOC } from './world.js';
import { PRESETS, makeHuman, giveProp, animateHumanoid } from './characters.js';
import { clamp, lerp, angleLerp } from './util.js';
import { setHP, hurtVignette } from './ui.js';
import { sfx } from './sound.js';

export class Player {
  constructor(scene) {
    this.group = new THREE.Group();
    this.hero = PRESETS.odysseus();
    this.beggar = makeHuman({ skin: 0xc08a5a, tunic: 0x6a6258, hair: 0x8a8378, beard: true, cloak: 0x4a453c });
    giveProp(this.beggar, 'staff');
    this.beggar.visible = false;
    this.group.add(this.hero, this.beggar);
    this.model = this.hero;
    scene.add(this.group);

    this.hp = 100;
    this.maxhp = 100;
    this.yaw = Math.PI * 0.8;   // camera yaw
    this.pitch = 0.32;
    this.heading = 0;           // model facing
    this.speed = 0;
    this.hurtT = 0;
    this.attackT = 0;
    this.hiddenUnderRam = false;
    this.ramRef = null;
    this.weapon = 'sword';
    this.group.position.set(0, 0, 0);
  }

  setDisguise(on) {
    this.hero.visible = !on;
    this.beggar.visible = on;
    this.model = on ? this.beggar : this.hero;
  }
  setWeapon(kind) {
    this.weapon = kind;
    giveProp(this.hero, kind === 'none' ? null : kind);
  }

  teleport(x, z, face = 0) {
    this.group.position.set(x, groundHeight(x, z), z);
    this.heading = face;
    this.yaw = face + Math.PI; // camera behind
    this.group.rotation.y = face;
  }

  damage(n) {
    if (this.hp <= 0) return;
    this.hp -= n;
    this.hurtT = 0.5;
    sfx('hurt');
    setHP(this.hp / this.maxhp);
    if (this.hp <= 0 && G.onPlayerDeath) G.onPlayerDeath();
  }
  heal(n) {
    this.hp = Math.min(this.maxhp, this.hp + n);
    setHP(this.hp / this.maxhp);
  }

  update(dt) {
    const p = this.group.position;
    // mouse look (all modes except dialogue/cutscene keep camera control)
    if (G.mode === 'walk' || G.mode === 'sail' || G.mode === 'aim') {
      const d = consumeMouseDelta();
      this.yaw -= d.dx * 0.0032;
      this.pitch = clamp(this.pitch + d.dy * 0.0028, -0.35, 1.15);
    } else consumeMouseDelta();

    if (this.hurtT > 0) {
      this.hurtT -= dt;
      hurtVignette(clamp(this.hurtT * 1.6, 0, 0.85));
    } else hurtVignette(0);

    // slow regen out of danger
    if (this.hp > 0 && this.hp < this.maxhp && this.hurtT <= -3) this.heal(dt * 2);
    else if (this.hurtT <= 0) this.hurtT -= dt;

    if (G.mode === 'sail') { this.updateSail(dt); return; }

    // ---------- on-foot movement
    let mx = 0, mz = 0;
    if (G.mode === 'walk' || G.mode === 'aim') {
      if (keys.KeyW) mz += 1;
      if (keys.KeyS) mz -= 1;
      if (keys.KeyA) mx -= 1;
      if (keys.KeyD) mx += 1;
    }
    const moving = (mx || mz);
    let targetSpeed = 0;
    if (moving) {
      const run = keys.ShiftLeft || keys.ShiftRight;
      targetSpeed = G.mode === 'aim' ? 2.5 : (run ? 9.5 : 5.0);
      if (this.hiddenUnderRam) targetSpeed = 2.2;
      const ang = Math.atan2(mx, mz); // relative to camera forward
      const wish = this.yaw + Math.PI + ang; // camera looks toward -yaw dir; forward = yaw+PI
      this.heading = angleLerp(this.heading, wish, Math.min(1, dt * 10));
    }
    this.speed = lerp(this.speed, targetSpeed, Math.min(1, dt * 8));

    if (this.speed > 0.05) {
      const step = this.speed * dt;
      let nx = p.x + Math.sin(this.heading) * step;
      let nz = p.z + Math.cos(this.heading) * step;
      // colliders: push out
      for (const c of G.colliders) {
        const dx = nx - c.x, dz = nz - c.z;
        const d = Math.hypot(dx, dz);
        if (d < c.r && d > 0.001) {
          nx = c.x + dx / d * c.r;
          nz = c.z + dz / d * c.r;
        }
      }
      // don't walk into deep water
      const gh = groundHeight(nx, nz);
      if (gh > -1.15 || G.flags.allowSwim) { p.x = nx; p.z = nz; }
      else {
        // try sliding along shore
        const gx = groundHeight(nx, p.z), gz = groundHeight(p.x, nz);
        if (gx > -1.15) p.x = nx;
        else if (gz > -1.15) p.z = nz;
      }
    }
    p.y = Math.max(groundHeight(p.x, p.z), -1.2);

    // model orient + animate
    this.group.rotation.y = this.heading;
    animateHumanoid(this.model, dt, this.speed);
    if (this.attackT > 0) {
      this.attackT -= dt;
      const rig = this.model.userData.rig;
      rig.swinging = true;
      const k = 1 - this.attackT / 0.32;
      rig.rArm.rotation.x = -2.4 + k * 2.9;
    } else this.model.userData.rig.swinging = false;

    // ram-hiding: crouch the model
    this.model.position.y = this.hiddenUnderRam ? -0.75 : 0;
    this.model.rotation.x = this.hiddenUnderRam ? 0.9 : 0;
    if (this.hiddenUnderRam && this.ramRef) {
      this.ramRef.position.set(p.x, p.y + 0.55, p.z);
      this.ramRef.rotation.y = this.heading;
    }

    this.updateCamera(dt);
  }

  updateSail(dt) {
    const ship = G.ship;
    const g = ship.group;
    let turn = 0;
    if (G.flags.autopilot) {
      // lashed to the mast: the crew rows, the ship steers herself
      ship.speed = lerp(ship.speed, 11, dt * 0.5);
      ship.heading = angleLerp(ship.heading, G.autoHeading || ship.heading, dt * 0.7);
    } else {
      if (keys.KeyW) ship.speed = clamp(ship.speed + dt * 7, -4, 20);
      if (keys.KeyS) ship.speed = clamp(ship.speed - dt * 9, -4, 20);
      turn = (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0);
      ship.heading += turn * dt * (0.55 + Math.min(1, Math.abs(ship.speed) / 12) * 0.4);
      ship.speed *= (1 - dt * 0.08); // drag
    }

    let vx = Math.sin(ship.heading) * ship.speed * dt;
    let vz = Math.cos(ship.heading) * ship.speed * dt;
    // external current (sirens pull) set by story
    if (G.current) { vx += G.current.x * dt; vz += G.current.z * dt; }
    let nx = g.position.x + vx, nz = g.position.z + vz;

    // run aground?
    if (groundHeight(nx, nz) > -1.6) {
      ship.speed = 0;
      nx = g.position.x; nz = g.position.z;
    }
    // rocks
    if (G.world?.sirens) {
      for (const rc of G.world.sirens.rockCols) {
        const dx = nx - rc.x, dz = nz - rc.z, d = Math.hypot(dx, dz);
        if (d < rc.r + 2) {
          nx = rc.x + dx / d * (rc.r + 2);
          nz = rc.z + dz / d * (rc.r + 2);
          if (Math.abs(ship.speed) > 3 && G.onShipCrash) G.onShipCrash();
          ship.speed *= 0.3;
        }
      }
    }
    g.position.x = nx; g.position.z = nz;
    g.position.y = waveY(nx, nz, G.time) * 0.5 - 0.1;
    g.rotation.y = ship.heading;
    g.rotation.z = lerp(g.rotation.z, -turn * 0.08 + Math.sin(G.time * 0.8) * 0.02, dt * 3);
    g.rotation.x = Math.sin(G.time * 0.65) * 0.02;

    // player stands at the helm
    const hx = nx - Math.sin(ship.heading) * 5.2, hz = nz - Math.cos(ship.heading) * 5.2;
    this.group.position.set(hx, g.position.y + 1.35, hz);
    this.heading = ship.heading;
    this.group.rotation.y = this.heading;
    animateHumanoid(this.model, dt, 0);

    this.updateCamera(dt, true);
  }

  updateCamera(dt, sailing = false) {
    const p = this.group.position;
    // indoors, pull the camera in so walls and roof don't block the view
    const inPalace = Math.abs(p.x - LOC.palace.x) < 22 && Math.abs(p.z - LOC.palace.z) < 18;
    const inCave = Math.hypot(p.x - LOC.cave.x, p.z - LOC.cave.z) < 16;
    const indoor = (inPalace || inCave) && !sailing;
    let dist = G.mode === 'aim' ? 2.6 : (sailing ? 16 : (indoor ? 4.2 : 7.2));
    const hgt = G.mode === 'aim' ? 1.7 : (sailing ? 6 : (indoor ? 1.9 : 2.4));
    const side = G.mode === 'aim' ? 0.7 : 0;
    const cx = p.x + Math.sin(this.yaw) * dist * Math.cos(this.pitch) + Math.cos(this.yaw) * side;
    const cz = p.z + Math.cos(this.yaw) * dist * Math.cos(this.pitch) - Math.sin(this.yaw) * side;
    let cy = p.y + hgt + Math.sin(this.pitch) * dist;
    const gh = groundHeight(cx, cz);
    if (cy < gh + 0.5) cy = gh + 0.5;
    if (inPalace) cy = Math.min(cy, 12.0);   // stay under the palace roof
    if (inCave) cy = Math.min(cy, 11.5);     // stay under the cave dome
    const cam = G.camera;
    const k = Math.min(1, dt * (G.mode === 'aim' ? 14 : 7));
    cam.position.x = lerp(cam.position.x, cx, k);
    cam.position.y = lerp(cam.position.y, cy, k);
    cam.position.z = lerp(cam.position.z, cz, k);
    cam.lookAt(p.x - Math.sin(this.yaw) * 2 * (G.mode === 'aim' ? 3 : 0), p.y + 1.6, p.z - Math.cos(this.yaw) * 2 * (G.mode === 'aim' ? 3 : 0));
  }

  // camera helper for dialogue: frame the player and a target
  frameDialogue(target) {
    const p = this.group.position;
    const t = target;
    const mx = (p.x + t.x) / 2, mz = (p.z + t.z) / 2;
    const dx = t.x - p.x, dz = t.z - p.z;
    const len = Math.max(2.5, Math.hypot(dx, dz));
    const px = -dz / len, pz = dx / len; // perpendicular
    const cx = mx + px * (len * 1.1 + 2.5), cz = mz + pz * (len * 1.1 + 2.5);
    const cy = Math.max(groundHeight(cx, cz) + 1.2, p.y + 1.9);
    G.camera.position.set(cx, cy, cz);
    G.camera.lookAt(mx, p.y + 1.4, mz);
  }
}
