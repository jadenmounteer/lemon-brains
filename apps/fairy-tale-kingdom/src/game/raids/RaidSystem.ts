import Phaser from 'phaser';
import {
  idleAnimKey,
  walkAnimKey,
  type Direction,
  type EnemyRole,
} from '../art/assetManifest';
import { isRoyalRole } from '../art/assetManifest';
import type { BuildingRecord, BuildingSystem } from '../buildings/BuildingSystem';
import { CombatBalance, RAIDER_MAX_HP } from '../combat/stats';
import type { PathGrid } from '../path/PathGrid';
import { SiegeBalance } from '../siege/balance';
import type { SiegeEngineSystem } from '../siege/SiegeEngineSystem';
import type { SiegeVfx } from '../siege/SiegeVfx';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import { KingdomEvents } from '../subjects/events';

export interface KeepPoint {
  x: number;
  y: number;
}

type RaidKind = EnemyRole;

type RaiderState =
  | 'pathing'
  | 'fighting'
  | 'breaching'
  | 'burning'
  | 'sieging'
  | 'investing'
  | 'routing'
  | 'done';

export type SiegePhase = 'none' | 'muster' | 'reduce' | 'storm' | 'routing';

export interface ActiveRaider {
  kind: RaidKind;
  sprite: Phaser.GameObjects.Sprite;
  hp: number;
  maxHp: number;
  path: { x: number; y: number }[];
  pathIndex: number;
  state: RaiderState;
  targetSubjectId: string | null;
  targetBuildingId: string | null;
  thinkAccumMs: number;
  camp?: Phaser.GameObjects.Arc;
  investX?: number;
  investY?: number;
}

const STEAL_AMOUNTS: Record<Exclude<RaidKind, 'enemy_army'>, number> = {
  bandit: 5,
  giant: 12,
};

const LABELS: Record<RaidKind, string> = {
  bandit: 'Bandits',
  giant: 'Giants',
  enemy_army: 'a rival kingdom’s army',
};

const GRACE_MS = 40_000;
const RAID_INTERVAL_MS = 55_000;
const KEEP_REACH_PX = 28;
const MOVE_SPEED: Record<RaidKind, number> = {
  bandit: 42,
  giant: 28,
  enemy_army: 36,
};

