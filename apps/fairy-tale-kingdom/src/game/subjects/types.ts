import type { UnitRole } from '../art/assetManifest';
import type { BuildKind } from '../../marketplace/catalog';

export type SubjectRole = UnitRole;

export type InspectableBuildKind = BuildKind | 'keep';

export interface BuildingResident {
  id: string;
  name: string;
  roleLabel: string;
}

/** Snapshot sent across the Phaser → React bridge for buildings / keep */
export interface BuildingSnapshot {
  id: string;
  kind: InspectableBuildKind;
  name: string;
  blurb: string;
  hp: number;
  maxHp: number;
  /** Drawbridge open/closed; omitted otherwise */
  statusLabel?: string;
  bedsUsed?: number;
  bedsCapacity?: number;
  residents?: BuildingResident[];
}

export type ZoneId = 'home' | 'path' | 'keep' | 'wall' | 'field';

export type ActivityId =
  | 'sleep'
  | 'work'
  | 'patrol'
  | 'gather'
  | 'idle_keep'
  | 'train'
  | 'flee'
  | 'fight'
  | 'climb';

export type DayPhase = 'Night' | 'Morning' | 'Afternoon' | 'Evening';

export interface ScheduleSlot {
  startHour: number;
  endHour: number;
  activity: ActivityId;
  zone: ZoneId;
  label: string;
}

export interface Subject {
  id: string;
  name: string;
  role: SubjectRole;
  houseId: string;
  activity: ActivityId;
  activityLabel: string;
  zone: ZoneId;
  hp: number;
  maxHp: number;
  onWall: boolean;
}

/** Snapshot sent across the Phaser → React bridge */
export interface SubjectSnapshot {
  id: string;
  name: string;
  role: SubjectRole;
  roleLabel: string;
  activityLabel: string;
  homeLabel: string;
  scheduleSummary: string[];
  dayPhase: DayPhase;
  hour: number;
  hp: number;
  maxHp: number;
  onWall: boolean;
}

export interface DaySnapshot {
  dayPhase: DayPhase;
  hour: number;
}

export interface KingdomStats {
  population: number;
  capacity: number;
  freeBeds: number;
  houseCount: number;
  wallCount: number;
  tavernCount: number;
}
