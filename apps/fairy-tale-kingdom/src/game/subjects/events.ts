import type { UnitRole } from '../art/assetManifest';
import type { CivilianJob } from '../jobs/capacities';
import type { BuildKind, NavalKind } from '../../marketplace/catalog';
import type { SandboxSpawnAction } from '../../kingdom/sandboxSettings';
import type {
  BuildingSnapshot,
  CampSnapshot,
  DaySnapshot,
  KingdomStats,
  SubjectSnapshot,
} from './types';

/** Phaser game.events channel names for the React bridge */
export const KingdomEvents = {
  SUBJECT_SELECTED: 'kingdom:subject-selected',
  BUILDING_SELECTED: 'kingdom:building-selected',
  DAY_TICK: 'kingdom:day-tick',
  DAY_ROLLED: 'kingdom:day-rolled',
  CLEAR_SELECTION: 'kingdom:clear-selection',
  GOLD_STOLEN: 'kingdom:gold-stolen',
  GAME_OVER: 'kingdom:game-over',
  RAID_WARNING: 'kingdom:raid-warning',
  HIRE_SUBJECT: 'kingdom:hire-subject',
  BEGIN_PLACE: 'kingdom:begin-place',
  CANCEL_PLACE: 'kingdom:cancel-place',
  BEGIN_RELOCATE: 'kingdom:begin-relocate',
  DEMOLISH_BUILDING: 'kingdom:demolish-building',
  BUILDING_DEMOLISHED: 'kingdom:building-demolished',
  PLACE_MODE_CHANGED: 'kingdom:place-mode-changed',
  WALL_PLACED: 'kingdom:wall-placed',
  KINGDOM_STATS: 'kingdom:stats',
  MARKET_TOAST: 'kingdom:market-toast',
  FOOD_CHANGED: 'kingdom:food-changed',
  GOLD_RECOVERED: 'kingdom:gold-recovered',
  ROYAL_CAPTURED: 'kingdom:royal-captured',
  PAY_RANSOM: 'kingdom:pay-ransom',
  TRANSFORM_PEASANT: 'kingdom:transform-peasant',
  CAPTIVES_CHANGED: 'kingdom:captives-changed',
  COMMAND_DETACHMENT: 'kingdom:command-detachment',
  COMMAND_KNIGHT_HUNT: 'kingdom:command-knight-hunt',
  MONSTER_SLAIN: 'kingdom:monster-slain',
  SET_DAYS_PLAYED: 'kingdom:set-days-played',
  CAREER_HIRE: 'kingdom:career-hire',
  EXECUTE_CAPTIVE: 'kingdom:execute-captive',
  RELEASE_SUBJECT: 'kingdom:release-subject',
  AUTO_GRANT_WISH: 'kingdom:auto-grant-wish',
  CAMP_SELECTED: 'kingdom:camp-selected',
  DESTROY_CAMP: 'kingdom:destroy-camp',
  ARREST_CAMP: 'kingdom:arrest-camp',
  ARREST_SUBJECT: 'kingdom:arrest-subject',
  FOCUS_CAMP: 'kingdom:focus-camp',
  BUY_NAVAL: 'kingdom:buy-naval',
  SANDBOX_SPAWN: 'kingdom:sandbox-spawn',
  CAMERA_ZOOM: 'kingdom:camera-zoom',
  CAMERA_PAN: 'kingdom:camera-pan',
  FOCUS_SUBJECT: 'kingdom:focus-subject',
  KINGDOM_EVENT: 'kingdom:event',
  TRAIN_AT_BUILDING: 'kingdom:train-at-building',
  GRANT_MARRIAGE: 'kingdom:grant-marriage',
  GRANT_CHILD: 'kingdom:grant-child',
  MARRIAGE_HOUSE_SPENT: 'kingdom:marriage-house-spent',
  AUTO_GRANT_FAMILY_WISH: 'kingdom:auto-grant-family-wish',
} as const;

export type SubjectSelectedPayload = SubjectSnapshot | null;
export type BuildingSelectedPayload = BuildingSnapshot | null;
export type CampSelectedPayload = CampSnapshot | null;
export type DayTickPayload = DaySnapshot;