export class RaidSystem {
  private raiders: ActiveRaider[] = [];
  private elapsedMs = 0;
  private nextRaidAt = GRACE_MS;
  private gameOver = false;
  private raidCount = 0;
  private buildings: BuildingSystem | null = null;
  private subjects: SubjectSystem | null = null;
  private pathGrid: PathGrid | null = null;
  private engines: SiegeEngineSystem | null = null;
  private vfx: SiegeVfx | null = null;
  private onChanged: (() => void) | null = null;
  private siegeToastShown = false;
  private siegePhase: SiegePhase = 'none';
  private musterMs = 0;
  private waveStartCount = 0;
  private killTimes: number[] = [];
  private routToastShown = false;
  private activeWaveKind: RaidKind | null = null;
  private campPoint: KeepPoint | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: { width: number; height: number },
    private readonly keep: KeepPoint
  ) {}

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
  }

  setOnChanged(cb: () => void): void {
    this.onChanged = cb;
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
      if (!r.sprite.active || r.state === 'done' || r.state === 'routing') continue;
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

    const active = this.buildings?.getActiveKeepPoint();
    if (active) {
      this.keep.x = active.x;
      this.keep.y = active.y;
      this.engines?.setKeep(active);
    }

    this.elapsedMs += deltaMs;
    if (this.elapsedMs >= this.nextRaidAt) {
      this.nextRaidAt = this.elapsedMs + RAID_INTERVAL_MS;
      this.spawnRaid();
    }

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

  private spawnRaid(): void {
    this.raidCount += 1;
    const army =
      this.raidCount >= 3 &&
      (this.raidCount % 3 === 0 || Math.random() < 0.25);
    const kind: RaidKind = army
      ? 'enemy_army'
      : Math.random() < 0.4
        ? 'giant'
        : 'bandit';

    const count =
      kind === 'enemy_army' ? Phaser.Math.Between(3, 5) : Phaser.Math.Between(1, 2);

    const edge = this.randomEdgeSpawn();
    this.campPoint = edge;
    this.activeWaveKind = kind;
    this.waveStartCount = count;
    this.killTimes = [];
    this.routToastShown = false;
    this.siegeToastShown = false;

    let label = LABELS[kind];
    if (kind === 'enemy_army') {
      this.siegePhase = 'muster';
      this.musterMs = 0;
      this.engines?.spawnForRaid(this.raidCount, edge.x, edge.y);
      const eng = this.engines?.countAlive() ?? 0;
      this.waveStartCount = count + eng;
      label = `a siege host (${count} infantry${eng ? `, ${eng} engines` : ''})`;
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'A siege host approaches!',
      });
    } else {
      this.siegePhase = 'none';
    }

    this.scene.game.events.emit(KingdomEvents.RAID_WARNING, {
      kind,
      label,
    });

    this.buildings?.setRaidActive(true);

    const camp = this.scene.add
      .circle(edge.x, edge.y, 10, 0x6b3e2e, 0.55)
      .setStrokeStyle(1, 0x1c241c)
      .setDepth(5);

    for (let i = 0; i < count; i++) {
      const ox = edge.x + Phaser.Math.Between(-20, 20);
      const oy = edge.y + Phaser.Math.Between(-20, 20);
      this.launchRaider(kind, ox, oy, i === 0 ? camp : undefined, i, count);
    }
  }

  private launchRaider(
    kind: RaidKind,
    x: number,
    y: number,
    camp?: Phaser.GameObjects.Arc,
    index = 0,
    total = 1
  ): void {
    const sprite = this.scene.add.sprite(x, y, kind, 0);
    sprite.setDepth(25);
    sprite.setOrigin(0.5, 1);
    if (kind === 'giant') {
      sprite.setScale(1.4);
    }
    sprite.play(idleAnimKey(kind));

    const maxHp = RAIDER_MAX_HP[kind];
    const invest = this.investPoint(index, total);
    const raider: ActiveRaider = {
      kind,
      sprite,
      hp: maxHp,
      maxHp,
      path: [],
      pathIndex: 0,
      state: kind === 'enemy_army' ? 'investing' : 'pathing',
      targetSubjectId: null,
      targetBuildingId: null,
      thinkAccumMs: 0,
      camp,
      investX: invest.x,
      investY: invest.y,
    };
    this.raiders.push(raider);
    if (kind !== 'enemy_army') this.repath(raider);
  }

  private investPoint(index: number, total: number): KeepPoint {
    const camp = this.campPoint ?? { x: 40, y: 40 };
    const dx = this.keep.x - camp.x;
    const dy = this.keep.y - camp.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    // Line outside walls toward keep
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

    if (this.siegePhase === 'routing') {
      this.beginRoutRaider(raider);
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
            SiegeBalance.fieldBurnPriorityRadius
          );
        }
        if (!burn) {
          burn = this.buildings?.burnablesNear(
            raider.sprite.x,
            raider.sprite.y,
            CombatBalance.pillageRadius
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
            let dmg = CombatBalance.raiderMelee;
            if (raider.kind === 'giant') dmg *= CombatBalance.giantDamageMult;
            this.subjects?.damageSubject(target.data.id, dmg);
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
          let dmg = CombatBalance.raiderBurn;
          if (raider.kind === 'giant') dmg *= CombatBalance.giantDamageMult;
          const destroyed = this.buildings?.damageBuilding(b.id, dmg, {
            fire: true,
          });
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
      } else {
        this.stepToward(raider, this.keep.x, this.keep.y + 20, deltaMs);
      }
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

    // Hold line; help breach nearest fortification in reduce
    if (this.siegePhase === 'reduce' && think) {
      const fort = this.buildings?.nearestFortification(
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

  private tickRouting(raider: ActiveRaider, deltaMs: number): void {
    const edge = this.campPoint ?? { x: 24, y: 24 };
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
    // Faster flee
    this.stepToward(raider, edge.x, edge.y, deltaMs * 1.45);
    raider.sprite.setTint(0xaaaaaa);
  }

  private beginRoutRaider(raider: ActiveRaider): void {
    raider.state = 'routing';
    raider.targetSubjectId = null;
    raider.targetBuildingId = null;
    raider.path = [];
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

  private repath(raider: ActiveRaider): void {
    if (!this.pathGrid) {
      raider.path = [{ x: this.keep.x, y: this.keep.y + 20 }];
      raider.pathIndex = 0;
      return;
    }
    const path = this.pathGrid.findPath(
      { x: raider.sprite.x, y: raider.sprite.y },
      { x: this.keep.x, y: this.keep.y + 20 }
    );
    raider.path = path ?? [];
    raider.pathIndex = 0;
  }

  private stepToward(
    raider: ActiveRaider,
    tx: number,
    ty: number,
    deltaMs: number
  ): void {
    const dx = tx - raider.sprite.x;
    const dy = ty - raider.sprite.y;
    const dist = Math.hypot(dx, dy) || 1;
    let speed = MOVE_SPEED[raider.kind];
    if (raider.state === 'routing') speed *= 1.35;
    const step = (speed * deltaMs) / 1000;
    let nx = raider.sprite.x + (dx / dist) * Math.min(step, dist);
    let ny = raider.sprite.y + (dy / dist) * Math.min(step, dist);

    // Respect walls for ground movement (raiders already path; this catches fights)
    if (
      this.pathGrid?.isWorldBlocked(nx, ny) &&
      raider.state !== 'breaching' &&
      raider.state !== 'routing'
    ) {
      const path = this.pathGrid.findPath(
        { x: raider.sprite.x, y: raider.sprite.y },
        { x: tx, y: ty }
      );
      if (path && path.length > 1) {
        const wp = path[1]!;
        const d2 =
          Math.hypot(wp.x - raider.sprite.x, wp.y - raider.sprite.y) || 1;
        nx = raider.sprite.x + ((wp.x - raider.sprite.x) / d2) * Math.min(step, d2);
        ny = raider.sprite.y + ((wp.y - raider.sprite.y) / d2) * Math.min(step, d2);
      }
    }

    this.faceToward(raider, tx, ty);
    const dir = facingFromDelta(dx, dy);
    raider.sprite.play(walkAnimKey(raider.kind, dir), true);
    raider.sprite.setPosition(nx, ny);
    raider.sprite.setDepth(25 + ny * 0.01);
  }

  private faceToward(raider: ActiveRaider, tx: number, ty: number): void {
    void facingFromDelta(tx - raider.sprite.x, ty - raider.sprite.y);
  }

  private killRaider(raider: ActiveRaider, countKill = true): void {
    if (raider.state === 'done') return;
    raider.state = 'done';
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
        if (!this.hasActiveRaiders()) {
          this.endWave();
        }
        this.onChanged?.();
      },
    });
  }

  private endWave(): void {
    this.buildings?.setRaidActive(false);
    this.siegePhase = 'none';
    this.activeWaveKind = null;
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
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'The keep is under siege!',
      });
    }

    if (!think) return;
    const destroyed = this.buildings?.damageKeep(CombatBalance.raiderSiege);
    if (destroyed) {
      this.triggerGameOver();
    }
  }

  private captureRoyal(subjectId: string): void {
    const saved = this.subjects?.extractCaptive(subjectId);
    if (!saved) return;
    this.scene.game.events.emit(KingdomEvents.ROYAL_CAPTURED, {
      id: saved.id,
      name: saved.name,
      role: saved.role,
      houseId: saved.houseId,
      maxHp: saved.maxHp,
    });
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${saved.name} was captured for ransom!`,
    });
  }

  private onReachedKeep(raider: ActiveRaider): void {
    if (!raider.sprite.active || raider.state === 'done') return;
    if (raider.kind === 'enemy_army') return;

    let amount = STEAL_AMOUNTS[raider.kind];
    if (this.buildings?.hasTavern()) {
      amount = Math.max(1, Math.floor(amount * 0.75));
    }
    this.scene.game.events.emit(KingdomEvents.GOLD_STOLEN, {
      amount,
      kind: raider.kind,
      label: LABELS[raider.kind],
    });

    this.killRaider(raider, false);
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

  private randomEdgeSpawn(): { x: number; y: number } {
    const pad = 24;
    const side = Phaser.Math.Between(0, 3);
    switch (side) {
      case 0:
        return { x: Phaser.Math.Between(pad, this.world.width - pad), y: pad };
      case 1:
        return {
          x: Phaser.Math.Between(pad, this.world.width - pad),
          y: this.world.height - pad,
        };
      case 2:
        return { x: pad, y: Phaser.Math.Between(pad, this.world.height - pad) };
      default:
        return {
          x: this.world.width - pad,
          y: Phaser.Math.Between(pad, this.world.height - pad),
        };
    }
  }
}

function facingFromDelta(dx: number, dy: number): Direction {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx < 0 ? 'left' : 'right';
  }
  return dy < 0 ? 'up' : 'down';
}
