import type { UnitRole } from '../art/assetManifest';

export type SubjectRole = UnitRole;

export type ZoneId = 'home' | 'path' | 'keep' | 'wall' | 'field';

export type ActivityId =
  | 'sleep'
  | 'work'
  | 'patrol'
  | 'gather'
  | 'idle_keep'
  | 'train';

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
