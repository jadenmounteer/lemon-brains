# Fairy Tale Kingdom — Roadmap

Long-term phased vision.

| Phase | Name                       | Goal                                                                                                                                                                                                                                                                                                                                                                         |
| ----- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Foundation                 | App scaffold, Phaser shell, Knowledge Quest / GitHub Pages wiring, this roadmap                                                                                                                                                                                                                                                                                              |
| 1     | Graphics                   | Pixel art style guide, sprite sheets, tileset, basic idle/walk animations for the core cast                                                                                                                                                                                                                                                                                  |
| 2     | Living subjects            | Named people, roles, schedules, click-to-inspect (Stronghold-style inspector)                                                                                                                                                                                                                                                                                                |
| 3     | Learn-to-earn              | Question panel via `@knowledge-quest/learning`; gold rewards; persist gold                                                                                                                                                                                                                                                                                                   |
| 3.5   | Kingdom meta + danger lite | Named kingdom, days played, new-kingdom menu, raids (steal gold / army lose)                                                                                                                                                                                                                                                                                                 |
| 4     | Marketplace and buildings  | Hire units into houses; place house/wall/tavern; building effects                                                                                                                                                                                                                                                                                                            |
| 5     | Combat and defenses        | HP, pathing/breach, drawbridge, stairs, pillage + flee, combat AI                                                                                                                                                                                                                                                                                                            |
| 6     | Tasks, repair, keep siege  | Schedule interrupts; peasant repair; army must destroy keep; street chat                                                                                                                                                                                                                                                                                                     |
| 7     | Economy and royalty        | Fields/food, sickness, royal units, upgrade buildings, capture/ransom, wave buffs                                                                                                                                                                                                                                                                                            |
| 8     | Medieval sieges            | Connectable walls/gates, trebuchets, catapults, battering rams, formation siege AI, field burning, morale rout, ballista/watchtower, siege VFX                                                                                                                                                                                                                               |
| 9     | Monsters                   | Dragons, knights, named roaming monsters with schedules. Terrain (ocean, rivers, lakes, forests, mountains). Knights slay dragons if they are asleep in their caves. Monsters have names. Unique dragons, some with two heads. Dragons also steal gold from keep. Trolls, ogres with unique abilities, animations, and schedules. |
| 10    | Kingdom depth              | Multi-keep royalty, royal balls, festivals, dungeon/thieves, larger map/interiors                                                                                                                                                                                                                                                                                            |
| 11    | Escalating war             | Difficulty over days, faction armies, generals, encampments                                                                                                                                                                                                                                                                                                                  |
| 12    | Evolving world             | More uniqueness to the evolving world                                                                                                                                                                                                                                                                                                                                        |

## Phase 0–8 (done)

Foundation through economy, royalty, and medieval sieges (walls, engines, rout, defenses).

## Phase 9 — Monsters (current)

Checklist:

- [x] Biome tiles: water, forest, mountain; lakes/river/forest/mountain patches; PathGrid blocks water/mountain
- [x] Cave props + cave zones for dragon lairs
- [x] Camera zoom (scroll wheel, clamped)
- [x] Hireable knights (marketplace); military combat; hunt sleeping dragons
- [x] Named roaming monsters (troll, ogre, dragon) with schedules; two-headed dragons; persist
- [x] Kingdom effects: troll scare/regen, ogre smash, dragon gold steal + breath
- [x] Inspect monsters; toasts; ROADMAP updated

## Phase 10 — next

Multi-keep royalty, royal balls, festivals, dungeon/thieves, larger buildings/interiors.

## Non-goals (for now)

- Manual combat orders
- Enemies climbing stairs
- Manual repair / demolish tools
- Rebuild destroyed buildings from ashes
- Multiplayer / auth

## Product north star

A **watchable** fairy-tale kingdom: subjects live their day, you inspect them, answer Knowledge Quest questions for gold, then spend gold to grow and defend the realm.
