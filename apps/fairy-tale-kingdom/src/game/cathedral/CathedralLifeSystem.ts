import Phaser from 'phaser';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import {
  cathedralBishopSpot,
  cathedralDoor,
  cathedralPewSpot,
} from '../buildings/layouts/CathedralLayout';
import type { WeddingCeremonySystem } from '../events/WeddingCeremonySystem';
import { KingdomEvents } from '../subjects/events';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import type { SpeechBubbleSystem } from '../ui/SpeechBubbleSystem';

const PRAYER_LINES = [
  'Lord, bless this realm.',
  'Grant us peace this day.',
  'We give thanks for bread and shelter.',
  'Watch over our keep.',
];

const WISH_LINES = [
  'Please grant my wish to become a',
  'I pray for a new calling…',
  'Surely the heavens hear my plea…',
];

/** Idle prayer, wish hints, and interior cathedral life when no wedding runs. */
export class CathedralLifeSystem {
  private beatMs = 0;
  private wishBeatMs = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly subjects: SubjectSystem,
    private readonly buildings: BuildingSystem,
    private readonly bubbles: SpeechBubbleSystem,
    private readonly wedding: WeddingCeremonySystem
  ) {}

  update(deltaMs: number): void {
    if (this.wedding.isActive()) return;

    this.beatMs -= deltaMs;
    if (this.beatMs <= 0) {
      this.beatMs = 6000 + Math.random() * 5000;
      this.tickPrayer();
    }

    this.wishBeatMs -= deltaMs;
    if (this.wishBeatMs <= 0) {
      this.wishBeatMs = 9000 + Math.random() * 7000;
      this.tickWishPrayer();
    }
  }

  private nearestCathedral(): { x: number; y: number } | null {
    const list = this.buildings.list().filter((b) => b.kind === 'cathedral' && b.hp > 0);
    if (list.length === 0) return null;
    const keep = this.buildings.getActiveKeepPoint();
    let best = list[0]!;
    let bestD = Infinity;
    for (const b of list) {
      const d = Math.hypot(b.x - keep.x, b.y - keep.y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  private tickPrayer(): void {
    const cathedral = this.nearestCathedral();
    if (!cathedral) return;

    const worshippers = this.subjects
      .listManaged()
      .filter(
        (s) =>
          s.sprite.active &&
          s.data.zone === 'cathedral' &&
          !s.moving &&
          !s.interrupt &&
          (s.data.role === 'bishop' ||
            s.data.role === 'peasant' ||
            s.data.role === 'witch_hunter')
      );
    if (worshippers.length === 0) return;

    const star = worshippers[Math.floor(Math.random() * worshippers.length)]!;
    const line =
      star.data.role === 'bishop'
        ? 'Let us pray together.'
        : PRAYER_LINES[Math.floor(Math.random() * PRAYER_LINES.length)]!;
    this.bubbles.say(star.sprite, line);
    star.data.thought = line;
    this.subjects.playPrayAnim(star.data.id);

    if (star.data.role === 'bishop') {
      const pt = cathedralBishopSpot(cathedral, star.data.id);
      this.subjects.nudgeToward(star.data.id, pt.x, pt.y, 28);
    } else {
      const side = star.data.gender === 'female' ? 'right' : 'left';
      const row = Math.abs(star.data.id.charCodeAt(0)) % 3;
      const pt = cathedralPewSpot(cathedral, side, row, star.data.id);
      this.subjects.nudgeToward(star.data.id, pt.x, pt.y, 28);
    }
  }

  private tickWishPrayer(): void {
    const cathedral = this.nearestCathedral();
    if (!cathedral) return;

    const hopeful = this.subjects
      .listManaged()
      .filter(
        (s) =>
          s.sprite.active &&
          s.data.goal &&
          s.data.role === 'peasant' &&
          !s.interrupt &&
          !s.moving
      );
    if (hopeful.length === 0) return;

    const star = hopeful[Math.floor(Math.random() * hopeful.length)]!;
    const wishRole =
      star.data.goal?.targetRole ?? star.data.goal?.kind.replace(/_/g, ' ');
    const prefix = WISH_LINES[Math.floor(Math.random() * WISH_LINES.length)]!;
    const line = `${prefix} ${wishRole}!`;
    this.bubbles.say(star.sprite, line);
    star.data.thought = line;
    this.subjects.playPrayAnim(star.data.id);

    const door = cathedralDoor(cathedral);
    this.subjects.nudgeToward(star.data.id, door.x, door.y - 6, 40);

    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${star.data.name} is praying for a new calling at the cathedral`,
    });
  }
}
