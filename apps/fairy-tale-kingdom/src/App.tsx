import { useCallback, useState } from 'react';
import { config } from './config';
import type { UnitRole } from './game/art/assetManifest';
import { PhaserGame } from './game/PhaserGame';
import type {
  GameOverPayload,
  GoldStolenPayload,
  PlaceModePayload,
  RaidWarningPayload,
} from './game/subjects/events';
import type {
  BuildingSnapshot,
  DaySnapshot,
  KingdomStats,
  SubjectSnapshot,
} from './game/subjects/types';
import { BuildingInspectorPanel } from './buildings/BuildingInspectorPanel';
import { GameOverModal } from './kingdom/GameOverModal';
import { KingdomMenu } from './kingdom/KingdomMenu';
import { LayoutRepository } from './kingdom/LayoutRepository';
import { useKingdom } from './kingdom/useKingdom';
import { QuestionPanel } from './learning/QuestionPanel';
import { useGold } from './learning/useGold';
import { useSettings } from './learning/useSettings';
import {
  BUILD_CATALOG,
  HIRE_CATALOG,
  type BuildKind,
} from './marketplace/catalog';
import { MarketplacePanel } from './marketplace/MarketplacePanel';
import { InspectorPanel } from './subjects/InspectorPanel';
import { formatClock } from './utils/formatClock';

const layoutRepo = new LayoutRepository();

const DEFAULT_STATS: KingdomStats = {
  population: 0,
  capacity: 0,
  freeBeds: 0,
  houseCount: 0,
  wallCount: 0,
  tavernCount: 0,
};

