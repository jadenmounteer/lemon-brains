import Phaser from 'phaser';
import {
  UNIT_HEIGHT,
  UNIT_WIDTH,
  idleAnimKey,
  walkAnimKey,
  type Direction,
  type UnitRole,
} from '../art/assetManifest';
import type { SavedSubject } from '../../kingdom/LayoutRepository';
import type { Aabb, BuildingSystem } from '../buildings/BuildingSystem';
import { UNIT_MAX_HP } from '../combat/stats';
import { CombatBalance } from '../combat/stats';
import type { RaidSystem } from '../raids/RaidSystem';
import { DayClock } from './DayClock';
import { KingdomEvents } from './events';
import { pickName } from './names';
import { roleLabel, scheduleSummary, slotAtHour } from './schedules';
import type {
  BuildingResident,
  InterruptKind,
  Subject,
  SubjectInterrupt,
  SubjectSnapshot,
} from './types';
import { randomPointInZone, type WorldBounds } from './zones';

export type ManagedSubject = {
  data: Subject;
  sprite: Phaser.GameObjects.Sprite;
  moving: boolean;
  fleeCooldownMs: number;
  interrupt: SubjectInterrupt | null;
};

/** Three residents per starter house (house-0 then house-1). */
const SEED_ROLES: UnitRole[] = [
  'peasant',
  'peasant',
  'guard',
  'guard',
  'archer',
  'archer',
];

export class SubjectSystem {
  readonly clock = new DayClock();
  private subjects: ManagedSubject[] = [];
  private selectedId: string | null = null;
  private marker: Phaser.GameObjects.Arc | null = null;
  private dayEmitAccumMs = 0;
  private nextSubjectId = 0;
  private buildings: BuildingSystem | null = null;
  private raidMode = false;
  private onChanged: (() => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: WorldBounds
  ) {}

  setBuildings(buildings: BuildingSystem): void {
    this.buildings = buildings;
  }

  setOnChanged(cb: () => void): void {
    this.onChanged = cb;
  }

  setRaidMode(active: boolean): void {
    const was = this.raidMode;
    this.raidMode = active;
    if (active && !was) {
      this.cancelInterrupts(['repair', 'chat']);
    }
  }

  hasInterrupt(id: string): boolean {
    return Boolean(this.getById(id)?.interrupt);
  }

  withInterrupt(kind: InterruptKind): ManagedSubject[] {
    return this.subjects.filter((s) => s.interrupt?.kind === kind);
  }

  listInterrupts(kind: InterruptKind): SubjectInterrupt[] {
    return this.subjects
      .filter((s) => s.interrupt?.kind === kind)
      .map((s) => s.interrupt!);
  }

  clearInterrupt(id: string): void {
    const managed = this.getById(id);
    if (!managed?.interrupt) return;
    managed.interrupt = null;
  }

  cancelInterrupts(kinds: InterruptKind[]): void {
    for (const s of this.subjects) {
      if (s.interrupt && kinds.includes(s.interrupt.kind)) {
        s.interrupt = null;
      }
    }
  }

  clearFleeInterrupts(): void {
    for (const s of this.subjects) {
      if (s.interrupt?.kind === 'flee') {
        s.interrupt = null;
      }
    }
  }

