import type { UnitRole, EnemyRole } from '../art/assetManifest';
import type { BuildKind } from '../../marketplace/catalog';

export const BUILDING_MAX_HP: Record<BuildKind | 'keep', number> = {
  house: 40,
  wall: 120,
  tavern: 45,
  drawbridge: 90,
  ladder: 25,
  field: 25,
  granary: 40,
  barracks: 45,
  manor: 45,
  ballista: 35,
  watchtower: 40,
  cathedral: 80,
  infirmary: 50,
  dungeon: 55,
  bakery: 40,
  market: 40,
  cemetery: 45,
  gallows: 30,
  road: 15,
  bridge: 35,
  dock: 40,
  keep: 200,
};

export const UNIT_MAX_HP: Record<UnitRole, number> = {
  peasant: 20,
  child: 12,
  guard: 40,
  soldier: 38,
  archer: 30,
  elite_guard: 55,
  elite_archer: 40,
  knight: 50,
  general: 55,
  physician: 28,
  bishop: 30,
  king: 45,
  queen: 40,
  prince: 35,
  princess: 35,
  duke: 42,
  duchess: 38,
  fairy_godmother: 30,
  jester: 22,
  dungeon_keeper: 32,
  executioner: 36,
  witch_hunter: 42,
  witch: 28,
  necromancer: 26,
  zombie: 22,
  vampire_wife: 30,
  bandit: 25,
  thief: 20,
  gypsy: 18,
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
  /** How far a marching raider may detour to burn a claimed house or field. */
  homesteadPillageRadius: 160,
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
  thiefStealGold: 6,
  thiefCaptureRange: 32,
  necromancerArrestRange: 32,
  zombieBiteRange: 22,
  zombieMeleeDamage: 9,
  physicianHealRange: 40,
  physicianHealHunger: 35,
  physicianHealHp: 14,
  marriageRange: 48,
  weddingDurationMs: 4000,
  /** Default radius (px) of a monster's home territory sphere. */
  monsterInfluenceRadius: 160,
  /** Hunger points gained per second while active in the world. */
  monsterHungerPerSec: 0.6,
  /** Hunger threshold above which a monster abandons wandering to hunt prey. */
  monsterHungerHuntThreshold: 60,
  /** Hunger relieved per successful bite/attack while hunting. */
  monsterHungerFeedRelief: 45,
} as const;

export const RAIDER_MAX_HP: Record<EnemyRole, number> = {
  bandit: 25,
  giant: 60,
  goblin: 18,
  enemy_army: 35,
  gypsy: 22,
};

export function isBurnable(kind: BuildKind): boolean {
  return (
    kind === 'house' ||
    kind === 'tavern' ||
    kind === 'ladder' ||
    kind === 'field' ||
    kind === 'granary' ||
    kind === 'barracks' ||
    kind === 'manor' ||
    kind === 'ballista' ||
    kind === 'watchtower' ||
    kind === 'cathedral' ||
    kind === 'infirmary' ||
    kind === 'dungeon' ||
    kind === 'bakery' ||
    kind === 'market' ||
    kind === 'cemetery' ||
    kind === 'gallows'
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

export function hasInterior(kind: BuildKind | 'keep'): boolean {
  return (
    kind === 'house' ||
    kind === 'manor' ||
    kind === 'tavern' ||
    kind === 'keep' ||
    kind === 'cathedral' ||
    kind === 'infirmary' ||
    kind === 'dungeon' ||
    kind === 'bakery' ||
    kind === 'market' ||
    kind === 'granary' ||
    kind === 'barracks' ||
    kind === 'watchtower' ||
    kind === 'dock' ||
    kind === 'cemetery' ||
    kind === 'gallows'
  );
}
