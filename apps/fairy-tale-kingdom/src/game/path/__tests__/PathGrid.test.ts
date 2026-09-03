import { describe, expect, it } from 'vitest';
import { PathGrid } from '../PathGrid';

const TILE = 16;

describe('PathGrid', () => {
  it('snaps blocked goals to the nearest open side of a wall', () => {
    const grid = new PathGrid(320, 320, TILE);
    // Vertical wall column at col 5
    for (let row = 0; row < 20; row++) {
      grid.markAabbBlocked({
        left: 5 * TILE,
        right: 6 * TILE,
        top: row * TILE,
        bottom: (row + 1) * TILE,
      });
    }

    const eastGoal = { x: 5 * TILE + TILE / 2 + 40, y: 8 * TILE + TILE / 2 };
    const snappedEast = grid.snapWorldToOpen(eastGoal.x, eastGoal.y);
    expect(snappedEast.x).toBeGreaterThan(6 * TILE);

    const westGoal = { x: 5 * TILE + TILE / 2 - 40, y: 8 * TILE + TILE / 2 };
    const snappedWest = grid.snapWorldToOpen(westGoal.x, westGoal.y);
    expect(snappedWest.x).toBeLessThan(5 * TILE);
  });

  it('findPath routes around a wall instead of through it', () => {
    const grid = new PathGrid(320, 320, TILE);
    for (let row = 2; row < 18; row++) {
      grid.markAabbBlocked({
        left: 5 * TILE,
        right: 6 * TILE,
        top: row * TILE,
        bottom: (row + 1) * TILE,
      });
    }

    const from = { x: 2 * TILE, y: 10 * TILE };
    const to = { x: 9 * TILE, y: 10 * TILE };
    const path = grid.findPath(from, to);
    expect(path).not.toBeNull();
    for (const pt of path!) {
      expect(grid.isWorldBlocked(pt.x, pt.y)).toBe(false);
    }
    const end = path![path!.length - 1]!;
    expect(end.x).toBeGreaterThan(5 * TILE);
  });
});
