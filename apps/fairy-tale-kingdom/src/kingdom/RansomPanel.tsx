import { RANSOM_COST } from '../game/economy/economy';
import type { CaptiveRecord } from './CaptivesRepository';
import { roleLabel } from '../game/subjects/schedules';

interface RansomPanelProps {
  captives: CaptiveRecord[];
  gold: number;
  onRansom: (id: string, cost: number) => void;
  onClose: () => void;
}

export function RansomPanel({
  captives,
  gold,
  onRansom,
  onClose,
}: RansomPanelProps) {
  return (
    <section className="panel inspector-panel" aria-live="polite">
      <div className="inspector-header">
        <h2>Ransom</h2>
        <button type="button" className="inspector-close" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="muted">
        Pay gold to free royals held by the enemy army.
      </p>
      {captives.length === 0 ? (
        <p className="muted">No one is captive.</p>
      ) : (
        <ul className="market-list">
          {captives.map((c) => {
            const cost = RANSOM_COST[c.role] ?? 40;
            return (
              <li key={c.id} className="market-row">
                <div>
                  <strong>{c.name}</strong>
                  <span className="muted"> · {roleLabel(c.role)}</span>
                  <p className="muted">{cost}g ransom</p>
                </div>
                <button
                  type="button"
                  className="market-buy"
                  disabled={gold < cost}
                  onClick={() => onRansom(c.id, cost)}
                >
                  Pay
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
