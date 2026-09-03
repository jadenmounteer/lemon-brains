import type { UnitRole } from '../game/art/assetManifest';
import { BUILDING_ROLE_CAPACITY } from '../game/jobs/capacities';
import type { KingdomStats } from '../game/subjects/types';
import {
  WALL_GOLD_PER_CELL,
  WALL_MAX_DRAG_CELLS,
} from '../game/buildings/buildingShared';
import {
  BUILD_CATALOG,
  HIRE_CATALOG,
  ROYAL_SLOTS_PER_KEEP,
  type BuildKind,
} from './catalog';

export { WALL_GOLD_PER_CELL, WALL_MAX_DRAG_CELLS };

export function wallPlacementCost(cellCount: number): number {
  return cellCount * WALL_GOLD_PER_CELL;
}

export function affordableWallCells(
  gold: number,
  infiniteGold: boolean
): number {
  if (infiniteGold) return WALL_MAX_DRAG_CELLS;
  return Math.min(
    WALL_MAX_DRAG_CELLS,
    Math.floor(gold / WALL_GOLD_PER_CELL)
  );
}

/** Roles that can be trained at each building kind (marketplace hire → building train). */
export const TRAINABLE_ROLES: Partial<Record<BuildKind, UnitRole[]>> = (() => {
  const map: Partial<Record<BuildKind, UnitRole[]>> = {};
  for (const [kind, caps] of Object.entries(BUILDING_ROLE_CAPACITY)) {
    map[kind as BuildKind] = Object.keys(caps) as UnitRole[];
  }
  const keepRoles = new Set<UnitRole>([
    ...(map.keep ?? []),
    'king',
    'queen',
    'fairy_godmother',
  ]);
  map.keep = [...keepRoles];
  return map;
})();

export function hireCost(role: UnitRole): number {
  return HIRE_CATALOG.find((h) => h.role === role)?.cost ?? 0;
}

export function hireCatalogName(role: UnitRole): string {
  return HIRE_CATALOG.find((h) => h.role === role)?.name ?? role;
}

export function buildingRoleCap(
  buildingKind: BuildKind,
  role: UnitRole
): number | null {
  const cap = BUILDING_ROLE_CAPACITY[buildingKind]?.[role];
  return cap ?? null;
}

export function workersAtCap(
  buildingKind: BuildKind,
  role: UnitRole,
  workersAtBuilding: number
): boolean {
  const cap = buildingRoleCap(buildingKind, role);
  if (cap == null) return false;
  return workersAtBuilding >= cap;
}

export interface CanTrainOptions {
  workersAtBuilding?: number;
  enabledRoles?: Partial<Record<UnitRole, boolean>>;
  /** When training at a keep, royal slots at that keep. */
  royalUsedAtKeep?: number;
}

export function canTrain(
  buildingKind: BuildKind,
  role: UnitRole,
  stats: KingdomStats,
  options?: CanTrainOptions
): boolean {
  const roles = TRAINABLE_ROLES[buildingKind];
  if (!roles?.includes(role)) return false;
  if (options?.enabledRoles?.[role] === false) return false;

  const item = HIRE_CATALOG.find((h) => h.role === role);
  if (!item) return false;

  if (!item.livesAtKeep && stats.freeBeds <= 0) return false;
  if (item.requiresRoyalty && !stats.royaltyUnlocked) return false;
  if (item.requiresExtraKeep && stats.keepCount < 2) return false;
  if (item.unique && role === 'fairy_godmother' && stats.hasFairyGodmother) {
    return false;
  }
  if (item.unique && role === 'bishop' && stats.hasBishop) return false;
  if (item.uniqueThrone && role === 'king' && stats.hasKing) return false;
  if (item.uniqueThrone && role === 'queen' && stats.hasQueen) return false;
  if (role === 'executioner' && !stats.hasDungeon) return false;
  if (
    item.livesAtKeep &&
    buildingKind === 'keep' &&
    typeof options?.royalUsedAtKeep === 'number' &&
    options.royalUsedAtKeep >= ROYAL_SLOTS_PER_KEEP
  ) {
    return false;
  }
  if (
    options?.workersAtBuilding != null &&
    workersAtCap(buildingKind, role, options.workersAtBuilding)
  ) {
    return false;
  }

  return true;
}

export function canPlaceBuilding(kind: BuildKind, stats: KingdomStats): boolean {
  const item = BUILD_CATALOG.find((b) => b.kind === kind);
  if (!item) return false;
  if (item.requiresRoyalty && !stats.royaltyUnlocked) return false;
  if (kind === 'keep' && stats.keepCount >= 1) return false;
  if (kind === 'road') return false;
  if (
    kind === 'field' &&
    (stats.granaryCount <= 0 || stats.fieldCount >= stats.fieldSlots)
  ) {
    return false;
  }
  if (kind === 'cemetery' && !stats.hasCathedral) return false;
  if (kind === 'gallows' && !stats.hasDungeon) return false;
  return true;
}
