import Phaser from 'phaser';
import { PROP_KEYS } from '../art/assetManifest';
import { KingdomEvents } from '../subjects/events';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import type { SpeechBubbleSystem } from '../ui/SpeechBubbleSystem';
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
  private horses = new Map<string, Phaser.GameObjects.Image>();
  private clashFlash: Phaser.GameObjects.Rectangle | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly subjects: SubjectSystem,
    private readonly bubbles: SpeechBubbleSystem
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
      this.attachHorse(id);
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
    this.active = false;
    this.stage = 'idle';
    for (const h of this.horses.values()) h.destroy();
    this.horses.clear();
    this.clashFlash?.destroy();
    this.clashFlash = null;
    this.knightIds = [];
  }

  update(deltaMs: number): void {
    if (!this.active) return;
    this.syncHorses();
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
        // Loop another pass while the festival lasts
        this.stage = 'mount';
        this.stageMs = 2200;
        break;
      default:
        break;
    }
  }

  /** Optional mounted trot while knights patrol outside combat. */
  updateMountedPatrol(): void {
    for (const s of this.subjects.listManaged()) {
      if (s.data.role !== 'knight') continue;
      if (s.data.activity !== 'patrol') {
        this.detachHorse(s.data.id);
        continue;
      }
      if (this.knightIds.includes(s.data.id)) continue; // joust owns them
      if (!this.horses.has(s.data.id)) this.attachHorse(s.data.id);
    }
    this.syncHorses();
  }

  private gatherCrowd(): void {
    const crowd = this.subjects
      .listManaged()
      .filter(
        (s) =>
          s.sprite.active &&
          !this.knightIds.includes(s.data.id) &&
          s.data.allegiance !== 'camp'
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
    });
  }

  private beginCharge(): void {
    const [aId, bId] = this.knightIds;
    const a = aId ? this.subjects.getById(aId) : null;
    const b = bId ? this.subjects.getById(bId) : null;
    if (a) {
      a.data.activityLabel = 'Charging down the lists';
      this.subjects.nudgeToward(
        a.data.id,
        this.venue.x - 50,
        this.venue.y,
        70
      );
    }
    if (b) {
      b.data.activityLabel = 'Charging down the lists';
      this.subjects.nudgeToward(
        b.data.id,
        this.venue.x + 50,
        this.venue.y,
        70
      );
    }
  }

  private doClash(): void {
    this.clashFlash?.destroy();
    this.clashFlash = this.scene.add
      .rectangle(this.venue.x, this.venue.y, 24, 16, 0xfff2a8, 0.85)
      .setDepth(12);
    this.scene.tweens.add({
      targets: this.clashFlash,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: 400,
      onComplete: () => {
        this.clashFlash?.destroy();
        this.clashFlash = null;
      },
    });
    for (const id of this.knightIds) {
      const m = this.subjects.getById(id);
      if (m) m.data.activityLabel = 'Lances clash!';
    }
  }

  private cheerWinner(): void {
    const winnerId =
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
        if (Math.random() < 0.35) this.bubbles.say(s.sprite, 'Huzzah!');
      }
    }
  }

  private attachHorse(knightId: string): void {
    if (this.horses.has(knightId)) return;
    if (!this.scene.textures.exists(PROP_KEYS.horse)) return;
    const m = this.subjects.getById(knightId);
    if (!m) return;
    const horse = this.scene.add
      .image(m.sprite.x, m.sprite.y + 2, PROP_KEYS.horse)
      .setDepth(m.sprite.depth - 1)
      .setOrigin(0.5, 0.85);
    this.horses.set(knightId, horse);
  }

  private detachHorse(knightId: string): void {
    const h = this.horses.get(knightId);
    if (!h) return;
    h.destroy();
    this.horses.delete(knightId);
  }

  private syncHorses(): void {
    for (const [id, horse] of this.horses) {
      const m = this.subjects.getById(id);
      if (!m || !m.sprite.active) {
        horse.destroy();
        this.horses.delete(id);
        continue;
      }
      horse.setPosition(m.sprite.x - 2, m.sprite.y + 4);
      horse.setDepth(m.sprite.depth - 1);
      horse.setFlipX(m.sprite.flipX);
    }
  }
}
