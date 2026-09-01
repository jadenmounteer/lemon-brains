import Phaser from 'phaser';
import { PROP_KEYS, HEARTH_FIRE_ANIM } from '../art/assetManifest';
import type { BuildKind } from '../../marketplace/catalog';
import { hasInterior } from '../combat/stats';
import {
  type Aabb,
  type BuildingRecord,
  footprintAabb,
  intersects,
} from './buildingShared';

function kindHasHearth(kind: BuildKind | 'keep'): boolean {
  return (
    kind === 'house' ||
    kind === 'manor' ||
    kind === 'tavern' ||
    kind === 'keep' ||
    kind === 'infirmary'
  );
}

function interiorTextureFor(kind: BuildKind | 'keep'): string | null {
  switch (kind) {
    case 'house':
    case 'manor':
      return PROP_KEYS.houseInterior;
    case 'tavern':
      return PROP_KEYS.tavernInterior;
    case 'cathedral':
      return PROP_KEYS.cathedralInterior;
    case 'infirmary':
      return PROP_KEYS.infirmaryInterior;
    case 'dungeon':
      return PROP_KEYS.dungeonInterior;
    case 'bakery':
      return PROP_KEYS.bakeryInterior;
    case 'market':
      return PROP_KEYS.marketInterior;
    case 'keep':
      return PROP_KEYS.keepInterior;
    default:
      return null;
  }
}

export interface BuildingInteriorHost {
  scene: Phaser.Scene;
  buildings: BuildingRecord[];
  keepHp: number;
  keep: { x: number; y: number };
  keepSprite: Phaser.GameObjects.Image | null;
  keepInteriorSprite: Phaser.GameObjects.Image | null;
  keepHearth: Phaser.GameObjects.Sprite | null;
}

/** Roof hide / hearth lighting when units occupy building footprints. */
export class BuildingInteriors {
  constructor(private readonly host: BuildingInteriorHost) {}

  spawnHearth(
    x: number,
    y: number,
    kind: BuildKind | 'keep'
  ): Phaser.GameObjects.Sprite | null {
    if (!this.host.scene.textures.exists(PROP_KEYS.hearthFire)) return null;
    const ox =
      kind === 'keep'
        ? 2
        : kind === 'tavern'
          ? 8
          : kind === 'infirmary'
            ? 10
            : 0;
    return this.host.scene.add
      .sprite(x + ox, y + 4, PROP_KEYS.hearthFire, 0)
      .setDepth(8)
      .setOrigin(0.5, 1)
      .setVisible(false);
  }

  createInteriorSprites(
    kind: BuildKind,
    px: number,
    py: number
  ): {
    interiorSprite?: Phaser.GameObjects.Image;
    hearthSprite?: Phaser.GameObjects.Sprite;
  } {
    const intKey = interiorTextureFor(kind);
    if (!intKey || !hasInterior(kind)) return {};
    const interiorSprite = this.host.scene.add
      .image(px, py, intKey)
      .setDepth(7)
      .setOrigin(0.5, 0.85)
      .setVisible(false);
    const hearthSprite = kindHasHearth(kind)
      ? this.spawnHearth(px, py + 6, kind) ?? undefined
      : undefined;
    return { interiorSprite, hearthSprite };
  }

  updateInteriors(unitBodies: Aabb[]): void {
    for (const b of this.host.buildings) {
      if (!b.interiorSprite) continue;
      const box = footprintAabb(b.kind, b.x, b.y);
      const occupied = unitBodies.some((u) => intersects(box, u));
      b.sprite.setVisible(!occupied);
      b.interiorSprite.setVisible(occupied);
      if (b.hearthSprite) {
        b.hearthSprite.setVisible(occupied);
        if (occupied && !b.hearthSprite.anims.isPlaying) {
          b.hearthSprite.play(HEARTH_FIRE_ANIM);
        }
      }
    }
    if (this.host.keepSprite && this.host.keepHp > 0) {
      const keepBox = footprintAabb('keep', this.host.keep.x, this.host.keep.y);
      const occupied = unitBodies.some((u) => intersects(keepBox, u));
      this.host.keepSprite.setVisible(!occupied);
      this.host.keepInteriorSprite?.setVisible(occupied);
      if (this.host.keepHearth) {
        this.host.keepHearth.setVisible(occupied);
        if (occupied && !this.host.keepHearth.anims.isPlaying) {
          this.host.keepHearth.play(HEARTH_FIRE_ANIM);
        }
      }
    }
  }
}
