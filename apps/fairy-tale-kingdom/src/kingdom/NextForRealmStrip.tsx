import type { ChallengeAction } from './challenges';
import type { RealmGoal } from './realmGoals';

export type StripGoal =
  | (RealmGoal & { rewardGold?: number })
  | {
      id: string;
      label: string;
      action: ChallengeAction | RealmGoal['action'];
      subjectId?: string;
      rewardGold?: number;
    };

interface NextForRealmStripProps {
  goal: StripGoal | null;
  onAction: (goal: StripGoal) => void;
}

/** Persistent HUD hint under resources — one clear next step. */
export function NextForRealmStrip({ goal, onAction }: NextForRealmStripProps) {
  if (!goal) return null;

  return (
    <div className="next-realm-strip" role="status" aria-live="polite">
      <span className="next-realm-label">
        {goal.rewardGold != null ? 'Challenge' : 'Next'}
      </span>
      <p className="next-realm-text">{goal.label}</p>
      <button
        type="button"
        className="next-realm-cta touch-btn"
        onClick={() => onAction(goal)}
      >
        Go
      </button>
    </div>
  );
}
