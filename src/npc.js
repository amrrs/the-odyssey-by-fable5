import { G } from './state.js';
import { groundHeight } from './world.js';
import { animateHumanoid } from './characters.js';
import { angleLerp, lerp, dist2d } from './util.js';
import { addLabel, removeLabel } from './ui.js';

export class NPC {
  constructor({ name, model, x, z, face = 0, wanderR = 0, barks = [], showName = true, speed = 1.6 }) {
    this.name = name;
    this.group = model;
    this.home = { x, z };
    this.wanderR = wanderR;
    this.barks = barks;
    this.speed = speed;
    this.moveTarget = null;
    this.waitT = Math.random() * 4;
    this.barkT = 4 + Math.random() * 8;
    this.barkLabel = null;
    this.heading = face;
    this.talking = false;
    this.getDialog = () => null; // story assigns
    this.scripted = null;        // {x,z, done} walk-to override
    this.fixed = false;          // never move/turn

    model.position.set(x, groundHeight(x, z), z);
    model.rotation.y = face;
    G.scene.add(model);
    G.npcs.push(this);
    G.npcByName[name.toLowerCase().replace(/\s.*/, '')] = this;

    if (showName) {
      this.tag = addLabel('nametag', () => {
        const p = this.group.position;
        return { x: p.x, y: p.y + (this.group.userData.heightY || 1.9) + 0.25, z: p.z };
      }, name);
    }
  }

  say(text, seconds = 3.5) {
    if (this.barkLabel) removeLabel(this.barkLabel);
    this.barkLabel = addLabel('bark', () => {
      const p = this.group.position;
      return { x: p.x, y: p.y + (this.group.userData.heightY || 1.9) + 0.8, z: p.z };
    }, text, seconds);
  }

  walkTo(x, z, cb) { this.scripted = { x, z, cb }; }

  faceToward(x, z, dt) {
    const want = Math.atan2(x - this.group.position.x, z - this.group.position.z);
    this.heading = angleLerp(this.heading, want, Math.min(1, dt * 6));
    this.group.rotation.y = this.heading;
  }

  update(dt) {
    if (this.carried) return; // being carried (the great ram)
    const g = this.group;
    const p = g.position;
    const pl = G.player.group.position;
    const dPlayer = dist2d(p.x, p.z, pl.x, pl.z);
    let moveSpeed = 0;

    if (this.talking) {
      this.faceToward(pl.x, pl.z, dt);
    } else if (this.scripted) {
      const t = this.scripted;
      const d = dist2d(p.x, p.z, t.x, t.z);
      if (d < 0.6) {
        const cb = t.cb;
        this.scripted = null;
        cb && cb();
      } else {
        this.faceToward(t.x, t.z, dt * 2);
        moveSpeed = this.speed * 1.4;
      }
    } else if (!this.fixed) {
      // face player when near, otherwise wander
      if (dPlayer < 5.5) {
        this.faceToward(pl.x, pl.z, dt);
        this.moveTarget = null;
      } else if (this.wanderR > 0) {
        if (!this.moveTarget) {
          this.waitT -= dt;
          if (this.waitT <= 0) {
            const a = Math.random() * Math.PI * 2, r = Math.random() * this.wanderR;
            this.moveTarget = { x: this.home.x + Math.cos(a) * r, z: this.home.z + Math.sin(a) * r };
          }
        } else {
          const d = dist2d(p.x, p.z, this.moveTarget.x, this.moveTarget.z);
          if (d < 0.7) { this.moveTarget = null; this.waitT = 2 + Math.random() * 6; }
          else {
            this.faceToward(this.moveTarget.x, this.moveTarget.z, dt);
            moveSpeed = this.speed;
          }
        }
      }
    }

    if (moveSpeed > 0) {
      const nx = p.x + Math.sin(this.heading) * moveSpeed * dt;
      const nz = p.z + Math.cos(this.heading) * moveSpeed * dt;
      if (groundHeight(nx, nz) > -0.6) { p.x = nx; p.z = nz; }
      else this.moveTarget = null;
    }
    p.y = lerp(p.y, Math.max(groundHeight(p.x, p.z), -0.5), Math.min(1, dt * 8));

    // animate
    if (g.userData.rig) animateHumanoid(g, dt, moveSpeed);
    else if (g.userData.animal && !g.userData.still) {
      // simple animal waddle
      g.userData.animT = (g.userData.animT || 0) + dt * (moveSpeed > 0 ? 9 : 2);
      g.rotation.z = Math.sin(g.userData.animT) * (moveSpeed > 0 ? 0.07 : 0.015);
      if (g.userData.tail && !g.userData.tailStill) g.userData.tail.rotation.y = Math.sin(g.userData.animT * 2) * 0.5;
    }

    // ambient barks
    if (this.barks.length && dPlayer < 13 && !this.talking) {
      this.barkT -= dt;
      if (this.barkT <= 0) {
        this.say(this.barks[Math.floor(Math.random() * this.barks.length)]);
        this.barkT = 7 + Math.random() * 9;
      }
    }
  }

  remove() {
    G.scene.remove(this.group);
    if (this.tag) removeLabel(this.tag);
    if (this.barkLabel) removeLabel(this.barkLabel);
    const i = G.npcs.indexOf(this);
    if (i >= 0) G.npcs.splice(i, 1);
    delete G.npcByName[this.name.toLowerCase().replace(/\s.*/, '')];
  }
}

export function clearNPCs() {
  [...G.npcs].forEach(n => n.remove());
}
