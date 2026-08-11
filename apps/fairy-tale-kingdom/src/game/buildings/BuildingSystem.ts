import Phaser from 'phaser';
import { PROP_KEYS, TILE_SIZE, wallTextureKey, HEARTH_FIRE_ANIM } from '../art/assetManifest';
import type { SavedBuilding } from '../../kingdom/LayoutRepository';
import {
  BEDS_PER_HOUSE,
  BUILD_CATALOG,
  FIELDS_PER_GRANARY,
  ROYAL_SLOTS_PER_KEEP,
  type BuildKind,
} from '../../marketplace/catalog';
import { BEDS_PER_MANOR } from '../economy/economy';
import {
  BUILDING_MAX_HP,
  hasInterior,
  isBlockingKind,
  isBurnable,
  isDwelling,
  isFortKind,
} from '../combat/stats';
import type { PathGrid } from '../path/PathGrid';
import type { SiegeVfx } from '../siege/SiegeVfx';
import type {
  BuildingResident,
  BuildingSnapshot,
} from '../subjects/types';
import type { Point } from '../subjects/zones';
import { KingdomEvents } from '../subjects/events';

export const KEEP_ID = 'keep';
export const FORT_TILE = TILE_SIZE;

const KEEP_BLURB =
  'A seat of power. Rival armies must destroy every keep to conquer the kingdom.';

export interface BuildingRecord {
  id: string;
  kind: BuildKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  sprite: Phaser.GameObjects.Image;
  /** Shown under the roof when occupied */
  interiorSprite?: Phaser.GameObjects.Image;
  hearthSprite?: Phaser.GameObjects.Sprite;
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
  house: { w: 56, h: 48 },
  wall: { w: 16, h: 16 },
  tavern: { w: 48, h: 40 },
  drawbridge: { w: 16, h: 16 },
  stairs: { w: 20, h: 26 },
  field: { w: 40, h: 26 },
  granary: { w: 36, h: 34 },
  barracks: { w: 40, h: 30 },
  manor: { w: 56, h: 48 },
  ballista: { w: 24, h: 18 },
  watchtower: { w: 24, h: 36 },
  cathedral: { w: 64, h: 56 },
  infirmary: { w: 56, h: 44 },
  dungeon: { w: 40, h: 32 },
  keep: { w: 80, h: 64 },
};

const STAIR_SNAP_DIST = 28;
const GATE_SNAP_DIST = 40;

/** Snap world coord to fortification cell center. */
export function fortSnap(n: number): number {
  return (
    Math.round((n - FORT_TILE / 2) / FORT_TILE) * FORT_TILE + FORT_TILE / 2
  );
}

