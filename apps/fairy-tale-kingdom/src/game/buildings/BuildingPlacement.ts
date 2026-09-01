import type Phaser from 'phaser';
import { PROP_KEYS } from '../art/assetManifest';
import { bakeWallTexture } from '../art/wallArt';
import type { BuildKind } from '../../marketplace/catalog';
import type { Point } from '../subjects/zones';
import {
  fortSnap,
  fortIndex,
  snapCoord,
  textureFor,
  WALL_MAX_DRAG_CELLS,
  type BuildingRecord,
  type WallFace,
} from './buildingShared';

/** Host callbacks for placement commit and validation. */
export interface BuildingPlacementHost {
  scene: Phaser.Scene;
  keep: Point;
  getUnitBodies(): { left: number; right: number; top: number; bottom: number }[];
  canPlaceAt(
    kind: BuildKind,
    x: number,
    y: number,
    wallId?: string | null,
    rotation?: 0 | 90,
    replaceWallId?: string | null,
    ignoreBuildingId?: string | null
  ): boolean;
  findLadderSnap(
    worldX: number,
    worldY: number
  ): { x: number; y: number; wallId: string; facing: WallFace } | null;
  findGateSnap(
    worldX: number,
    worldY: number
  ): { x: number; y: number; replaceWallId?: string } | null;
  fortLineCells(x0: number, y0: number, x1: number, y1: number): Point[];
  previewWallMask(x: number, y: number): number;
  addBuilding(
    kind: BuildKind,
    x: number,
    y: number,
    forcedId?: string,
    opts?: {
      hp?: number;
      maxHp?: number;
      attachedWallId?: string;
      ladderFacing?: WallFace;
      rotation?: number;
      loyaltyKeepId?: string | null;
    }
  ): BuildingRecord;
  replaceWallWithGate(wallId: string): void;
  commitRelocate(
    buildingId: string,
    x: number,
    y: number,
    rotation?: 0 | 90
  ): boolean;
  afterPlacementCommit(): void;
}

export interface WallCommitResult {
  committed: boolean;
  wallCells: number;
  relocated?: boolean;
}

/**
 * Ghost preview + commit for marketplace placement and building relocation.
 * Validation and sprite creation stay on the host (BuildingSystem facade).
 */
export class BuildingPlacement {
  private placeKind: BuildKind | null = null;
  private placeRotation: 0 | 90 = 0;
  private ghost: Phaser.GameObjects.Image | null = null;
  private wallGhostExtras: Phaser.GameObjects.Image[] = [];
  private ghostValid = false;
  private ghostWallId: string | null = null;
  private ghostLadderFacing: WallFace | null = null;
  private ghostReplaceWallId: string | null = null;
  private wallRunPreview: Point[] = [];
  private wallDragStart: Point | null = null;
  private wallDragging = false;
  private maxWallCells = WALL_MAX_DRAG_CELLS;
  private lastCommittedWallCells = 0;
  private relocateRecord: BuildingRecord | null = null;

  constructor(private readonly host: BuildingPlacementHost) {}

  private wallPreviewTexture(x: number, y: number): string {
    const mask = this.host.previewWallMask(x, y);
    return bakeWallTexture(this.host.scene, {
      mask,
      col: fortIndex(x),
      row: fortIndex(y),
    });
  }

  isPlacing(): boolean {
    return this.placeKind !== null;
  }

  isRelocating(): boolean {
    return this.relocateRecord !== null;
  }

  placementMode(): 'place' | 'relocate' | null {
    if (!this.placeKind) return null;
    return this.relocateRecord ? 'relocate' : 'place';
  }

  relocatingBuildingId(): string | null {
    return this.relocateRecord?.id ?? null;
  }

  placingKind(): BuildKind | null {
    return this.placeKind;
  }

  getPlaceRotation(): 0 | 90 {
    return this.placeRotation;
  }

  isWallDragging(): boolean {
    return this.wallDragging;
  }

  lastWallCellsPlaced(): number {
    return this.lastCommittedWallCells;
  }

  setMaxWallCells(n: number): void {
    this.maxWallCells = Math.max(1, Math.min(WALL_MAX_DRAG_CELLS, n));
  }

