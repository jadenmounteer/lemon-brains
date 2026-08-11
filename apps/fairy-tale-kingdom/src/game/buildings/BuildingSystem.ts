import Phaser from 'phaser';
import { PROP_KEYS } from '../art/assetManifest';
import type { SavedBuilding } from '../../kingdom/LayoutRepository';
import { BEDS_PER_HOUSE, type BuildKind } from '../../marketplace/catalog';
import type { Point } from '../subjects/zones';

export interface BuildingRecord {
  id: string;
  kind: BuildKind;
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Image;
  labelIndex: number;
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
  keep: { w: 48, h: 44 },
};

const TEXTURE: Record<BuildKind, string> = {
  house: PROP_KEYS.house,
  wall: PROP_KEYS.wall,
  tavern: PROP_KEYS.tavern,
};

const WALL_SLOW_RADIUS = 56;

export class BuildingSystem {
  private buildings: BuildingRecord[] = [];
  private nextId = 0;
  private placeKind: BuildKind | null = null;
  private ghost: Phaser.GameObjects.Image | null = null;
  private ghostValid = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly keep: Point,
    private readonly getUnitBodies: () => Aabb[]
  ) {}

  seedStarters(worldW: number, worldH: number): void {
    const cx = worldW / 2;
    const cy = worldH / 2;
    this.addBuilding('house', cx - 64, cy + 8, 'house-0');
    this.addBuilding('house', cx + 72, cy + 16, 'house-1');
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      this.addBuilding('wall', cx + i * 18, cy - 40);
    }
  }

  restore(saved: SavedBuilding[]): void {
    this.clearSpritesOnly();
    this.buildings = [];
    for (const b of saved) {
      this.addBuilding(b.kind, b.x, b.y, b.id);
    }
    this.recomputeHouseLabels();
  }

  serialize(): SavedBuilding[] {
    return this.buildings.map((b) => ({
      id: b.id,
      kind: b.kind,
      x: b.x,
      y: b.y,
    }));
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

  /** Houses ordered by id with free-bed counts via occupant map. */
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

  wallPoints(): Point[] {
    return this.buildings
      .filter((b) => b.kind === 'wall')
      .map((b) => ({ x: b.x, y: b.y }));
  }

  /** Speed multiplier for a raider at (x,y); <1 near walls. */
  raidSpeedMultiplier(x: number, y: number): number {
    for (const w of this.wallPoints()) {
      if (Phaser.Math.Distance.Between(x, y, w.x, w.y) < WALL_SLOW_RADIUS) {
        return 0.6;
      }
    }
    return 1;
  }

  beginPlace(kind: BuildKind): void {
    this.cancelPlace();
    this.placeKind = kind;
    this.ghost = this.scene.add
      .image(this.keep.x, this.keep.y + 80, TEXTURE[kind])
      .setDepth(50)
      .setOrigin(0.5, 0.85)
      .setAlpha(0.65);
  }

  cancelPlace(): void {
    this.placeKind = null;
    this.ghost?.destroy();
    this.ghost = null;
    this.ghostValid = false;
  }

  isPlacing(): boolean {
    return this.placeKind !== null;
  }

  placingKind(): BuildKind | null {
    return this.placeKind;
  }

  updateGhost(worldX: number, worldY: number): void {
    if (!this.ghost || !this.placeKind) return;
    const x = snap(worldX);
    const y = snap(worldY);
    this.ghost.setPosition(x, y);
    this.ghostValid = this.canPlaceAt(this.placeKind, x, y);
    this.ghost.setTint(this.ghostValid ? 0xffffff : 0xff5555);
  }

  tryCommitPlace(): boolean {
    if (!this.placeKind || !this.ghost || !this.ghostValid) return false;
    const kind = this.placeKind;
    const x = this.ghost.x;
    const y = this.ghost.y;
    this.cancelPlace();
    this.addBuilding(kind, x, y);
    this.recomputeHouseLabels();
    return true;
  }

  private addBuilding(
    kind: BuildKind,
    x: number,
    y: number,
    forcedId?: string
  ): BuildingRecord {
    const id = forcedId ?? `${kind}-${this.nextId++}`;
    const match = /^.*?(\d+)$/.exec(id);
    if (match) {
      this.nextId = Math.max(this.nextId, Number(match[1]) + 1);
    }
    const sprite = this.scene.add
      .image(x, y, TEXTURE[kind])
      .setDepth(kind === 'wall' ? 9 : 8)
      .setOrigin(0.5, 0.85);
    const record: BuildingRecord = {
      id,
      kind,
      x,
      y,
      sprite,
      labelIndex: 0,
    };
    this.buildings.push(record);
    this.recomputeHouseLabels();
    return record;
  }

  private recomputeHouseLabels(): void {
    const houses = this.buildings
      .filter((b) => b.kind === 'house')
      .sort((a, b) => a.id.localeCompare(b.id));
    houses.forEach((h, i) => {
      h.labelIndex = i + 1;
    });
  }

  private canPlaceAt(kind: BuildKind, x: number, y: number): boolean {
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

function snap(n: number): number {
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
