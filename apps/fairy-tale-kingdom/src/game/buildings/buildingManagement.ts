import { BUILD_CATALOG, type BuildKind } from '../../marketplace/catalog';
import { WALL_GOLD_PER_CELL } from './buildingShared';

const MOVABLE_KINDS = new Set<BuildKind>([
  'house',
  'manor',
  'tavern',
  'field',
  'granary',
  'barracks',
  'cathedral',
  'infirmary',
  'dungeon',
  'bakery',
  'market',
  'cemetery',
  'gallows',
  'road',
  'bridge',
  'dock',
  'ballista',
  'watchtower',
]);

/** Standard buildings the player can relocate (not fort pieces or the keep). */
export function isMovableKind(kind: BuildKind): boolean {
  return MOVABLE_KINDS.has(kind);
}

/** Gold refunded when the player demolishes a building (100% of build cost). */
export function buildingRefundCost(kind: BuildKind): number {
  if (kind === 'wall') return WALL_GOLD_PER_CELL;
  return BUILD_CATALOG.find((c) => c.kind === kind)?.cost ?? 0;
}
