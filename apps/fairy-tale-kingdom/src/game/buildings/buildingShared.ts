import Phaser from 'phaser';
import { PROP_KEYS, TILE_SIZE, wallTextureKey } from '../art/assetManifest';
import type { BuildKind } from '../../marketplace/catalog';
import { isFortKind } from '../combat/stats';
import type { Point } from '../subjects/zones';

export const KEEP_ID = 'keep';
export const FORT_TILE = TILE_SIZE;
/** @deprecated Fixed 3-cell runs — drag placement uses fortLineCells instead. */
export const WALL_PLACE_CELLS = 3;
/** Max fort cells per wall drag stroke. */
export const WALL_MAX_DRAG_CELLS = 64;
/** Gold charged per wall cell on commit. */
export const WALL_GOLD_PER_CELL = 3;

/** Fort grid column/row index from a world coordinate. */
export function fortIndex(n: number): number {
  return Math.round((n - FORT_TILE / 2) / FORT_TILE);
}

/** World center of a fort grid column/row index. */
export function fortCenter(index: number): number {
  return index * FORT_TILE + FORT_TILE / 2;
}

/**
 * Bresenham line on the fort grid between two snapped world points.
 * Returns cell centers along the line, capped at maxCells.
 */
export function fortLineCells(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  maxCells = WALL_MAX_DRAG_CELLS
): Point[] {
  let c0 = fortIndex(x0);
  let r0 = fortIndex(y0);
  const c1 = fortIndex(x1);
  const r1 = fortIndex(y1);

  const dc = Math.abs(c1 - c0);
  const dr = Math.abs(r1 - r0);
  const sc = c0 < c1 ? 1 : -1;
  const sr = r0 < r1 ? 1 : -1;
  let err = dc - dr;

  const cells: Point[] = [];
  for (;;) {
    cells.push({ x: fortCenter(c0), y: fortCenter(r0) });
    if (cells.length >= maxCells) break;
    if (c0 === c1 && r0 === r1) break;
    const e2 = err * 2;
    if (e2 > -dr) {
      err -= dr;
      c0 += sc;
    }
    if (e2 < dc) {
      err += dc;
      r0 += sr;
    }
  }
  return cells;
}

export interface BuildingRecord {
  id: string;
  kind: BuildKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  sprite: Phaser.GameObjects.Image;
  interiorSprite?: Phaser.GameObjects.Image;
  hearthSprite?: Phaser.GameObjects.Sprite;
  labelIndex: number;
  attachedWallId?: string;
  closed?: boolean;
  rotation?: number;
  loyaltyKeepId?: string | null;
}

export interface Aabb {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const FOOTPRINT: Record<BuildKind | 'keep', { w: number; h: number }> = {
  house: { w: 56, h: 48 },
  wall: { w: 16, h: 16 },
  tavern: { w: 48, h: 40 },
  drawbridge: { w: 16, h: 16 },
  stairs: { w: 20, h: 26 },
  field: { w: 40, h: 26 },
  granary: { w: 36, h: 42 },
  barracks: { w: 40, h: 30 },
  manor: { w: 64, h: 52 },
  ballista: { w: 24, h: 18 },
  watchtower: { w: 24, h: 36 },
  cathedral: { w: 64, h: 56 },
  infirmary: { w: 56, h: 44 },
  dungeon: { w: 40, h: 32 },
  bakery: { w: 44, h: 38 },
  market: { w: 44, h: 30 },
  cemetery: { w: 48, h: 34 },
  gallows: { w: 28, h: 38 },
  road: { w: 16, h: 16 },
  bridge: { w: 56, h: 20 },
  dock: { w: 40, h: 28 },
  keep: { w: 160, h: 120 },
};

/** Snap world coord to fortification cell center. */
export function fortSnap(n: number): number {
  return (
    Math.round((n - FORT_TILE / 2) / FORT_TILE) * FORT_TILE + FORT_TILE / 2
  );
}

export function fortKey(x: number, y: number): string {
  return `${fortSnap(x)},${fortSnap(y)}`;
}

export function footprintAabb(
  kind: BuildKind | 'keep',
  x: number,
  y: number
): Aabb {
  const { w, h } = FOOTPRINT[kind];
  return {
    left: x - w / 2,
    right: x + w / 2,
    top: y - h,
    bottom: y,
  };
}

/** Bridge footprint swaps width/height when rotated 90° to span the other axis. */
export function bridgeAabb(x: number, y: number, rotation: 0 | 90): Aabb {
  const { w, h } = FOOTPRINT.bridge;
  const bw = rotation === 90 ? h : w;
  const bh = rotation === 90 ? w : h;
  return {
    left: x - bw / 2,
    right: x + bw / 2,
    top: y - bh,
    bottom: y,
  };
}

export function intersects(a: Aabb, b: Aabb): boolean {
  return !(
    a.right <= b.left ||
    a.left >= b.right ||
    a.bottom <= b.top ||
    a.top >= b.bottom
  );
}

export function pointInAabb(box: Aabb, x: number, y: number): boolean {
  return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
}

export function snapCoord(n: number): number {
  return Math.round(n / 8) * 8;
}

export function textureFor(
  kind: BuildKind,
  closed: boolean,
  wallMask: number
): string {
  switch (kind) {
    case 'house':
      return PROP_KEYS.house;
    case 'wall':
      return wallTextureKey(wallMask);
    case 'tavern':
      return PROP_KEYS.tavern;
    case 'drawbridge':
      return closed ? PROP_KEYS.drawbridgeClosed : PROP_KEYS.drawbridge;
    case 'stairs':
      return PROP_KEYS.stairs;
    case 'field':
      return PROP_KEYS.field;
    case 'granary':
      return PROP_KEYS.granary;
    case 'barracks':
      return PROP_KEYS.barracks;
    case 'manor':
      return PROP_KEYS.manor;
    case 'ballista':
      return PROP_KEYS.ballista;
    case 'watchtower':
      return PROP_KEYS.watchtower;
    case 'cathedral':
      return PROP_KEYS.cathedral;
    case 'infirmary':
      return PROP_KEYS.infirmary;
    case 'dungeon':
      return PROP_KEYS.dungeon;
    case 'bakery':
      return PROP_KEYS.bakery;
    case 'market':
      return PROP_KEYS.market;
    case 'cemetery':
      return PROP_KEYS.cemetery;
    case 'gallows':
      return PROP_KEYS.gallows;
    case 'road':
      return PROP_KEYS.road;
    case 'bridge':
      return PROP_KEYS.bridge;
    case 'dock':
      return PROP_KEYS.dock;
    case 'keep':
      return PROP_KEYS.keep;
  }
}

export function isFortCellKind(kind: BuildKind): boolean {
  return isFortKind(kind);
}
