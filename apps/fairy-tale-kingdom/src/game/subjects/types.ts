import type { UnitRole } from '../art/assetManifest';
import type { BuildKind } from '../../marketplace/catalog';
import type { LifeLogEntry } from '../thoughts/lifeLog';
import type { CivilianJob } from '../jobs/capacities';
import type { KeepRoomId } from '../keep/KeepLayout';
import type { CampKind } from '../war/WarBalance';

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
  jobLabel?: string;
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
  workers?: BuildingResident[];
  royalUsed?: number;
  royalCapacity?: number;
  influenceRadius?: number;
  capacityLines?: string[];
  /** Keep this building answers to (fief), when set. */
  loyaltyLabel?: string;
}

/** Named garrison entry for an encampment, shown in the camp inspector. */
export interface CampRosterEntry {
  id: string;
  name: string;
  role: string;
  status: 'home' | 'away';
  activity: string;
}

/** Snapshot sent across the Phaser → React bridge for encampments */
export interface CampSnapshot {
  id: string;
  kind: CampKind;
  x: number;
  y: number;
  label: string;
  leaderName: string | null;
  leaderHome: boolean;
  /** True while the camp has no leader after one fell in battle — raids paused. */
  demoralized?: boolean;
  garrison: number;
  away: number;
  supply?: number;
  maxSupply?: number;
  canArrest: boolean;
  roster: CampRosterEntry[];
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
  | 'joust'
  | 'fish'
  | 'crew'
  | 'exorcise'
  | 'cook'
  | 'serve'
  | 'clean'
  | 'court'
  | 'feast'
  | 'study'
  | 'chamber'
  | 'knead';

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
  | 'execute'
  | 'fish'
  | 'crew'
  | 'exorcise'
  | 'defect'
  | 'abducted';

export interface SubjectInterrupt {
  kind: InterruptKind;
  targetId?: string;
  partnerId?: string;
  remainingMs?: number;
  /** 'defect' — camp the subject is walking toward */
  campId?: string;
  targetX?: number;
  targetY?: number;
}

export interface ScheduleSlot {
  startHour: number;
  endHour: number;
  activity: ActivityId;
  zone: ZoneId;
  label: string;
  /** Keep interior room when zone is 'keep'. */
  room?: KeepRoomId;
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
  /** Encampment this subject belongs to, when allegiance is 'camp'. */
  campId?: string | null;
  /** 'camp' subjects live at a bandit/thief/gypsy camp instead of the kingdom. */
  allegiance?: 'kingdom' | 'camp';
  /** Nearest keep this subject serves (crown or duke/duchess fief). */
  loyaltyKeepId?: string | null;
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
  workplaceLabel?: string;
  /** e.g. Banquet hall when inside the keep */
  roomLabel?: string;
  thought?: string;
  goalLabel?: string;
  backstory?: string;
  lifeLog?: LifeLogEntry[];
  lineageLabel?: string;
  pregnantLabel?: string;
  spouseLabel?: string;
  titleLabel?: string;
  /** Keep / liege this subject is loyal to. */
  loyaltyLabel?: string;
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
  hasDock: boolean;
  dockCount: number;
  fishingBoatCount: number;
  fishingBoatCapacity: number;
  warshipCount: number;
  warshipCapacity: number;
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
