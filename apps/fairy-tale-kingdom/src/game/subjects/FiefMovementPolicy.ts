import type { BuildKind } from '../../marketplace/catalog';
import type { IMovementPolicy } from '../core/interfaces/IMovementPolicy';
import type { ZoneId } from './types';
import { randomPointInZone, type WorldBounds } from './zones';

export interface FiefBuildingQuery {
  getInfluenceOriginPoint(id: string): { x: number; y: number } | null;
  getInfluenceRadius(): number;
  getMilitaryInfluenceRadius(): number;
  getById?(id: string): { kind: BuildKind } | undefined;
  inRealmClaim?(x: number, y: number): boolean;
}

/** Clamps wander targets to a keep or military building's influence sphere. */
export class FiefMovementPolicy implements IMovementPolicy {
  constructor(
    private readonly buildings: FiefBuildingQuery,
    private readonly world: WorldBounds
  ) {}

  clampToFief(
    keepId: string,
    point: { x: number; y: number }
  ): { x: number; y: number } {
    if (this.buildings.inRealmClaim?.(point.x, point.y)) {
      return { x: point.x, y: point.y };
    }
    const origin = this.buildings.getInfluenceOriginPoint(keepId);
    if (!origin) return point;

    const radius = this.influenceRadiusFor(keepId);
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= radius || dist === 0) return { x: point.x, y: point.y };
    const scale = radius / dist;
    return {
      x: origin.x + dx * scale,
      y: origin.y + dy * scale,
    };
  }

  randomPointInFief(
    keepId: string,
    zoneId: string
  ): { x: number; y: number } | null {
    const origin = this.buildings.getInfluenceOriginPoint(keepId);
    if (!origin) return null;
    const raw = randomPointInZone(zoneId as ZoneId, this.world, null);
    return this.clampToFief(keepId, raw);
  }

  private influenceRadiusFor(id: string): number {
    const b = this.buildings.getById?.(id);
    if (b && (b.kind === 'barracks' || b.kind === 'dungeon')) {
      return this.buildings.getMilitaryInfluenceRadius();
    }
    return this.buildings.getInfluenceRadius();
  }
}
