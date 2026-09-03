import Phaser from 'phaser';
import { isMilitaryRole } from '../art/assetManifest';
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
import { ringOffset } from '../subjects/zones';
import type { SpeechBubbleSystem } from '../ui/SpeechBubbleSystem';

interface EscortState {
  guardId: string;
  captiveId: string;
  dungeonId: string;
  cellIndex: number;
}

type HangStage = 'march' | 'hang';

interface HangState {
  captiveId: string;
  captiveName: string;
  execId: string;
  stage: HangStage;
  remainingMs: number;
  gallowsX: number;
  gallowsY: number;
  hangBaseY: number;
}

const PRISON_THOUGHTS = [
  'The straw is damp. The company is worse.',
  'I can hear the gallows creaking from here.',
  'If I had a file in this cake, I would not share.',
  'Four walls, one regret, zero windows worth mentioning.',
];

const HANG_WATCH_LINES = [
  'Oh my.',
  'Justice, they call it.',
  'I cannot look away.',
  'Poor soul.',
  'The rope never misses.',
  'Huzzah? …no. Not huzzah.',
];

export interface DungeonLifeDeps {
  getCaptives: () => CaptiveRecord[];
  addCaptive: (c: CaptiveRecord) => void;
  removeCaptive: (id: string) => void;
}

