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
import { DayClock } from './DayClock';
import { KingdomEvents } from './events';
import { pickName } from './names';
import { roleLabel, scheduleSummary, slotAtHour } from './schedules';
import type { Subject, SubjectSnapshot } from './types';
import { randomPointInZone, type WorldBounds } from './zones';

export type ManagedSubject = {
  data: Subject;
  sprite: Phaser.GameObjects.Sprite;
  moving: boolean;
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

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: WorldBounds
  ) {}

  setBuildings(buildings: BuildingSystem): void {
    this.buildings = buildings;
  }

  spawnSeed(): void {
    // 3 + 3 across starter houses
    SEED_ROLES.forEach((role, index) => {
      const houseId = index < 3 ? 'house-0' : 'house-1';
      this.createSubject(role, houseId, `subject-${index}`, pickName(1000 + index * 97));
    });
    this.nextSubjectId = SEED_ROLES.length;
    this.ensureMarker();
  }

  restore(saved: SavedSubject[]): void {
    this.clearSubjects();
    for (const s of saved) {
      this.createSubject(s.role, s.houseId, s.id, s.name);
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
    }));
  }

  count(): number {
    return this.subjects.length;
  }

  occupantCounts(): Map<string, number> {
    const map = new Map<string, number>();
    for (const s of this.subjects) {
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
    return true;
  }

  list(): Subject[] {
    return this.subjects.map((s) => s.data);
  }

  getById(id: string): ManagedSubject | undefined {
    return this.subjects.find((s) => s.data.id === id);
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

    for (const managed of this.subjects) {
      if (!managed.moving && Math.random() < deltaMs * 0.0004) {
        this.nudgeTowardSchedule(managed);
      }
    }

    if (this.selectedId && this.marker) {
      const sel = this.getById(this.selectedId);
      if (sel) {
        this.marker.setPosition(sel.sprite.x, sel.sprite.y - 2);
      }
    }
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
    name: string
  ): void {
    const slot = slotAtHour(role, this.clock.hour);
    const home = this.buildings?.getHousePoint(houseId) ?? null;
    const start = randomPointInZone(slot.zone, this.world, home);

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
    };

    this.subjects.push({ data, sprite, moving: false });
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
    for (const managed of this.subjects) {
      const slot = slotAtHour(managed.data.role, this.clock.hour);
      managed.data.activity = slot.activity;
      managed.data.activityLabel = slot.label;
      managed.data.zone = slot.zone;
    }
  }

  private nudgeTowardSchedule(managed: ManagedSubject): void {
    if (!managed.sprite.active || managed.moving) return;

    const slot = slotAtHour(managed.data.role, this.clock.hour);
    managed.data.activity = slot.activity;
    managed.data.activityLabel = slot.label;
    managed.data.zone = slot.zone;

    const home = this.buildings?.getHousePoint(managed.data.houseId) ?? null;
    const target = randomPointInZone(slot.zone, this.world, home);
    const pad = 32;
    const targetX = Phaser.Math.Clamp(target.x, pad, this.world.width - pad);
    const targetY = Phaser.Math.Clamp(target.y, pad, this.world.height - pad);

    const dx = targetX - managed.sprite.x;
    const dy = targetY - managed.sprite.y;
    if (Math.hypot(dx, dy) < 8) {
      managed.sprite.play(idleAnimKey(managed.data.role));
      return;
    }

    const dir = facingFromDelta(dx, dy);
    managed.sprite.play(walkAnimKey(managed.data.role, dir), true);
    managed.moving = true;

    const dist = Math.hypot(dx, dy);
    const duration = Math.max(500, dist * 14);

    this.scene.tweens.add({
      targets: managed.sprite,
      x: targetX,
      y: targetY,
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
      },
    });
  }

  private toSnapshot(managed: ManagedSubject): SubjectSnapshot {
    return {
      id: managed.data.id,
      name: managed.data.name,
      role: managed.data.role,
      roleLabel: roleLabel(managed.data.role),
      activityLabel: managed.data.activityLabel,
      homeLabel: this.buildings?.houseLabel(managed.data.houseId) ?? 'a house',
      scheduleSummary: scheduleSummary(managed.data.role),
      dayPhase: this.clock.phase,
      hour: this.clock.hour,
    };
  }
}

function facingFromDelta(dx: number, dy: number): Direction {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx < 0 ? 'left' : 'right';
  }
  return dy < 0 ? 'up' : 'down';
}
