# Solmar Bay 3D

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Skynzy27/gta6-01-v3/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Skynzy27/gta6-01-v3/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A 3D open-world crime game for the [make.fun](https://make.fun) competition
**gta6-01 "Make GTA 6"** ($1,666, top 100 paid). Built with Three.js
(vendored locally, no CDN at runtime) and plain JavaScript. Runs fully
offline in a desktop browser from its own files.

## The game

Solmar Bay is a sun-soaked neon island city. Drive a pink sports car through
palm-lined boulevards, steal cars, outrun the police under a helicopter
spotlight, and work through 7 story jobs with named characters, dialogue,
and a full city map.

- **Drive and walk**: arcade driving with handbrake drift, third-person
  on-foot movement, car theft, traffic cars and pedestrians.
- **Wanted 0–5 stars**: crimes raise heat; it only fades when you are hidden.
  Police cars pursue, ram, and set roadblocks; a helicopter joins the chase
  and its spotlight keeps you spotted.
- **Story jobs**: 7 named chapters (Low Tide, Cold Cargo, Undertow,
  Blue Lights, Paper Moon, Causeway Run, Last Light) with objectives,
  dialogue, and cash rewards.
- **Combat**: fists, pistol, and SMG with mouse aim.
- **HUD**: money, wanted stars, circular minimap, speed, radio stations,
  weapon slots, mission panel, and dialogue box.
- **Radio**: three synth stations (WebAudio, no audio files), engine hum,
  and police sirens.
- **Save**: progress, money, and jobs persist in localStorage.
- **Map**: a full city map (M) with districts, job list, and legend.

## Controls

| Key | Action |
| --- | --- |
| WASD | Walk / drive |
| Mouse | Aim, click to shoot |
| Shift | Sprint |
| Space | Handbrake drift |
| F | Enter / steal a vehicle |
| E | Interact / next objective |
| Q | Previous radio station |
| R | Reload |
| 0–4 | Weapons |
| V | Chase / classic camera |
| M / Esc | City map / pause |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

Or open `game/index.html` through any static file server. No build step,
no network requests at runtime.

## Layout

- `game/` — the game: `index.html`, vendored `three.min.js`, `src/`
  (`config`, `audio`, `world`, `vehicles`, `characters`, `police`,
  `missions`, `hud`, `input`, `main`).
- `screenshots/` — 4 screenshots of the game itself (cover first).
- `main.ts` — entry program: copies `game/` + `screenshots/` to `/output`
  and writes `dossier.json`.
- `vendor/makefun-game.ts` — the make.fun dossier library (unchanged).

## License

MIT — see [LICENSE](LICENSE).
