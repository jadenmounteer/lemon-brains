import type { UnitRole, EnemyRole } from '../art/assetManifest';
import type { BuildKind } from '../../marketplace/catalog';

export const BUILDING_MAX_HP: Record<BuildKind | 'keep', number> = {
  house: 30,
  wall: 40,
  tavern: 35,
  drawbridge: 50,
  stairs: 25,
  field: 25,
  granary: 40,
  barracks: 45,
  manor: 35,
  ballista: 35,
  watchtower: 40,
  keep: 200,
};

export const UNIT_MAX_HP: Record<UnitRole, number> = {
  peasant: 20,
  guard: 40,
  archer: 30,
  elite_guard: 55,
  elite_archer: 40,
  knight: 50,
  king: 45,
  queen: 40,
  prince: 35,
  princess: 35,
  fairy_godmother: 30,
};

export const MONSTER_MAX_HP = {
  troll: 55,
  ogre: 70,
  dragon: 120,
  dragonTwoHead: 160,
} as const;

export const CombatBalance = {
  guardMelee: 8,
  archerRanged: 5,
  eliteGuardMelee: 12,
  eliteArcherRanged: 8,
  knightMelee: 14,
  knightDragonBonus: 18,
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
  engineMeleeDamage: 7,
  monsterMelee: 7,
  dragonBreath: 10,
  ogreSmash: 12,
  trollRegen: 2,
  dragonStealGold: 8,
  dragonTwoHeadStealGold: 14,
  monsterAggro: 70,
  knightHuntRange: 200,
} as const;

export const RAIDER_MAX_HP: Record<EnemyRole, number> = {
  bandit: 25,
  giant: 60,
  enemy_army: 35,
};

export function isBurnable(kind: BuildKind): boolean {
  return (
    kind === 'house' ||
    kind === 'tavern' ||
    kind === 'stairs' ||
    kind === 'field' ||
    kind === 'granary' ||
    kind === 'barracks' ||
    kind === 'manor' ||
    kind === 'ballista' ||
    kind === 'watchtower'
  );
}

export function isBlockingKind(kind: BuildKind, drawbridgeClosed: boolean): boolean {
  if (kind === 'wall') return true;
  if (kind === 'drawbridge') return drawbridgeClosed;
  return false;
}

export function isDwelling(kind: BuildKind): boolean {
  return kind === 'house' || kind === 'manor';
}

export function isFortKind(kind: BuildKind): boolean {
  return kind === 'wall' || kind === 'drawbridge';
}
