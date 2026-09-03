import Phaser from 'phaser';
import { idleAnimKey, type UnitRole } from '../art/assetManifest';
import type { CaptiveRecord } from '../../kingdom/CaptivesRepository';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import {
  DUNGEON_CELL_COUNT,
  dungeonCellPoint,
  dungeonGatePoint,
  dungeonPatrolPoint,
} from '../buildings/layouts/DungeonLayout';
import { KingdomEvents } from '../subjects/events';
import type { SubjectSystem } from '../subjects/SubjectSystem';

interface EscortState {
  guardId: string;
  captive: CaptiveRecord;
  sprite: Phaser.GameObjects.Sprite;
  dungeonId: string;
  cellIndex: number;
}

type HangStage = 'march' | 'hang';

interface HangState {
  captiveId: string;
  captiveName: string;
  sprite: Phaser.GameObjects.Sprite;
  execId: string;
  stage: HangStage;
  remainingMs: number;
  gallowsX: number;
  gallowsY: number;
}

export interface DungeonLifeDeps {
  getCaptives: () => CaptiveRecord[];
  addCaptive: (c: CaptiveRecord) => void;
  removeCaptive: (id: string) => void;
}

/** Visible captives, guard escorts, corridor patrol, and gallows hang VFX. */
export class DungeonLifeSystem {
  private escorts: EscortState[] = [];
  private hangs: HangState[] = [];
  private cellByCaptive = new Map<string, number>();
  private cellSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private patrolIdx = new Map<string, number>();
  private patrolMs = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly subjects: SubjectSystem,
    private readonly buildings: BuildingSystem,
    private readonly deps: DungeonLifeDeps
  ) {}

  capacity(): number {
    return DUNGEON_CELL_COUNT;
  }

  prisonerCount(): number {
    return this.deps.getCaptives().length;
  }

  /** Occupied cells including escorts still en route. */
  occupiedCells(): number {
    return this.deps.getCaptives().length + this.escorts.length;
  }

  freeCells(): number {
    return Math.max(0, DUNGEON_CELL_COUNT - this.occupiedCells());
  }

  hasFreeCell(): boolean {
    return this.freeCells() > 0;
  }

  /** Guard escorts a new captive to the nearest dungeon. */
  requestIntake(
    captive: CaptiveRecord,
    opts?: { guardId?: string; fromX?: number; fromY?: number }
  ): boolean {
    if (!this.buildings.hasDungeon()) {
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'Need a dungeon to hold captives',
      });
      return false;
    }
    if (!this.hasFreeCell()) {
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'Dungeon full — justice awaits at the gallows',
      });
      return false;
    }

    const dungeon = this.nearestDungeon(opts?.fromX, opts?.fromY);
    if (!dungeon) return false;

    const guard =
      (opts?.guardId ? this.subjects.getById(opts.guardId) : null) ??
      this.subjects.nearestMilitary(
        opts?.fromX ?? dungeon.x,
        opts?.fromY ?? dungeon.y,
        280
      );
    if (!guard) {
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'No guard nearby to escort the prisoner',
      });
      return false;
    }

    const cellIndex = this.nextOpenCell();
    const startX = opts?.fromX ?? guard.sprite.x;
    const startY = opts?.fromY ?? guard.sprite.y;
    const tex = captiveTextureKey(captive.role);
    const sprite = this.scene.add
      .sprite(startX, startY, tex)
      .setDepth(12 + startY * 0.01)
      .setOrigin(0.5, 1)
      .setAlpha(0.88)
      .setTint(0xcccccc);
    sprite.play(idleAnimKey(tex), true);

    guard.interrupt = {
      kind: 'escort_captive',
      targetId: captive.id,
      remainingMs: 45_000,
    };
    guard.data.activity = 'patrol';
    guard.data.activityLabel = `Escorting ${captive.name} to the dungeon`;

    this.escorts.push({
      guardId: guard.data.id,
      captive,
      sprite,
      dungeonId: dungeon.id,
      cellIndex,
    });

    // First path request — tickEscorts only re-nudges when idle.
    const gate = dungeonGatePoint(dungeon);
    this.subjects.nudgeToward(guard.data.id, gate.x, gate.y, 52);

    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${guard.data.name} escorts ${captive.name} to the dungeon`,
    });
    return true;
  }

  /**
   * Executioner leads the condemned from the dungeon to the gallows,
   * then plays a hang bob VFX.
   */
  beginHang(captive: CaptiveRecord): boolean {
    const gallows = this.buildings.serialize().find((b) => b.kind === 'gallows');
    const exec = this.subjects.firstByRole('executioner');
    if (!gallows || !exec) return false;

    let sprite = this.cellSprites.get(captive.id);
    if (sprite) {
      this.cellSprites.delete(captive.id);
      this.cellByCaptive.delete(captive.id);
    } else {
      const dungeon = this.nearestDungeon();
      const gate = dungeon
        ? dungeonGatePoint(dungeon)
        : { x: gallows.x, y: gallows.y + 24 };
      const tex = captiveTextureKey(captive.role);
      sprite = this.scene.add
        .sprite(gate.x, gate.y, tex)
        .setDepth(14)
        .setOrigin(0.5, 1)
        .setAlpha(0.88)
        .setTint(0xcccccc);
      sprite.play(idleAnimKey(tex), true);
    }

    const gx = gallows.x;
    const gy = gallows.y + 18;

    this.hangs.push({
      captiveId: captive.id,
      captiveName: captive.name,
      sprite,
      execId: exec.data.id,
      stage: 'march',
      remainingMs: 20_000,
      gallowsX: gx,
      gallowsY: gy,
    });

    exec.interrupt = {
      kind: 'execute',
      targetId: captive.id,
      remainingMs: 20_000,
    };
    exec.data.activityLabel = `Leading ${captive.name} to the gallows`;
    this.subjects.nudgeToward(exec.data.id, gx, gy, 48);

    // Remove from roster immediately so they can't be ransomed mid-march.
    this.deps.removeCaptive(captive.id);
    return true;
  }

  /** Place sprites for captives loaded from save. */
  syncCaptives(): void {
    const captives = this.deps.getCaptives();
    const ids = new Set(captives.map((c) => c.id));

    for (const [id, sprite] of [...this.cellSprites]) {
      if (!ids.has(id)) {
        sprite.destroy();
        this.cellSprites.delete(id);
        this.cellByCaptive.delete(id);
      }
    }

    const dungeon = this.nearestDungeon();
    if (!dungeon) return;

    captives.forEach((c, i) => {
      if (
        this.cellSprites.has(c.id) ||
        this.escorts.some((e) => e.captive.id === c.id) ||
        this.hangs.some((h) => h.captiveId === c.id)
      ) {
        return;
      }
      const cellIndex = this.cellByCaptive.get(c.id) ?? i % DUNGEON_CELL_COUNT;
      this.cellByCaptive.set(c.id, cellIndex);
      const pt = dungeonCellPoint(dungeon, cellIndex, c.id);
      const tex = captiveTextureKey(c.role);
      const sprite = this.scene.add
        .sprite(pt.x, pt.y, tex)
        .setDepth(10 + pt.y * 0.01)
        .setOrigin(0.5, 1)
        .setAlpha(0.88)
        .setTint(0xcccccc);
      sprite.play(idleAnimKey(tex), true);
      this.cellSprites.set(c.id, sprite);
    });
  }

  update(deltaMs: number): void {
    this.tickEscorts();
    this.tickHangs(deltaMs);
    this.tickPatrol(deltaMs);
  }

  clear(): void {
    for (const s of this.cellSprites.values()) s.destroy();
    for (const e of this.escorts) e.sprite.destroy();
    for (const h of this.hangs) h.sprite.destroy();
    this.cellSprites.clear();
    this.cellByCaptive.clear();
    this.escorts = [];
    this.hangs = [];
  }

  private tickEscorts(): void {
    for (const escort of [...this.escorts]) {
      const guard = this.subjects.getById(escort.guardId);
      const dungeon = this.buildings.getById(escort.dungeonId);
      if (!guard || !dungeon || !guard.sprite.active) {
        // Guard lost — still imprison if we can, else drop the escort sprite.
        if (dungeon && this.hasFreeCell()) {
          this.deps.addCaptive(escort.captive);
          this.parkInCell(escort.captive, dungeon, escort.cellIndex, escort.sprite);
        } else {
          escort.sprite.destroy();
        }
        this.escorts = this.escorts.filter((e) => e !== escort);
        continue;
      }

      const gate = dungeonGatePoint(dungeon);
      const dist = Phaser.Math.Distance.Between(
        guard.sprite.x,
        guard.sprite.y,
        gate.x,
        gate.y
      );

      // Trail behind the guard (starts at arrest site, then follows).
      const trailX = guard.sprite.x - 12;
      const trailY = guard.sprite.y + 4;
      escort.sprite.x = Phaser.Math.Linear(escort.sprite.x, trailX, 0.22);
      escort.sprite.y = Phaser.Math.Linear(escort.sprite.y, trailY, 0.22);
      escort.sprite.setDepth(12 + escort.sprite.y * 0.01);

      if (dist > 22) {
        if (!guard.moving) {
          this.subjects.nudgeToward(guard.data.id, gate.x, gate.y, 52);
        }
        guard.data.activityLabel = `Escorting ${escort.captive.name} to the dungeon`;
      } else {
        this.deps.addCaptive(escort.captive);
        this.parkInCell(escort.captive, dungeon, escort.cellIndex, escort.sprite);
        this.subjects.clearInterrupt(guard.data.id);
        guard.data.activityLabel = 'Prisoner secured in the dungeon';
        this.escorts = this.escorts.filter((e) => e !== escort);
        this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
          message: `${escort.captive.name} is locked in a cell`,
        });
        this.scene.game.events.emit(KingdomEvents.CAPTIVES_CHANGED, {
          count: this.deps.getCaptives().length,
        });
      }
    }
  }

  private parkInCell(
    captive: CaptiveRecord,
    dungeon: { x: number; y: number },
    cellIndex: number,
    sprite: Phaser.GameObjects.Sprite
  ): void {
    this.cellByCaptive.set(captive.id, cellIndex);
    const cell = dungeonCellPoint(dungeon, cellIndex, captive.id);
    sprite.setPosition(cell.x, cell.y);
    sprite.setDepth(10 + cell.y * 0.01);
    this.cellSprites.set(captive.id, sprite);
  }

  private tickHangs(deltaMs: number): void {
    for (const hang of [...this.hangs]) {
      hang.remainingMs -= deltaMs;
      const exec = this.subjects.getById(hang.execId);

      if (hang.stage === 'march') {
        if (!exec || !exec.sprite.active) {
          hang.sprite.destroy();
          this.hangs = this.hangs.filter((h) => h !== hang);
          continue;
        }

        const dist = Phaser.Math.Distance.Between(
          exec.sprite.x,
          exec.sprite.y,
          hang.gallowsX,
          hang.gallowsY
        );
        if (dist > 28 && !exec.moving) {
          this.subjects.nudgeToward(
            exec.data.id,
            hang.gallowsX,
            hang.gallowsY,
            48
          );
        }

        // Prisoner marches behind the executioner toward the gallows.
        const trailX = exec.sprite.x - 10;
        const trailY = exec.sprite.y + 4;
        hang.sprite.x = Phaser.Math.Linear(hang.sprite.x, trailX, 0.2);
        hang.sprite.y = Phaser.Math.Linear(hang.sprite.y, trailY, 0.2);
        hang.sprite.setDepth(14 + hang.sprite.y * 0.01);
        exec.data.activityLabel = `Leading ${hang.captiveName} to the gallows`;

        if (dist <= 28) {
          hang.stage = 'hang';
          hang.remainingMs = 3400;
          hang.sprite.setPosition(hang.gallowsX, hang.gallowsY - 10);
          hang.sprite.setAngle(0);
          this.subjects.appendLifeLog(
            exec.data.id,
            `Executed ${hang.captiveName}`,
            'execute'
          );
          this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
            message: `${hang.captiveName} hangs at the gallows`,
          });
        } else if (hang.remainingMs <= 0) {
          // Timed out — snap to hang
          hang.stage = 'hang';
          hang.remainingMs = 2800;
          hang.sprite.setPosition(hang.gallowsX, hang.gallowsY - 10);
        }
        continue;
      }

      // Hang VFX
      hang.sprite.setPosition(
        hang.gallowsX,
        hang.gallowsY - 10 - Math.sin(hang.remainingMs / 200) * 2
      );
      hang.sprite.setAngle(Math.sin(hang.remainingMs / 150) * 8);

      if (hang.remainingMs <= 0) {
        hang.sprite.destroy();
        if (exec) {
          this.subjects.clearInterrupt(exec.data.id);
          exec.data.activityLabel = 'Justice is done';
        }
        this.hangs = this.hangs.filter((h) => h !== hang);
      }
    }
  }

  private tickPatrol(deltaMs: number): void {
    this.patrolMs -= deltaMs;
    if (this.patrolMs > 0) return;
    this.patrolMs = 4800 + Math.random() * 3200;

    const dungeon = this.nearestDungeon();
    if (!dungeon) return;

    const patrolRoles = new Set(['dungeon_keeper', 'guard', 'soldier']);
    const inside = this.subjects
      .listManaged()
      .filter(
        (s) =>
          s.sprite.active &&
          !s.moving &&
          !s.interrupt &&
          s.data.zone === 'dungeon' &&
          patrolRoles.has(s.data.role)
      );
    if (inside.length === 0) return;

    const actor = inside[Math.floor(Math.random() * inside.length)]!;
    const idx = this.patrolIdx.get(actor.data.id) ?? 0;
    const pt = dungeonPatrolPoint(dungeon, idx, actor.data.id);
    this.patrolIdx.set(actor.data.id, idx + 1);
    this.subjects.nudgeToward(actor.data.id, pt.x, pt.y, 32);
    actor.data.activityLabel = 'Patrolling the dungeon corridor';
  }

  private nearestDungeon(
    x?: number,
    y?: number
  ): { id: string; x: number; y: number } | null {
    const list = this.buildings.list().filter((b) => b.kind === 'dungeon' && b.hp > 0);
    if (list.length === 0) return null;
    const refX = x ?? this.buildings.getActiveKeepPoint().x;
    const refY = y ?? this.buildings.getActiveKeepPoint().y;
    let best = list[0]!;
    let bestD = Infinity;
    for (const b of list) {
      const d = Phaser.Math.Distance.Between(refX, refY, b.x, b.y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  private nextOpenCell(): number {
    const used = new Set(this.cellByCaptive.values());
    for (const e of this.escorts) used.add(e.cellIndex);
    for (let i = 0; i < DUNGEON_CELL_COUNT; i++) {
      if (!used.has(i)) return i;
    }
    return 0;
  }
}

function captiveTextureKey(role: UnitRole): UnitRole {
  if (role === 'thief' || role === 'gypsy') return 'bandit';
  return role === 'bandit' ? 'bandit' : role;
}
