import type { BuildKind, NavalKind } from '../marketplace/catalog';
import type { SandboxSpawnAction } from '../kingdom/sandboxSettings';
import type { CivilianJob } from './jobs/capacities';
import type { UnitRole } from './art/assetManifest';

/** React → Phaser command channel (replaces many `{ seq, … }` props). */
export type GameCommand =
  | { type: 'HIRE_SUBJECT'; seq: number; role: UnitRole }
  | {
      type: 'TRAIN_AT_BUILDING';
      seq: number;
      buildingId: string;
      role: UnitRole;
      castleJob?: CivilianJob;
    }
  | { type: 'BEGIN_PLACE'; seq: number; kind: BuildKind; maxWallCells?: number }
  | { type: 'CANCEL_PLACE'; seq: number }
  | { type: 'BEGIN_RELOCATE'; seq: number; buildingId: string }
  | { type: 'DEMOLISH_BUILDING'; seq: number; buildingId: string }
  | { type: 'GRANT_MARRIAGE'; seq: number; subjectId: string }
  | { type: 'GRANT_CHILD'; seq: number; subjectId: string }
  | { type: 'PAY_RANSOM'; seq: number; id: string }
  | { type: 'TRANSFORM_PEASANT'; seq: number; fgmId: string }
  | {
      type: 'COMMAND_DETACHMENT';
      seq: number;
      generalId: string;
      troopCount: number;
      /** camp id, or `monster:<id>`, or omit for nearest camp */
      targetId?: string;
    }
  | {
      type: 'PROMOTE_CAREER';
      seq: number;
      subjectId: string;
      targetRole: UnitRole;
    }
  | { type: 'EXECUTE_CAPTIVE'; seq: number; id: string }
  | { type: 'DESTROY_CAMP'; seq: number; campId: string }
  | { type: 'ARREST_CAMP'; seq: number; campId: string }
  | { type: 'FOCUS_CAMP'; seq: number; campId: string; unitId?: string }
  | { type: 'BUY_NAVAL'; seq: number; kind: NavalKind }
  | { type: 'SANDBOX_SPAWN'; seq: number; action: SandboxSpawnAction }
  | { type: 'CAMERA_ZOOM'; seq: number; direction: 1 | -1 }
  | { type: 'CAMERA_PAN'; seq: number; x: number; y: number }
  | { type: 'FOCUS_SUBJECT'; seq: number; subjectId: string }
  | { type: 'SET_DAYS_PLAYED'; seq: number; daysPlayed: number }
  | { type: 'CLEAR_SELECTION'; seq: number };

export function nextCommandSeq(): number {
  return Date.now();
}
