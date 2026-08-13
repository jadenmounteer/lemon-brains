import Phaser from 'phaser';
import {
  PROP_KEYS,
  TILE_SIZE,
  TerrainTile,
  wallTextureKey,
  HEARTH_FIRE_ANIM,
  isTerrainBlocked,
} from '../art/assetManifest';
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
import { Phase12Balance } from '../economy/phase12Balance';
import { BUILDING_ROLE_CAPACITY } from '../jobs/capacities';
import { getSandboxRuntime } from '../sandboxRuntime';

export const KEEP_ID = 'keep';
export const FORT_TILE = TILE_SIZE;
/** One marketplace wall buy places this many fort cells in a straight run. */
export const WALL_PLACE_CELLS = 3;

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
  /** Degrees — bridges use 0 or 90 */
  rotation?: number;
  /** Nearest keep this building answers to. */
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

const STAIR_SNAP_DIST = 96;
const GATE_SNAP_DIST = 96;

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
  private placeRotation: 0 | 90 = 0;
  private ghost: Phaser.GameObjects.Image | null = null;
  /** Extra ghosts for multi-cell wall runs (cells 2..N). */
  private wallGhostExtras: Phaser.GameObjects.Image[] = [];
  private ghostValid = false;
  private ghostWallId: string | null = null;
  /** When placing a drawbridge on a wall segment, replace this wall on commit. */
  private ghostReplaceWallId: string | null = null;
  /** Cached wall run under the cursor for commit. */
  private wallRunPreview: Point[] = [];
  private raidActive = false;
  private pathGrid: PathGrid | null = null;
  private mapData: number[][] | null = null;
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

  /** Terrain tile grid used to validate road/bridge/dock placement. */
  setMapData(mapData: number[][]): void {
    this.mapData = mapData;
  }

  /** True when the world point sits on walkable land (not water/mountain). */
  isLandAt(worldX: number, worldY: number): boolean {
    const t = this.tileAt(worldX, worldY);
    if (t === null) return true;
    return !isTerrainBlocked(t);
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
    residents: BuildingResident[] = [],
    workers: BuildingResident[] = []
  ): BuildingSnapshot | null {
    this.selectedId = id;
    this.applySelectionVisuals();
    if (!id) return null;
    return this.toSnapshot(id, residents, workers);
  }

  refreshSelectedSnapshot(
    residents: BuildingResident[] = [],
    workers: BuildingResident[] = []
  ): BuildingSnapshot | null {
    if (!this.selectedId) return null;
    if (this.selectedId !== KEEP_ID && !this.getById(this.selectedId)) {
      this.selectedId = null;
      this.applySelectionVisuals();
      return null;
    }
    return this.toSnapshot(this.selectedId, residents, workers);
  }

  seedStarters(_worldW: number, _worldH: number): void {
    // Sparse founding: keep only (already present). Player builds the rest.
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
        rotation: b.rotation,
        loyaltyKeepId: b.loyaltyKeepId,
      });
    }
    this.snapOrphanDrawbridges();
    this.recomputeHouseLabels();
    this.refreshWallTextures();
    this.applyDrawbridgeState();
    this.rebuildPathGrid();
    this.reassignBuildingLoyalties();
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
      rotation: b.rotation,
      loyaltyKeepId: b.loyaltyKeepId ?? null,
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

  hasGallows(): boolean {
    return this.buildings.some((b) => b.kind === 'gallows');
  }

  hasCemetery(): boolean {
    return this.buildings.some((b) => b.kind === 'cemetery');
  }

  dockCount(): number {
    return this.buildings.filter((b) => b.kind === 'dock' && b.hp > 0).length;
  }

  hasDock(): boolean {
    return this.dockCount() > 0;
  }

  getInfluenceRadius(): number {
    return Phase12Balance.keepInfluenceRadius;
  }

  influenceContains(keepId: string, x: number, y: number): boolean {
    const b = this.getById(keepId);
    if (b && (b.kind === 'barracks' || b.kind === 'dungeon')) {
      return (
        Phaser.Math.Distance.Between(b.x, b.y, x, y) <=
        this.getMilitaryInfluenceRadius()
      );
    }
    const pt = this.getKeepTargetPoint(keepId) ??
      (keepId === KEEP_ID && this.keepHp > 0
        ? { x: this.keep.x, y: this.keep.y }
        : null);
    if (!pt) return false;
    return (
      Phaser.Math.Distance.Between(pt.x, pt.y, x, y) <=
      this.getInfluenceRadius()
    );
  }

  getMilitaryInfluenceRadius(): number {
    return Math.round(this.getInfluenceRadius() * 0.85);
  }

  /** World point an influence circle should be drawn around for `id` (keep, barracks, dungeon). */
  getInfluenceOriginPoint(id: string): Point | null {
    const b = this.getById(id);
    if (b) return { x: b.x, y: b.y };
    if (id === KEEP_ID && this.keepHp > 0) return { x: this.keep.x, y: this.keep.y };
    return null;
  }

  listKeepPoints(): { id: string; x: number; y: number }[] {
    return this.listKeepTargets().map((k) => ({
      id: k.id,
      x: k.x,
      y: k.y,
    }));
  }

  /** Road tile centers — useful for patrol routing, prefers streets over open ground. */
  listRoadPoints(): Point[] {
    return this.buildings
      .filter((b) => b.kind === 'road' || b.kind === 'bridge')
      .map((b) => ({ x: b.x, y: b.y }));
  }

  /** Buildings whose center lies within `radius` of `x,y` (for influence-sphere lookups). */
  listInspectableBuildingsInSphere(
    x: number,
    y: number,
    radius: number
  ): { id: string; kind: BuildKind; x: number; y: number }[] {
    return this.buildings
      .filter((b) => Phaser.Math.Distance.Between(b.x, b.y, x, y) <= radius)
      .map((b) => ({ id: b.id, kind: b.kind, x: b.x, y: b.y }));
  }

  getCathedralPoint(): Point | null {
    const c = this.buildings.find((b) => b.kind === 'cathedral');
    return c ? { x: c.x, y: c.y } : null;
  }

  getDungeonPoint(): Point | null {
    const d = this.buildings.find((b) => b.kind === 'dungeon');
    return d ? { x: d.x, y: d.y } : null;
  }

  getBarracksPoint(): Point | null {
    const b = this.buildings.find((b) => b.kind === 'barracks');
    return b ? { x: b.x, y: b.y } : null;
  }

  getGallowsPoint(): Point | null {
    const g = this.buildings.find((b) => b.kind === 'gallows');
    return g ? { x: g.x, y: g.y } : null;
  }

  getCemeteryPoint(): Point | null {
    const c = this.buildings.find((b) => b.kind === 'cemetery');
    return c ? { x: c.x, y: c.y } : null;
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

  /** Nearest standing keep id by world distance (primary or placed). */
  nearestKeepId(x: number, y: number): string | null {
    const keeps = this.listKeepTargets();
    if (!keeps.length) return null;
    let best = keeps[0]!;
    let bestD = Phaser.Math.Distance.Between(x, y, best.x, best.y);
    for (let i = 1; i < keeps.length; i++) {
      const k = keeps[i]!;
      const d = Phaser.Math.Distance.Between(x, y, k.x, k.y);
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
    return best.id;
  }

  /** True if (x,y) is closer to keepId than to any other keep (Voronoi cell). */
  inKeepTerritory(keepId: string, x: number, y: number): boolean {
    const nearest = this.nearestKeepId(x, y);
    return nearest === keepId;
  }

  /** Random walkable-ish point biased toward keepId's influence. */
  keepTerritoryPoint(keepId: string, seedX?: number, seedY?: number): Point {
    const pt = this.getKeepTargetPoint(keepId) ?? this.getActiveKeepPoint();
    const radius = this.getInfluenceRadius();
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * radius * 0.85;
    const baseX = seedX ?? pt.x;
    const baseY = seedY ?? pt.y;
    // Prefer a point near the seed still inside the keep's Voronoi cell
    const candidates: Point[] = [
      { x: pt.x + Math.cos(angle) * dist, y: pt.y + Math.sin(angle) * dist },
      {
        x: baseX + (Math.random() - 0.5) * 80,
        y: baseY + (Math.random() - 0.5) * 80,
      },
      pt,
    ];
    for (const c of candidates) {
      if (this.inKeepTerritory(keepId, c.x, c.y)) return c;
    }
    return pt;
  }

  reassignBuildingLoyalties(): void {
    for (const b of this.buildings) {
      if (b.kind === 'keep') {
        b.loyaltyKeepId = b.id;
        continue;
      }
      b.loyaltyKeepId = this.nearestKeepId(b.x, b.y);
    }
  }

  loyaltyLabelForKeep(keepId: string | null | undefined): string {
    if (!keepId) return 'None';
    if (keepId === KEEP_ID) return 'Crown (The Keep)';
    const b = this.getById(keepId);
    if (b) return `${this.displayName(b)}'s fief`;
    return 'A keep';
  }

  /** Defense muster near a specific keep, facing an optional threat. */
  defenseMusterPointForKeep(
    keepId: string,
    threat?: Point | null
  ): Point {
    const keep = this.getKeepTargetPoint(keepId) ?? this.getActiveKeepPoint();
    const walls = this.buildings.filter(
      (b) =>
        (b.kind === 'wall' || b.kind === 'drawbridge' || b.kind === 'watchtower') &&
        b.hp > 0 &&
        this.inKeepTerritory(keepId, b.x, b.y)
    );
    if (walls.length && threat) {
      let best = walls[0]!;
      let bestD = Phaser.Math.Distance.Between(best.x, best.y, threat.x, threat.y);
      for (let i = 1; i < walls.length; i++) {
        const w = walls[i]!;
        const d = Phaser.Math.Distance.Between(w.x, w.y, threat.x, threat.y);
        if (d < bestD) {
          bestD = d;
          best = w;
        }
      }
      const dx = best.x - keep.x;
      const dy = best.y - keep.y;
      const len = Math.hypot(dx, dy) || 1;
      return {
        x: best.x + (dx / len) * 18,
        y: best.y + (dy / len) * 18,
      };
    }
    if (threat) {
      const dx = threat.x - keep.x;
      const dy = threat.y - keep.y;
      const len = Math.hypot(dx, dy) || 1;
      const r = Math.min(this.getInfluenceRadius() * 0.45, 140);
      return {
        x: keep.x + (dx / len) * r,
        y: keep.y + (dy / len) * r,
      };
    }
    return this.defenseMusterPoint();
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
    if (id === KEEP_ID && this.keepHp > 0 && this.keepSprite) {
      return {
        id: KEEP_ID,
        kind: 'keep',
        x: this.keep.x,
        y: this.keep.y,
        hp: this.keepHp,
        maxHp: this.keepMaxHp,
        sprite: this.keepSprite,
        interiorSprite: this.keepInteriorSprite ?? undefined,
        hearthSprite: this.keepHearth ?? undefined,
        labelIndex: 0,
      };
    }
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
      if (b.kind === 'bridge') {
        // Clear every tile under the span so units can cross water
        const box = bridgeAabb(b.x, b.y, ((b.rotation as 0 | 90) ?? 0));
        for (let wy = box.top + 4; wy < box.bottom; wy += TILE_SIZE / 2) {
          for (let wx = box.left + 4; wx < box.right; wx += TILE_SIZE / 2) {
            this.pathGrid.clearTerrainAtWorld(wx, wy);
          }
        }
        continue;
      }
      if (isBlockingKind(b.kind, Boolean(b.closed))) {
        this.pathGrid.markAabbBlocked(footprintAabb(b.kind, b.x, b.y));
      }
    }
  }

  beginPlace(kind: BuildKind): void {
    this.cancelPlace();
    this.placeKind = kind;
    this.placeRotation = 0;
    const tex = textureFor(kind, false, 0);
    this.ghost = this.scene.add
      .image(this.keep.x, this.keep.y + 80, tex)
      .setDepth(50)
      .setOrigin(0.5, kind === 'wall' || kind === 'drawbridge' ? 0.75 : 0.85)
      .setAlpha(0.65);
  }

  cancelPlace(): void {
    this.placeKind = null;
    this.placeRotation = 0;
    this.ghost?.destroy();
    this.ghost = null;
    this.clearWallGhostExtras();
    this.wallRunPreview = [];
    this.ghostValid = false;
    this.ghostWallId = null;
    this.ghostReplaceWallId = null;
  }

  private clearWallGhostExtras(): void {
    for (const g of this.wallGhostExtras) g.destroy();
    this.wallGhostExtras = [];
  }

  isPlacing(): boolean {
    return this.placeKind !== null;
  }

  placingKind(): BuildKind | null {
    return this.placeKind;
  }

  getPlaceRotation(): 0 | 90 {
    return this.placeRotation;
  }

  /** Cycle 0/90 rotation while placing a bridge (only bridges support rotation). */
  rotatePlacement(): void {
    if (this.placeKind !== 'bridge' || !this.ghost) return;
    this.placeRotation = this.placeRotation === 0 ? 90 : 0;
    this.ghost.setTexture(
      this.placeRotation === 90 ? PROP_KEYS.bridgeV : PROP_KEYS.bridge
    );
  }

  updateGhost(worldX: number, worldY: number): void {
    if (!this.ghost || !this.placeKind) return;
    this.ghostReplaceWallId = null;

    if (this.placeKind === 'stairs') {
      const snap = this.findWallSnap(worldX, worldY);
      if (snap) {
        this.ghost.setPosition(snap.x, snap.y);
        this.ghostWallId = snap.wallId;
        this.ghostValid = this.canPlaceAt('stairs', snap.x, snap.y, snap.wallId);
      } else {
        this.ghost.setPosition(fortSnap(worldX), fortSnap(worldY));
        this.ghostWallId = null;
        this.ghostValid = false;
      }
    } else if (this.placeKind === 'drawbridge') {
      const snap = this.findGateSnap(worldX, worldY);
      if (snap) {
        this.ghost.setPosition(snap.x, snap.y);
        this.ghostWallId = null;
        this.ghostReplaceWallId = snap.replaceWallId ?? null;
        this.ghostValid = this.canPlaceAt(
          'drawbridge',
          snap.x,
          snap.y,
          null,
          0,
          snap.replaceWallId
        );
      } else {
        this.ghost.setPosition(fortSnap(worldX), fortSnap(worldY));
        this.ghostValid = false;
      }
    } else if (this.placeKind === 'wall') {
      const x = fortSnap(worldX);
      const y = fortSnap(worldY);
      const run = this.wallRunCells(x, y);
      this.wallRunPreview = run;
      this.ghostWallId = null;
      this.ghostValid = run.length > 0;
      this.clearWallGhostExtras();
      if (run.length > 0) {
        const first = run[0]!;
        this.ghost.setPosition(first.x, first.y);
        this.ghost.setTexture(wallTextureKey(this.previewWallMask(first.x, first.y)));
        this.ghost.setVisible(true);
        for (let i = 1; i < run.length; i++) {
          const cell = run[i]!;
          const extra = this.scene.add
            .image(cell.x, cell.y, wallTextureKey(this.previewWallMask(cell.x, cell.y)))
            .setDepth(50)
            .setOrigin(0.5, 0.75)
            .setAlpha(0.55)
            .setTint(this.ghostValid ? 0xffffff : 0xff5555);
          this.wallGhostExtras.push(extra);
        }
      } else {
        this.ghost.setPosition(x, y);
        this.ghost.setTexture(wallTextureKey(this.previewWallMask(x, y)));
      }
    } else if (this.placeKind === 'bridge') {
      // Align to terrain tiles like roads — bridges must cover a water channel.
      const x = fortSnap(worldX);
      const y = fortSnap(worldY);
      this.ghost.setPosition(x, y);
      this.ghostWallId = null;
      // Prefer the player's rotation; flip if only the other axis spans water.
      let rot = this.placeRotation;
      let valid = this.canPlaceAt('bridge', x, y, null, rot);
      if (!valid) {
        const other: 0 | 90 = rot === 90 ? 0 : 90;
        if (this.canPlaceAt('bridge', x, y, null, other)) {
          rot = other;
          this.placeRotation = other;
          valid = true;
        }
      }
      this.ghost.setTexture(rot === 90 ? PROP_KEYS.bridgeV : PROP_KEYS.bridge);
      this.ghostValid = valid;
    } else if (this.placeKind === 'road' || this.placeKind === 'dock') {
      // Roads/docks snap to the full terrain-tile grid so they line up with the map.
      const x = fortSnap(worldX);
      const y = fortSnap(worldY);
      this.ghost.setPosition(x, y);
      this.ghostWallId = null;
      this.ghostValid = this.canPlaceAt(this.placeKind, x, y);
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
    const replaceWallId = this.ghostReplaceWallId;
    const rotation = kind === 'bridge' ? this.placeRotation : undefined;
    const wallRun =
      kind === 'wall' && this.wallRunPreview.length > 0
        ? [...this.wallRunPreview]
        : null;
    this.cancelPlace();
    if (wallRun) {
      for (const cell of wallRun) {
        if (this.canPlaceAt('wall', cell.x, cell.y)) {
          this.addBuilding('wall', cell.x, cell.y);
        }
      }
    } else {
      if (replaceWallId) {
        this.replaceWallWithGate(replaceWallId);
      }
      this.addBuilding(kind, x, y, undefined, { attachedWallId: wallId, rotation });
    }
    this.recomputeHouseLabels();
    this.refreshWallTextures();
    this.applyDrawbridgeState();
    this.rebuildPathGrid();
    this.onLayoutChanged?.();
    return true;
  }

  /** Quietly remove a wall segment (and its stairs) so a drawbridge can take its cell. */
  private replaceWallWithGate(wallId: string): void {
    const wall = this.getById(wallId);
    if (!wall || wall.kind !== 'wall') return;
    const stairs = this.buildings.filter(
      (s) => s.kind === 'stairs' && s.attachedWallId === wall.id
    );
    for (const s of stairs) {
      this.onDestroyed?.(s);
      this.removeRecord(s);
    }
    this.onDestroyed?.(wall);
    this.removeRecord(wall);
  }

  /**
   * Up to WALL_PLACE_CELLS consecutive free fort cells from the snap point.
   * Prefers continuing an existing orthogonal wall; otherwise east–west.
   */
  private wallRunCells(x: number, y: number): Point[] {
    const hasN = Boolean(this.wallAt(x, y - FORT_TILE));
    const hasS = Boolean(this.wallAt(x, y + FORT_TILE));
    const hasE = Boolean(this.wallAt(x + FORT_TILE, y));
    const hasW = Boolean(this.wallAt(x - FORT_TILE, y));
    const verticalScore = (hasN ? 1 : 0) + (hasS ? 1 : 0);
    const horizontalScore = (hasE ? 1 : 0) + (hasW ? 1 : 0);
    const vertical = verticalScore > horizontalScore;
    const dx = vertical ? 0 : FORT_TILE;
    const dy = vertical ? FORT_TILE : 0;
    const cells: Point[] = [];
    for (let i = 0; i < WALL_PLACE_CELLS; i++) {
      const cx = x + dx * i;
      const cy = y + dy * i;
      if (!this.canPlaceAt('wall', cx, cy)) break;
      cells.push({ x: cx, y: cy });
    }
    return cells;
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
        bakery: 'The bakery burned!',
        market: 'The market burned!',
        cemetery: 'The cemetery was ruined!',
        gallows: 'The gallows collapsed!',
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
    residents: BuildingResident[],
    workers: BuildingResident[] = []
  ): BuildingSnapshot | null {
    if (id === KEEP_ID) {
      return {
        id: KEEP_ID,
        kind: 'keep',
        name: 'The Keep',
        blurb: KEEP_BLURB,
        hp: this.keepHp,
        maxHp: this.keepMaxHp,
        influenceRadius: this.getInfluenceRadius(),
        royalCapacity: ROYAL_SLOTS_PER_KEEP,
        royalUsed: residents.length,
        residents,
        workers,
        capacityLines: capacityLinesFor('keep'),
        loyaltyLabel: this.loyaltyLabelForKeep(KEEP_ID),
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
      workers,
      loyaltyLabel: this.loyaltyLabelForKeep(
        b.kind === 'keep' ? b.id : b.loyaltyKeepId
      ),
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
    if (b.kind === 'keep') {
      snap.influenceRadius = this.getInfluenceRadius();
      snap.royalCapacity = ROYAL_SLOTS_PER_KEEP;
      snap.royalUsed = residents.length;
      snap.residents = residents;
    }
    if (b.kind === 'barracks' || b.kind === 'dungeon') {
      snap.influenceRadius = this.getMilitaryInfluenceRadius();
    }
    const lines = capacityLinesFor(b.kind);
    if (lines) snap.capacityLines = lines;
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
    opts?: {
      hp?: number;
      maxHp?: number;
      attachedWallId?: string;
      rotation?: number;
      loyaltyKeepId?: string | null;
    }
  ): BuildingRecord {
    const id = forcedId ?? `${kind}-${this.nextId++}`;
    const match = /^.*?(\d+)$/.exec(id);
    if (match) {
      this.nextId = Math.max(this.nextId, Number(match[1]) + 1);
    }
    const maxHp =
      opts?.maxHp ??
      Math.round(
        BUILDING_MAX_HP[kind] *
          (kind === 'wall' || kind === 'drawbridge'
            ? getSandboxRuntime().buildings.wallHpMult
            : 1)
      );
    const hp = opts?.hp ?? maxHp;
    const closed = kind === 'drawbridge' ? this.raidActive : undefined;
    const px = isFortKind(kind) ? fortSnap(x) : x;
    const py = isFortKind(kind) ? fortSnap(y) : y;
    const rotation = kind === 'bridge' ? opts?.rotation ?? 0 : undefined;
    const tex =
      kind === 'bridge' && rotation === 90
        ? PROP_KEYS.bridgeV
        : textureFor(kind, Boolean(closed), 0);
    const sprite = this.scene.add
      .image(px, py, tex)
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
      rotation,
      loyaltyKeepId:
        opts?.loyaltyKeepId ??
        (kind === 'keep' ? id : this.nearestKeepId(px, py)),
    };
    this.buildings.push(record);
    this.tintByHp(record);
    this.recomputeHouseLabels();
    if (kind === 'keep') {
      this.reassignBuildingLoyalties();
    }
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
  ): { x: number; y: number; replaceWallId?: string } | null {
    // Prefer an empty fort cell that already sits in the wall line (true gap).
    let bestGap: { x: number; y: number } | null = null;
    let bestGapD = GATE_SNAP_DIST;
    let bestGapScore = -1;
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
        if (!this.hasOrthogonalWall(c.x, c.y)) continue;
        const d = Phaser.Math.Distance.Between(worldX, worldY, c.x, c.y);
        if (d >= GATE_SNAP_DIST) continue;
        // Prefer cells flanked by walls on opposite sides (a real gate hole).
        const flanked =
          (Boolean(this.wallAt(c.x - FORT_TILE, c.y)) &&
            Boolean(this.wallAt(c.x + FORT_TILE, c.y))) ||
          (Boolean(this.wallAt(c.x, c.y - FORT_TILE)) &&
            Boolean(this.wallAt(c.x, c.y + FORT_TILE)));
        const score = flanked ? 2 : 1;
        if (score > bestGapScore || (score === bestGapScore && d < bestGapD)) {
          bestGapScore = score;
          bestGapD = d;
          bestGap = c;
        }
      }
    }
    if (bestGap) return bestGap;

    // No gap: snap onto the nearest wall segment and replace it with a gate.
    let bestWall: BuildingRecord | null = null;
    let bestWallD = GATE_SNAP_DIST;
    for (const w of this.buildings) {
      if (w.kind !== 'wall') continue;
      const d = Phaser.Math.Distance.Between(worldX, worldY, w.x, w.y);
      if (d < bestWallD) {
        bestWallD = d;
        bestWall = w;
      }
    }
    if (!bestWall) return null;
    return { x: bestWall.x, y: bestWall.y, replaceWallId: bestWall.id };
  }

  private snapOrphanDrawbridges(): void {
    for (const b of this.buildings) {
      if (b.kind !== 'drawbridge') continue;
      if (this.hasOrthogonalWall(b.x, b.y)) continue;
      const snap = this.findGateSnap(b.x, b.y);
      if (!snap || snap.replaceWallId) continue;
      b.x = snap.x;
      b.y = snap.y;
      b.sprite.setPosition(snap.x, snap.y);
    }
  }

  /**
   * Stairs sit on the empty fort cell beside a wall (toward the cursor),
   * so they don't stack on the battlements or collide with neighbor segments.
   */
  private findWallSnap(
    worldX: number,
    worldY: number
  ): { x: number; y: number; wallId: string } | null {
    let best: { x: number; y: number; wallId: string } | null = null;
    let bestD = STAIR_SNAP_DIST;
    for (const w of this.buildings) {
      if (w.kind !== 'wall') continue;
      const sides = [
        { x: w.x, y: w.y + FORT_TILE },
        { x: w.x, y: w.y - FORT_TILE },
        { x: w.x + FORT_TILE, y: w.y },
        { x: w.x - FORT_TILE, y: w.y },
      ];
      for (const side of sides) {
        if (this.fortOccupied(side.x, side.y)) continue;
        // Also accept when the pointer is on the wall itself — still pick this side
        // if it's the nearest free approach cell for that wall.
        const dSide = Phaser.Math.Distance.Between(worldX, worldY, side.x, side.y);
        const dWall = Phaser.Math.Distance.Between(worldX, worldY, w.x, w.y);
        const d = Math.min(dSide, dWall + FORT_TILE * 0.35);
        if (d < bestD) {
          bestD = d;
          best = { x: side.x, y: side.y, wallId: w.id };
        }
      }
    }
    return best;
  }

  private tileAt(worldX: number, worldY: number): number | null {
    if (!this.mapData) return null;
    const r = Math.floor(worldY / TILE_SIZE);
    const c = Math.floor(worldX / TILE_SIZE);
    return this.mapData[r]?.[c] ?? null;
  }

  /** Every sampled tile under the footprint must be walkable land. */
  private landTerrainOk(box: Aabb): boolean {
    if (!this.mapData) return true;
    for (let wy = box.top + TILE_SIZE / 2; wy < box.bottom; wy += TILE_SIZE) {
      for (let wx = box.left + TILE_SIZE / 2; wx < box.right; wx += TILE_SIZE) {
        const t = this.tileAt(wx, wy);
        if (t !== null && isTerrainBlocked(t)) return false;
      }
    }
    return true;
  }

  /** Every sampled tile under the footprint must be walkable land. */
  private roadTerrainOk(box: Aabb): boolean {
    return this.landTerrainOk(box);
  }

  /**
   * Span must rest on walkable land at both ends and cover at least one water
   * tile in between (works for 1–2 tile river channels).
   */
  private bridgeTerrainOk(x: number, y: number, rotation: 0 | 90): boolean {
    if (!this.mapData) return true;
    const box = bridgeAabb(x, y, rotation);
    const samples: number[] = [];
    if (rotation === 90) {
      const cx = (box.left + box.right) / 2;
      for (let py = box.top + TILE_SIZE / 2; py < box.bottom; py += TILE_SIZE / 2) {
        const t = this.tileAt(cx, py);
        if (t === null) return false;
        samples.push(t);
      }
    } else {
      const cy = (box.top + box.bottom) / 2;
      for (let px = box.left + TILE_SIZE / 2; px < box.right; px += TILE_SIZE / 2) {
        const t = this.tileAt(px, cy);
        if (t === null) return false;
        samples.push(t);
      }
    }
    if (samples.length < 3) return false;
    const endA = samples[0]!;
    const endB = samples[samples.length - 1]!;
    if (
      endA === TerrainTile.water ||
      isTerrainBlocked(endA) ||
      endB === TerrainTile.water ||
      isTerrainBlocked(endB)
    ) {
      return false;
    }
    return samples.some((t) => t === TerrainTile.water);
  }

  /** Must sit on/near the coast — some water tile bordering the footprint. */
  private dockTerrainOk(box: Aabb): boolean {
    if (!this.mapData) return true;
    for (let wy = box.top - TILE_SIZE; wy < box.bottom + TILE_SIZE; wy += TILE_SIZE) {
      for (let wx = box.left - TILE_SIZE; wx < box.right + TILE_SIZE; wx += TILE_SIZE) {
        if (this.tileAt(wx, wy) === TerrainTile.water) return true;
      }
    }
    return false;
  }

  private canPlaceAt(
    kind: BuildKind,
    x: number,
    y: number,
    wallId?: string | null,
    rotation: 0 | 90 = 0,
    replaceWallId?: string | null
  ): boolean {
    if (kind === 'field' && !this.canPlaceField()) return false;
    if (kind === 'stairs' && !wallId) return false;
    if (kind === 'drawbridge') {
      if (replaceWallId) {
        const wall = this.getById(replaceWallId);
        if (!wall || wall.kind !== 'wall') return false;
      } else if (!this.hasOrthogonalWall(x, y)) {
        return false;
      }
    }
    if (isFortKind(kind) && this.fortOccupied(x, y, replaceWallId ?? undefined)) {
      return false;
    }
    const candidate =
      kind === 'bridge' ? bridgeAabb(x, y, rotation) : footprintAabb(kind, x, y);
    // Bridges need water; docks may sit on/beside water. Everything else must be dry land.
    if (kind === 'bridge') {
      if (!this.bridgeTerrainOk(x, y, rotation)) return false;
    } else if (kind === 'dock') {
      if (!this.dockTerrainOk(candidate)) return false;
    } else if (kind === 'road') {
      if (!this.roadTerrainOk(candidate)) return false;
    } else if (!this.landTerrainOk(candidate)) {
      return false;
    }
    if (this.keepHp > 0) {
      const keepBox = footprintAabb('keep', this.keep.x, this.keep.y);
      if (intersects(candidate, keepBox)) return false;
    }
    for (const b of this.buildings) {
      // Stairs sit against walls; ignore fort collision so continuous runs work.
      if (kind === 'stairs' && isFortKind(b.kind)) continue;
      // Drawbridge replacing this wall segment, or stairs attached to it.
      if (wallId && b.id === wallId) continue;
      if (replaceWallId && b.id === replaceWallId) continue;
      const bBox =
        b.kind === 'bridge'
          ? bridgeAabb(b.x, b.y, ((b.rotation as 0 | 90) ?? 0))
          : footprintAabb(b.kind, b.x, b.y);
      if (intersects(candidate, bBox)) return false;
    }
    // Fort pieces / stairs shouldn't be blocked by idle subjects near the wall.
    if (kind !== 'stairs' && kind !== 'drawbridge' && kind !== 'wall') {
      for (const unit of this.getUnitBodies()) {
        if (intersects(candidate, unit)) return false;
      }
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

function capacityLinesFor(kind: BuildKind | 'keep'): string[] | undefined {
  const key = kind === 'keep' ? 'keep' : kind;
  const caps = BUILDING_ROLE_CAPACITY[key];
  if (!caps) return undefined;
  return Object.entries(caps).map(
    ([role, n]) => `${role.replace(/_/g, ' ')}: up to ${n}`
  );
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

/** Bridge footprint swaps width/height when rotated 90° to span the other axis. */
function bridgeAabb(x: number, y: number, rotation: 0 | 90): Aabb {
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
