// The Odyssey — quest state machine + all dialogue, aligned with Homer's epic.
import { G, addInteract, setFlag } from './state.js';
import { LOC, groundHeight, ISLANDS } from './world.js';
import { NPC, clearNPCs } from './npc.js';
import { Enemy, Ally, clearEnemies } from './combat.js';
import {
  PRESETS, makeSheep, makePig, makeDog, makeCyclops, blindCyclops,
  setPose, giveProp, makeHuman,
} from './characters.js';
import * as UI from './ui.js';
import { sfx, setSirenLevel } from './sound.js';
import { dist2d, clamp, angleLerp } from './util.js';

// ------------------------------------------------------------- machinery
const watchers = [];
function watch(fn) { watchers.push(fn); }
let tick = null; // per-chapter continuous logic

export function updateStory(dt) {
  // iterate a snapshot: a firing watcher may start a new chapter, which
  // clears and repopulates the list — remove by identity, never by index
  for (const w of [...watchers]) {
    if (w(dt)) {
      const idx = watchers.indexOf(w);
      if (idx >= 0) watchers.splice(idx, 1);
    }
  }
  if (tick) tick(dt);
}

const CHAPS = ['', 'CHAPTER I', 'CHAPTER II', 'CHAPTER III', 'CHAPTER IV'];
function obj(text, markerLoc) {
  UI.objective(CHAPS[G.chapter], text);
  G.marker = markerLoc ? { x: markerLoc.x, z: markerLoc.z } : null;
}
function save() { try { localStorage.setItem('odyssey_chapter', String(G.chapter)); } catch (e) {} }
function near(loc, r) {
  const p = G.player.group.position;
  return dist2d(p.x, p.z, loc.x, loc.z) < r;
}
function shipNear(loc, r) {
  const p = G.ship.group.position;
  return dist2d(p.x, p.z, loc.x, loc.z) < r;
}

// ------------------------------------------------------------- dialogue engine
let D = {};
let talker = null;

export function runDialog(id, npc) {
  const node = D[id];
  if (!node) { endDialog(); return; }
  if (npc) { talker = npc; npc.talking = true; }
  if (talker) G.player.frameDialogue(talker.group.position);
  node.do && node.do();
  const opts = node.opts || [['(continue)', node.next || null]];
  UI.showDialogue(node.sp || (talker ? talker.name : ''), node.text, opts, i => {
    const o = opts[i];
    if (!o) return;
    const nxt = o[1];
    if (typeof nxt === 'function') {
      UI.hideDialogue();
      const r = nxt();
      if (typeof r === 'string') runDialog(r);
      else endDialog();
    }
    else if (nxt) runDialog(nxt);
    else endDialog();
  });
}
function endDialog() {
  UI.hideDialogue();
  if (talker) { talker.talking = false; talker = null; }
}

// talk interactable helper: NPC gets a story-controlled dialog supplier
function talkable(npc, r = 3.4) {
  addInteract({
    id: 'talk_' + npc.name,
    pos: () => npc.group.position,
    r: npc.group.userData.heightY > 4 ? 8 : r,
    label: `Talk to ${npc.name}`,
    when: () => !!npc.getDialog() && (G.mode === 'walk'),
    use: () => runDialog(npc.getDialog(), npc),
  });
}

// ------------------------------------------------------------- chapter control
export function startChapter(n) {
  clearNPCs();
  clearEnemies();
  watchers.length = 0;
  tick = null;
  G.interactables = [];
  G.arrows.forEach(a => G.scene.remove(a.mesh));
  G.arrows = [];
  G.axeChallenge = null;
  G.aimAssist = null;
  G.current = null;
  G.flags.autopilot = false;
  G.mode = 'walk';
  G.marker = null;
  UI.cancelNarrate();
  UI.hideDialogue();
  UI.crosshair(false);
  UI.setShipHP(1, false);
  setSirenLevel(0);
  G.onPlayerDeath = defaultDeath;
  G.onShipCrash = null;
  G.onEnemyDeath = null;
  G.chapter = n;
  save();
  [null, chapter1, chapter2, chapter3, chapter4][n]();
}

let respawnPoint = LOC.start;
function defaultDeath() {
  UI.fade(true).then(() => {
    G.player.hp = G.player.maxhp;
    UI.setHP(1);
    G.player.teleport(respawnPoint.x, respawnPoint.z, 0);
    UI.fade(false);
  });
}

