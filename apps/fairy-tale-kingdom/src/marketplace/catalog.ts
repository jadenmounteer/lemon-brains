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
  | 'keep';

export const BEDS_PER_HOUSE = 3;
export const FIELDS_PER_GRANARY = 2;
export const ROYAL_SLOTS_PER_KEEP = 4;

export type HireGate = 'cathedral' | 'infirmary';

export interface HireCatalogItem {
  role: UnitRole;
  name: string;
  blurb: string;
  cost: number;
  /** Requires king & queen present */
  requiresRoyalty?: boolean;
  /** At most one of this role (fairy godmother) */
  unique?: boolean;
  /** Cap by keep count (king/queen) */
  perKeep?: boolean;
  /** Building prerequisite to hire */
  requiresBuilding?: HireGate;
  /** Royals live at keeps, not house beds */
  livesAtKeep?: boolean;
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
    blurb: 'Melee fighter. Can climb stairs to the wall. Needs a free bed.',
    cost: 20,
  },
  {
    role: 'archer',
    name: 'Archer',
    blurb: 'Ranged fighter. Deadlier from the wall-top. Needs a free bed.',
    cost: 25,
  },
  {
    role: 'knight',
    name: 'Knight',
    blurb: 'Elite melee fighter. Slays dragons while they sleep in caves.',
    cost: 45,
  },
  {
    role: 'physician',
    name: 'Physician',
    blurb: 'Plague-masked healer. Cures the sick and tends wounds. Requires an Infirmary.',
    cost: 40,
    requiresBuilding: 'infirmary',
  },
  {
    role: 'bishop',
    name: 'Bishop',
    blurb: 'Marries princes and princesses at the cathedral. Requires a Cathedral.',
    cost: 55,
    requiresBuilding: 'cathedral',
    unique: true,
    livesAtKeep: true,
  },
  {
    role: 'elite_guard',
    name: 'Elite Guard',
    blurb: 'Hardened melee fighter. Requires King & Queen.',
    cost: 35,
    requiresRoyalty: true,
  },
  {
    role: 'elite_archer',
    name: 'Elite Archer',
    blurb: 'Master bowman. Requires King & Queen.',
    cost: 40,
    requiresRoyalty: true,
  },
  {
    role: 'king',
    name: 'King',
    blurb: 'With a Queen, unlocks royal buildings. One royal family per keep.',
    cost: 80,
    perKeep: true,
    livesAtKeep: true,
  },
  {
    role: 'queen',
    name: 'Queen',
    blurb: 'With a King, a Prince will be born. One royal family per keep.',
    cost: 80,
    perKeep: true,
    livesAtKeep: true,
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
    blurb: 'Peasants harvest food here. Needs a granary; max 2 fields per granary. Burnable.',
    cost: 25,
  },
  {
    kind: 'wall',
    name: 'Wall',
    blurb: 'Snaps to the fort grid and connects to neighbors. Blocks everyone until destroyed.',
    cost: 15,
  },
  {
    kind: 'stairs',
    name: 'Stairs',
    blurb: 'Snap to a wall so your people can climb. Archers shoot farther up top.',
    cost: 20,
  },
  {
    kind: 'drawbridge',
    name: 'Drawbridge',
    blurb: 'Snaps into a wall line as a gate. Open in peacetime; closes during raids.',
    cost: 50,
  },
  {
    kind: 'tavern',
    name: 'Tavern',
    blurb: 'Cuts gold stolen by bandits and giants by 25%. Can be burned.',
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
    blurb: 'Holy hall for weddings. Required to hire a Bishop. Burnable.',
    cost: 90,
  },
  {
    kind: 'dungeon',
    name: 'Dungeon',
    blurb: 'Holds captured thieves. Guards can lock night prowlers here.',
    cost: 55,
  },
  {
    kind: 'keep',
    name: 'Keep',
    blurb: 'Another seat of power. +1 royal family. All keeps must fall to lose.',
    cost: 120,
    requiresRoyalty: true,
  },
  {
    kind: 'barracks',
    name: 'Barracks',
    blurb: '+15% guard & archer damage. Requires King & Queen. Burnable.',
    cost: 60,
    requiresRoyalty: true,
  },
  {
    kind: 'manor',
    name: 'Manor',
    blurb: 'Fine home with 2 beds. Requires King & Queen. Burnable.',
    cost: 70,
    requiresRoyalty: true,
  },
  {
    kind: 'ballista',
    name: 'Ballista',
    blurb: 'Auto-fires bolts at raiders and siege engines. Requires King & Queen.',
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
