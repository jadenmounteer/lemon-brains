# Fairy Tale Kingdom — Roadmap

Long-term phased vision. **Phase 0** is the current foundation milestone.

| Phase | Name | Goal |
| ----- | ---- | ---- |
| 0 | Foundation | App scaffold, Phaser shell, Knowledge Quest / GitHub Pages wiring, this roadmap |
| 1 | Graphics | Pixel art style guide, sprite sheets, tileset, basic idle/walk animations for the core cast |
| 2 | Living subjects | Named people, roles, schedules, click-to-inspect (Stronghold-style inspector) |
| 3 | Learn-to-earn | Question panel via `@knowledge-quest/learning`; gold rewards; persist gold |
| 4 | Marketplace and buildings | Buy peasants/guards/archers/etc. and place houses/walls/tavern/keep |
| 5 | Living world and danger | Goblin/giant/bandit camps; raid events; defense that matters |
| 6 | Depth and polish | Richer schedules, more roles, save kingdom layout, audio, UX |

## Phase 0 (this milestone)

- React + Vite + TypeScript + Phaser 3 app at `apps/fairy-tale-kingdom`
- React HUD: title, gold stub, back to Knowledge Quest, Questions / Marketplace stubs
- Empty panable kingdom ground (no custom pixel art yet)
- Shared settings load via `@knowledge-quest/storage` (ready for later question UI)
- Enabled on the Knowledge Quest games list and included in `npm run build:pages`

## Non-goals (Phase 0–1)

- Full Dwarf Fortress–depth simulation
- Multiplayer
- Auth / accounts
- Combat systems, AI schedules, or shop purchases (start in later phases)
- Pixel art production is Phase 1, not Phase 0

## Product north star

A **watchable** fairy-tale kingdom: subjects live their day, you inspect them, answer Knowledge Quest questions for gold, then spend gold to grow and defend the realm.
