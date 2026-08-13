import type { UnitRole } from '../art/assetManifest';
import type { BuildKind } from '../../marketplace/catalog';

/** Max workers of a role that can bind to one building of this kind. */
export const BUILDING_ROLE_CAPACITY: Partial<
  Record<BuildKind, Partial<Record<UnitRole, number>>>
> = {
  field: { peasant: 3 },
  bakery: { peasant: 2 },
  market: { peasant: 2 },
  barracks: {
    soldier: 4,
    archer: 4,
    elite_archer: 2,
    knight: 3,
    elite_guard: 2,
    general: 1,
  },
  dungeon: {
    guard: 4,
    dungeon_keeper: 1,
    executioner: 1,
  },
  cathedral: {
    bishop: 1,
    witch_hunter: 2,
  },
  infirmary: {
    physician: 2,
  },
  tavern: {
    jester: 1,
  },
  keep: {
    duke: 1,
    duchess: 1,
    /** Castle staff share peasant slots on the keep. */
    peasant: 8,
  },
  gallows: {
    executioner: 1,
  },
  dock: {
    peasant: 3,
  },
};

export type CivilianJob =
  | 'farmer'
  | 'baker'
  | 'merchant'
  | 'fisherman'
  | 'cook'
  | 'servant'
  | 'steward'
  | 'scribe'
  | 'cupbearer';

export const CASTLE_JOBS: CivilianJob[] = [
  'cook',
  'servant',
  'steward',
  'scribe',
  'cupbearer',
];

/** Per-keep capacity for each castle staff job. */
export const CASTLE_JOB_CAPACITY: Record<
  'cook' | 'servant' | 'steward' | 'scribe' | 'cupbearer',
  number
> = {
  cook: 2,
  servant: 3,
  steward: 1,
  scribe: 1,
  cupbearer: 1,
};

export function isCastleJob(job: CivilianJob | undefined): boolean {
  return !!job && (CASTLE_JOBS as string[]).includes(job);
}

export function civilianJobForBuilding(
  kind: BuildKind
): CivilianJob | null {
  if (kind === 'field') return 'farmer';
  if (kind === 'bakery') return 'baker';
  if (kind === 'market') return 'merchant';
  if (kind === 'dock') return 'fisherman';
  return null;
}

export function jobLabel(job: CivilianJob | undefined): string {
  switch (job) {
    case 'farmer':
      return 'Farmer';
    case 'baker':
      return 'Baker';
    case 'merchant':
      return 'Merchant';
    case 'fisherman':
      return 'Fisherman';
    case 'cook':
      return 'Cook';
    case 'servant':
      return 'Servant';
    case 'steward':
      return 'Steward';
    case 'scribe':
      return 'Scribe';
    case 'cupbearer':
      return 'Cupbearer';
    default:
      return '';
  }
}

export const CAREER_ROLES: UnitRole[] = [
  'guard',
  'soldier',
  'archer',
  'knight',
  'general',
  'bishop',
  'witch_hunter',
  'dungeon_keeper',
  'executioner',
  'jester',
  'physician',
];

/** Roles that may set a become_* career goal. */
export const CAREER_ASPIRANT_ROLES: UnitRole[] = [
  'peasant',
  'guard',
  'elite_guard',
  'soldier',
];

/** Which target roles each aspirant may pursue. */
export function careerTargetsFor(role: UnitRole): UnitRole[] {
  switch (role) {
    case 'peasant':
      return [
        'guard',
        'soldier',
        'archer',
        'knight',
        'bishop',
        'witch_hunter',
        'dungeon_keeper',
        'executioner',
        'jester',
        'physician',
      ];
    case 'guard':
    case 'elite_guard':
      return ['knight'];
    case 'soldier':
      return ['knight', 'general'];
    default:
      return [];
  }
}

export function careerGoalKind(role: UnitRole): string {
  return `become_${role}`;
}

export function roleFromCareerGoal(kind: string): UnitRole | null {
  if (!kind.startsWith('become_')) return null;
  const role = kind.slice('become_'.length) as UnitRole;
  return CAREER_ROLES.includes(role) ? role : null;
}
