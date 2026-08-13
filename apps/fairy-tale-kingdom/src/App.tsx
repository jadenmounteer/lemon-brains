import { useCallback, useState } from 'react';
import { config } from './config';
import type { UnitRole } from './game/art/assetManifest';
import { PhaserGame } from './game/PhaserGame';
import type {
  GameOverPayload,
  GoldStolenPayload,
  PlaceModePayload,
  RaidWarningPayload,
  RoyalCapturedPayload,
} from './game/subjects/events';
import type {
  BuildingSnapshot,
  CampRosterEntry,
  CampSnapshot,
  DaySnapshot,
  KingdomStats,
  SubjectSnapshot,
} from './game/subjects/types';
import { BuildingInspectorPanel } from './buildings/BuildingInspectorPanel';
import { CampInspectorPanel } from './war/CampInspectorPanel';
import {
  CaptivesRepository,
  type CaptiveRecord,
} from './kingdom/CaptivesRepository';
import { GameOverModal } from './kingdom/GameOverModal';
import { KingdomMenu } from './kingdom/KingdomMenu';
import { LayoutRepository } from './kingdom/LayoutRepository';
import { RansomPanel } from './kingdom/RansomPanel';
import { TodoPanel } from './kingdom/TodoPanel';
import { useKingdom } from './kingdom/useKingdom';
import { useSandboxSettings } from './kingdom/useSandboxSettings';
import type { SandboxSpawnAction } from './kingdom/sandboxSettings';
import {
  loadShowCareerTodos,
  saveShowCareerTodos,
} from './kingdom/uiPrefs';
import { QuestionPanel } from './learning/QuestionPanel';
import { useFood } from './learning/useFood';
import { useGold } from './learning/useGold';
import { useSettings } from './learning/useSettings';
import {
  BUILD_CATALOG,
  HIRE_CATALOG,
  NAVAL_CATALOG,
  type BuildKind,
  type NavalKind,
} from './marketplace/catalog';
import { MarketplacePanel } from './marketplace/MarketplacePanel';
import { Phase12Balance } from './game/economy/phase12Balance';
import type { CareerTodoItem } from './game/subjects/types';
import { InspectorPanel } from './subjects/InspectorPanel';
import { formatClock } from './utils/formatClock';

const layoutRepo = new LayoutRepository();
const captivesRepo = new CaptivesRepository();

const DEFAULT_STATS: KingdomStats = {
  population: 0,
  capacity: 0,
  freeBeds: 0,
  houseCount: 0,
  wallCount: 0,
  tavernCount: 0,
  fieldCount: 0,
  granaryCount: 0,
  keepCount: 1,
  hasCathedral: false,
  hasInfirmary: false,
  hasDungeon: false,
  hasBarracks: false,
  hasGallows: false,
  hasCemetery: false,
  hasDock: false,
  dockCount: 0,
  fishingBoatCount: 0,
  fishingBoatCapacity: 0,
  warshipCount: 0,
  warshipCapacity: 0,
  hasKing: false,
  hasQueen: false,
  hasPrince: false,
  hasPrincess: false,
  hasFairyGodmother: false,
  hasBishop: false,
  hasGeneral: false,
  hasExecutioner: false,
  royaltyUnlocked: false,
  inspired: false,
  food: 0,
  captiveCount: 0,
  kingCount: 0,
  queenCount: 0,
  fieldSlots: 0,
  militaryAvailable: 0,
  careerTodos: [],
};

