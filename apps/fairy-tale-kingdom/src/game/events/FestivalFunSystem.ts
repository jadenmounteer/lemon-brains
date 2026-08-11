import type { SubjectSystem, ManagedSubject } from '../subjects/SubjectSystem';
import type { SpeechBubbleSystem } from '../ui/SpeechBubbleSystem';
import { ringOffset } from '../subjects/zones';

type Beat = 'dance' | 'talk' | 'music' | 'awe' | 'eat';

const CHAT = [
  'Did you try the bread?',
  'What a night!',
  'Save me a dance!',
  'The bells are lovely.',
];
const CHEERS = ['Ooh!', 'Ahh!', 'Huzzah!', 'More!', 'Yes!'];
const DANCE_LINES = ['♪ Step, step, twirl! ♪', 'Dance with me!', 'Whee!'];
const EAT_LINES = ['Mmm, delicious!', 'More, please!', 'Best feast yet!'];

/** Celebration behaviors while a typed festival is active. */
export class FestivalFunSystem {
  private active = false;
  private venue = { x: 0, y: 0 };
  private beatMs = 0;

  constructor(
    private readonly subjects: SubjectSystem,
    private readonly bubbles: SpeechBubbleSystem
  ) {}

  start(x: number, y: number): void {
    this.active = true;
    this.venue = { x, y };
    this.beatMs = 0;
  }

  stop(): void {
    this.active = false;
  }

  update(deltaMs: number): void {
    if (!this.active) return;
    this.beatMs -= deltaMs;
    if (this.beatMs > 0) return;
    this.beatMs = 2800 + Math.random() * 1800;

    const celebrants = this.subjects
      .listManaged()
      .filter((s) => s.data.activity === 'festival' && s.sprite.active);
    if (celebrants.length === 0) return;

    const beat: Beat = (['dance', 'talk', 'music', 'awe', 'eat'] as Beat[])[
      Math.floor(Math.random() * 5)
    ]!;

    celebrants.forEach((s, i) => {
      const off = ringOffset(i, celebrants.length, 64);
      const jitter = ((i * 17) % 11) - 5;
      const dest = this.subjects.snapToWalkable(
        this.venue.x + off.x + jitter,
        this.venue.y + off.y + ((i * 13) % 9) - 4
      );
      this.subjects.nudgeToward(s.data.id, dest.x, dest.y, 36);
      this.applyBeat(s, beat);
    });

    if (beat === 'talk' && celebrants.length >= 2) {
      const a = celebrants[0]!;
      const b = celebrants[1]!;
      const line = CHAT[Math.floor(Math.random() * CHAT.length)]!;
      this.bubbles.say(a.sprite, line);
      this.bubbles.say(b.sprite, 'Aye!');
      a.data.thought = line;
      b.data.thought = 'Aye!';
    } else if (beat === 'awe') {
      const s = celebrants[Math.floor(Math.random() * celebrants.length)]!;
      const line = CHEERS[Math.floor(Math.random() * CHEERS.length)]!;
      this.bubbles.say(s.sprite, line);
      s.data.thought = line;
    } else if (beat === 'music') {
      const s = celebrants[0]!;
      this.bubbles.say(s.sprite, 'That tune lifts the heart');
      s.data.thought = 'That tune lifts the heart';
    } else if (beat === 'dance') {
      const s = celebrants[Math.floor(Math.random() * celebrants.length)]!;
      const line = DANCE_LINES[Math.floor(Math.random() * DANCE_LINES.length)]!;
      this.bubbles.say(s.sprite, line);
      s.data.thought = line;
    } else if (beat === 'eat') {
      const s = celebrants[Math.floor(Math.random() * celebrants.length)]!;
      const line = EAT_LINES[Math.floor(Math.random() * EAT_LINES.length)]!;
      this.bubbles.say(s.sprite, line);
      s.data.thought = line;
    }
  }

  private applyBeat(s: ManagedSubject, beat: Beat): void {
    switch (beat) {
      case 'dance':
        s.data.activityLabel = 'Dancing at the festival';
        s.sprite.scene.tweens.add({
          targets: s.sprite,
          y: s.sprite.y - 2,
          duration: 180,
          yoyo: true,
          repeat: 3,
        });
        break;
      case 'talk':
        s.data.activityLabel = 'Chatting at the festival';
        break;
      case 'music':
        s.data.activityLabel = 'Playing festival music';
        break;
      case 'awe':
        s.data.activityLabel = 'Cheering the festival';
        break;
      case 'eat':
        s.data.activityLabel = 'Sharing a feast';
        break;
    }
  }
}
