import type { BuildKind } from '../../../marketplace/catalog';

export interface BuildingSnapshot {
  id: string;
  kind: BuildKind;
  x: number;
  y: number;
  hp: number;
  influenceRadius?: number;
}

/** Read-only building queries for stats, placement, and fief logic. */
export interface IBuildingQuery {
  bedCapacity(): number;
  houseCount(): number;
  wallCount(): number;
  tavernCount(): number;
  fieldCount(): number;
  granaryCount(): number;
  keepCount(): number;
  hasCathedral(): boolean;
  hasInfirmary(): boolean;
  hasDungeon(): boolean;
  hasBarracks(): boolean;
  hasGallows(): boolean;
  hasCemetery(): boolean;
  hasDock(): boolean;
  dockCount(): number;
  fieldSlots(): number;
  serializeKeep(): { keepHp: number; keepMaxHp: number };
  getInfluenceOriginPoint(id: string): { x: number; y: number } | null;
  /** Spawn point at building entrance (Phase 2). */
  spawnPoint?(buildingId: string): { x: number; y: number } | null;
  /** Keep id owning this building's fief (Phase 2). */
  keepForBuilding?(buildingId: string): string | null;
}
