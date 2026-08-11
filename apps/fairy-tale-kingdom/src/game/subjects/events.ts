import type { EnemyRole } from '../art/assetManifest';
import type { DaySnapshot, SubjectSnapshot } from './types';

/** Phaser game.events channel names for the React bridge */
export const KingdomEvents = {
  SUBJECT_SELECTED: 'kingdom:subject-selected',
  DAY_TICK: 'kingdom:day-tick',
  DAY_ROLLED: 'kingdom:day-rolled',
  CLEAR_SELECTION: 'kingdom:clear-selection',
  GOLD_STOLEN: 'kingdom:gold-stolen',
  GAME_OVER: 'kingdom:game-over',
  RAID_WARNING: 'kingdom:raid-warning',
} as const;

export type SubjectSelectedPayload = SubjectSnapshot | null;
export type DayTickPayload = DaySnapshot;

export interface GoldStolenPayload {
  amount: number;
  kind: EnemyRole;
  label: string;
}

export interface GameOverPayload {
  reason: string;
}

export interface RaidWarningPayload {
  kind: EnemyRole;
  label: string;
}
