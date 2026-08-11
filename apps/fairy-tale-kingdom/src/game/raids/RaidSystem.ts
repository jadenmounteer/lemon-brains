import Phaser from 'phaser';
import {
  idleAnimKey,
  walkAnimKey,
  type Direction,
  type EnemyRole,
} from '../art/assetManifest';
import type { BuildingRecord, BuildingSystem } from '../buildings/BuildingSystem';
import { CombatBalance, RAIDER_MAX_HP } from '../combat/stats';
import type { PathGrid } from '../path/PathGrid';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import { KingdomEvents } from '../subjects/events';

export interface KeepPoint {
  x: number;
  y: number;
}

type RaidKind = EnemyRole;

type RaiderState = 'pathing' | 'fighting' | 'breaching' | 'burning' | 'done';

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
  private onChanged: (() => void) | null = null;

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

  setOnChanged(cb: () => void): void {
    this.onChanged = cb;
  }

  get isGameOver(): boolean {
    return this.gameOver;
  }

  hasActiveRaiders(): boolean {
    return this.raiders.some((r) => r.state !== 'done' && r.sprite.active);
  }

  nearestRaider(
    x: number,
    y: number,
    radius: number
  ): ActiveRaider | null {
    let best: ActiveRaider | null = null;
    let bestD = radius;
    for (const r of this.raiders) {
      if (!r.sprite.active || r.state === 'done') continue;
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
    const mult = raider.kind === 'giant' ? 1 : 1;
    raider.hp = Math.max(0, raider.hp - amount * mult);
    const ratio = raider.hp / raider.maxHp;
    if (ratio <= 0.35) raider.sprite.setTint(0xff6666);
    if (raider.hp <= 0) {
      this.killRaider(raider);
      return true;
    }
    return false;
  }

  update(deltaMs: number): void {
    if (this.gameOver) return;

    this.elapsedMs += deltaMs;
    if (this.elapsedMs >= this.nextRaidAt) {
      this.nextRaidAt = this.elapsedMs + RAID_INTERVAL_MS;
      this.spawnRaid();
    }

    for (const raider of [...this.raiders]) {
      if (!raider.sprite.active || raider.state === 'done') continue;
      this.tickRaider(raider, deltaMs);
    }
  }

  clear(): void {
    for (const r of this.raiders) {
      r.camp?.destroy();
      r.sprite.destroy();
    }
    this.raiders = [];
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

    this.scene.game.events.emit(KingdomEvents.RAID_WARNING, {
      kind,
      label: LABELS[kind],
    });

    this.buildings?.setRaidActive(true);

    const edge = this.randomEdgeSpawn();
    const camp = this.scene.add
      .circle(edge.x, edge.y, 10, 0x6b3e2e, 0.55)
      .setStrokeStyle(1, 0x1c241c)
      .setDepth(5);

    for (let i = 0; i < count; i++) {
      const ox = edge.x + Phaser.Math.Between(-20, 20);
      const oy = edge.y + Phaser.Math.Between(-20, 20);
      this.launchRaider(kind, ox, oy, i === 0 ? camp : undefined);
    }
  }

  private launchRaider(
    kind: RaidKind,
    x: number,
    y: number,
    camp?: Phaser.GameObjects.Arc
  ): void {
    const sprite = this.scene.add.sprite(x, y, kind, 0);
    sprite.setDepth(25);
    sprite.setOrigin(0.5, 1);
    if (kind === 'giant') {
      sprite.setScale(1.4);
    }
    sprite.play(idleAnimKey(kind));

    const maxHp = RAIDER_MAX_HP[kind];
    const raider: ActiveRaider = {
      kind,
      sprite,
      hp: maxHp,
      maxHp,
      path: [],
      pathIndex: 0,
      state: 'pathing',
      targetSubjectId: null,
      targetBuildingId: null,
      thinkAccumMs: 0,
      camp,
    };
    this.raiders.push(raider);
    this.repath(raider);
  }

  private tickRaider(raider: ActiveRaider, deltaMs: number): void {
    raider.thinkAccumMs += deltaMs;
    const think = raider.thinkAccumMs >= CombatBalance.tickMs;
    if (think) raider.thinkAccumMs = 0;

    if (
      Phaser.Math.Distance.Between(
        raider.sprite.x,
        raider.sprite.y,
        this.keep.x,
        this.keep.y
      ) < KEEP_REACH_PX
    ) {
      this.onReachedKeep(raider);
      return;
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
        const burn = this.buildings?.burnablesNear(
          raider.sprite.x,
          raider.sprite.y,
          CombatBalance.pillageRadius
        );
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
          let dmg = CombatBalance.raiderMelee;
          if (raider.kind === 'giant') dmg *= CombatBalance.giantDamageMult;
          this.subjects?.damageSubject(target.data.id, dmg);
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
          b.sprite.setTint(0xff5522);
          let dmg = CombatBalance.raiderBurn;
          if (raider.kind === 'giant') dmg *= CombatBalance.giantDamageMult;
          const destroyed = this.buildings?.damageBuilding(b.id, dmg);
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

    // Path / breach
    if (!raider.path.length || raider.pathIndex >= raider.path.length) {
      this.repath(raider);
    }

    if (!raider.path.length) {
      // Completely blocked — breach nearest wall/bridge ahead
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

    // If next step is into a blocker (grid stale), breach
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

  private breach(raider: ActiveRaider, building: BuildingRecord): void {
    this.faceToward(raider, building.x, building.y);
    raider.sprite.play(idleAnimKey(raider.kind), true);
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
    const speed = MOVE_SPEED[raider.kind];
    const step = (speed * deltaMs) / 1000;
    const nx = raider.sprite.x + (dx / dist) * Math.min(step, dist);
    const ny = raider.sprite.y + (dy / dist) * Math.min(step, dist);
    this.faceToward(raider, tx, ty);
    const dir = facingFromDelta(dx, dy);
    raider.sprite.play(walkAnimKey(raider.kind, dir), true);
    raider.sprite.setPosition(nx, ny);
    raider.sprite.setDepth(25 + ny * 0.01);
  }

  private faceToward(raider: ActiveRaider, tx: number, ty: number): void {
    void facingFromDelta(tx - raider.sprite.x, ty - raider.sprite.y);
  }

  private killRaider(raider: ActiveRaider): void {
    raider.state = 'done';
    raider.camp?.destroy();
    raider.camp = undefined;
    this.scene.tweens.add({
      targets: raider.sprite,
      alpha: 0,
      duration: 280,
      onComplete: () => {
        raider.sprite.destroy();
        this.raiders = this.raiders.filter((r) => r !== raider);
        if (!this.hasActiveRaiders()) {
          this.buildings?.setRaidActive(false);
        }
        this.onChanged?.();
      },
    });
  }

  private onReachedKeep(raider: ActiveRaider): void {
    if (!raider.sprite.active || raider.state === 'done') return;

    if (raider.kind === 'enemy_army') {
      this.triggerGameOver();
      return;
    }

    let amount = STEAL_AMOUNTS[raider.kind];
    if (this.buildings?.hasTavern()) {
      amount = Math.max(1, Math.floor(amount * 0.75));
    }
    this.scene.game.events.emit(KingdomEvents.GOLD_STOLEN, {
      amount,
      kind: raider.kind,
      label: LABELS[raider.kind],
    });

    this.killRaider(raider);
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
        'A rival kingdom’s army stormed your keep. Your kingdom has fallen.',
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
