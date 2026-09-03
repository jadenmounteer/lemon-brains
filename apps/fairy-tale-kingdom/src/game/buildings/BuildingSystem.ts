import Phaser from 'phaser';
import {
  PROP_KEYS,
  TILE_SIZE,
  TerrainTile,
  isTerrainBlocked,
} from '../art/assetManifest';
import { bakeWallTexture } from '../art/wallArt';
import type { SavedBuilding } from '../../kingdom/LayoutRepository';
import {
  BUILD_CATALOG,
  FIELDS_PER_GRANARY,
  ROYAL_SLOTS_PER_KEEP,
  type BuildKind,
} from '../../marketplace/catalog';
import {
  BUILDING_MAX_HP,
  hasInterior,
  isBlockingKind,
  isBurnable,
  isDwelling,
  isFortKind,
} from '../combat/stats';
import type { PathGrid } from '../path/PathGrid';
import { WallPathGrid } from '../path/WallPathGrid';
import type { SiegeVfx } from '../siege/SiegeVfx';
import type {
  BuildingResident,
  BuildingSnapshot,
} from '../subjects/types';
import type { Point } from '../subjects/zones';
import { Phase12Balance } from '../economy/phase12Balance';
import { BUILDING_ROLE_CAPACITY } from '../jobs/capacities';
import { getSandboxRuntime } from '../sandboxRuntime';
import { BuildingCombat } from './BuildingCombat';
import { BuildingInteriors } from './BuildingInteriors';
import { BuildingPlacement } from './BuildingPlacement';
import { BuildingQueries } from './BuildingQueries';
import {
  buildingRefundCost,
  isMovableKind,
} from './buildingManagement';
import {
  KEEP_ID,
  FORT_TILE,
  WALL_PLACE_CELLS,
  WALL_MAX_DRAG_CELLS,
  fortSnap,
  fortKey,
  fortIndex,
  fortLineCells,
  footprintAabb,
  bridgeAabb,
  intersects,
  pointInAabb,
  ladderGroundApproach,
  cornerExteriorGroundCells,
  isWallCornerMask,
  textureFor,
  snapCoord,
  type Aabb,
  type BuildingRecord,
  type WallFace,
} from './buildingShared';

const KEEP_BLURB =
  'Heart of the realm. Rival armies win if they destroy this keep.';

const LADDER_SNAP_DIST = 96;
const GATE_SNAP_DIST = 96;

export {
  KEEP_ID,
  FORT_TILE,
  WALL_PLACE_CELLS,
  WALL_MAX_DRAG_CELLS,
  WALL_GOLD_PER_CELL,
  fortSnap,
  fortKey,
  fortLineCells,
  footprintAabb,
  type Aabb,
  type BuildingRecord,
} from './buildingShared';

