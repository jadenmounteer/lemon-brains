import { describe, expect, it } from 'vitest';
import type { BuildingRecord } from '../../game/buildings/buildingShared';
import { KEEP_ID } from '../../game/buildings/buildingShared';
import { BuildingQueries } from '../../game/buildings/BuildingQueries';

function mockSprite(): BuildingRecord['sprite'] {
  return {} as BuildingRecord['sprite'];
}

function makeQueries(
  buildings: BuildingRecord[],
  keepHp = 500,
  keep = { x: 400, y: 300 }
): BuildingQueries {
  return new BuildingQueries({
    buildings,
    keepHp,
    keepMaxHp: 500,
    keep,
    getById(id) {
      if (id === KEEP_ID && keepHp > 0) {
        return {
          id: KEEP_ID,
          kind: 'keep',
          x: keep.x,
          y: keep.y,
          hp: keepHp,
          maxHp: 500,
          sprite: mockSprite(),
          labelIndex: 0,
        };
      }
      return buildings.find((b) => b.id === id);
    },
    displayName(b) {
      return b.kind === 'house' ? `House ${b.labelIndex}` : b.kind;
    },
  });
}

describe('BuildingQueries', () => {
  it('counts beds from houses and manors', () => {
    const q = makeQueries([
      {
        id: 'h1',
        kind: 'house',
        x: 0,
        y: 0,
        hp: 30,
        maxHp: 30,
        sprite: mockSprite(),
        labelIndex: 1,
      },
    ]);
    expect(q.bedCapacity()).toBe(3);
    expect(q.houseCount()).toBe(1);
  });

  it('inKeepTerritory uses nearest keep Voronoi cell', () => {
    const q = makeQueries(
      [
        {
          id: 'keep-2',
          kind: 'keep',
          x: 600,
          y: 300,
          hp: 400,
          maxHp: 500,
          sprite: mockSprite(),
          labelIndex: 1,
        },
      ],
      500,
      { x: 200, y: 300 }
    );
    expect(q.inKeepTerritory(KEEP_ID, 250, 300)).toBe(true);
    expect(q.inKeepTerritory('keep-2', 550, 300)).toBe(true);
    expect(q.nearestKeepId(400, 300)).toBeTruthy();
  });

  it('keepForBuilding resolves loyalty', () => {
    const q = makeQueries([
      {
        id: 'house-1',
        kind: 'house',
        x: 220,
        y: 300,
        hp: 30,
        maxHp: 30,
        sprite: mockSprite(),
        labelIndex: 1,
        loyaltyKeepId: KEEP_ID,
      },
    ]);
    expect(q.keepForBuilding('house-1')).toBe(KEEP_ID);
  });

  it('field slots require granary', () => {
    const q = makeQueries([]);
    expect(q.fieldSlots()).toBe(0);
    expect(q.canPlaceField()).toBe(false);
  });
});
