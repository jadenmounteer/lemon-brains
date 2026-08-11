import type { UnitRole, EnemyRole } from '../art/assetManifest';
import type { BuildKind } from '../../marketplace/catalog';

export const BUILDING_MAX_HP: Record<BuildKind | 'keep', number> = {
  house: 30,
  wall: 40,
  tavern: 35,
  drawbridge: 50,
  stairs: 25,
  keep: 200,
};

export const UNIT_MAX_HP: Record<UnitRole, number> = {
  peasant: 20,
  guard: 40,
  archer: 30,
};

export const RAIDER_MAX_HP: Record<EnemyRole, number> = {
  bandit: 25,
  giant: 60,
  enemy_army: 35,
};

export const CombatBalance = {
  guardMelee: 8,
  archerRanged: 5,
  archerWallRangeMult: 1.5,
  archerWallDamageMult: 1.25,
  raiderMelee: 6,
  raiderBreach: 10,
  raiderBurn: 8,
  raiderSiege: 12,
  giantDamageMult: 1.5,
  guardRange: 28,
  archerRange: 90,
  pillageRadius: 48,
  aggroRadius: 110,
  fleeRadius: 70,
  repairPerTick: 4,
  repairRange: 36,
  chatRange: 40,
  chatDurationMs: 3000,
  tickMs: 400,
} as const;

export function isBurnable(kind: BuildKind): boolean {
  return kind === 'house' || kind === 'tavern' || kind === 'stairs';
}

export function isBlockingKind(kind: BuildKind, drawbridgeClosed: boolean): boolean {
  if (kind === 'wall') return true;
  if (kind === 'drawbridge') return drawbridgeClosed;
  return false;
}
