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
| 7     | Economy and royalty        | Fields/food, sickness, royal units, upgrade buildings, capture/ransom, wave buffs                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 8     | Medieval sieges            | Trebuchets, catapults, battering rams, formation siege AI, field burning                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 9     | Monsters                   | Dragons, knights, named roaming monsters with schedules                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

## Phase 0–6 (done)

Foundation through combat, building inspect, interrupts, keep siege, peasant repair.

## Phase 7 — Economy and royalty (current)

Checklist:

- [x] Fields + food store/HUD; harvest production; granary bonus
- [x] Food consumption; hunger → sickness → death; low-food harvest interrupt
- [x] King, Queen, Prince (auto), Fairy Godmother, Princess (transform)
- [x] King+Queen unlock barracks, granary, manor, elite troops
- [x] Prince+Princess wave buffs (food + combat)
- [x] Army capture royals + ransom panel; persist captives
- [x] New kingdom resets food/captives; Game Over copy updated

## Phase 8 — next

Medieval siege engines and smarter army strategies.

## Non-goals (for now)

- Manual combat orders
- Enemies climbing stairs
- Manual repair / demolish tools
- Rebuild destroyed buildings from ashes
- Multiplayer / auth

## Product north star

A **watchable** fairy-tale kingdom: subjects live their day, you inspect them, answer Knowledge Quest questions for gold, then spend gold to grow and defend the realm.
