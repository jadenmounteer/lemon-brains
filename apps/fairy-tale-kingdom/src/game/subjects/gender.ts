import type { UnitRole } from '../art/assetManifest';
import type { SubjectGender } from './types';

const FEMALE_NAMES = new Set([
  'Elowen',
  'Greta',
  'Hazel',
  'Juniper',
  'Mira',
  'Nessa',
  'Pip',
  'Sable',
  'Thistle',
]);

export function defaultGenderForRole(role: UnitRole): SubjectGender {
  switch (role) {
    case 'queen':
    case 'princess':
    case 'fairy_godmother':
      return 'female';
    case 'king':
    case 'prince':
    case 'bishop':
    case 'physician':
      return 'male';
    default:
      return 'male';
  }
}

export function genderForNewSubject(
  role: UnitRole,
  name: string,
  seed: number
): SubjectGender {
  if (
    role === 'queen' ||
    role === 'princess' ||
    role === 'fairy_godmother'
  ) {
    return 'female';
  }
  if (
    role === 'king' ||
    role === 'prince' ||
    role === 'bishop' ||
    role === 'physician'
  ) {
    return 'male';
  }
  const first = name.split(' ')[0] ?? '';
  if (FEMALE_NAMES.has(first)) return 'female';
  return seed % 2 === 0 ? 'female' : 'male';
}

export function genderLabel(g: SubjectGender): string {
  return g === 'female' ? 'Female' : 'Male';
}
