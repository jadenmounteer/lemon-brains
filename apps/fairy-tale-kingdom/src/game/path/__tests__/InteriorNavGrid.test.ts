import { describe, expect, it } from 'vitest';
import { InteriorNavGrid } from '../InteriorNavGrid';
import { getInteriorNavSpec } from '../../buildings/layouts/InteriorLayoutRegistry';
import { footprintAabb } from '../../buildings/buildingShared';

describe('InteriorNavGrid', () => {
  const origin = { x: 400, y: 300 };

  it('house nav avoids perimeter walls', () => {
    const spec = getInteriorNavSpec('house');
    expect(spec).not.toBeNull();
    const grid = new InteriorNavGrid(spec!);
    const box = footprintAabb('house', origin.x, origin.y);
    const inner = grid.cellToWorld(origin, 'house', 3, 3);
    const wall = grid.cellToWorld(origin, 'house', 0, 0);
    expect(inner.x).toBeGreaterThan(box.left);
    expect(inner.y).toBeGreaterThan(box.top);
    expect(grid.isWalkable(3, 3)).toBe(true);
    expect(grid.isWalkable(0, 0)).toBe(false);
    const path = grid.findPath(
      origin,
      'house',
      inner.x,
      inner.y,
      grid.cellToWorld(origin, 'house', 5, 4).x,
      grid.cellToWorld(origin, 'house', 5, 4).y
    );
    expect(path.length).toBeGreaterThan(1);
    for (const p of path) {
      expect(p.x).toBeGreaterThan(wall.x);
    }
  });

  it('snaps off-wall points to nearest walkable cell', () => {
    const spec = getInteriorNavSpec('tavern');
    const grid = new InteriorNavGrid(spec!);
    const snapped = grid.nearestWalkable(origin, 'tavern', origin.x, origin.y - 40);
    const cell = grid.worldToCell(origin, 'tavern', snapped.x, snapped.y);
    expect(cell).not.toBeNull();
    expect(grid.isWalkable(cell![0], cell![1])).toBe(true);
  });
});
