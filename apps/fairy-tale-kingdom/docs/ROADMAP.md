# Fairy Tale Kingdom — Roadmap

Long-term phased vision.

| Phase | Name                       | Goal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Foundation                 | App scaffold, Phaser shell, Knowledge Quest / GitHub Pages wiring, this roadmap                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 1     | Graphics                   | Pixel art style guide, sprite sheets, tileset, basic idle/walk animations for the core cast                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2     | Living subjects            | Named people, roles, schedules, click-to-inspect (Stronghold-style inspector)                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 3     | Learn-to-earn              | Question panel via `@knowledge-quest/learning`; gold rewards; persist gold                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 3.5   | Kingdom meta + danger lite | Named kingdom, days played, new-kingdom menu, raids (steal gold / army lose)                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 4     | Marketplace and buildings  | Hire units into houses; place house/wall/tavern; building effects                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 5     | Combat and defenses        | HP, pathing/breach, drawbridge, stairs, pillage + flee, combat AI                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 6     | Depth and polish           | Richer schedules, more roles, save polish, audio, UX                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 7     | Economy and royalty        | Fields/food, sickness, royal units, upgrade buildings. Fairy god mother makes princesses. If you have a king and queen, you can buy better units/buildings. If you have a prince and princess, they make units more effective and production, combat for a short period if they wave to them. Royalty can be captured by enemies and held for ransom until you pay. Fairy god mothers can make peasants into new princesses. A prince appears if you have a king and queen after a short amount of time. |

## Phase 0–4 (done)

Foundation through marketplace: hire into beds, place buildings, layout persistence, steal/army lose.

## Phase 5 — Combat and defenses (current)

Checklist:

- [x] HP on buildings, subjects, raiders; destroy/remove at 0; keep HP tracked
- [x] PathGrid pathfinding; walls / closed drawbridges block; breach then repath
- [x] Drawbridge (50g) — open peacetime, auto-close during raids
- [x] Stairs (20g) — snap to wall; friendlies climb; archers +50% range / +25% damage on wall
- [x] Raiders pillage (kill units / burn house·tavern·stairs) en route
- [x] Peasants flee; guards melee; archers ranged
- [x] Edge camp markers; layout persists HP / onWall / attachedWallId

## Phase 6 — next

Richer schedules, audio, UX polish.

## Non-goals (for now)

- Manual combat orders
- Enemies climbing stairs
- Repair / demolish tools
- Multiplayer / auth

## Product north star

A **watchable** fairy-tale kingdom: subjects live their day, you inspect them, answer Knowledge Quest questions for gold, then spend gold to grow and defend the realm.
