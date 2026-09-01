import { describe, expect, it } from 'vitest';
import { PROP_KEYS } from '../../art/assetManifest';
import { hasInterior } from '../../combat/stats';
import type { BuildKind } from '../../../marketplace/catalog';
import { bakeryAnchorBounds } from '../layouts/BakeryLayout';
import { cathedralAnchorBounds } from '../layouts/CathedralLayout';
import { dungeonAnchorBounds } from '../layouts/DungeonLayout';
import { marketAnchorBounds } from '../layouts/MarketLayout';
import { keepAnchorBounds } from '../../keep/KeepLayout';

const INTERIOR_KINDS: BuildKind[] = [
  'house',
  'manor',
  'tavern',
  'cathedral',
  'infirmary',
  'dungeon',
  'bakery',
  'market',
];

const INTERIOR_KEYS: Partial<Record<BuildKind | 'keep', string>> = {
  house: PROP_KEYS.houseInterior,
  manor: PROP_KEYS.houseInterior,
  tavern: PROP_KEYS.tavernInterior,
  cathedral: PROP_KEYS.cathedralInterior,
  infirmary: PROP_KEYS.infirmaryInterior,
  dungeon: PROP_KEYS.dungeonInterior,
  bakery: PROP_KEYS.bakeryInterior,
  market: PROP_KEYS.marketInterior,
  keep: PROP_KEYS.keepInterior,
};

describe('Phase 13 civic interiors', () => {
  it('hasInterior matches texture keys for civic buildings', () => {
    for (const kind of INTERIOR_KINDS) {
      expect(hasInterior(kind)).toBe(true);
      expect(INTERIOR_KEYS[kind]).toBeTruthy();
    }
    expect(hasInterior('dungeon')).toBe(true);
    expect(INTERIOR_KEYS.dungeon).toBe(PROP_KEYS.dungeonInterior);
  });

  it('layout anchors stay inside building footprints', () => {
    const dungeon = dungeonAnchorBounds();
    expect(Math.abs(dungeon.minX)).toBeLessThan(100);
    expect(Math.abs(dungeon.maxX)).toBeLessThan(100);
    expect(Math.abs(dungeon.minY)).toBeLessThan(80);
    expect(Math.abs(dungeon.maxY)).toBeLessThan(80);

    const bakery = bakeryAnchorBounds();
    expect(Math.abs(bakery.maxX)).toBeLessThan(22);

    const market = marketAnchorBounds();
    expect(Math.abs(market.maxX)).toBeLessThan(22);

    const cathedral = cathedralAnchorBounds();
    expect(Math.abs(cathedral.maxX)).toBeLessThan(120);

    const keep = keepAnchorBounds();
    expect(Math.abs(keep.maxX)).toBeLessThan(160);
    expect(Math.abs(keep.maxY)).toBeLessThan(120);
  });
});
