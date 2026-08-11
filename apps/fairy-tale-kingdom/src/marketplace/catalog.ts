import type { UnitRole } from '../game/art/assetManifest';

export type BuildKind = 'house' | 'wall' | 'tavern';

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
    blurb: 'Works fields and carries goods. Needs a free bed.',
    cost: 10,
  },
  {
    role: 'guard',
    name: 'Guard',
    blurb: 'Patrols walls and roads. Needs a free bed.',
    cost: 20,
  },
  {
    role: 'archer',
    name: 'Archer',
    blurb: 'Watches from the wall. Needs a free bed.',
    cost: 25,
  },
];

export const BUILD_CATALOG: BuildCatalogItem[] = [
  {
    kind: 'house',
    name: 'House',
    blurb: '+3 beds. New hires live here.',
    cost: 30,
  },
  {
    kind: 'wall',
    name: 'Wall',
    blurb: 'Slows raiders that pass nearby.',
    cost: 15,
  },
  {
    kind: 'tavern',
    name: 'Tavern',
    blurb: 'Cuts gold stolen by bandits and giants by 25%.',
    cost: 40,
  },
];
