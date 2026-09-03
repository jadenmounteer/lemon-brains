import { describe, expect, it } from 'vitest';
import { footprintAabb } from '../buildingShared';
import {
  cathedralBishopSpot,
  cathedralDoor,
  cathedralPewSpot,
} from '../layouts/CathedralLayout';
import {
  buildingDoorApproach,
  buildingDoorThreshold,
} from '../layouts/buildingDoors';
import {
  interiorWaypoints,
  pointInsideFootprint,
} from '../../path/interiorPathRouter';

describe('cathedral wedding pathing', () => {
  const origin = { x: 500, y: 400 };

  it('puts the door and bishop spot inside the footprint', () => {
    const door = cathedralDoor(origin);
    const bishop = cathedralBishopSpot(origin, 'bishop-1');
    expect(pointInsideFootprint('cathedral', origin, door.x, door.y)).toBe(true);
    expect(pointInsideFootprint('cathedral', origin, bishop.x, bishop.y)).toBe(
      true
    );
  });

  it('keeps the outdoor approach outside and threshold inside', () => {
    const approach = buildingDoorApproach('cathedral', origin);
    const threshold = buildingDoorThreshold('cathedral', origin);
    expect(
      pointInsideFootprint('cathedral', origin, approach.x, approach.y)
    ).toBe(false);
    expect(
      pointInsideFootprint('cathedral', origin, threshold.x, threshold.y)
    ).toBe(true);
  });

  it('routes the bishop from the outdoor approach to the altar spot', () => {
    const approach = buildingDoorApproach('cathedral', origin);
    const bishop = cathedralBishopSpot(origin, 'bishop-1');
    const points = interiorWaypoints(
      'cathedral',
      origin,
      approach.x,
      approach.y,
      bishop.x,
      bishop.y,
      'bishop-1'
    );
    expect(points.length).toBeGreaterThan(1);
    const last = points[points.length - 1]!;
    expect(Math.hypot(last.x - bishop.x, last.y - bishop.y)).toBeLessThan(24);
    const box = footprintAabb('cathedral', origin.x, origin.y);
    expect(last.y).toBeGreaterThanOrEqual(box.top);
    expect(last.y).toBeLessThanOrEqual(box.bottom);
  });

  it('keeps pew spots inside so guests are not stuck on the lawn', () => {
    for (const side of ['left', 'right'] as const) {
      for (let row = 0; row < 3; row++) {
        const pew = cathedralPewSpot(origin, side, row, `guest-${side}-${row}`);
        expect(pointInsideFootprint('cathedral', origin, pew.x, pew.y)).toBe(
          true
        );
      }
    }
  });
});
