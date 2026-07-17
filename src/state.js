// Global game context. Everything hangs off G to avoid circular imports.
export const G = {
  scene: null,
  camera: null,
  renderer: null,
  player: null,      // Player instance
  ship: null,        // ship api from world.js
  npcs: [],
  npcByName: {},
  enemies: [],
  arrows: [],
  chapter: 0,
  step: '',
  flags: {},         // story flags e.g. saidNobody, taunted, tiedToMast
  mode: 'title',     // title | walk | sail | dialogue | cutscene | aim
  interactables: [], // {id, pos:()=>{x,y,z}, r, label, when:()=>bool, use:()=>}
  colliders: [],     // circles {x,z,r} blocking movement
  marker: null,      // {x,z} objective marker or null
  time: 0,
  paused: false,
};

export function addInteract(it) { G.interactables.push(it); return it; }
export function removeInteract(id) {
  G.interactables = G.interactables.filter(i => i.id !== id);
}
export function setFlag(k, v = true) { G.flags[k] = v; }
