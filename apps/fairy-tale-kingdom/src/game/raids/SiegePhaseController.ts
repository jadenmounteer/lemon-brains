import type { BuildingSystem } from '../buildings/BuildingSystem';
import type { PathGrid } from '../path/PathGrid';
import type { SiegeEngineSystem } from '../siege/SiegeEngineSystem';
import { SiegeBalance } from '../siege/balance';
import { planSiege, type SiegePlan } from '../war/GeneralStrategy';
import { KingdomEvents } from '../subjects/events';
import type Phaser from 'phaser';
import type { ActiveRaider, KeepPoint, SiegePhase } from './raidTypes';

export interface SiegePhaseHost {
  scene: Phaser.Scene;
  keep: KeepPoint;
  buildings: BuildingSystem | null;
  pathGrid: PathGrid | null;
  engines: SiegeEngineSystem | null;
  campPoint: KeepPoint | null;
  world: { width: number; height: number };
  getRaiders(): ActiveRaider[];
  repath(raider: ActiveRaider): void;
}

/** Siege phase machine: muster → reduce → storm → routing. */
export class SiegePhaseController {
  siegePhase: SiegePhase = 'none';
  musterMs = 0;
  siegePlan: SiegePlan | null = null;
  generalName: string | null = null;
  fallenKeepIds: string[] = [];
  replanCooldownMs = 0;
  siegeToastShown = false;
  routToastShown = false;
  killTimes: number[] = [];
  waveStartCount = 0;
  elapsedMs = 0;

  constructor(private readonly host: SiegePhaseHost) {}

  resetWave(): void {
    this.siegePhase = 'none';
    this.siegePlan = null;
    this.generalName = null;
    this.fallenKeepIds = [];
    this.replanCooldownMs = 0;
    this.musterMs = 0;
    this.siegeToastShown = false;
    this.routToastShown = false;
    this.killTimes = [];
  }

  beginSiege(generalName?: string, campX?: number, campY?: number): void {
    this.siegePhase = 'muster';
    this.musterMs = 0;
    this.generalName = generalName ?? null;
    this.fallenKeepIds = [];
    this.replanCooldownMs = 0;
    this.siegeToastShown = false;
    this.routToastShown = false;
    this.killTimes = [];

    if (this.host.buildings && generalName) {
      this.siegePlan = planSiege(
        this.host.buildings,
        { x: campX ?? this.host.keep.x, y: campY ?? this.host.keep.y },
        generalName
      );
      if (this.siegePlan) {
        this.host.keep.x = this.siegePlan.keepX;
        this.host.keep.y = this.siegePlan.keepY;
        this.host.engines?.setKeep({
          x: this.siegePlan.keepX,
          y: this.siegePlan.keepY,
        });
      }
    } else {
      this.siegePlan = null;
    }
  }