/** Living prisoners (same sprites), guard escorts, corridor patrol, gallows. */
export class DungeonLifeSystem {
  private escorts: EscortState[] = [];
  private hangs: HangState[] = [];
  private patrolIdx = new Map<string, number>();
  private patrolMs = 0;
  private bubbles: SpeechBubbleSystem | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly subjects: SubjectSystem,
    private readonly buildings: BuildingSystem,
    private readonly deps: DungeonLifeDeps
  ) {}

  setBubbles(bubbles: SpeechBubbleSystem): void {
    this.bubbles = bubbles;
  }

  capacity(): number {
    return DUNGEON_CELL_COUNT;
  }

  prisonerCount(): number {
    return this.jailedSubjects().length;
  }

  /** Occupied cells including escorts still en route. */
  occupiedCells(): number {
    const ids = new Set<string>();
    for (const s of this.jailedSubjects()) ids.add(s.data.id);
    for (const e of this.escorts) ids.add(e.captiveId);
    return ids.size;
  }

  freeCells(): number {
    return Math.max(0, DUNGEON_CELL_COUNT - this.occupiedCells());
  }

  hasFreeCell(): boolean {
    return this.freeCells() > 0;
  }

  isJailed(id: string): boolean {
    const k = this.subjects.getById(id)?.interrupt?.kind;
    return k === 'imprisoned' || k === 'under_arrest';
  }

  /** Guard escorts a captive (existing subject, or spawned from a record). */
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
    if (this.isJailed(captive.id) || this.hangs.some((h) => h.captiveId === captive.id)) {
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

    const at = {
      x: opts?.fromX ?? dungeon.x,
      y: opts?.fromY ?? dungeon.y,
    };
    const prisoner = this.ensureSubject(captive, at);
    if (!prisoner) return false;

    const guard =
      (opts?.guardId ? this.subjects.getById(opts.guardId) : null) ??
      this.subjects.nearestMilitary(at.x, at.y, 280);
    if (!guard || guard.data.id === prisoner.data.id) {
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'No guard nearby to escort the prisoner',
      });
      return false;
    }

    const cellIndex = this.nextOpenCell();
    guard.interrupt = {
      kind: 'escort_captive',
      targetId: prisoner.data.id,
      remainingMs: 45_000,
    };
    guard.data.activity = 'patrol';
    guard.data.activityLabel = `Escorting ${prisoner.data.name} to the dungeon`;

    prisoner.interrupt = {
      kind: 'under_arrest',
      targetId: guard.data.id,
      cellIndex,
      remainingMs: 45_000,
    };
    prisoner.data.activityLabel = `Arrested — marching to the dungeon`;
    prisoner.data.thought = 'This is not how I planned my afternoon.';
    prisoner.data.zone = 'dungeon';
    this.subjects.appendLifeLog(
      prisoner.data.id,
      'Arrested and marched to the dungeon',
      'arrest'
    );

    this.rememberCaptive(captive);
    this.escorts.push({
      guardId: guard.data.id,
      captiveId: prisoner.data.id,
      dungeonId: dungeon.id,
      cellIndex,
    });

    const gate = dungeonGatePoint(dungeon);
    this.subjects.nudgeToward(guard.data.id, gate.x, gate.y, 52);

    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${guard.data.name} escorts ${prisoner.data.name} to the dungeon`,
    });
    return true;
  }

  beginHang(captiveId: string): boolean {
    const gallows = this.buildings.serialize().find((b) => b.kind === 'gallows');
    const exec = this.subjects
      .listManaged()
      .find(
        (s) =>
          s.data.role === 'executioner' &&
          s.sprite.active &&
          s.interrupt?.kind !== 'imprisoned' &&
          s.interrupt?.kind !== 'under_arrest' &&
          s.interrupt?.kind !== 'execute'
      );
    const prisoner = this.subjects.getById(captiveId);
    if (!gallows || !exec || !prisoner) return false;
    if (exec.interrupt?.kind === 'execute') return false;
    if (this.hangs.some((h) => h.captiveId === captiveId)) return false;
    if (prisoner.interrupt?.kind !== 'imprisoned') return false;

    this.escorts = this.escorts.filter((e) => e.captiveId !== captiveId);

    const gx = gallows.x;
    const gy = gallows.y + 18;

    this.hangs.push({
      captiveId: prisoner.data.id,
      captiveName: prisoner.data.name,
      execId: exec.data.id,
      stage: 'march',
      remainingMs: 20_000,
      gallowsX: gx,
      gallowsY: gy,
      hangBaseY: gy - 10,
    });

    exec.interrupt = {
      kind: 'execute',
      targetId: prisoner.data.id,
      remainingMs: 20_000,
    };
    exec.data.activityLabel = `Leading ${prisoner.data.name} to the gallows`;
    prisoner.interrupt = {
      kind: 'under_arrest',
      targetId: exec.data.id,
      remainingMs: 20_000,
    };
    prisoner.data.activityLabel = `Walking to the gallows`;
    prisoner.data.thought = 'The rope has my name on it.';
    this.subjects.nudgeToward(exec.data.id, gx, gy, 48);
    this.deps.removeCaptive(captiveId);
    this.gatherHangingCrowd(gx, gy, prisoner.data.id, exec.data.id);

    this.scene.game.events.emit(KingdomEvents.KINGDOM_EVENT, {
      id: `hanging-${captiveId}-${Date.now()}`,
      severity: 'warning',
      title: 'A hanging!',
      detail: `${prisoner.data.name} is led to the gallows`,
      x: gx,
      y: gy,
      ttlMs: 10_000,
    });
    return true;
  }

  release(captiveId: string): boolean {
    const prisoner = this.subjects.getById(captiveId);
    if (!prisoner) return false;
    if (
      prisoner.interrupt?.kind !== 'imprisoned' &&
      prisoner.interrupt?.kind !== 'under_arrest'
    ) {
      return false;
    }
    if (this.hangs.some((h) => h.captiveId === captiveId)) {
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'Too late — they are already walking to the gallows.',
      });
      return false;
    }

    const escort = this.escorts.find((e) => e.captiveId === captiveId);
    if (escort) {
      this.subjects.clearInterrupt(escort.guardId);
      this.escorts = this.escorts.filter((e) => e !== escort);
    }

    const dungeon = this.nearestDungeon(prisoner.sprite.x, prisoner.sprite.y);
    const gate = dungeon
      ? dungeonGatePoint(dungeon)
      : { x: prisoner.sprite.x, y: prisoner.sprite.y + 24 };
    this.subjects.clearInterrupt(prisoner.data.id);
    prisoner.data.activityLabel = 'Freed from the dungeon';
    prisoner.data.thought = 'Air. Grass. I shall never complain about stew again.';
    prisoner.data.zone = 'path';
    this.subjects.appendLifeLog(prisoner.data.id, 'Released from the dungeon', 'release');
    this.subjects.nudgeToward(prisoner.data.id, gate.x, gate.y + 18, 48);
    this.deps.removeCaptive(captiveId);
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${prisoner.data.name} is released from the dungeon`,
    });
    this.scene.game.events.emit(KingdomEvents.CAPTIVES_CHANGED, {
      count: this.deps.getCaptives().length,
    });
    return true;
  }

  /** Place / restore prisoners after load. */
  syncCaptives(): void {
    const dungeon = this.nearestDungeon();
    if (!dungeon) return;
    const gate = dungeonGatePoint(dungeon);

    for (const c of this.deps.getCaptives()) {
      if (this.escorts.some((e) => e.captiveId === c.id)) continue;
      if (this.hangs.some((h) => h.captiveId === c.id)) continue;
      const prisoner = this.ensureSubject(c, gate);
      if (!prisoner) continue;
      if (prisoner.interrupt?.kind === 'imprisoned') {
        const idx = prisoner.interrupt.cellIndex ?? this.nextOpenCell();
        this.parkInCell(prisoner.data.id, dungeon, idx);
        continue;
      }
      if (prisoner.interrupt?.kind === 'under_arrest') continue;
      const cellIndex = this.nextOpenCell();
      this.parkInCell(prisoner.data.id, dungeon, cellIndex);
    }

    for (const s of this.subjects.listManaged()) {
      if (s.interrupt?.kind !== 'imprisoned') continue;
      const idx = s.interrupt.cellIndex ?? 0;
      this.parkInCell(s.data.id, dungeon, idx);
      this.rememberCaptive({
        id: s.data.id,
        name: s.data.name,
        role: s.data.role,
        houseId: s.data.houseId,
        maxHp: s.data.maxHp,
      });
    }
  }

  update(deltaMs: number): void {
    this.tickEscorts();
    this.tickHangs(deltaMs);
    this.tickPinnedCells();
    this.tickPatrol(deltaMs);
    this.tickPrisonThoughts(deltaMs);
  }

  clear(): void {
    this.escorts = [];
    this.hangs = [];
  }

  private rememberCaptive(captive: CaptiveRecord): void {
    if (this.deps.getCaptives().some((c) => c.id === captive.id)) return;
    this.deps.addCaptive(captive);
  }

  private ensureSubject(
    captive: CaptiveRecord,
    at: { x: number; y: number }
  ) {
    const existing = this.subjects.getById(captive.id);
    if (existing) return existing;
    this.subjects.restoreCaptive(
      {
        id: captive.id,
        name: captive.name,
        role: captive.role,
        houseId: captive.houseId,
        hp: captive.maxHp,
        maxHp: captive.maxHp,
        onWall: false,
        hunger: 0,
        sick: false,
      },
      at
    );
    return this.subjects.getById(captive.id) ?? null;
  }

  private jailedSubjects() {
    return this.subjects
      .listManaged()
      .filter(
        (s) =>
          s.interrupt?.kind === 'imprisoned' || s.interrupt?.kind === 'under_arrest'
      );
  }

  private tickEscorts(): void {
    for (const escort of [...this.escorts]) {
      const guard = this.subjects.getById(escort.guardId);
      const prisoner = this.subjects.getById(escort.captiveId);
      const dungeon = this.buildings.getById(escort.dungeonId);
      if (!prisoner || !prisoner.sprite.active) {
        this.escorts = this.escorts.filter((e) => e !== escort);
        continue;
      }
      if (!guard || !dungeon || !guard.sprite.active) {
        if (dungeon && this.hasFreeCell()) {
          this.parkInCell(prisoner.data.id, dungeon, escort.cellIndex);
        } else {
          this.subjects.clearInterrupt(prisoner.data.id);
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

      prisoner.sprite.x = Phaser.Math.Linear(prisoner.sprite.x, guard.sprite.x - 12, 0.22);
      prisoner.sprite.y = Phaser.Math.Linear(prisoner.sprite.y, guard.sprite.y + 4, 0.22);
      prisoner.sprite.setDepth(12 + prisoner.sprite.y * 0.01);

      if (dist > 22) {
        if (!guard.moving) {
          this.subjects.nudgeToward(guard.data.id, gate.x, gate.y, 52);
        }
        guard.data.activityLabel = `Escorting ${prisoner.data.name} to the dungeon`;
      } else {
        this.parkInCell(prisoner.data.id, dungeon, escort.cellIndex);
        this.subjects.clearInterrupt(guard.data.id);
        guard.data.activityLabel = 'Prisoner secured in the dungeon';
        this.escorts = this.escorts.filter((e) => e !== escort);
        this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
          message: `${prisoner.data.name} is locked in a cell`,
        });
        this.scene.game.events.emit(KingdomEvents.CAPTIVES_CHANGED, {
          count: this.deps.getCaptives().length,
        });
      }
    }
  }

  private parkInCell(
    captiveId: string,
    dungeon: { x: number; y: number },
    cellIndex: number
  ): void {
    const prisoner = this.subjects.getById(captiveId);
    if (!prisoner) return;
    const cell = dungeonCellPoint(dungeon, cellIndex, captiveId);
    prisoner.sprite.setPosition(cell.x, cell.y);
    prisoner.sprite.setDepth(10 + cell.y * 0.01);
    prisoner.interrupt = {
      kind: 'imprisoned',
      cellIndex,
    };
    prisoner.data.zone = 'dungeon';
    prisoner.data.activityLabel = 'Locked in a dungeon cell';
    prisoner.data.thought =
      PRISON_THOUGHTS[Math.floor(Math.random() * PRISON_THOUGHTS.length)]!;
    this.rememberCaptive({
      id: prisoner.data.id,
      name: prisoner.data.name,
      role: prisoner.data.role,
      houseId: prisoner.data.houseId,
      maxHp: prisoner.data.maxHp,
    });
  }

  private tickPinnedCells(): void {
    const dungeon = this.nearestDungeon();
    if (!dungeon) return;
    for (const s of this.subjects.listManaged()) {
      if (s.interrupt?.kind !== 'imprisoned') continue;
      if (this.hangs.some((h) => h.captiveId === s.data.id)) continue;
      const idx = s.interrupt.cellIndex ?? 0;
      const cell = dungeonCellPoint(dungeon, idx, s.data.id);
      s.sprite.setPosition(cell.x, cell.y);
      s.sprite.setDepth(10 + cell.y * 0.01);
    }
  }

  private prisonThoughtAccum = 0;
  private tickPrisonThoughts(deltaMs: number): void {
    this.prisonThoughtAccum += deltaMs;
    if (this.prisonThoughtAccum < 8000) return;
    this.prisonThoughtAccum = 0;
    for (const s of this.subjects.listManaged()) {
      if (s.interrupt?.kind !== 'imprisoned') continue;
      if (Math.random() > 0.45) continue;
      s.data.thought =
        PRISON_THOUGHTS[Math.floor(Math.random() * PRISON_THOUGHTS.length)]!;
    }
  }

  private tickHangs(deltaMs: number): void {
    for (const hang of [...this.hangs]) {
      hang.remainingMs -= deltaMs;
      const exec = this.subjects.getById(hang.execId);
      const prisoner = this.subjects.getById(hang.captiveId);

      if (hang.stage === 'march') {
        if (!exec || !exec.sprite.active || !prisoner || !prisoner.sprite.active) {
          this.clearHangingCrowd();
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
          this.subjects.nudgeToward(exec.data.id, hang.gallowsX, hang.gallowsY, 48);
        }

        prisoner.sprite.x = Phaser.Math.Linear(
          prisoner.sprite.x,
          exec.sprite.x - 10,
          0.2
        );
        prisoner.sprite.y = Phaser.Math.Linear(
          prisoner.sprite.y,
          exec.sprite.y + 4,
          0.2
        );
        prisoner.sprite.setDepth(14 + prisoner.sprite.y * 0.01);
        exec.data.activityLabel = `Leading ${hang.captiveName} to the gallows`;

        if (dist <= 28 || hang.remainingMs <= 0) {
          hang.stage = 'hang';
          hang.remainingMs = 3400;
          prisoner.sprite.setPosition(hang.gallowsX, hang.hangBaseY);
          prisoner.sprite.setAngle(0);
          this.subjects.appendLifeLog(
            exec.data.id,
            `Executed ${hang.captiveName}`,
            'execute'
          );
          this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
            message: `${hang.captiveName} hangs at the gallows`,
          });
          this.reactCrowd(hang.gallowsX, hang.gallowsY);
        }
        continue;
      }

      if (prisoner?.sprite.active) {
        prisoner.sprite.setPosition(
          hang.gallowsX,
          hang.hangBaseY - Math.sin(hang.remainingMs / 200) * 2
        );
        prisoner.sprite.setAngle(Math.sin(hang.remainingMs / 150) * 8);
        prisoner.sprite.setDepth(16);
      }

      if (hang.remainingMs <= 0) {
        if (prisoner) {
          prisoner.sprite.setAngle(0);
          this.subjects.despawnSubject(prisoner.data.id);
        }
        if (exec) {
          this.subjects.clearInterrupt(exec.data.id);
          exec.data.activityLabel = 'Justice is done';
        }
        this.clearHangingCrowd();
        this.hangs = this.hangs.filter((h) => h !== hang);
      }
    }
  }

  private gatherHangingCrowd(
    gx: number,
    gy: number,
    skipA: string,
    skipB: string
  ): void {
    const crowd = this.subjects
      .listManaged()
      .filter((s) => {
        if (!s.sprite.active) return false;
        if (s.data.id === skipA || s.data.id === skipB) return false;
        if (s.data.allegiance === 'camp') return false;
        if (isMilitaryRole(s.data.role) && s.data.role !== 'jester') return false;
        if (s.interrupt && s.interrupt.kind !== 'spectate_hanging') return false;
        const d = Phaser.Math.Distance.Between(gx, gy, s.sprite.x, s.sprite.y);
        return d < 260;
      })
      .sort(
        (a, b) =>
          Phaser.Math.Distance.Between(gx, gy, a.sprite.x, a.sprite.y) -
          Phaser.Math.Distance.Between(gx, gy, b.sprite.x, b.sprite.y)
      )
      .slice(0, 10);

    crowd.forEach((s, i) => {
      s.interrupt = { kind: 'spectate_hanging', remainingMs: 22_000 };
      s.data.activityLabel = 'Watching a hanging';
      s.data.thought =
        HANG_WATCH_LINES[Math.floor(Math.random() * HANG_WATCH_LINES.length)]!;
      const off = ringOffset(i, crowd.length, 56);
      const dest = this.subjects.snapToWalkable(gx + off.x, gy + 28 + off.y * 0.45);
      this.subjects.nudgeToward(s.data.id, dest.x, dest.y, 48);
    });
  }

  private reactCrowd(gx: number, gy: number): void {
    for (const s of this.subjects.listManaged()) {
      if (s.interrupt?.kind !== 'spectate_hanging') continue;
      s.data.thought =
        HANG_WATCH_LINES[Math.floor(Math.random() * HANG_WATCH_LINES.length)]!;
      this.subjects.playCelebrateAnim(s.data.id, 'cheer');
      if (this.bubbles && Math.random() < 0.7) {
        this.bubbles.say(
          s.sprite,
          s.data.thought,
          2800
        );
      }
    }
    this.scene.game.events.emit(KingdomEvents.CAMERA_PAN, { x: gx, y: gy });
  }

  private clearHangingCrowd(): void {
    for (const s of this.subjects.listManaged()) {
      if (s.interrupt?.kind !== 'spectate_hanging') continue;
      this.subjects.clearInterrupt(s.data.id);
      s.data.activityLabel = 'Leaving the gallows';
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
    const used = new Set<number>();
    for (const s of this.subjects.listManaged()) {
      if (s.interrupt?.kind === 'imprisoned' || s.interrupt?.kind === 'under_arrest') {
        if (typeof s.interrupt.cellIndex === 'number') used.add(s.interrupt.cellIndex);
      }
    }
    for (const e of this.escorts) used.add(e.cellIndex);
    for (let i = 0; i < DUNGEON_CELL_COUNT; i++) {
      if (!used.has(i)) return i;
    }
    return 0;
  }
}