export default function App() {
  const { settings, ready } = useSettings();
  const {
    gold,
    earnCorrectAnswer,
    resetGold,
    stealGold,
    spend,
    addGold,
    infiniteGold,
    setCheatInfiniteGold,
  } = useGold();
  const {
    settings: sandboxSettings,
    updateSettings: updateSandboxSettings,
    reset: resetSandboxSettings,
  } = useSandboxSettings();
  const [showCareerTodos, setShowCareerTodos] = useState(() =>
    loadShowCareerTodos()
  );
  const { food, setFoodAmount, resetFood } = useFood();
  const { kingdom, ready: kingdomReady, needsSetup, startNewKingdom, incrementDay } =
    useKingdom();
  const [showQuestions, setShowQuestions] = useState(false);
  const [showMarket, setShowMarket] = useState(false);
  const [showRansom, setShowRansom] = useState(false);
  const [selected, setSelected] = useState<SubjectSnapshot | null>(null);
  const [selectedBuilding, setSelectedBuilding] =
    useState<BuildingSnapshot | null>(null);
  const [selectedCamp, setSelectedCamp] = useState<CampSnapshot | null>(null);
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
  const [captives, setCaptives] = useState<CaptiveRecord[]>(() =>
    captivesRepo.loadSync()
  );
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
  const [navalRequest, setNavalRequest] = useState<{
    seq: number;
    kind: NavalKind;
  } | null>(null);
  const [ransomRequest, setRansomRequest] = useState<{
    seq: number;
    id: string;
  } | null>(null);
  const [transformRequest, setTransformRequest] = useState<{
    seq: number;
    fgmId: string;
  } | null>(null);
  const [commandRequest, setCommandRequest] = useState<{
    seq: number;
    generalId: string;
    troopCount: number;
  } | null>(null);
  const [careerHireRequest, setCareerHireRequest] = useState<{
    seq: number;
    subjectId: string;
    targetRole: UnitRole;
  } | null>(null);
  const [executeRequest, setExecuteRequest] = useState<{
    seq: number;
    id: string;
  } | null>(null);
  const [destroyCampRequest, setDestroyCampRequest] = useState<{
    seq: number;
    campId: string;
  } | null>(null);
  const [arrestCampRequest, setArrestCampRequest] = useState<{
    seq: number;
    campId: string;
  } | null>(null);
  const [focusCampRequest, setFocusCampRequest] = useState<{
    seq: number;
    campId: string;
    unitId?: string;
  } | null>(null);
  const [sandboxSpawnRequest, setSandboxSpawnRequest] = useState<{
    seq: number;
    action: SandboxSpawnAction;
  } | null>(null);
  const [cameraZoomRequest, setCameraZoomRequest] = useState<{
    seq: number;
    direction: 1 | -1;
  } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuOverlayOpen, setMenuOverlayOpen] = useState(false);
  const [cancelPlaceToken, setCancelPlaceToken] = useState(0);
  const [pendingPlaceCost, setPendingPlaceCost] = useState<number | null>(null);

  const careerTodoCount = stats.careerTodos?.length ?? 0;
  const todosVisible = showCareerTodos && careerTodoCount > 0;

  const setCareerTodosVisible = useCallback((on: boolean) => {
    setShowCareerTodos(on);
    saveShowCareerTodos(on);
  }, []);

  const showSide =
    showQuestions ||
    showMarket ||
    showRansom ||
    selected !== null ||
    selectedBuilding !== null ||
    selectedCamp !== null ||
    todosVisible;

  const flash = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const refreshCaptives = useCallback(() => {
    setCaptives(captivesRepo.loadSync());
  }, []);

  const handleNewKingdom = useCallback(
    async (name: string) => {
      await startNewKingdom(name);
      await resetGold();
      await resetFood();
      await layoutRepo.reset();
      await captivesRepo.reset();
      setCaptives([]);
      setGameOver(null);
      setNamingAfterLoss(false);
      setSelected(null);
      setSelectedBuilding(null);
      setSelectedCamp(null);
      setPlaceMode({ active: false, kind: null });
      setPendingPlaceCost(null);
      setShowRansom(false);
      setStats(DEFAULT_STATS);
      setRemountKey((n) => n + 1);
    },
    [resetFood, resetGold, startNewKingdom]
  );

  const handleHire = useCallback(
    async (role: UnitRole) => {
      const item = HIRE_CATALOG.find((h) => h.role === role);
      if (!item) return;
      if (!item.livesAtKeep && stats.freeBeds <= 0) {
        flash('No free beds — build a house first');
        return;
      }
      if (item.requiresRoyalty && !stats.royaltyUnlocked) {
        flash('Requires King & Queen');
        return;
      }
      if (item.requiresBuilding === 'cathedral' && !stats.hasCathedral) {
        flash('Build a Cathedral first');
        return;
      }
      if (item.requiresBuilding === 'infirmary' && !stats.hasInfirmary) {
        flash('Build an Infirmary first');
        return;
      }
      if (item.requiresBuilding === 'barracks' && !stats.hasBarracks) {
        flash('Build a Barracks first');
        return;
      }
      if (item.requiresBuilding === 'dungeon' && !stats.hasDungeon) {
        flash('Build a Dungeon first');
        return;
      }
      if (item.requiresBuilding === 'tavern' && stats.tavernCount <= 0) {
        flash('Build a Tavern first');
        return;
      }
      if (item.requiresBuilding === 'gallows' && !stats.hasGallows) {
        flash('Build Gallows first');
        return;
      }
      if (item.requiresExtraKeep && stats.keepCount < 2) {
        flash('Need another keep first');
        return;
      }
      if (
        item.uniqueThrone &&
        ((role === 'king' && stats.hasKing) ||
          (role === 'queen' && stats.hasQueen))
      ) {
        flash('The realm already has that monarch');
        return;
      }
      const ok = await spend(item.cost);
      if (!ok) {
        flash('Not enough gold');
        return;
      }
      setHireRequest({ seq: Date.now(), role });
    },
    [
      flash,
      spend,
      stats.freeBeds,
      stats.hasCathedral,
      stats.hasDungeon,
      stats.hasGallows,
      stats.hasInfirmary,
      stats.hasBarracks,
      stats.hasKing,
      stats.hasQueen,
      stats.keepCount,
      stats.royaltyUnlocked,
      stats.tavernCount,
    ]
  );

  const handleCareerHire = useCallback(
    async (todo: CareerTodoItem) => {
      const cost =
        todo.cost ||
        Phase12Balance.careerCosts[todo.targetRole] ||
        20;
      const ok = await spend(cost);
      if (!ok) {
        flash('Not enough gold');
        return;
      }
      setCareerHireRequest({
        seq: Date.now(),
        subjectId: todo.subjectId,
        targetRole: todo.targetRole,
      });
    },
    [flash, spend]
  );

  const handleBuyBuilding = useCallback(
    async (kind: BuildKind) => {
      const item = BUILD_CATALOG.find((b) => b.kind === kind);
      if (!item) return;
      if (item.requiresRoyalty && !stats.royaltyUnlocked) {
        flash('Requires King & Queen');
        return;
      }
      if (kind === 'field') {
        if (stats.granaryCount <= 0) {
          flash('Build a granary before buying fields');
          return;
        }
        if (stats.fieldCount >= stats.fieldSlots) {
          flash('Need another granary for more fields');
          return;
        }
      }
      if (kind === 'cemetery' && !stats.hasCathedral) {
        flash('Build a Cathedral first');
        return;
      }
      if (kind === 'gallows' && !stats.hasDungeon) {
        flash('Build a Dungeon first');
        return;
      }
      const ok = await spend(item.cost);
      if (!ok) {
        flash('Not enough gold');
        return;
      }
      // Cheat never deducts — only stash a refund amount when real gold was spent
      setPendingPlaceCost(infiniteGold ? null : item.cost);
      setPlaceRequest({ seq: Date.now(), kind });
      flash(`Place your ${item.name.toLowerCase()} on empty ground`);
    },
    [
      flash,
      infiniteGold,
      spend,
      stats.fieldCount,
      stats.fieldSlots,
      stats.granaryCount,
      stats.hasCathedral,
      stats.hasDungeon,
      stats.royaltyUnlocked,
    ]
  );

  const handleBuyNaval = useCallback(
    async (kind: NavalKind) => {
      const item = NAVAL_CATALOG.find((n) => n.kind === kind);
      if (!item) return;
      if (!stats.hasDock) {
        flash('Build a Dock first');
        return;
      }
      if (kind === 'fishingBoat' && stats.fishingBoatCount >= stats.fishingBoatCapacity) {
        flash('No dock has room for another boat');
        return;
      }
      if (kind === 'warship' && stats.warshipCount >= stats.warshipCapacity) {
        flash('No dock has room for another warship');
        return;
      }
      const ok = await spend(item.cost);
      if (!ok) {
        flash('Not enough gold');
        return;
      }
      setNavalRequest({ seq: Date.now(), kind });
    },
    [
      flash,
      spend,
      stats.hasDock,
      stats.fishingBoatCapacity,
      stats.fishingBoatCount,
      stats.warshipCapacity,
      stats.warshipCount,
    ]
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

  const handleRansom = useCallback(
    async (id: string, cost: number) => {
      const ok = await spend(cost);
      if (!ok) {
        flash('Not enough gold');
        return;
      }
      setRansomRequest({ seq: Date.now(), id });
      window.setTimeout(() => refreshCaptives(), 100);
    },
    [flash, refreshCaptives, spend]
  );

  const showSidePanels = kingdomReady && !needsSetup && !namingAfterLoss;

  const closePlaySheets = useCallback(() => {
    setShowMarket(false);
    setShowQuestions(false);
    setShowRansom(false);
    setSelected(null);
    setSelectedBuilding(null);
    setSelectedCamp(null);
    setDeselectToken((n) => n + 1);
    setCareerTodosVisible(false);
  }, [setCareerTodosVisible]);

  const openMarket = useCallback(() => {
    setMenuOpen(false);
    setShowQuestions(false);
    setShowRansom(false);
    setSelected(null);
    setSelectedBuilding(null);
    setSelectedCamp(null);
    setDeselectToken((n) => n + 1);
    setShowMarket((v) => !v);
  }, []);

  const openQuestions = useCallback(() => {
    setMenuOpen(false);
    setShowMarket(false);
    setShowRansom(false);
    setShowQuestions((v) => !v);
  }, []);

  const chromeBlockingZoom =
    menuOpen ||
    menuOverlayOpen ||
    showMarket ||
    showQuestions ||
    showRansom ||
    !!selected ||
    !!selectedBuilding ||
    !!selectedCamp ||
    todosVisible ||
    !!gameOver;

  return (
    <div className="app">
      <header className="hud">
        <div className="brand">
          <h1 aria-live="polite">
            <span className="brand-clock">
              {day.dayPhase} · {formatClock(day.hour)}
            </span>
          </h1>
          <p className="tagline">
            {kingdom.name
              ? `${kingdom.name} · Day ${kingdom.daysPlayed}`
              : 'Name your kingdom to begin'}
            {stats.inspired ? ' · Inspired!' : ''}
          </p>
        </div>
        <div className="hud-resources" aria-label="Resources">
          <div
            className="gold resource-pill"
            aria-live="polite"
            title={infiniteGold ? 'Gold (cheat ∞)' : `Gold: ${gold}`}
          >
            <span className="pill-full">
              Gold:{' '}
              <strong>
                {infiniteGold ? '∞' : gold}
                {infiniteGold ? (
                  <span className="cheat-badge"> cheat</span>
                ) : null}
              </strong>
            </span>
            <span className="pill-short">
              G <strong>{infiniteGold ? '∞' : gold}</strong>
            </span>
          </div>
          {showSidePanels && (
            <>
              <div className="food resource-pill" aria-live="polite" title={`Food: ${food}`}>
                <span className="pill-full">
                  Food: <strong>{food}</strong>
                </span>
                <span className="pill-short">
                  F <strong>{food}</strong>
                </span>
              </div>
              <div
                className="pop resource-pill"
                aria-live="polite"
                title={`Population ${stats.population} / ${stats.capacity} (${stats.freeBeds} free beds)`}
              >
                <span className="pill-full">
                  Pop: <strong>{stats.population}</strong>
                  <span className="pop-cap"> / {stats.capacity}</span>
                </span>
                <span className="pill-short">
                  P{' '}
                  <strong>
                    {stats.population}/{stats.capacity}
                  </strong>
                </span>
              </div>
            </>
          )}
        </div>
        <div className="hud-actions">
          {showSidePanels && (
            <>
              <button
                type="button"
                className="hud-icon-btn touch-btn hud-desktop-only"
                onClick={openQuestions}
                aria-pressed={showQuestions}
              >
                {showQuestions ? 'Hide questions' : 'Questions'}
              </button>
              <button
                type="button"
                className="hud-icon-btn touch-btn"
                onClick={openMarket}
                aria-pressed={showMarket}
                aria-label={showMarket ? 'Hide marketplace' : 'Marketplace'}
                title="Marketplace"
              >
                <span className="hud-btn-full">
                  {showMarket ? 'Hide market' : 'Marketplace'}
                </span>
                <span className="hud-btn-short" aria-hidden="true">
                  Mkt
                </span>
              </button>
              {careerTodoCount > 0 && (
                <button
                  type="button"
                  className="hud-icon-btn touch-btn hud-desktop-only"
                  aria-pressed={showCareerTodos}
                  onClick={() => setCareerTodosVisible(!showCareerTodos)}
                >
                  {showCareerTodos
                    ? 'Hide wishes'
                    : `Wishes (${careerTodoCount})`}
                </button>
              )}
              {(captives.length > 0 || showRansom) && (
                <button
                  type="button"
                  className="hud-icon-btn touch-btn hud-desktop-only"
                  onClick={() => setShowRansom((v) => !v)}
                >
                  {showRansom
                    ? 'Hide ransom'
                    : `Ransom (${captives.length})`}
                </button>
              )}
            </>
          )}
          <a className="back hud-desktop-only" href={config.hostUrl}>
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
              infiniteGold={infiniteGold}
              onToggleInfiniteGold={setCheatInfiniteGold}
              showCareerTodos={showCareerTodos}
              onToggleShowCareerTodos={setCareerTodosVisible}
              sandboxSettings={sandboxSettings}
              onSandboxSettingsChange={updateSandboxSettings}
              onSandboxSettingsReset={resetSandboxSettings}
              onSandboxSpawn={(action) =>
                setSandboxSpawnRequest({ seq: Date.now(), action })
              }
              open={menuOpen || needsSetup || namingAfterLoss}
              onOpenChange={(next) => {
                if (next) {
                  setShowMarket(false);
                  setShowQuestions(false);
                  setShowRansom(false);
                }
                setMenuOpen(next);
              }}
              knowledgeQuestUrl={config.hostUrl}
              captiveCount={captives.length}
              showRansomOpen={showRansom}
              onOpenQuestions={openQuestions}
              onOpenRansom={() => {
                setShowMarket(false);
                setShowQuestions(false);
                setShowRansom((v) => !v);
              }}
              onOverlayChange={setMenuOverlayOpen}
            />
          )}
        </div>
      </header>

      <main className="stage">
        {kingdomReady && !needsSetup && (
          <PhaserGame
            remountKey={remountKey}
            daysPlayed={kingdom.daysPlayed}
            sandboxSettings={sandboxSettings}
            sandboxSpawnRequest={sandboxSpawnRequest}
            cameraZoomRequest={cameraZoomRequest}
            hireRequest={hireRequest}
            placeRequest={placeRequest}
            cancelPlaceToken={cancelPlaceToken}
            ransomRequest={ransomRequest}
            transformRequest={transformRequest}
            commandRequest={commandRequest}
            careerHireRequest={careerHireRequest}
            executeRequest={executeRequest}
            destroyCampRequest={destroyCampRequest}
            arrestCampRequest={arrestCampRequest}
            focusCampRequest={focusCampRequest}
            navalRequest={navalRequest}
            onSubjectSelected={(s) => {
              if (s) {
                setShowMarket(false);
                setShowQuestions(false);
                setShowRansom(false);
                setMenuOpen(false);
              }
              setSelected(s);
            }}
            onBuildingSelected={(b) => {
              if (b) {
                setShowMarket(false);
                setShowQuestions(false);
                setMenuOpen(false);
              }
              setSelectedBuilding(b);
            }}
            onCampSelected={(c) => {
              if (c) {
                setShowMarket(false);
                setShowQuestions(false);
                setMenuOpen(false);
              }
              setSelectedCamp(c);
            }}
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
            onGoldRecovered={(payload) => {
              void addGold(payload.amount).then((total) => {
                flash(
                  `Recovered ${payload.amount} gold from a ${payload.kind} (${total} total)`
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
            onFoodChanged={setFoodAmount}
            onRoyalCaptured={(_payload: RoyalCapturedPayload) => {
              refreshCaptives();
              setShowRansom(true);
            }}
            onCaptivesChanged={() => {
              refreshCaptives();
            }}
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

        {toast && (
          <div className={`toast${chromeBlockingZoom ? ' toast-elevated' : ''}`}>
            {toast}
          </div>
        )}

        {showSidePanels && !chromeBlockingZoom && (
          <div className="camera-zoom" role="group" aria-label="Camera zoom">
            <button
              type="button"
              className="camera-zoom-btn touch-btn"
              aria-label="Zoom out"
              onClick={() =>
                setCameraZoomRequest({ seq: Date.now(), direction: -1 })
              }
            >
              −
            </button>
            <button
              type="button"
              className="camera-zoom-btn touch-btn"
              aria-label="Zoom in"
              onClick={() =>
                setCameraZoomRequest({ seq: Date.now(), direction: 1 })
              }
            >
              +
            </button>
          </div>
        )}

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
          <>
            <button
              type="button"
              className="sheet-scrim side-scrim"
              aria-label="Close panel"
              onClick={() => {
                closePlaySheets();
              }}
            />
            <aside className="side-panels sheet-stack">
              {todosVisible && (
                <TodoPanel
                  todos={stats.careerTodos ?? []}
                  gold={gold}
                  infiniteGold={infiniteGold}
                  onHire={(todo) => {
                    void handleCareerHire(todo);
                  }}
                  onHide={() => setCareerTodosVisible(false)}
                />
              )}
              {selected && (
                <InspectorPanel
                  subject={selected}
                  militaryAvailable={stats.militaryAvailable}
                  onClose={() => {
                    setSelected(null);
                    setDeselectToken((n) => n + 1);
                  }}
                  onTransformPeasant={() => {
                    setTransformRequest({
                      seq: Date.now(),
                      fgmId: selected.id,
                    });
                  }}
                  onCommandTroops={(troopCount) => {
                    setCommandRequest({
                      seq: Date.now(),
                      generalId: selected.id,
                      troopCount,
                    });
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
              {selectedCamp && (
                <CampInspectorPanel
                  camp={selectedCamp}
                  onArrest={() => {
                    setArrestCampRequest({
                      seq: Date.now(),
                      campId: selectedCamp.id,
                    });
                  }}
                  onDestroy={() => {
                    setDestroyCampRequest({
                      seq: Date.now(),
                      campId: selectedCamp.id,
                    });
                  }}
                  onClose={() => {
                    setSelectedCamp(null);
                    setDeselectToken((n) => n + 1);
                  }}
                  onSelectUnit={(unit: CampRosterEntry) => {
                    setFocusCampRequest({
                      seq: Date.now(),
                      campId: selectedCamp.id,
                      unitId: unit.id,
                    });
                    if (unit.status === 'away') {
                      flash(`${unit.name} is out raiding — not home right now`);
                    }
                  }}
                />
              )}
              {showRansom && (
                <RansomPanel
                  captives={captives}
                  gold={gold}
                  infiniteGold={infiniteGold}
                  canExecute={stats.canExecuteCaptive}
                  onRansom={(id, cost) => {
                    void handleRansom(id, cost);
                  }}
                  onExecute={(id) => {
                    setExecuteRequest({ seq: Date.now(), id });
                  }}
                  onClose={() => setShowRansom(false)}
                />
              )}
              {showQuestions && (
                <QuestionPanel
                  settings={settings}
                  ready={ready}
                  onGoldEarned={earnCorrectAnswer}
                  onClose={() => setShowQuestions(false)}
                />
              )}
              {showMarket && (
                <MarketplacePanel
                  gold={gold}
                  infiniteGold={infiniteGold}
                  stats={stats}
                  placeMode={placeMode}
                  enabledRoles={sandboxSettings.units.kinds}
                  onHire={(role) => {
                    void handleHire(role);
                  }}
                  onBuyBuilding={(kind) => {
                    void handleBuyBuilding(kind);
                  }}
                  onBuyNaval={(kind) => {
                    void handleBuyNaval(kind);
                  }}
                  onCancelPlace={() => {
                    refundPendingPlace(true);
                    setCancelPlaceToken((n) => n + 1);
                  }}
                  onClose={() => setShowMarket(false)}
                />
              )}
            </aside>
          </>
        )}
      </main>
    </div>
  );
}
