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
  | 'watchtower';

export const BEDS_PER_HOUSE = 3;

export interface HireCatalogItem {
  role: UnitRole;
  name: string;
  blurb: string;
  cost: number;
  /** Requires king & queen present */
  requiresRoyalty?: boolean;
  /** At most one of this role */
  unique?: boolean;
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
    blurb: 'With a Queen, unlocks royal buildings and elite troops. Unique.',
    cost: 80,
    unique: true,
  },
  {
    role: 'queen',
    name: 'Queen',
    blurb: 'With a King, a Prince will be born. Unique.',
    cost: 80,
    unique: true,
  },
  {
    role: 'fairy_godmother',
    name: 'Fairy Godmother',
    blurb: 'Can turn peasants into Princesses. Unique.',
    cost: 60,
    unique: true,
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
    kind: 'field',
    name: 'Field',
    blurb: 'Peasants harvest food here. Burnable.',
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
    kind: 'granary',
    name: 'Granary',
    blurb: '+50% food harvest while standing. Requires King & Queen. Burnable.',
    cost: 45,
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
