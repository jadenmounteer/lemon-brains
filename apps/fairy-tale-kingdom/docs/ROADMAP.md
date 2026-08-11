# Fairy Tale Kingdom — Roadmap

Long-term phased vision.

| Phase | Name                       | Goal                                                                                                                                           |
| ----- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Foundation                 | App scaffold, Phaser shell, Knowledge Quest / GitHub Pages wiring, this roadmap                                                                |
| 1     | Graphics                   | Pixel art style guide, sprite sheets, tileset, basic idle/walk animations for the core cast                                                    |
| 2     | Living subjects            | Named people, roles, schedules, click-to-inspect (Stronghold-style inspector)                                                                  |
| 3     | Learn-to-earn              | Question panel via `@knowledge-quest/learning`; gold rewards; persist gold                                                                     |
| 3.5   | Kingdom meta + danger lite | Named kingdom, days played, new-kingdom menu, raids (steal gold / army lose)                                                                   |
| 4     | Marketplace and buildings  | Hire units into houses; place house/wall/tavern; building effects                                                                              |
| 5     | Combat and defenses        | HP, pathing/breach, drawbridge, stairs, pillage + flee, combat AI                                                                              |
| 6     | Tasks, repair, keep siege  | Schedule interrupts; peasant repair; army must destroy keep; street chat                                                                       |
| 7     | Economy and royalty        | Fields/food, sickness, royal units, upgrade buildings, capture/ransom, wave buffs                                                              |
| 8     | Medieval sieges            | Connectable walls/gates, trebuchets, catapults, battering rams, formation siege AI, field burning, morale rout, ballista/watchtower, siege VFX |
| 9     | Monsters                   | Dragons, knights, named roaming monsters with schedules. Terrain (ocean, rivers, lakes, forests, mountains)                                    |

10 - More depth to the kingdom. Royalty actually lives at the keep. Each keep can have 1 king and queen, and up to 3 princes and princesses. Buying more keeps allows you to house more royalty. More keeps means less chance to lose because all keeps must be destroyed to lose. Royal balls are randomly held. In order to make a princess, a fairy god mother must create a princess and she must meet the prince at the royal ball. The princess is only temporary and transforms back into a peasant unless she meets the prince. More events happen in your kingdom such as random festivals that give your kingdom boons. Criminals, theives and such spawn and steal your gold and food when they interact with peasants unless you have a dungeon and gaurds take the thieves to the dungeon. Thieves then live in the dungoen and consume food unless you choose to execute them which is a button in the dungoen building menu when you click on the dungeon. Make buildings and map larger. If units inside buildings, roof disappears and you can see the interior.

11 - As the days go by, difficulty increases. More monsters spawn. More and larger armies attack (until armies get absolutely massive) Different types of armies attack (goblin, orc, human, etc) and armies have generals with schedules that each empower their troops in a certain way for example: bloodbeard the bloodthirsy makes it so that his troops don't route. enemies set up encampments and have schedules. Encampments disapear if siege ends. If army routes they go back to the encampment and more troops spawn over time. More troops spawn over time in encampments. Player can buy a general in the marketplace and command your troupes to attack encampments to destroy them.

## Phase 0–7 (done)

Foundation through economy, royalty, capture/ransom, and keep siege.

## Phase 8 — Medieval sieges (current)

Checklist:

- [x] Connectable fort-grid walls; PathGrid blocks all ground units
- [x] Drawbridge snaps into wall line as gate (open peacetime / closed on raid)
- [x] Army siege phases: muster → reduce → storm; engines (ram / catapult / trebuchet)
- [x] Field burning during storm; rapid-death morale rout
- [x] Guards/archers defense muster; archers prioritize engines
- [x] Ballista + watchtower (royalty-gated); auto-fire / archer range bonus
- [x] Siege VFX: flames, melee/ranged hits, engine projectiles, breach dust

## Phase 9 — next

Dragons, knights, and named roaming monsters with schedules.

## Non-goals (for now)

- Manual combat orders
- Enemies climbing stairs
- Manual repair / demolish tools
- Rebuild destroyed buildings from ashes
- Multiplayer / auth

## Product north star

A **watchable** fairy-tale kingdom: subjects live their day, you inspect them, answer Knowledge Quest questions for gold, then spend gold to grow and defend the realm.