  beginPlace(kind: BuildKind, maxWallCells?: number): void {
    this.cancelPlace();
    this.placeKind = kind;
    this.placeRotation = 0;
    if (kind === 'wall' && maxWallCells != null) {
      this.setMaxWallCells(maxWallCells);
    }
    const tex = textureFor(kind, false, 0);
    this.ghost = this.host.scene.add
      .image(this.host.keep.x, this.host.keep.y + 80, tex)
      .setDepth(50)
      .setOrigin(
        0.5,
        kind === 'wall' || kind === 'drawbridge'
          ? 0.75
          : kind === 'ladder'
            ? 0.85
            : 0.85
      )
      .setAlpha(0.65);
  }

  beginRelocate(record: BuildingRecord): void {
    this.cancelPlace();
    this.placeKind = record.kind;
    this.relocateRecord = record;
    this.placeRotation = (record.rotation as 0 | 90) ?? 0;
    record.sprite.setAlpha(0.3);
    record.interiorSprite?.setAlpha(0.3);
    const tex =
      record.kind === 'bridge' && this.placeRotation === 90
        ? PROP_KEYS.bridgeV
        : textureFor(record.kind, Boolean(record.closed), 0);
    this.ghost = this.host.scene.add
      .image(record.x, record.y, tex)
      .setDepth(50)
      .setOrigin(
        0.5,
        record.kind === 'wall' || record.kind === 'drawbridge' ? 0.75 : 0.85
      )
      .setAlpha(0.65);
  }

  cancelPlace(): void {
    if (this.relocateRecord) {
      this.relocateRecord.sprite.setAlpha(1);
      this.relocateRecord.interiorSprite?.setAlpha(1);
    }
    this.placeKind = null;
    this.placeRotation = 0;
    this.relocateRecord = null;
    this.ghost?.destroy();
    this.ghost = null;
    this.clearWallGhostExtras();
    this.wallRunPreview = [];
    this.wallDragStart = null;
    this.wallDragging = false;
    this.ghostValid = false;
    this.ghostWallId = null;
    this.ghostReplaceWallId = null;
    this.lastCommittedWallCells = 0;
    this.maxWallCells = WALL_MAX_DRAG_CELLS;
  }

  rotatePlacement(): void {
    if (this.placeKind !== 'bridge' || !this.ghost) return;
    this.placeRotation = this.placeRotation === 0 ? 90 : 0;
    this.ghost.setTexture(
      this.placeRotation === 90 ? PROP_KEYS.bridgeV : PROP_KEYS.bridge
    );
  }

  /** Pointer down while placing a wall — start a drag stroke. */
  beginWallDrag(worldX: number, worldY: number): void {
    if (this.placeKind !== 'wall' || this.relocateRecord) return;
    this.wallDragging = true;
    this.wallDragStart = {
      x: fortSnap(worldX),
      y: fortSnap(worldY),
    };
    this.updateGhost(worldX, worldY);
  }