  /** Free peasant for repair (no interrupt, not on wall). */
  closestFreePeasant(x: number, y: number): string | null {
    let best: ManagedSubject | null = null;
    let bestD = Infinity;
    for (const s of this.subjects) {
      if (s.data.role !== 'peasant') continue;
      if (s.interrupt || s.data.onWall) continue;
      const d = Phaser.Math.Distance.Between(x, y, s.sprite.x, s.sprite.y);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best?.data.id ?? null;
  }

  beginRepair(subjectId: string, targetId: string, label: string): void {
    const managed = this.getById(subjectId);
    if (!managed) return;
    managed.interrupt = { kind: 'repair', targetId };
    managed.data.activity = 'repair';
    managed.data.activityLabel = `Repairing ${label}`;
  }

  listFreeForChat(): ManagedSubject[] {
    return this.subjects.filter(
      (s) => !s.interrupt && !s.data.onWall && !s.moving
    );
  }

  beginChat(aId: string, bId: string, durationMs: number): void {
    const a = this.getById(aId);
    const b = this.getById(bId);
    if (!a || !b) return;
    a.interrupt = {
      kind: 'chat',
      partnerId: bId,
      remainingMs: durationMs,
    };
    b.interrupt = {
      kind: 'chat',
      partnerId: aId,
      remainingMs: durationMs,
    };
    a.data.activity = 'chat';
    b.data.activity = 'chat';
    a.data.activityLabel = `Talking with ${b.data.name}`;
    b.data.activityLabel = `Talking with ${a.data.name}`;
    this.scene.tweens.killTweensOf(a.sprite);
    this.scene.tweens.killTweensOf(b.sprite);
    a.moving = false;
    b.moving = false;
    a.sprite.play(idleAnimKey(a.data.role));
    b.sprite.play(idleAnimKey(b.data.role));
  }

  spawnSeed(): void {
    SEED_ROLES.forEach((role, index) => {
      const houseId = index < 3 ? 'house-0' : 'house-1';
      this.createSubject(
        role,
        houseId,
        `subject-${index}`,
        pickName(1000 + index * 97)
      );
    });
    this.nextSubjectId = SEED_ROLES.length;
    this.ensureMarker();
  }

  restore(saved: SavedSubject[]): void {
    this.clearSubjects();
    for (const s of saved) {
      this.createSubject(s.role, s.houseId, s.id, s.name, {
        hp: s.hp,
        maxHp: s.maxHp,
        onWall: s.onWall,
      });
      const match = /^subject-(\d+)$/.exec(s.id);
      if (match) {
        this.nextSubjectId = Math.max(this.nextSubjectId, Number(match[1]) + 1);
      }
    }
    this.ensureMarker();
  }

  serialize(): SavedSubject[] {
    return this.subjects.map((s) => ({
      id: s.data.id,
      name: s.data.name,
      role: s.data.role,
      houseId: s.data.houseId,
      hp: s.data.hp,
      maxHp: s.data.maxHp,
      onWall: s.data.onWall,
    }));
  }

  count(): number {
    return this.subjects.length;
  }

  occupantCounts(): Map<string, number> {
    const map = new Map<string, number>();
    for (const s of this.subjects) {
      if (!this.buildings?.getHousePoint(s.data.houseId)) continue;
      map.set(s.data.houseId, (map.get(s.data.houseId) ?? 0) + 1);
    }
    return map;
  }

  unitBodies(): Aabb[] {
    return this.subjects.map((s) => ({
      left: s.sprite.x - UNIT_WIDTH / 2 - 2,
      right: s.sprite.x + UNIT_WIDTH / 2 + 2,
      top: s.sprite.y - UNIT_HEIGHT,
      bottom: s.sprite.y,
    }));
  }

  hire(role: UnitRole): boolean {
    if (!this.buildings) return false;
    const houseId = this.buildings.pickHouseForHire(this.occupantCounts());
    if (!houseId) {
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'No free beds — build a house first',
      });
      return false;
    }
    const id = `subject-${this.nextSubjectId++}`;
    const name = pickName(2000 + this.nextSubjectId * 41);
    this.createSubject(role, houseId, id, name);
    const managed = this.subjects[this.subjects.length - 1]!;
    this.scene.time.delayedCall(200, () => this.nudgeTowardSchedule(managed));
    this.onChanged?.();
    return true;
  }

  list(): Subject[] {
    return this.subjects.map((s) => s.data);
  }

  residentsOf(houseId: string): BuildingResident[] {
    return this.subjects
      .filter((s) => s.data.houseId === houseId)
      .map((s) => ({
        id: s.data.id,
        name: s.data.name,
        roleLabel: roleLabel(s.data.role),
      }));
  }

  combatants(): ManagedSubject[] {
    return this.subjects.filter(
      (s) => s.data.role === 'guard' || s.data.role === 'archer'
    );
  }

  nearestSubject(
    x: number,
    y: number,
    radius: number
  ): ManagedSubject | null {
    let best: ManagedSubject | null = null;
    let bestD = radius;
    for (const s of this.subjects) {
      const d = Phaser.Math.Distance.Between(x, y, s.sprite.x, s.sprite.y);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  getById(id: string): ManagedSubject | undefined {
    return this.subjects.find((s) => s.data.id === id);
  }

  /** Tight world-space body pick (feet at sprite origin). */
  pickAt(worldX: number, worldY: number): string | null {
    let best: ManagedSubject | null = null;
    let bestY = -Infinity;
    for (const s of this.subjects) {
      if (!s.sprite.active) continue;
      const left = s.sprite.x - UNIT_WIDTH / 2;
      const right = s.sprite.x + UNIT_WIDTH / 2;
      const top = s.sprite.y - UNIT_HEIGHT;
      const bottom = s.sprite.y;
      if (worldX < left || worldX > right || worldY < top || worldY > bottom) {
        continue;
      }
      if (s.sprite.y >= bestY) {
        best = s;
        bestY = s.sprite.y;
      }
    }
    return best?.data.id ?? null;
  }

  getSelectedId(): string | null {
    return this.selectedId;
  }

  select(id: string | null): SubjectSnapshot | null {
    this.selectedId = id;
    if (!id) {
      this.marker?.setVisible(false);
      for (const s of this.subjects) {
        s.sprite.clearTint();
        this.applyHpTint(s);
      }
      return null;
    }

    const managed = this.getById(id);
    if (!managed) {
      this.selectedId = null;
      this.marker?.setVisible(false);
      return null;
    }

    for (const s of this.subjects) {
      if (s.data.id === id) {
        s.sprite.setTint(0xfff0c0);
      } else {
        s.sprite.clearTint();
        this.applyHpTint(s);
      }
    }

    this.marker
      ?.setPosition(managed.sprite.x, managed.sprite.y - 2)
      .setVisible(true);

    return this.toSnapshot(managed);
  }

  update(deltaMs: number): void {
    const rolled = this.clock.tick(deltaMs);
    this.syncActivities();

    if (rolled) {
      this.scene.game.events.emit(KingdomEvents.DAY_ROLLED);
    }

    this.dayEmitAccumMs += deltaMs;
    if (this.dayEmitAccumMs >= 1000) {
      this.dayEmitAccumMs = 0;
      this.scene.game.events.emit(KingdomEvents.DAY_TICK, {
        dayPhase: this.clock.phase,
        hour: this.clock.hour,
      });
    }

    if (!this.raidMode) {
      for (const managed of this.subjects) {
        if (managed.interrupt) continue;
        if (!managed.moving && Math.random() < deltaMs * 0.0004) {
          this.nudgeTowardSchedule(managed);
        }
      }
    }

    if (this.selectedId && this.marker) {
      const sel = this.getById(this.selectedId);
      if (sel) {
        this.marker.setPosition(sel.sprite.x, sel.sprite.y - 2);
      }
    }
  }

  tickFleeAndClimb(raids: RaidSystem, deltaMs: number): void {
    for (const managed of this.subjects) {
      if (managed.data.role === 'peasant') {
        managed.fleeCooldownMs -= deltaMs;
        if (managed.fleeCooldownMs > 0) continue;
        const threat = raids.nearestRaider(
          managed.sprite.x,
          managed.sprite.y,
          CombatBalance.fleeRadius * 2
        );
        if (!threat) continue;
        managed.fleeCooldownMs = 700;
        managed.interrupt = { kind: 'flee' };
        managed.data.activity = 'flee';
        managed.data.activityLabel = 'Fleeing raiders';
        const keep = {
          x: this.world.width / 2,
          y: this.world.height / 2,
        };
        const awayX = managed.sprite.x - (threat.sprite.x - managed.sprite.x);
        const awayY = managed.sprite.y - (threat.sprite.y - managed.sprite.y);
        const dKeep = Phaser.Math.Distance.Between(
          managed.sprite.x,
          managed.sprite.y,
          keep.x,
          keep.y
        );
        const targetX = dKeep < 120 ? keep.x : (awayX + keep.x) / 2;
        const targetY = dKeep < 120 ? keep.y + 30 : (awayY + keep.y) / 2;
        this.nudgeToward(managed.data.id, targetX, targetY, 70);
      } else if (managed.data.role === 'archer' && !managed.data.onWall) {
        this.tryClimbNearestStairs(managed.data.id);
      } else if (
        managed.data.role === 'guard' &&
        !managed.data.onWall &&
        Math.random() < 0.02
      ) {
        this.tryClimbNearestStairs(managed.data.id);
      }
    }
  }

  tryClimbNearestStairs(subjectId: string): boolean {
    const managed = this.getById(subjectId);
    if (!managed || !this.buildings) return false;
    const stairs = this.buildings.stairsNear(
      managed.sprite.x,
      managed.sprite.y,
      80
    );
    if (!stairs) return false;
    const wall = this.buildings.wallForStairs(stairs);
    if (!wall) return false;

    managed.data.activity = 'climb';
    managed.data.activityLabel = 'Climbing the wall';
    this.nudgeToward(subjectId, stairs.x, stairs.y, 50, () => {
      managed.data.onWall = true;
      managed.sprite.setPosition(wall.x, wall.y - 10);
      managed.sprite.setDepth(22 + wall.y * 0.01);
      managed.data.activityLabel = 'On the wall';
      managed.data.zone = 'wall';
    });
    return true;
  }

  /** Drop anyone standing on a destroyed wall. */
  dropFromWall(wallId: string): void {
    if (!this.buildings) return;
    const wall = this.buildings.getById(wallId);
    for (const s of this.subjects) {
      if (!s.data.onWall) continue;
      if (wall) {
        const d = Phaser.Math.Distance.Between(
          s.sprite.x,
          s.sprite.y,
          wall.x,
          wall.y
        );
        if (d > 40) continue;
      }
      s.data.onWall = false;
      s.sprite.setPosition(s.sprite.x, s.sprite.y + 16);
    }
  }

  onHouseDestroyed(houseId: string): void {
    for (const s of this.subjects) {
      if (s.data.houseId !== houseId) continue;
      const next = this.buildings?.pickHouseForHire(this.occupantCounts());
      s.data.houseId = next ?? '';
    }
  }

  damageSubject(id: string, amount: number): boolean {
    const managed = this.getById(id);
    if (!managed) return false;
    managed.data.hp = Math.max(0, managed.data.hp - amount);
    this.applyHpTint(managed);
    if (managed.data.hp <= 0) {
      const name = managed.data.name;
      this.removeSubject(managed);
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: `${name} was slain`,
      });
      this.onChanged?.();
      return true;
    }
    return false;
  }

  nudgeToward(
    id: string,
    targetX: number,
    targetY: number,
    speed = 40,
    onArrive?: () => void
  ): void {
    const managed = this.getById(id);
    if (!managed || !managed.sprite.active) return;
    if (managed.data.onWall) return;

    const pad = 32;
    const x = Phaser.Math.Clamp(targetX, pad, this.world.width - pad);
    const y = Phaser.Math.Clamp(targetY, pad, this.world.height - pad);
    const dx = x - managed.sprite.x;
    const dy = y - managed.sprite.y;
    if (Math.hypot(dx, dy) < 6) {
      onArrive?.();
      return;
    }

    this.scene.tweens.killTweensOf(managed.sprite);
    managed.moving = false;

    const dir = facingFromDelta(dx, dy);
    managed.sprite.play(walkAnimKey(managed.data.role, dir), true);
    managed.moving = true;
    const dist = Math.hypot(dx, dy);
    const duration = Math.max(300, (dist / speed) * 1000);

    this.scene.tweens.add({
      targets: managed.sprite,
      x,
      y,
      duration,
      ease: 'Linear',
      onUpdate: () => {
        managed.sprite.setDepth(20 + managed.sprite.y * 0.01);
      },
      onComplete: () => {
        managed.moving = false;
        if (managed.sprite.active) {
          managed.sprite.play(idleAnimKey(managed.data.role));
        }
        onArrive?.();
      },
    });
  }

  refreshSelectedSnapshot(): SubjectSnapshot | null {
    if (!this.selectedId) return null;
    const managed = this.getById(this.selectedId);
    return managed ? this.toSnapshot(managed) : null;
  }

  private createSubject(
    role: UnitRole,
    houseId: string,
    id: string,
    name: string,
    opts?: { hp?: number; maxHp?: number; onWall?: boolean }
  ): void {
    const slot = slotAtHour(role, this.clock.hour);
    const home = this.buildings?.getHousePoint(houseId) ?? null;
    const start = randomPointInZone(slot.zone, this.world, home);
    const maxHp = opts?.maxHp ?? UNIT_MAX_HP[role];
    const hp = opts?.hp ?? maxHp;

    const sprite = this.scene.add.sprite(start.x, start.y, role, 0);
    sprite.setDepth(20);
    sprite.setOrigin(0.5, 1);
    sprite.setInteractive(
      new Phaser.Geom.Rectangle(-6, -4, UNIT_WIDTH + 12, UNIT_HEIGHT + 8),
      Phaser.Geom.Rectangle.Contains
    );
    sprite.input!.cursor = 'pointer';
    sprite.setData('subjectId', id);
    sprite.play(idleAnimKey(role));

    const data: Subject = {
      id,
      name,
      role,
      houseId,
      activity: slot.activity,
      activityLabel: slot.label,
      zone: slot.zone,
      hp,
      maxHp,
      onWall: Boolean(opts?.onWall),
    };

    const managed: ManagedSubject = {
      data,
      sprite,
      moving: false,
      fleeCooldownMs: 0,
      interrupt: null,
    };
    this.applyHpTint(managed);
    this.subjects.push(managed);
  }

  private removeSubject(managed: ManagedSubject): void {
    if (this.selectedId === managed.data.id) {
      this.select(null);
      this.scene.game.events.emit(KingdomEvents.SUBJECT_SELECTED, null);
    }
    managed.sprite.destroy();
    this.subjects = this.subjects.filter((s) => s !== managed);
  }

  private applyHpTint(managed: ManagedSubject): void {
    if (this.selectedId === managed.data.id) return;
    const ratio = managed.data.hp / managed.data.maxHp;
    if (ratio <= 0.35) managed.sprite.setTint(0xff6666);
    else managed.sprite.clearTint();
  }

  private clearSubjects(): void {
    for (const s of this.subjects) {
      s.sprite.destroy();
    }
    this.subjects = [];
    this.selectedId = null;
    this.marker?.setVisible(false);
  }

  private ensureMarker(): void {
    if (this.marker) return;
    this.marker = this.scene.add
      .circle(0, 0, 6, 0xf4efe4, 0.35)
      .setStrokeStyle(1, 0xd4a84b)
      .setDepth(19)
      .setVisible(false);
  }

  private syncActivities(): void {
    if (this.raidMode) return;
    for (const managed of this.subjects) {
      if (managed.interrupt) continue;
      const slot = slotAtHour(managed.data.role, this.clock.hour);
      managed.data.activity = slot.activity;
      managed.data.activityLabel = slot.label;
      managed.data.zone = slot.zone;
    }
  }

  private nudgeTowardSchedule(managed: ManagedSubject): void {
    if (!managed.sprite.active || managed.moving || managed.data.onWall) return;
    if (managed.interrupt) return;

    const slot = slotAtHour(managed.data.role, this.clock.hour);
    managed.data.activity = slot.activity;
    managed.data.activityLabel = slot.label;
    managed.data.zone = slot.zone;

    const home = this.buildings?.getHousePoint(managed.data.houseId) ?? null;
    const target = randomPointInZone(slot.zone, this.world, home);
    this.nudgeToward(managed.data.id, target.x, target.y, 40);
  }

  private toSnapshot(managed: ManagedSubject): SubjectSnapshot {
    return {
      id: managed.data.id,
      name: managed.data.name,
      role: managed.data.role,
      roleLabel: roleLabel(managed.data.role),
      activityLabel: managed.data.activityLabel,
      homeLabel: managed.data.houseId
        ? (this.buildings?.houseLabel(managed.data.houseId) ?? 'a house')
        : 'no house (orphaned)',
      scheduleSummary: scheduleSummary(managed.data.role),
      dayPhase: this.clock.phase,
      hour: this.clock.hour,
      hp: managed.data.hp,
      maxHp: managed.data.maxHp,
      onWall: managed.data.onWall,
    };
  }
}

function facingFromDelta(dx: number, dy: number): Direction {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx < 0 ? 'left' : 'right';
  }
  return dy < 0 ? 'up' : 'down';
}
