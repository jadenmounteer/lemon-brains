import Phaser from 'phaser';
import { PROP_KEYS } from '../art/assetManifest';
import type { SavedBuilding } from '../../kingdom/LayoutRepository';
import {
  BEDS_PER_HOUSE,
  BUILD_CATALOG,
  type BuildKind,
} from '../../marketplace/catalog';
import {
  BUILDING_MAX_HP,
  isBlockingKind,
  isBurnable,
} from '../combat/stats';
import type { PathGrid } from '../path/PathGrid';
import type {
  BuildingResident,
  BuildingSnapshot,
} from '../subjects/types';
import type { Point } from '../subjects/zones';
import { KingdomEvents } from '../subjects/events';

export const KEEP_ID = 'keep';

const KEEP_BLURB =
  'Your seat of power. If a rival army reaches it, the kingdom falls.';

export interface BuildingRecord {
  id: string;
  kind: BuildKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  sprite: Phaser.GameObjects.Image;
  labelIndex: number;
  attachedWallId?: string;
  closed?: boolean;
}

export interface Aabb {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const FOOTPRINT: Record<BuildKind | 'keep', { w: number; h: number }> = {
  house: { w: 32, h: 28 },
  wall: { w: 16, h: 30 },
  tavern: { w: 36, h: 30 },
  drawbridge: { w: 32, h: 22 },
  stairs: { w: 20, h: 26 },
  keep: { w: 48, h: 44 },
};

const STAIR_SNAP_DIST = 28;

export class BuildingSystem {
  private buildings: BuildingRecord[] = [];
  private nextId = 0;
  private placeKind: BuildKind | null = null;
  private ghost: Phaser.GameObjects.Image | null = null;
  private ghostValid = false;
  private ghostWallId: string | null = null;
  private raidActive = false;
  private pathGrid: PathGrid | null = null;
  private keepHp: number;
  private keepMaxHp: number;
  private keepSprite: Phaser.GameObjects.Image | null = null;
  private onDestroyed: ((b: BuildingRecord) => void) | null = null;
  private selectedId: string | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly keep: Point,
    private readonly getUnitBodies: () => Aabb[],
    private readonly onLayoutChanged?: () => void
  ) {
    this.keepMaxHp = BUILDING_MAX_HP.keep;
    this.keepHp = this.keepMaxHp;
  }

  setOnDestroyed(cb: (b: BuildingRecord) => void): void {
    this.onDestroyed = cb;
  }

  setPathGrid(grid: PathGrid): void {
    this.pathGrid = grid;
    this.rebuildPathGrid();
  }

  setKeepSprite(sprite: Phaser.GameObjects.Image): void {
    this.keepSprite = sprite;
    this.makeInteractive(sprite, KEEP_ID);
  }

  getSelectedId(): string | null {
    return this.selectedId;
  }

  select(
    id: string | null,
    residents: BuildingResident[] = []
  ): BuildingSnapshot | null {
    this.selectedId = id;
    this.applySelectionVisuals();
    if (!id) return null;
    return this.toSnapshot(id, residents);
  }

  refreshSelectedSnapshot(
    residents: BuildingResident[] = []
  ): BuildingSnapshot | null {
    if (!this.selectedId) return null;
    if (this.selectedId !== KEEP_ID && !this.getById(this.selectedId)) {
      this.selectedId = null;
      this.applySelectionVisuals();
      return null;
    }
    return this.toSnapshot(this.selectedId, residents);
  }

