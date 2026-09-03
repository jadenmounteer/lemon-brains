import { describe, expect, it } from 'vitest';
import {
  defectHoursNeeded,
  findChildHome,
  findMarriageHome,
  isHomelessHouseId,
} from '../familyHousing';

const dwellings = [
  { id: 'house-a', kind: 'house' as const },
  { id: 'house-b', kind: 'house' as const },
  { id: 'house-c', kind: 'house' as const },
];

describe('findMarriageHome', () => {
  it('lets partner move into a house with a free bed', () => {
    const counts = new Map([
      ['house-a', 3],
      ['house-b', 1],
    ]);
    const result = findMarriageHome(
      { id: 'm1', houseId: 'house-a' },
      { id: 'f1', houseId: 'house-b' },
      dwellings,
      counts
    );
    expect(result).toEqual({
      ok: true,
      houseId: 'house-b',
      moverId: 'm1',
    });
  });

  it('offers new house path when all dwellings are full', () => {
    const counts = new Map([
      ['house-a', 3],
      ['house-b', 3],
      ['house-c', 3],
    ]);
    const result = findMarriageHome(
      { id: 'm1', houseId: 'house-a' },
      { id: 'f1', houseId: 'house-b' },
      dwellings,
      counts,
      { gold: 50, houseBuildCost: 30 }
    );
    expect(result).toEqual({ ok: true, needsNewHouse: true });
  });
});

describe('isHomelessHouseId', () => {
  it('treats empty house ids as homeless', () => {
    expect(isHomelessHouseId('')).toBe(true);
    expect(isHomelessHouseId(null)).toBe(true);
    expect(isHomelessHouseId(undefined)).toBe(true);
  });

  it('does not treat camp housing as homeless', () => {
    expect(isHomelessHouseId('camp:bandit-1', false)).toBe(false);
  });

  it('treats a missing dwelling as homeless', () => {
    expect(isHomelessHouseId('house-1', false)).toBe(true);
    expect(isHomelessHouseId('house-1', true)).toBe(false);
  });
});

describe('defectHoursNeeded', () => {
  it('shortens the miserable wait when homeless', () => {
    expect(defectHoursNeeded(false, { housed: 6, homeless: 3 })).toBe(6);
    expect(defectHoursNeeded(true, { housed: 6, homeless: 3 })).toBe(3);
  });
});

describe('findChildHome', () => {
  it('uses another house when mothers house is full', () => {
    const counts = new Map([
      ['house-a', 3],
      ['house-b', 1],
    ]);
    const result = findChildHome('house-a', 'house-b', dwellings, counts);
    expect(result).toEqual({ ok: true, houseId: 'house-b' });
  });
});