  updateGhost(worldX: number, worldY: number): void {
    if (!this.ghost || !this.placeKind) return;
    this.ghostReplaceWallId = null;
    const kind = this.placeKind;
    const ignoreId = this.relocateRecord?.id ?? null;

    if (kind === 'ladder') {
      const snap = this.host.findLadderSnap(worldX, worldY);
      if (snap) {
        this.ghost.setPosition(snap.x, snap.y);
        this.ghost.setTexture(textureFor('ladder', false, 0));
        this.ghostWallId = snap.wallId;
        this.ghostLadderFacing = snap.facing;
        this.ghostValid = this.host.canPlaceAt(
          'ladder',
          snap.x,
          snap.y,
          snap.wallId,
          0,
          null,
          ignoreId
        );
      } else {
        this.ghost.setPosition(fortSnap(worldX), fortSnap(worldY));
        this.ghostWallId = null;
        this.ghostLadderFacing = null;
        this.ghostValid = false;
      }
    } else if (kind === 'drawbridge') {
      const snap = this.host.findGateSnap(worldX, worldY);
      if (snap) {
        this.ghost.setPosition(snap.x, snap.y);
        this.ghostWallId = null;
        this.ghostReplaceWallId = snap.replaceWallId ?? null;
        this.ghostValid = this.host.canPlaceAt(
          'drawbridge',
          snap.x,
          snap.y,
          null,
          0,
          snap.replaceWallId,
          ignoreId
        );
      } else {
        this.ghost.setPosition(fortSnap(worldX), fortSnap(worldY));
        this.ghostValid = false;
      }
    } else if (kind === 'wall') {
      const endX = fortSnap(worldX);
      const endY = fortSnap(worldY);
      const start = this.wallDragStart ?? { x: endX, y: endY };
      const line = this.host.fortLineCells(start.x, start.y, endX, endY);
      const capped = line.slice(0, this.maxWallCells);
      const valid = capped.filter((cell) =>
        this.host.canPlaceAt('wall', cell.x, cell.y, null, 0, null, ignoreId)
      );
      this.wallRunPreview = valid;
      this.ghostValid = valid.length > 0;
      this.clearWallGhostExtras();
      if (valid.length > 0) {
        const first = valid[0]!;
        this.ghost.setPosition(first.x, first.y);
        this.ghost.setTexture(this.wallPreviewTexture(first.x, first.y));
        this.ghost.setVisible(true);
        for (let i = 1; i < valid.length; i++) {
          const cell = valid[i]!;
          const extra = this.host.scene.add
            .image(
              cell.x,
              cell.y,
              this.wallPreviewTexture(cell.x, cell.y)
            )
            .setDepth(50)
            .setOrigin(0.5, 0.75)
            .setAlpha(0.55)
            .setTint(this.ghostValid ? 0xffffff : 0xff5555);
          this.wallGhostExtras.push(extra);
        }
      } else {
        this.ghost.setPosition(endX, endY);
        this.ghost.setTexture(this.wallPreviewTexture(endX, endY));
      }
    } else {
      const x = kind === 'road' || kind === 'dock' || kind === 'bridge'
        ? fortSnap(worldX)
        : snapCoord(worldX);
      const y = kind === 'road' || kind === 'dock' || kind === 'bridge'
        ? fortSnap(worldY)
        : snapCoord(worldY);
      this.ghost.setPosition(x, y);
      this.ghostWallId = null;
      this.ghostValid = this.host.canPlaceAt(
        kind,
        x,
        y,
        null,
        this.placeRotation,
        null,
        ignoreId
      );
    }
    this.ghost.setTint(this.ghostValid ? 0xffffff : 0xff5555);
  }

  tryCommitPlace(): boolean {
    const result = this.tryCommitPlaceDetailed();
    return result.committed;
  }

  tryCommitPlaceDetailed(): WallCommitResult {
    if (!this.placeKind || !this.ghost || !this.ghostValid) {
      return { committed: false, wallCells: 0 };
    }
    const kind = this.placeKind;
    const x = this.ghost.x;
    const y = this.ghost.y;
    const wallId = this.ghostWallId ?? undefined;
    const replaceWallId = this.ghostReplaceWallId;
    const rotation = kind === 'bridge' ? this.placeRotation : undefined;
    const relocateId = this.relocateRecord?.id;

    if (relocateId) {
      const moved = this.host.commitRelocate(relocateId, x, y, rotation);
      if (!moved) {
        return { committed: false, wallCells: 0 };
      }
      this.host.afterPlacementCommit();
      this.cancelPlace();
      return { committed: true, wallCells: 0, relocated: true };
    }

    const wallRun =
      kind === 'wall' && this.wallRunPreview.length > 0
        ? [...this.wallRunPreview]
        : null;
    let placed = 0;
    if (wallRun) {
      for (const cell of wallRun) {
        if (this.host.canPlaceAt('wall', cell.x, cell.y)) {
          this.host.addBuilding('wall', cell.x, cell.y);
          placed++;
        }
      }
      if (placed === 0) {
        this.cancelPlace();
        return { committed: false, wallCells: 0 };
      }
    } else {
      if (replaceWallId) {
        this.host.replaceWallWithGate(replaceWallId);
      }
      this.host.addBuilding(kind, x, y, undefined, {
        attachedWallId: wallId,
        ladderFacing:
          kind === 'ladder'
            ? this.ghostLadderFacing ?? undefined
            : undefined,
        rotation,
      });
    }
    this.host.afterPlacementCommit();
    const result: WallCommitResult = { committed: true, wallCells: placed };
    this.lastCommittedWallCells = placed;
    this.cancelPlace();
    this.lastCommittedWallCells = result.wallCells;
    return result;
  }

  private clearWallGhostExtras(): void {
    for (const g of this.wallGhostExtras) g.destroy();
    this.wallGhostExtras = [];
  }
}