export interface GoldStolenPayload {
  amount: number;
  kind: string;
  label: string;
}

export interface GoldRecoveredPayload {
  amount: number;
  kind: string;
}

export interface GameOverPayload {
  reason: string;
}

export interface RaidWarningPayload {
  kind: string;
  label: string;
  x?: number;
  y?: number;
}

export interface HireSubjectPayload {
  role: UnitRole;
}

export interface BeginPlacePayload {
  kind: BuildKind;
  maxWallCells?: number;
}

export interface WallPlacedPayload {
  cells: number;
}

export interface PlaceModePayload {
  active: boolean;
  kind: BuildKind | null;
  mode?: 'place' | 'relocate';
  buildingId?: string | null;
}

export interface BeginRelocatePayload {
  buildingId: string;
}

export interface DemolishBuildingPayload {
  buildingId: string;
}

export interface BuildingDemolishedPayload {
  buildingId: string;
  refund: number;
}

export type KingdomStatsPayload = KingdomStats;

export interface MarketToastPayload {
  message: string;
}

export interface FoodChangedPayload {
  food: number;
}

export interface RoyalCapturedPayload {
  id: string;
  name: string;
  role: UnitRole;
  houseId: string;
  maxHp: number;
}

export interface PayRansomPayload {
  id: string;
}

export interface TransformPeasantPayload {
  fgmId: string;
}

export interface CaptivesChangedPayload {
  count: number;
}

export interface CommandDetachmentPayload {
  generalId: string;
  troopCount: number;
  /** camp id, or `monster:<id>`, or omit for nearest camp */
  targetId?: string;
}

export interface CommandKnightHuntPayload {
  /** Omit to send the nearest free knight. */
  knightId?: string;
  /** Omit to hunt the nearest monster to the knight. */
  monsterId?: string;
}

export interface MonsterSlainPayload {
  monsterId: string;
  kind: 'troll' | 'ogre' | 'dragon';
  name: string;
  x: number;
  y: number;
  slayerId?: string;
  slayerRole?: string;
  slayerName?: string;
}

export interface SetDaysPlayedPayload {
  daysPlayed: number;
}

export interface CareerHirePayload {
  subjectId: string;
  targetRole: UnitRole;
}

export interface AutoGrantWishPayload {
  subjectId: string;
  targetRole: UnitRole;
  cost: number;
}

export interface DestroyCampPayload {
  campId: string;
}

export interface ArrestCampPayload {
  campId: string;
}

export interface ArrestSubjectPayload {
  subjectId: string;
}

export interface ReleaseSubjectPayload {
  subjectId: string;
}

export interface FocusCampPayload {
  campId: string;
  /** Roster unit id the player clicked, when known. */
  unitId?: string;
}

export interface BuyNavalPayload {
  kind: NavalKind;
}

export type SandboxSpawnPayload = SandboxSpawnAction;

export interface CameraZoomPayload {
  /** +1 zoom in, -1 zoom out */
  direction: 1 | -1;
}

export interface CameraPanPayload {
  x: number;
  y: number;
}

export interface FocusSubjectPayload {
  subjectId: string;
}

export type KingdomEventSeverity = 'critical' | 'warn' | 'joy' | 'info';

export interface KingdomEventPayload {
  id: string;
  severity: KingdomEventSeverity;
  title: string;
  detail?: string;
  x?: number;
  y?: number;
  /** Auto-expire for non-pinned events (ms). Critical often omit and clear explicitly. */
  ttlMs?: number;
  /** When true, stays until an event with the same id and clear:true arrives, or severity clears. */
  pin?: boolean;
  /** Clear a previously pinned event with this id. */
  clear?: boolean;
}

export interface TrainAtBuildingPayload {
  buildingId: string;
  role: UnitRole;
  castleJob?: CivilianJob;
}

export interface GrantFamilyPayload {
  subjectId: string;
}

export interface MarriageHouseSpentPayload {
  cost: number;
}

export interface AutoGrantFamilyWishPayload {
  kind: 'marry' | 'have_child';
  subjectId: string;
}
