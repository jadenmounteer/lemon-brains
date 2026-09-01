import Phaser from 'phaser';
import { PROP_KEYS } from '../art/assetManifest';
import type { SubjectSystem, ManagedSubject } from '../subjects/SubjectSystem';
import type { SpeechBubbleSystem } from '../ui/SpeechBubbleSystem';
import { ringOffset } from '../subjects/zones';
import type { CelebrationVfx } from './CelebrationVfx';

type Beat = 'dance' | 'talk' | 'music' | 'toast' | 'bow';

const CHAT = [
  'What a splendid ball!',
  'May I have this dance?',
  'The keep shines tonight.',
  'Save me a waltz!',
  'Have you tried the tarts?',
];
const TOASTS = ['To the crown!', 'Long live the king!', 'Huzzah!', 'Cheers!'];
const DANCE = ['♪ Twirl! ♪', 'One-two-three!', 'Dance with me!', 'Whee!'];
const MUSIC = ['That melody!', 'The lute is lovely.', 'Encore!'];
const BOW = ['Your Majesty.', 'A deep bow.', 'Most honored.'];

/** Courtyard revelry while a royal ball is active — props, dance, chatter. */
export class BallFunSystem {
  private active = false;
  private venue = { x: 0, y: 0 };
  private beatMs = 0;
  private props: Phaser.GameObjects.Image[] = [];
  private vfx: CelebrationVfx | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly subjects: SubjectSystem,
    private readonly bubbles: SpeechBubbleSystem
  ) {}

  setVfx(vfx: CelebrationVfx): void {
    this.vfx = vfx;
  }

  start(x: number, y: number): void {
    this.stop();
    this.active = true;
    this.venue = { x, y };
    this.beatMs = 0;
    this.spawnProps(x, y);
  }

  stop(): void {
    this.active = false;
    for (const p of this.props) p.destroy();
    this.props = [];
  }

  update(deltaMs: number): void {
    if (!this.active) return;
    this.beatMs -= deltaMs;
    if (this.beatMs > 0) return;
    this.beatMs = 2200 + Math.random() * 1600;

    const guests = this.subjects
      .listManaged()
      .filter((s) => s.data.activity === 'ball' && s.sprite.active);
    if (guests.length === 0) return;

    const beat: Beat = (['dance', 'talk', 'music', 'toast', 'bow'] as Beat[])[
      Math.floor(Math.random() * 5)
    ]!;

    guests.forEach((s, i) => {
      const off = ringOffset(i, guests.length, 36);
      const jitter = ((i * 19) % 9) - 4;
      const dest = this.subjects.snapToWalkable(
        this.venue.x + off.x + jitter,
        this.venue.y + off.y + ((i * 11) % 7) - 3
      );
      // Soft reshuffle so the courtyard feels alive without stampeding
      if (Math.random() < 0.55 && !s.moving) {
        this.subjects.nudgeToward(s.data.id, dest.x, dest.y, 32);
      }
      this.applyBeat(s, beat);
    });

    if (beat === 'talk' && guests.length >= 2) {
      const a = guests[Math.floor(Math.random() * guests.length)]!;
      let b = guests[Math.floor(Math.random() * guests.length)]!;
      if (b.data.id === a.data.id) b = guests[(guests.indexOf(a) + 1) % guests.length]!;
      const line = CHAT[Math.floor(Math.random() * CHAT.length)]!;
      this.bubbles.say(a.sprite, line);
      this.bubbles.say(b.sprite, 'Indeed!');
      a.data.thought = line;
      b.data.thought = 'Indeed!';
    } else if (beat === 'toast') {
      const s = guests[Math.floor(Math.random() * guests.length)]!;
      const line = TOASTS[Math.floor(Math.random() * TOASTS.length)]!;
      this.bubbles.say(s.sprite, line);
      s.data.thought = line;
      this.vfx?.confettiBurst(s.sprite.x, s.sprite.y - 14);
    } else if (beat === 'music') {
      const s = guests[Math.floor(Math.random() * guests.length)]!;
      const line = MUSIC[Math.floor(Math.random() * MUSIC.length)]!;
      this.bubbles.say(s.sprite, line);
      s.data.thought = line;
    } else if (beat === 'dance') {
      const s = guests[Math.floor(Math.random() * guests.length)]!;
      const line = DANCE[Math.floor(Math.random() * DANCE.length)]!;
      this.bubbles.say(s.sprite, line);
      s.data.thought = line;
    } else if (beat === 'bow') {
      const s = guests[Math.floor(Math.random() * guests.length)]!;
      const line = BOW[Math.floor(Math.random() * BOW.length)]!;
      this.bubbles.say(s.sprite, line);
      s.data.thought = line;
    }
  }

  private applyBeat(s: ManagedSubject, beat: Beat): void {
    switch (beat) {
      case 'dance':
        s.data.activityLabel = 'Dancing at the royal ball';
        if (!s.moving) {
          this.subjects.playCelebrateAnim(s.data.id, 'dance');
        }
        break;
      case 'talk':
        s.data.activityLabel = 'Chatting at the ball';
        break;
      case 'music':
        s.data.activityLabel = 'Enjoying the music';
        break;
      case 'toast':
        s.data.activityLabel = 'Toasting the crown';
        if (!s.moving) {
          this.subjects.playCelebrateAnim(s.data.id, 'cheer');
        }
        break;
      case 'bow':
        s.data.activityLabel = 'Paying respects';
        if (!s.moving) {
          this.subjects.playCelebrateAnim(s.data.id, 'bow');
        }
        break;
    }
  }

  private spawnProps(x: number, y: number): void {
    const add = (key: string, px: number, py: number, depth = 6) => {
      if (!this.scene.textures.exists(key)) return;
      const img = this.scene.add
        .image(px, py, key)
        .setDepth(depth)
        .setOrigin(0.5, 0.85);
      this.props.push(img);
    };
    add(PROP_KEYS.venueBall, x, y - 6, 7);
    add(PROP_KEYS.ballTable, x, y + 10, 5);
    add(PROP_KEYS.venueBall, x - 42, y + 4, 6);
    add(PROP_KEYS.venueBall, x + 42, y + 4, 6);
    add(PROP_KEYS.ballTable, x - 28, y + 18, 5);
    add(PROP_KEYS.ballTable, x + 28, y + 18, 5);
  }
}
