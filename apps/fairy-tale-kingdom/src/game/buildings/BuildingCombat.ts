import Phaser from 'phaser';
import { TILE_SIZE } from '../art/assetManifest';
import { isBlockingKind, isBurnable, isFortKind, hasInterior } from '../combat/stats';
import type { PathGrid } from '../path/PathGrid';
import {
  buildingDoorApproach,
} from '../path/interiorPathRouter';
import type { SiegeVfx } from '../siege/SiegeVfx';
import { KingdomEvents } from '../subjects/events';
import type { BuildKind } from '../../marketplace/catalog';
import {
  KEEP_ID,
  bridgeAabb,
  footprintAabb,
  type BuildingRecord,
} from './buildingShared';

export interface BuildingCombatHost {
  buildings: BuildingRecord[];
  keepHp: number;
  keepMaxHp: number;
  keep: { x: number; y: number };
  keepSprite: Phaser.GameObjects.Image | null;
  selectedId: string | null;
  raidActive: boolean;
  pathGrid: PathGrid | null;
  vfx: SiegeVfx | null;
  burningIds: Set<string>;
  scene: Phaser.Scene;
  onLayoutChanged?: () => void;
  onDestroyed?: (b: BuildingRecord) => void;
  applyKeepTint(): void;
  tintByHp(b: BuildingRecord): void;
  removeRecord(b: BuildingRecord): void;
  refreshWallTextures(): void;
  applyDrawbridgeState(): void;
  allKeepsDestroyed(): boolean;
}

/** Clear only the outdoor stand tile in front of a door — not the interior. */
function punchOutdoorDoorApproach(
  pathGrid: PathGrid,
  kind: BuildKind | 'keep',
  origin: { x: number; y: number }
): void {
  const approach = buildingDoorApproach(kind, origin);
  const half = pathGrid.tile / 2;
  for (const dx of [-half, 0, half]) {
    pathGrid.clearBlockedAtWorld(approach.x + dx, approach.y);
  }
}

/** Damage, repair, raid drawbridge state, and path-grid blocking. */
export class BuildingCombat {
  constructor(private readonly host: BuildingCombatHost) {}

  setRaidActive(active: boolean): void {
    if (this.host.raidActive === active) return;
    this.host.raidActive = active;
    this.host.applyDrawbridgeState();
    this.rebuildPathGrid();
  }

  isRaidActive(): boolean {
    return this.host.raidActive;
  }

  rebuildPathGrid(): void {
    if (!this.host.pathGrid) return;
    this.host.pathGrid.clear();
    if (this.host.keepHp > 0) {
      this.host.pathGrid.markAabbBlocked(
        footprintAabb('keep', this.host.keep.x, this.host.keep.y)
      );
      const keepOrigin = { x: this.host.keep.x, y: this.host.keep.y };
      punchOutdoorDoorApproach(this.host.pathGrid, 'keep', keepOrigin);
    }
    for (const b of this.host.buildings) {
      if (b.kind === 'bridge') {
        const box = bridgeAabb(b.x, b.y, ((b.rotation as 0 | 90) ?? 0));
        for (let wy = box.top + 4; wy < box.bottom; wy += TILE_SIZE / 2) {
          for (let wx = box.left + 4; wx < box.right; wx += TILE_SIZE / 2) {
            this.host.pathGrid!.clearTerrainAtWorld(wx, wy);
          }
        }
        continue;
      }
      if (isBlockingKind(b.kind, Boolean(b.closed))) {
        this.host.pathGrid.markAabbBlocked(footprintAabb(b.kind, b.x, b.y));
      } else if (hasInterior(b.kind)) {
        this.host.pathGrid.markAabbBlocked(footprintAabb(b.kind, b.x, b.y));
        punchOutdoorDoorApproach(this.host.pathGrid, b.kind, { x: b.x, y: b.y });
      } else if (b.kind === 'ballista') {
        this.host.pathGrid.markAabbBlocked(footprintAabb(b.kind, b.x, b.y));
      }
    }
  }