// ============================================================= CHAPTER I
function chapter1() {
  respawnPoint = LOC.start;
  const P = G.player;
  P.setDisguise(false);
  P.setWeapon('sword');
  P.teleport(LOC.start.x, LOC.start.z, Math.PI * 0.75);

  const ship = G.ship;
  ship.group.visible = true;
  ship.sailing = false;
  ship.hp = 100;
  ship.group.position.set(LOC.cycShip.x, 0, LOC.cycShip.z);
  ship.heading = Math.PI / 4;
  ship.group.rotation.y = ship.heading;
  ship.setCrew(3);
  G.world.setBoulder('open');

  UI.banner('CHAPTER I', 'THE ISLAND OF THE CYCLOPS');

  // cast
  const eury = new NPC({
    name: 'Eurylochus', model: PRESETS.eurylochus(),
    x: LOC.start.x + 4, z: LOC.start.z - 2, wanderR: 3,
    barks: ['The men are starving, captain.', 'Smoke on the hill — and flocks. I hear them.', 'I do not like this island.'],
  });
  const polites = new NPC({
    name: 'Polites', model: PRESETS.polites(),
    x: LOC.start.x + 7, z: LOC.start.z + 3, wanderR: 4,
    barks: ['Nine days of storm since Troy...', 'Whoever tends those sheep must be a giant of a shepherd.'],
  });
  talkable(eury); talkable(polites);
  polites.getDialog = () => 'polites1';

  // sheep — meadow flock + rams by the cave
  for (let i = 0; i < 6; i++) {
    new NPC({
      name: 'Sheep', model: makeSheep(false), showName: false,
      x: LOC.meadow.x + (i % 3) * 5 - 5, z: LOC.meadow.z + Math.floor(i / 3) * 5 - 2,
      wanderR: 8, speed: 0.9, barks: i === 0 ? ['Baaa.'] : [],
    });
  }
  const ram = new NPC({
    name: 'Great Ram', model: makeSheep(true), showName: false,
    x: LOC.cave.x - 4, z: LOC.cave.z - 3, wanderR: 4, speed: 0.8,
  });

  let poly = null;

  const S = {};
  S.intro = async () => {
    await UI.narrate([
      '“Nine days the storm winds drove us across the fish-cold sea, once we had plundered the hallowed heights of Troy.”',
      'On the tenth, your twelve ships found this shore: green, unworked, loud with the bleating of monstrous flocks.',
      'Your men are starving. On the hill above the beach, a cave mouth yawns behind a fence of great stones.',
    ]);
    eury.getDialog = () => 'eury1';
    obj('Speak with Eurylochus by the ship.', { x: eury.group.position.x, z: eury.group.position.z });
  };

  D = {
    polites1: { text: 'Captain — if there is a host in that cave, maybe he will give us guest-gifts, as custom demands. Or maybe we should take the cheese and run. I say run.', opts: [['We will see what manner of man he is.', null]] },
    eury1: {
      text: 'Captain. The men chew leather to quiet their bellies. There is a cave on the hill — cheeses, lambs, whoever keeps them is away. Say the word.',
      opts: [
        ['We go up together. I will bring the wine Maron gave me — twelve jars, strong as a god\'s blood.', 'eury2'],
        ['Stay and guard the ship. Keep the men ready at the oars.', 'eury3'],
      ],
    },
    eury2: { sp: 'Eurylochus', text: 'The wine of Ismarus... pray we never need it as more than a gift. Lead on.', do: () => { UI.toast('Carrying: Wine of Maron'); }, opts: [['(go)', () => { stepCave(); }]] },
    eury3: { sp: 'Eurylochus', text: 'As you say. But take the wine of Maron with you — a gift for whatever host you find. Or a weapon.', do: () => { UI.toast('Carrying: Wine of Maron'); }, opts: [['(go)', () => { stepCave(); }]] },

    // ---- inside the cave
    poly1: {
      sp: 'Polyphemus',
      text: '“STRANGERS! Who are you? Where do you sail from over the watery ways — traders, or pirates who roam risking their necks?”',
      opts: [
        ['We are Achaeans, blown off course from Troy. By Zeus, god of guests, we ask your welcome.', 'poly2'],
        ['(Say nothing and stand your ground)', 'poly2b'],
      ],
    },
    poly2: {
      sp: 'Polyphemus',
      text: '“Zeus? You are a fool, stranger, or come from far away. We Cyclopes care nothing for Zeus of the aegis — we are stronger by far. Tell me: where did you moor your ship?”',
      opts: [
        ['(Lie) Poseidon smashed it on the rocks at the headland. We alone escaped.', 'poly3'],
        ['It lies drawn up on your beach.', 'poly3b'],
      ],
    },
    poly2b: { sp: 'Polyphemus', text: '“Silent, are you? A meal needs no voice. But first — where is your ship moored?”', opts: [['(Lie) It was wrecked on the rocks. We alone survived.', 'poly3'], ['On the beach below.', 'poly3b']] },
    poly3b: { sp: 'Polyphemus', text: '“Ha! Then tomorrow I shall dine on your oarsmen too.”', do: () => setFlag('toldShip'), next: 'poly3' },
    poly3: {
      text: 'He answers nothing more. He snatches two of your men and makes his meal, then sleeps among his flocks. At dawn he eats again, rolls the stone aside as lightly as a quiver\'s lid, pens his sheep — and seals you in once more.',
      opts: [['(There must be a way...)', () => {
        obj('Offer Polyphemus the wine of Maron.', { x: poly.group.position.x, z: poly.group.position.z });
        poly.getDialog = () => 'poly4';
      }]],
    },
    poly4: {
      sp: 'Polyphemus',
      text: '(You hold out the ivy bowl, brimming dark.) “...What is this? Give it here!” He drains it once, twice, three times. “Sweet fire! Tell me your name, stranger, and I will give you a guest-gift to make you glad.”',
      opts: [
        ['My name is Nobody. Nobody — that is what my mother, my father, and all my friends call me.', 'poly5'],
        ['I am Odysseus, son of Laertes, sacker of cities!', 'poly5b'],
      ],
    },
    poly5: {
      sp: 'Polyphemus',
      text: '“Then here is your gift, Nobody: I shall eat Nobody last of all his company. Ha... ha...” The wine takes him. He sags, topples, and sleep — and worse — comes pouring out of him.',
      do: () => setFlag('saidNobody'),
      opts: [['(Now.)', () => polySleeps()]],
    },
    poly5b: {
      sp: 'Polyphemus',
      text: '“Odysseus... a name the prophet spoke long ago. Here is my gift, Odysseus: you shall be eaten LAST.” He laughs, sways, and crashes down into wine-dark sleep.',
      do: () => setFlag('saidNobody', false),
      opts: [['(Now.)', () => polySleeps()]],
    },

    taunt0: {
      sp: 'Eurylochus',
      text: 'Aboard, quick! The men bend to the oars. Behind us the blind giant rages on the cliff, hurling curses at the sea. We are almost out of a stone\'s throw...',
      opts: [
        ['(Stand and shout) CYCLOPS! If any man asks who blinded you, tell him: Odysseus, sacker of cities, son of Laertes, who makes his home in Ithaca!', 'taunt1'],
        ['(Hold your tongue. The sea will judge what was done.)', 'taunt2'],
      ],
    },
    taunt1: {
      text: 'Your men go white. A mountaintop crashes into the sea beside the hull; the wave nearly drives you back to the shore. And the Cyclops raises his hands to the starry heaven:',
      do: () => { setFlag('taunted'); sfx('roar'); },
      opts: [['(listen)', 'curse']],
    },
    taunt2: {
      sp: 'Eurylochus',
      text: 'Wisdom, captain — for once. But look at him: he prays anyway. He knows a god heard what was done in that cave.',
      opts: [['(listen)', 'curse']],
    },
    curse: {
      sp: 'Polyphemus',
      text: '“Hear me, POSEIDON, dark-haired shaker of the earth — if I am truly your son, grant that Odysseus never reaches home. Or if he must... let him come late, and broken, on a stranger\'s ship, having lost all his companions — to find trouble in his house.”',
      opts: [['(The sea grows cold around the hull.)', () => {
        UI.narrate([
          'A god heard him. From that hour, Poseidon\'s grudge ran under every wave between you and Ithaca.',
          'For days you sail. The isle of Aeolus, lord of winds... the cannibal Laestrygonians, who smash eleven of your twelve ships like eggshells...',
          'One ship remains. Yours. And ahead: a low green island, and a thread of smoke above the oaks.',
        ]).then(() => beginSail(LOC.aeaeaShip, 'Sail east to the isle of Aeaea (W — sail, A/D — steer).', () => startChapter(2)));
        return true;
      }]],
    },
  };

  function stepCave() {
    obj('Climb the hill and enter the great cave.', LOC.caveEntrance);
    watch(() => {
      if (near(LOC.caveInside, 7)) { polyArrives(); return true; }
    });
  }

  async function polyArrives() {
    G.mode = 'cutscene';
    await UI.fade(true);
    poly = new NPC({
      name: 'Polyphemus', model: makeCyclops(),
      x: LOC.cave.x - 2, z: LOC.cave.z + 5, wanderR: 0,
    });
    poly.fixed = true;
    talkable(poly);
    G.world.setBoulder('sealed');
    sfx('roar');
    await UI.fade(false);
    await UI.narrate([
      'The ground shakes. A shape vast as a wooded ridge drives its flock in through the mouth of the cave — and rolls a boulder across it that twenty-two wagons could not stir.',
      'You and six of your men press into the shadows among the sheep pens. There is no way out that does not pass HIM.',
    ]);
    G.mode = 'walk';
    poly.getDialog = () => 'poly1';
    obj('Speak with Polyphemus.', { x: poly.group.position.x, z: poly.group.position.z });
  }

  function polySleeps() {
    endDialog();
    poly.getDialog = () => null;
    setPose(poly.group, 'sleep');
    poly.group.position.y = groundHeight(poly.group.position.x, poly.group.position.z) + 1.6;
    poly.say('...zzz... hrrrgh... zzz...', 6);
    obj('Take the olive stake from beside the fire.', LOC.stake);
    addInteract({
      id: 'stake', pos: () => ({ x: LOC.stake.x, y: 4.8, z: LOC.stake.z }), r: 2.5,
      label: 'Take the olive stake', when: () => !G.flags.hasStake,
      use: () => {
        setFlag('hasStake');
        UI.toast('Taken: olive-wood stake');
        G.world.stake.visible = false;
        obj('Heat the point in the fire — then drive it into his eye.', LOC.caveFire);
        addInteract({
          id: 'blind', pos: () => poly.group.position, r: 7,
          label: 'Drive the stake into his eye', when: () => G.flags.hasStake && !G.flags.blinded,
          use: () => doBlind(),
        });
      },
    });
  }

  async function doBlind() {
    setFlag('blinded');
    UI.hurtVignette(0.9);
    sfx('roar');
    await UI.narrate([
      'You heat the point until it glows, and with four men you raise it — and drive it deep into his one great eye, leaning on it as a shipwright leans on his drill.',
      'His shriek makes the rock ring. He tears the stake free and howls into the night for his neighbours.',
      G.flags.saidNobody
        ? '“NOBODY is killing me! Nobody — by craft, not by force!” — And the other Cyclopes call back from the hills: “If nobody harms you, then it is a sickness from Zeus. Pray to your father Poseidon.” And they go.'
        : '“ODYSSEUS is killing me!” — But the name means nothing to his neighbours across the wind. “A man? Then fight him yourself,” they call back. And they go.',
      'Groping, he rolls the boulder from the mouth and sits himself in the gap, arms spread wide, to catch any man who tries to slip out among the sheep.',
    ]);
    UI.hurtVignette(0);
    blindCyclops(poly.group);
    setPose(poly.group, 'stand');
    // seat him in the entrance gap
    const gapDir = Math.atan2(LOC.caveEntrance.z - LOC.cave.z, LOC.caveEntrance.x - LOC.cave.x);
    const gx = LOC.cave.x + Math.cos(gapDir) * 10, gz = LOC.cave.z + Math.sin(gapDir) * 10;
    poly.group.position.set(gx, groundHeight(gx, gz), gz);
    poly.group.rotation.y = Math.atan2(Math.cos(gapDir), Math.sin(gapDir)); // face out through the gap
    setPose(poly.group, 'sit');
    poly.group.position.y -= 2.2;
    poly.barks = ['I will have you yet, Nobody...', 'You will not leave with my flock...', 'Father Poseidon, hear me...'];
    G.world.setBoulder('aside');
    // funnel colliders at the gap edges
    const perp = gapDir + Math.PI / 2;
    G.colliders.push({ x: gx + Math.cos(perp) * 7.5, z: gz + Math.sin(perp) * 7.5, r: 4 });
    G.colliders.push({ x: gx - Math.cos(perp) * 7.5, z: gz - Math.sin(perp) * 7.5, r: 4 });

    obj('Cling beneath the great ram and slip past the blind Cyclops.', null);
    addInteract({
      id: 'ram', pos: () => ram.group.position, r: 2.5,
      label: 'Cling beneath the great ram',
      when: () => !G.player.hiddenUnderRam && G.flags.blinded && !G.flags.escaped,
      use: () => { G.player.hiddenUnderRam = true; G.player.ramRef = ram.group; ram.carried = true; UI.toast('You knot your fingers into the deep wool...'); },
    });
    addInteract({
      id: 'ram_off', pos: () => G.player.group.position, r: 99,
      label: 'Let go of the ram',
      when: () => G.player.hiddenUnderRam,
      use: () => releaseRam(),
    });

    let caughtCd = 0;
    watch(dt => {
      caughtCd -= dt;
      const pp = poly.group.position;
      const d = dist2d(G.player.group.position.x, G.player.group.position.z, pp.x, pp.z);
      if (G.flags.escaped) return true;
      if (d < 6.5 && !G.player.hiddenUnderRam && caughtCd <= 0) {
        caughtCd = 2.5;
        G.player.damage(22);
        poly.say('GOT YOU! ...slippery little—');
        const back = { x: LOC.caveInside.x, z: LOC.caveInside.z };
        G.player.teleport(back.x, back.z, 0);
        UI.toast('The great hands find you — you tear free and tumble back inside.');
      }
      if (dist2d(G.player.group.position.x, G.player.group.position.z, LOC.cave.x, LOC.cave.z) > 26) {
        setFlag('escaped');
        releaseRam();
        poly.say('My ram... always first out, and today last? Do you grieve for your master\'s eye?', 6);
        UI.narrate([
          'The blind giant strokes the ram\'s back as it passes: “Sweet cousin, if only you could speak, and tell me where Nobody hides...” — and lets it go.',
          'You are out. The sky has never looked so wide.',
        ]).then(() => {
          obj('Get back to the ship.', LOC.cycShip);
          addInteract({
            id: 'board1', pos: () => G.ship.group.position, r: 14,
            label: 'Board the ship', when: () => G.flags.escaped && G.mode === 'walk',
            use: () => runDialog('taunt0', eury),
          });
        });
        return true;
      }
    });
  }

  function releaseRam() {
    if (!G.player.hiddenUnderRam) return;
    G.player.hiddenUnderRam = false;
    ram.carried = false;
    const p = G.player.group.position;
    ram.group.position.set(p.x + 1.5, groundHeight(p.x + 1.5, p.z), p.z);
    ram.home = { x: p.x, z: p.z };
    G.player.ramRef = null;
  }

  S.intro();
}

