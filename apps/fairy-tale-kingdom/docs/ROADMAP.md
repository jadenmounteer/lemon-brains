# Fairy Tale Kingdom — Roadmap

Long-term phased vision.

| Phase | Name                       | Goal                                                                                                                                                                                                                                                                                                                              |
| ----- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Foundation                 | App scaffold, Phaser shell, Knowledge Quest / GitHub Pages wiring, this roadmap                                                                                                                                                                                                                                                   |
| 1     | Graphics                   | Pixel art style guide, sprite sheets, tileset, basic idle/walk animations for the core cast                                                                                                                                                                                                                                       |
| 2     | Living subjects            | Named people, roles, schedules, click-to-inspect (Stronghold-style inspector)                                                                                                                                                                                                                                                     |
| 3     | Learn-to-earn              | Question panel via `@knowledge-quest/learning`; gold rewards; persist gold                                                                                                                                                                                                                                                        |
| 3.5   | Kingdom meta + danger lite | Named kingdom, days played, new-kingdom menu, raids (steal gold / army lose)                                                                                                                                                                                                                                                      |
| 4     | Marketplace and buildings  | Hire units into houses; place house/wall/tavern; building effects                                                                                                                                                                                                                                                                 |
| 5     | Combat and defenses        | HP, pathing/breach, drawbridge, stairs, pillage + flee, combat AI                                                                                                                                                                                                                                                                 |
| 6     | Tasks, repair, keep siege  | Schedule interrupts; peasant repair; army must destroy keep; street chat                                                                                                                                                                                                                                                          |
| 7     | Economy and royalty        | Fields/food, sickness, royal units, upgrade buildings, capture/ransom, wave buffs                                                                                                                                                                                                                                                 |
| 8     | Medieval sieges            | Connectable walls/gates, trebuchets, catapults, battering rams, formation siege AI, field burning, morale rout, ballista/watchtower, siege VFX                                                                                                                                                                                    |
| 9     | Monsters                   | Dragons, knights, named roaming monsters with schedules. Terrain (ocean, rivers, lakes, forests, mountains). Knights slay dragons if they are asleep in their caves. Monsters have names. Unique dragons, some with two heads. Dragons also steal gold from keep. Trolls, ogres with unique abilities, animations, and schedules. |

| 10 | Kingdom depth | Multi-keep royalty, royal balls, festivals, dungeon/thieves, larger map/interiors | Add building interiors when units go inside buildings the roof disappears. Make buildings and map bigger. Royal balls and festivals happen randomly. Need a king and queen and prince for a royal ball. Fairy god mother makes a peasant a princess for a royal ball (add gender to units so fairy god mother can make female peasants princesses). If they meet a prince, they go to the cathedral to get married (must have a cathedral) and the princess remains a priness forever, otherwise, she turns back into a peasant at morning. Need to buy a cathedral. Need to have a bishop to have a cethedral. Royalty lives at keeps instead of houses. Each keep has a royal population for a family. Buying more keeps allows you to have more royalty. More keeps means less chance to lose as all keeps must be destroyed in order to lose.
|

| 11 | Escalating war | Difficulty over days, faction armies, generals, encampments | The more days you play, the more monsters spawn, the bigger the armies that beseige you, etc. Seiging armies make an encampment that spawns more troops for the siege. Each army has a general with special abilities and a name. Bandits, giants, goblins, etc have encampments that spawn more too. These units attack your units and buildings if you build too close. They also gear up for raids when they have enough units. This is where the raids come from. Goblin, giant, and bandit camps spawn randomly over time. You can hire a general if you get a barracks (elite troops also require a barracks). Building a barracks requires a king and queen. If the king and queen die, a married prince and princess become the new king and queen of that keep, otherwise you can hire more kings and queen. Clicking a general allows them to command the troops (guards and archers) and you can select how many to command, to attack and destroy encampments and monsters.

| 12 | Evolving world | More uniqueness to the evolving world | withces, witch hunters. Need a cathedral to hire witch hunters Witches turn pricnes into frogs, poison princesses with poison apples. Princesses can restore frogs to princes. Princes can restore princesses who have been poisoned. Witches form covens and spawn more witches.
| |

12.5 playing manual accessible via the hamburger menu. Shows the npc images and building images, explains what everything does. Shows you the gameplay mechanics (how to slay monsters, get a princess, restore a prince who has been turned into a frog, etc.)

- spooky mode.

- oceans - build docks and spawn fishing boats to gather food. Pirates to attack docs. Warships to defend your fishing boats. Peasants can have jobs (farmers, fishermen, bakers, etc.). Peasants enter the boats to go fishing. guards enter the warships to use them.

## Phase 0–9 (done)

Foundation through monsters, biomes, and procedural maps.

## Phase 10 — Kingdom depth (current)

Checklist:

- [x] Gender on subjects; FGM blesses female peasants only during royal balls (temp princess; morning revert)
- [x] Cathedral placeable; bishop hire requires cathedral; bishop marries prince + princess → permanent princess
- [x] Infirmary + physicians (plague-mask art); heal sick subjects
- [x] Granary required before fields; max 2 fields per granary
- [x] Multi-keep royalty (royals live at keeps); all-keeps lose condition; larger map
- [x] Building interiors / roof hide when occupied; larger building art
- [x] Random festivals; night thieves + dungeon capture
- [x] Marketplace gates, inspector, ROADMAP

## Phase 11 — next

Difficulty over days, faction armies, generals, encampments.

## Non-goals (for now)

- Manual combat orders
- Enemies climbing stairs
- Manual repair / demolish tools
- Rebuild destroyed buildings from ashes
- Multiplayer / auth

## Product north star

A **watchable** fairy-tale kingdom: subjects live their day, you inspect them, answer Knowledge Quest questions for gold, then spend gold to grow and defend the realm.
