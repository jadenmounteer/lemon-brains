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
| 6     | Tasks, repair, keep siege  | Schedule interrupts; peasant repair; army must destroy keep; street chat                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 7     | Economy and royalty        | Fields/food, sickness, royal units, upgrade buildings. Fairy god mother makes princesses. If you have a king and queen, you can buy better units/buildings. If you have a prince and princess, they make units more effective and production, combat for a short period if they wave to them. Royalty can be captured by enemies and held for ransom until you pay. Fairy god mothers can make peasants into new princesses. A prince appears if you have a king and queen after a short amount of time. |

8 Medeival seiges. Trebucheis, catapults, archers, batter rams, enemy army seige strategies. Your kingdom uses realistic defense strategies as well. Rather than tower defense mode, they line up without the walls and then the enemy uses strategy to focus their efforts on the walls or storm through the gates and raid and pillage and take the keep.

## Phase 0–5 (done)

Foundation through combat: HP, pathing/breach, drawbridge, stairs, pillage, flee, building inspect, HUD pop.

## Phase 6 — Tasks, repair, keep siege (current)

Checklist:

- [x] Enemy army must siege keep to 0 HP to win (no instant touch-lose)
- [x] Bandits/giants still steal gold on keep reach
- [x] Interrupt priority: flee → combat → repair → chat → schedule
- [x] Peasants repair damaged buildings and keep; cancel on raid
- [x] Lightweight peacetime street chat between nearby free subjects

## Phase 7 — next

Economy (fields/food) and royalty systems.

## Non-goals (for now)

- Manual combat orders
- Enemies climbing stairs
- Manual repair / demolish tools
- Rebuild destroyed buildings from ashes
- Multiplayer / auth

## Product north star

A **watchable** fairy-tale kingdom: subjects live their day, you inspect them, answer Knowledge Quest questions for gold, then spend gold to grow and defend the realm.
