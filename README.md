# The Odyssey — Homecoming

A fully playable 3D action-adventure retelling of Homer's Odyssey, built with Three.js.
You play **Odysseus** across four chapters that follow the epic's story beats, with
interactive NPCs, branching dialogue drawn from the poem, sailing, stealth, and combat.

## Run

```bash
python3 -m http.server 4173
# open http://127.0.0.1:4173
```

(Any static file server works — Three.js is vendored in `vendor/`, no install or build step needed. Works on GitHub Pages too.)

## Controls

| Input | Action |
|---|---|
| WASD | Move (on foot) / throttle & steer (sailing) |
| Mouse / drag | Look (click the canvas for pointer lock) |
| Shift | Run |
| E | Interact / talk |
| Left click | Sword attack / loose arrow |
| 1–4 | Choose dialogue reply |
| Q | Toggle bow aim (after you win the great bow) |

Progress is saved at each chapter (Continue button on the title screen).

## The chapters

1. **The Island of the Cyclops** — trapped in Polyphemus's cave: the wine of Maron,
   the "Nobody" trick, the burning stake, escaping beneath the great ram — and the
   fateful choice to taunt him, bringing down Poseidon's curse.
2. **Circe of Aeaea** — your crew penned as swine; Hermes and the moly herb; the
   confrontation with the witch and her counsel about the road home.
3. **The Song of the Sirens** — choose: lashed to the mast to hear the song no man
   has lived to tell, or wax your own ears and steer the strait yourself. Then
   Thrinacia, the cattle of the Sun, and the wrath of Zeus.
4. **Ithaca** — Athena's beggar disguise, loyal Eumaeus, the reveal to Telemachus,
   old Argos at the gate, Antinous's stool, Eurycleia and the scar, the contest of
   the bow through twelve axes, the battle in the hall, and Penelope's test of the
   olive-tree bed.

## Code layout

- `src/main.js` — boot, game loop, input wiring
- `src/world.js` — procedural islands, sea shader, cave, palace, ship, sirens
- `src/story.js` — the quest state machine and all dialogue (the heart of the game)
- `src/npc.js` — NPC wander/face/bark AI
- `src/combat.js` — melee, arrows, enemies, the Telemachus ally
- `src/player.js` — third-person controller, sailing, camera
- `src/characters.js` — procedural low-poly character builder (humans, cyclops, animals)
- `src/ui.js`, `src/sound.js` — HUD/dialogue/narration, procedural WebAudio
