import { describe, expect, it } from 'vitest';
import { PathGrid } from '../../path/PathGrid';
import { footprintAabb } from '../buildingShared';
import { buildingDoorApproach } from '../layouts/buildingDoors';

const TILE = 16;

function punchOutdoorDoorApproach(
  pathGrid: PathGrid,
  kind: 'house',
  origin: { x: number; y: number }
): void {
  const approach = buildingDoorApproach(kind, origin);
  const half = pathGrid.tile / 2;
  for (const dx of [-half, 0, half]) {
    pathGrid.clearBlockedAtWorld(approach.x + dx, approach.y);
  }
}

describe('building path grid', () => {
  it('blocks house interior except the outdoor door approach', () => {
    const grid = new PathGrid(800, 600, TILE);
    const house = { x: 200, y: 300 };
    grid.markAabbBlocked(footprintAabb('house', house.x, house.y));
    punchOutdoorDoorApproach(grid, 'house', house);

    const box = footprintAabb('house', house.x, house.y);
    const centerX = (box.left + box.right) / 2;
    const centerY = (box.top + box.bottom) / 2;
    expect(grid.isWorldBlocked(centerX, centerY)).toBe(true);

    const approach = buildingDoorApproach('house', house);
    expect(grid.isWorldBlocked(approach.x, approach.y)).toBe(false);
  });

  it('routes around a house instead of through it', () => {
    const grid = new PathGrid(800, 600, TILE);
    const house = { x: 200, y: 300 };
    grid.markAabbBlocked(footprintAabb('house', house.x, house.y));
    punchOutdoorDoorApproach(grid, 'house', house);

    const box = footprintAabb('house', house.x, house.y);
    const from = { x: box.left - 40, y: house.y };
    const to = { x: box.right + 40, y: house.y };
    const path = grid.findPath(from, to);
    expect(path).not.toBeNull();
    for (const pt of path!) {
      expect(grid.isWorldBlocked(pt.x, pt.y)).toBe(false);
      const inside =
        pt.x > box.left + 4 &&
        pt.x < box.right - 4 &&
        pt.y > box.top + 4 &&
        pt.y < box.bottom - 4;
      expect(inside).toBe(false);
    }
  });
});
