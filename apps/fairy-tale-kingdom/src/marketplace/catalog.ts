import type { UnitRole } from '../game/art/assetManifest';

export type BuildKind =
  | 'house'
  | 'wall'
  | 'tavern'
  | 'drawbridge'
  | 'stairs'
  | 'field'
  | 'granary'
  | 'barracks'
  | 'manor'
  | 'ballista'
  | 'watchtower'
  | 'cathedral'
  | 'infirmary'
  | 'dungeon'
  | 'keep'
  | 'bakery'
  | 'market'
  | 'cemetery'
  | 'gallows'
  | 'road'
  | 'bridge'
  | 'dock';

export const BEDS_PER_HOUSE = 3;
export const FIELDS_PER_GRANARY = 2;
export const ROYAL_SLOTS_PER_KEEP = 4;

export type HireGate =
  | 'cathedral'
  | 'infirmary'
  | 'barracks'
  | 'dungeon'
  | 'tavern'
  | 'gallows';

export interface HireCatalogItem {
  role: UnitRole;
  name: string;
  blurb: string;
  cost: number;
  requiresRoyalty?: boolean;
  unique?: boolean;
  /** Cap king/queen at 1 kingdom-wide */
  uniqueThrone?: boolean;
  requiresBuilding?: HireGate;
  livesAtKeep?: boolean;
  /** Soft-require ≥2 keeps (dukes) */
  requiresExtraKeep?: boolean;
}

export interface BuildCatalogItem {
  kind: BuildKind;
  name: string;
  blurb: string;
  cost: number;
  requiresRoyalty?: boolean;
}

export const HIRE_CATALOG: HireCatalogItem[] = [
  {
    role: 'peasant',
    name: 'Peasant',
    blurb: 'Works fields and carries goods. Needs a free bed. Flees in raids.',
    cost: 10,
  },
  {
    role: 'guard',
    name: 'Guard',
    blurb:
      'Melee fighter. Arrests thieves and recovers stolen gold. Requires a Dungeon (capacity per dungeon).',
    cost: 20,
    requiresBuilding: 'dungeon',
  },
  {
    role: 'soldier',
    name: 'Soldier',
    blurb:
      'Barracks infantry. Patrols, escorts, and joins detachments. Requires Barracks capacity.',
    cost: 22,
    requiresBuilding: 'barracks',
  },
  {
    role: 'archer',
    name: 'Archer',
    blurb:
      'Ranged fighter. Deadlier from the wall-top. Requires Barracks capacity.',
    cost: 25,
    requiresBuilding: 'barracks',
  },
  {
    role: 'knight',
    name: 'Knight',
    blurb: 'Elite melee. Slays sleeping dragons. Needs barracks capacity.',
    cost: 45,
    requiresBuilding: 'barracks',
  },
  {
    role: 'general',
    name: 'General',
    blurb: 'Commands troops against encampments. Requires a Barracks.',
    cost: 70,
    requiresRoyalty: true,
    requiresBuilding: 'barracks',
  },
  {
    role: 'physician',
    name: 'Physician',
    blurb: 'Plague-masked healer. Requires an Infirmary.',
    cost: 40,
    requiresBuilding: 'infirmary',
  },
  {
    role: 'bishop',
    name: 'Bishop',
    blurb: 'Marries couples at the cathedral. Unique.',
    cost: 55,
    requiresBuilding: 'cathedral',
    unique: true,
    livesAtKeep: true,
  },
  {
    role: 'jester',
    name: 'Jester',
    blurb: 'Juggles near the keep and lifts spirits. Requires a Tavern.',
    cost: 28,
    requiresBuilding: 'tavern',
  },
  {
    role: 'dungeon_keeper',
    name: 'Dungeon Keeper',
    blurb: 'Watches captives in the dungeon.',
    cost: 30,
    requiresBuilding: 'dungeon',
  },
  {
    role: 'executioner',
    name: 'Executioner',
    blurb: 'Carries out sentences at the gallows. Requires dungeon & gallows.',
    cost: 35,
    requiresBuilding: 'gallows',
  },
  {
    role: 'witch_hunter',
    name: 'Witch Hunter',
    blurb: 'Hunts witches from covens. Requires a Cathedral.',
    cost: 45,
    requiresBuilding: 'cathedral',
  },
  {
    role: 'elite_guard',
    name: 'Elite Guard',
    blurb: 'Hardened melee. Requires King & Queen and a Barracks.',
    cost: 35,
    requiresRoyalty: true,
    requiresBuilding: 'barracks',
  },
  {
    role: 'elite_archer',
    name: 'Elite Archer',
    blurb: 'Master bowman. Requires King & Queen and a Barracks.',
    cost: 40,
    requiresRoyalty: true,
    requiresBuilding: 'barracks',
  },
  {
    role: 'king',
    name: 'King',
    blurb: 'Sole monarch with the Queen. Unlocks royal buildings.',
    cost: 80,
    uniqueThrone: true,
    livesAtKeep: true,
  },
  {
    role: 'queen',
    name: 'Queen',
    blurb: 'Sole queen with the King. A Prince may be born.',
    cost: 80,
    uniqueThrone: true,
    livesAtKeep: true,
  },
  {
    role: 'duke',
    name: 'Duke',
    blurb: 'Regional lord for an extra keep. Requires a second keep.',
    cost: 65,
    livesAtKeep: true,
    requiresExtraKeep: true,
  },
  {
    role: 'duchess',
    name: 'Duchess',
    blurb: 'Regional lady for an extra keep. Requires a second keep.',
    cost: 65,
    livesAtKeep: true,
    requiresExtraKeep: true,
  },
  {
    role: 'fairy_godmother',
    name: 'Fairy Godmother',
    blurb: 'At royal balls, turns female peasants into Princesses. Unique.',
    cost: 60,
    unique: true,
    livesAtKeep: true,
  },
];

