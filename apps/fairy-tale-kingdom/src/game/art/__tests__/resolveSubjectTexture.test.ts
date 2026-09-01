import { describe, expect, it } from 'vitest';
import {
  appearanceTint,
  peasantVisualKey,
  resolveSubjectTexture,
} from '../resolveSubjectTexture';

describe('resolveSubjectTexture', () => {
  it('picks gendered base sheets for adults', () => {
    expect(
      resolveSubjectTexture({
        role: 'peasant',
        gender: 'male',
        ageYears: 30,
      })
    ).toBe('peasant_m');
    expect(
      resolveSubjectTexture({
        role: 'peasant',
        gender: 'female',
        ageYears: 28,
      })
    ).toBe('peasant_f');
  });

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

  it('picks gendered job sheets for working peasants', () => {
    expect(
      resolveSubjectTexture({
        role: 'peasant',
        gender: 'male',
        ageYears: 30,
        job: 'farmer',
      })
    ).toBe('peasant_farmer_m');
    expect(
      resolveSubjectTexture({
        role: 'peasant',
        gender: 'female',
        ageYears: 28,
        job: 'baker',
      })
    ).toBe('peasant_baker_f');
  });

  it('builds stable peasant visual keys', () => {
    expect(peasantVisualKey('base', 'female')).toBe('peasant_f');
    expect(peasantVisualKey('fisherman', 'male')).toBe('peasant_fisher_m');
  });

  it('returns palette tints for appearance variants', () => {
    expect(appearanceTint(0)).toBe(0xffffff);
    expect(appearanceTint(3)).toBe(0xe8f5e8);
    expect(appearanceTint(undefined)).toBeNull();
  });
});
