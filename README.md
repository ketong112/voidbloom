# VOIDBLOOM — a neon arena survival shooter

[![make.fun](https://img.shields.io/badge/make.fun-best--game--01-7c5cff)](https://make.fun/bounty/best-game-01)

You are the last Bloomkeeper, a living seed of light, defending the void
garden against the Blight. Survive the waves, pick a bloom upgrade after
each one, and face the Warden every 5th wave.

## Play

Open `game/index.html` in a desktop browser (or `node serve.ts`, then
http://localhost:8080). No build step, no network, no install.

- **WASD / arrows** — move
- **Mouse** — aim
- **Hold click / Space** — shoot
- **P** — pause, **M** — mute, **R** — restart
- **1 / 2 / 3 or click** — pick an upgrade after a cleared wave

## The game

- **Waves that grow**: motes chase you, dashers charge, spitters shoot from
  a ring, splitters burst into two motes, and the Warden (every 5th wave)
  fires radial bullet rings and seeds the garden with motes.
- **Upgrade drafts**: after every cleared wave, choose 1 of 3 blooms —
  Rapid Petals, Twin Bloom, Thorn Shield, Swift Roots, Magnet Pollen,
  Heart Seed, Piercing Thorns, Nova Burst.
- **Score attack**: kills chain a combo multiplier (up to x8); pollen is
  worth points, hearts heal. Best score is kept in the browser.
- **Feel**: particles, screen shake, slow-mo death, floating score text,
  and fully synthesised WebAudio sound (shots, explosions, pickups, a
  quiet ambient pad) — no audio files.

## Files

- `game/index.html` — the page; `game/src/main.js` — loop, states, collisions
- `game/src/config.js` — all tuning numbers; `game/src/random.js` — seeded RNG
- `game/src/input.js` — keyboard + mouse; `game/src/audio.js` — synth SFX
- `game/src/entities.js` — player, bullets, enemies, particles, pickups
- `game/src/waves.js` — wave director; `game/src/upgrades.js` — draft pool
- `game/src/render.js` — all canvas drawing; `game/src/ui.js` — screens + HUD
- `main.ts` — hands the game in to make.fun (copies `game/` + `screenshots/`,
  writes `dossier.json`); `vendor/makefun-game.ts` — make.fun's library
- `screenshots/` — real renders of the game: title, combat, upgrade draft,
  game over

## Entry

Built for [make.fun's "Make the best game" bounty](https://make.fun/bounty/best-game-01)
(`best-game-01`). Referral code: `dmgw15y1`.
