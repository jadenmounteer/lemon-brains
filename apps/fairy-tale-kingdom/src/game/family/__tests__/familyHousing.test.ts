import { describe, expect, it } from 'vitest';
import { findChildHome, findMarriageHome } from '../familyHousing';

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