  seedStarters(worldW: number, worldH: number): void {
    const cx = worldW / 2;
    const cy = worldH / 2;
    this.addBuilding('house', cx - 64, cy + 8, 'house-0');
    this.addBuilding('house', cx + 72, cy + 16, 'house-1');
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      this.addBuilding('wall', cx + i * 18, cy - 40);
    }
    this.rebuildPathGrid();
  }

  restore(
    saved: SavedBuilding[],
    keepHp?: number,
    keepMaxHp?: number
  ): void {
    this.clearSpritesOnly();
    this.buildings = [];
    if (typeof keepMaxHp === 'number') this.keepMaxHp = keepMaxHp;
    if (typeof keepHp === 'number') this.keepHp = keepHp;
    else this.keepHp = this.keepMaxHp;

    for (const b of saved) {
      this.addBuilding(b.kind, b.x, b.y, b.id, {
        hp: b.hp,
        maxHp: b.maxHp,
        attachedWallId: b.attachedWallId,
      });
    }
    this.recomputeHouseLabels();
    this.applyDrawbridgeState();
    this.rebuildPathGrid();
  }

  serialize(): SavedBuilding[] {
    return this.buildings.map((b) => ({
      id: b.id,
      kind: b.kind,
      x: b.x,
      y: b.y,
      hp: b.hp,
      maxHp: b.maxHp,
      attachedWallId: b.attachedWallId,
    }));
  }

  serializeKeep(): { keepHp: number; keepMaxHp: number } {
    return { keepHp: this.keepHp, keepMaxHp: this.keepMaxHp };
  }

  houseCount(): number {
    return this.buildings.filter((b) => b.kind === 'house').length;
  }

  wallCount(): number {
    return this.buildings.filter((b) => b.kind === 'wall').length;
  }

  tavernCount(): number {
    return this.buildings.filter((b) => b.kind === 'tavern').length;
  }

  bedCapacity(): number {
    return this.houseCount() * BEDS_PER_HOUSE;
  }

  hasTavern(): boolean {
    return this.tavernCount() > 0;
  }

  getHousePoint(houseId: string): Point | null {
    const house = this.buildings.find(
      (b) => b.kind === 'house' && b.id === houseId
    );
    return house ? { x: house.x, y: house.y } : null;
  }

  houseLabel(houseId: string): string {
    const house = this.buildings.find(
      (b) => b.kind === 'house' && b.id === houseId
    );
    if (!house) return 'Unknown house';
    return `House ${house.labelIndex}`;
  }

  pickHouseForHire(occupantCounts: Map<string, number>): string | null {
    const houses = this.buildings
      .filter((b) => b.kind === 'house')
      .sort((a, b) => a.id.localeCompare(b.id));
    let best: BuildingRecord | null = null;
    let bestFree = -1;
    for (const h of houses) {
      const used = occupantCounts.get(h.id) ?? 0;
      const free = BEDS_PER_HOUSE - used;
      if (free > bestFree) {
        bestFree = free;
        best = h;
      }
    }
    return best && bestFree > 0 ? best.id : null;
  }

  list(): BuildingRecord[] {
    return this.buildings;
  }

  getById(id: string): BuildingRecord | undefined {
    return this.buildings.find((b) => b.id === id);
  }

  /** World-space pick using footprints (reliable with display origins). */
  pickAt(worldX: number, worldY: number): string | null {
    let bestId: string | null = null;
    let bestBottom = -Infinity;

    const keepBox = footprintAabb('keep', this.keep.x, this.keep.y);
    if (pointInAabb(keepBox, worldX, worldY)) {
      bestId = KEEP_ID;
      bestBottom = keepBox.bottom;
    }

    for (const b of this.buildings) {
      const box = footprintAabb(b.kind, b.x, b.y);
      if (!pointInAabb(box, worldX, worldY)) continue;
      if (box.bottom >= bestBottom) {
        bestId = b.id;
        bestBottom = box.bottom;
      }
    }
    return bestId;
  }

  wallPoints(): Point[] {
    return this.buildings
      .filter((b) => b.kind === 'wall')
      .map((b) => ({ x: b.x, y: b.y }));
  }

  stairsNear(x: number, y: number, radius: number): BuildingRecord | null {
    let best: BuildingRecord | null = null;
    let bestD = radius;
    for (const b of this.buildings) {
      if (b.kind !== 'stairs') continue;
      const d = Phaser.Math.Distance.Between(x, y, b.x, b.y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  wallForStairs(stairs: BuildingRecord): BuildingRecord | null {
    if (!stairs.attachedWallId) return null;
    return this.getById(stairs.attachedWallId) ?? null;
  }

  burnablesNear(x: number, y: number, radius: number): BuildingRecord | null {
    let best: BuildingRecord | null = null;
    let bestD = radius;
    for (const b of this.buildings) {
      if (!isBurnable(b.kind)) continue;
      const d = Phaser.Math.Distance.Between(x, y, b.x, b.y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  /** Closest blocking building on a short segment toward the keep. */
  findBlockingAhead(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number
  ): BuildingRecord | null {
    const steps = 8;
    let best: BuildingRecord | null = null;
    let bestD = Infinity;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = fromX + (toX - fromX) * t;
      const y = fromY + (toY - fromY) * t;
      for (const b of this.buildings) {
        if (!isBlockingKind(b.kind, Boolean(b.closed))) continue;
        const box = footprintAabb(b.kind, b.x, b.y);
        if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) {
          const d = Phaser.Math.Distance.Between(fromX, fromY, b.x, b.y);
          if (d < bestD) {
            bestD = d;
            best = b;
          }
        }
      }
    }
    return best;
  }

  setRaidActive(active: boolean): void {
    if (this.raidActive === active) return;
    this.raidActive = active;
    this.applyDrawbridgeState();
    this.rebuildPathGrid();
  }

  isRaidActive(): boolean {
    return this.raidActive;
  }

  rebuildPathGrid(): void {
    if (!this.pathGrid) return;
    this.pathGrid.clear();
    for (const b of this.buildings) {
      if (isBlockingKind(b.kind, Boolean(b.closed))) {
        this.pathGrid.markAabbBlocked(footprintAabb(b.kind, b.x, b.y));
      }
    }
  }

  beginPlace(kind: BuildKind): void {
    this.cancelPlace();
    this.placeKind = kind;
    const tex = textureFor(kind, false);
    this.ghost = this.scene.add
      .image(this.keep.x, this.keep.y + 80, tex)
      .setDepth(50)
      .setOrigin(0.5, 0.85)
      .setAlpha(0.65);
  }

  cancelPlace(): void {
    this.placeKind = null;
    this.ghost?.destroy();
    this.ghost = null;
    this.ghostValid = false;
    this.ghostWallId = null;
  }

  isPlacing(): boolean {
    return this.placeKind !== null;
  }

  placingKind(): BuildKind | null {
    return this.placeKind;
  }

  updateGhost(worldX: number, worldY: number): void {
    if (!this.ghost || !this.placeKind) return;

    if (this.placeKind === 'stairs') {
      const snap = this.findWallSnap(worldX, worldY);
      if (snap) {
        this.ghost.setPosition(snap.x, snap.y);
        this.ghostWallId = snap.wallId;
        this.ghostValid = this.canPlaceAt('stairs', snap.x, snap.y, snap.wallId);
      } else {
        this.ghost.setPosition(snapCoord(worldX), snapCoord(worldY));
        this.ghostWallId = null;
        this.ghostValid = false;
      }
    } else {
      const x = snapCoord(worldX);
      const y = snapCoord(worldY);
      this.ghost.setPosition(x, y);
      this.ghostWallId = null;
      this.ghostValid = this.canPlaceAt(this.placeKind, x, y);
    }
    this.ghost.setTint(this.ghostValid ? 0xffffff : 0xff5555);
  }

  tryCommitPlace(): boolean {
    if (!this.placeKind || !this.ghost || !this.ghostValid) return false;
    const kind = this.placeKind;
    const x = this.ghost.x;
    const y = this.ghost.y;
    const wallId = this.ghostWallId ?? undefined;
    this.cancelPlace();
    this.addBuilding(kind, x, y, undefined, { attachedWallId: wallId });
    this.recomputeHouseLabels();
    this.applyDrawbridgeState();
    this.rebuildPathGrid();
    this.onLayoutChanged?.();
    return true;
  }

  damageBuilding(id: string, amount: number): boolean {
    const b = this.getById(id);
    if (!b) return false;
    b.hp = Math.max(0, b.hp - amount);
    this.tintByHp(b);
    if (b.hp <= 0) {
      this.destroyBuilding(b);
      return true;
    }
    return false;
  }

  damageKeep(amount: number): boolean {
    this.keepHp = Math.max(0, this.keepHp - amount);
    if (this.keepSprite) {
      const ratio = this.keepHp / this.keepMaxHp;
      this.keepSprite.setTint(ratio < 0.35 ? 0xff6666 : 0xffffff);
    }
    return this.keepHp <= 0;
  }

  getKeepHp(): number {
    return this.keepHp;
  }

  private destroyBuilding(b: BuildingRecord): void {
    const burned = isBurnable(b.kind);
    if (b.kind === 'wall') {
      const stairs = this.buildings.filter(
        (s) => s.kind === 'stairs' && s.attachedWallId === b.id
      );
      for (const s of stairs) {
        this.onDestroyed?.(s);
        this.removeRecord(s);
      }
    }
    this.onDestroyed?.(b);
    this.removeRecord(b);
    this.rebuildPathGrid();
    if (burned) {
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message:
          b.kind === 'house'
            ? 'A house burned down!'
            : b.kind === 'tavern'
              ? 'The tavern burned!'
              : 'Stairs collapsed!',
      });
    }
    this.onLayoutChanged?.();
  }

  private removeRecord(b: BuildingRecord): void {
    if (this.selectedId === b.id) {
      this.selectedId = null;
    }
    b.sprite.destroy();
    this.buildings = this.buildings.filter((x) => x.id !== b.id);
    this.recomputeHouseLabels();
  }

  private toSnapshot(
    id: string,
    residents: BuildingResident[]
  ): BuildingSnapshot | null {
    if (id === KEEP_ID) {
      return {
        id: KEEP_ID,
        kind: 'keep',
        name: 'The Keep',
        blurb: KEEP_BLURB,
        hp: this.keepHp,
        maxHp: this.keepMaxHp,
      };
    }
    const b = this.getById(id);
    if (!b) return null;
    const catalog = BUILD_CATALOG.find((c) => c.kind === b.kind);
    const name =
      b.kind === 'house' ? `House ${b.labelIndex}` : (catalog?.name ?? b.kind);
    const snap: BuildingSnapshot = {
      id: b.id,
      kind: b.kind,
      name,
      blurb: catalog?.blurb ?? '',
      hp: b.hp,
      maxHp: b.maxHp,
    };
    if (b.kind === 'drawbridge') {
      snap.statusLabel = b.closed ? 'Closed (raid)' : 'Open';
    }
    if (b.kind === 'stairs' && b.attachedWallId) {
      snap.statusLabel = 'Attached to a wall';
    }
    if (b.kind === 'house') {
      snap.bedsCapacity = BEDS_PER_HOUSE;
      snap.bedsUsed = residents.length;
      snap.residents = residents;
    }
    return snap;
  }

  private makeInteractive(
    sprite: Phaser.GameObjects.Image,
    id: string
  ): void {
    // Hit tests use texture top-left as (0,0), not the display origin.
    sprite.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, sprite.width, sprite.height),
      Phaser.Geom.Rectangle.Contains
    );
    sprite.input!.cursor = 'pointer';
    sprite.setData('buildingId', id);
  }

  private applySelectionVisuals(): void {
    if (this.keepSprite) {
      if (this.selectedId === KEEP_ID) {
        this.keepSprite.setTint(0xfff0c0);
      } else {
        const ratio = this.keepHp / this.keepMaxHp;
        this.keepSprite.setTint(ratio < 0.35 ? 0xff6666 : 0xffffff);
        if (ratio >= 0.35) this.keepSprite.clearTint();
      }
    }
    for (const b of this.buildings) {
      if (b.id === this.selectedId) {
        b.sprite.setTint(0xfff0c0);
      } else {
        this.tintByHp(b);
      }
    }
  }

  private applyDrawbridgeState(): void {
    for (const b of this.buildings) {
      if (b.kind !== 'drawbridge') continue;
      b.closed = this.raidActive;
      b.sprite.setTexture(
        b.closed ? PROP_KEYS.drawbridgeClosed : PROP_KEYS.drawbridge
      );
    }
  }

  private addBuilding(
    kind: BuildKind,
    x: number,
    y: number,
    forcedId?: string,
    opts?: { hp?: number; maxHp?: number; attachedWallId?: string }
  ): BuildingRecord {
    const id = forcedId ?? `${kind}-${this.nextId++}`;
    const match = /^.*?(\d+)$/.exec(id);
    if (match) {
      this.nextId = Math.max(this.nextId, Number(match[1]) + 1);
    }
    const maxHp = opts?.maxHp ?? BUILDING_MAX_HP[kind];
    const hp = opts?.hp ?? maxHp;
    const closed = kind === 'drawbridge' ? this.raidActive : undefined;
    const sprite = this.scene.add
      .image(x, y, textureFor(kind, Boolean(closed)))
      .setDepth(kind === 'wall' || kind === 'stairs' ? 9 : 8)
      .setOrigin(0.5, 0.85);
    this.makeInteractive(sprite, id);
    const record: BuildingRecord = {
      id,
      kind,
      x,
      y,
      hp,
      maxHp,
      sprite,
      labelIndex: 0,
      attachedWallId: opts?.attachedWallId,
      closed,
    };
    this.buildings.push(record);
    this.tintByHp(record);
    this.recomputeHouseLabels();
    return record;
  }

  private tintByHp(b: BuildingRecord): void {
    if (this.selectedId === b.id) return;
    const ratio = b.hp / b.maxHp;
    if (ratio <= 0.35) b.sprite.setTint(0xff6666);
    else if (ratio <= 0.65) b.sprite.setTint(0xffcc88);
    else b.sprite.clearTint();
  }

  private recomputeHouseLabels(): void {
    const houses = this.buildings
      .filter((b) => b.kind === 'house')
      .sort((a, b) => a.id.localeCompare(b.id));
    houses.forEach((h, i) => {
      h.labelIndex = i + 1;
    });
  }

  private findWallSnap(
    worldX: number,
    worldY: number
  ): { x: number; y: number; wallId: string } | null {
    let best: BuildingRecord | null = null;
    let bestD = STAIR_SNAP_DIST;
    for (const w of this.buildings) {
      if (w.kind !== 'wall') continue;
      const d = Phaser.Math.Distance.Between(worldX, worldY, w.x, w.y);
      if (d < bestD) {
        bestD = d;
        best = w;
      }
    }
    if (!best) return null;
    return {
      x: snapCoord(best.x + 14),
      y: snapCoord(best.y + 4),
      wallId: best.id,
    };
  }

  private canPlaceAt(
    kind: BuildKind,
    x: number,
    y: number,
    wallId?: string | null
  ): boolean {
    if (kind === 'stairs' && !wallId) return false;
    const candidate = footprintAabb(kind, x, y);
    const keepBox = footprintAabb('keep', this.keep.x, this.keep.y);
    if (intersects(candidate, keepBox)) return false;
    for (const b of this.buildings) {
      if (intersects(candidate, footprintAabb(b.kind, b.x, b.y))) return false;
    }
    for (const unit of this.getUnitBodies()) {
      if (intersects(candidate, unit)) return false;
    }
    return true;
  }

  private clearSpritesOnly(): void {
    for (const b of this.buildings) {
      b.sprite.destroy();
    }
    this.cancelPlace();
  }
}

function textureFor(kind: BuildKind, closed: boolean): string {
  switch (kind) {
    case 'house':
      return PROP_KEYS.house;
    case 'wall':
      return PROP_KEYS.wall;
    case 'tavern':
      return PROP_KEYS.tavern;
    case 'drawbridge':
      return closed ? PROP_KEYS.drawbridgeClosed : PROP_KEYS.drawbridge;
    case 'stairs':
      return PROP_KEYS.stairs;
  }
}

function snapCoord(n: number): number {
  return Math.round(n / 8) * 8;
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

function intersects(a: Aabb, b: Aabb): boolean {
  return !(
    a.right <= b.left ||
    a.left >= b.right ||
    a.bottom <= b.top ||
    a.top >= b.bottom
  );
}

function pointInAabb(box: Aabb, x: number, y: number): boolean {
  return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
}
