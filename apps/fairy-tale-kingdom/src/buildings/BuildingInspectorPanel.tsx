import type { UnitRole } from '../game/art/assetManifest';
import type { KingdomStats } from '../game/subjects/types';
import type { CivilianJob } from '../game/jobs/capacities';
import {
  CASTLE_JOBS,
  CASTLE_JOB_CAPACITY,
  jobLabel,
} from '../game/jobs/capacities';
import {
  canTrain,
  hireCatalogName,
  hireCost,
  TRAINABLE_ROLES,
} from '../marketplace/rules';
import type { BuildingSnapshot } from '../game/subjects/types';
import {
  buildingRefundCost,
  isMovableKind,
} from '../game/buildings/buildingManagement';

interface BuildingInspectorPanelProps {
  building: BuildingSnapshot;
  gold: number;
  infiniteGold?: boolean;
  stats: KingdomStats;
  /** Sandbox: when false for a role, hide that train row. */
  enabledRoles?: Partial<Record<UnitRole, boolean>>;
  onTrain: (buildingId: string, role: UnitRole, castleJob?: CivilianJob) => void;
  onMove?: (buildingId: string) => void;
  onDemolish?: (buildingId: string) => void;
  onClose: () => void;
}

export function BuildingInspectorPanel({
  building,
  gold,
  infiniteGold = false,
  stats,
  enabledRoles,
  onTrain,
  onMove,
  onDemolish,
  onClose,
}: BuildingInspectorPanelProps) {
  const canAfford = (cost: number) => infiniteGold || gold >= cost;
  const trainRoles = (TRAINABLE_ROLES[building.kind] ?? []).filter(
    (role) => !(building.kind === 'keep' && role === 'peasant')
  );
  const royalUsedAtKeep =
    building.kind === 'keep' ? (building.royalUsed ?? 0) : undefined;
  const refund = buildingRefundCost(building.kind);
  const occupantCount =
    (building.residents?.length ?? 0) + (building.workers?.length ?? 0);
  const canMove = isMovableKind(building.kind);
  const canDemolish = building.kind !== 'keep';

  const handleDemolish = () => {
    if (!onDemolish) return;
    if (occupantCount > 0) {
      const ok = window.confirm(
        'Demolish anyway? Residents and workers will seek new homes.'
      );
      if (!ok) return;
    }
    onDemolish(building.id);
  };

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
      {typeof building.influenceRadius === 'number' && (
        <p>
          <span className="muted">Influence</span> {building.influenceRadius}px
        </p>
      )}
      {building.loyaltyLabel ? (
        <p>
          <span className="muted">Loyalty</span> {building.loyaltyLabel}
        </p>
      ) : null}
      {typeof building.royalCapacity === 'number' && (
        <p>
          <span className="muted">Royal slots</span>{' '}
          {building.royalUsed ?? 0} / {building.royalCapacity}
        </p>
      )}
      {building.kind === 'dungeon' &&
        typeof building.prisonerCapacity === 'number' && (
          <p>
            <span className="muted">Prisoners</span>{' '}
            {building.prisonerUsed ?? 0} / {building.prisonerCapacity}
          </p>
        )}
      {building.capacityLines && building.capacityLines.length > 0 && (
        <>
          <h3 className="inspector-subhead">Capacity</h3>
          <ul className="schedule-list">
            {building.capacityLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </>
      )}
      {(building.kind === 'house' ||
        building.kind === 'manor' ||
        building.kind === 'keep') && (
        <>
          {building.kind !== 'keep' && (
            <p>
              <span className="muted">Beds</span>{' '}
              {building.bedsUsed ?? 0} / {building.bedsCapacity ?? 0}
            </p>
          )}
          <h3 className="inspector-subhead">
            {building.kind === 'keep' ? 'Royal household' : 'Who lives here'}
          </h3>
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
            <p className="muted">
              {building.kind === 'keep'
                ? 'No royalty assigned yet.'
                : 'No one lives here yet.'}
            </p>
          )}
        </>
      )}
      <h3 className="inspector-subhead">Who works here</h3>
      {building.workers && building.workers.length > 0 ? (
        <ul className="schedule-list">
          {building.workers.map((w) => (
            <li key={w.id}>
              {w.name}{' '}
              <span className="muted">
                · {w.jobLabel ?? w.roleLabel}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No one works here yet.</p>
      )}
      {trainRoles.length > 0 && (
        <>
          <h3 className="inspector-subhead">Train</h3>
          <ul className="market-list">
            {building.kind === 'keep' &&
              CASTLE_JOBS.map((job) => {
                const cap =
                  CASTLE_JOB_CAPACITY[
                    job as keyof typeof CASTLE_JOB_CAPACITY
                  ];
                const used =
                  building.workers?.filter((w) => w.jobLabel === jobLabel(job))
                    .length ?? 0;
                const allowed = used < cap && stats.freeBeds > 0;
                const cost = hireCost('peasant');
                return (
                  <li key={job}>
                    <button
                      type="button"
                      className="market-buy"
                      disabled={!allowed || !canAfford(cost)}
                      onClick={() => onTrain(building.id, 'peasant', job)}
                    >
                      Train {jobLabel(job)} — {cost}g
                    </button>
                  </li>
                );
              })}
            {trainRoles.map((role) => {
              if (enabledRoles?.[role] === false) return null;
              const workersAtBuilding =
                building.workers?.filter((w) => w.role === role).length ?? 0;
              const allowed = canTrain(building.kind, role, stats, {
                workersAtBuilding,
                enabledRoles,
                royalUsedAtKeep,
              });
              const cost = hireCost(role);
              const disabled = !allowed || !canAfford(cost);
              return (
                <li key={role} className="market-row">
                  <div>
                    <strong>{hireCatalogName(role)}</strong>
                    <span className="muted"> · {cost}g</span>
                    {!allowed && stats.freeBeds <= 0 && (
                      <p className="muted">No free beds — build a house</p>
                    )}
                    {allowed &&
                      workersAtBuilding > 0 &&
                      canTrain(building.kind, role, stats, {
                        workersAtBuilding: workersAtBuilding - 1,
                        enabledRoles,
                        royalUsedAtKeep,
                      }) === false && (
                        <p className="muted">Posts full at this building</p>
                      )}
                  </div>
                  <button
                    type="button"
                    className="market-buy"
                    disabled={disabled}
                    onClick={() => onTrain(building.id, role)}
                  >
                    Train
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {(canMove || canDemolish) && (
        <>
          <h3 className="inspector-subhead">Manage</h3>
          <div className="inspector-actions">
            {canMove && onMove ? (
              <button
                type="button"
                className="market-buy"
                onClick={() => onMove(building.id)}
              >
                Move
              </button>
            ) : null}
            {canDemolish && onDemolish ? (
              <button
                type="button"
                className="market-buy"
                onClick={handleDemolish}
              >
                Demolish ({refund}g)
              </button>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

function kindTitle(kind: BuildingSnapshot['kind']): string {
  switch (kind) {
    case 'house':
    case 'manor':
      return 'Dwelling';
    case 'wall':
      return 'Fortification';
    case 'ladder':
      return 'Access';
    case 'drawbridge':
      return 'Gate';
    case 'tavern':
      return 'Amenity';
    case 'field':
      return 'Farmland';
    case 'granary':
      return 'Storage';
    case 'barracks':
    case 'ballista':
      return 'Military';
    case 'watchtower':
      return 'Defense';
    case 'cathedral':
      return 'Holy hall';
    case 'infirmary':
      return 'Sick-house';
    case 'dungeon':
      return 'Prison';
    case 'bakery':
      return 'Bakery';
    case 'market':
      return 'Market';
    case 'cemetery':
      return 'Burial ground';
    case 'gallows':
      return 'Justice';
    case 'stocks':
      return 'Pillory';
    case 'road':
      return 'Road';
    case 'bridge':
      return 'Crossing';
    case 'dock':
      return 'Harbor';
    case 'keep':
      return 'Seat of power';
  }
}
