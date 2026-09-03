import Phaser from 'phaser';
import {
  idleAnimKey,
  walkAnimKey,
  type Direction,
} from '../art/assetManifest';
import { isRoyalRole } from '../art/assetManifest';
import type { BuildingRecord, BuildingSystem } from '../buildings/BuildingSystem';
import { CombatBalance } from '../combat/stats';
import type { PathGrid } from '../path/PathGrid';
import { SiegeBalance } from '../siege/balance';
import type { SiegeEngineSystem } from '../siege/SiegeEngineSystem';
import type { SiegeVfx } from '../siege/SiegeVfx';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import { KingdomEvents } from '../subjects/events';
import type { EncampmentSystem } from '../war/EncampmentSystem';
import { planSiege, type SiegePlan } from '../war/GeneralStrategy';
import { WarBalance } from '../war/WarBalance';
import { KEEP_ID } from '../buildings/BuildingSystem';
import { Phase12Balance } from '../economy/phase12Balance';
import { pickName } from '../subjects/names';

import { RaidMovement } from './RaidMovement';
import { RaidSpawner } from './RaidSpawner';
import { SiegeLadderSystem } from './SiegeLadder';
import {
  KEEP_REACH_PX,
  MOVE_SPEED,
  RAID_LABELS,
  type ActiveRaider,
  type BeginSiegeFromCampOpts,
  type KeepPoint,
  type LaunchCampRaidersOpts,
  type RaidKind,
  type SiegePhase,
  type StealKind,
} from './raidTypes';

export type { ActiveRaider, BeginSiegeFromCampOpts, LaunchCampRaidersOpts, SiegePhase, StealKind };
export { KEEP_REACH_PX };

