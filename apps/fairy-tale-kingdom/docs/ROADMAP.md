# Fairy Tale Kingdom — Roadmap

Long-term phased vision.

| Phase | Name | Goal |
| ----- | ---- | ---- |
| 0 | Foundation | App scaffold, Phaser shell, Knowledge Quest / GitHub Pages wiring, this roadmap |
| 1 | Graphics | Pixel art style guide, sprite sheets, tileset, basic idle/walk animations for the core cast |
| 2 | Living subjects | Named people, roles, schedules, click-to-inspect (Stronghold-style inspector) |
| 3 | Learn-to-earn | Question panel via `@knowledge-quest/learning`; gold rewards; persist gold |
| 4 | Marketplace and buildings | Buy peasants/guards/archers/etc. and place houses/walls/tavern/keep |
| 5 | Living world and danger | Goblin/giant/bandit camps; raid events; defense that matters |
| 6 | Depth and polish | Richer schedules, more roles, save kingdom layout, audio, UX |

## Phase 0 — Foundation (done)

- React + Vite + TypeScript + Phaser 3 app
- Host / Pages wiring + shared settings load

## Phase 1 — Graphics (done)

- Style guide + procedural tileset / cast / props
- Pixel art config + panable tilemap

See also [STYLE_GUIDE.md](STYLE_GUIDE.md).

## Phase 2 — Living subjects (done)

- Named subjects with roles and day schedules
- Click-to-inspect React panel + selection bridge
- Day clock driving activities

## Phase 3 — Learn-to-earn (current)

Checklist:

- [x] Live Question panel via `createCurriculumRegistry` + shared settings
- [x] +3 gold per correct answer; wrong keeps the question
- [x] Persist gold (`fairyTaleKingdom.gold`)
- [x] Read-aloud + replay when enabled
- [x] Night darkening overlay from day clock
- [x] HUD title shows time of day (not brand name); inspector has no clock line

## Non-goals (Phase 0–3)

- Full Dwarf Fortress–depth simulation
- Multiplayer / auth
- Marketplace spending / building placement (Phase 4)
- Combat / raids (Phase 5)

## Product north star

A **watchable** fairy-tale kingdom: subjects live their day, you inspect them, answer Knowledge Quest questions for gold, then spend gold to grow and defend the realm.
