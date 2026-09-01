import { describe, expect, it } from 'vitest';
import { listEligibleFestivals } from '../../game/events/festivalRequirements';

describe('listEligibleFestivals', () => {
  const baseCtx = {
    buildings: [
      { kind: 'house' as const, x: 100, y: 100, hp: 100 },
      { kind: 'house' as const, x: 110, y: 105, hp: 100 },
      { kind: 'house' as const, x: 105, y: 115, hp: 100 },
    ],
    countRole: (role: string) => (role === 'peasant' ? 6 : 0),
    countJob: () => 0,
    hasKingOrQueen: false,
    hasKingAndQueen: false,
  };

  it('includes peasant festival when cluster and population met', () => {
    const list = listEligibleFestivals(baseCtx);
    expect(list.some((f) => f.kind === 'peasant')).toBe(true);
  });

  it('excludes peasant festival when too few peasants', () => {
    const list = listEligibleFestivals({
      ...baseCtx,
      countRole: () => 2,
    });
    expect(list.some((f) => f.kind === 'peasant')).toBe(false);
  });

  it('includes market festival when market and merchant present', () => {
    const list = listEligibleFestivals({
      ...baseCtx,
      buildings: [
        ...baseCtx.buildings,
        { kind: 'market' as const, x: 200, y: 200, hp: 100 },
      ],
      countJob: (job: string) => (job === 'merchant' ? 1 : 0),
    });
    expect(list.some((f) => f.kind === 'market')).toBe(true);
  });
});
