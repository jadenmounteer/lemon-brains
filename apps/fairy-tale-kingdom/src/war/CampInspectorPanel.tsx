import type { CampRosterEntry, CampSnapshot } from '../game/subjects/types';

export type { CampSnapshot };

interface CampInspectorPanelProps {
  camp: CampSnapshot;
  onArrest: () => void;
  onDestroy: () => void;
  onClose: () => void;
  /** Click a named roster entry — pans/zooms the camera to watch that camp. */
  onSelectUnit?: (unit: CampRosterEntry) => void;
}

export function CampInspectorPanel({
  camp,
  onArrest,
  onDestroy,
  onClose,
  onSelectUnit,
}: CampInspectorPanelProps) {
  const canArrest = camp.canArrest;
  const canDestroy = camp.canDestroy;
  const showArrest =
    camp.kind === 'gypsy' || camp.kind === 'thief' || camp.kind === 'bandit';

  return (
    <section className="panel inspector-panel" aria-live="polite">
      <div className="inspector-header">
        <h2>{camp.label}</h2>
        <button type="button" className="inspector-close" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="inspector-role">Encampment · {camp.kind}</p>
      {camp.leaderName ? (
        <p>
          <span className="muted">Leader</span> {camp.leaderName}{' '}
          <span className="muted">
            · {camp.leaderHome ? 'at camp' : 'leading the field'}
          </span>
        </p>
      ) : (
        camp.demoralized && (
          <p className="muted">Leaderless — the camp is in disarray.</p>
        )
      )}
      <p>
        <span className="muted">Garrison</span> {camp.garrison} home ·{' '}
        {camp.away} away
      </p>
      {typeof camp.supply === 'number' &&
        typeof camp.maxSupply === 'number' && (
          <p>
            <span className="muted">Supply</span> {camp.supply} /{' '}
            {camp.maxSupply}
          </p>
        )}
      <div className="market-row" style={{ gap: 8, marginTop: 12 }}>
        {showArrest && (
          <button
            type="button"
            className="market-buy"
            disabled={!canArrest}
            onClick={onArrest}
          >
            Arrest
          </button>
        )}
        <button
          type="button"
          className="market-buy"
          disabled={!canDestroy}
          onClick={onDestroy}
        >
          Destroy
        </button>
      </div>
      {!canArrest && showArrest && (
        <p className="muted">Need a dungeon and nearby guards to Arrest.</p>
      )}
      {!canDestroy && (
        <p className="muted">
          Need a general and free soldiers, guards, or archers to Destroy.
        </p>
      )}
      <h3 className="inspector-subhead">Living garrison</h3>
      {camp.roster.length > 0 ? (
        <ul className="schedule-list">
          {camp.roster.map((u) => (
            <li key={u.id}>
              {onSelectUnit ? (
                <button
                  type="button"
                  className="camp-roster-link"
                  onClick={() => onSelectUnit(u)}
                >
                  {u.name}
                </button>
              ) : (
                u.name
              )}{' '}
              <span className="muted">
                · {u.role} · {u.status === 'home' ? 'home' : 'away'} ·{' '}
                {u.activity}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">The camp is empty.</p>
      )}
    </section>
  );
}
