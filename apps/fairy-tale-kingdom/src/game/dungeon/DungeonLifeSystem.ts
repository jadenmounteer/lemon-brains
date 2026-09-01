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

interface HangState {
  captiveId: string;
  sprite: Phaser.GameObjects.Sprite;
  execId: string;
  remainingMs: number;
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

  freeCells(): number {
    return Math.max(
      0,
      DUNGEON_CELL_COUNT - this.deps.getCaptives().length - this.escorts.length
    );
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
        220
      );
    if (!guard) {
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'No guard nearby to escort the prisoner',
      });
      return false;
    }

    const cellIndex = this.nextOpenCell();
    const tex = captiveTextureKey(captive.role);
    const sprite = this.scene.add
      .sprite(
        opts?.fromX ?? guard.sprite.x,
        opts?.fromY ?? guard.sprite.y,
        tex
      )
      .setDepth(12 + guard.sprite.y * 0.01)
      .setOrigin(0.5, 1)
      .setAlpha(0.88)
      .setTint(0xcccccc);
    sprite.play(idleAnimKey(tex), true);

    guard.interrupt = {
      kind: 'escort_captive',
      targetId: captive.id,
      remainingMs: 30_000,
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

    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${guard.data.name} escorts ${captive.name} to the dungeon`,
    });
    return true;
  }

  /** Executioner-led hang — frees a cell when done. */
  beginHang(captive: CaptiveRecord): boolean {
    const gallows = this.buildings.serialize().find((b) => b.kind === 'gallows');
    const exec = this.subjects.firstByRole('executioner');
    if (!gallows || !exec) return false;

    let sprite = this.cellSprites.get(captive.id);
    if (sprite) {
      this.cellSprites.delete(captive.id);
      this.cellByCaptive.delete(captive.id);
    } else {
      const tex = captiveTextureKey(captive.role);
      sprite = this.scene.add
        .sprite(gallows.x, gallows.y + 8, tex)
        .setDepth(14)
        .setOrigin(0.5, 1)
        .setAlpha(0.88);
      sprite.play(idleAnimKey(tex), true);
    }

    this.hangs.push({
      captiveId: captive.id,
      sprite,
      execId: exec.data.id,
      remainingMs: 3200,
    });

    exec.interrupt = { kind: 'execute', remainingMs: 4000 };
    this.subjects.nudgeToward(exec.data.id, gallows.x, gallows.y - 4, 45);
    this.subjects.appendLifeLog(
      exec.data.id,
      `Executed ${captive.name}`,
      'execute'
    );

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
        this.escorts.some((e) => e.captive.id === c.id)
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
        escort.sprite.destroy();
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

      if (dist > 18) {
        this.subjects.nudgeToward(guard.data.id, gate.x, gate.y, 52);
        escort.sprite.setPosition(guard.sprite.x + 10, guard.sprite.y + 2);
        escort.sprite.setDepth(12 + escort.sprite.y * 0.01);
      } else {
        this.deps.addCaptive(escort.captive);
        this.cellByCaptive.set(escort.captive.id, escort.cellIndex);
        const cell = dungeonCellPoint(dungeon, escort.cellIndex, escort.captive.id);
        escort.sprite.setPosition(cell.x, cell.y);
        escort.sprite.setDepth(10 + cell.y * 0.01);
        this.cellSprites.set(escort.captive.id, escort.sprite);
        guard.interrupt = null;
        this.subjects.clearInterrupt(guard.data.id);
        guard.data.activityLabel = 'Prisoner secured in the dungeon';
        this.escorts = this.escorts.filter((e) => e !== escort);
        this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
          message: `${escort.captive.name} is locked in a cell`,
        });
      }
    }
  }

  private tickHangs(deltaMs: number): void {
    for (const hang of [...this.hangs]) {
      hang.remainingMs -= deltaMs;
      const gallows = this.buildings.serialize().find((b) => b.kind === 'gallows');
      if (gallows) {
        hang.sprite.setPosition(
          gallows.x,
          gallows.y + 4 - Math.sin(hang.remainingMs / 200) * 2
        );
        hang.sprite.setAngle(Math.sin(hang.remainingMs / 150) * 8);
      }
      if (hang.remainingMs <= 0) {
        hang.sprite.destroy();
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
  return role === 'thief' ? 'bandit' : role;
}
