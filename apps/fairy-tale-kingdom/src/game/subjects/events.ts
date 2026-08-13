import type { UnitRole } from '../art/assetManifest';
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
  PLACE_MODE_CHANGED: 'kingdom:place-mode-changed',
  KINGDOM_STATS: 'kingdom:stats',
  MARKET_TOAST: 'kingdom:market-toast',
  FOOD_CHANGED: 'kingdom:food-changed',
  GOLD_RECOVERED: 'kingdom:gold-recovered',
  ROYAL_CAPTURED: 'kingdom:royal-captured',
  PAY_RANSOM: 'kingdom:pay-ransom',
  TRANSFORM_PEASANT: 'kingdom:transform-peasant',
  CAPTIVES_CHANGED: 'kingdom:captives-changed',
  COMMAND_DETACHMENT: 'kingdom:command-detachment',
  SET_DAYS_PLAYED: 'kingdom:set-days-played',
  CAREER_HIRE: 'kingdom:career-hire',
  EXECUTE_CAPTIVE: 'kingdom:execute-captive',
  CAMP_SELECTED: 'kingdom:camp-selected',
  DESTROY_CAMP: 'kingdom:destroy-camp',
  ARREST_CAMP: 'kingdom:arrest-camp',
  FOCUS_CAMP: 'kingdom:focus-camp',
  BUY_NAVAL: 'kingdom:buy-naval',
  SANDBOX_SPAWN: 'kingdom:sandbox-spawn',
  CAMERA_ZOOM: 'kingdom:camera-zoom',
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
}

export interface HireSubjectPayload {
  role: UnitRole;
}

export interface BeginPlacePayload {
  kind: BuildKind;
}

export interface PlaceModePayload {
  active: boolean;
  kind: BuildKind | null;
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

export interface SetDaysPlayedPayload {
  daysPlayed: number;
}

export interface CareerHirePayload {
  subjectId: string;
  targetRole: UnitRole;
}

export interface DestroyCampPayload {
  campId: string;
}

export interface ArrestCampPayload {
  campId: string;
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
