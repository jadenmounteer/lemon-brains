# Fairy Tale Kingdom — Roadmap

Long-term phased vision.

| Phase | Name | Goal |
| ----- | ---- | ---- |
| 0 | Foundation | App scaffold, Phaser shell, Knowledge Quest / GitHub Pages wiring, this roadmap |
| 1 | Graphics | Pixel art style guide, sprite sheets, tileset, basic idle/walk animations for the core cast |
| 2 | Living subjects | Named people, roles, schedules, click-to-inspect (Stronghold-style inspector) |
| 3 | Learn-to-earn | Question panel via `@knowledge-quest/learning`; gold rewards; persist gold |
| 3.5 | Kingdom meta + danger lite | Named kingdom, days played, new-kingdom menu, raids (steal gold / army lose) |
| 4 | Marketplace and buildings | Hire units into houses; place house/wall/tavern; building effects |
| 5 | Living world and danger | Richer camps, defense that matters, deeper raid AI |
| 6 | Depth and polish | Richer schedules, more roles, save polish, audio, UX |

## Phase 0–3.5 (done)

Foundation through kingdom meta, night HUD, learn-to-earn, and danger-lite raids.

## Phase 4 — Marketplace and buildings (current)

Checklist:

- [x] Live Marketplace hire/build catalog with prices
- [x] Gold `spend` API
- [x] Houses provide 3 beds; hire requires a free bed in a specific house
- [x] Subjects store `houseId`; home schedule + inspector “Lives at House N”
- [x] Free placement with overlap rejection (keep / buildings / units)
- [x] Walls slow raiders; taverns cut steal by 25%
- [x] Layout persistence (`fairyTaleKingdom.layout`); cleared on new kingdom

## Phase 5 — next

Richer camps, intercept/defense that matters.

## Non-goals (for now)

- Killing raiders / full combat AI
- Extra keep / demolishing houses
- Multiplayer / auth

## Product north star

A **watchable** fairy-tale kingdom: subjects live their day, you inspect them, answer Knowledge Quest questions for gold, then spend gold to grow and defend the realm.
