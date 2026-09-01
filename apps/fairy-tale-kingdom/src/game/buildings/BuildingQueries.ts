import {
  BEDS_PER_HOUSE,
  FIELDS_PER_GRANARY,
  ROYAL_SLOTS_PER_KEEP,
  type BuildKind,
} from '../../marketplace/catalog';
import { BEDS_PER_MANOR } from '../economy/economy';
import { isBlockingKind, isBurnable, isDwelling } from '../combat/stats';
import { Phase12Balance } from '../economy/phase12Balance';
import type { IBuildingQuery } from '../core/interfaces/IBuildingQuery';
import type { Point } from '../subjects/zones';
import {
  KEEP_ID,
  type BuildingRecord,
  footprintAabb,
} from './buildingShared';

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

/** Read-only building queries — implements {@link IBuildingQuery}. */
export interface BuildingQueryState {
  buildings: BuildingRecord[];
  keepHp: number;
  keepMaxHp: number;
  keep: Point;
  getById(id: string): BuildingRecord | undefined;
  displayName(b: BuildingRecord): string;
}

export class BuildingQueries implements IBuildingQuery {
  constructor(private readonly state: BuildingQueryState) {}

  private get buildings(): BuildingRecord[] {
    return this.state.buildings;
  }

  bedCapacity(): number {
    let caps = 0;
    for (const b of this.buildings) {
      if (b.kind === 'house') caps += BEDS_PER_HOUSE;
      if (b.kind === 'manor') caps += BEDS_PER_MANOR;
    }
    return caps;
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

  keepCount(): number {
    let n = this.state.keepHp > 0 ? 1 : 0;
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

  hasBarracks(): boolean {
    return this.buildings.some((b) => b.kind === 'barracks');
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

  hasTavern(): boolean {
    return this.tavernCount() > 0;
  }

  hasGranary(): boolean {
    return this.buildings.some((b) => b.kind === 'granary');
  }

  serializeKeep(): { keepHp: number; keepMaxHp: number } {
    return { keepHp: this.state.keepHp, keepMaxHp: this.state.keepMaxHp };
  }

  getInfluenceRadius(): number {
    return Phase12Balance.keepInfluenceRadius;
  }

  getMilitaryInfluenceRadius(): number {
    return Math.round(this.getInfluenceRadius() * 0.85);
  }

  getInfluenceOriginPoint(id: string): Point | null {
    const b = this.state.getById(id);
    if (b) return { x: b.x, y: b.y };
    if (id === KEEP_ID && this.state.keepHp > 0) {
      return { x: this.state.keep.x, y: this.state.keep.y };
    }
    return null;
  }

  spawnPoint(buildingId: string): Point | null {
    const b = this.state.getById(buildingId);
    if (!b) return null;
    return { x: b.x, y: b.y + 12 };
  }

  keepForBuilding(buildingId: string): string | null {
    if (buildingId === KEEP_ID) return KEEP_ID;
    const b = this.state.getById(buildingId);
    if (!b) return null;
    if (b.kind === 'keep') return b.id;
    return b.loyaltyKeepId ?? this.nearestKeepId(b.x, b.y);
  }

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
    if (this.state.keepHp > 0) {
      out.push({
        id: KEEP_ID,
        x: this.state.keep.x,
        y: this.state.keep.y,
        hp: this.state.keepHp,
        maxHp: this.state.keepMaxHp,
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
      return this.state.keepHp > 0
        ? { x: this.state.keep.x, y: this.state.keep.y }
        : null;
    }
    const b = this.buildings.find(
      (k) => k.id === id && k.kind === 'keep' && k.hp > 0
    );
    return b ? { x: b.x, y: b.y } : null;
  }

  nearestKeepId(x: number, y: number): string | null {
    const keeps = this.listKeepTargets();
    if (!keeps.length) return null;
    let best = keeps[0]!;
    let bestD = dist(x, y, best.x, best.y);
    for (let i = 1; i < keeps.length; i++) {
      const k = keeps[i]!;
      const d = dist(x, y, k.x, k.y);
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
    return best.id;
  }

  /** True if (x,y) is closer to keepId than to any other keep (Voronoi cell). */
  inKeepTerritory(keepId: string, x: number, y: number): boolean {
    return this.nearestKeepId(x, y) === keepId;
  }

  influenceContains(keepId: string, x: number, y: number): boolean {
    const b = this.state.getById(keepId);
    if (b && (b.kind === 'barracks' || b.kind === 'dungeon')) {
      return (
        dist(b.x, b.y, x, y) <=
        this.getMilitaryInfluenceRadius()
      );
    }
    const pt =
      this.getKeepTargetPoint(keepId) ??
      (keepId === KEEP_ID && this.state.keepHp > 0
        ? { x: this.state.keep.x, y: this.state.keep.y }
        : null);
    if (!pt) return false;
    return (
      dist(pt.x, pt.y, x, y) <= this.getInfluenceRadius()
    );
  }

  getActiveKeepPoint(): Point {
    if (this.state.keepHp > 0) return { x: this.state.keep.x, y: this.state.keep.y };
    const extra = this.buildings.find((b) => b.kind === 'keep' && b.hp > 0);
    if (extra) return { x: extra.x, y: extra.y };
    return { x: this.state.keep.x, y: this.state.keep.y };
  }

  allKeepsDestroyed(): boolean {
    return this.keepCount() === 0;
  }

  bedsFor(kind: BuildKind): number {
    if (kind === 'house') return BEDS_PER_HOUSE;
    if (kind === 'manor') return BEDS_PER_MANOR;
    return 0;
  }

  fieldsOutsideWalls(wallNearPx = 56): BuildingRecord[] {
    const fields: BuildingRecord[] = [];
    for (const b of this.buildings) {
      if (b.kind !== 'field') continue;
      let nearest = Infinity;
      for (const w of this.buildings) {
        if (w.kind !== 'wall' && w.kind !== 'drawbridge') continue;
        const d = dist(b.x, b.y, w.x, w.y);
        if (d < nearest) nearest = d;
      }
      if (nearest > wallNearPx) fields.push(b);
    }
    return fields;
  }

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
          const d = dist(fromX, fromY, b.x, b.y);
          if (d < bestD) {
            bestD = d;
            best = b;
          }
        }
      }
    }
    return best;
  }

  nearestFortification(
    x: number,
    y: number,
    radius = Infinity
  ): BuildingRecord | null {
    let best: BuildingRecord | null = null;
    let bestD = radius;
    for (const b of this.buildings) {
      if (!isBlockingKind(b.kind, Boolean(b.closed))) continue;
      const d = dist(x, y, b.x, b.y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  weakestFortNear(
    x: number,
    y: number,
    radius: number
  ): BuildingRecord | null {
    let best: BuildingRecord | null = null;
    let bestScore = Infinity;
    for (const b of this.buildings) {
      if (b.kind !== 'wall' && b.kind !== 'drawbridge') continue;
      const d = dist(x, y, b.x, b.y);
      if (d > radius) continue;
      const score = b.hp / Math.max(1, b.maxHp) + d / Math.max(1, radius);
      if (score < bestScore) {
        bestScore = score;
        best = b;
      }
    }
    return best;
  }

  burnablesNear(x: number, y: number, radius: number): BuildingRecord | null {
    let best: BuildingRecord | null = null;
    let bestD = radius;
    for (const b of this.buildings) {
      if (!isBurnable(b.kind)) continue;
      const d = dist(x, y, b.x, b.y);
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
      const d = dist(x, y, b.x, b.y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
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

  pickKeepForHire(royalCounts: Map<string, number>): string | null {
    const options: { id: string; free: number }[] = [];
    if (this.state.keepHp > 0) {
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

  loyaltyLabelForKeep(keepId: string | null | undefined): string {
    if (!keepId) return 'None';
    if (keepId === KEEP_ID) return 'Crown (The Keep)';
    const b = this.state.getById(keepId);
    if (b) return `${this.state.displayName(b)}'s fief`;
    return 'A keep';
  }
}
