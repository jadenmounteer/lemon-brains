import type { BuildingSystem } from '../buildings/BuildingSystem';
import { KEEP_ID } from '../buildings/BuildingSystem';
import type { SubjectSystem, ManagedSubject } from '../subjects/SubjectSystem';
import type { SpeechBubbleSystem } from '../ui/SpeechBubbleSystem';
import { roomPoint, type KeepRoomId } from './KeepLayout';

type Beat =
  | 'talk'
  | 'bow'
  | 'serve'
  | 'scrub'
  | 'knead'
  | 'court'
  | 'juggle';

const LINES: Record<Beat, string[]> = {
  talk: [
    'Have you heard the petitions?',
    'The hall looks fine today.',
    'Pass the salt, would you?',
    'Long live the crown.',
  ],
  bow: ['Your Majesty.', 'A deep bow.', 'As you command.'],
  serve: ['Fresh from the kitchen!', 'More wine?', 'The feast is ready.'],
  scrub: ['Spotless floors.', 'Almost done…', 'Dust never sleeps.'],
  knead: ['Knead, knead!', 'Loaves for supper.', 'The oven is hot.'],
  court: ['Next petition!', 'The realm listens.', 'Speak your case.'],
  juggle: ['♪ Catch!', 'For the court!', 'Huzzah!'],
};

/** Ambient castle chatter and soft room nudges while folk occupy the keep. */
export class KeepLifeSystem {
  private beatMs = 0;

  constructor(
    private readonly subjects: SubjectSystem,
    private readonly buildings: BuildingSystem,
    private readonly bubbles: SpeechBubbleSystem
  ) {}

  update(deltaMs: number): void {
    this.beatMs -= deltaMs;
    if (this.beatMs > 0) return;
    this.beatMs = 5200 + Math.random() * 3800;

    const keep = this.buildings.getById(KEEP_ID);
    if (!keep) return;

    const inside = this.subjects
      .listManaged()
      .filter(
        (s) =>
          s.sprite.active &&
          s.data.zone === 'keep' &&
          !s.moving &&
          s.data.allegiance !== 'camp' &&
          s.data.activity !== 'festival' &&
          s.data.activity !== 'ball' &&
          // Don't yank farmers/guards who are just visiting the keep zone
          (s.data.job === undefined ||
            s.data.job === 'cook' ||
            s.data.job === 'servant' ||
            s.data.job === 'steward' ||
            s.data.job === 'scribe' ||
            s.data.job === 'cupbearer' ||
            ['king', 'queen', 'prince', 'princess', 'duke', 'duchess', 'jester', 'fairy_godmother'].includes(
              s.data.role
            ))
      );
    if (inside.length === 0) return;

    const beat = this.pickBeat(inside);
    const actors = inside.filter((s) => this.matchesBeat(s, beat));
    // Only nudge/speak for people whose schedule matches the beat
    const pool = actors.length ? actors : [];
    if (pool.length === 0) return;
    const star = pool[Math.floor(Math.random() * pool.length)]!;
    const line =
      LINES[beat][Math.floor(Math.random() * LINES[beat].length)]!;
    this.bubbles.say(star.sprite, line);
    star.data.thought = line;

    if (Math.random() < 0.22 && !star.moving) {
      const room = this.nudgeRoom(star, beat);
      const dest = roomPoint(keep, room, star.data.id);
      this.subjects.nudgeToward(star.data.id, dest.x, dest.y, 28);
    }

    if (beat === 'talk' && pool.length >= 2) {
      let other = pool[Math.floor(Math.random() * pool.length)]!;
      if (other.data.id === star.data.id) {
        other = pool[(pool.indexOf(star) + 1) % pool.length]!;
      }
      this.bubbles.say(other.sprite, 'Indeed!');
      other.data.thought = 'Indeed!';
    }
  }

  private pickBeat(inside: ManagedSubject[]): Beat {
    const acts = new Set(inside.map((s) => s.data.activity));
    if (acts.has('knead') || acts.has('cook')) return 'knead';
    if (acts.has('serve') || acts.has('feast')) return 'serve';
    if (acts.has('clean')) return 'scrub';
    if (acts.has('court')) return 'court';
    if (acts.has('juggle')) return 'juggle';
    if (
      inside.some((s) =>
        ['king', 'queen', 'duke', 'duchess'].includes(s.data.role)
      )
    ) {
      return Math.random() < 0.4 ? 'bow' : 'talk';
    }
    return 'talk';
  }

  private matchesBeat(s: ManagedSubject, beat: Beat): boolean {
    switch (beat) {
      case 'knead':
        return s.data.activity === 'knead' || s.data.activity === 'cook';
      case 'serve':
        return s.data.activity === 'serve' || s.data.activity === 'feast';
      case 'scrub':
        return s.data.activity === 'clean';
      case 'court':
        return s.data.activity === 'court';
      case 'juggle':
        return s.data.activity === 'juggle';
      case 'bow':
        return ['king', 'queen', 'duke', 'duchess'].includes(s.data.role);
      default:
        return true;
    }
  }

  private nudgeRoom(_s: ManagedSubject, beat: Beat): KeepRoomId {
    switch (beat) {
      case 'knead':
        return 'kitchen';
      case 'serve':
        return 'banquet';
      case 'scrub':
        return 'great_hall';
      case 'court':
      case 'bow':
        return 'great_hall';
      case 'juggle':
        return 'courtyard';
      default:
        return 'great_hall';
    }
  }
}
