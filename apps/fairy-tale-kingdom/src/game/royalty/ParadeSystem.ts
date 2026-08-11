import Phaser from 'phaser';
import { PROP_KEYS } from '../art/assetManifest';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import { Phase12Balance } from '../economy/phase12Balance';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import { KingdomEvents } from '../subjects/events';

/**
 * Lightweight royal parade: carriage rides a path from the keep while
 * peasants line the street and get a happiness bump.
 */
export class ParadeSystem {
  private cooldownMs = Phase12Balance.paradeCooldownMs * 0.35;
  private remainingMs = 0;
  private carriage: Phaser.GameObjects.Image | null = null;
  private path: { x: number; y: number }[] = [];
  private pathIndex = 0;
  private linedIds = new Set<string>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly subjects: SubjectSystem,
    private readonly buildings: BuildingSystem
  ) {}

  isActive(): boolean {
    return this.remainingMs > 0;
  }

  serialize(): { paradeCooldownMs: number; paradeRemainingMs: number } {
    return {
      paradeCooldownMs: this.cooldownMs,
      paradeRemainingMs: this.remainingMs,
    };
  }

  restore(cooldownMs?: number, remainingMs?: number): void {
    if (typeof cooldownMs === 'number') this.cooldownMs = cooldownMs;
    if (typeof remainingMs === 'number') this.remainingMs = remainingMs;
  }

  update(deltaMs: number, peacetime: boolean): void {
    if (this.remainingMs > 0) {
      this.tickActive(deltaMs);
      return;
    }

    this.cooldownMs = Math.max(0, this.cooldownMs - deltaMs);
    if (!peacetime || this.cooldownMs > 0) return;
    if (!this.subjects.hasRole('king')) return;

    const hour = this.subjects.clock.hour;
    // King schedule reserves 12–14 for procession
    if (hour < 12 || hour >= 14) return;

    this.startParade();
  }

  private startParade(): void {
    const keep = this.buildings.getActiveKeepPoint();
    this.path = buildParadePath(keep);
    this.pathIndex = 0;
    this.remainingMs = Phase12Balance.paradeDurationMs;
    this.cooldownMs = Phase12Balance.paradeCooldownMs;

    this.carriage?.destroy();
    this.carriage = this.scene.add
      .image(keep.x, keep.y + 8, PROP_KEYS.carriage)
      .setDepth(25)
      .setOrigin(0.5, 0.85);

    this.linedIds.clear();
    for (const s of this.subjects.listManaged()) {
      if (s.data.role !== 'peasant' || s.data.sick) continue;
      if (s.interrupt) continue;
      s.interrupt = {
        kind: 'line_street',
        remainingMs: Phase12Balance.paradeDurationMs,
      };
      s.data.activity = 'line_street';
      s.data.activityLabel = 'Lining the street for the parade';
      this.linedIds.add(s.data.id);
      bumpHappiness(s, Phase12Balance.lineStreetHappiness);
      const spot = this.path[Math.min(2, this.path.length - 1)]!;
      const ox = (Math.random() - 0.5) * 40;
      this.subjects.nudgeToward(s.data.id, spot.x + ox, spot.y + 18, 50);
    }

    // King rides along
    const king = this.subjects.firstByRole('king');
    if (king && !king.interrupt) {
      king.interrupt = {
        kind: 'parade',
        remainingMs: Phase12Balance.paradeDurationMs,
      };
      king.data.activity = 'parade';
      king.data.activityLabel = 'Riding in the royal parade';
      bumpHappiness(king, Phase12Balance.paradeHappiness);
    }

    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: 'A royal parade rolls through the streets!',
    });
  }

  private tickActive(deltaMs: number): void {
    this.remainingMs -= deltaMs;
    if (this.carriage && this.path.length) {
      const target = this.path[Math.min(this.pathIndex, this.path.length - 1)]!;
      const dx = target.x - this.carriage.x;
      const dy = target.y - this.carriage.y;
      const dist = Math.hypot(dx, dy);
      const step = (48 * deltaMs) / 1000;
      if (dist <= step) {
        this.carriage.setPosition(target.x, target.y);
        if (this.pathIndex < this.path.length - 1) this.pathIndex += 1;
      } else {
        this.carriage.x += (dx / dist) * step;
        this.carriage.y += (dy / dist) * step;
      }
      const king = this.subjects.firstByRole('king');
      if (king?.interrupt?.kind === 'parade') {
        king.sprite.setPosition(this.carriage.x, this.carriage.y - 4);
      }
    }

    if (this.remainingMs <= 0) {
      this.endParade();
    }
  }

  private endParade(): void {
    this.remainingMs = 0;
    this.carriage?.destroy();
    this.carriage = null;
    this.path = [];
    this.pathIndex = 0;

    for (const id of this.linedIds) {
      const s = this.subjects.getById(id);
      if (s?.interrupt?.kind === 'line_street') {
        this.subjects.clearInterrupt(id);
      }
    }
    this.linedIds.clear();

    const king = this.subjects.firstByRole('king');
    if (king?.interrupt?.kind === 'parade') {
      this.subjects.clearInterrupt(king.data.id);
    }

    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: 'The royal parade returns to the keep',
    });
  }
}

function buildParadePath(keep: { x: number; y: number }): { x: number; y: number }[] {
  return [
    { x: keep.x, y: keep.y + 10 },
    { x: keep.x + 80, y: keep.y + 10 },
    { x: keep.x + 80, y: keep.y + 90 },
    { x: keep.x - 40, y: keep.y + 90 },
    { x: keep.x - 40, y: keep.y + 20 },
    { x: keep.x, y: keep.y + 10 },
  ];
}

function bumpHappiness(
  managed: { data: { id: string; happiness?: number } },
  amount: number
): void {
  const subjectsAny = managed as {
    data: { happiness?: number };
  };
  if (typeof subjectsAny.data.happiness === 'number') {
    subjectsAny.data.happiness = Math.min(
      100,
      subjectsAny.data.happiness + amount
    );
  }
}
