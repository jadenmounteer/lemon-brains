import type { UnitRole } from '../art/assetManifest';
import type { BuildKind } from '../../marketplace/catalog';

export type SubjectRole = UnitRole;
export type SubjectGender = 'male' | 'female';

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
  royalUsed?: number;
  royalCapacity?: number;
}

export type ZoneId =
  | 'home'
  | 'path'
  | 'keep'
  | 'wall'
  | 'field'
  | 'cave'
  | 'forest'
  | 'mountain'
  | 'cathedral'
  | 'infirmary';

export type ActivityId =
  | 'sleep'
  | 'work'
  | 'patrol'
  | 'gather'
  | 'idle_keep'
  | 'train'
  | 'flee'
  | 'fight'
  | 'climb'
  | 'repair'
  | 'chat'
  | 'harvest'
  | 'wave'
  | 'defend'
  | 'steal'
  | 'smash'
  | 'hunt'
  | 'heal'
  | 'ball'
  | 'festival'
  | 'wedding';

export type DayPhase = 'Night' | 'Morning' | 'Afternoon' | 'Evening';

export type InterruptKind =
  | 'flee'
  | 'repair'
  | 'chat'
  | 'harvest'
  | 'defend'
  | 'heal'
  | 'wedding';

export interface SubjectInterrupt {
  kind: InterruptKind;
  /** Building id or keep */
  targetId?: string;
  partnerId?: string;
  remainingMs?: number;
}

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
  gender: SubjectGender;
  houseId: string;
  activity: ActivityId;
  activityLabel: string;
  zone: ZoneId;
  hp: number;
  maxHp: number;
  onWall: boolean;
  hunger: number;
  sick: boolean;
  /** Ball-blessed princess; reverts at morning unless married */
  temporaryPrincess: boolean;
  married: boolean;
}

/** Snapshot sent across the Phaser → React bridge */
export interface SubjectSnapshot {
  id: string;
  name: string;
  role: SubjectRole;
  roleLabel: string;
  genderLabel: string;
  activityLabel: string;
  homeLabel: string;
  scheduleSummary: string[];
  dayPhase: DayPhase;
  hour: number;
  hp: number;
  maxHp: number;
  onWall: boolean;
  hunger: number;
  sick: boolean;
  inspired?: boolean;
  canTransformPeasant?: boolean;
  temporaryPrincess?: boolean;
  married?: boolean;
  ballActive?: boolean;
  festivalActive?: boolean;
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
  fieldCount: number;
  granaryCount: number;
  keepCount: number;
  hasCathedral: boolean;
  hasInfirmary: boolean;
  hasDungeon: boolean;
  hasKing: boolean;
  hasQueen: boolean;
  hasPrince: boolean;
  hasPrincess: boolean;
  hasFairyGodmother: boolean;
  hasBishop: boolean;
  royaltyUnlocked: boolean;
  inspired: boolean;
  food: number;
  captiveCount: number;
  kingCount: number;
  queenCount: number;
  fieldSlots: number;
}