  damageBuilding(
    id: string,
    amount: number,
    opts?: { fire?: boolean }
  ): boolean {
    if (id === KEEP_ID) return this.damageKeep(amount);
    const b = this.host.buildings.find((x) => x.id === id);
    if (!b) return false;
    b.hp = Math.max(0, b.hp - amount);
    if (opts?.fire) {
      this.host.burningIds.add(id);
      this.host.vfx?.startBurn(id, b.x, b.y);
    }
    this.host.tintByHp(b);
    this.host.vfx?.hitFlash(b.sprite);
    if (b.hp <= 0) {
      this.destroyBuilding(b);
      return true;
    }
    this.host.onLayoutChanged?.();
    return false;
  }

  damageKeep(amount: number): boolean {
    if (this.host.keepHp <= 0) return this.host.allKeepsDestroyed();
    this.host.keepHp = Math.max(0, this.host.keepHp - amount);
    this.host.applyKeepTint();
    this.host.vfx?.hitFlash(this.host.keepSprite);
    if (this.host.keepSprite) {
      this.host.vfx?.impactShake(this.host.keepSprite);
    }
    if (this.host.keepHp <= 0) {
      this.host.keepSprite?.setVisible(false);
      this.host.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: this.host.allKeepsDestroyed()
          ? 'The keep has fallen!'
          : 'A keep has fallen — defend the others!',
      });
    }
    this.host.onLayoutChanged?.();
    return this.host.allKeepsDestroyed();
  }

  damageKeepTarget(id: string, amount: number): boolean {
    if (id === KEEP_ID) return this.damageKeep(amount);
    const b = this.host.buildings.find((x) => x.id === id);
    if (b && b.kind === 'keep') {
      this.damageBuilding(id, amount);
    }
    return this.host.allKeepsDestroyed();
  }

  repair(id: string, amount: number): boolean {
    if (id === KEEP_ID) {
      this.host.keepHp = Math.min(this.host.keepMaxHp, this.host.keepHp + amount);
      this.host.applyKeepTint();
      this.host.onLayoutChanged?.();
      return this.host.keepHp >= this.host.keepMaxHp;
    }
    const b = this.host.buildings.find((x) => x.id === id);
    if (!b) return true;
    b.hp = Math.min(b.maxHp, b.hp + amount);
    this.host.tintByHp(b);
    if (b.hp >= b.maxHp) {
      this.host.burningIds.delete(id);
      this.host.vfx?.stopBurn(id);
    }
    this.host.onLayoutChanged?.();
    return b.hp >= b.maxHp;
  }

  shakeBuilding(id: string): void {
    const b = this.host.buildings.find((x) => x.id === id);
    if (!b) return;
    this.host.vfx?.impactShake(b.sprite);
  }

  /** Player-initiated demolish (no burn VFX / siege toasts). */
  demolishBuilding(b: BuildingRecord): void {
    this.destroyBuilding(b, { playerDemolish: true });
  }

  private destroyBuilding(
    b: BuildingRecord,
    opts?: { playerDemolish?: boolean }
  ): void {
    const burned = !opts?.playerDemolish && isBurnable(b.kind);
    this.host.burningIds.delete(b.id);
    this.host.vfx?.stopBurn(b.id);
    if (burned) {
      this.host.vfx?.collapse(b.x, b.y);
    }
    if (b.kind === 'wall') {
      const ladders = this.host.buildings.filter(
        (s) => s.kind === 'ladder' && s.attachedWallId === b.id
      );
      for (const s of ladders) {
        this.host.onDestroyed?.(s);
        this.host.removeRecord(s);
      }
    }
    if (!opts?.playerDemolish && isFortKind(b.kind)) {
      this.host.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message:
          b.kind === 'drawbridge'
            ? 'The gate was breached!'
            : 'A wall was breached!',
      });
    }
    this.host.onDestroyed?.(b);
    this.host.removeRecord(b);
    this.host.refreshWallTextures();
    this.rebuildPathGrid();
    if (burned) {
      const messages: Partial<Record<BuildKind, string>> = {
        house: 'A house burned down!',
        manor: 'A manor burned down!',
        tavern: 'The tavern burned!',
        ladder: 'A ladder collapsed!',
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
      this.host.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: messages[b.kind] ?? 'A building was destroyed!',
      });
    }
    this.host.onLayoutChanged?.();
  }
}
