import type Phaser from 'phaser';
import type { Subject, SubjectInterrupt } from './types';

export type ManagedSubject = {
  data: Subject;
  sprite: Phaser.GameObjects.Sprite;
  moving: boolean;
  fleeCooldownMs: number;
  interrupt: SubjectInterrupt | null;
  /** Active on-site pose: work bob, sleep tilt, or jester juggle loop. */
  presenceAnim: 'work' | 'sleep' | 'knead' | 'merchant' | 'pray' | 'juggle' | null;
  /** Cooldown before another presence speech blurb. */
  presenceBlurbMs: number;
  /** Saved celebration state when threat/duty preempts a guest. */
  savedCelebration?: {
    kind: 'ball' | 'festival' | 'joust' | 'wedding';
    label: string;
    venueX: number;
    venueY: number;
  };
};
