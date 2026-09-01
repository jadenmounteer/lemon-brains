import { describe, expect, it } from 'vitest';
import { hasInterior } from '../../combat/stats';
import {
  buildingDoorApproach,
  buildingDoorThreshold,
  buildingDoorWorld,
  interiorWaypoints,
  pointInsideFootprint,
} from '../interiorPathRouter';
import { KEEP_FOOTPRINT } from '../../keep/KeepLayout';

describe('interiorPathRouter', () => {
  const origin = { x: 400, y: 300 };

  it('door approach sits outside house footprint', () => {
    const approach = buildingDoorApproach('house', origin);
    expect(
      pointInsideFootprint('house', origin, approach.x, approach.y)
    ).toBe(false);
  });

  it('door threshold sits inside house footprint', () => {
    const threshold = buildingDoorThreshold('house', origin);
    expect(
      pointInsideFootprint('house', origin, threshold.x, threshold.y)
    ).toBe(true);
  });

  it('keep exterior path includes gate then courtyard rooms', () => {
    const target = { x: origin.x - 16, y: origin.y - 16 };
    const points = interiorWaypoints(
      'keep',
      origin,
      origin.x,
      origin.y + 200,
      target.x,
      target.y,
      'test-subject'
    );
    expect(points.length).toBeGreaterThan(2);
    const door = buildingDoorWorld('keep', origin);
    expect(points[0]!.x).toBeCloseTo(
      buildingDoorThreshold('keep', origin).x,
      0
    );
    expect(points.some((p) => Math.hypot(p.x - door.x, p.y - door.y) < 40)).toBe(
      true
    );
  });

  it('all hasInterior kinds resolve door positions', () => {
    const kinds = [
      'house',
      'manor',
      'tavern',
      'bakery',
      'market',
      'infirmary',
      'cathedral',
      'dungeon',
    ] as const;
    for (const kind of kinds) {
      expect(hasInterior(kind)).toBe(true);
      const door = buildingDoorWorld(kind, origin);
      expect(Number.isFinite(door.x)).toBe(true);
      expect(Number.isFinite(door.y)).toBe(true);
    }
  });

  it('keep footprint constant matches layout', () => {
    expect(KEEP_FOOTPRINT).toEqual({ w: 320, h: 240 });
  });
});
