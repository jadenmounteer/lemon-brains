import Phaser from 'phaser';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import type { ManagedSubject, SubjectSystem } from '../subjects/SubjectSystem';
import type { SpeechBubbleSystem } from '../ui/SpeechBubbleSystem';
import { KingdomEvents } from '../subjects/events';
import { ringOffset } from '../subjects/zones';

export type SecurityEvent = 'zombie' | 'raid' | 'siege' | null;

/** Guard cordons, civilian flee orders, and security dialogue. */
export class SecuritySystem {
  private event: SecurityEvent = null;
  private center = { x: 0, y: 0 };
  private radius = 120;
  private barkMs = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly subjects: SubjectSystem,
    private readonly buildings: BuildingSystem,
    private readonly bubbles: SpeechBubbleSystem
  ) {}

  begin(kind: Exclude<SecurityEvent, null>, x: number, y: number, radius = 140): void {
    // Quarantine / civilian cordons disabled for now — kept as a no-op so callers stay safe.
    void kind;
    void x;
    void y;
    void radius;
  }

  clear(): void {
    if (!this.event) return;
    this.event = null;
    this.subjects.clearGatherActivities(['flee']);
    this.barkGuards('Cordon lifted. Resume patrol.');
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: 'The cordon is lifted.',
    });
  }

  isActive(): boolean {
    return this.event !== null;
  }

  activeKind(): SecurityEvent {
    return this.event;
  }

  inQuarantine(x: number, y: number): boolean {
    if (!this.event) return false;
    return Phaser.Math.Distance.Between(x, y, this.center.x, this.center.y) <= this.radius;
  }

  update(deltaMs: number): void {
    if (!this.event) return;
    this.barkMs -= deltaMs;
    if (this.barkMs > 0) return;
    this.barkMs = 5000 + Math.random() * 4000;
    const lines =
      this.event === 'zombie'
        ? ['Clear the street — zombies!', 'To the keep, now!', 'Quarantine holds!']
        : this.event === 'raid'
          ? ['Get indoors!', 'Hold the road!', 'Civilians clear!']
          : ['Man the walls!', 'Keep the bailey clear!', 'Steady!'];
    this.barkGuards(lines[Math.floor(Math.random() * lines.length)]!);
    this.orderCiviliansFlee();
  }

  private barkGuards(message: string): void {
    for (const s of this.subjects.listManaged()) {
      if (s.data.role !== 'guard' && s.data.role !== 'elite_guard') continue;
      if (Math.random() > 0.45) continue;
      this.bubbles.say(s.sprite, message);
      s.data.thought = message;
      s.data.activityLabel = 'Enforcing a cordon';
    }
  }

  private orderCiviliansFlee(): void {
    const safe =
      this.buildings.getActiveKeepPoint?.() ?? this.buildings.listKeepPoints()[0];
    if (!safe) return;
    const fleeing: ManagedSubject[] = [];
    for (const s of this.subjects.listManaged()) {
      if (
        s.data.role === 'guard' ||
        s.data.role === 'soldier' ||
        s.data.role === 'archer' ||
        s.data.role === 'knight' ||
        s.data.role === 'general' ||
        s.data.role === 'elite_guard' ||
        s.data.role === 'elite_archer'
      ) {
        continue;
      }
      if (!this.inQuarantine(s.sprite.x, s.sprite.y)) continue;
      fleeing.push(s);
    }
    fleeing.forEach((s, i) => {
      const off = ringOffset(i, fleeing.length, 64);
      const dest = this.subjects.snapToWalkable(
        safe.x + off.x,
        safe.y + off.y + 24
      );
      this.subjects.nudgeToward(s.data.id, dest.x, dest.y, 55);
      s.data.activity = 'flee';
      s.data.activityLabel = 'Fleeing the quarantine';
    });
  }
}