  tick(deltaMs: number, activeWaveKind: string | null): void {
    if (activeWaveKind !== 'enemy_army') return;
    if (this.siegePhase === 'routing' || this.siegePhase === 'none') return;

    if (this.siegePhase === 'muster') {
      this.musterMs += deltaMs;
      if (this.musterMs >= SiegeBalance.musterHoldMs) {
        this.siegePhase = 'reduce';
      }
      return;
    }

    if (this.siegePhase === 'reduce') {
      if (this.pathToKeepOpen()) {
        this.siegePhase = 'storm';
        for (const r of this.host.getRaiders()) {
          if (r.state === 'investing' || r.state === 'breaching') {
            r.state = 'pathing';
            this.host.repath(r);
          }
        }
        this.host.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
          message: 'The walls are breached — the host storms the keep!',
        });
      }
    }
  }

  evaluateSiegePlan(activeWaveKind: string | null): void {
    if (
      !this.host.buildings ||
      !this.generalName ||
      activeWaveKind !== 'enemy_army' ||
      this.siegePhase === 'none' ||
      this.siegePhase === 'routing' ||
      this.replanCooldownMs > 0
    ) {
      return;
    }

    const camp = this.host.campPoint ?? {
      x: this.host.keep.x,
      y: this.host.keep.y,
    };
    const keepsLeft = this.host.buildings.listKeepTargets();
    if (keepsLeft.length === 0) return;

    const plan = this.siegePlan;
    let reason: 'keep_fallen' | 'fields_cleared' | null = null;

    if (plan) {
      const targetAlive = Boolean(
        this.host.buildings.getKeepTargetPoint(plan.keepId)
      );
      if (!targetAlive) {
        if (!this.fallenKeepIds.includes(plan.keepId)) {
          this.fallenKeepIds.push(plan.keepId);
        }
        reason = 'keep_fallen';
      } else if (plan.focus === 'raid_fields') {
        const priorityLeft = plan.fieldIds.some((id) => {
          const b = this.host.buildings?.getById(id);
          return b && b.kind === 'field' && b.hp > 0;
        });
        const outerLeft = this.host.buildings.fieldsOutsideWalls().length > 0;
        if (!priorityLeft && !outerLeft) {
          reason = 'fields_cleared';
        }
      }
    } else {
      reason = 'keep_fallen';
    }

    if (!reason) return;

    const next = planSiege(this.host.buildings, camp, this.generalName, {
      excludeKeepIds: this.fallenKeepIds,
      preferKeepAssault: true,
      reason,
    });
    if (!next) return;

    if (
      plan &&
      plan.keepId === next.keepId &&
      plan.focus === next.focus &&
      reason !== 'keep_fallen'
    ) {
      return;
    }

    this.applySiegePlan(next, reason === 'keep_fallen');
  }

  applySiegePlan(plan: SiegePlan, keepFell: boolean): void {
    this.siegePlan = plan;
    this.host.keep.x = plan.keepX;
    this.host.keep.y = plan.keepY;
    this.host.engines?.setKeep({ x: plan.keepX, y: plan.keepY });
    this.replanCooldownMs = 4000;
    this.siegeToastShown = false;

    this.host.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: plan.orderLabel,
    });

    if (plan.focus !== 'raid_fields') {
      for (const r of this.host.getRaiders()) {
        if (r.state === 'done' || !r.sprite.active) continue;
        if (r.siegeRole === 'field_raid') {
          r.siegeRole = 'main';
          r.strategyFieldId = null;
          r.targetBuildingId = null;
        }
      }
    }

    const alive = this.host
      .getRaiders()
      .filter(
        (r) => r.state !== 'done' && r.sprite.active && r.kind === 'enemy_army'
      );
    alive.forEach((r, i) => {
      const invest = this.investPoint(i, alive.length);
      r.investX = invest.x;
      r.investY = invest.y;
      if (r.siegeRole === 'main') {
        if (this.siegePhase === 'muster' || this.siegePhase === 'reduce') {
          r.state = 'investing';
        } else if (this.siegePhase === 'storm') {
          r.state = 'pathing';
          this.host.repath(r);
        }
      }
    });

    if (keepFell && this.siegePhase === 'storm' && !this.pathToKeepOpen()) {
      this.siegePhase = 'reduce';
    }
  }

  investPoint(index: number, total: number): KeepPoint {
    const camp = this.host.campPoint ?? { x: 40, y: 40 };
    if (this.siegePlan) {
      const base = { x: this.siegePlan.breachX, y: this.siegePlan.breachY };
      const spread = (index - (total - 1) / 2) * SiegeBalance.investSpread;
      const dx = this.siegePlan.keepX - camp.x;
      const dy = this.siegePlan.keepY - camp.y;
      const len = Math.hypot(dx, dy) || 1;
      const px = -dy / len;
      const py = dx / len;
      return { x: base.x + px * spread, y: base.y + py * spread };
    }
    const dx = this.host.keep.x - camp.x;
    const dy = this.host.keep.y - camp.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    const dist = Math.min(len * 0.45, 160);
    const px = -ny;
    const py = nx;
    const spread = (index - (total - 1) / 2) * SiegeBalance.investSpread;
    return {
      x: camp.x + nx * dist + px * spread,
      y: camp.y + ny * dist + py * spread,
    };
  }

  /** Ladder deploy during reduce — mirrors RaidSystem siege ladder tick. */
  tickLadderDeploy(
    deltaMs: number,
    ladders: import('./SiegeLadder').SiegeLadderSystem,
    buildings: BuildingSystem | null
  ): boolean {
    if (this.siegePhase !== 'reduce' || !this.siegePlan || !buildings) {
      return false;
    }
    return ladders.tickDeploy(
      deltaMs,
      this.siegePhase,
      { x: this.siegePlan.breachX, y: this.siegePlan.breachY },
      buildings
    );
  }

  breachPoint(): KeepPoint | null {
    if (!this.siegePlan) return null;
    return { x: this.siegePlan.breachX, y: this.siegePlan.breachY };
  }

  pathToKeepOpen(): boolean {
    if (!this.host.pathGrid) return true;
    const from = this.host.campPoint ?? {
      x: this.host.world.width / 2,
      y: 40,
    };
    const path = this.host.pathGrid.findPath(from, {
      x: this.host.keep.x,
      y: this.host.keep.y + 20,
    });
    return Boolean(path && path.length > 0);
  }

  recordKill(): void {
    const t = this.elapsedMs;
    this.killTimes.push(t);
    this.killTimes = this.killTimes.filter(
      (k) => t - k <= SiegeBalance.routWindowMs
    );
  }

  shouldTriggerRout(): boolean {
    const t = this.elapsedMs;
    const recentBurst = this.killTimes.filter(
      (k) => t - k <= SiegeBalance.routBurstWindowMs
    ).length;
    if (recentBurst >= SiegeBalance.routBurstKills) return true;
    if (this.waveStartCount <= 0) return false;
    return (
      this.killTimes.length / this.waveStartCount >= SiegeBalance.routLossFraction
    );
  }
}