export function fortKey(x: number, y: number): string {
  return `${fortSnap(x)},${fortSnap(y)}`;
}

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
  private keepInteriorSprite: Phaser.GameObjects.Image | null = null;
  private keepHearth: Phaser.GameObjects.Sprite | null = null;
  private onDestroyed: ((b: BuildingRecord) => void) | null = null;
  private selectedId: string | null = null;
  private vfx: SiegeVfx | null = null;
  private burningIds = new Set<string>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly keep: Point,
    private readonly getUnitBodies: () => Aabb[],
    private readonly onLayoutChanged?: () => void
  ) {
    this.keepMaxHp = BUILDING_MAX_HP.keep;
    this.keepHp = this.keepMaxHp;
  }

  setVfx(vfx: SiegeVfx): void {
    this.vfx = vfx;
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
    this.keepInteriorSprite = this.scene.add
      .image(this.keep.x, this.keep.y, PROP_KEYS.keepInterior)
      .setDepth(7)
      .setOrigin(0.5, 0.85)
      .setVisible(false);
    this.keepHearth = this.spawnHearth(this.keep.x, this.keep.y + 10, 'keep');
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

  seedStarters(_worldW: number, _worldH: number): void {
    const cx = fortSnap(this.keep.x);
    const cy = this.keep.y;
    // Compact village ring around the road cross / keep
    this.addBuilding('house', snapCoord(cx - 56), snapCoord(cy + 12), 'house-0');
    this.addBuilding('house', snapCoord(cx + 56), snapCoord(cy + 12), 'house-1');
    this.addBuilding('granary', snapCoord(cx - 40), snapCoord(cy + 52), 'granary-0');
    this.addBuilding('field', snapCoord(cx + 24), snapCoord(cy + 56), 'field-0');
    this.addBuilding('field', snapCoord(cx + 56), snapCoord(cy + 56), 'field-1');
    // Drawbridge centered on the vertical path, wall snug north of keep
    const row = fortSnap(cy - 32);
    for (let i = -3; i <= 3; i++) {
      const x = cx + i * FORT_TILE;
      if (i === 0) {
        this.addBuilding('drawbridge', x, row);
      } else {
        this.addBuilding('wall', x, row);
      }
    }
    this.refreshWallTextures();
    this.rebuildPathGrid();
  }

  restore(
    saved: SavedBuilding[],
    keepHp?: number,
    keepMaxHp?: number
  ): void {
    this.clearSpritesOnly();
    this.buildings = [];
    this.burningIds.clear();
    if (typeof keepMaxHp === 'number') this.keepMaxHp = keepMaxHp;
    if (typeof keepHp === 'number') this.keepHp = keepHp;
    else this.keepHp = this.keepMaxHp;

    for (const b of saved) {
      let x = b.x;
      let y = b.y;
      if (isFortKind(b.kind)) {
        x = fortSnap(b.x);
        y = fortSnap(b.y);
      }
      this.addBuilding(b.kind, x, y, b.id, {
        hp: b.hp,
        maxHp: b.maxHp,
        attachedWallId: b.attachedWallId,
      });
    }
    this.snapOrphanDrawbridges();
    this.recomputeHouseLabels();
    this.refreshWallTextures();
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

  fieldCount(): number {
    return this.buildings.filter((b) => b.kind === 'field').length;
  }

  granaryCount(): number {
    return this.buildings.filter((b) => b.kind === 'granary').length;
  }

  fieldSlots(): number {
    return this.granaryCount() * FIELDS_PER_GRANARY;
  }

  canPlaceField(): boolean {
    return this.granaryCount() > 0 && this.fieldCount() < this.fieldSlots();
  }

  /** Primary keep + placeable keeps that still stand. */
  keepCount(): number {
    let n = this.keepHp > 0 ? 1 : 0;
    n += this.buildings.filter((b) => b.kind === 'keep' && b.hp > 0).length;
    return n;
  }

  hasCathedral(): boolean {
    return this.buildings.some((b) => b.kind === 'cathedral');
  }

  hasInfirmary(): boolean {
    return this.buildings.some((b) => b.kind === 'infirmary');
  }

  hasDungeon(): boolean {
    return this.buildings.some((b) => b.kind === 'dungeon');
  }

  getCathedralPoint(): Point | null {
    const c = this.buildings.find((b) => b.kind === 'cathedral');
    return c ? { x: c.x, y: c.y } : null;
  }

  getDungeonPoint(): Point | null {
    const d = this.buildings.find((b) => b.kind === 'dungeon');
    return d ? { x: d.x, y: d.y } : null;
  }

  getInfirmaryPoint(): Point | null {
    const i = this.buildings.find((b) => b.kind === 'infirmary');
    return i ? { x: i.x, y: i.y } : null;
  }

  allKeepsDestroyed(): boolean {
    return this.keepCount() === 0;
  }

  bedCapacity(): number {
    let caps = 0;
    for (const b of this.buildings) {
      if (b.kind === 'house') caps += BEDS_PER_HOUSE;
      if (b.kind === 'manor') caps += BEDS_PER_MANOR;
    }
    return caps;
  }

  bedsFor(kind: BuildKind): number {
    if (kind === 'house') return BEDS_PER_HOUSE;
    if (kind === 'manor') return BEDS_PER_MANOR;
    return 0;
  }

  hasTavern(): boolean {
    return this.tavernCount() > 0;
  }

  hasGranary(): boolean {
    return this.buildings.some((b) => b.kind === 'granary');
  }

  hasBarracks(): boolean {
    return this.buildings.some((b) => b.kind === 'barracks');
  }

  getHousePoint(houseId: string): Point | null {
    if (houseId === KEEP_ID) {
      return this.keepHp > 0
        ? { x: this.keep.x, y: this.keep.y }
        : this.getActiveKeepPoint();
    }
    const house = this.buildings.find(
      (b) =>
        (isDwelling(b.kind) || b.kind === 'keep') && b.id === houseId
    );
    return house ? { x: house.x, y: house.y } : null;
  }

  houseLabel(houseId: string): string {
    if (houseId === KEEP_ID) return 'The Keep';
    const house = this.buildings.find(
      (b) =>
        (isDwelling(b.kind) || b.kind === 'keep') && b.id === houseId
    );
    if (!house) return 'Unknown home';
    if (house.kind === 'manor') return `Manor ${house.labelIndex}`;
    if (house.kind === 'keep') return `Keep ${house.labelIndex}`;
    return `House ${house.labelIndex}`;
  }

  pickHouseForHire(occupantCounts: Map<string, number>): string | null {
    const dwellings = this.buildings
      .filter((b) => isDwelling(b.kind))
      .sort((a, b) => a.id.localeCompare(b.id));
    let best: BuildingRecord | null = null;
    let bestFree = -1;
    for (const h of dwellings) {
      const used = occupantCounts.get(h.id) ?? 0;
      const free = this.bedsFor(h.kind) - used;
      if (free > bestFree) {
        bestFree = free;
        best = h;
      }
    }
    return best && bestFree > 0 ? best.id : null;
  }

  /** Assign royalty to a keep with free royal slots. */
  pickKeepForHire(royalCounts: Map<string, number>): string | null {
    const options: { id: string; free: number }[] = [];
    if (this.keepHp > 0) {
      const used = royalCounts.get(KEEP_ID) ?? 0;
      options.push({ id: KEEP_ID, free: ROYAL_SLOTS_PER_KEEP - used });
    }
    for (const b of this.buildings) {
      if (b.kind !== 'keep' || b.hp <= 0) continue;
      const used = royalCounts.get(b.id) ?? 0;
      options.push({ id: b.id, free: ROYAL_SLOTS_PER_KEEP - used });
    }
    options.sort((a, b) => b.free - a.free || a.id.localeCompare(b.id));
    const best = options[0];
    return best && best.free > 0 ? best.id : null;
  }

  getActiveKeepPoint(): Point {
    if (this.keepHp > 0) return { x: this.keep.x, y: this.keep.y };
    const extra = this.buildings.find((b) => b.kind === 'keep' && b.hp > 0);
    if (extra) return { x: extra.x, y: extra.y };
    return { x: this.keep.x, y: this.keep.y };
  }

  /** All standing keeps with HP (primary + placed). */
  listKeepTargets(): {
    id: string;
    x: number;
    y: number;
    hp: number;
    maxHp: number;
  }[] {
    const out: {
      id: string;
      x: number;
      y: number;
      hp: number;
      maxHp: number;
    }[] = [];
    if (this.keepHp > 0) {
      out.push({
        id: KEEP_ID,
        x: this.keep.x,
        y: this.keep.y,
        hp: this.keepHp,
        maxHp: this.keepMaxHp,
      });
    }
    for (const b of this.buildings) {
      if (b.kind !== 'keep' || b.hp <= 0) continue;
      out.push({
        id: b.id,
        x: b.x,
        y: b.y,
        hp: b.hp,
        maxHp: b.maxHp,
      });
    }
    return out;
  }

  getKeepTargetPoint(id: string): Point | null {
    if (id === KEEP_ID) {
      return this.keepHp > 0 ? { x: this.keep.x, y: this.keep.y } : null;
    }
    const b = this.buildings.find((k) => k.id === id && k.kind === 'keep' && k.hp > 0);
    return b ? { x: b.x, y: b.y } : null;
  }

  /** Damage a specific keep (primary or placed). Returns true if all keeps are gone. */
  damageKeepTarget(id: string, amount: number): boolean {
    if (id === KEEP_ID) {
      if (this.keepHp <= 0) return this.allKeepsDestroyed();
      this.keepHp = Math.max(0, this.keepHp - amount);
      this.applyKeepTint();
      this.vfx?.hitFlash(this.keepSprite);
      if (this.keepHp <= 0) {
        this.keepSprite?.setVisible(false);
        this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
          message: this.allKeepsDestroyed()
            ? 'The keep has fallen!'
            : 'A keep has fallen — defend the others!',
        });
      }
      this.onLayoutChanged?.();
      return this.allKeepsDestroyed();
    }
    const b = this.getById(id);
    if (b && b.kind === 'keep') {
      this.damageBuilding(id, amount);
    }
    return this.allKeepsDestroyed();
  }

  /** Fields that sit beyond the wall line (food outside the fort). */
  fieldsOutsideWalls(wallNearPx = 56): BuildingRecord[] {
    const fields: BuildingRecord[] = [];
    for (const b of this.buildings) {
      if (b.kind !== 'field') continue;
      let nearest = Infinity;
      for (const w of this.buildings) {
        if (w.kind !== 'wall' && w.kind !== 'drawbridge') continue;
        const d = Phaser.Math.Distance.Between(b.x, b.y, w.x, w.y);
        if (d < nearest) nearest = d;
      }
      if (nearest > wallNearPx) fields.push(b);
    }
    return fields;
  }

  /** Fortification count / strength near a point (higher = better defended). */
  defenseScoreNear(x: number, y: number, radius = 110): number {
    let score = 0;
    for (const b of this.buildings) {
      const d = Phaser.Math.Distance.Between(x, y, b.x, b.y);
      if (d > radius) continue;
      if (b.kind === 'wall') score += 2;
      else if (b.kind === 'drawbridge') score += 3;
      else if (b.kind === 'ballista') score += 4;
      else if (b.kind === 'watchtower') score += 3;
      else if (b.kind === 'stairs') score += 1;
    }
    return score;
  }

  /** Lowest-HP wall/gate near a point. */
  weakestFortNear(x: number, y: number, radius: number): BuildingRecord | null {
    let best: BuildingRecord | null = null;
    let bestScore = Infinity;
    for (const b of this.buildings) {
      if (b.kind !== 'wall' && b.kind !== 'drawbridge') continue;
      const d = Phaser.Math.Distance.Between(x, y, b.x, b.y);
      if (d > radius) continue;
      const score = b.hp / Math.max(1, b.maxHp) + d / Math.max(1, radius);
      if (score < bestScore) {
        bestScore = score;
        best = b;
      }
    }
    return best;
  }

  nearestField(x: number, y: number, radius = Infinity): BuildingRecord | null {
    let best: BuildingRecord | null = null;
    let bestD = radius;
    for (const b of this.buildings) {
      if (b.kind !== 'field') continue;
      const d = Phaser.Math.Distance.Between(x, y, b.x, b.y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
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

  /** Prefer drawbridges / outer walls for defense muster lines. */
  defenseMusterPoint(): Point {
    const bridges = this.buildings.filter((b) => b.kind === 'drawbridge');
    if (bridges.length) {
      const b = bridges[0]!;
      const dx = b.x - this.keep.x;
      const dy = b.y - this.keep.y;
      const len = Math.hypot(dx, dy) || 1;
      return {
        x: b.x + (dx / len) * 28,
        y: b.y + (dy / len) * 28,
      };
    }
    const walls = this.buildings.filter((b) => b.kind === 'wall');
    if (walls.length) {
      let best = walls[0]!;
      let bestD = -1;
      for (const w of walls) {
        const d = Phaser.Math.Distance.Between(
          w.x,
          w.y,
          this.keep.x,
          this.keep.y
        );
        if (d > bestD) {
          bestD = d;
          best = w;
        }
      }
      return { x: best.x, y: best.y + 24 };
    }
    return { x: this.keep.x, y: this.keep.y + 60 };
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

  fieldsNear(x: number, y: number, radius: number): BuildingRecord | null {
    let best: BuildingRecord | null = null;
    let bestD = radius;
    for (const b of this.buildings) {
      if (b.kind !== 'field') continue;
      const d = Phaser.Math.Distance.Between(x, y, b.x, b.y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  nearestWatchtower(x: number, y: number, radius: number): BuildingRecord | null {
    let best: BuildingRecord | null = null;
    let bestD = radius;
    for (const b of this.buildings) {
      if (b.kind !== 'watchtower') continue;
      const d = Phaser.Math.Distance.Between(x, y, b.x, b.y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  listBallistae(): BuildingRecord[] {
    return this.buildings.filter((b) => b.kind === 'ballista');
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

  /** Prefer walls/gates for siege reduce phase. */
  nearestFortification(x: number, y: number, radius = Infinity): BuildingRecord | null {
    let best: BuildingRecord | null = null;
    let bestD = radius;
    for (const b of this.buildings) {
      if (!isBlockingKind(b.kind, Boolean(b.closed))) continue;
      const d = Phaser.Math.Distance.Between(x, y, b.x, b.y);
      if (d < bestD) {
        bestD = d;
        best = b;
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
    const tex = textureFor(kind, false, 0);
    this.ghost = this.scene.add
      .image(this.keep.x, this.keep.y + 80, tex)
      .setDepth(50)
      .setOrigin(0.5, kind === 'wall' || kind === 'drawbridge' ? 0.75 : 0.85)
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
    } else if (this.placeKind === 'drawbridge') {
      const snap = this.findGateSnap(worldX, worldY);
      if (snap) {
        this.ghost.setPosition(snap.x, snap.y);
        this.ghostWallId = null;
        this.ghostValid = this.canPlaceAt('drawbridge', snap.x, snap.y);
      } else {
        this.ghost.setPosition(fortSnap(worldX), fortSnap(worldY));
        this.ghostValid = false;
      }
    } else if (this.placeKind === 'wall') {
      const x = fortSnap(worldX);
      const y = fortSnap(worldY);
      this.ghost.setPosition(x, y);
      this.ghostWallId = null;
      this.ghostValid = this.canPlaceAt('wall', x, y);
      const mask = this.previewWallMask(x, y);
      this.ghost.setTexture(wallTextureKey(mask));
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
    this.refreshWallTextures();
    this.applyDrawbridgeState();
    this.rebuildPathGrid();
    this.onLayoutChanged?.();
    return true;
  }

  damageBuilding(id: string, amount: number, opts?: { fire?: boolean }): boolean {
    const b = this.getById(id);
    if (!b) return false;
    b.hp = Math.max(0, b.hp - amount);
    this.tintByHp(b);
    if (opts?.fire || isBurnable(b.kind)) {
      this.burningIds.add(id);
      this.vfx?.startBurn(id, b.x, b.y - 8);
    }
    if (b.hp <= 0) {
      const wasFort = isFortKind(b.kind);
      this.destroyBuilding(b);
      if (wasFort) this.vfx?.breachDust(b.x, b.y);
      return true;
    }
    return false;
  }

  damageKeep(amount: number): boolean {
    if (this.keepHp > 0) {
      this.keepHp = Math.max(0, this.keepHp - amount);
      this.applyKeepTint();
      this.vfx?.hitFlash(this.keepSprite);
      if (this.keepHp <= 0) {
        this.keepSprite?.setVisible(false);
        this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
          message: this.allKeepsDestroyed()
            ? 'The keep has fallen!'
            : 'A keep has fallen — defend the others!',
        });
      }
      this.onLayoutChanged?.();
      return this.allKeepsDestroyed();
    }
    const extra = this.buildings.find((b) => b.kind === 'keep' && b.hp > 0);
    if (extra) {
      this.damageBuilding(extra.id, amount);
      return this.allKeepsDestroyed();
    }
    return true;
  }

  getKeepHp(): number {
    return this.keepHp;
  }

  getKeepMaxHp(): number {
    return this.keepMaxHp;
  }

  getKeepPoint(): Point {
    return this.getActiveKeepPoint();
  }

  /** Repair building or keep; returns true if now at full HP. */
  repair(id: string, amount: number): boolean {
    if (id === KEEP_ID) {
      this.keepHp = Math.min(this.keepMaxHp, this.keepHp + amount);
      this.applyKeepTint();
      this.onLayoutChanged?.();
      return this.keepHp >= this.keepMaxHp;
    }
    const b = this.getById(id);
    if (!b) return true;
    b.hp = Math.min(b.maxHp, b.hp + amount);
    this.tintByHp(b);
    if (b.hp >= b.maxHp) {
      this.burningIds.delete(id);
      this.vfx?.stopBurn(id);
    }
    this.onLayoutChanged?.();
    return b.hp >= b.maxHp;
  }

  /** Damaged structures needing repair (keep id = `keep`). */
  listDamaged(): { id: string; x: number; y: number; label: string }[] {
    const out: { id: string; x: number; y: number; label: string }[] = [];
    if (this.keepHp < this.keepMaxHp) {
      out.push({
        id: KEEP_ID,
        x: this.keep.x,
        y: this.keep.y,
        label: 'the keep',
      });
    }
    for (const b of this.buildings) {
      if (b.hp >= b.maxHp) continue;
      out.push({
        id: b.id,
        x: b.x,
        y: b.y,
        label: this.displayName(b),
      });
    }
    return out;
  }

  displayNameForId(id: string): string {
    if (id === KEEP_ID) return 'the keep';
    const b = this.getById(id);
    return b ? this.displayName(b) : 'a building';
  }

  shakeBuilding(id: string): void {
    const b = this.getById(id);
    if (!b) return;
    this.vfx?.impactShake(b.sprite);
  }

  private displayName(b: BuildingRecord): string {
    if (b.kind === 'house') return `House ${b.labelIndex}`;
    if (b.kind === 'manor') return `Manor ${b.labelIndex}`;
    return BUILD_CATALOG.find((c) => c.kind === b.kind)?.name ?? b.kind;
  }

  private applyKeepTint(): void {
    if (!this.keepSprite) return;
    if (this.selectedId === KEEP_ID) {
      this.keepSprite.setTint(0xfff0c0);
      return;
    }
    const ratio = this.keepHp / this.keepMaxHp;
    if (ratio < 0.35) this.keepSprite.setTint(0xff6666);
    else if (ratio < 1) this.keepSprite.setTint(0xffcc88);
    else this.keepSprite.clearTint();
  }

  private destroyBuilding(b: BuildingRecord): void {
    const burned = isBurnable(b.kind);
    this.burningIds.delete(b.id);
    this.vfx?.stopBurn(b.id);
    if (burned) {
      this.vfx?.collapse(b.x, b.y);
    }
    if (b.kind === 'wall') {
      const stairs = this.buildings.filter(
        (s) => s.kind === 'stairs' && s.attachedWallId === b.id
      );
      for (const s of stairs) {
        this.onDestroyed?.(s);
        this.removeRecord(s);
      }
    }
    if (isFortKind(b.kind)) {
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message:
          b.kind === 'drawbridge'
            ? 'The gate was breached!'
            : 'A wall was breached!',
      });
    }
    this.onDestroyed?.(b);
    this.removeRecord(b);
    this.refreshWallTextures();
    this.rebuildPathGrid();
    if (burned) {
      const messages: Partial<Record<BuildKind, string>> = {
        house: 'A house burned down!',
        manor: 'A manor burned down!',
        tavern: 'The tavern burned!',
        stairs: 'Stairs collapsed!',
        field: 'A field burned!',
        granary: 'The granary burned!',
        barracks: 'The barracks burned!',
        cathedral: 'The cathedral burned!',
        infirmary: 'The infirmary burned!',
        dungeon: 'The dungeon collapsed!',
        keep: 'A keep was destroyed!',
      };
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: messages[b.kind] ?? 'A building was destroyed!',
      });
    }
    this.onLayoutChanged?.();
  }

  private removeRecord(b: BuildingRecord): void {
    if (this.selectedId === b.id) {
      this.selectedId = null;
    }
    b.hearthSprite?.destroy();
    b.interiorSprite?.destroy();
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
    const name = this.displayName(b);
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
    if (isDwelling(b.kind)) {
      snap.bedsCapacity = this.bedsFor(b.kind);
      snap.bedsUsed = residents.length;
      snap.residents = residents;
    }
    return snap;
  }

  private makeInteractive(
    sprite: Phaser.GameObjects.Image,
    id: string
  ): void {
    sprite.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, sprite.width, sprite.height),
      Phaser.Geom.Rectangle.Contains
    );
    sprite.input!.cursor = 'pointer';
    sprite.setData('buildingId', id);
  }

  private applySelectionVisuals(): void {
    this.applyKeepTint();
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
    const px = isFortKind(kind) ? fortSnap(x) : x;
    const py = isFortKind(kind) ? fortSnap(y) : y;
    const sprite = this.scene.add
      .image(px, py, textureFor(kind, Boolean(closed), 0))
      .setDepth(kind === 'wall' || kind === 'stairs' || kind === 'watchtower' ? 9 : 8)
      .setOrigin(0.5, kind === 'wall' || kind === 'drawbridge' ? 0.75 : 0.85);
    this.makeInteractive(sprite, id);
    let interiorSprite: Phaser.GameObjects.Image | undefined;
    let hearthSprite: Phaser.GameObjects.Sprite | undefined;
    const intKey = interiorTextureFor(kind);
    if (intKey && hasInterior(kind)) {
      interiorSprite = this.scene.add
        .image(px, py, intKey)
        .setDepth(7)
        .setOrigin(0.5, 0.85)
        .setVisible(false);
      if (kindHasHearth(kind)) {
        hearthSprite = this.spawnHearth(px, py + 6, kind) ?? undefined;
      }
    }
    const record: BuildingRecord = {
      id,
      kind,
      x: px,
      y: py,
      hp,
      maxHp,
      sprite,
      interiorSprite,
      hearthSprite,
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
    if (this.burningIds.has(b.id)) {
      b.sprite.setTint(0xff6622);
      return;
    }
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
    const manors = this.buildings
      .filter((b) => b.kind === 'manor')
      .sort((a, b) => a.id.localeCompare(b.id));
    manors.forEach((h, i) => {
      h.labelIndex = i + 1;
    });
    const keeps = this.buildings
      .filter((b) => b.kind === 'keep')
      .sort((a, b) => a.id.localeCompare(b.id));
    keeps.forEach((h, i) => {
      h.labelIndex = i + 1;
    });
  }

  /** Hide roofs when any unit stands inside the building; light hearths. */
  updateInteriors(unitBodies: Aabb[]): void {
    for (const b of this.buildings) {
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
    if (this.keepSprite && this.keepHp > 0) {
      const keepBox = footprintAabb('keep', this.keep.x, this.keep.y);
      const occupied = unitBodies.some((u) => intersects(keepBox, u));
      this.keepSprite.setVisible(!occupied);
      this.keepInteriorSprite?.setVisible(occupied);
      if (this.keepHearth) {
        this.keepHearth.setVisible(occupied);
        if (occupied && !this.keepHearth.anims.isPlaying) {
          this.keepHearth.play(HEARTH_FIRE_ANIM);
        }
      }
    }
  }

  private spawnHearth(
    x: number,
    y: number,
    kind: BuildKind | 'keep'
  ): Phaser.GameObjects.Sprite | null {
    if (!this.scene.textures.exists(PROP_KEYS.hearthFire)) return null;
    const ox =
      kind === 'keep'
        ? 2
        : kind === 'tavern'
          ? 8
          : kind === 'infirmary'
            ? 10
            : 0;
    const sprite = this.scene.add
      .sprite(x + ox, y + 4, PROP_KEYS.hearthFire, 0)
      .setDepth(8)
      .setOrigin(0.5, 1)
      .setVisible(false);
    return sprite;
  }

  private wallAt(x: number, y: number): BuildingRecord | null {
    const key = fortKey(x, y);
    for (const b of this.buildings) {
      if (b.kind !== 'wall') continue;
      if (fortKey(b.x, b.y) === key) return b;
    }
    return null;
  }

  private fortOccupied(x: number, y: number, ignoreId?: string): boolean {
    const key = fortKey(x, y);
    for (const b of this.buildings) {
      if (ignoreId && b.id === ignoreId) continue;
      if (!isFortKind(b.kind)) continue;
      if (fortKey(b.x, b.y) === key) return true;
    }
    return false;
  }

  private wallMaskAt(x: number, y: number): number {
    let mask = 0;
    if (this.wallAt(x, y - FORT_TILE)) mask |= 1;
    if (this.wallAt(x + FORT_TILE, y)) mask |= 2;
    if (this.wallAt(x, y + FORT_TILE)) mask |= 4;
    if (this.wallAt(x - FORT_TILE, y)) mask |= 8;
    return mask;
  }

  private previewWallMask(x: number, y: number): number {
    let mask = 0;
    if (this.wallAt(x, y - FORT_TILE)) mask |= 1;
    if (this.wallAt(x + FORT_TILE, y)) mask |= 2;
    if (this.wallAt(x, y + FORT_TILE)) mask |= 4;
    if (this.wallAt(x - FORT_TILE, y)) mask |= 8;
    return mask;
  }

  private refreshWallTextures(): void {
    for (const b of this.buildings) {
      if (b.kind !== 'wall') continue;
      b.sprite.setTexture(wallTextureKey(this.wallMaskAt(b.x, b.y)));
    }
  }

  private hasOrthogonalWall(x: number, y: number): boolean {
    return Boolean(
      this.wallAt(x, y - FORT_TILE) ||
        this.wallAt(x + FORT_TILE, y) ||
        this.wallAt(x, y + FORT_TILE) ||
        this.wallAt(x - FORT_TILE, y)
    );
  }

  private findGateSnap(
    worldX: number,
    worldY: number
  ): { x: number; y: number } | null {
    const x = fortSnap(worldX);
    const y = fortSnap(worldY);
    if (this.hasOrthogonalWall(x, y) && !this.fortOccupied(x, y)) {
      return { x, y };
    }
    let best: { x: number; y: number } | null = null;
    let bestD = GATE_SNAP_DIST;
    for (const w of this.buildings) {
      if (w.kind !== 'wall') continue;
      const candidates = [
        { x: w.x + FORT_TILE, y: w.y },
        { x: w.x - FORT_TILE, y: w.y },
        { x: w.x, y: w.y + FORT_TILE },
        { x: w.x, y: w.y - FORT_TILE },
      ];
      for (const c of candidates) {
        if (this.fortOccupied(c.x, c.y)) continue;
        const d = Phaser.Math.Distance.Between(worldX, worldY, c.x, c.y);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
    }
    return best;
  }

  private snapOrphanDrawbridges(): void {
    for (const b of this.buildings) {
      if (b.kind !== 'drawbridge') continue;
      if (this.hasOrthogonalWall(b.x, b.y)) continue;
      const snap = this.findGateSnap(b.x, b.y);
      if (!snap) continue;
      b.x = snap.x;
      b.y = snap.y;
      b.sprite.setPosition(snap.x, snap.y);
    }
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
    if (kind === 'field' && !this.canPlaceField()) return false;
    if (kind === 'stairs' && !wallId) return false;
    if (kind === 'drawbridge' && !this.hasOrthogonalWall(x, y)) return false;
    if (isFortKind(kind) && this.fortOccupied(x, y)) return false;
    const candidate = footprintAabb(kind, x, y);
    if (this.keepHp > 0) {
      const keepBox = footprintAabb('keep', this.keep.x, this.keep.y);
      if (intersects(candidate, keepBox)) return false;
    }
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
      b.hearthSprite?.destroy();
      b.interiorSprite?.destroy();
      b.sprite.destroy();
    }
    this.cancelPlace();
  }
}

function textureFor(kind: BuildKind, closed: boolean, wallMask: number): string {
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
    case 'keep':
      return PROP_KEYS.keep;
  }
}

function kindHasHearth(kind: BuildKind | 'keep'): boolean {
  return (
    kind === 'house' ||
    kind === 'manor' ||
    kind === 'tavern' ||
    kind === 'keep' ||
    kind === 'infirmary'
  );
}

function interiorTextureFor(kind: BuildKind): string | null {
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
    case 'keep':
      return PROP_KEYS.keepInterior;
    default:
      return null;
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
