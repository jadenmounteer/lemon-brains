import { describe, expect, it } from 'vitest';
import { pickNearestInjured } from '../physicianHeal';

describe('pickNearestInjured', () => {
  it('picks a distant wounded soldier, not only nearby units', () => {
    const picked = pickNearestInjured('doc-1', { x: 0, y: 0 }, [
      {
        id: 'doc-1',
        name: 'Doc',
        x: 0,
        y: 0,
        hp: 20,
        maxHp: 28,
        onWall: false,
      },
      {
        id: 'healthy',
        name: 'Guard',
        x: 20,
        y: 0,
        hp: 40,
        maxHp: 40,
        onWall: false,
      },
      {
        id: 'camp-hurt',
        name: 'Bandit',
        x: 30,
        y: 0,
        hp: 5,
        maxHp: 25,
        onWall: false,
        allegiance: 'camp',
      },
      {
        id: 'fringe',
        name: 'Soldier',
        x: 800,
        y: 40,
        hp: 10,
        maxHp: 38,
        onWall: false,
      },
    ]);
    expect(picked?.id).toBe('fringe');
  });

  it('skips abducted/hidden patients', () => {
    const picked = pickNearestInjured('doc-1', { x: 0, y: 0 }, [
      {
        id: 'hidden',
        name: 'Taken',
        x: 10,
        y: 0,
        hp: 4,
        maxHp: 20,
        onWall: false,
        hidden: true,
      },
    ]);
    expect(picked).toBeNull();
  });
});
