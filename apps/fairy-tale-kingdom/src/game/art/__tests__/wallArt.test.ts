import { describe, expect, it } from 'vitest';
import {
  WALKWAY_THICK,
  WALKWAY_X,
  WALKWAY_Y,
  WALL_SPRITE_H,
  WALL_SPRITE_W,
  horizontalWalkwayWorldY,
  verticalWalkwayWorldX,
  wallOrientation,
  walkwayLineSpec,
} from '../wallArt';
import { fortCenter } from '../../buildings/buildingShared';

describe('wallOrientation', () => {
  it('classifies corner masks', () => {
    expect(wallOrientation(3)).toBe('corner');
    expect(wallOrientation(12)).toBe('corner');
  });

  it('classifies horizontal runs', () => {
    expect(wallOrientation(10)).toBe('horizontal');
    expect(wallOrientation(2)).toBe('horizontal');
    expect(wallOrientation(8)).toBe('horizontal');
  });

  it('classifies vertical runs', () => {
    expect(wallOrientation(5)).toBe('vertical');
    expect(wallOrientation(1)).toBe('vertical');
    expect(wallOrientation(4)).toBe('vertical');
  });
});

describe('walkwayLineSpec alignment', () => {
  it('uses same local Y for horizontal segments', () => {
    const a = walkwayLineSpec('horizontal', 10, WALL_SPRITE_W, WALL_SPRITE_H);
    const b = walkwayLineSpec('horizontal', 10, WALL_SPRITE_W, WALL_SPRITE_H);
    expect(a[0]!.y).toBe(WALKWAY_Y);
    expect(a[0]!.y).toBe(b[0]!.y);
  });

  it('aligns horizontal walkway world Y for cells on the same fort row', () => {
    const row = 4;
    const wyA = horizontalWalkwayWorldY(fortCenter(row));
    const wyB = horizontalWalkwayWorldY(fortCenter(row));
    expect(wyA).toBe(wyB);
    expect(wyA).toBe(
      fortCenter(row) - WALL_SPRITE_H * 0.75 + WALKWAY_Y + WALKWAY_THICK / 2
    );
  });

  it('aligns vertical walkway world X for cells on the same fort column', () => {
    const col = 3;
    const wxA = verticalWalkwayWorldX(fortCenter(col));
    const wxB = verticalWalkwayWorldX(fortCenter(col));
    expect(wxA).toBe(wxB);
    expect(wxA).toBe(
      fortCenter(col) - WALL_SPRITE_W / 2 + WALKWAY_X + WALKWAY_THICK / 2
    );
  });

  it('draws L-shaped walkway at corners', () => {
    const rects = walkwayLineSpec('corner', 3, WALL_SPRITE_W, WALL_SPRITE_H);
    expect(rects.length).toBe(2);
    const hasHorizontal = rects.some((r) => r.w > r.h);
    const hasVertical = rects.some((r) => r.h > r.w);
    expect(hasHorizontal).toBe(true);
    expect(hasVertical).toBe(true);
  });

  it('walkway band thickness is consistent', () => {
    const h = walkwayLineSpec('horizontal', 10, WALL_SPRITE_W, WALL_SPRITE_H)[0]!;
    const v = walkwayLineSpec('vertical', 5, WALL_SPRITE_W, WALL_SPRITE_H)[0]!;
    expect(h.h).toBe(WALKWAY_THICK);
    expect(v.w).toBe(WALKWAY_THICK);
    expect(v.x).toBeCloseTo(WALKWAY_X - WALKWAY_THICK / 2, 0);
  });
});
