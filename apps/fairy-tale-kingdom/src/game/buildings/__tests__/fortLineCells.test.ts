import { describe, expect, it } from 'vitest';
import {
  fortCenter,
  fortLineCells,
  fortSnap,
  WALL_MAX_DRAG_CELLS,
} from '../buildingShared';

describe('fortLineCells', () => {
  it('returns a single cell when start equals end', () => {
    const x = fortSnap(40);
    const y = fortSnap(40);
    expect(fortLineCells(x, y, x, y)).toEqual([{ x, y }]);
  });

  it('draws a horizontal Bresenham line', () => {
    const y = fortCenter(5);
    const cells = fortLineCells(fortCenter(2), y, fortCenter(6), y);
    expect(cells).toHaveLength(5);
    expect(cells.map((c) => c.x)).toEqual([
      fortCenter(2),
      fortCenter(3),
      fortCenter(4),
      fortCenter(5),
      fortCenter(6),
    ]);
    expect(cells.every((c) => c.y === y)).toBe(true);
  });

  it('draws a vertical Bresenham line', () => {
    const x = fortCenter(4);
    const cells = fortLineCells(x, fortCenter(1), x, fortCenter(4));
    expect(cells).toHaveLength(4);
    expect(cells.map((c) => c.y)).toEqual([
      fortCenter(1),
      fortCenter(2),
      fortCenter(3),
      fortCenter(4),
    ]);
  });

  it('draws an L-shaped diagonal via Bresenham', () => {
    const cells = fortLineCells(
      fortCenter(0),
      fortCenter(0),
      fortCenter(3),
      fortCenter(3)
    );
    expect(cells.length).toBeGreaterThanOrEqual(4);
    expect(cells[0]).toEqual({ x: fortCenter(0), y: fortCenter(0) });
    expect(cells[cells.length - 1]).toEqual({
      x: fortCenter(3),
      y: fortCenter(3),
    });
  });

  it('caps at maxCells', () => {
    const cells = fortLineCells(
      fortCenter(0),
      fortCenter(0),
      fortCenter(100),
      fortCenter(0),
      10
    );
    expect(cells).toHaveLength(10);
  });

  it('respects WALL_MAX_DRAG_CELLS default cap', () => {
    const cells = fortLineCells(
      fortCenter(0),
      fortCenter(0),
      fortCenter(200),
      fortCenter(0)
    );
    expect(cells.length).toBeLessThanOrEqual(WALL_MAX_DRAG_CELLS);
  });
});
