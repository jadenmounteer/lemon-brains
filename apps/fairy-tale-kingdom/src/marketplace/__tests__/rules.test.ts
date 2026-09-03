import { describe, expect, it } from 'vitest';
import type { KingdomStats } from '../../game/subjects/types';
import {
  affordableWallCells,
  canPlaceBuilding,
  canTrain,
  hireCost,
  TRAINABLE_ROLES,
  wallPlacementCost,
  WALL_GOLD_PER_CELL,
  WALL_MAX_DRAG_CELLS,
  workersAtCap,
} from '../rules';

const baseStats: KingdomStats = {
  population: 4,
  capacity: 12,
  freeBeds: 4,
  houseCount: 2,
  wallCount: 0,
  tavernCount: 1,
  fieldCount: 1,
  granaryCount: 1,
  keepCount: 1,
  hasCathedral: true,
  hasInfirmary: true,
  hasDungeon: true,
  hasBarracks: true,
  hasGallows: true,
  hasCemetery: true,
  hasDock: true,
  dockCount: 1,
  fishingBoatCount: 0,
  fishingBoatCapacity: 3,
  warshipCount: 0,
  warshipCapacity: 2,
  hasKing: true,
  hasQueen: true,
  hasPrince: false,
  hasPrincess: false,
  hasFairyGodmother: false,
  hasBishop: false,
  hasGeneral: false,
  hasKnight: false,
  hasExecutioner: false,
  royaltyUnlocked: true,
  inspired: false,
  food: 50,
  captiveCount: 0,
  kingCount: 1,
  queenCount: 1,
  fieldSlots: 2,
  militaryAvailable: 0,
};

describe('TRAINABLE_ROLES', () => {
  it('includes barracks troops and keep royals', () => {
    expect(TRAINABLE_ROLES.barracks).toContain('soldier');
    expect(TRAINABLE_ROLES.keep).toContain('king');
    expect(TRAINABLE_ROLES.keep).toContain('queen');
    expect(TRAINABLE_ROLES.cathedral).toContain('bishop');
  });
});

describe('hireCost', () => {
  it('returns catalog cost for known roles', () => {
    expect(hireCost('peasant')).toBe(10);
    expect(hireCost('knight')).toBe(45);
  });
});

describe('canTrain', () => {
  it('allows soldier at barracks when royalty unlocked', () => {
    expect(canTrain('barracks', 'soldier', baseStats)).toBe(true);
  });

  it('blocks elite guard without royalty', () => {
    const stats = { ...baseStats, royaltyUnlocked: false };
    expect(canTrain('barracks', 'elite_guard', stats)).toBe(false);
  });

  it('blocks when building posts are full', () => {
    expect(
      canTrain('barracks', 'general', baseStats, { workersAtBuilding: 1 })
    ).toBe(false);
  });

  it('blocks king when throne is taken', () => {
    const stats = { ...baseStats, hasKing: true };
    expect(canTrain('keep', 'king', stats)).toBe(false);
  });

  it('blocks royals when keep royal slots are full', () => {
    expect(
      canTrain('keep', 'bishop', baseStats, { royalUsedAtKeep: 4 })
    ).toBe(false);
  });
});

describe('workersAtCap', () => {
  it('detects full peasant slots on a field', () => {
    expect(workersAtCap('field', 'peasant', 3)).toBe(true);
    expect(workersAtCap('field', 'peasant', 2)).toBe(false);
  });
});

describe('canPlaceBuilding', () => {
  it('blocks fields without granary capacity', () => {
    const stats = {
      ...baseStats,
      granaryCount: 0,
      fieldCount: 0,
      fieldSlots: 0,
    };
    expect(canPlaceBuilding('field', stats)).toBe(false);
  });

  it('blocks gallows without dungeon', () => {
    const stats = { ...baseStats, hasDungeon: false };
    expect(canPlaceBuilding('gallows', stats)).toBe(false);
  });

  it('allows house placement by default', () => {
    expect(canPlaceBuilding('house', baseStats)).toBe(true);
  });

  it('blocks a second keep once one already stands', () => {
    expect(canPlaceBuilding('keep', baseStats)).toBe(false);
    expect(canPlaceBuilding('keep', { ...baseStats, keepCount: 0 })).toBe(true);
  });

  it('blocks road tiles', () => {
    expect(canPlaceBuilding('road', baseStats)).toBe(false);
  });
});

describe('wall drag billing', () => {
  it('charges 3g per cell', () => {
    expect(wallPlacementCost(1)).toBe(3);
    expect(wallPlacementCost(5)).toBe(15);
    expect(WALL_GOLD_PER_CELL).toBe(3);
  });

  it('computes affordable cells from gold', () => {
    expect(affordableWallCells(0, false)).toBe(0);
    expect(affordableWallCells(8, false)).toBe(2);
    expect(affordableWallCells(192, false)).toBe(64);
    expect(affordableWallCells(999, false)).toBe(WALL_MAX_DRAG_CELLS);
    expect(affordableWallCells(0, true)).toBe(WALL_MAX_DRAG_CELLS);
  });
});