export class BuildingSystem {
  private buildings: BuildingRecord[] = [];
  private nextId = 0;
  private raidActive = false;
  private pathGrid: PathGrid | null = null;
  private wallPathGrid = new WallPathGrid();
  private mapData: number[][] | null = null;
  private keepHp: number;
  private keepMaxHp: number;
  private keepSprite: Phaser.GameObjects.Image | null = null;
  private keepInteriorSprite: Phaser.GameObjects.Image | null = null;
  private keepHearth: Phaser.GameObjects.Sprite | null = null;
  private onDestroyed: ((b: BuildingRecord) => void) | null = null;
  private onPlaced: ((b: BuildingRecord) => void) | null = null;
  private selectedId: string | null = null;
  private vfx: SiegeVfx | null = null;
  private burningIds = new Set<string>();
  private readonly placement: BuildingPlacement;
  private readonly combat: BuildingCombat;
  private readonly interiors: BuildingInteriors;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly keep: Point,
    private readonly getUnitBodies: () => Aabb[],
    private readonly onLayoutChanged?: () => void
  ) {
    this.keepMaxHp = BUILDING_MAX_HP.keep;
    this.keepHp = this.keepMaxHp;
    const self = this;
    this.interiors = new BuildingInteriors({
      scene: this.scene,
      get buildings() {
        return self.buildings;
      },
      get keepHp() {
        return self.keepHp;
      },
      get keep() {
        return self.keep;
      },
      get keepSprite() {
        return self.keepSprite;
      },
      get keepInteriorSprite() {
        return self.keepInteriorSprite;
      },
      get keepHearth() {
        return self.keepHearth;
      },
    });
    this.combat = new BuildingCombat({
      get buildings() {
        return self.buildings;
      },
      get keepHp() {
        return self.keepHp;
      },
      set keepHp(v: number) {
        self.keepHp = v;
      },
      get keepMaxHp() {
        return self.keepMaxHp;
      },
      get keep() {
        return self.keep;
      },
      get keepSprite() {
        return self.keepSprite;
      },
      get selectedId() {
        return self.selectedId;
      },
      get raidActive() {
        return self.raidActive;
      },
      set raidActive(v: boolean) {
        self.raidActive = v;
      },
      get pathGrid() {
        return self.pathGrid;
      },
      get vfx() {
        return self.vfx;
      },
      get burningIds() {
        return self.burningIds;
      },
      scene: this.scene,
      onLayoutChanged: this.onLayoutChanged,
      onDestroyed: (b) => self.onDestroyed?.(b),
      applyKeepTint: () => self.applyKeepTint(),
      tintByHp: (b) => self.tintByHp(b),
      removeRecord: (b) => self.removeRecord(b),
      refreshWallTextures: () => self.refreshWallTextures(),
      applyDrawbridgeState: () => self.applyDrawbridgeState(),
      allKeepsDestroyed: () => self.queries().allKeepsDestroyed(),
    });
    this.placement = new BuildingPlacement({
      scene: this.scene,
      keep: this.keep,
      getUnitBodies: () => this.getUnitBodies(),
      canPlaceAt: (...args) => this.canPlaceAt(...args),
      findLadderSnap: (x, y) => this.findLadderSnap(x, y),
      findGateSnap: (x, y) => this.findGateSnap(x, y),
      fortLineCells: (x0, y0, x1, y1) =>
        fortLineCells(x0, y0, x1, y1, WALL_MAX_DRAG_CELLS),
      previewWallMask: (x, y) => this.previewWallMask(x, y),
      addBuilding: (...args) => this.addBuilding(...args),
      replaceWallWithGate: (id) => this.replaceWallWithGate(id),
      commitRelocate: (id, x, y, rotation) =>
        this.commitRelocate(id, x, y, rotation),
      afterPlacementCommit: () => {
        this.recomputeHouseLabels();
        this.refreshWallTextures();
        this.applyDrawbridgeState();
        this.rebuildPathGrid();
        this.rebuildWallPathGrid();
        this.onLayoutChanged?.();
      },
    });
  }

  private queries(): BuildingQueries {
    return new BuildingQueries({
      buildings: this.buildings,
      keepHp: this.keepHp,
      keepMaxHp: this.keepMaxHp,
      keep: this.keep,
      getById: (id) => this.getById(id),
      displayName: (b) => this.displayName(b),
    });
  }

  setVfx(vfx: SiegeVfx): void {
    this.vfx = vfx;
  }

  setOnDestroyed(cb: (b: BuildingRecord) => void): void {
    this.onDestroyed = cb;
  }

  setOnPlaced(cb: (b: BuildingRecord) => void): void {
    this.onPlaced = cb;
  }

  setPathGrid(grid: PathGrid): void {
    this.pathGrid = grid;
    this.rebuildPathGrid();
    this.rebuildWallPathGrid();
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
    this.rebuildWallPathGrid();
  }

  /** Starter dwellings for seeded peasant families (new kingdom). */
  seedFamilyHomes(): string[] {
    const offsets = [
      { x: 100, y: 60 },
      { x: -110, y: 70 },
      { x: 130, y: -90 },
    ];
    const ids: string[] = [];
    for (const off of offsets) {
      const x = this.keep.x + off.x;
      const y = this.keep.y + off.y;
      if (!this.canPlaceAt('house', x, y)) continue;
      const rec = this.addBuilding('house', x, y);
      ids.push(rec.id);
    }
    this.recomputeHouseLabels();
    this.rebuildPathGrid();
    this.rebuildWallPathGrid();
    this.onLayoutChanged?.();
    return ids;
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
        ladderFacing: b.ladderFacing ?? b.stairsFacing,
        rotation: b.rotation,
        loyaltyKeepId: b.loyaltyKeepId,
      });
    }
    for (const b of this.buildings) {
      if (b.kind !== 'ladder' || !b.attachedWallId) continue;
      const wall = this.getById(b.attachedWallId);
      if (!wall) continue;
      if (b.x !== wall.x || b.y !== wall.y) {
        b.x = wall.x;
        b.y = wall.y;
        b.sprite.setPosition(wall.x, wall.y);
      }
    }
    this.snapOrphanDrawbridges();
    this.recomputeHouseLabels();
    this.refreshWallTextures();
    this.applyDrawbridgeState();
    this.rebuildPathGrid();
    this.rebuildWallPathGrid();
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
      ladderFacing: b.ladderFacing,
      rotation: b.rotation,
      loyaltyKeepId: b.loyaltyKeepId ?? null,
    }));
  }

  serializeKeep(): { keepHp: number; keepMaxHp: number } {
    return this.queries().serializeKeep();
  }

  bedCapacity(): number {
    return this.queries().bedCapacity();
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

  /** Entrance point for spawning units trained at this building. */
  spawnPoint(buildingId: string): Point | null {
    if (buildingId === KEEP_ID) {
      if (this.keepHp <= 0) return null;
      const box = footprintAabb('keep', this.keep.x, this.keep.y);
      return { x: this.keep.x, y: box.bottom + 8 };
    }
    const b = this.getById(buildingId);
    if (!b || b.hp <= 0) return null;
    const box = footprintAabb(b.kind, b.x, b.y);
    return { x: b.x, y: box.bottom + 8 };
  }

  /** Keep id owning the fief this building belongs to. */
  keepForBuilding(buildingId: string): string | null {
    if (buildingId === KEEP_ID) return KEEP_ID;
    const b = this.getById(buildingId);
    if (!b) return null;
    if (b.kind === 'keep') return b.id;
    return b.loyaltyKeepId ?? this.nearestKeepId(b.x, b.y);
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

  bedsFor(kind: BuildKind): number {
    return this.queries().bedsFor(kind);
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

  claimCircles(): ReturnType<BuildingQueries['claimCircles']> {
    return this.queries().claimCircles();
  }

  inRealmClaim(x: number, y: number): boolean {
    return this.queries().inRealmClaim(x, y);
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
    return this.combat.damageKeepTarget(id, amount);
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
      else if (b.kind === 'ladder') score += 1;
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

  /** Walkable point near the keep for auto-placed family homes. */
  spawnPointNearKeep(kind: BuildKind = 'house'): Point | null {
    const offsets = [
      { x: 120, y: 40 },
      { x: -120, y: 50 },
      { x: 80, y: -100 },
      { x: -90, y: -80 },
    ];
    for (const off of offsets) {
      const x = this.keep.x + off.x;
      const y = this.keep.y + off.y;
      if (this.canPlaceAt(kind, x, y)) {
        return { x, y };
      }
    }
    return null;
  }

  addPlayerHouse(x: number, y: number): BuildingRecord | null {
    if (!this.canPlaceAt('house', x, y)) return null;
    const rec = this.addBuilding('house', x, y);
    this.recomputeHouseLabels();
    this.rebuildPathGrid();
    this.rebuildWallPathGrid();
    this.onLayoutChanged?.();
    return rec;
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

  ladderNear(x: number, y: number, radius: number): BuildingRecord | null {
    let best: BuildingRecord | null = null;
    let bestD = radius;
    for (const b of this.buildings) {
      if (b.kind !== 'ladder' || !b.attachedWallId || !b.ladderFacing) continue;
      const wall = this.getById(b.attachedWallId);
      if (!wall) continue;
      const ground = ladderGroundApproach(wall.x, wall.y, b.ladderFacing);
      const d = Phaser.Math.Distance.Between(x, y, ground.x, ground.y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  /** @deprecated Use ladderNear */
  stairsNear(x: number, y: number, radius: number): BuildingRecord | null {
    return this.ladderNear(x, y, radius);
  }

  /** Corner wall cells expose implicit climb points on exterior ground cells. */
  cornerClimbNear(
    x: number,
    y: number,
    radius: number
  ): { wall: BuildingRecord; groundX: number; groundY: number } | null {
    let best: { wall: BuildingRecord; groundX: number; groundY: number } | null =
      null;
    let bestD = radius;
    const ladderWallIds = new Set(
      this.buildings
        .filter((b) => b.kind === 'ladder' && b.attachedWallId)
        .map((b) => b.attachedWallId!)
    );
    for (const b of this.buildings) {
      if (b.kind !== 'wall') continue;
      if (ladderWallIds.has(b.id)) continue;
      const mask = this.wallMaskAt(b.x, b.y);
      if (!isWallCornerMask(mask)) continue;
      for (const cell of cornerExteriorGroundCells(b.x, b.y, mask)) {
        const d = Phaser.Math.Distance.Between(x, y, cell.x, cell.y);
        if (d < bestD) {
          bestD = d;
          best = { wall: b, groundX: cell.x, groundY: cell.y };
        }
      }
    }
    return best;
  }

  neighborMaskAt(x: number, y: number): number {
    return this.wallMaskAt(x, y);
  }

  wallForLadder(ladder: BuildingRecord): BuildingRecord | null {
    if (!ladder.attachedWallId) return null;
    return this.getById(ladder.attachedWallId) ?? null;
  }

  /** @deprecated Use wallForLadder */
  wallForStairs(stairs: BuildingRecord): BuildingRecord | null {
    return this.wallForLadder(stairs);
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
    this.combat.setRaidActive(active);
  }

  isRaidActive(): boolean {
    return this.combat.isRaidActive();
  }

  rebuildPathGrid(): void {
    this.combat.rebuildPathGrid();
  }

  beginPlace(kind: BuildKind, maxWallCells?: number): void {
    this.placement.beginPlace(kind, maxWallCells);
  }

  beginRelocate(buildingId: string): boolean {
    const b = this.getById(buildingId);
    if (!b || !isMovableKind(b.kind)) return false;
    this.placement.beginRelocate(b);
    return true;
  }

  isRelocating(): boolean {
    return this.placement.isRelocating();
  }

  placementMode(): 'place' | 'relocate' | null {
    return this.placement.placementMode();
  }

  relocatingBuildingId(): string | null {
    return this.placement.relocatingBuildingId();
  }

  demolishBuilding(id: string): { ok: boolean; refund: number; reason?: string } {
    if (id === KEEP_ID) {
      return { ok: false, refund: 0, reason: 'Cannot demolish the keep' };
    }
    const b = this.getById(id);
    if (!b) {
      return { ok: false, refund: 0, reason: 'Building not found' };
    }
    const refund = buildingRefundCost(b.kind);
    this.combat.demolishBuilding(b);
    this.recomputeHouseLabels();
    this.refreshWallTextures();
    this.applyDrawbridgeState();
    this.rebuildPathGrid();
    this.rebuildWallPathGrid();
    this.onLayoutChanged?.();
    return { ok: true, refund };
  }

  beginWallDrag(worldX: number, worldY: number): void {
    this.placement.beginWallDrag(worldX, worldY);
  }

  isWallDragging(): boolean {
    return this.placement.isWallDragging();
  }

  cancelPlace(): void {
    this.placement.cancelPlace();
  }

  isPlacing(): boolean {
    return this.placement.isPlacing();
  }

  placingKind(): BuildKind | null {
    return this.placement.placingKind();
  }

  getPlaceRotation(): 0 | 90 {
    return this.placement.getPlaceRotation();
  }

  rotatePlacement(): void {
    this.placement.rotatePlacement();
  }

  updateGhost(worldX: number, worldY: number): void {
    this.placement.updateGhost(worldX, worldY);
  }

  tryCommitPlace(): boolean {
    return this.placement.tryCommitPlace();
  }

  tryCommitPlaceDetailed(): import('./BuildingPlacement').WallCommitResult {
    return this.placement.tryCommitPlaceDetailed();
  }

  lastWallCellsPlaced(): number {
    return this.placement.lastWallCellsPlaced();
  }

  getWallPathGrid(): WallPathGrid {
    return this.wallPathGrid;
  }

  rebuildWallPathGrid(
    siegeLadders?: import('../path/WallPathGrid').SiegeLadderPortal[]
  ): void {
    const walls = this.buildings.filter(
      (b) => b.kind === 'wall' || (b.kind === 'drawbridge' && !this.raidActive)
    );
    const wallLadders = this.buildings
      .filter((b) => b.kind === 'ladder' && b.attachedWallId && b.ladderFacing)
      .map((b) => {
        const wall = this.getById(b.attachedWallId!);
        if (!wall) return null;
        const ground = ladderGroundApproach(wall.x, wall.y, b.ladderFacing!);
        return {
          id: b.id,
          attachedWallId: b.attachedWallId,
          groundX: ground.x,
          groundY: ground.y,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    this.wallPathGrid.rebuild({
      walls: walls.map((b) => ({
        id: b.id,
        x: b.x,
        y: b.y,
        kind: b.kind as 'wall' | 'drawbridge',
        neighborMask: b.kind === 'wall' ? this.wallMaskAt(b.x, b.y) : 0,
      })),
      wallLadders,
      siegeLadders,
    });
  }

  /** Quietly remove a wall segment (and its ladder) so a drawbridge can take its cell. */
  replaceWallWithGate(wallId: string): void {
    const wall = this.getById(wallId);
    if (!wall || wall.kind !== 'wall') return;
    const ladders = this.buildings.filter(
      (s) => s.kind === 'ladder' && s.attachedWallId === wall.id
    );
    for (const s of ladders) {
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
  wallRunCells(x: number, y: number): Point[] {
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
    return this.combat.damageBuilding(id, amount, opts);
  }

  damageKeep(amount: number): boolean {
    return this.combat.damageKeep(amount);
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
    return this.combat.repair(id, amount);
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
    this.combat.shakeBuilding(id);
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
    if (b.kind === 'ladder' && b.attachedWallId) {
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
      ladderFacing?: WallFace;
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
    const ladderFacing =
      kind === 'ladder' ? opts?.ladderFacing ?? 'south' : undefined;
    const tex =
      kind === 'bridge' && rotation === 90
        ? PROP_KEYS.bridgeV
        : textureFor(kind, Boolean(closed), 0);
    const sprite = this.scene.add
      .image(px, py, tex)
      .setDepth(
        kind === 'wall' || kind === 'watchtower'
          ? 9
          : kind === 'ladder'
            ? 10
            : 8
      )
      .setOrigin(
        0.5,
        kind === 'wall' || kind === 'drawbridge'
          ? 0.75
          : kind === 'ladder'
            ? 0.85
            : 0.85
      );
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
      ladderFacing,
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
    if (isDwelling(kind)) {
      this.onPlaced?.(record);
    }
    return record;
  }

  private tintByHp(b: BuildingRecord): void {
    if (this.selectedId === b.id) return;
    if (this.burningIds.has(b.id)) {
      b.sprite.setTint(0xff6622);
      this.vfx?.startBurn(b.id, b.x, b.y);
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
    this.interiors.updateInteriors(unitBodies);
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

  previewWallMask(x: number, y: number): number {
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
      const mask = this.wallMaskAt(b.x, b.y);
      const col = fortIndex(b.x);
      const row = fortIndex(b.y);
      const key = bakeWallTexture(this.scene, {
        mask,
        col,
        row,
      });
      b.sprite.setTexture(key);
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

  findGateSnap(
    worldX: number,
    worldY: number
  ): { x: number; y: number; replaceWallId?: string } | null {
    // Prefer replacing the wall segment under the cursor (drawbridge snaps into the wall).
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
    if (bestWall && bestWallD <= GATE_SNAP_DIST * 0.85) {
      return {
        x: bestWall.x,
        y: bestWall.y,
        replaceWallId: bestWall.id,
      };
    }

    // Empty fort cell in the wall line (true gap).
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

    return null;
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
   * Ladders snap onto a wall segment; facing picks which exterior ground side
   * defenders approach from.
   */
  findLadderSnap(
    worldX: number,
    worldY: number
  ): { x: number; y: number; wallId: string; facing: WallFace } | null {
    let bestWall: BuildingRecord | null = null;
    let bestD = LADDER_SNAP_DIST;
    for (const w of this.buildings) {
      if (w.kind !== 'wall') continue;
      const d = Phaser.Math.Distance.Between(worldX, worldY, w.x, w.y);
      if (d < bestD) {
        bestD = d;
        bestWall = w;
      }
    }
    if (!bestWall) return null;

    const dx = worldX - bestWall.x;
    const dy = worldY - bestWall.y;
    let facing: WallFace;
    if (Math.abs(dx) > Math.abs(dy)) {
      facing = dx > 0 ? 'east' : 'west';
    } else {
      facing = dy > 0 ? 'south' : 'north';
    }
    return {
      x: bestWall.x,
      y: bestWall.y,
      wallId: bestWall.id,
      facing,
    };
  }

  /** @deprecated Use findLadderSnap */
  findWallSnap(
    worldX: number,
    worldY: number
  ): { x: number; y: number; wallId: string; facing: WallFace } | null {
    return this.findLadderSnap(worldX, worldY);
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
    replaceWallId?: string | null,
    ignoreBuildingId?: string | null
  ): boolean {
    if (kind === 'field' && !this.canPlaceField()) return false;
    if (kind === 'ladder' && !wallId) return false;
    if (kind === 'drawbridge') {
      if (replaceWallId) {
        const wall = this.getById(replaceWallId);
        if (!wall || wall.kind !== 'wall') return false;
      } else if (!this.hasOrthogonalWall(x, y)) {
        return false;
      }
    }
    if (kind === 'ladder' && wallId) {
      const wall = this.getById(wallId);
      if (!wall || wall.kind !== 'wall') return false;
      if (x !== wall.x || y !== wall.y) return false;
      const hasLadder = this.buildings.some(
        (s) =>
          s.kind === 'ladder' &&
          s.attachedWallId === wallId &&
          s.id !== ignoreBuildingId
      );
      if (hasLadder) return false;
    } else if (
      isFortKind(kind) &&
      this.fortOccupied(x, y, replaceWallId ?? wallId ?? undefined)
    ) {
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
      if (ignoreBuildingId && b.id === ignoreBuildingId) continue;
      // Ladders mount on walls; ignore fort collision with the host wall.
      if (kind === 'ladder' && isFortKind(b.kind)) continue;
      // Drawbridge replacing this wall segment, or ladder attached to it.
      if (wallId && b.id === wallId) continue;
      if (replaceWallId && b.id === replaceWallId) continue;
      const bBox =
        b.kind === 'bridge'
          ? bridgeAabb(b.x, b.y, ((b.rotation as 0 | 90) ?? 0))
          : footprintAabb(b.kind, b.x, b.y);
      if (intersects(candidate, bBox)) return false;
    }
    // Fort pieces / ladders shouldn't be blocked by idle subjects near the wall.
    if (kind !== 'ladder' && kind !== 'drawbridge' && kind !== 'wall') {
      for (const unit of this.getUnitBodies()) {
        if (intersects(candidate, unit)) return false;
      }
    }
    return true;
  }

  private commitRelocate(
    buildingId: string,
    x: number,
    y: number,
    rotation: 0 | 90 = 0
  ): boolean {
    const b = this.getById(buildingId);
    if (!b || !isMovableKind(b.kind)) return false;
    if (
      !this.canPlaceAt(b.kind, x, y, null, rotation, null, buildingId)
    ) {
      return false;
    }
    const px =
      b.kind === 'road' || b.kind === 'dock' || b.kind === 'bridge'
        ? fortSnap(x)
        : snapCoord(x);
    const py =
      b.kind === 'road' || b.kind === 'dock' || b.kind === 'bridge'
        ? fortSnap(y)
        : snapCoord(y);
    b.x = px;
    b.y = py;
    b.sprite.setPosition(px, py);
    b.sprite.setAlpha(1);
    if (b.kind === 'bridge') {
      b.rotation = rotation;
      b.sprite.setTexture(
        rotation === 90 ? PROP_KEYS.bridgeV : PROP_KEYS.bridge
      );
    }
    b.interiorSprite?.setPosition(px, py).setAlpha(1);
    b.hearthSprite?.setPosition(px, py + 6);
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
      return PROP_KEYS.houseInterior;
    case 'manor':
      return PROP_KEYS.manorInterior;
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
    case 'granary':
      return PROP_KEYS.granaryInterior;
    case 'barracks':
      return PROP_KEYS.barracksInterior;
    case 'watchtower':
      return PROP_KEYS.watchtowerInterior;
    case 'dock':
      return PROP_KEYS.dockInterior;
    case 'cemetery':
      return PROP_KEYS.cemeteryInterior;
    case 'gallows':
      return PROP_KEYS.gallowsInterior;
    default:
      return null;
  }
}
