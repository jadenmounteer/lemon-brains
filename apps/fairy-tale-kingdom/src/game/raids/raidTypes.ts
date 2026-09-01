import type { EnemyRole } from '../art/assetManifest';
import type { PathGrid } from '../path/PathGrid';
import type Phaser from 'phaser';

export type RaidKind = EnemyRole;

export type RaiderState =
  | 'pathing'
  | 'fighting'
  | 'breaching'
  | 'burning'
  | 'sieging'
  | 'investing'
  | 'routing'
  | 'retreating'
  | 'carrying'
  | 'feasting'
  | 'done';

export type SiegePhase = 'none' | 'muster' | 'reduce' | 'storm' | 'routing';

export type StealKind = 'bandit' | 'giant' | 'goblin' | 'thief' | 'gypsy';

export interface KeepPoint {
  x: number;
  y: number;
}

export interface ActiveRaider {
  kind: RaidKind;
  sprite: Phaser.GameObjects.Sprite;
  hp: number;
  maxHp: number;
  path: { x: number; y: number }[];
  pathIndex: number;
  state: RaiderState;
  targetSubjectId: string | null;
  targetBuildingId: string | null;
  thinkAccumMs: number;
  camp?: Phaser.GameObjects.Arc;
  investX?: number;
  investY?: number;
  homeCampId: string | null;
  homeX: number;
  homeY: number;
  rosterSubjectId: string | null;
  carriedGold: number;
  stealKind: StealKind | null;
  looted: boolean;
  isGeneral: boolean;
  siegeRole: 'main' | 'field_raid';
  strategyFieldId: string | null;
  carriedSubjectId: string | null;
  feastMs: number;
  /** Enemy on wall-top via siege ladder. */
  onWall?: boolean;
}

export const RAID_LABELS: Record<RaidKind, string> = {
  bandit: 'Bandits',
  giant: 'Giants',
  goblin: 'Goblins',
  enemy_army: 'a rival kingdom’s army',
  gypsy: 'Gypsies',
};

export const KEEP_REACH_PX = 28;

export const MOVE_SPEED: Record<RaidKind, number> = {
  bandit: 42,
  giant: 28,
  goblin: 52,
  enemy_army: 36,
  gypsy: 40,
};

export interface LaunchCampRaidersOpts {
  kind: RaidKind;
  x: number;
  y: number;
  count: number;
  homeCampId: string;
  homeX: number;
  homeY: number;
  stealKind?: StealKind;
  aggroOnly?: boolean;
  label?: string;
  isReinforce?: boolean;
  hasGeneral?: boolean;
  rosterSubjectIds?: string[];
}

export interface BeginSiegeFromCampOpts {
  x: number;
  y: number;
  count: number;
  homeCampId: string;
  generalName?: string;
}

export interface RaidMovementHost {
  pathGrid: PathGrid | null;
  unstickRaider(raider: ActiveRaider): void;
  stepToward(raider: ActiveRaider, tx: number, ty: number, deltaMs: number): void;
}