// ------------------------------------------------------------- sailing legs
function beginSail(dest, objText, onArrive) {
  const ship = G.ship;
  G.mode = 'sail';
  ship.sailing = true;
  // place player visually on deck (player.updateSail owns it)
  obj(objText, dest);
  G.world.setBeacon(dest.x, dest.z);
  watch(() => {
    if (shipNear(dest, 26)) {
      ship.sailing = false;
      ship.speed = 0;
      G.world.clearBeacon();
      G.mode = 'walk';
      // step ashore toward the nearest island centre until on dry land
      let best = ISLANDS[0], bd = 1e9;
      for (const isl of ISLANDS) {
        const d = dist2d(dest.x, dest.z, isl.x, isl.z);
        if (d < bd) { bd = d; best = isl; }
      }
      let px = dest.x, pz = dest.z;
      const ang = Math.atan2(best.x - px, best.z - pz);
      for (let i = 0; i < 80 && groundHeight(px, pz) < 0.3; i++) {
        px += Math.sin(ang) * 1.2; pz += Math.cos(ang) * 1.2;
      }
      G.player.teleport(px, pz, ang);
      onArrive();
      return true;
    }
  });
}

// ============================================================= CHAPTER II
function chapter2() {
  respawnPoint = LOC.aeaeaBeach;
  const P = G.player;
  P.teleport(LOC.aeaeaBeach.x, LOC.aeaeaBeach.z, Math.PI / 3);
  const ship = G.ship;
  ship.group.position.set(LOC.aeaeaShip.x, 0, LOC.aeaeaShip.z);
  ship.setCrew(1);

  UI.banner('CHAPTER II', 'CIRCE OF AEAEA');

  const eury = new NPC({
    name: 'Eurylochus', model: PRESETS.eurylochus(),
    x: LOC.aeaeaBeach.x - 6, z: LOC.aeaeaBeach.z - 4, wanderR: 3,
    barks: ['I will NOT go back to that house, captain.', 'Wolves and lions fawned at her door like dogs...', 'They drank her wine — and then they were gone.'],
  });
  talkable(eury);
  eury.getDialog = () => 'eury_c2';

  const hermes = new NPC({
    name: 'Hermes', model: PRESETS.hermes(),
    x: LOC.hermesSpot.x, z: LOC.hermesSpot.z, wanderR: 0,
    barks: ['You will need more than bronze, son of Laertes.'],
  });
  talkable(hermes);

  const circe = new NPC({
    name: 'Circe', model: PRESETS.circe(),
    x: LOC.circeFront.x, z: LOC.circeFront.z, wanderR: 2,
    barks: ['Another sailor come to my door...', 'The loom is patient. So am I.'],
  });
  talkable(circe);

  // the crew, penned as swine
  const pigs = [];
  for (let i = 0; i < 4; i++) {
    pigs.push(new NPC({
      name: 'Strange Swine', model: makePig(), showName: i === 0,
      x: LOC.circeHouse.x - 8 + (i % 2) * 3, z: LOC.circeHouse.z + 8 + Math.floor(i / 2) * 3,
      wanderR: 4, speed: 1.2,
      barks: ['*a weeping sound, almost human*', '*oink... captain...?*'],
    }));
  }

  UI.narrate([
    'Aeaea. Low woods, and a single thread of smoke rising from a house of polished stone.',
    'You split the crew: Eurylochus led one half inland. Only Eurylochus came back — babbling of a singing woman, a cup of honeyed wine... and men who went in and never came out.',
  ]).then(() => {
    obj('Take the path inland. Find your missing men.', LOC.hermesSpot);
  });

  watch(() => {
    if (near(LOC.hermesSpot, 6)) { runDialog('hermes1', hermes); return true; }
  });

  D = {
    eury_c2: { text: 'Do not ask me to go back to that house, captain. Sail! Some of us can still be saved!', opts: [['I do not leave my men. Not for gods, not for witches.', null]] },
    hermes1: {
      sp: 'Hermes',
      text: '“Where are you off to now, unlucky man, alone through the hills, in a country you do not know? Your friends are penned in Circe\'s sty, wearing the bodies of swine. Do you mean to free them? I tell you: alone, you will only join them.”',
      opts: [['Then help me, god of travellers — or stand aside.', 'hermes2']],
    },
    hermes2: {
      sp: 'Hermes',
      text: '“Spoken like your father\'s son. Here — a herb of virtue. MOLY, the gods call it: black at the root, its flower white as milk. Hard for mortal men to dig, but for gods all things are easy. With this in your blood her drugs are water. When she strikes you with her wand — draw your sword on her as if you meant to kill. She will offer terms. Make her SWEAR the great oath first.”',
      do: () => { UI.toast('Received: Moly, the milk-white herb'); sfx('pickup'); setFlag('hasMoly'); },
      opts: [['(He is gone the way gods go — like a thought.)', () => {
        hermes.remove();
        obj('Confront Circe at her stone house.', LOC.circeFront);
        circe.getDialog = () => 'circe1';
        return true;
      }]],
    },
    circe1: {
      sp: 'Circe',
      text: '“Come in, stranger. You look sea-worn and hungry. Sit — drink. Honeyed wine, barley, cheese: my welcome to all lost sailors.” Her eyes are old the way the sea is old. Somewhere behind the house, swine are screaming.',
      opts: [
        ['(The moly is bitter under your tongue.) Drink the cup, and watch her.', 'circe2'],
        ['I know what you are, witch. I know what swims in that cup.', 'circe2r'],
      ],
    },
    circe2: {
      sp: 'Circe',
      text: 'You drink it to the lees. She rises, strikes you with her wand: “NOW — to the sty with you, and lie with your friends!” ...Nothing happens. The color drains from her face. “You... do not change. No man has ever drunk that cup and stood. Who ARE you?”',
      opts: [['(Draw your sword as if to kill her.)', 'circe3']],
    },
    circe2r: {
      sp: 'Circe',
      text: '“Do you? Bold tongue.” Quick as a snake she strikes you with her wand — and the drug on its tip meets the moly in your blood, and dies. Her eyes go wide. “You do not change. Who ARE you?”',
      opts: [['(Draw your sword as if to kill her.)', 'circe3']],
    },
    circe3: {
      sp: 'Circe',
      text: 'She does not flee — she slips beneath the blade and grasps your knees. “You are Odysseus! The man of twists and turns! Hermes always said you would come from Troy in your black ship. Put up your sword. Let there be trust between us.”',
      opts: [
        ['First swear the great oath of the gods: no harm, no tricks — and my men made men again.', 'circe4'],
        ['Trust? Your house is full of my crew, on four legs.', 'circe4'],
      ],
    },
    circe4: {
      sp: 'Circe',
      text: '“I swear it — by Styx, the oath no god may break. Come.” She walks to the sty and smears each beast with a second drug. And the bristles fall away...',
      opts: [['(watch)', () => { restoreCrew(); return 'circe5'; }]],
    },
    circe5: {
      sp: 'Circe',
      text: '“Your men — younger, taller, and fairer than before, if you ask me. Stay, Odysseus. Rest your crew. You are all salt and scars.” (And you did stay — a year, feasting, until your men themselves said: remember Ithaca.)',
      opts: [['The time has come, Circe. Set us on the road home.', 'circe6']],
    },
    circe6: {
      sp: 'Circe',
      text: '“Then listen, for the road is worse than the sea. First you will pass the SIRENS, who bewitch every man that hears them — the beach below their meadow is white with the bones of listeners. Stop your men\'s ears with beeswax. But you, Odysseus — you will want to hear. I know you. Have them BIND you to the mast, hand and foot, and if you beg for release, let them lash you tighter.”',
      opts: [['And after the Sirens?', 'circe7']],
    },
    circe7: {
      sp: 'Circe',
      text: '“The isle of Thrinacia, where the Sun keeps his cattle. Whatever hunger takes you — DO NOT touch them. Harm them, and I see ruin for your ship and all your men. You may yet come home... late, and broken, and alone.” (Her words and the Cyclops\' curse rhyme in your ear.)',
      opts: [['(Return to the ship.)', () => {
        obj('Return to the ship and set sail for home.', LOC.aeaeaShip);
        addInteract({
          id: 'board2', pos: () => G.ship.group.position, r: 14,
          label: 'Board the ship',
          when: () => G.flags.crewRestored && G.mode === 'walk',
          use: () => startChapter(3),
        });
        return true;
      }]],
    },
  };

  function restoreCrew() {
    setFlag('crewRestored');
    sfx('pickup');
    for (const pig of pigs) {
      const pos = pig.group.position.clone();
      pig.remove();
      new NPC({
        name: 'Crewman', model: PRESETS.crew(), showName: false,
        x: pos.x, z: pos.z, wanderR: 5,
        barks: ['Captain! Gods — hands! I have hands!', 'I dreamed I was mud and acorns...', 'Never again. Never wine from a stranger.'],
      });
    }
    G.ship.setCrew(4);
  }
}

