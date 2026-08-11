import { isSpherePatrolRole } from '../art/assetManifest';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import type { SpeechBubbleSystem } from '../ui/SpeechBubbleSystem';

const CHATTER_MS = 5200;

const PEACETIME_LINES = [
  'All clear on this street.',
  'Nothing amiss on patrol.',
  'Quiet watch tonight.',
  'Roads look safe.',
  'No trouble to report.',
];

/**
 * Peacetime flavor for guards/soldiers/archers/knights/elites while they patrol their home
 * sphere (dungeon or barracks, wired up via `SubjectSystem.pickPatrolTarget`). This system
 * doesn't move anyone — it just has a patrolling unit call out the all-clear now and then,
 * and stays quiet during raids or a `SecuritySystem` cordon so it doesn't clutter urgent
 * chatter.
 */
export class MilitaryPatrolSystem {
  private chatterMs = CHATTER_MS;

  constructor(
    private readonly subjects: SubjectSystem,
    private readonly bubbles: SpeechBubbleSystem
  ) {}

  update(deltaMs: number, raidActive: boolean, cordonActive: boolean): void {
    this.chatterMs -= deltaMs;
    if (this.chatterMs > 0) return;
    this.chatterMs = CHATTER_MS + Math.random() * 2600;
    if (raidActive || cordonActive) return;

    const patrollers = this.subjects
      .listManaged()
      .filter(
        (s) =>
          isSpherePatrolRole(s.data.role) &&
          s.data.activity === 'patrol' &&
          !s.interrupt &&
          s.sprite.active
      );
    if (!patrollers.length) return;

    const s = patrollers[Math.floor(Math.random() * patrollers.length)]!;
    const line = PEACETIME_LINES[Math.floor(Math.random() * PEACETIME_LINES.length)]!;
    this.bubbles.say(s.sprite, line);
    s.data.thought = line;
  }
}
