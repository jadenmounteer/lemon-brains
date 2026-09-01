import { describe, expect, it } from 'vitest';
import { evaluateFamilyAspiration } from '../evaluateFamilyAspiration';
import { FAMILY_GOAL_HAVE_CHILD, FAMILY_GOAL_MARRY } from '../familyGoals';

const baseCtx = {
  subjects: [
    {
      id: 'm1',
      name: 'Tom',
      role: 'peasant',
      gender: 'male' as const,
      married: false,
      houseId: 'house-a',
      ageYears: 22,
      goal: {
        kind: FAMILY_GOAL_MARRY,
        targetId: 'f1',
        text: 'marry',
      },
    },
    {
      id: 'f1',
      name: 'Anna',
      role: 'peasant',
      gender: 'female' as const,
      married: false,
      houseId: 'house-b',
      ageYears: 21,
      goal: {
        kind: FAMILY_GOAL_MARRY,
        targetId: 'm1',
        text: 'marry',
      },
    },
  ],
  dwellings: [
    { id: 'house-a', kind: 'house' as const },
    { id: 'house-b', kind: 'house' as const },
  ],
  occupantCounts: new Map([
    ['house-a', 1],
    ['house-b', 1],
  ]),
  hasCathedral: true,
  hasBishop: true,
  weddingActive: false,
  gold: 100,
  infiniteGold: false,
};

describe('evaluateFamilyAspiration', () => {
  it('allows marriage grant when cathedral, bishop, and housing are ready', () => {
    const view = evaluateFamilyAspiration(baseCtx.subjects[0]!, baseCtx);
    expect(view?.kind).toBe(FAMILY_GOAL_MARRY);
    expect(view?.canGrant).toBe(true);
  });

  it('blocks marriage when cathedral missing', () => {
    const view = evaluateFamilyAspiration(baseCtx.subjects[0]!, {
      ...baseCtx,
      hasCathedral: false,
    });
    expect(view?.canGrant).toBe(false);
  });

  it('evaluates child wish housing', () => {
    const view = evaluateFamilyAspiration(
      {
        id: 'f1',
        name: 'Anna',
        role: 'peasant',
        gender: 'female',
        married: true,
        spouseId: 'm1',
        houseId: 'house-a',
        ageYears: 24,
        goal: { kind: FAMILY_GOAL_HAVE_CHILD, text: 'child' },
      },
      {
        ...baseCtx,
        occupantCounts: new Map([['house-a', 3], ['house-b', 1]]),
      }
    );
    expect(view?.kind).toBe(FAMILY_GOAL_HAVE_CHILD);
    expect(view?.canGrant).toBe(true);
  });
});
