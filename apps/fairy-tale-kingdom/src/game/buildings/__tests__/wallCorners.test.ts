import { describe, expect, it } from 'vitest';
import {
  FORT_TILE,
  cornerExteriorGroundCells,
  isWallCornerMask,
  ladderGroundApproach,
  fortCenter,
} from '../buildingShared';

describe('wall corner helpers', () => {
  it('detects orthogonal corner masks', () => {
    expect(isWallCornerMask(3)).toBe(true);
    expect(isWallCornerMask(6)).toBe(true);
    expect(isWallCornerMask(9)).toBe(true);
    expect(isWallCornerMask(12)).toBe(true);
    expect(isWallCornerMask(5)).toBe(false);
    expect(isWallCornerMask(10)).toBe(false);
  });

  it('lists exterior ground cells for NE corner (mask 3)', () => {
    const wx = fortCenter(4);
    const wy = fortCenter(4);
    const cells = cornerExteriorGroundCells(wx, wy, 3);
    expect(cells).toEqual([
      { x: wx, y: wy + FORT_TILE },
      { x: wx - FORT_TILE, y: wy },
    ]);
  });

  it('lists exterior ground cells for SW corner (mask 12)', () => {
    const wx = fortCenter(4);
    const wy = fortCenter(4);
    const cells = cornerExteriorGroundCells(wx, wy, 12);
    expect(cells).toEqual([
      { x: wx, y: wy + FORT_TILE },
      { x: wx + FORT_TILE, y: wy },
    ]);
  });
});

describe('ladder ground approach', () => {
  it('places south-facing approach on the ground below the wall', () => {
    const wx = fortCenter(2);
    const wy = fortCenter(3);
    const ground = ladderGroundApproach(wx, wy, 'south');
    expect(ground).toEqual({ x: wx, y: wy + FORT_TILE });
  });
});
