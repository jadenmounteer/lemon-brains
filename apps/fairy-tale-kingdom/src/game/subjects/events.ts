import type { DaySnapshot, SubjectSnapshot } from './types';

/** Phaser game.events channel names for the React bridge */
export const KingdomEvents = {
  SUBJECT_SELECTED: 'kingdom:subject-selected',
  DAY_TICK: 'kingdom:day-tick',
  CLEAR_SELECTION: 'kingdom:clear-selection',
} as const;

export type SubjectSelectedPayload = SubjectSnapshot | null;
export type DayTickPayload = DaySnapshot;
