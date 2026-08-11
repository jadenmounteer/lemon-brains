import Phaser from 'phaser';
import { PROP_KEYS, TILE_SIZE, wallTextureKey } from '../art/assetManifest';
import type { SavedBuilding } from '../../kingdom/LayoutRepository';
import {
  BEDS_PER_HOUSE,
  BUILD_CATALOG,
  type BuildKind,
} from '../../marketplace/catalog';
import { BEDS_PER_MANOR } from '../economy/economy';
import {
  BUILDING_MAX_HP,
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
  'Your seat of power. A rival army must destroy it (0 HP) to take the kingdom.';

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
  wall: { w: 16, h: 16 },
  tavern: { w: 36, h: 30 },
  drawbridge: { w: 16, h: 16 },
  stairs: { w: 20, h: 26 },
  field: { w: 40, h: 26 },
  granary: { w: 36, h: 34 },
  barracks: { w: 40, h: 30 },
  manor: { w: 40, h: 34 },
  ballista: { w: 24, h: 18 },
  watchtower: { w: 24, h: 36 },
  keep: { w: 48, h: 44 },
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
    this.addBuilding('house', snapCoord(cx - 64), snapCoord(cy + 8), 'house-0');
    this.addBuilding('house', snapCoord(cx + 72), snapCoord(cy + 16), 'house-1');
    const row = fortSnap(cy - 48);
    const baseCol = Math.round(cx / FORT_TILE);
    for (let i = -3; i <= 3; i++) {
      const x = baseCol * FORT_TILE + i * FORT_TILE + FORT_TILE / 2;
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
    const house = this.buildings.find(
      (b) => isDwelling(b.kind) && b.id === houseId
    );
    return house ? { x: house.x, y: house.y } : null;
  }

  houseLabel(houseId: string): string {
    const house = this.buildings.find(
      (b) => isDwelling(b.kind) && b.id === houseId
    );
    if (!house) return 'Unknown home';
    if (house.kind === 'manor') return `Manor ${house.labelIndex}`;
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
    this.keepHp = Math.max(0, this.keepHp - amount);
    this.applyKeepTint();
    this.vfx?.hitFlash(this.keepSprite);
    this.onLayoutChanged?.();
    return this.keepHp <= 0;
  }

  getKeepHp(): number {
    return this.keepHp;
  }

  getKeepMaxHp(): number {
    return this.keepMaxHp;
  }

  getKeepPoint(): Point {
    return this.keep;
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
        ballista: 'A ballista was destroyed!',
        watchtower: 'A watchtower collapsed!',
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
    const record: BuildingRecord = {
      id,
      kind,
      x: px,
      y: py,
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
    if (kind === 'stairs' && !wallId) return false;
    if (kind === 'drawbridge' && !this.hasOrthogonalWall(x, y)) return false;
    if (isFortKind(kind) && this.fortOccupied(x, y)) return false;
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
