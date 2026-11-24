# VICE BAY — Open World Crime

A complete open-world crime game in the spirit of GTA 6, playable offline in a
desktop browser. Built with three.js (vendored, no network) and plain
JavaScript. All art, city, characters, story and sound are original — no
Rockstar Games name, logo, character, map or asset.

## Play

Serve `game/` statically (or open `game/index.html` from any static server)
and click **START ENGINE**:

```
node serve.ts          # then open http://localhost:8080
```

No build step, no network request, no account. Your cash and completed
missions save in `localStorage`.

## The game

Fresh out of prison, Danny Cole is back in Vice Bay with nothing but a debt
and a name to rebuild. Steal cars, outrun the Vice Bay PD, run jobs for Mama
Rosa, and take the city back — one getaway at a time.

- **Open city** — a procedural sunset city: 8×8 blocks, downtown towers,
  beachfront hotels, a pier, a park, a parking lot, palm trees and
  streetlights. Seeded, so every visit is the same city.
- **On foot and by car** — third-person walking with jump and punch, and
  arcade driving with steering, handbrake and car damage. Press `E` near any
  car to steal it.
- **Traffic and pedestrians** — cars drive the road grid and stop for each
  other; pedestrians walk the sidewalks and flee when hit.
- **Wanted system** — 1–5 stars for stealing cars, assault and running
  people over. Police cars chase and ram you; break line of sight to cool
  off. Get caught on foot and you're **BUSTED**; lose all health and you're
  **WASTED**.
- **4 story missions** — Hot Wheels, Package Run, Heat and The Big Score,
  briefed by phone from Mama Rosa, with a yellow beacon, minimap blips and
  cash rewards. Finish all four for the story bonus.
- **HUD** — cash, health, car condition, wanted stars, clock, speed, mission
  objective with distance, and a live minimap with police and mission blips.
- **Sound** — fully synthesized WebAudio: engine hum, sirens, crashes,
  mission jingles. `M` mutes.
- **Adaptive quality** — the game lowers render resolution and shadows on
  weak GPUs so it stays playable.

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Move / drive |
| Mouse drag | Orbit camera (wheel zooms) |
| Shift | Run |
| Space | Jump (on foot) / handbrake (driving) |
| E | Enter / exit car |
| F | Punch |
| P / Esc | Pause |
| M | Mute |

## Files

- `game/index.html` — the game page (HUD + screens)
- `game/src/` — `main.js` (boot/loop/camera), `game.js` (simulation),
  `city.js` (procedural city), `missions.js` (story), `hud.js` (HUD/minimap),
  `audio.js` (synth sound), `shots.js` (deterministic screenshot scenes),
  `util.js` (seeded RNG + geometry helpers)
- `game/vendor/three.module.min.js` — three.js r160, vendored
- `main.ts` — the make.fun entry program: copies `game/` + `screenshots/`
  to `/output` and writes `dossier.json`
- `screenshots/` — 1-start, 2-drive, 3-foot, 4-mission (the cover is first)

## Screenshots

The `?shot=` scenes stage real play deterministically (fixed seed 1337):

- `?shot=start` — title screen over the city
- `?shot=drive` — police chase down the avenue
- `?shot=foot` — on foot in Starfish Plaza
- `?shot=mission` — the Package Run, driving onto the docks

## License

MIT — see `LICENSE`.