export const BUILD_CATALOG: BuildCatalogItem[] = [
  {
    kind: 'house',
    name: 'House',
    blurb: '+3 beds. New hires live here. Can be burned in raids.',
    cost: 30,
  },
  {
    kind: 'granary',
    name: 'Granary',
    blurb: '+50% harvest while standing. Unlocks 2 field slots. Burnable.',
    cost: 45,
  },
  {
    kind: 'field',
    name: 'Field',
    blurb: 'Farmers harvest here (capacity 3). Needs a granary. Burnable.',
    cost: 25,
  },
  {
    kind: 'bakery',
    name: 'Bakery',
    blurb: 'Bakers work here. Softens food pressure. Burnable.',
    cost: 40,
  },
  {
    kind: 'market',
    name: 'Market',
    blurb: 'Merchants trade here. Festivals gather nearby. Burnable.',
    cost: 45,
  },
  {
    kind: 'wall',
    name: 'Wall',
    blurb: 'Snaps to the fort grid and connects to neighbors.',
    cost: 15,
  },
  {
    kind: 'stairs',
    name: 'Stairs',
    blurb: 'Snap to a wall so your people can climb.',
    cost: 20,
  },
  {
    kind: 'drawbridge',
    name: 'Drawbridge',
    blurb: 'Gate in the wall line. Closes during raids.',
    cost: 50,
  },
  {
    kind: 'tavern',
    name: 'Tavern',
    blurb: 'Cuts stolen gold 25%. Hire jesters. Burnable.',
    cost: 40,
  },
  {
    kind: 'infirmary',
    name: 'Infirmary',
    blurb: 'Sick-house. Required to hire Physicians. Burnable.',
    cost: 50,
  },
  {
    kind: 'cathedral',
    name: 'Cathedral',
    blurb: 'Weddings and witch hunters. Burnable.',
    cost: 90,
  },
  {
    kind: 'dungeon',
    name: 'Dungeon',
    blurb: 'Holds captives. Posts for guards (4) and a dungeon keeper. Burnable.',
    cost: 55,
  },
  {
    kind: 'cemetery',
    name: 'Cemetery',
    blurb: 'Peaceful burial ground for funerals. Burnable.',
    cost: 50,
  },
  {
    kind: 'road',
    name: 'Road',
    blurb: 'Dirt path for patrols and travel. Place freely on grass.',
    cost: 4,
  },
  {
    kind: 'bridge',
    name: 'Bridge',
    blurb:
      'Wooden span over rivers. Press R while placing to rotate. Lets units and ground monsters cross.',
    cost: 25,
  },
  {
    kind: 'dock',
    name: 'Dock',
    blurb: 'Coastal pier for fishing boats. Place next to ocean water.',
    cost: 45,
  },
  {
    kind: 'gallows',
    name: 'Gallows',
    blurb: 'Execute captives with an executioner. Place near dungeon.',
    cost: 35,
  },
  {
    kind: 'keep',
    name: 'Keep',
    blurb: 'Spreads royal influence. Seat dukes here. All keeps must fall to lose.',
    cost: 120,
    requiresRoyalty: true,
  },
  {
    kind: 'barracks',
    name: 'Barracks',
    blurb:
      'Posts for soldiers (4), archers (4), knights (3), and a general (1). Requires King & Queen.',
    cost: 60,
    requiresRoyalty: true,
  },
  {
    kind: 'manor',
    name: 'Manor',
    blurb: 'Fine home with 6 beds. Requires King & Queen. Burnable.',
    cost: 70,
    requiresRoyalty: true,
  },
  {
    kind: 'ballista',
    name: 'Ballista',
    blurb: 'Auto-fires bolts at raiders. Requires King & Queen.',
    cost: 55,
    requiresRoyalty: true,
  },
  {
    kind: 'watchtower',
    name: 'Watchtower',
    blurb: 'Nearby archers gain range. Requires King & Queen.',
    cost: 40,
    requiresRoyalty: true,
  },
];
