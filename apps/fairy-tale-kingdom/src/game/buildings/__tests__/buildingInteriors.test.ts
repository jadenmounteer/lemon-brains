import { describe, expect, it } from 'vitest';
import { PROP_KEYS } from '../../art/assetManifest';
import { hasInterior } from '../../combat/stats';
import type { BuildKind } from '../../../marketplace/catalog';
import { bakeryAnchorBounds } from '../layouts/BakeryLayout';
import { cathedralAnchorBounds } from '../layouts/CathedralLayout';
import { dungeonAnchorBounds } from '../layouts/DungeonLayout';
import { marketAnchorBounds } from '../layouts/MarketLayout';
import { keepAnchorBounds } from '../../keep/KeepLayout';
import { getInteriorNavSpec } from '../layouts/InteriorLayoutRegistry';

const INTERIOR_KINDS: BuildKind[] = [
  'house',
  'manor',
  'tavern',
  'cathedral',
  'infirmary',
  'dungeon',
  'bakery',
  'market',
  'granary',
  'barracks',
  'watchtower',
  'dock',
  'cemetery',
  'gallows',
];

const INTERIOR_KEYS: Partial<Record<BuildKind | 'keep', string>> = {
  house: PROP_KEYS.houseInterior,
  manor: PROP_KEYS.manorInterior,
  tavern: PROP_KEYS.tavernInterior,
  cathedral: PROP_KEYS.cathedralInterior,
  infirmary: PROP_KEYS.infirmaryInterior,
  dungeon: PROP_KEYS.dungeonInterior,
  bakery: PROP_KEYS.bakeryInterior,
  market: PROP_KEYS.marketInterior,
  granary: PROP_KEYS.granaryInterior,
  barracks: PROP_KEYS.barracksInterior,
  watchtower: PROP_KEYS.watchtowerInterior,
  dock: PROP_KEYS.dockInterior,
  cemetery: PROP_KEYS.cemeteryInterior,
  gallows: PROP_KEYS.gallowsInterior,
  keep: PROP_KEYS.keepInterior,
};

describe('building interiors', () => {
  it('hasInterior matches texture keys for all interior buildings', () => {
    for (const kind of INTERIOR_KINDS) {
      expect(hasInterior(kind)).toBe(true);
      expect(INTERIOR_KEYS[kind]).toBeTruthy();
      expect(getInteriorNavSpec(kind)).not.toBeNull();
    }
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