// ============================================================= CHAPTER III
function chapter3() {
  respawnPoint = LOC.aeaeaBeach;
  UI.banner('CHAPTER III', 'THE SONG OF THE SIRENS');
  const ship = G.ship;
  ship.hp = 100;
  ship.setCrew(4);
  ship.group.position.set(LOC.aeaeaShip.x, 0, LOC.aeaeaShip.z);
  ship.heading = Math.atan2(LOC.sirenStrait.x - LOC.aeaeaShip.x, LOC.sirenStrait.z - LOC.aeaeaShip.z);
  ship.group.rotation.y = ship.heading;

  // choice first, then sail
  D = {
    sirens0: {
      sp: 'Eurylochus',
      text: 'The strait of the Sirens lies dead ahead, captain — Circe\'s beeswax is soft in my hand, enough for every ear on board. And you? What do we do with YOU?',
      opts: [
        ['Bind me to the mast, hand and foot. I will hear the song no man has lived to tell. If I beg — lash me tighter.', 'sirens_tied'],
        ['Wax my ears like the rest. We slip through deaf, alive, and I will steer her through myself.', 'sirens_wax'],
      ],
    },
    sirens_tied: {
      sp: 'Eurylochus',
      text: '“Madness — but it is YOUR madness, and we are used to it.” They knot the ropes hard against the mast. The crew\'s ears shine with wax. The oars bite. (The ship sails herself now. Whatever you hear — the ropes will hold. Probably.)',
      do: () => { setFlag('tied'); },
      opts: [['(sail)', () => { sailStrait(); return true; }]],
    },
    sirens_wax: {
      sp: 'Eurylochus',
      text: '“Deaf and alive — the first sensible order this voyage.” The wax closes over your hearing like a door. The world goes to cotton. (Steer with A and D — the current pulls toward the rocks, and no one aboard can hear you shout.)',
      do: () => { setFlag('tied', false); },
      opts: [['(sail)', () => { sailStrait(); return true; }]],
    },
  };
  runDialog('sirens0', null);

  const SONG = [
    '🎵 “Come closer, famous Odysseus — great glory of the Achaeans...”',
    '🎵 “...moor your ship, and hear our voices. No man has ever sailed past us...”',
    '🎵 “...we know all the toils that you and the Argives suffered on the plain of Troy...”',
    '🎵 “...we know everything that happens on this fruitful earth. Come closer...”',
  ];

  function sailStrait() {
    endDialog();
    G.mode = 'sail';
    ship.sailing = true;
    UI.setShipHP(1, true);
    G.world.setBeacon(LOC.sirenStrait.x + 130, LOC.sirenStrait.z + 60);
    obj(G.flags.tied ? 'Endure the song. (E — beg to be released)' : 'Steer through the strait. Beware the rocks.', LOC.sirenStrait);

    let entered = false, songI = 0, songT = 3, crashCd = 0, begCd = 0;
    const exitPt = { x: LOC.sirenStrait.x + 150, z: LOC.sirenStrait.z + 70 };

    if (G.flags.tied) {
      G.flags.autopilot = true;
      G.autoHeading = Math.atan2(exitPt.x - ship.group.position.x, exitPt.z - ship.group.position.z);
      addInteract({
        id: 'beg', pos: () => G.player.group.position, r: 99,
        label: 'UNTIE ME! (beg to be released)',
        when: () => entered && G.flags.tied && G.mode === 'sail',
        use: () => {
          if (begCd > 0) return;
          begCd = 4;
          const lines = ['Bind him tighter!', 'Row! ROW! Don\'t look at him!', 'Forgive us, captain — Circe\'s orders. And yours.'];
          UI.toast('“' + lines[Math.floor(Math.random() * 3)] + '” — the crew, deaf and rowing');
        },
      });
    }

    G.onShipCrash = () => {
      if (crashCd > 0) return;
      crashCd = 1.2;
      ship.hp -= 18;
      sfx('hit');
      UI.setShipHP(ship.hp / 100, true);
      UI.toast('The hull grinds against the rock!');
      if (ship.hp <= 0) {
        ship.hp = 70;
        UI.setShipHP(0.7, true);
        UI.fade(true).then(() => {
          ship.group.position.set(LOC.sirenStrait.x - 120, 0, LOC.sirenStrait.z - 55);
          ship.speed = 0;
          UI.fade(false);
          UI.toast('You bail, patch, and pray — and try the strait again.');
        });
      }
    };

    tick = dt => {
      crashCd -= dt; begCd -= dt;
      const sp = ship.group.position;
      const dz = dist2d(sp.x, sp.z, LOC.sirenStrait.x, LOC.sirenStrait.z);
      const inZone = dz < 105;
      if (dz < 130 && !entered) { entered = true; }
      // song volume by proximity
      const level = clamp(1 - dz / 160, 0, 1);
      setSirenLevel(G.flags.tied ? level : level * 0.06);
      if (inZone) {
        songT -= dt;
        if (songT <= 0 && G.flags.tied && songI < SONG.length) {
          UI.toast(SONG[songI % SONG.length]);
          songI++; songT = 5;
        }
        // the pull
        if (!G.flags.tied) {
          const ang = Math.atan2(LOC.sirenStrait.x - sp.x, LOC.sirenStrait.z - sp.z);
          G.current = { x: Math.sin(ang) * 3.2, z: Math.cos(ang) * 3.2 };
        } else {
          G.autoHeading = Math.atan2(exitPt.x - sp.x, exitPt.z - sp.z) + Math.sin(G.time * 0.5) * 0.15;
        }
      } else G.current = null;

      if (entered && dz > 118 && dist2d(sp.x, sp.z, exitPt.x, exitPt.z) < dist2d(LOC.aeaeaShip.x, LOC.aeaeaShip.z, exitPt.x, exitPt.z) * 0.6) {
        tick = null;
        afterSirens();
      }
    };
  }

  async function afterSirens() {
    setSirenLevel(0);
    G.current = null;
    G.flags.autopilot = false;
    G.world.clearBeacon();
    UI.setShipHP(1, false);
    ship.sailing = false;
    G.mode = 'cutscene';
    await UI.narrate([
      G.flags.tied
        ? 'The song fades astern. Your men say you wept and strained at the ropes until the knots drew blood — and that you are the only man alive who has heard the Sirens sing.'
        : 'The rocks fall astern. In perfect cotton silence, three winged shapes scream unheard from their meadow of bones.',
      'Then: Thrinacia, the island of the Sun. You make your men swear — but the winds die for a month, the food runs out, and while you sleep, Eurylochus persuades them. They slaughter the fattest of the cattle of Helios.',
      'For six days the flayed hides crawl and the meat lows on the spits.',
    ]);
    sfx('thunder');
    await UI.fade(true);
    await UI.narrate([
      'On the seventh day you sail — and Zeus repays the Sun. One thunderbolt. The ship spins, shatters; your men fall into the smother like sea-crows. Poseidon\'s curse, made whole: LATE, AND BROKEN, AND ALONE.',
      'Nine days you drift on the keel. Then Calypso\'s isle — seven years a prisoner of a goddess who loves you. Then the raft, the storm, the kindly Phaeacians...',
      'And at last, asleep in the stern of their swift ship, you are laid — like cargo, like a dead man, like a gift — on a beach you do not recognize.',
    ]);
    startChapter(4);
  }
}

