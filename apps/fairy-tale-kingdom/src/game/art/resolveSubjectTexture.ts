import type { CivilianJob } from '../jobs/capacities';
import type { UnitRole } from './assetManifest';
import { Phase12Balance } from '../economy/phase12Balance';

export type PeasantVisualKey =
  | 'peasant'
  | 'peasant_elder_m'
  | 'peasant_elder_f'
  | 'peasant_farmer'
  | 'peasant_baker'
  | 'peasant_merchant'
  | 'peasant_fisher';

export const PEASANT_VISUAL_KEYS: PeasantVisualKey[] = [
  'peasant_elder_m',
  'peasant_elder_f',
  'peasant_farmer',
  'peasant_baker',
  'peasant_merchant',
  'peasant_fisher',
];

export interface SubjectVisualInput {
  role: UnitRole;
  gender: 'male' | 'female';
  ageYears?: number;
  job?: CivilianJob;
  appearanceVariant?: number;
  legendId?: string;
}

/** Pick sprite sheet key for a subject (peasant variants + role fallback). */
export function resolveSubjectTexture(input: SubjectVisualInput): string {
  if (input.role === 'thief') return 'bandit';
  if (input.role !== 'peasant') return input.role;

  const elderAge = Phase12Balance.elderAge ?? 55;
  if ((input.ageYears ?? 0) >= elderAge) {
    return input.gender === 'male' ? 'peasant_elder_m' : 'peasant_elder_f';
  }

  switch (input.job) {
    case 'farmer':
      return 'peasant_farmer';
    case 'baker':
      return 'peasant_baker';
    case 'merchant':
      return 'peasant_merchant';
    case 'fisherman':
      return 'peasant_fisher';
    default:
      return 'peasant';
  }
}

/** Subtle per-villager tints from appearanceVariant (0–5). */
export function appearanceTint(variant?: number): number | null {
  if (variant == null) return null;
  const palette = [
    0xffffff,
    0xfff4e8,
    0xf0e8ff,
    0xe8f5e8,
    0xffe8e8,
    0xe8f0ff,
  ];
  return palette[variant % palette.length] ?? null;
}
