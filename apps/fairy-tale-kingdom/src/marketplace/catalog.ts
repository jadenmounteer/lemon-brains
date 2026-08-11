import type { UnitRole } from '../game/art/assetManifest';

export type BuildKind = 'house' | 'wall' | 'tavern' | 'drawbridge' | 'stairs';

export const BEDS_PER_HOUSE = 3;

export interface HireCatalogItem {
  role: UnitRole;
  name: string;
  blurb: string;
  cost: number;
}

export interface BuildCatalogItem {
  kind: BuildKind;
  name: string;
  blurb: string;
  cost: number;
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
];

export const BUILD_CATALOG: BuildCatalogItem[] = [
  {
    kind: 'house',
    name: 'House',
    blurb: '+3 beds. New hires live here. Can be burned in raids.',
    cost: 30,
  },
  {
    kind: 'wall',
    name: 'Wall',
    blurb: 'Blocks enemies until destroyed.',
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
    blurb: 'Walkable in peacetime; auto-closes during raids until destroyed or raid ends.',
    cost: 50,
  },
  {
    kind: 'tavern',
    name: 'Tavern',
    blurb: 'Cuts gold stolen by bandits and giants by 25%. Can be burned.',
    cost: 40,
  },
];