export default function App() {
  const { settings, ready } = useSettings();
  const { gold, earnCorrectAnswer, resetGold, stealGold, spend, addGold } =
    useGold();
  const { kingdom, ready: kingdomReady, needsSetup, startNewKingdom, incrementDay } =
    useKingdom();
  const [showQuestions, setShowQuestions] = useState(false);
  const [showMarket, setShowMarket] = useState(false);
  const [selected, setSelected] = useState<SubjectSnapshot | null>(null);
  const [selectedBuilding, setSelectedBuilding] =
    useState<BuildingSnapshot | null>(null);
  const [day, setDay] = useState<DaySnapshot>({
    dayPhase: 'Night',
    hour: 0,
  });
  const [deselectToken, setDeselectToken] = useState(0);
  const [remountKey, setRemountKey] = useState(0);
  const [gameOver, setGameOver] = useState<GameOverPayload | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [namingAfterLoss, setNamingAfterLoss] = useState(false);
  const [stats, setStats] = useState<KingdomStats>(DEFAULT_STATS);
  const [placeMode, setPlaceMode] = useState<PlaceModePayload>({
    active: false,
    kind: null,
  });
  const [hireRequest, setHireRequest] = useState<{
    seq: number;
    role: UnitRole;
  } | null>(null);
  const [placeRequest, setPlaceRequest] = useState<{
    seq: number;
    kind: BuildKind;
  } | null>(null);
  const [cancelPlaceToken, setCancelPlaceToken] = useState(0);
  const [pendingPlaceCost, setPendingPlaceCost] = useState<number | null>(null);

  const showSide =
    showQuestions ||
    showMarket ||
    selected !== null ||
    selectedBuilding !== null;

  const flash = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const handleNewKingdom = useCallback(
    async (name: string) => {
      await startNewKingdom(name);
      await resetGold();
      await layoutRepo.reset();
      setGameOver(null);
      setNamingAfterLoss(false);
      setSelected(null);
      setSelectedBuilding(null);
      setPlaceMode({ active: false, kind: null });
      setPendingPlaceCost(null);
      setStats(DEFAULT_STATS);
      setRemountKey((n) => n + 1);
    },
    [resetGold, startNewKingdom]
  );

  const handleHire = useCallback(
    async (role: UnitRole) => {
      const item = HIRE_CATALOG.find((h) => h.role === role);
      if (!item) return;
      if (stats.freeBeds <= 0) {
        flash('No free beds — build a house first');
        return;
      }
      const ok = await spend(item.cost);
      if (!ok) {
        flash('Not enough gold');
        return;
      }
      setHireRequest({ seq: Date.now(), role });
    },
    [flash, spend, stats.freeBeds]
  );

  const handleBuyBuilding = useCallback(
    async (kind: BuildKind) => {
      const item = BUILD_CATALOG.find((b) => b.kind === kind);
      if (!item) return;
      const ok = await spend(item.cost);
      if (!ok) {
        flash('Not enough gold');
        return;
      }
      setPendingPlaceCost(item.cost);
      setPlaceRequest({ seq: Date.now(), kind });
      flash(`Place your ${item.name.toLowerCase()} on empty ground`);
    },
    [flash, spend]
  );

  const refundPendingPlace = useCallback(
    (notify: boolean) => {
      if (pendingPlaceCost == null) return;
      void addGold(pendingPlaceCost);
      setPendingPlaceCost(null);
      if (notify) {
        flash('Placement cancelled — gold refunded');
      }
    },
    [addGold, flash, pendingPlaceCost]
  );

  const showSidePanels = kingdomReady && !needsSetup && !namingAfterLoss;

  return (
    <div className="app">
      <header className="hud">
        <div className="brand">
          <h1 aria-live="polite">
            {day.dayPhase} · {formatClock(day.hour)}
          </h1>
          <p className="tagline">
            {kingdom.name
              ? `${kingdom.name} · Day ${kingdom.daysPlayed}`
              : 'Name your kingdom to begin'}
          </p>
        </div>
        <div className="hud-actions">
          <div className="gold" aria-live="polite">
            Gold: <strong>{gold}</strong>
          </div>
          {showSidePanels && (
            <>
              <button type="button" onClick={() => setShowQuestions((v) => !v)}>
                {showQuestions ? 'Hide questions' : 'Questions'}
              </button>
              <button type="button" onClick={() => setShowMarket((v) => !v)}>
                {showMarket ? 'Hide market' : 'Marketplace'}
              </button>
            </>
          )}
          <a className="back" href={config.hostUrl}>
            Knowledge Quest
          </a>
          {kingdomReady && (
            <KingdomMenu
              kingdomName={kingdom.name}
              daysPlayed={kingdom.daysPlayed}
              forceOpen={needsSetup || namingAfterLoss}
              forceTitle={
                namingAfterLoss
                  ? 'Found a new kingdom'
                  : needsSetup
                    ? 'Name your kingdom'
                    : undefined
              }
              onStartNewKingdom={handleNewKingdom}
            />
          )}
        </div>
      </header>

      <main className="stage">
        {kingdomReady && !needsSetup && (
          <PhaserGame
            remountKey={remountKey}
            hireRequest={hireRequest}
            placeRequest={placeRequest}
            cancelPlaceToken={cancelPlaceToken}
            onSubjectSelected={setSelected}
            onBuildingSelected={setSelectedBuilding}
            onDayTick={setDay}
            onDayRolled={() => {
              void incrementDay();
            }}
            onGoldStolen={(payload: GoldStolenPayload) => {
              void stealGold(payload.amount).then((left) => {
                flash(
                  `${payload.label} reached the keep and stole ${payload.amount} gold (${left} left)`
                );
              });
            }}
            onGameOver={(payload) => {
              setGameOver(payload);
            }}
            onRaidWarning={(payload: RaidWarningPayload) => {
              flash(
                payload.kind === 'enemy_army'
                  ? `Warning: ${payload.label} approaches!`
                  : `${payload.label} are raiding!`
              );
            }}
            onKingdomStats={setStats}
            onPlaceMode={setPlaceMode}
            onMarketToast={(message) => {
              if (message === 'Building placed') {
                setPendingPlaceCost(null);
                flash(message);
                return;
              }
              if (message === 'Placement cancelled') {
                refundPendingPlace(true);
                return;
              }
              flash(message);
            }}
            deselectToken={deselectToken}
          />
        )}

        {toast && <div className="toast">{toast}</div>}

        {gameOver && (
          <GameOverModal
            reason={gameOver.reason}
            onNewKingdom={() => {
              setGameOver(null);
              setNamingAfterLoss(true);
            }}
          />
        )}

        {showSidePanels && showSide && (
          <aside className="side-panels">
            {selected && (
              <InspectorPanel
                subject={selected}
                onClose={() => {
                  setSelected(null);
                  setDeselectToken((n) => n + 1);
                }}
              />
            )}
            {selectedBuilding && (
              <BuildingInspectorPanel
                building={selectedBuilding}
                onClose={() => {
                  setSelectedBuilding(null);
                  setDeselectToken((n) => n + 1);
                }}
              />
            )}
            {showQuestions && (
              <QuestionPanel
                settings={settings}
                ready={ready}
                onGoldEarned={earnCorrectAnswer}
              />
            )}
            {showMarket && (
              <MarketplacePanel
                gold={gold}
                stats={stats}
                placeMode={placeMode}
                onHire={(role) => {
                  void handleHire(role);
                }}
                onBuyBuilding={(kind) => {
                  void handleBuyBuilding(kind);
                }}
                onCancelPlace={() => {
                  refundPendingPlace(true);
                  setCancelPlaceToken((n) => n + 1);
                }}
              />
            )}
          </aside>
        )}
      </main>
    </div>
  );
}
