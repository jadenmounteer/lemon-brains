import Phaser from 'phaser';
import {
  UNIT_HEIGHT,
  UNIT_WIDTH,
  idleAnimKey,
  walkAnimKey,
  type Direction,
  type UnitRole,
} from '../art/assetManifest';
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

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: WorldBounds
  ) {}

  spawn(): void {
    SEED_ROLES.forEach((role, index) => {
      const homeIndex = index % 2;
      const id = `subject-${index}`;
      const name = pickName(1000 + index * 97);
      const slot = slotAtHour(role, this.clock.hour);
      const start = randomPointInZone(slot.zone, homeIndex, this.world);

      const sprite = this.scene.add.sprite(start.x, start.y, role, 0);
      sprite.setDepth(20);
      sprite.setOrigin(0.5, 1);
      // Generous hit box — small pixels are hard to click at zoom 2
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
        homeIndex,
        activity: slot.activity,
        activityLabel: slot.label,
        zone: slot.zone,
      };

      this.subjects.push({ data, sprite, moving: false });

      this.scene.time.delayedCall(300 + index * 250, () => {
        this.nudgeTowardSchedule(this.subjects[index]!);
      });
    });

    this.marker = this.scene.add
      .circle(0, 0, 6, 0xf4efe4, 0.35)
      .setStrokeStyle(1, 0xd4a84b)
      .setDepth(19)
      .setVisible(false);
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

  /** Advance clock and refresh activities; move idle subjects toward schedule zones. */
  update(deltaMs: number): void {
    this.clock.tick(deltaMs);
    this.syncActivities();

    // Smooth HUD clock (~1s) + night overlay consumers
    this.dayEmitAccumMs += deltaMs;
    if (this.dayEmitAccumMs >= 1000) {
      this.dayEmitAccumMs = 0;
      this.scene.game.events.emit(KingdomEvents.DAY_TICK, {
        dayPhase: this.clock.phase,
        hour: this.clock.hour,
      });
    }

    // Periodically nudge non-moving subjects
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

    const target = randomPointInZone(
      slot.zone,
      managed.data.homeIndex,
      this.world
    );
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
