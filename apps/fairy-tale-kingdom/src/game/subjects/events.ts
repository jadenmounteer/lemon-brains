import type { UnitRole } from '../art/assetManifest';
import type { BuildKind } from '../../marketplace/catalog';
import type { DaySnapshot, KingdomStats, SubjectSnapshot } from './types';

/** Phaser game.events channel names for the React bridge */
export const KingdomEvents = {
  SUBJECT_SELECTED: 'kingdom:subject-selected',
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
} as const;

export type SubjectSelectedPayload = SubjectSnapshot | null;
export type DayTickPayload = DaySnapshot;

export interface GoldStolenPayload {
  amount: number;
  kind: string;
  label: string;
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
