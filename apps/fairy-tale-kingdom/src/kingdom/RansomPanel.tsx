import { RANSOM_COST } from '../game/economy/economy';
import type { CaptiveRecord } from './CaptivesRepository';
import { roleLabel } from '../game/subjects/schedules';

interface RansomPanelProps {
  captives: CaptiveRecord[];
  gold: number;
  infiniteGold?: boolean;
  canExecute?: boolean;
  onRansom: (id: string, cost: number) => void;
  onExecute?: (id: string) => void;
  onClose: () => void;
}

export function RansomPanel({
  captives,
  gold,
  infiniteGold = false,
  canExecute,
  onRansom,
  onExecute,
  onClose,
}: RansomPanelProps) {
  return (
    <section className="panel inspector-panel" aria-live="polite">
      <div className="inspector-header">
        <h2>Captives</h2>
        <button type="button" className="inspector-close" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="muted">
        Ransom royals home, or execute prisoners at the gallows (needs an
        executioner + gallows).
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
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="market-buy"
                    disabled={!infiniteGold && gold < cost}
                    onClick={() => onRansom(c.id, cost)}
                  >
                    Pay
                  </button>
                  {onExecute && (
                    <button
                      type="button"
                      className="market-buy"
                      disabled={!canExecute}
                      title={
                        canExecute
                          ? 'Lead to the gallows'
                          : 'Need an executioner, gallows, and a prisoner'
                      }
                      onClick={() => onExecute(c.id)}
                    >
                      Execute
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {captives.length > 0 && onExecute && !canExecute && (
        <p className="muted">
          Execute needs a gallows and an executioner in the realm.
        </p>
      )}
    </section>
  );
}
