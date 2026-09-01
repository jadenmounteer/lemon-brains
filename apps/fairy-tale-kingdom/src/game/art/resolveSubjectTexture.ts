import type { CivilianJob } from '../jobs/capacities';
import type { UnitRole } from './assetManifest';
import { Phase12Balance } from '../economy/phase12Balance';

export type PeasantVisualKey =
  | 'peasant_m'
  | 'peasant_f'
  | 'peasant_elder_m'
  | 'peasant_elder_f'
  | 'peasant_farmer_m'
  | 'peasant_farmer_f'
  | 'peasant_baker_m'
  | 'peasant_baker_f'
  | 'peasant_merchant_m'
  | 'peasant_merchant_f'
  | 'peasant_fisher_m'
  | 'peasant_fisher_f';

export const PEASANT_VISUAL_KEYS: PeasantVisualKey[] = [
  'peasant_m',
  'peasant_f',
  'peasant_elder_m',
  'peasant_elder_f',
  'peasant_farmer_m',
  'peasant_farmer_f',
  'peasant_baker_m',
  'peasant_baker_f',
  'peasant_merchant_m',
  'peasant_merchant_f',
  'peasant_fisher_m',
  'peasant_fisher_f',
];

export interface SubjectVisualInput {
  role: UnitRole;
  gender: 'male' | 'female';
  ageYears?: number;
  job?: CivilianJob;
  appearanceVariant?: number;
  legendId?: string;
}

function genderSuffix(gender: 'male' | 'female'): 'm' | 'f' {
  return gender === 'male' ? 'm' : 'f';
}

/** Stable sprite key for a peasant body + job variant. */
export function peasantVisualKey(
  kind: 'base' | 'elder' | CivilianJob,
  gender: 'male' | 'female'
): PeasantVisualKey {
  const g = genderSuffix(gender);
  if (kind === 'base') return `peasant_${g}`;
  if (kind === 'elder') return `peasant_elder_${g}`;
  switch (kind) {
    case 'farmer':
      return `peasant_farmer_${g}`;
    case 'baker':
      return `peasant_baker_${g}`;
    case 'merchant':
      return `peasant_merchant_${g}`;
    case 'fisherman':
      return `peasant_fisher_${g}`;
    default:
      return `peasant_${g}`;
  }
}

/** Pick sprite sheet key for a subject (peasant variants + role fallback). */
export function resolveSubjectTexture(input: SubjectVisualInput): string {
  if (input.role === 'thief') return 'bandit';
  if (input.role !== 'peasant') return input.role;

  const elderAge = Phase12Balance.elderAge ?? 55;
  if ((input.ageYears ?? 0) >= elderAge) {
    return peasantVisualKey('elder', input.gender);
  }

  if (input.job) {
    return peasantVisualKey(input.job, input.gender);
  }

  return peasantVisualKey('base', input.gender);
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
