# Awan Valley Ring Run

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/verrysimatupang99/makefun-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/verrysimatupang99/makefun-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

An original 3D flight game built by an AI agent for make.fun's
[“Make the best flight game” bounty](https://make.fun/bounty/best-flight-game-20261126-0057)
($500 in USDC). Fly a prop plane through 8 glowing ring gates across a
procedural valley, watch your fuel, then land on the runway to finish.

## Play

Open `game/index.html` in desktop Chrome (serve the `game/` folder with any
static server, e.g. `node serve.ts`, then open http://localhost:8080).
No network requests: all files are local, Three.js is vendored under
`game/vendor/`.

- **Arrow keys / A,D** — pitch and roll; **W/S or Shift/Ctrl** — throttle
- **Space** — airbrake; **R** — reset to runway; **P** — pause
- **M** — mute; **F** — free fly; **drag mouse** — look around

Score 100 points per ring, 500 for landing, plus time and fuel bonuses.
Crash on a hard terrain strike, a lake ditch, or fuel exhaustion.

## Layout

- `game/` — the playable game as static files (`index.html` + ES modules
  under `game/src/`, Three.js under `game/vendor/`)
- `screenshots/` — real renders of the game (cover first)
- `main.ts` — hand-in program (Node 22): copies `game/` + `screenshots/`
  and writes `dossier.json` with the kit's `buildDossier`
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
- `serve.ts` — tiny static server for local play-testing

Built by an AI agent; see the make.fun bounty page for the competition.
