# Fairy Tale Kingdom — Roadmap

Long-term phased vision.

| Phase | Name | Goal |
| ----- | ---- | ---- |
| 0 | Foundation | App scaffold, Phaser shell, Knowledge Quest / GitHub Pages wiring, this roadmap |
| 1 | Graphics | Pixel art style guide, sprite sheets, tileset, basic idle/walk animations for the core cast |
| 2 | Living subjects | Named people, roles, schedules, click-to-inspect (Stronghold-style inspector) |
| 3 | Learn-to-earn | Question panel via `@knowledge-quest/learning`; gold rewards; persist gold |
| 3.5 | Kingdom meta + danger lite | Named kingdom, days played, new-kingdom menu, raids (steal gold / army lose) |
| 4 | Marketplace and buildings | Buy peasants/guards/archers/etc. and place houses/walls/tavern/keep |
| 5 | Living world and danger | Richer camps, defense that matters, deeper raid AI |
| 6 | Depth and polish | Richer schedules, more roles, save kingdom layout, audio, UX |

## Phase 0–3 (done)

Foundation, graphics, living subjects, learn-to-earn (questions + gold + night HUD).

## Phase 3.5 — Kingdom meta + danger lite (current)

Checklist:

- [x] Persist kingdom name + days played (`fairyTaleKingdom.kingdom`)
- [x] Show name + day count in the HUD tagline
- [x] Hamburger menu to start a new kingdom (resets gold + days)
- [x] First-run naming gate before the map loads
- [x] Day clock rollover increments days played
- [x] Bandits / giants march on the keep and steal gold
- [x] Rival kingdom army reaching the keep = game over

## Phase 4 — Marketplace (next)

Hire units and place buildings with gold.

## Non-goals (for now)

- Full combat / intercepting raids with your guards (Phase 5)
- Multiplayer / auth
- Hand-drawn PNG production

## Product north star

A **watchable** fairy-tale kingdom: subjects live their day, you inspect them, answer Knowledge Quest questions for gold, then spend gold to grow and defend the realm.
