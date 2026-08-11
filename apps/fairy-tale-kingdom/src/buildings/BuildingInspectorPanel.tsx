import type { BuildingSnapshot } from '../game/subjects/types';

interface BuildingInspectorPanelProps {
  building: BuildingSnapshot;
  onClose: () => void;
}

export function BuildingInspectorPanel({
  building,
  onClose,
}: BuildingInspectorPanelProps) {
  return (
    <section className="panel inspector-panel" aria-live="polite">
      <div className="inspector-header">
        <h2>{building.name}</h2>
        <button type="button" className="inspector-close" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="inspector-role">{kindTitle(building.kind)}</p>
      <p>
        <span className="muted">Health</span> {building.hp} / {building.maxHp}
        {building.statusLabel ? (
          <span className="muted"> · {building.statusLabel}</span>
        ) : null}
      </p>
      <p>{building.blurb}</p>
      {building.kind === 'house' && (
        <>
          <p>
            <span className="muted">Beds</span>{' '}
            {building.bedsUsed ?? 0} / {building.bedsCapacity ?? 0}
          </p>
          <h3 className="inspector-subhead">Who lives here</h3>
          {building.residents && building.residents.length > 0 ? (
            <ul className="schedule-list">
              {building.residents.map((r) => (
                <li key={r.id}>
                  {r.name}{' '}
                  <span className="muted">· {r.roleLabel}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No one lives here yet.</p>
          )}
        </>
      )}
    </section>
  );
}

function kindTitle(kind: BuildingSnapshot['kind']): string {
  switch (kind) {
    case 'house':
      return 'Dwelling';
    case 'wall':
      return 'Fortification';
    case 'stairs':
      return 'Access';
    case 'drawbridge':
      return 'Gate';
    case 'tavern':
      return 'Amenity';
    case 'keep':
      return 'Seat of power';
  }
}
