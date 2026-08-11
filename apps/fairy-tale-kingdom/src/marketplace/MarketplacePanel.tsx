import {
  BUILD_CATALOG,
  FIELDS_PER_GRANARY,
  HIRE_CATALOG,
  type BuildKind,
} from './catalog';
import type { UnitRole } from '../game/art/assetManifest';
import type { KingdomStats } from '../game/subjects/types';

interface MarketplacePanelProps {
  gold: number;
  stats: KingdomStats;
  placeMode: { active: boolean; kind: BuildKind | null };
  onHire: (role: UnitRole) => void;
  onBuyBuilding: (kind: BuildKind) => void;
  onCancelPlace: () => void;
}

export function MarketplacePanel({
  gold,
  stats,
  placeMode,
  onHire,
  onBuyBuilding,
  onCancelPlace,
}: MarketplacePanelProps) {
  return (
    <section className="panel market-panel">
      <h2>Marketplace</h2>
      <p className="market-capacity" aria-live="polite">
        Population: <strong>{stats.population}</strong> / {stats.capacity} beds
        <span className="muted">
          {' '}
          ({stats.freeBeds} free)
        </span>
      </p>
      <p className="muted market-note">
        Houses have 3 beds; royals live at keeps. Fields need granaries (
        {FIELDS_PER_GRANARY} per granary).
      </p>
      {stats.royaltyUnlocked ? (
        <p className="muted">Royal court active — tier-2 goods unlocked.</p>
      ) : (
        <p className="muted">Hire a King and Queen to unlock royal goods.</p>
      )}

      {placeMode.active && (
        <div className="place-banner">
          <p>
            Placing <strong>{placeMode.kind}</strong>
            {placeMode.kind === 'stairs'
              ? ' — snap to a wall.'
              : ' — click empty ground (not on other objects).'}
          </p>
          <button type="button" className="inspector-close" onClick={onCancelPlace}>
            Cancel
          </button>
        </div>
      )}

      <h3 className="inspector-subhead">Hire</h3>
      <ul className="market-list">
        {HIRE_CATALOG.map((item) => {
          const locked = Boolean(item.requiresRoyalty && !stats.royaltyUnlocked);
          const uniqueTaken =
            item.unique &&
            ((item.role === 'king' && stats.hasKing) ||
              (item.role === 'queen' && stats.hasQueen) ||
              (item.role === 'fairy_godmother' && stats.hasFairyGodmother) ||
              (item.role === 'bishop' && stats.hasBishop));
          const perKeepTaken =
            Boolean(item.perKeep) &&
            ((item.role === 'king' && stats.kingCount >= stats.keepCount) ||
              (item.role === 'queen' && stats.queenCount >= stats.keepCount));
          const buildingMissing =
            (item.requiresBuilding === 'cathedral' && !stats.hasCathedral) ||
            (item.requiresBuilding === 'infirmary' && !stats.hasInfirmary);
          const needsBed = !item.livesAtKeep && stats.freeBeds <= 0;
          const disabled =
            placeMode.active ||
            gold < item.cost ||
            needsBed ||
            locked ||
            uniqueTaken ||
            perKeepTaken ||
            buildingMissing;
          return (
            <li key={item.role} className="market-row">
              <div>
                <strong>{item.name}</strong>
                <span className="muted"> · {item.cost}g</span>
                <p className="muted">{item.blurb}</p>
                {locked && (
                  <p className="muted">Requires King &amp; Queen</p>
                )}
                {buildingMissing && item.requiresBuilding === 'cathedral' && (
                  <p className="muted">Requires a Cathedral</p>
                )}
                {buildingMissing && item.requiresBuilding === 'infirmary' && (
                  <p className="muted">Requires an Infirmary</p>
                )}
                {uniqueTaken && (
                  <p className="muted">Already in your kingdom</p>
                )}
                {perKeepTaken && (
                  <p className="muted">Need another keep</p>
                )}
              </div>
              <button
                type="button"
                className="market-buy"
                disabled={disabled}
                onClick={() => onHire(item.role)}
              >
                Hire
              </button>
            </li>
          );
        })}
      </ul>
      {stats.freeBeds <= 0 && (
        <p className="muted">Build a house or manor for more beds.</p>
      )}

      <h3 className="inspector-subhead">Build</h3>
      <ul className="market-list">
        {BUILD_CATALOG.map((item) => {
          const locked = Boolean(item.requiresRoyalty && !stats.royaltyUnlocked);
          const fieldBlocked =
            item.kind === 'field' &&
            (stats.granaryCount <= 0 || stats.fieldCount >= stats.fieldSlots);
          const disabled =
            placeMode.active || gold < item.cost || locked || fieldBlocked;
          return (
            <li key={item.kind} className="market-row">
              <div>
                <strong>{item.name}</strong>
                <span className="muted"> · {item.cost}g</span>
                <p className="muted">{item.blurb}</p>
                {locked && (
                  <p className="muted">Requires King &amp; Queen</p>
                )}
                {fieldBlocked && stats.granaryCount <= 0 && (
                  <p className="muted">Build a granary first</p>
                )}
                {fieldBlocked &&
                  stats.granaryCount > 0 &&
                  stats.fieldCount >= stats.fieldSlots && (
                    <p className="muted">
                      Field slots full ({stats.fieldCount}/{stats.fieldSlots})
                    </p>
                  )}
              </div>
              <button
                type="button"
                className="market-buy"
                disabled={disabled}
                onClick={() => onBuyBuilding(item.kind)}
              >
                Buy
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
