import { describe, expect, it } from 'vitest';
import {
  appearanceTint,
  resolveSubjectTexture,
} from '../resolveSubjectTexture';

describe('resolveSubjectTexture', () => {
  it('picks elder sheets at 55+', () => {
    expect(
      resolveSubjectTexture({
        role: 'peasant',
        gender: 'male',
        ageYears: 60,
      })
    ).toBe('peasant_elder_m');
    expect(
      resolveSubjectTexture({
        role: 'peasant',
        gender: 'female',
        ageYears: 58,
      })
    ).toBe('peasant_elder_f');
  });

  it('picks job sheets for working peasants', () => {
    expect(
      resolveSubjectTexture({
        role: 'peasant',
        gender: 'male',
        ageYears: 30,
        job: 'farmer',
      })
    ).toBe('peasant_farmer');
    expect(
      resolveSubjectTexture({
        role: 'peasant',
        gender: 'female',
        ageYears: 28,
        job: 'baker',
      })
    ).toBe('peasant_baker');
  });

  it('returns palette tints for appearance variants', () => {
    expect(appearanceTint(0)).toBe(0xffffff);
    expect(appearanceTint(3)).toBe(0xe8f5e8);
    expect(appearanceTint(undefined)).toBeNull();
  });
});