export class RaidSystem {
  private raiders: ActiveRaider[] = [];
  private elapsedMs = 0;
  private gameOver = false;
  private raidCount = 0;
  private buildings: BuildingSystem | null = null;
  private subjects: SubjectSystem | null = null;
  private pathGrid: PathGrid | null = null;
  private engines: SiegeEngineSystem | null = null;
  private vfx: SiegeVfx | null = null;
  private encampments: EncampmentSystem | null = null;
  private onChanged: (() => void) | null = null;
  private onArrestIntake:
    | ((
        captive: import('../../kingdom/CaptivesRepository').CaptiveRecord,
        guardId: string,
        fromX: number,
        fromY: number
      ) => boolean)
    | null = null;
  private siegeToastShown = false;
  private siegePhase: SiegePhase = 'none';
  private musterMs = 0;
  private waveStartCount = 0;
  private killTimes: number[] = [];
  private routToastShown = false;
  private activeWaveKind: RaidKind | null = null;
  private campPoint: KeepPoint | null = null;
  private siegePlan: SiegePlan | null = null;
  private generalName: string | null = null;
  /** Keeps already taken during this continuous siege campaign */
  private fallenKeepIds: string[] = [];
  private replanCooldownMs = 0;
  private readonly movement: RaidMovement;
  private readonly spawner: RaidSpawner;
  private readonly ladders: SiegeLadderSystem;
  private ladderToastShown = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: { width: number; height: number },
    private readonly keep: KeepPoint
  ) {
    const self = this;
    this.movement = new RaidMovement(
      {
        get pathGrid() {
          return self.pathGrid;
        },
        unstickRaider: (r) => self.unstickRaider(r),
        stepToward: (r, tx, ty, d) => self.stepToward(r, tx, ty, d),
      },
      () => self.pathGrid
    );
    this.spawner = new RaidSpawner({
      scene: this.scene,
      get pathGrid() {
        return self.pathGrid;
      },
      get raiders() {
        return self.raiders;
      },
      investPoint: (i, t) => self.investPoint(i, t),
    });
    this.ladders = new SiegeLadderSystem(this.scene);
  }

  setBuildings(buildings: BuildingSystem): void {
    this.buildings = buildings;
  }

  setSubjects(subjects: SubjectSystem): void {
    this.subjects = subjects;
  }

  setPathGrid(grid: PathGrid): void {
    this.pathGrid = grid;
  }

  setEngines(engines: SiegeEngineSystem): void {
    this.engines = engines;
    engines.setOnKill(() => this.recordKill());
  }

  setVfx(vfx: SiegeVfx): void {
    this.vfx = vfx;
    this.ladders.setVfx(vfx);
  }

  setEncampments(encampments: EncampmentSystem): void {
    this.encampments = encampments;
  }

  setOnArrestIntake(
    cb: (
      captive: import('../../kingdom/CaptivesRepository').CaptiveRecord,
      guardId: string,
      fromX: number,
      fromY: number
    ) => boolean
  ): void {
    this.onArrestIntake = cb;
  }

  setOnChanged(cb: () => void): void {
    this.onChanged = cb;
  }

  /** Camp-launched steal / aggro party (no free edge pops). */
  launchCampRaiders(opts: LaunchCampRaidersOpts): void {
    if (this.gameOver) return;
    this.raidCount += 1;
    if (!opts.aggroOnly && !opts.isReinforce) {
      this.activeWaveKind = opts.kind;
      this.campPoint = { x: opts.homeX, y: opts.homeY };
      this.waveStartCount = opts.count;
      this.killTimes = [];
      this.routToastShown = false;
      this.siegeToastShown = false;
      this.siegePhase = 'none';
      this.buildings?.setRaidActive(true);
      const keep = this.buildings?.getActiveKeepPoint?.() ?? this.keep;
      this.scene.game.events.emit(KingdomEvents.RAID_WARNING, {
        kind: opts.stealKind ?? opts.kind,
        label: opts.label ?? RAID_LABELS[opts.kind],
        x: keep?.x,
        y: keep?.y,
      });
    }

    for (let i = 0; i < opts.count; i++) {
      const ox = opts.x + Phaser.Math.Between(-18, 18);
      const oy = opts.y + Phaser.Math.Between(-18, 18);
      this.launchRaider(opts.kind, ox, oy, undefined, i, opts.count, {
        homeCampId: opts.homeCampId,
        homeX: opts.homeX,
        homeY: opts.homeY,
        stealKind: opts.stealKind ?? null,
        aggroOnly: Boolean(opts.aggroOnly),
        isGeneral: Boolean(opts.hasGeneral) && i === 0,
        rosterSubjectId: opts.rosterSubjectIds?.[i] ?? null,
      });
    }
  }

  /** Sandbox: spawn a small raid party from a map edge. */
  debugLaunchRaid(kind: RaidKind, count = 5): void {
    const pad = 48;
    const side = Phaser.Math.Between(0, 3);
    let x = pad;
    let y = pad;
    switch (side) {
      case 0:
        x = Phaser.Math.Between(pad, this.world.width - pad);
        y = pad;
        break;
      case 1:
        x = Phaser.Math.Between(pad, this.world.width - pad);
        y = this.world.height - pad;
        break;
      case 2:
        x = pad;
        y = Phaser.Math.Between(pad, this.world.height - pad);
        break;
      default:
        x = this.world.width - pad;
        y = Phaser.Math.Between(pad, this.world.height - pad);
        break;
    }
    if (this.pathGrid) {
      const snap = this.pathGrid.snapWorldToOpen(x, y);
      x = snap.x;
      y = snap.y;
    }
    const stealKind: StealKind | undefined =
      kind === 'bandit' ||
      kind === 'giant' ||
      kind === 'goblin' ||
      kind === 'gypsy'
        ? kind
        : undefined;
    this.launchCampRaiders({
      kind,
      x,
      y,
      count,
      homeCampId: `sandbox-raid-${kind}`,
      homeX: x,
      homeY: y,
      stealKind,
      label: `Sandbox ${RAID_LABELS[kind]}`,
    });
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `Sandbox: ${RAID_LABELS[kind]} raid inbound!`,
    });
  }

  /** Initial siege wave planted at a siege encampment. */
  beginSiegeFromCamp(opts: BeginSiegeFromCampOpts): void {
    if (this.gameOver) return;
    this.raidCount += 1;
    this.campPoint = { x: opts.x, y: opts.y };
    this.activeWaveKind = 'enemy_army';
    this.siegePhase = 'muster';
    this.musterMs = 0;
    this.killTimes = [];
    this.routToastShown = false;
    this.siegeToastShown = false;
    this.generalName = opts.generalName ?? null;
    this.fallenKeepIds = [];
    this.replanCooldownMs = 0;

    // Smart general picks the battlefield plan before the host moves
    if (this.buildings && opts.generalName) {
      this.siegePlan = planSiege(
        this.buildings,
        { x: opts.x, y: opts.y },
        opts.generalName
      );
      if (this.siegePlan) {
        this.keep.x = this.siegePlan.keepX;
        this.keep.y = this.siegePlan.keepY;
        this.engines?.setKeep({
          x: this.siegePlan.keepX,
          y: this.siegePlan.keepY,
        });
        this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
          message: this.siegePlan.orderLabel,
        });
      }
    } else {
      this.siegePlan = null;
      const active = this.buildings?.getActiveKeepPoint();
      if (active) {
        this.keep.x = active.x;
        this.keep.y = active.y;
      }
    }

    this.engines?.spawnForRaid(this.raidCount, opts.x, opts.y);
    const eng = this.engines?.countAlive() ?? 0;
    this.waveStartCount = opts.count + eng;
    this.buildings?.setRaidActive(true);

    const label = opts.generalName
      ? `${opts.generalName}’s siege host (${opts.count} infantry${eng ? `, ${eng} engines` : ''})`
      : `a siege host (${opts.count} infantry${eng ? `, ${eng} engines` : ''})`;
    this.scene.game.events.emit(KingdomEvents.RAID_WARNING, {
      kind: 'enemy_army',
      label,
      x: this.keep.x,
      y: this.keep.y,
    });

    const fieldDetach =
      this.siegePlan?.focus === 'raid_fields'
        ? Math.min(
            Math.max(1, Math.floor(opts.count / 3)),
            this.siegePlan.fieldIds.length || 1
          )
        : 0;

    for (let i = 0; i < opts.count; i++) {
      const ox = opts.x + Phaser.Math.Between(-20, 20);
      const oy = opts.y + Phaser.Math.Between(-20, 20);
      const isFieldRaid = i < fieldDetach;
      const fieldId =
        isFieldRaid && this.siegePlan
          ? this.siegePlan.fieldIds[i % Math.max(1, this.siegePlan.fieldIds.length)] ??
            null
          : null;
      this.launchRaider('enemy_army', ox, oy, undefined, i, opts.count, {
        homeCampId: opts.homeCampId,
        homeX: opts.x,
        homeY: opts.y,
        stealKind: null,
        aggroOnly: false,
        isGeneral: i === fieldDetach && Boolean(opts.generalName),
        siegeRole: isFieldRaid ? 'field_raid' : 'main',
        strategyFieldId: fieldId,
      });
    }
  }

  get isGameOver(): boolean {
    return this.gameOver;
  }

  getSiegePhase(): SiegePhase {
    return this.siegePhase;
  }

  isArmySiege(): boolean {
    return this.activeWaveKind === 'enemy_army' && this.hasActiveRaiders();
  }

  hasActiveRaiders(): boolean {
    const units = this.raiders.some((r) => r.state !== 'done' && r.sprite.active);
    const eng = (this.engines?.countAlive() ?? 0) > 0;
    return units || eng;
  }

  nearestRaider(
    x: number,
    y: number,
    radius: number
  ): ActiveRaider | null {
    let best: ActiveRaider | null = null;
    let bestD = radius;
    for (const r of this.raiders) {
      if (
        !r.sprite.active ||
        r.state === 'done' ||
        r.state === 'routing' ||
        r.state === 'retreating'
      )
        continue;
      const d = Phaser.Math.Distance.Between(x, y, r.sprite.x, r.sprite.y);
      if (d < bestD) {
        bestD = d;
        best = r;
      }
    }
    return best;
  }

  damageRaider(raider: ActiveRaider, amount: number): boolean {
    if (!raider.sprite.active || raider.state === 'done') return false;
    raider.hp = Math.max(0, raider.hp - amount);
    const ratio = raider.hp / raider.maxHp;
    if (ratio <= 0.35) raider.sprite.setTint(0xff6666);
    this.vfx?.hitFlash(raider.sprite);
    if (raider.hp <= 0) {
      this.killRaider(raider);
      return true;
    }
    return false;
  }

  update(deltaMs: number): void {
    if (this.gameOver) return;

    this.replanCooldownMs = Math.max(0, this.replanCooldownMs - deltaMs);
    this.evaluateSiegePlan();

    // Hold the smart general's chosen keep; otherwise track the active keep
    if (this.siegePlan && this.activeWaveKind === 'enemy_army') {
      const pt = this.buildings?.getKeepTargetPoint(this.siegePlan.keepId);
      if (pt) {
        this.keep.x = pt.x;
        this.keep.y = pt.y;
        this.siegePlan.keepX = pt.x;
        this.siegePlan.keepY = pt.y;
      }
      this.engines?.setKeep(this.keep);
    } else {
      const active = this.buildings?.getActiveKeepPoint();
      if (active) {
        this.keep.x = active.x;
        this.keep.y = active.y;
        this.engines?.setKeep(active);
      }
    }

    this.elapsedMs += deltaMs;
    // Raids launch from encampments — no timer edge spawns

    this.tickSiegePhase(deltaMs);

    const routing = this.siegePhase === 'routing';
    const storming = this.siegePhase === 'storm';
    this.engines?.update(deltaMs, storming, routing);

    for (const raider of [...this.raiders]) {
      if (!raider.sprite.active || raider.state === 'done') continue;
      this.tickRaider(raider, deltaMs);
    }

    if (!this.hasActiveRaiders() && this.siegePhase !== 'none') {
      this.endWave();
    }
  }

  /**
   * Mid-siege: if the target keep fell or the field raid succeeded,
   * pick a new plan aimed at remaining keeps until the kingdom falls.
   */
  private evaluateSiegePlan(): void {
    if (
      !this.buildings ||
      !this.generalName ||
      this.activeWaveKind !== 'enemy_army' ||
      this.siegePhase === 'none' ||
      this.siegePhase === 'routing' ||
      this.replanCooldownMs > 0
    ) {
      return;
    }

    const camp = this.campPoint ?? { x: this.keep.x, y: this.keep.y };
    const keepsLeft = this.buildings.listKeepTargets();
    if (keepsLeft.length === 0) return;

    const plan = this.siegePlan;
    let reason: 'keep_fallen' | 'fields_cleared' | null = null;

    if (plan) {
      const targetAlive = Boolean(
        this.buildings.getKeepTargetPoint(plan.keepId)
      );
      if (!targetAlive) {
        if (!this.fallenKeepIds.includes(plan.keepId)) {
          this.fallenKeepIds.push(plan.keepId);
        }
        reason = 'keep_fallen';
      } else if (plan.focus === 'raid_fields') {
        const priorityLeft = plan.fieldIds.some((id) => {
          const b = this.buildings?.getById(id);
          return b && b.kind === 'field' && b.hp > 0;
        });
        const outerLeft = this.buildings.fieldsOutsideWalls().length > 0;
        if (!priorityLeft && !outerLeft) {
          reason = 'fields_cleared';
        }
      }
    } else {
      reason = 'keep_fallen';
    }

    if (!reason) return;

    const next = planSiege(this.buildings, camp, this.generalName, {
      excludeKeepIds: this.fallenKeepIds,
      preferKeepAssault: true,
      reason,
    });
    if (!next) return;

    // Same keep + same focus → nothing useful changed
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

  private applySiegePlan(plan: SiegePlan, keepFell: boolean): void {
    this.siegePlan = plan;
    this.keep.x = plan.keepX;
    this.keep.y = plan.keepY;
    this.engines?.setKeep({ x: plan.keepX, y: plan.keepY });
    this.replanCooldownMs = 4000;
    this.siegeToastShown = false;

    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: plan.orderLabel,
    });

    // Field detachments rejoin the main push once food is done / keep fell
    if (plan.focus !== 'raid_fields') {
      for (const r of this.raiders) {
        if (r.state === 'done' || !r.sprite.active) continue;
        if (r.siegeRole === 'field_raid') {
          r.siegeRole = 'main';
          r.strategyFieldId = null;
          r.targetBuildingId = null;
        }
      }
    }

    // Re-form invest line toward the new objective
    const alive = this.raiders.filter(
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
          this.repath(r);
        }
      }
    });

    if (keepFell && this.siegePhase === 'storm') {
      // Path may have changed after a keep drop — re-open reduce if blocked
      if (!this.pathToKeepOpen()) {
        this.siegePhase = 'reduce';
      }
    }
  }

  clear(): void {
    for (const r of this.raiders) {
      r.camp?.destroy();
      r.sprite.destroy();
    }
    this.raiders = [];
    this.engines?.clear();
  }

  private tickSiegePhase(deltaMs: number): void {
    if (this.activeWaveKind !== 'enemy_army') return;
    if (this.siegePhase === 'routing' || this.siegePhase === 'none') return;

    if (this.siegePhase === 'muster') {
      this.musterMs += deltaMs;
      if (this.musterMs >= SiegeBalance.musterHoldMs) {
        this.siegePhase = 'reduce';
      }
      return;
    }

    if (this.siegePhase === 'reduce') {
      const breach =
        this.siegePlan != null
          ? { x: this.siegePlan.breachX, y: this.siegePlan.breachY }
          : null;
      if (
        this.ladders.tickDeploy(
          deltaMs,
          this.siegePhase,
          breach,
          this.buildings
        )
      ) {
        this.buildings?.rebuildWallPathGrid(this.ladders.toPortals());
        if (!this.ladderToastShown) {
          this.ladderToastShown = true;
          this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
            message: 'Siege ladders rise against the battlements!',
          });
        }
      }
      const pathOpen = this.pathToKeepOpen();
      if (pathOpen) {
        this.siegePhase = 'storm';
        for (const r of this.raiders) {
          if (r.state === 'investing' || r.state === 'breaching') {
            r.state = 'pathing';
            this.repath(r);
          }
        }
        this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
          message: 'The walls are breached — the host storms the keep!',
        });
      }
    }
  }

  private pathToKeepOpen(): boolean {
    if (!this.pathGrid) return true;
    const from = this.campPoint ?? {
      x: this.world.width / 2,
      y: 40,
    };
    const path = this.pathGrid.findPath(from, {
      x: this.keep.x,
      y: this.keep.y + 20,
    });
    return Boolean(path && path.length > 0);
  }

  private repathTo(raider: ActiveRaider, goalX: number, goalY: number): void {
    this.movement.repathTo(raider, goalX, goalY);
  }

  private repath(raider: ActiveRaider): void {
    this.movement.repath(raider, this.keep.x, this.keep.y);
  }

  private followPathTo(
    raider: ActiveRaider,
    goalX: number,
    goalY: number,
    deltaMs: number
  ): void {
    this.movement.followPathTo(raider, goalX, goalY, deltaMs);
  }

  private launchRaider(
    kind: RaidKind,
    x: number,
    y: number,
    camp?: Phaser.GameObjects.Arc,
    index = 0,
    total = 1,
    home?: {
      homeCampId: string | null;
      homeX: number;
      homeY: number;
      stealKind: StealKind | null;
      aggroOnly: boolean;
      isGeneral?: boolean;
      siegeRole?: 'main' | 'field_raid';
      strategyFieldId?: string | null;
      rosterSubjectId?: string | null;
    }
  ): void {
    this.spawner.launchRaider(
      kind,
      x,
      y,
      camp,
      index,
      total,
      home,
      (raider) => this.repath(raider)
    );
  }

  private investPoint(index: number, total: number): KeepPoint {
    const camp = this.campPoint ?? { x: 40, y: 40 };
    // Smart general: invest along the soft approach corridor
    if (this.siegePlan) {
      const base = { x: this.siegePlan.breachX, y: this.siegePlan.breachY };
      const spread =
        (index - (total - 1) / 2) * SiegeBalance.investSpread;
      const dx = this.siegePlan.keepX - camp.x;
      const dy = this.siegePlan.keepY - camp.y;
      const len = Math.hypot(dx, dy) || 1;
      const px = -dy / len;
      const py = dx / len;
      return {
        x: base.x + px * spread,
        y: base.y + py * spread,
      };
    }
    const dx = this.keep.x - camp.x;
    const dy = this.keep.y - camp.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    const dist = Math.min(len * 0.45, 160);
    const px = -ny;
    const py = nx;
    const spread =
      (index - (total - 1) / 2) * SiegeBalance.investSpread;
    return {
      x: camp.x + nx * dist + px * spread,
      y: camp.y + ny * dist + py * spread,
    };
  }

  private tickRaider(raider: ActiveRaider, deltaMs: number): void {
    raider.thinkAccumMs += deltaMs;
    const think = raider.thinkAccumMs >= CombatBalance.tickMs;
    if (think) raider.thinkAccumMs = 0;

    if (raider.state === 'routing') {
      this.tickRouting(raider, deltaMs);
      return;
    }

    if (raider.state === 'feasting') {
      this.tickGiantFeast(raider, deltaMs);
      return;
    }

    if (raider.state === 'carrying') {
      this.tickGiantCarry(raider, deltaMs);
      return;
    }

    if (raider.state === 'retreating') {
      this.tickRetreat(raider, deltaMs);
      return;
    }

    // Giants hunt villagers instead of racing the keep for gold
    if (raider.kind === 'giant') {
      this.tickGiantHunt(raider, deltaMs, think);
      return;
    }

    // Arrest: thieves, bandits, gypsies when dungeon exists + military nearby
    if (
      think &&
      this.buildings?.hasDungeon() &&
      (raider.stealKind === 'thief' ||
        raider.stealKind === 'bandit' ||
        raider.stealKind === 'gypsy' ||
        raider.kind === 'bandit' ||
        raider.kind === 'gypsy')
    ) {
      const guard = this.subjects?.nearestMilitary(
        raider.sprite.x,
        raider.sprite.y,
        CombatBalance.thiefCaptureRange
      );
      if (guard) {
        this.arrestRaider(raider, guard.data.id);
        return;
      }
    }

    if (this.siegePhase === 'routing') {
      this.beginRoutRaider(raider);
      return;
    }

    // Field detachment: burn outer food while the host invests
    if (raider.kind === 'enemy_army' && raider.siegeRole === 'field_raid') {
      this.tickFieldRaid(raider, deltaMs, think);
      return;
    }

    // Army invest / reduce before storm
    if (
      raider.kind === 'enemy_army' &&
      (this.siegePhase === 'muster' || this.siegePhase === 'reduce')
    ) {
      this.tickInvestReduce(raider, deltaMs, think);
      return;
    }

    const atKeep =
      Phaser.Math.Distance.Between(
        raider.sprite.x,
        raider.sprite.y,
        this.keep.x,
        this.keep.y
      ) < KEEP_REACH_PX;

    if (atKeep) {
      if (raider.kind === 'enemy_army') {
        this.tickSiege(raider, think);
        return;
      }
      this.onReachedKeep(raider);
      return;
    }

    if (raider.state === 'sieging') {
      raider.state = 'pathing';
    }

    if (think) {
      const unit = this.subjects?.nearestSubject(
        raider.sprite.x,
        raider.sprite.y,
        CombatBalance.pillageRadius
      );
      if (unit) {
        raider.state = 'fighting';
        raider.targetSubjectId = unit.data.id;
        raider.targetBuildingId = null;
      } else {
        let burn: BuildingRecord | null | undefined = null;
        if (raider.kind === 'enemy_army' || this.siegePhase === 'storm') {
          burn = this.buildings?.fieldsNear(
            raider.sprite.x,
            raider.sprite.y,
            CombatBalance.homesteadPillageRadius
          );
        }
        if (!burn) {
          burn = this.buildings?.burnablesNear(
            raider.sprite.x,
            raider.sprite.y,
            CombatBalance.homesteadPillageRadius
          );
        }
        if (burn) {
          raider.state = 'burning';
          raider.targetBuildingId = burn.id;
          raider.targetSubjectId = null;
        } else if (raider.state === 'fighting' || raider.state === 'burning') {
          raider.state = 'pathing';
          raider.targetSubjectId = null;
          raider.targetBuildingId = null;
          this.repath(raider);
        }
      }
    }

    if (raider.state === 'fighting' && raider.targetSubjectId && think) {
      const target = this.subjects?.getById(raider.targetSubjectId);
      if (!target) {
        raider.state = 'pathing';
        raider.targetSubjectId = null;
        this.repath(raider);
      } else {
        const dist = Phaser.Math.Distance.Between(
          raider.sprite.x,
          raider.sprite.y,
          target.sprite.x,
          target.sprite.y
        );
        if (dist > CombatBalance.guardRange + 8) {
          this.stepToward(raider, target.sprite.x, target.sprite.y, deltaMs);
        } else {
          this.faceToward(raider, target.sprite.x, target.sprite.y);
          raider.sprite.play(idleAnimKey(raider.kind), true);
          this.vfx?.meleeLunge(raider.sprite, target.sprite.x, target.sprite.y);
          this.vfx?.hitFlash(target.sprite);
          if (
            raider.kind === 'enemy_army' &&
            isRoyalRole(target.data.role)
          ) {
            this.captureRoyal(target.data.id);
          } else {
            this.subjects?.damageSubject(
              target.data.id,
              CombatBalance.raiderMelee
            );
          }
        }
        return;
      }
    }

    if (raider.state === 'burning' && raider.targetBuildingId && think) {
      const b = this.buildings?.getById(raider.targetBuildingId);
      if (!b) {
        raider.state = 'pathing';
        raider.targetBuildingId = null;
        this.repath(raider);
      } else {
        const dist = Phaser.Math.Distance.Between(
          raider.sprite.x,
          raider.sprite.y,
          b.x,
          b.y
        );
        if (dist > 36) {
          this.stepToward(raider, b.x, b.y, deltaMs);
        } else {
          this.faceToward(raider, b.x, b.y);
          raider.sprite.play(idleAnimKey(raider.kind), true);
          const destroyed = this.buildings?.damageBuilding(
            b.id,
            CombatBalance.raiderBurn,
            {
              fire: true,
            }
          );
          if (destroyed && b.kind === 'house') {
            this.subjects?.onHouseDestroyed(b.id);
          }
          if (destroyed && b.kind === 'wall') {
            this.subjects?.dropFromWall(b.id);
          }
        }
        return;
      }
    }

    if (!raider.path.length || raider.pathIndex >= raider.path.length) {
      this.repath(raider);
    }

    if (!raider.path.length) {
      const blocker = this.buildings?.findBlockingAhead(
        raider.sprite.x,
        raider.sprite.y,
        this.keep.x,
        this.keep.y
      );
      if (blocker && think) {
        raider.state = 'breaching';
        this.breach(raider, blocker);
      }
      // No land path (river / mountain / walls) — wait; do not cut across water
      return;
    }

    const waypoint = raider.path[raider.pathIndex]!;
    const dist = Phaser.Math.Distance.Between(
      raider.sprite.x,
      raider.sprite.y,
      waypoint.x,
      waypoint.y
    );
    if (dist < 10) {
      raider.pathIndex += 1;
      return;
    }

    const blocker = this.buildings?.findBlockingAhead(
      raider.sprite.x,
      raider.sprite.y,
      waypoint.x,
      waypoint.y
    );
    if (blocker && dist < 40) {
      if (think) {
        raider.state = 'breaching';
        this.breach(raider, blocker);
      }
      return;
    }

    raider.state = 'pathing';
    this.stepToward(raider, waypoint.x, waypoint.y, deltaMs);
  }

  private tickInvestReduce(
    raider: ActiveRaider,
    deltaMs: number,
    think: boolean
  ): void {
    const ix = raider.investX ?? this.keep.x;
    const iy = raider.investY ?? this.keep.y + 80;
    const dist = Phaser.Math.Distance.Between(
      raider.sprite.x,
      raider.sprite.y,
      ix,
      iy
    );
    if (dist > 14) {
      this.stepToward(raider, ix, iy, deltaMs);
      raider.state = 'investing';
      return;
    }

    // Hold line; help breach — smart generals pick the weakest fort on their approach
    if (this.siegePhase === 'reduce' && think) {
      const ladder = this.ladders.nearestLadder(
        raider.sprite.x,
        raider.sprite.y,
        SiegeBalance.ladderClimbRange
      );
      if (ladder && !raider.onWall) {
        const ld = Phaser.Math.Distance.Between(
          raider.sprite.x,
          raider.sprite.y,
          ladder.groundX,
          ladder.groundY
        );
        if (ld > 10) {
          this.stepToward(raider, ladder.groundX, ladder.groundY, deltaMs);
          raider.state = 'investing';
        } else {
          raider.onWall = true;
          raider.sprite.setPosition(ladder.wallX, ladder.wallY - 10);
          raider.sprite.setDepth(22);
          raider.state = 'fighting';
        }
        return;
      }

      const fort =
        this.siegePlan && this.buildings
          ? this.buildings.weakestFortNear(
              raider.sprite.x,
              raider.sprite.y,
              120
            ) ??
            this.buildings.nearestFortification(
              raider.sprite.x,
              raider.sprite.y,
              100
            )
          : this.buildings?.nearestFortification(
              raider.sprite.x,
              raider.sprite.y,
              100
            );
      if (fort) {
        const fd = Phaser.Math.Distance.Between(
          raider.sprite.x,
          raider.sprite.y,
          fort.x,
          fort.y
        );
        if (fd > 36) {
          this.stepToward(raider, fort.x, fort.y, deltaMs);
        } else {
          raider.state = 'breaching';
          this.breach(raider, fort);
        }
        return;
      }
    }
    raider.sprite.play(idleAnimKey(raider.kind), true);
  }

  /** Scorched-earth detachment: burn priority outer fields, then rejoin the storm. */
  private tickFieldRaid(
    raider: ActiveRaider,
    deltaMs: number,
    think: boolean
  ): void {
    if (!think && raider.state === 'burning' && raider.targetBuildingId) {
      const b = this.buildings?.getById(raider.targetBuildingId);
      if (b) {
        const dist = Phaser.Math.Distance.Between(
          raider.sprite.x,
          raider.sprite.y,
          b.x,
          b.y
        );
        if (dist > 36) this.stepToward(raider, b.x, b.y, deltaMs);
      }
      return;
    }

    if (!think) return;

    let field =
      (raider.strategyFieldId
        ? this.buildings?.getById(raider.strategyFieldId)
        : null) ?? null;
    if (!field || field.kind !== 'field' || field.hp <= 0) {
      if (!this.buildings) return;
      field =
        this.buildings.fieldsOutsideWalls()[0] ??
        this.buildings.fieldsNear(
          raider.sprite.x,
          raider.sprite.y,
          400
        ) ??
        null;
      raider.strategyFieldId = field?.id ?? null;
    }

    if (!field) {
      // Food gone — rejoin the main siege
      raider.siegeRole = 'main';
      raider.state = 'pathing';
      raider.targetBuildingId = null;
      this.repath(raider);
      return;
    }

    raider.state = 'burning';
    raider.targetBuildingId = field.id;
    raider.targetSubjectId = null;
    const dist = Phaser.Math.Distance.Between(
      raider.sprite.x,
      raider.sprite.y,
      field.x,
      field.y
    );
    if (dist > 36) {
      this.stepToward(raider, field.x, field.y, deltaMs);
      return;
    }
    this.faceToward(raider, field.x, field.y);
    raider.sprite.play(idleAnimKey(raider.kind), true);
    this.vfx?.meleeLunge(raider.sprite, field.x, field.y);
    const destroyed = this.buildings?.damageBuilding(
      field.id,
      CombatBalance.raiderBurn,
      { fire: true }
    );
    if (destroyed) {
      raider.strategyFieldId = null;
      raider.targetBuildingId = null;
    }
  }

  private tickRouting(raider: ActiveRaider, deltaMs: number): void {
    const edge = {
      x: raider.homeX || this.campPoint?.x || 24,
      y: raider.homeY || this.campPoint?.y || 24,
    };
    const dist = Phaser.Math.Distance.Between(
      raider.sprite.x,
      raider.sprite.y,
      edge.x,
      edge.y
    );
    if (dist < 20) {
      this.killRaider(raider, false);
      return;
    }
    // Path around mountains/water — never bee-line into blocked terrain
    this.followPathTo(raider, edge.x, edge.y, deltaMs * 1.45);
    raider.sprite.setTint(0xaaaaaa);
    if (Math.random() < 0.08) {
      this.vfx?.breachDust(raider.sprite.x, raider.sprite.y);
    }
  }

  private tickRetreat(raider: ActiveRaider, deltaMs: number): void {
    if (
      raider.stealKind === 'thief' &&
      this.buildings?.hasDungeon()
    ) {
      const guard = this.subjects?.nearestMilitary(
        raider.sprite.x,
        raider.sprite.y,
        CombatBalance.thiefCaptureRange
      );
      if (guard) {
        this.captureThiefRaider(raider);
        return;
      }
    }

    const dist = Phaser.Math.Distance.Between(
      raider.sprite.x,
      raider.sprite.y,
      raider.homeX,
      raider.homeY
    );
    if (dist < 22) {
      this.returnRaiderHome(raider);
      return;
    }
    this.followPathTo(raider, raider.homeX, raider.homeY, deltaMs);
  }

  private tickGiantHunt(
    raider: ActiveRaider,
    deltaMs: number,
    think: boolean
  ): void {
    if (!raider.sprite.active || raider.state === 'done') return;
    if (think) {
      const prey = this.nearestGiantPrey(raider.sprite.x, raider.sprite.y, 220);
      if (prey) {
        raider.targetSubjectId = prey.data.id;
        const d = Phaser.Math.Distance.Between(
          raider.sprite.x,
          raider.sprite.y,
          prey.sprite.x,
          prey.sprite.y
        );
        if (d < 28) {
          this.grabVillager(raider, prey.data.id);
          return;
        }
        this.followPathTo(raider, prey.sprite.x, prey.sprite.y, deltaMs);
        return;
      }
      // No prey nearby — smash a building or idle-path toward settlement, never steal gold
      const burn = this.buildings?.burnablesNear(
        raider.sprite.x,
        raider.sprite.y,
        CombatBalance.pillageRadius
      );
      if (burn) {
        raider.state = 'burning';
        raider.targetBuildingId = burn.id;
      } else if (raider.state === 'pathing' || raider.state === 'fighting') {
        raider.state = 'pathing';
        if (!raider.path.length) this.repath(raider);
      }
    }
    if (raider.state === 'burning' && raider.targetBuildingId) {
      const b = this.buildings?.getById(raider.targetBuildingId);
      if (b) {
        this.stepToward(raider, b.x, b.y, deltaMs);
        const d = Phaser.Math.Distance.Between(
          raider.sprite.x,
          raider.sprite.y,
          b.x,
          b.y
        );
        if (d < 30 && think) {
          this.buildings?.damageBuilding(b.id, CombatBalance.raiderBurn * CombatBalance.giantDamageMult);
        }
      }
      return;
    }
    if (!raider.path.length) {
      this.repath(raider);
    }
    if (!raider.path.length) {
      this.stepToward(raider, this.keep.x, this.keep.y + 20, deltaMs);
      return;
    }
    const waypoint = raider.path[raider.pathIndex] ?? raider.path[raider.path.length - 1]!;
    const wd = Phaser.Math.Distance.Between(
      raider.sprite.x,
      raider.sprite.y,
      waypoint.x,
      waypoint.y
    );
    if (wd < 10) {
      raider.pathIndex = Math.min(raider.pathIndex + 1, raider.path.length - 1);
      return;
    }
    this.stepToward(raider, waypoint.x, waypoint.y, deltaMs);
  }

  private tickGiantCarry(raider: ActiveRaider, deltaMs: number): void {
    // Keep victim attached visually (hidden under arm — bob the giant)
    if (raider.carriedSubjectId) {
      const victim = this.subjects?.getById(raider.carriedSubjectId);
      if (victim) {
        victim.sprite.setPosition(raider.sprite.x - 8, raider.sprite.y - 10);
        victim.sprite.setVisible(false);
      }
    }
    const dist = Phaser.Math.Distance.Between(
      raider.sprite.x,
      raider.sprite.y,
      raider.homeX,
      raider.homeY
    );
    if (dist < 28) {
      raider.state = 'feasting';
      raider.feastMs = 2200;
      raider.sprite.play(idleAnimKey(raider.kind), true);
      return;
    }
    this.followPathTo(raider, raider.homeX, raider.homeY, deltaMs);
  }

  private tickGiantFeast(raider: ActiveRaider, deltaMs: number): void {
    raider.feastMs -= deltaMs;
    if (raider.feastMs > 0) return;
    if (raider.carriedSubjectId) {
      this.subjects?.devourSubject(raider.carriedSubjectId);
      raider.carriedSubjectId = null;
    }
    raider.looted = true;
    this.returnRaiderHome(raider);
  }

  private grabVillager(raider: ActiveRaider, subjectId: string): void {
    raider.carriedSubjectId = subjectId;
    raider.targetSubjectId = subjectId;
    raider.state = 'carrying';
    raider.path = [];
    raider.pathIndex = 0;
    this.repathTo(raider, raider.homeX, raider.homeY);
    this.subjects?.beginAbducted(subjectId);
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: 'A giant grabs a villager!',
    });
  }

  private nearestGiantPrey(x: number, y: number, radius: number) {
    if (!this.subjects) return null;
    const preferred = new Set([
      'peasant',
      'child',
      'jester',
      'physician',
      'bishop',
      'executioner',
    ]);
    let best: ReturnType<SubjectSystem['getById']> = undefined;
    let bestD = radius;
    let bestScore = Infinity;
    for (const s of this.subjects.listManaged()) {
      if (!s.sprite.active || !s.sprite.visible) continue;
      if (s.data.allegiance === 'camp') continue;
      if (s.interrupt?.kind === 'abducted') continue;
      if (isRoyalRole(s.data.role)) continue;
      const d = Phaser.Math.Distance.Between(x, y, s.sprite.x, s.sprite.y);
      if (d > radius) continue;
      const score = preferred.has(s.data.role) ? d : d + 80;
      if (score < bestScore) {
        bestScore = score;
        bestD = d;
        best = s;
      }
    }
    void bestD;
    return best ?? null;
  }

  private freeCarriedVictim(raider: ActiveRaider): void {
    if (!raider.carriedSubjectId) return;
    const id = raider.carriedSubjectId;
    raider.carriedSubjectId = null;
    const victim = this.subjects?.getById(id);
    if (victim) {
      victim.sprite.setVisible(true);
      victim.sprite.setPosition(raider.sprite.x, raider.sprite.y);
      this.subjects?.freeAbducted(id);
    }
  }

  private returnRaiderHome(raider: ActiveRaider): void {
    if (raider.state === 'done') return;
    raider.state = 'done';
    const campId = raider.homeCampId;
    raider.camp?.destroy();
    raider.sprite.destroy();
    this.raiders = this.raiders.filter((r) => r !== raider);
    if (campId) {
      this.encampments?.onRaiderReturned(campId, raider.rosterSubjectId);
    }
    if (!this.hasActiveRaiders()) this.endWave();
    this.onChanged?.();
  }

  private arrestRaider(raider: ActiveRaider, guardId: string): void {
    if (raider.state === 'done') return;
    raider.state = 'done';
    const campId = raider.homeCampId;
    const fromX = raider.sprite.x;
    const fromY = raider.sprite.y;
    const role: import('../art/assetManifest').UnitRole =
      raider.stealKind === 'gypsy' || raider.kind === 'gypsy'
        ? 'gypsy'
        : raider.stealKind === 'thief'
          ? 'thief'
          : 'bandit';
    const kindLabel = role;
    const recovered = Math.max(
      Phase12Balance.arrestBountyGold,
      raider.carriedGold > 0
        ? raider.carriedGold
        : WarBalance.stealAmount(
            raider.stealKind === 'thief'
              ? 'thief'
              : raider.stealKind === 'gypsy' || raider.kind === 'gypsy'
                ? 'gypsy'
                : 'bandit'
          )
    );
    raider.sprite.destroy();
    this.raiders = this.raiders.filter((r) => r !== raider);
    if (campId) {
      this.encampments?.onRaiderLost(
        campId,
        raider.isGeneral,
        raider.rosterSubjectId
      );
    }
    this.scene.game.events.emit(KingdomEvents.GOLD_RECOVERED, {
      amount: recovered,
      kind: kindLabel,
    });
    this.subjects?.appendLifeLog(
      guardId,
      `Arrested a ${kindLabel} and recovered ${recovered} gold`,
      'arrest'
    );

    const hasDungeon = Boolean(this.buildings?.hasDungeon());
    let escorted = false;
    if (hasDungeon && this.onArrestIntake && guardId) {
      const captive = {
        id: `raid-arrest-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
        name: pickName(Math.floor(Math.random() * 1_000_000)),
        role,
        houseId: campId ? `camp:${campId}` : 'wild',
        maxHp: 30,
      };
      escorted = this.onArrestIntake(captive, guardId, fromX, fromY);
    }

    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: escorted
        ? `Guards arrest a ${kindLabel} — escorting to the dungeon (+${recovered}g)`
        : hasDungeon
          ? `Guards arrested a ${kindLabel} — recovered ${recovered} gold!`
          : `Guards drove off a ${kindLabel}!`,
    });
    if (!this.hasActiveRaiders()) this.endWave();
    this.onChanged?.();
  }

  private captureThiefRaider(raider: ActiveRaider): void {
    const guard = this.subjects?.nearestMilitary(
      raider.sprite.x,
      raider.sprite.y,
      CombatBalance.thiefCaptureRange * 2
    );
    this.arrestRaider(raider, guard?.data.id ?? '');
  }

  private beginRoutRaider(raider: ActiveRaider): void {
    raider.state = 'routing';
    raider.targetSubjectId = null;
    raider.targetBuildingId = null;
    raider.path = [];
    raider.pathIndex = 0;
    this.repathTo(
      raider,
      raider.homeX || this.campPoint?.x || 24,
      raider.homeY || this.campPoint?.y || 24
    );
  }

  private triggerRout(): void {
    if (this.siegePhase === 'routing') return;
    this.siegePhase = 'routing';
    if (!this.routToastShown) {
      this.routToastShown = true;
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'The attackers are routing!',
      });
    }
    for (const r of this.raiders) {
      if (r.state !== 'done') this.beginRoutRaider(r);
    }
    this.engines?.abandonAll();
  }

  private recordKill(): void {
    const t = this.elapsedMs;
    this.killTimes.push(t);
    this.killTimes = this.killTimes.filter(
      (k) => t - k <= SiegeBalance.routWindowMs
    );
    if (this.waveStartCount <= 0) return;

    const recentBurst = this.killTimes.filter(
      (k) => t - k <= SiegeBalance.routBurstWindowMs
    ).length;
    if (recentBurst >= SiegeBalance.routBurstKills) {
      this.triggerRout();
      return;
    }
    const recent = this.killTimes.length;
    if (recent / this.waveStartCount >= SiegeBalance.routLossFraction) {
      this.triggerRout();
    }
  }

  private breach(raider: ActiveRaider, building: BuildingRecord): void {
    this.faceToward(raider, building.x, building.y);
    raider.sprite.play(idleAnimKey(raider.kind), true);
    this.vfx?.meleeLunge(raider.sprite, building.x, building.y);
    this.buildings?.shakeBuilding(building.id);
    let dmg = CombatBalance.raiderBreach;
    if (raider.kind === 'giant') dmg *= CombatBalance.giantDamageMult;
    const destroyed = this.buildings?.damageBuilding(building.id, dmg);
    if (destroyed) {
      if (building.kind === 'wall') {
        this.subjects?.dropFromWall(building.id);
      }
      this.repath(raider);
      raider.state = 'pathing';
    }
  }

  private unstickRaider(raider: ActiveRaider): void {
    if (!this.pathGrid) return;
    if (!this.pathGrid.isWorldBlocked(raider.sprite.x, raider.sprite.y)) return;
    const safe = this.pathGrid.snapWorldToOpen(
      raider.sprite.x,
      raider.sprite.y
    );
    raider.sprite.setPosition(safe.x, safe.y);
    raider.sprite.setDepth(25 + safe.y * 0.01);
  }

  private stepToward(
    raider: ActiveRaider,
    tx: number,
    ty: number,
    deltaMs: number
  ): void {
    this.unstickRaider(raider);
    const dx = tx - raider.sprite.x;
    const dy = ty - raider.sprite.y;
    const dist = Math.hypot(dx, dy) || 1;
    let speed = MOVE_SPEED[raider.kind];
    if (raider.state === 'routing') speed *= 1.35;
    const step = (speed * deltaMs) / 1000;
    let nx = raider.sprite.x + (dx / dist) * Math.min(step, dist);
    let ny = raider.sprite.y + (dy / dist) * Math.min(step, dist);

    // Never step onto water / mountains / fortifications (even while fighting or routing)
    if (this.pathGrid?.isWorldBlocked(nx, ny)) {
      const path = this.pathGrid.findPath(
        { x: raider.sprite.x, y: raider.sprite.y },
        { x: tx, y: ty }
      );
      if (path && path.length > 1) {
        const wp = path[Math.min(2, path.length - 1)]!;
        const d2 =
          Math.hypot(wp.x - raider.sprite.x, wp.y - raider.sprite.y) || 1;
        nx = raider.sprite.x + ((wp.x - raider.sprite.x) / d2) * Math.min(step, d2);
        ny = raider.sprite.y + ((wp.y - raider.sprite.y) / d2) * Math.min(step, d2);
      } else {
        // Slide along the obstacle toward whichever perpendicular axis is open
        const candidates: Array<[number, number]> = [
          [raider.sprite.x + Math.sign(dx || 1) * step, raider.sprite.y],
          [raider.sprite.x, raider.sprite.y + Math.sign(dy || 1) * step],
          [raider.sprite.x - Math.sign(dx || 1) * step, raider.sprite.y],
          [raider.sprite.x, raider.sprite.y - Math.sign(dy || 1) * step],
          [
            raider.sprite.x + (-dy / dist) * step,
            raider.sprite.y + (dx / dist) * step,
          ],
          [
            raider.sprite.x - (-dy / dist) * step,
            raider.sprite.y - (dx / dist) * step,
          ],
        ];
        let slid = false;
        for (const [cx, cy] of candidates) {
          if (!this.pathGrid.isWorldBlocked(cx, cy)) {
            nx = cx;
            ny = cy;
            slid = true;
            break;
          }
        }
        if (!slid) {
          const exit = this.pathGrid.escapeLandPocket({
            x: raider.sprite.x,
            y: raider.sprite.y,
          });
          if (exit) {
            raider.sprite.setPosition(exit.x, exit.y);
            raider.sprite.setDepth(25 + exit.y * 0.01);
          }
          return;
        }
      }
      if (this.pathGrid.isWorldBlocked(nx, ny)) return;
    }

    this.faceToward(raider, tx, ty);
    const dir = facingFromDelta(nx - raider.sprite.x, ny - raider.sprite.y);
    raider.sprite.play(walkAnimKey(raider.kind, dir), true);
    raider.sprite.setPosition(nx, ny);
    raider.sprite.setDepth(25 + ny * 0.01);
  }

  private faceToward(raider: ActiveRaider, tx: number, ty: number): void {
    void facingFromDelta(tx - raider.sprite.x, ty - raider.sprite.y);
  }

  private killRaider(raider: ActiveRaider, countKill = true): void {
    if (raider.state === 'done') return;
    this.freeCarriedVictim(raider);
    raider.state = 'done';
    const campId = raider.homeCampId;
    raider.camp?.destroy();
    raider.camp = undefined;
    if (countKill) this.recordKill();
    this.scene.tweens.add({
      targets: raider.sprite,
      alpha: 0,
      duration: 280,
      onComplete: () => {
        raider.sprite.destroy();
        this.raiders = this.raiders.filter((r) => r !== raider);
        if (campId) {
          this.encampments?.onRaiderLost(
            campId,
            raider.isGeneral,
            raider.rosterSubjectId
          );
        }
        if (!this.hasActiveRaiders()) {
          this.endWave();
        }
        this.onChanged?.();
      },
    });
  }

  private endWave(): void {
    this.buildings?.setRaidActive(false);
    this.ladders.reset();
    this.ladderToastShown = false;
    this.buildings?.rebuildWallPathGrid();
    this.siegePhase = 'none';
    this.activeWaveKind = null;
    this.siegePlan = null;
    this.generalName = null;
    this.fallenKeepIds = [];
    this.replanCooldownMs = 0;
    this.engines?.clear();
  }

  private tickSiege(raider: ActiveRaider, think: boolean): void {
    if (!raider.sprite.active || raider.state === 'done') return;
    raider.state = 'sieging';
    raider.targetSubjectId = null;
    raider.targetBuildingId = null;
    this.faceToward(raider, this.keep.x, this.keep.y);
    raider.sprite.play(idleAnimKey(raider.kind), true);

    if (!this.siegeToastShown) {
      this.siegeToastShown = true;
      const focus = this.siegePlan?.focus;
      const msg =
        focus === 'weak_keep'
          ? `${this.generalName ?? 'The host'} storms the weakest keep!`
          : focus === 'soft_breach'
            ? `${this.generalName ?? 'The host'} pours through the soft approach!`
            : 'The keep is under siege!';
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: msg,
      });
    }

    if (!think) return;
    // Generals deal slightly more siege damage (ability)
    let dmg: number = CombatBalance.raiderSiege;
    if (raider.isGeneral) dmg = Math.floor(dmg * 1.35);

    const keepId = this.siegePlan?.keepId ?? KEEP_ID;
    const destroyed = this.buildings?.damageKeepTarget(keepId, dmg);
    if (destroyed) {
      this.triggerGameOver();
    }
  }

  private captureRoyal(subjectId: string): void {
    const managed = this.subjects?.getById(subjectId);
    if (!managed) return;
    this.scene.game.events.emit(KingdomEvents.ROYAL_CAPTURED, {
      id: managed.data.id,
      name: managed.data.name,
      role: managed.data.role,
      houseId: managed.data.houseId,
      maxHp: managed.data.maxHp,
    });
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${managed.data.name} was captured for ransom!`,
    });
  }

  private onReachedKeep(raider: ActiveRaider): void {
    if (!raider.sprite.active || raider.state === 'done') return;
    if (raider.kind === 'enemy_army') return;
    if (raider.looted || raider.state === 'retreating') return;
    // Giants never steal gold — they hunt villagers instead
    if (raider.kind === 'giant') return;

    const stealKey: StealKind =
      raider.stealKind ??
      (raider.kind === 'goblin' ? 'goblin' : 'bandit');
    let amount = WarBalance.stealAmount(stealKey);
    if (this.buildings?.hasTavern()) {
      amount = Math.max(1, Math.floor(amount * 0.75));
    }
    const label =
      stealKey === 'thief'
        ? 'Thieves'
        : stealKey === 'goblin'
          ? 'Goblins'
          : 'Bandits';
    this.scene.game.events.emit(KingdomEvents.GOLD_STOLEN, {
      amount,
      kind: stealKey,
      label,
    });

    raider.carriedGold = amount;
    raider.looted = true;
    raider.state = 'retreating';
    raider.targetSubjectId = null;
    raider.targetBuildingId = null;
    raider.path = [];
    raider.pathIndex = 0;
    this.repathTo(raider, raider.homeX, raider.homeY);
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${label} flee home with the gold!`,
    });
  }

  private triggerGameOver(): void {
    if (this.gameOver) return;
    this.gameOver = true;
    for (const r of this.raiders) {
      if (r.sprite.active) {
        r.sprite.play(idleAnimKey(r.kind));
        r.state = 'done';
      }
    }
    this.scene.game.events.emit(KingdomEvents.GAME_OVER, {
      reason:
        'A rival kingdom’s army destroyed every keep. Your kingdom has fallen.',
    });
  }
}

function facingFromDelta(dx: number, dy: number): Direction {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx < 0 ? 'left' : 'right';
  }
  return dy < 0 ? 'up' : 'down';
}
