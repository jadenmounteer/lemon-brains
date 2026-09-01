import { describe, expect, it } from 'vitest';
import { footprintAabb, intersects } from '../buildingShared';

describe('building relocate validation', () => {
  it('same footprint intersects unless the building is ignored', () => {
    const current = footprintAabb('house', 200, 300);
    const candidate = footprintAabb('house', 200, 300);
    expect(intersects(current, candidate)).toBe(true);

    const buildingId = 'house-0';
    const buildings = [
      { id: 'house-0', kind: 'house' as const, x: 200, y: 300 },
      { id: 'house-1', kind: 'house' as const, x: 400, y: 300 },
    ];
    const ignoreBuildingId = buildingId;
    let blocked = false;
    for (const b of buildings) {
      if (ignoreBuildingId && b.id === ignoreBuildingId) continue;
      const box = footprintAabb(b.kind, b.x, b.y);
      if (intersects(candidate, box)) {
        blocked = true;
        break;
      }
    }
    expect(blocked).toBe(false);
  });

  it('relocate candidate blocked by a different building', () => {
    const candidate = footprintAabb('house', 200, 300);
    const buildings = [
      { id: 'house-0', kind: 'house' as const, x: 200, y: 300 },
      { id: 'house-1', kind: 'house' as const, x: 205, y: 300 },
    ];
    const ignoreBuildingId = 'house-0';
    let blocked = false;
    for (const b of buildings) {
      if (ignoreBuildingId && b.id === ignoreBuildingId) continue;
      const box = footprintAabb(b.kind, b.x, b.y);
      if (intersects(candidate, box)) {
        blocked = true;
        break;
      }
    }
    expect(blocked).toBe(true);
  });
});
