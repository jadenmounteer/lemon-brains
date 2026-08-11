import type { CampKind } from '../game/war/WarBalance';

export interface CampSnapshot {
  id: string;
  kind: CampKind;
  x: number;
  y: number;
  label: string;
}

interface CampInspectorPanelProps {
  camp: CampSnapshot;
  canArrest: boolean;
  onArrest: () => void;
  onDestroy: () => void;
  onClose: () => void;
}

export function CampInspectorPanel({
  camp,
  canArrest,
  onArrest,
  onDestroy,
  onClose,
}: CampInspectorPanelProps) {
  return (
    <section className="panel inspector-panel" aria-live="polite">
      <div className="inspector-header">
        <h2>{camp.label}</h2>
        <button type="button" className="inspector-close" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="muted">Encampment · {camp.kind}</p>
      <div className="market-row" style={{ gap: 8, marginTop: 12 }}>
        {(camp.kind === 'gypsy' ||
          camp.kind === 'thief' ||
          camp.kind === 'bandit') && (
          <button
            type="button"
            className="market-buy"
            disabled={!canArrest}
            onClick={onArrest}
          >
            Arrest
          </button>
        )}
        <button type="button" className="market-buy" onClick={onDestroy}>
          Destroy
        </button>
      </div>
      {!canArrest &&
        (camp.kind === 'gypsy' ||
          camp.kind === 'thief' ||
          camp.kind === 'bandit') && (
          <p className="muted">Need a dungeon and nearby guards to Arrest.</p>
        )}
    </section>
  );
}