// ============================================================= CHAPTER IV
function chapter4() {
  respawnPoint = LOC.ithacaBeach;
  const P = G.player;
  P.setWeapon('none');
  P.setDisguise(false);
  P.teleport(LOC.ithacaBeach.x, LOC.ithacaBeach.z, Math.PI);
  G.ship.group.visible = false;
  UI.fade(false);
  UI.banner('CHAPTER IV', 'ITHACA');

  // ---- cast
  const athena = new NPC({
    name: 'Athena', model: PRESETS.athena(),
    x: LOC.ithacaBeach.x - 5, z: LOC.ithacaBeach.z - 5, wanderR: 0,
  });
  talkable(athena);
  athena.getDialog = () => 'athena1';

  const eumaeus = new NPC({
    name: 'Eumaeus', model: PRESETS.eumaeus(),
    x: LOC.hutFront.x, z: LOC.hutFront.z, wanderR: 4,
    barks: ['Get back, you sows — dinner\'s not till dusk.', 'Twenty years. The sea keeps what it takes.', 'A guest is from Zeus, whoever he is.'],
  });
  talkable(eumaeus);

  for (let i = 0; i < 3; i++) {
    new NPC({
      name: 'Pig', model: makePig(), showName: false,
      x: LOC.pigPen.x - 2 + (i % 2) * 3, z: LOC.pigPen.z - 1 + i, wanderR: 3, speed: 1.1,
    });
  }

  const argos = new NPC({
    name: 'Argos', model: makeDog(), showName: true,
    x: LOC.argosSpot.x, z: LOC.argosSpot.z, wanderR: 0, speed: 0,
  });
  argos.fixed = true;
  talkable(argos, 3);

  const penelope = new NPC({
    name: 'Penelope', model: PRESETS.penelope(),
    x: LOC.throne.x + 3, z: LOC.throne.z + 2, wanderR: 2,
    barks: ['By day I weave; by night I will not say.', 'Twenty years of other men\'s appetites in his hall.'],
  });
  talkable(penelope);

  const eurycleia = new NPC({
    name: 'Eurycleia', model: PRESETS.eurycleia(),
    x: LOC.hearth.x - 4, z: LOC.hearth.z + 2, wanderR: 3,
    barks: ['More wine spilled than drunk, and who scrubs it?', 'I nursed the master himself, I\'ll have you know.'],
  });

  const suitorDefs = [
    { name: 'Antinous', preset: 'antinous', x: LOC.hearth.x + 6, z: LOC.hearth.z + 3, barks: ['More wine! The estate can afford it — forever.', 'The queen will choose ME, or no one.'] },
    { name: 'Eurymachus', preset: 'eurymachus', x: LOC.hearth.x - 7, z: LOC.hearth.z + 4, barks: ['Odysseus is fish-food. Twenty years of fish-food.', 'When I am master here, the wine will be better.'] },
    { name: 'Ctesippus', preset: 'suitor', x: LOC.hearth.x + 8, z: LOC.hearth.z - 3, barks: ['Another day, another feast. His fat cattle are excellent.'] },
    { name: 'Amphinomus', preset: 'suitor', x: LOC.hearth.x - 5, z: LOC.hearth.z - 5, barks: ['Sometimes I think we go too far... more wine.'] },
    { name: 'Demoptolemus', preset: 'suitor', x: LOC.hearth.x + 3, z: LOC.hearth.z - 6, barks: ['Sing something, bard, or we\'ll use your lyre for kindling.'] },
  ];
  const suitors = suitorDefs.map(d => {
    const n = new NPC({ name: d.name, model: PRESETS[d.preset](), x: d.x, z: d.z, wanderR: 3, barks: d.barks });
    return n;
  });
  const antinous = suitors[0];
  talkable(antinous);

  let telemachus = null;

  UI.narrate([
    'You wake with sand in your beard and gold at your feet — the Phaeacians\' parting gifts. A grey-eyed woman is watching you, leaning on a spear, entirely unsurprised.',
  ]).then(() => {
    obj('Speak with the grey-eyed stranger.', { x: athena.group.position.x, z: athena.group.position.z });
  });

  D = {
    athena1: {
      sp: 'Athena',
      text: '“Do you not know your own island, man of twists and turns? This is ITHACA. But go softly: for three years, a hundred and eight suitors have camped in your hall — devouring your herds, courting your wife, and planning your son\'s murder. Walk in as Odysseus, and you die at your own hearth.”',
      opts: [
        ['Athena. I would know that grey gaze in the dark. What must I do?', 'athena2'],
        ['My hall? My WIFE? Give me my sword and stand aside.', 'athena2b'],
      ],
    },
    athena2b: { sp: 'Athena', text: '“And that is why you need me. One man against a hundred? Even you, Odysseus, need a plan more than a blade.”', next: 'athena2' },
    athena2: {
      sp: 'Athena',
      text: '“Craft, as always. I will wither you into a beggar no eye will know — cracked skin, grey rags, a stick. Go first to EUMAEUS, the swineherd on the hill. In twenty years he has not stopped being yours. Trust him — but tell him nothing yet.”',
      opts: [['(Her hand passes over you, and your own arms grow old.)', () => {
        P.setDisguise(true);
        UI.toast('You are disguised as a nameless beggar');
        athena.remove();
        obj('Find the hut of Eumaeus the swineherd.', LOC.hutFront);
        eumaeus.getDialog = () => 'eum1';
        return true;
      }]],
    },
    eum1: {
      sp: 'Eumaeus',
      text: '“Come in, old father, before the dogs make a meal of you. Bread and pork we have — the suitors leave the pigs alone, they prefer the master\'s cattle. Eat first. Grieve after. That is the custom of this house.”',
      opts: [
        ['You speak of your master as if he still breathes.', 'eum2'],
        ['Whose house is this island\'s great hall, friend?', 'eum2'],
      ],
    },
    eum2: {
      sp: 'Eumaeus',
      text: '“ODYSSEUS. Twenty years gone at Troy, and the sea-dogs have his bones, I fear. Meanwhile a hundred fine lords eat his estate down to the dirt and call it courtship. His queen weaves and weeps. His son sails to Pylos hunting news and the suitors sharpen knives for his homecoming. And I herd pigs for thieves.”',
      opts: [
        ['I swear to you by Zeus: Odysseus will return this very year.', 'eum3'],
        ['(Say nothing. The man\'s grief is older than your patience.)', 'eum3'],
      ],
    },
    eum3: {
      sp: 'Eumaeus',
      text: '“Every tramp on this island swears the same for a cloak and a supper. I stopped believing the year the false Aetolian... hold. Someone on the path—” (A young man stands in the gate, spear in hand. Eumaeus drops the bowl and weeps like a father whose son walks out of a grave.) “TELEMACHUS! You live! The suitors\' ambush—”',
      opts: [['(watch)', () => { telemArrives(); return true; }]],
    },
    telem1: {
      sp: 'Telemachus',
      text: '“Their ambush watched the wrong strait, good Eumaeus — a god, I think, steered me home around it. Go to my mother, quickly: tell her I am safe. Say nothing where the suitors hear.” (Eumaeus hurries down the hill. The young man studies you.) “Stranger. My house is sick, and I cannot even offer you a proper guest-gift in it. Who are you?”',
      opts: [['(The grey-eyed one whispers: NOW.)', 'reveal1']],
    },
    reveal1: {
      sp: 'Odysseus',
      text: '(The rags fall away. Your back straightens. Twenty years of sea and war stand up in you.) “No god, Telemachus — though gods have knocked me about enough. I am your father. For whose sake you have grieved and swallowed insults in your own house — I am home, in the twentieth year.”',
      do: () => { P.setDisguise(false); },
      opts: [['(open your arms)', 'reveal2']],
    },
    reveal2: {
      sp: 'Telemachus',
      text: '(He does not move for three heartbeats. Then he is a child in your arms, and then a man again, too fast.) “...Father. Then the beggar— the disguise— Athena\'s work. What do we DO? There are more than a hundred of them, and two of us.”',
      opts: [['Two of us — and Athena, and one locked room of weapons. Listen.', 'reveal3']],
    },
    reveal3: {
      sp: 'Odysseus',
      text: '“Go home ahead of me. I follow as the beggar. WHATEVER they do to me — a thrown stool, a mocked grace — bear it, and keep your face still. Lock the hall\'s weapons in the storeroom, all but two swords, two spears, two shields. And when I give the sign... we clean this house.”',
      do: () => { P.setDisguise(true); },
      opts: [['(He grips your wrist, soldier-fashion, and goes.)', () => {
        telemachus.walkTo(LOC.palaceDoor.x, LOC.palaceDoor.z + 6, () => {
          telemachus.group.position.set(LOC.hearth.x - 3, groundHeight(LOC.hearth.x - 3, LOC.hearth.z - 4), LOC.hearth.z - 4);
          telemachus.home = { x: LOC.hearth.x - 3, z: LOC.hearth.z - 4 };
          telemachus.wanderR = 2;
        });
        obj('Go to your palace — as a beggar. (Argos waits by the gate.)', LOC.palaceDoor);
        argos.getDialog = () => 'argos1';
        watch(() => {
          if (near(LOC.palaceInside, 7)) { runDialog('ant1', antinous); return true; }
        });
        return true;
      }]],
    },
    argos1: {
      text: '(On a dung-heap by the gate lies an old hound, tick-bitten, bone-thin. Argos — you trained him yourself, before Troy. He cannot rise. But his ears lift. His tail beats the ground, once, twice. He knows you. Twenty years, one heartbeat, and he knows you.)',
      opts: [
        ['(You dare not greet him. You wipe away one tear where Eumaeus cannot see, and pass through your own gate.)', () => {
          argos.getDialog = () => null;
          argos.group.userData.tailStill = true;
          argos.group.rotation.z = 0.5;
          argos.say('*a long sigh, like a door closing on a warm room*', 5);
          UI.toast('And the darkness of death closed over Argos — who had seen his master again, in the twentieth year.');
          return true;
        }],
      ],
    },
    ant1: {
      sp: 'Antinous',
      text: '“Gods, what NOW? Look what the swineherd drags in — a sack of bones to spoil our dinner! Who let this wreck across the threshold?”',
      opts: [
        ['A crust, my lord. Even beggars are sent by Zeus — and I was a rich man once, with a house of my own.', 'ant2'],
        ['(Say nothing. Hold out your hand and memorize his face.)', 'ant2'],
      ],
    },
    ant2: {
      sp: 'Antinous',
      text: '“Here is your crust, philosopher—” (The footstool catches you across the shoulder. The hall laughs — most of it. The young man by the pillar grips his spear and, at your glance, lets it go.)',
      do: () => { P.damage(5); },
      opts: [['(Endure. As agreed. Count the exits, count the men.)', () => {
        obj('Speak with Queen Penelope.', { x: penelope.group.position.x, z: penelope.group.position.z });
        penelope.getDialog = () => 'pen1';
        return true;
      }]],
    },
    pen1: {
      sp: 'Penelope',
      text: '“They tell me you have wandered far, old guest. I ask every traveller — forgive a foolish woman her one question. In all your roads... did you ever cross a man called ODYSSEUS, of Ithaca?”',
      opts: [
        ['I hosted him in Crete, on his way to Troy. He wore a purple cloak, doubled, pinned with a golden brooch: a hound throttling a dappled fawn. The women could not stop looking at it.', 'pen2'],
        ['He is alive, lady. And nearer than any man in this hall would like.', 'pen2b'],
      ],
    },
    pen2: {
      sp: 'Penelope',
      text: '(She weeps without letting her face know it — you watch your wife grieve for you at arm\'s length, and hold still.) “That cloak I folded myself. That brooch I pinned at his shoulder... You HAVE seen him. For that, old father, you are no beggar in this house.”',
      next: 'pen3',
    },
    pen2b: {
      sp: 'Penelope',
      text: '“Nearer.” (For one instant she looks at you — through the rags, through the grey — and something almost surfaces. Then it drowns.) “Twenty years of ‘nearer,’ old father. Hope is the cruelest guest at this table.”',
      next: 'pen3',
    },
    pen3: {
      sp: 'Penelope',
      text: '“I can wait no longer — my parents press me, my son\'s estate bleeds. So hear me, all of you!” (Her voice fills the hall.) “I will bring out the GREAT BOW of Odysseus. Whoever strings it, and shoots an arrow through the helve-sockets of twelve axes — him I follow. Tomorrow I leave this house I dreamed in.”',
      opts: [['(The suitors surge toward the bow. An old nurse plucks your sleeve — “Your feet, guest. It is the custom.”)', 'clea1']],
    },
    clea1: {
      sp: 'Eurycleia',
      text: '(The old nurse washes your feet by the fire, grumbling kindly — then her hands stop on the long white seam above your knee.) “This scar... the boar on Parnassus, when you were a boy — I nursed you, I know it as I know my own hands. You are— you are—”',
      opts: [['(Grip her wrist. Quietly:) Nurse. You will unmake us both. Not one word — until the bow speaks first.', 'clea2']],
    },
    clea2: {
      sp: 'Eurycleia',
      text: '“...My child is home.” (It is a whisper into the wash-water. Her face closes over the secret like the sea over a stone.) “The bow, then. I will bar the women\'s doors, whatever noise comes.”',
      opts: [['(watch the suitors try)', () => { bowContest(); return true; }]],
    },
    eurym1: {
      sp: 'Eurymachus',
      text: '“It was ANTINOUS! All of it — his plots, his stool, his poison! He lies dead and that is justice — spare the rest of us, and we will repay you, twenty oxen each, bronze and gold till your heart is warm!”',
      opts: [['Not for all your fathers\' gold. You ate a living man\'s house and courted a living man\'s wife. Fight, or die running.', () => { startFight(); return true; }]],
    },
    pentest1: {
      sp: 'Penelope',
      text: '(The hall is quiet. She comes down the stair and studies you across the room she has defended for twenty years.) “If you are truly he... you will not mind. Eurycleia — move the great bed out of the bridal chamber, and spread it soft, outside the room he built.”',
      opts: [
        ['WOMAN — who has MOVED my bed? I built it with my own hands around a living olive tree; its trunk is a bedpost; no man alive could shift it without cutting the root. Has someone cut my tree?', 'pentest_yes'],
        ['As you wish. A bed is a bed, wherever it stands.', 'pentest_no'],
      ],
    },
    pentest_no: {
      sp: 'Penelope',
      text: '“Then you are not my husband.” (Ice, and the stair.) “The man who built that bed knows why it cannot be moved. Guards of my heart, hold — try once more, stranger, if you dare.”',
      opts: [['(think — the bed... the OLIVE TREE)', 'pentest1']],
    },
    pentest_yes: {
      sp: 'Penelope',
      text: '(Her knees go. The test breaks HER, not you.) “No one has cut it. No one has seen it — only you, and I, and one serving-girl. Do not be angry — twenty years I armored myself against clever men and their stories. ODYSSEUS. You are home.”',
      opts: [['(cross the room)', () => { finale(); return true; }]],
    },
  };

  function telemArrives() {
    endDialog();
    telemachus = new NPC({
      name: 'Telemachus', model: PRESETS.telemachus(),
      x: LOC.hutFront.x + 10, z: LOC.hutFront.z + 8, wanderR: 0,
    });
    talkable(telemachus);
    telemachus.walkTo(LOC.hutFront.x + 2, LOC.hutFront.z + 1, () => {
      eumaeus.getDialog = () => null;
      eumaeus.walkTo(LOC.hut.x - 8, LOC.hut.z - 10, () => {
        eumaeus.group.position.set(LOC.pigPen.x, groundHeight(LOC.pigPen.x, LOC.pigPen.z), LOC.pigPen.z);
        eumaeus.home = { x: LOC.pigPen.x, z: LOC.pigPen.z };
      });
      telemachus.getDialog = () => 'telem1';
      obj('Speak with Telemachus.', { x: telemachus.group.position.x, z: telemachus.group.position.z });
    });
  }

  function bowContest() {
    endDialog();
    G.world.showAxes(true);
    obj('The suitors try the bow...', LOC.bowRack);
    let t = 0;
    const fails = [
      [suitors[3], 'Amphinomus warms it, waxes it, heaves — it does not bend a finger\'s width.'],
      [suitors[2], 'Ctesippus strains until his face goes purple. The bow only creaks, amused.'],
      [suitors[1], 'Eurymachus turns it by the fire, ashamed: “Not the marriage I grieve — but to be so much LESS than Odysseus...”'],
    ];
    let i = 0;
    tick = dt => {
      t -= dt;
      if (t <= 0 && i < fails.length) {
        fails[i][0].say(fails[i][1], 5.5);
        i++; t = 6;
      } else if (i >= fails.length) {
        tick = null;
        antinous.say('Enough! Tomorrow we sacrifice to Apollo and try again. More wine!', 5);
        addInteract({
          id: 'bow', pos: () => ({ x: LOC.bowRack.x, y: 8.5, z: LOC.bowRack.z }), r: 3,
          label: 'Take up the great bow ("Give the old beggar a try...")',
          when: () => !G.flags.hasBow,
          use: () => takeBow(),
        });
        obj('Take up the great bow of Odysseus.', LOC.bowRack);
      }
    };
  }

  async function takeBow() {
    setFlag('hasBow');
    G.world.hideBowRack();
    await UI.narrate([
      'Antinous howls — “The BEGGAR? Give him the bow and next he\'ll want the queen!” But Telemachus\' voice cracks across the hall like a whip: “The bow is MINE to give. Hand it to him.”',
      'You turn the great bow over slowly, this way and that — as a bard examines a lyre — while the suitors jeer. Then, without rising from the stool, you string it in one motion.',
      'You pluck the cord. It sings like a swallow. Somewhere above the smoke-hole, thunder rolls out of a clear sky. The laughter dies all at once.',
    ]);
    sfx('thunder');
    // aim challenge
    G.player.setWeapon('bow');
    const from = LOC.axeShootFrom;
    G.player.teleport(from.x, from.z, Math.PI / 2); // face +x down the axe line
    G.player.yaw = -Math.PI / 2;
    G.player.pitch = 0.02;
    G.mode = 'aim';
    UI.crosshair(true);
    obj('Loose an arrow through all twelve axes. (aim with mouse, click to shoot)', null);
    const rings = G.world.axePos.map(a => ({ ...a, hit: false }));
    G.aimAssist = {
      origin: { x: rings[0].x - 5, y: rings[0].y, z: rings[0].z },
      dir: { x: 1, y: 0, z: 0 },
      cone: 0.16,
    };
    G.axeChallenge = {
      rings,
      onResult: n => {
        if (n >= 12) {
          G.axeChallenge = null;
          G.aimAssist = null;
          UI.crosshair(false);
          G.mode = 'walk';
          theReveal();
        } else {
          UI.toast(`The arrow passed ${n} of 12 axes. The hall holds its breath — try again.`);
        }
      },
    };
  }

  async function theReveal() {
    sfx('thunder');
    await UI.narrate([
      'Clean through — all twelve, from the first helve-socket to the last, and the arrow stands quivering in the door.',
      '“Telemachus,” you say, into the silence, “your guest has not shamed you.” And you nod. The sign.',
      'You strip the rags from your shoulders and leap onto the great threshold with the bow and the full quiver, and pour the arrows out at your feet.',
      '“The contest is ended. Now I shoot at another mark, that no man ever hit before.” — Antinous is lifting a golden two-eared cup. The arrow takes him through the throat.',
    ]);
    // Antinous falls
    antinous.getDialog = () => null;
    setPose(antinous.group, 'dead');
    antinous.fixed = true;
    antinous.barks = [];
    G.player.setDisguise(false);
    G.player.setWeapon('sword');
    UI.toast('DOGS! You thought I would never come home from Troy!');
    runDialog('eurym1', suitors[1]);
  }

  function startFight() {
    endDialog();
    // suitor NPCs → enemies
    const spots = suitors.slice(1).map(s => ({ name: s.name, x: s.group.position.x, z: s.group.position.z }));
    suitors.slice(1).forEach(s => s.remove());
    penelope.getDialog = () => null;
    penelope.group.visible = false; // she withdraws upstairs
    if (penelope.tag) penelope.tag.el.style.display = 'none';
    eurycleia.group.visible = false;
    spawnFight(spots);
    obj('Cut down the suitors — Telemachus fights at your side!', null);
    G.onPlayerDeath = () => {
      UI.fade(true).then(() => {
        G.player.hp = G.player.maxhp;
        UI.setHP(1);
        clearEnemies();
        G.player.teleport(LOC.palaceDoor.x, LOC.palaceDoor.z + 8, 0);
        spawnFight(spots);
        UI.fade(false);
        UI.toast('Athena shields you from the spears — stand up, and finish it.');
      });
    };
  }

  function spawnFight(spots) {
    G.allies = [];
    for (const s of spots) {
      new Enemy({ name: s.name, model: PRESETS.suitor(), x: s.x, z: s.z, hp: 42, dmg: 8 });
    }
    if (telemachus) {
      telemachus.getDialog = () => null;
      telemachus.group.position.set(LOC.hearth.x - 4, groundHeight(LOC.hearth.x - 4, LOC.hearth.z - 2), LOC.hearth.z - 2);
      giveProp(telemachus.group, 'sword');
      G.allies.push(new Ally(telemachus));
    }
    G.onEnemyDeath = () => {
      if (G.enemies.every(e => e.dead)) {
        G.onEnemyDeath = null;
        G.allies = [];
        if (telemachus) telemachus.fixed = true;
        setTimeout(() => afterFight(), 1200);
      }
    };
  }

  async function afterFight() {
    G.onPlayerDeath = defaultDeath;
    await UI.narrate([
      'It is over. The hall smokes with it. Telemachus leans on his spear, alive; old Eurycleia stands in the doorway and begins to cry out in triumph — you stop her. “No gloating over the slain. The gods\' doom and their own hard hearts destroyed them.”',
      'The hall is cleansed with sulfur and fire. And on the stair, unconvinced by twenty years of clever strangers, stands Penelope.',
    ]);
    penelope.group.visible = true;
    if (penelope.tag) penelope.tag.el.style.display = '';
    penelope.group.position.set(LOC.throne.x, groundHeight(LOC.throne.x, LOC.throne.z) , LOC.throne.z);
    penelope.home = { x: LOC.throne.x, z: LOC.throne.z };
    penelope.getDialog = () => 'pentest1';
    obj('One test remains. Speak with Penelope.', LOC.throne);
  }

  async function finale() {
    endDialog();
    await UI.fade(true);
    await UI.narrate([
      'She runs to you and throws her arms around your neck, and you hold your wife and weep — the way land looks to swimmers whose ship Poseidon has smashed, when they crawl at last out of the grey water.',
      'Athena holds back the Dawn at the edge of the world, and makes the night long.',
      'Tomorrow: your father Laertes\' orchard, the suitors\' kinsmen, and one last flash of the grey-eyed goddess — “Hold! Break off this feud” — and peace, sworn on the spot where every journey ends.',
      'ΝΟΣΤΟΣ — the homecoming. In the twentieth year, the man of twists and turns is home.',
      '<b style="letter-spacing:.3em;color:#d9b45b">THE END</b>',
    ]);
    try { localStorage.removeItem('odyssey_chapter'); } catch (e) {}
    location.reload();
  }
}
