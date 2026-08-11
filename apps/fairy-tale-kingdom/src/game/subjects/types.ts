import type { UnitRole } from '../art/assetManifest';
import type { BuildKind } from '../../marketplace/catalog';
import type { LifeLogEntry } from '../thoughts/lifeLog';
import type { CivilianJob } from '../jobs/capacities';

export type SubjectRole = UnitRole;
export type SubjectGender = 'male' | 'female';
export type BodyCondition = 'gaunt' | 'average' | 'plump' | 'obese';
export type CurseKind =
  | 'frog'
  | 'poison'
  | 'aged'
  | 'pig'
  | 'sickness'
  | null;

export interface SubjectGoal {
  kind: string;
  targetId?: string;
  targetRole?: UnitRole;
  expiresAtDay?: number;
  text?: string;
}

export interface BuildingResident {
  id: string;
  name: string;
  roleLabel: string;
}

export type InspectableBuildKind = BuildKind | 'keep';

/** Snapshot sent across the Phaser → React bridge for buildings / keep */
export interface BuildingSnapshot {
  id: string;
  kind: InspectableBuildKind;
  name: string;
  blurb: string;
  hp: number;
  maxHp: number;
  statusLabel?: string;
  bedsUsed?: number;
  bedsCapacity?: number;
  residents?: BuildingResident[];
  royalUsed?: number;
  royalCapacity?: number;
  influenceRadius?: number;
  capacityLines?: string[];
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
  | 'infirmary'
  | 'dungeon'
  | 'tavern'
  | 'barracks'
  | 'gallows'
  | 'cemetery';

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
  | 'wedding'
  | 'eat'
  | 'parade'
  | 'line_street'
  | 'escort_parade'
  | 'play'
  | 'juggle'
  | 'guard_event'
  | 'curse'
  | 'execute'
  | 'funeral'
  | 'joust';

export type DayPhase = 'Night' | 'Morning' | 'Afternoon' | 'Evening';

export type InterruptKind =
  | 'flee'
  | 'repair'
  | 'chat'
  | 'harvest'
  | 'defend'
  | 'heal'
  | 'wedding'
  | 'assault'
  | 'eat'
  | 'parade'
  | 'line_street'
  | 'escort_parade'
  | 'play'
  | 'guard_event'
  | 'curse'
  | 'execute';

export interface SubjectInterrupt {
  kind: InterruptKind;
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
  temporaryPrincess: boolean;
  married: boolean;
  happiness: number;
  ageYears: number;
  body: BodyCondition;
  job?: CivilianJob;
  workplaceId?: string;
  spouseId?: string;
  motherId?: string;
  fatherId?: string;
  pregnant?: boolean;
  pregnantDaysLeft?: number;
  thought?: string;
  backstory?: string;
  goal?: SubjectGoal | null;
  lifeLog?: LifeLogEntry[];
  curse?: CurseKind;
  cursedAsRole?: SubjectRole;
  lowHappyHours?: number;
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
  canCommandTroops?: boolean;
  happiness?: number;
  ageYears?: number;
  body?: BodyCondition;
  jobLabel?: string;
  thought?: string;
  goalLabel?: string;
  backstory?: string;
  lifeLog?: LifeLogEntry[];
  lineageLabel?: string;
  pregnantLabel?: string;
  spouseLabel?: string;
  titleLabel?: string;
}

export interface DaySnapshot {
  dayPhase: DayPhase;
  hour: number;
}

export interface CareerTodoItem {
  subjectId: string;
  name: string;
  targetRole: UnitRole;
  targetLabel: string;
  cost: number;
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
  hasBarracks: boolean;
  hasGallows: boolean;
  hasCemetery: boolean;
  hasKing: boolean;
  hasQueen: boolean;
  hasPrince: boolean;
  hasPrincess: boolean;
  hasFairyGodmother: boolean;
  hasBishop: boolean;
  hasGeneral: boolean;
  hasExecutioner: boolean;
  canExecuteCaptive?: boolean;
  royaltyUnlocked: boolean;
  inspired: boolean;
  food: number;
  captiveCount: number;
  kingCount: number;
  queenCount: number;
  fieldSlots: number;
  militaryAvailable: number;
  careerTodos?: CareerTodoItem[];
}
