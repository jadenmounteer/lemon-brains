import {
  BUILD_CATALOG,
  FIELDS_PER_GRANARY,
  NAVAL_CATALOG,
  type BuildKind,
  type NavalKind,
} from './catalog';
import { canPlaceBuilding, affordableWallCells, WALL_GOLD_PER_CELL } from './rules';
import type { KingdomStats } from '../game/subjects/types';
import type { PlaceModePayload } from '../game/subjects/events';

interface MarketplacePanelProps {
  gold: number;
  infiniteGold?: boolean;
  stats: KingdomStats;
  placeMode: PlaceModePayload;
  onBuyBuilding: (kind: BuildKind) => void;
  onBuyNaval: (kind: NavalKind) => void;
  onCancelPlace: () => void;
  onClose?: () => void;
}

export function MarketplacePanel({
  gold,
  infiniteGold = false,
  stats,
  placeMode,
  onBuyBuilding,
  onBuyNaval,
  onCancelPlace,
  onClose,
}: MarketplacePanelProps) {
  const canAfford = (cost: number) => infiniteGold || gold >= cost;
  return (
    <section className="panel market-panel">
      <div className="sheet-header">
        <h2>Marketplace</h2>
        {onClose && (
          <button
            type="button"
            className="inspector-close touch-btn"
            onClick={onClose}
          >
            Close
          </button>
        )}
      </div>
      <p className="market-capacity" aria-live="polite">
        Population: <strong>{stats.population}</strong> / {stats.capacity} beds
        <span className="muted">
          {' '}
          ({stats.freeBeds} free)
        </span>
      </p>
      <p className="muted market-note">
        Houses have 3 beds; royals live at keeps. Fields need granaries (
        {FIELDS_PER_GRANARY} per granary). Train units at the building they work
        at.
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
              : placeMode.kind === 'wall'
                ? ' — drag to draw walls (3g/cell).'
                : ' — click empty ground (not on other objects).'}
          </p>
          <button type="button" className="inspector-close" onClick={onCancelPlace}>
            Cancel
          </button>
        </div>
      )}

      <h3 className="inspector-subhead">Build</h3>
      <ul className="market-list">
        {BUILD_CATALOG.map((item) => {
          const placeBlocked = !canPlaceBuilding(item.kind, stats);
          const wallAffordable =
            item.kind !== 'wall' ||
            infiniteGold ||
            affordableWallCells(gold, infiniteGold) >= 1;
          const disabled =
            placeMode.active ||
            !wallAffordable ||
            (item.kind !== 'wall' && !canAfford(item.cost)) ||
            placeBlocked;
          return (
            <li key={item.kind} className="market-row">
              <div>
                <strong>{item.name}</strong>
                <span className="muted">
                  {' '}
                  · {item.kind === 'wall' ? `${WALL_GOLD_PER_CELL}g/cell` : `${item.cost}g`}
                </span>
                <p className="muted">{item.blurb}</p>
                {placeBlocked && item.requiresRoyalty && !stats.royaltyUnlocked && (
                  <p className="muted">Requires King &amp; Queen</p>
                )}
                {placeBlocked &&
                  item.kind === 'field' &&
                  stats.granaryCount <= 0 && (
                    <p className="muted">Build a granary first</p>
                  )}
                {placeBlocked &&
                  item.kind === 'field' &&
                  stats.granaryCount > 0 &&
                  stats.fieldCount >= stats.fieldSlots && (
                    <p className="muted">
                      Field slots full ({stats.fieldCount}/{stats.fieldSlots})
                    </p>
                  )}
                {placeBlocked &&
                  item.kind === 'cemetery' &&
                  !stats.hasCathedral && (
                    <p className="muted">Requires a Cathedral</p>
                  )}
                {placeBlocked &&
                  item.kind === 'gallows' &&
                  !stats.hasDungeon && (
                    <p className="muted">Requires a Dungeon</p>
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

      <h3 className="inspector-subhead">Naval</h3>
      {!stats.hasDock && (
        <p className="muted">Build a Dock to unlock boats and warships.</p>
      )}
      <ul className="market-list">
        {NAVAL_CATALOG.map((item) => {
          const atCapacity =
            item.kind === 'fishingBoat'
              ? stats.fishingBoatCount >= stats.fishingBoatCapacity
              : stats.warshipCount >= stats.warshipCapacity;
          const disabled =
            placeMode.active ||
            !canAfford(item.cost) ||
            !stats.hasDock ||
            atCapacity;
          return (
            <li key={item.kind} className="market-row">
              <div>
                <strong>{item.name}</strong>
                <span className="muted"> · {item.cost}g</span>
                <p className="muted">{item.blurb}</p>
                {stats.hasDock && atCapacity && (
                  <p className="muted">
                    {item.kind === 'fishingBoat'
                      ? `Boats full (${stats.fishingBoatCount}/${stats.fishingBoatCapacity})`
                      : `Warships full (${stats.warshipCount}/${stats.warshipCapacity})`}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="market-buy"
                disabled={disabled}
                onClick={() => onBuyNaval(item.kind)}
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
