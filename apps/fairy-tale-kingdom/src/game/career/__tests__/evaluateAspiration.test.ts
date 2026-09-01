import { describe, expect, it } from 'vitest';
import { evaluateCareerAspiration } from '../evaluateAspiration';

const emptyBuildings = {
  hasDungeon: false,
  hasBarracks: false,
  hasCathedral: false,
  hasInfirmary: false,
  hasGallows: false,
  tavernCount: 0,
  roleCounts: {},
};

describe('evaluateCareerAspiration', () => {
  it('returns null when subject has no goal', () => {
    expect(
      evaluateCareerAspiration(
        { role: 'peasant', goal: null },
        emptyBuildings,
        { royaltyUnlocked: false },
        100
      )
    ).toBeNull();
  });

  it('executioner blocked without gallows', () => {
    const view = evaluateCareerAspiration(
      {
        role: 'peasant',
        goal: { kind: 'become_executioner', targetRole: 'executioner' },
      },
      { ...emptyBuildings, hasDungeon: true },
      { royaltyUnlocked: true },
      100
    );
    expect(view?.targetRole).toBe('executioner');
    expect(view?.canPromote).toBe(false);
    expect(view?.criteria.find((c) => c.id === 'gallows')?.met).toBe(false);
  });

  it('executioner can promote when all criteria met', () => {
    const view = evaluateCareerAspiration(
      {
        role: 'peasant',
        goal: { kind: 'become_executioner', targetRole: 'executioner' },
      },
      {
        ...emptyBuildings,
        hasDungeon: true,
        hasGallows: true,
        roleCounts: { executioner: 0 },
      },
      { royaltyUnlocked: true },
      100
    );
    expect(view?.canPromote).toBe(true);
  });

  it('guard blocked without dungeon', () => {
    const view = evaluateCareerAspiration(
      {
        role: 'peasant',
        goal: { kind: 'become_guard', targetRole: 'guard' },
      },
      emptyBuildings,
      { royaltyUnlocked: false },
      50
    );
    expect(view?.canPromote).toBe(false);
    expect(view?.criteria.find((c) => c.id === 'dungeon')?.met).toBe(false);
  });

  it('respects gold requirement', () => {
    const view = evaluateCareerAspiration(
      {
        role: 'peasant',
        goal: { kind: 'become_guard', targetRole: 'guard' },
      },
      { ...emptyBuildings, hasDungeon: true, roleCounts: { guard: 0 } },
      { royaltyUnlocked: false },
      5
    );
    expect(view?.criteria.find((c) => c.id === 'gold')?.met).toBe(false);
    expect(view?.canPromote).toBe(false);
  });

  it('infinite gold bypasses cost check', () => {
    const view = evaluateCareerAspiration(
      {
        role: 'peasant',
        goal: { kind: 'become_guard', targetRole: 'guard' },
      },
      { ...emptyBuildings, hasDungeon: true, roleCounts: { guard: 0 } },
      { royaltyUnlocked: false },
      0,
      true
    );
    expect(view?.criteria.find((c) => c.id === 'gold')?.met).toBe(true);
    expect(view?.canPromote).toBe(true);
  });
});
