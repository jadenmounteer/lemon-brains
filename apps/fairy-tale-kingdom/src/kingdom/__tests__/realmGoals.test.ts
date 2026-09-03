import { describe, expect, it } from 'vitest';
import { suggestRealmGoal } from '../realmGoals';
import type { KingdomStats } from '../../game/subjects/types';

const baseStats: KingdomStats = {
  population: 8,
  capacity: 12,
  freeBeds: 4,
  houseCount: 3,
  wallCount: 0,
  tavernCount: 0,
  fieldCount: 0,
  granaryCount: 0,
  keepCount: 1,
  hasCathedral: false,
  hasInfirmary: false,
  hasDungeon: false,
  hasBarracks: false,
  hasGallows: false,
  hasCemetery: false,
  hasDock: false,
  dockCount: 0,
  fishingBoatCount: 0,
  fishingBoatCapacity: 0,
  warshipCount: 0,
  warshipCapacity: 0,
  hasKing: false,
  hasQueen: false,
  hasPrince: false,
  hasPrincess: false,
  hasFairyGodmother: false,
  hasBishop: false,
  hasGeneral: false,
  hasKnight: false,
  hasExecutioner: false,
  royaltyUnlocked: false,
  inspired: false,
  food: 20,
  captiveCount: 0,
  kingCount: 0,
  queenCount: 0,
  fieldSlots: 0,
  militaryAvailable: 0,
};

describe('suggestRealmGoal', () => {
  it('asks for gold when broke and no granary', () => {
    const g = suggestRealmGoal({ stats: baseStats, gold: 0, food: 20 });
    expect(g?.id).toBe('earn-gold');
    expect(g?.action).toBe('questions');
  });

  it('asks for granary when gold is enough', () => {
    const g = suggestRealmGoal({ stats: baseStats, gold: 50, food: 20 });
    expect(g?.id).toBe('build-granary');
    expect(g?.action).toBe('market-granary');
  });

  it('asks for fields after granary', () => {
    const g = suggestRealmGoal({
      stats: { ...baseStats, granaryCount: 1, fieldSlots: 2 },
      gold: 50,
      food: 20,
    });
    expect(g?.id).toBe('plant-fields');
  });

  it('warns when food is low', () => {
    const g = suggestRealmGoal({
      stats: {
        ...baseStats,
        granaryCount: 1,
        fieldCount: 1,
        fieldSlots: 2,
        population: 10,
      },
      gold: 50,
      food: 10,
    });
    expect(g?.id).toBe('food-low');
  });

  it('surfaces career todos then walls', () => {
    const withTodo = suggestRealmGoal({
      stats: {
        ...baseStats,
        granaryCount: 1,
        fieldCount: 2,
        fieldSlots: 2,
        food: 80,
        careerTodos: [
          {
            subjectId: 'p1',
            name: 'Ava',
            targetRole: 'guard',
            targetLabel: 'Guard',
            cost: 18,
          },
        ],
      },
      gold: 50,
      food: 80,
    });
    expect(withTodo?.action).toBe('select-subject');

    const walls = suggestRealmGoal({
      stats: {
        ...baseStats,
        granaryCount: 1,
        fieldCount: 2,
        fieldSlots: 2,
        wallCount: 0,
        population: 4,
      },
      gold: 50,
      food: 80,
    });
    expect(walls?.id).toBe('raise-walls');
  });
});
