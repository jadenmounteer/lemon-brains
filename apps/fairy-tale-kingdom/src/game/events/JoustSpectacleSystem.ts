import Phaser from 'phaser';
import { isMilitaryRole } from '../art/assetManifest';
import { KingdomEvents } from '../subjects/events';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import type { SpeechBubbleSystem } from '../ui/SpeechBubbleSystem';
import type { CelebrationVfx } from './CelebrationVfx';
import type { SiegeVfx } from '../siege/SiegeVfx';
import type { HorseMountSystem } from '../war/HorseMountSystem';
import { ringOffset } from '../subjects/zones';

type Stage = 'mount' | 'charge' | 'clash' | 'cheer' | 'idle';

/**
 * Mounted joust when a joust venue is live and ≥2 knights are present.
 */
export class JoustSpectacleSystem {
  private active = false;
  private venue = { x: 0, y: 0 };
  private stage: Stage = 'idle';
  private stageMs = 0;
  private knightIds: string[] = [];
  private loserId: string | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly subjects: SubjectSystem,
    private readonly bubbles: SpeechBubbleSystem,
    private readonly mounts: HorseMountSystem,
    private readonly celebrationVfx: CelebrationVfx | null = null,
    private readonly siegeVfx: SiegeVfx | null = null
  ) {}

  start(x: number, y: number): void {
    this.stop();
    this.active = true;
    this.venue = { x, y };
    this.stage = 'mount';
    this.stageMs = 2500;
    this.knightIds = this.subjects
      .listManaged()
      .filter((s) => s.data.role === 'knight' && s.sprite.active)
      .slice(0, 2)
      .map((s) => s.data.id);
    if (this.knightIds.length < 2) {
      this.active = false;
      return;
    }
    for (const id of this.knightIds) {
      this.mounts.reserve(id);
      this.mounts.attach(id, 'trot');
      const m = this.subjects.getById(id);
      if (!m) continue;
      m.data.activity = 'joust';
      m.data.activityLabel = 'Mounting for the joust';
    }
    this.gatherCrowd();
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: 'Knights mount for the royal joust!',
    });
  }

  stop(): void {
    if (!this.active && this.knightIds.length === 0) return;
    this.active = false;
    this.stage = 'idle';
    for (const id of this.knightIds) {
      this.mounts.unreserve(id);
      this.mounts.detach(id);
    }
    this.subjects.clearGatherActivities(['festival', 'joust']);
    this.knightIds = [];
    this.loserId = null;
  }

  update(deltaMs: number): void {
    if (!this.active) return;
    this.mounts.syncAll();
    this.stageMs -= deltaMs;
    if (this.stageMs > 0) return;

    switch (this.stage) {
      case 'mount':
        this.stage = 'charge';
        this.stageMs = 3200;
        this.beginCharge();
        break;
      case 'charge':
        this.stage = 'clash';
        this.stageMs = 900;
        this.doClash();
        break;
      case 'clash':
        this.stage = 'cheer';
        this.stageMs = 4000;
        this.cheerWinner();
        break;
      case 'cheer':
        this.stage = 'mount';
        this.stageMs = 2200;
        this.loserId = null;
        break;
      default:
        break;
    }
  }

  private gatherCrowd(): void {
    const crowd = this.subjects
      .listManaged()
      .filter(
        (s) =>
          s.sprite.active &&
          !this.knightIds.includes(s.data.id) &&
          s.data.allegiance !== 'camp' &&
          !isMilitaryRole(s.data.role)
      )
      .slice(0, 10);
    crowd.forEach((s, i) => {
      s.data.activity = 'festival';
      s.data.activityLabel = 'Watching the joust';
      const off = ringOffset(i, crowd.length, 70);
      const dest = this.subjects.snapToWalkable(
        this.venue.x + off.x,
        this.venue.y + 40 + off.y * 0.4
      );
      this.subjects.nudgeToward(s.data.id, dest.x, dest.y, 45);
      if (!s.moving) {
        this.subjects.playCelebrateAnim(s.data.id, 'cheer');
      }
    });
  }

  private beginCharge(): void {
    const [aId, bId] = this.knightIds;
    const a = aId ? this.subjects.getById(aId) : null;
    const b = bId ? this.subjects.getById(bId) : null;
    for (const id of this.knightIds) {
      this.mounts.setGallop(id, true);
      this.mounts.setLance(id, true);
    }
    if (a) {
      a.data.activityLabel = 'Charging down the lists';
      this.subjects.nudgeToward(
        a.data.id,
        this.venue.x - 50,
        this.venue.y,
        90
      );
    }
    if (b) {
      b.data.activityLabel = 'Charging down the lists';
      this.subjects.nudgeToward(
        b.data.id,
        this.venue.x + 50,
        this.venue.y,
        90
      );
    }
  }

  private doClash(): void {
    this.celebrationVfx?.cheerPulse(this.venue.x, this.venue.y);
    this.siegeVfx?.breachDust(this.venue.x, this.venue.y);
    this.celebrationVfx?.confettiBurst(this.venue.x, this.venue.y - 8);
    this.scene.game.events.emit(KingdomEvents.KINGDOM_EVENT, {
      id: `joust-clash-${Date.now()}`,
      severity: 'joy',
      title: 'Lances clash!',
      detail: 'The tilt erupts in the lists',
      x: this.venue.x,
      y: this.venue.y,
      ttlMs: 8000,
    });
    this.scene.game.events.emit(KingdomEvents.CAMERA_PAN, {
      x: this.venue.x,
      y: this.venue.y,
    });

    const loserIdx = Math.random() < 0.5 ? 0 : 1;
    const loserId = this.knightIds[loserIdx] ?? null;
    const winnerId = this.knightIds[1 - loserIdx] ?? null;
    this.loserId = loserId;

    if (loserId) {
      const loser = this.subjects.getById(loserId);
      if (loser) {
        loser.data.activityLabel = 'Unhorsed in the lists!';
        this.siegeVfx?.hitFlash(loser.sprite);
        this.mounts.setLance(loserId, false);
        this.mounts.knockOff(loserId);
      }
    }
    if (winnerId) {
      const winner = this.subjects.getById(winnerId);
      if (winner) {
        winner.data.activityLabel = 'Lances clash!';
        this.siegeVfx?.hitFlash(winner.sprite);
      }
    }
    this.celebrationVfx?.fireworkPop(this.venue.x, this.venue.y - 16);
  }

  private cheerWinner(): void {
    const winnerId =
      this.knightIds.find((id) => id !== this.loserId) ??
      this.knightIds[Math.floor(Math.random() * this.knightIds.length)];
    const winner = winnerId ? this.subjects.getById(winnerId) : null;
    if (winner) {
      winner.data.activityLabel = 'Victorious in the lists';
      winner.data.happiness = Math.min(100, winner.data.happiness + 10);
      this.bubbles.say(winner.sprite, 'For the realm!');
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: `${winner.data.name} wins the tilt!`,
      });
    }
    for (const s of this.subjects.listManaged()) {
      if (s.data.activityLabel === 'Watching the joust') {
        s.data.happiness = Math.min(100, s.data.happiness + 3);
        if (Math.random() < 0.35) {
          this.bubbles.say(s.sprite, 'Huzzah!');
          this.subjects.playCelebrateAnim(s.data.id, 'cheer');
        }
      }
    }
    for (const id of this.knightIds) {
      if (id === this.loserId) continue;
      this.mounts.setGallop(id, false);
      this.mounts.setLance(id, false);
    }
  }
}
