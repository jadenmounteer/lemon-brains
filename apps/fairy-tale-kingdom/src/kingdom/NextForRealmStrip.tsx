import type { RealmGoal } from './realmGoals';

interface NextForRealmStripProps {
  goal: RealmGoal | null;
  onAction: (goal: RealmGoal) => void;
}

/** Persistent HUD hint under resources — one clear next step. */
export function NextForRealmStrip({ goal, onAction }: NextForRealmStripProps) {
  if (!goal) return null;

  return (
    <div className="next-realm-strip" role="status" aria-live="polite">
      <span className="next-realm-label">Next</span>
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
