import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { config } from './config';
import type { UnitRole } from './game/art/assetManifest';
import { nextCommandSeq, type GameCommand } from './game/GameCommand';
import { resolveGameModeProfile, type KingdomGameMode } from './game/core/GameModeProfile';
import { PhaserGame } from './game/PhaserGame';
import type {
  GameOverPayload,
  GoldStolenPayload,
  KingdomEventPayload,
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
import { ChallengeOfferCard } from './kingdom/ChallengeOfferCard';
import {
  CHALLENGE_COOLDOWN_MS,
  challengeById,
  challengeToStripGoal,
  getNextEarlyChallenge,
  isChallengeComplete,
  pickOccasionalChallenge,
  type MonsterChallengeKind,
  type RealmChallenge,
} from './kingdom/challenges';
import {
  loadChallengePrefs,
  resetChallengePrefs,
  saveChallengePrefs,
  type ChallengePrefs,
} from './kingdom/challengePrefs';
import { KingdomEventsRail } from './kingdom/KingdomEventsRail';
import { KingdomMenu } from './kingdom/KingdomMenu';
import { LayoutRepository } from './kingdom/LayoutRepository';
import { NextForRealmStrip, type StripGoal } from './kingdom/NextForRealmStrip';
import { RansomPanel } from './kingdom/RansomPanel';
import { suggestRealmGoal } from './kingdom/realmGoals';
import { useKingdom } from './kingdom/useKingdom';
import { useSandboxSettings } from './kingdom/useSandboxSettings';
import { LearningPanel } from './learning/LearningPanel';
import { useFood } from './learning/useFood';
import { useGold } from './learning/useGold';
import { useKnowledgeQuestSettings } from './learning/useKnowledgeQuestSettings';
import {
  BUILD_CATALOG,
  NAVAL_CATALOG,
  type BuildKind,
  type NavalKind,
} from './marketplace/catalog';
import { canTrain, hireCost, affordableWallCells, wallPlacementCost } from './marketplace/rules';
import { MarketplacePanel } from './marketplace/MarketplacePanel';
import { InspectorPanel } from './subjects/InspectorPanel';
import { formatClock } from './utils/formatClock';
import { useKingdomEventFeed } from './kingdom/useKingdomEventFeed';
import type { MonsterSlainPayload } from './game/subjects/events';
import { EconomyBalance } from './game/economy/economy';

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
  hasKnight: false,
  hasExecutioner: false,
  royaltyUnlocked: false,
  inspired: false,
  food: 0,
  captiveCount: 0,
  kingCount: 0,
  queenCount: 0,
  fieldSlots: 0,
  militaryAvailable: 0,
};

export default function App() {
  const {
    settings,
    ready,
    updateSettings,
    applyReadingQuickStart,
  } = useKnowledgeQuestSettings();
  const {
    gold,
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
  const [selectedMonsterId, setSelectedMonsterId] = useState<string | null>(
    null
  );
  const [day, setDay] = useState<DaySnapshot>({
    dayPhase: 'Night',
    hour: 0,
  });
  const [kingdomGameMode, setKingdomGameMode] =
    useState<KingdomGameMode>(() => {
      const saved = layoutRepo.loadSync();
      return saved?.gameMode === 'learning' || saved?.gameMode === 'normal'
        ? saved.gameMode
        : 'normal';
    });
  const [remountKey, setRemountKey] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [namingAfterLoss, setNamingAfterLoss] = useState(false);
  const [stats, setStats] = useState<KingdomStats>(DEFAULT_STATS);
  const [challengePrefs, setChallengePrefs] = useState<ChallengePrefs>(() =>
    loadChallengePrefs()
  );
  const [showChallengeOffer, setShowChallengeOffer] = useState(false);
  const [offerChallenge, setOfferChallenge] = useState<RealmChallenge | null>(
    null
  );
  const royalWeddingFlagRef = useRef(false);
  const slainMonsterKindRef = useRef<MonsterChallengeKind | null>(null);
  const {
    pinned: eventPinned,
    recent: eventRecent,
    ingest: ingestKingdomEvent,
    dismissPinned,
    mobileOpen: eventsMobileOpen,
    setMobileOpen: setEventsMobileOpen,
    criticalCount,
    warnCount,
  } = useKingdomEventFeed();
  const [captives, setCaptives] = useState<CaptiveRecord[]>(() =>
    captivesRepo.loadSync()
  );
  const [placeMode, setPlaceMode] = useState<PlaceModePayload>({
    active: false,
    kind: null,
  });
  const [gameCommand, setGameCommand] = useState<GameCommand | null>(null);
  const [gameOver, setGameOver] = useState<GameOverPayload | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuOverlayOpen, setMenuOverlayOpen] = useState(false);
  const [inspectorExpanded, setInspectorExpanded] = useState(false);
  const selectedSubjectIdRef = useRef<string | null>(null);
  const ignoreScrimUntilRef = useRef(0);
  const [pendingPlaceCost, setPendingPlaceCost] = useState<number | null>(null);

  const modeProfile = useMemo(
    () => resolveGameModeProfile(settings.gameDifficulty, kingdomGameMode),
    [settings.gameDifficulty, kingdomGameMode]
  );

  const activeChallenge = useMemo(
    () =>
      challengePrefs.activeId
        ? challengeById(challengePrefs.activeId)
        : null,
    [challengePrefs.activeId]
  );

  const stripGoal = useMemo((): StripGoal | null => {
    const foodLow =
      stats.population > 0 &&
      food < stats.population * EconomyBalance.lowFoodMult;
    if (foodLow && stats.granaryCount > 0) {
      return {
        id: 'food-low',
        label: 'Food is low — farmers needed',
        action: 'market-field',
      };
    }
    if (activeChallenge) {
      return challengeToStripGoal(activeChallenge);
    }
    return suggestRealmGoal({
      stats,
      gold,
      food,
      infiniteGold,
    });
  }, [activeChallenge, stats, gold, food, infiniteGold]);

  const persistChallengePrefs = useCallback((next: ChallengePrefs) => {
    setChallengePrefs(next);
    saveChallengePrefs(next);
  }, []);

  const sendCommand = useCallback((command: GameCommand) => {
    setGameCommand(command);
  }, []);

  const showSide =
    showQuestions ||
    showMarket ||
    showRansom ||
    selected !== null ||
    selectedBuilding !== null ||
    selectedCamp !== null;

  const flash = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const refreshCaptives = useCallback(() => {
    setCaptives(captivesRepo.loadSync());
  }, []);

  const handleNewKingdom = useCallback(
    async (name: string, mode: KingdomGameMode) => {
      await startNewKingdom(name);
      await resetGold();
      await resetFood();
      await layoutRepo.reset();
      await captivesRepo.reset();
      setCaptives([]);
      setKingdomGameMode(mode);
      resetChallengePrefs();
      const first = getNextEarlyChallenge([]);
      const prefs: ChallengePrefs = {
        claimedIds: [],
        activeId: first?.id ?? null,
        nextOfferAt: 0,
        offerSeen: false,
      };
      persistChallengePrefs(prefs);
      setOfferChallenge(first);
      setShowChallengeOffer(Boolean(first));
      if (mode === 'learning') {
        await applyReadingQuickStart();
      }
      setGameOver(null);
      setNamingAfterLoss(false);
      setSelected(null);
      setSelectedBuilding(null);
      setSelectedCamp(null);
      setSelectedMonsterId(null);
      setPlaceMode({ active: false, kind: null });
      setPendingPlaceCost(null);
      setShowRansom(false);
      setStats(DEFAULT_STATS);
      setRemountKey((n) => n + 1);
    },
    [applyReadingQuickStart, persistChallengePrefs, resetFood, resetGold, startNewKingdom]
  );

  const handleTrainAtBuilding = useCallback(
    async (
      buildingId: string,
      role: UnitRole,
      building: BuildingSnapshot,
      castleJob?: import('./game/jobs/capacities').CivilianJob
    ) => {
      const workersAtBuilding =
        building.workers?.filter((w) => w.role === role).length ?? 0;
      const royalUsedAtKeep =
        building.kind === 'keep' ? (building.royalUsed ?? 0) : undefined;
      if (
        !canTrain(building.kind, role, stats, {
          workersAtBuilding,
          enabledRoles: sandboxSettings.units.kinds,
          royalUsedAtKeep,
        })
      ) {
        flash('Cannot train that role here');
        return;
      }
      const cost = hireCost(role);
      const ok = await spend(cost);
      if (!ok) {
        flash('Not enough gold');
        return;
      }
      sendCommand({
        type: 'TRAIN_AT_BUILDING',
        seq: nextCommandSeq(),
        buildingId,
        role,
        castleJob,
      });
    },
    [flash, sandboxSettings.units.kinds, sendCommand, spend, stats]
  );

  const handleCareerHire = useCallback(
    async (subjectId: string, targetRole: UnitRole, cost: number) => {
      const ok = await spend(cost);
      if (!ok) {
        flash('Not enough gold');
        return;
      }
      sendCommand({ type: 'PROMOTE_CAREER', seq: nextCommandSeq(), subjectId, targetRole });
    },
    [flash, sendCommand, spend]
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
      if (kind === 'wall') {
        const maxCells = affordableWallCells(gold, infiniteGold);
        if (maxCells < 1) {
          flash('Not enough gold (3g per wall cell)');
          return;
        }
        sendCommand({
          type: 'BEGIN_PLACE',
          seq: nextCommandSeq(),
          kind: 'wall',
          maxWallCells: maxCells,
        });
        flash('Drag on the map to draw walls (3g per cell)');
        return;
      }
      const ok = await spend(item.cost);
      if (!ok) {
        flash('Not enough gold');
        return;
      }
      // Cheat never deducts — only stash a refund amount when real gold was spent
      setPendingPlaceCost(infiniteGold ? null : item.cost);
      sendCommand({ type: 'BEGIN_PLACE', seq: nextCommandSeq(), kind });
      flash(`Place your ${item.name.toLowerCase()} on empty ground`);
    },
    [
      flash,
      sendCommand,
      infiniteGold,
      spend,
      gold,
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
      sendCommand({ type: 'BUY_NAVAL', seq: nextCommandSeq(), kind });
    },
    [
      flash,
      sendCommand,
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

  const handleMoveBuilding = useCallback(
    (buildingId: string) => {
      setSelectedBuilding(null);
      sendCommand({
        type: 'BEGIN_RELOCATE',
        seq: nextCommandSeq(),
        buildingId,
      });
      flash('Click the map to move your building');
    },
    [flash, sendCommand]
  );

  const handleDemolishBuilding = useCallback(
    (buildingId: string) => {
      setSelectedBuilding(null);
      sendCommand({
        type: 'DEMOLISH_BUILDING',
        seq: nextCommandSeq(),
        buildingId,
      });
    },
    [sendCommand]
  );

  const handleBuildingDemolished = useCallback(
    (refund: number) => {
      if (!infiniteGold && refund > 0) {
        void addGold(refund).then((total) => {
          flash(`Building demolished — ${refund}g refunded (${total} total)`);
        });
      } else {
        flash('Building demolished');
      }
    },
    [addGold, flash, infiniteGold]
  );

  const handleRansom = useCallback(
    async (id: string, cost: number) => {
      const ok = await spend(cost);
      if (!ok) {
        flash('Not enough gold');
        return;
      }
      sendCommand({ type: 'PAY_RANSOM', seq: nextCommandSeq(), id });
      window.setTimeout(() => refreshCaptives(), 100);
    },
    [flash, refreshCaptives, sendCommand, spend]
  );

  const clearSelection = useCallback(() => {
    sendCommand({ type: 'CLEAR_SELECTION', seq: nextCommandSeq() });
  }, [sendCommand]);

  const showSidePanels = kingdomReady && !needsSetup && !namingAfterLoss;

  const closePlaySheets = useCallback(() => {
    setShowMarket(false);
    setShowQuestions(false);
    setShowRansom(false);
    setSelected(null);
    selectedSubjectIdRef.current = null;
    setSelectedBuilding(null);
    setSelectedCamp(null);
    setInspectorExpanded(false);
    clearSelection();
  }, [clearSelection]);

  const openMarket = useCallback(() => {
    setMenuOpen(false);
    setShowQuestions(false);
    setShowRansom(false);
    setSelected(null);
    selectedSubjectIdRef.current = null;
    setSelectedBuilding(null);
    setSelectedCamp(null);
    setInspectorExpanded(false);
    clearSelection();
    setShowMarket((v) => !v);
  }, [clearSelection]);

  const openQuestions = useCallback(() => {
    setMenuOpen(false);
    setShowMarket(false);
    setShowRansom(false);
    setShowQuestions((v) => !v);
  }, []);

  const dismissChallengeOffer = useCallback(() => {
    setShowChallengeOffer(false);
    persistChallengePrefs({ ...challengePrefs, offerSeen: true });
    if (offerChallenge?.kind === 'earn_gold') {
      flash('Your treasury is empty — answer a question to begin.');
    }
  }, [challengePrefs, flash, offerChallenge, persistChallengePrefs]);

  const acceptChallengeOffer = useCallback(() => {
    if (!offerChallenge) {
      setShowChallengeOffer(false);
      return;
    }
    persistChallengePrefs({
      ...challengePrefs,
      activeId: offerChallenge.id,
      offerSeen: true,
    });
    setShowChallengeOffer(false);
    if (offerChallenge.kind === 'earn_gold') {
      setShowQuestions(true);
      flash('Your treasury is empty — answer a question to begin.');
    } else {
      flash(`Challenge accepted: ${offerChallenge.title}`);
    }
  }, [challengePrefs, flash, offerChallenge, persistChallengePrefs]);

  const completeActiveChallenge = useCallback(
    async (challenge: RealmChallenge) => {
      const claimedIds = [...challengePrefs.claimedIds, challenge.id];
      const earlyNext = getNextEarlyChallenge(claimedIds);
      let nextActive: string | null = earlyNext?.id ?? null;
      let nextOfferAt = challengePrefs.nextOfferAt;
      if (!earlyNext) {
        nextOfferAt = Date.now() + CHALLENGE_COOLDOWN_MS;
        nextActive = null;
      }
      persistChallengePrefs({
        claimedIds,
        activeId: nextActive,
        nextOfferAt,
        offerSeen: true,
      });
      await addGold(challenge.rewardGold);
      flash(`Challenge complete — +${challenge.rewardGold}g`);
      ingestKingdomEvent({
        id: `challenge-done-${challenge.id}`,
        severity: 'joy',
        title: `Challenge complete: ${challenge.title}`,
        detail: `+${challenge.rewardGold} gold`,
        ttlMs: 8000,
      });
      if (earlyNext && !challengePrefs.offerSeen) {
        setOfferChallenge(earlyNext);
        setShowChallengeOffer(true);
      }
    },
    [addGold, challengePrefs, flash, ingestKingdomEvent, persistChallengePrefs]
  );

  const handleStripGoal = useCallback(
    (goal: StripGoal) => {
      if (goal.action === 'questions') {
        setShowMarket(false);
        setShowRansom(false);
        setShowQuestions(true);
        return;
      }
      if (goal.action === 'select-subject' && goal.subjectId) {
        sendCommand({
          type: 'FOCUS_SUBJECT',
          seq: nextCommandSeq(),
          subjectId: goal.subjectId,
        });
        return;
      }
      if (goal.action === 'hire-hint') {
        setShowQuestions(false);
        setShowRansom(false);
        setShowMarket(true);
        flash(
          activeChallenge?.payload?.role === 'general'
            ? 'Train a general at the barracks'
            : 'Train a knight at the barracks'
        );
        return;
      }
      if (goal.action === 'royal-hint') {
        flash(
          'Need cathedral + bishop, a royal ball, then fairy godmother blessing — wed before morning.'
        );
        return;
      }
      if (goal.action === 'hunt-hint') {
        flash('Select a knight or monster, then send them on a hunt.');
        return;
      }
      setShowQuestions(false);
      setShowRansom(false);
      setShowMarket(true);
      const placeKind: BuildKind | null =
        goal.action === 'market-granary'
          ? 'granary'
          : goal.action === 'market-field'
            ? 'field'
            : goal.action === 'market-wall'
              ? 'wall'
              : null;
      if (placeKind) {
        const item = BUILD_CATALOG.find((b) => b.kind === placeKind);
        if (item && (infiniteGold || gold >= item.cost)) {
          void (async () => {
            if (!infiniteGold) {
              const ok = await spend(item.cost);
              if (!ok) return;
              setPendingPlaceCost(item.cost);
            }
            sendCommand({
              type: 'BEGIN_PLACE',
              seq: nextCommandSeq(),
              kind: placeKind,
            });
            flash(
              placeKind === 'wall'
                ? 'Drag on the map to draw walls (3g per cell)'
                : `Place your ${item.name.toLowerCase()} on empty ground`
            );
          })();
        }
      }
    },
    [activeChallenge, flash, gold, infiniteGold, sendCommand, spend]
  );

  const handleKingdomEvent = useCallback(
    (payload: KingdomEventPayload) => {
      ingestKingdomEvent(payload);
      if (payload.id === 'challenge-royal-wedding' && !payload.clear) {
        royalWeddingFlagRef.current = true;
      }
      if (
        payload.severity === 'critical' ||
        payload.severity === 'warn' ||
        payload.severity === 'joy'
      ) {
        if (!payload.clear) flash(payload.title);
      }
    },
    [flash, ingestKingdomEvent]
  );

  const handleMonsterSlain = useCallback((payload: MonsterSlainPayload) => {
    slainMonsterKindRef.current = payload.kind;
  }, []);

  const focusFeedEvent = useCallback(
    (item: { x?: number; y?: number }) => {
      if (item.x == null || item.y == null) return;
      sendCommand({
        type: 'CAMERA_PAN',
        seq: nextCommandSeq(),
        x: item.x,
        y: item.y,
      });
      setEventsMobileOpen(false);
    },
    [sendCommand, setEventsMobileOpen]
  );

  useEffect(() => {
    if (!kingdomReady || needsSetup || namingAfterLoss) return;
    if (challengePrefs.activeId) return;
    if (!challengePrefs.offerSeen) {
      const first = getNextEarlyChallenge(challengePrefs.claimedIds);
      if (first) {
        persistChallengePrefs({
          ...challengePrefs,
          activeId: first.id,
        });
        setOfferChallenge(first);
        setShowChallengeOffer(true);
        return;
      }
    }
    const monsterKinds = sandboxSettings.monsters.kinds;
    const enabledMonsterKinds = (
      ['troll', 'ogre', 'dragon'] as MonsterChallengeKind[]
    ).filter((k) => monsterKinds[k]);
    const occasional = pickOccasionalChallenge({
      claimedIds: challengePrefs.claimedIds,
      stats,
      monstersPresent: [],
      enabledMonsterKinds,
      nextOfferAt: challengePrefs.nextOfferAt,
    });
    if (occasional) {
      persistChallengePrefs({
        ...challengePrefs,
        activeId: occasional.id,
      });
      setOfferChallenge(occasional);
      setShowChallengeOffer(true);
    }
  }, [
    kingdomReady,
    needsSetup,
    namingAfterLoss,
    challengePrefs,
    persistChallengePrefs,
    sandboxSettings.monsters,
    stats,
  ]);

  useEffect(() => {
    if (!activeChallenge) return;
    const slain = slainMonsterKindRef.current;
    const wedding = royalWeddingFlagRef.current;
    if (
      isChallengeComplete(activeChallenge, {
        gold,
        stats,
        slainMonsterKind: slain,
        royalWeddingJustCompleted: wedding,
      })
    ) {
      slainMonsterKindRef.current = null;
      royalWeddingFlagRef.current = false;
      void completeActiveChallenge(activeChallenge);
    }
  }, [activeChallenge, gold, stats, completeActiveChallenge]);

  const followingPeek = Boolean(selected && !inspectorExpanded);
  const sheetNeedsScrim =
    showMarket ||
    showQuestions ||
    showRansom ||
    !!selectedBuilding ||
    !!selectedCamp ||
    (Boolean(selected) && inspectorExpanded);

  const chromeBlockingZoom =
    menuOpen ||
    menuOverlayOpen ||
    showMarket ||
    showQuestions ||
    showRansom ||
    (Boolean(selected) && inspectorExpanded) ||
    !!selectedBuilding ||
    !!selectedCamp ||
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
                className="hud-icon-btn touch-btn"
                onClick={openQuestions}
                aria-pressed={showQuestions}
                aria-label={showQuestions ? 'Hide questions' : 'Questions'}
                title="Questions"
              >
                <span className="hud-btn-full">
                  {showQuestions ? 'Hide questions' : 'Questions'}
                </span>
                <span className="hud-btn-short" aria-hidden="true">
                  Q
                </span>
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
              sandboxSettings={sandboxSettings}
              onSandboxSettingsChange={updateSandboxSettings}
              onSandboxSettingsReset={resetSandboxSettings}
              onSandboxSpawn={(action) =>
                sendCommand({
                  type: 'SANDBOX_SPAWN',
                  seq: nextCommandSeq(),
                  action,
                })
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

      {showSidePanels && (
        <NextForRealmStrip goal={stripGoal} onAction={handleStripGoal} />
      )}

      <main className="stage">
        {kingdomReady && !needsSetup && (
          <PhaserGame
            remountKey={remountKey}
            daysPlayed={kingdom.daysPlayed}
            kingdomGameMode={kingdomGameMode}
            gameDifficulty={settings.gameDifficulty}
            sandboxSettings={sandboxSettings}
            command={gameCommand}
            onSubjectSelected={(s) => {
              const nextId = s?.id ?? null;
              const idChanged = nextId !== selectedSubjectIdRef.current;
              selectedSubjectIdRef.current = nextId;

              if (s?.subjectKind === 'monster') {
                setSelectedMonsterId(s.id);
              } else if (!s) {
                setSelectedMonsterId(null);
              }

              if (s) {
                setShowMarket(false);
                setShowRansom(false);
                setMenuOpen(false);
                setSelectedBuilding(null);
                setSelectedCamp(null);
                // Keep Questions open while inspecting — answer-first loop.
                // Only when switching people — refresh ticks must not collapse Details.
                if (idChanged) {
                  const narrow =
                    typeof window !== 'undefined' &&
                    window.matchMedia('(max-width: 720px)').matches;
                  setInspectorExpanded(!narrow);
                }
              } else if (idChanged) {
                setInspectorExpanded(false);
              }
              setSelected(s);
            }}
            onBuildingSelected={(b) => {
              if (b) {
                setShowMarket(false);
                setMenuOpen(false);
                setSelected(null);
                selectedSubjectIdRef.current = null;
                setInspectorExpanded(false);
              }
              setSelectedBuilding(b);
            }}
            onCampSelected={(c) => {
              if (c) {
                setShowMarket(false);
                setMenuOpen(false);
                setSelected(null);
                selectedSubjectIdRef.current = null;
                setInspectorExpanded(false);
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
              const title =
                payload.kind === 'enemy_army'
                  ? `Warning: ${payload.label} approaches!`
                  : `${payload.label} are raiding!`;
              handleKingdomEvent({
                id: 'raid-active',
                severity: 'critical',
                title,
                detail: 'Defend the keep and walls',
                pin: true,
                x: payload.x,
                y: payload.y,
              });
            }}
            onKingdomEvent={handleKingdomEvent}
            onMonsterSlain={handleMonsterSlain}
            onKingdomStats={setStats}
            onPlaceMode={setPlaceMode}
            onBuildingDemolished={handleBuildingDemolished}
            onWallPlaced={(payload) => {
              const cost = wallPlacementCost(payload.cells);
              if (!infiniteGold) {
                void spend(cost).then((ok) => {
                  if (!ok) {
                    flash('Not enough gold for wall placement');
                    return;
                  }
                  flash(
                    `Wall placed — ${payload.cells} cell${payload.cells === 1 ? '' : 's'} (${cost}g)`
                  );
                });
              } else {
                flash(
                  `Wall placed — ${payload.cells} cell${payload.cells === 1 ? '' : 's'}`
                );
              }
            }}
            onFoodChanged={setFoodAmount}
            onRoyalCaptured={(_payload: RoyalCapturedPayload) => {
              refreshCaptives();
              setShowRansom(true);
            }}
            onCaptivesChanged={() => {
              refreshCaptives();
            }}
            onAutoGrantWish={(payload) => {
              void handleCareerHire(payload.subjectId, payload.targetRole, payload.cost);
            }}
            gold={gold}
            infiniteGold={infiniteGold}
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
              if (message === 'Move cancelled') {
                flash(message);
                return;
              }
              if (
                /routing|raiders driven|attackers are routing|siege broken/i.test(
                  message
                )
              ) {
                handleKingdomEvent({
                  id: 'raid-active',
                  severity: 'critical',
                  title: message,
                  clear: true,
                });
              }
              flash(message);
            }}
          />
        )}

        {showSidePanels && (
          <KingdomEventsRail
            pinned={eventPinned}
            recent={eventRecent}
            criticalCount={criticalCount}
            warnCount={warnCount}
            mobileOpen={eventsMobileOpen}
            onMobileOpenChange={setEventsMobileOpen}
            onFocusEvent={focusFeedEvent}
            onDismissPinned={dismissPinned}
          />
        )}

        {showChallengeOffer && offerChallenge && showSidePanels && (
          <ChallengeOfferCard
            challenge={offerChallenge}
            onAccept={acceptChallengeOffer}
            onDismiss={dismissChallengeOffer}
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
                sendCommand({ type: 'CAMERA_ZOOM', seq: nextCommandSeq(), direction: -1 })
              }
            >
              −
            </button>
            <button
              type="button"
              className="camera-zoom-btn touch-btn"
              aria-label="Zoom in"
              onClick={() =>
                sendCommand({ type: 'CAMERA_ZOOM', seq: nextCommandSeq(), direction: 1 })
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
            {sheetNeedsScrim && (
              <button
                type="button"
                className="sheet-scrim side-scrim"
                aria-label="Close panel"
                onClick={() => {
                  if (performance.now() < ignoreScrimUntilRef.current) return;
                  closePlaySheets();
                }}
              />
            )}
            <aside
              className={`side-panels sheet-stack${followingPeek ? ' follow-peek' : ''}`}
            >
              {selected && (
                <InspectorPanel
                  subject={selected}
                  stats={stats}
                  gold={gold}
                  infiniteGold={infiniteGold}
                  militaryAvailable={stats.militaryAvailable}
                  selectedMonsterId={selectedMonsterId}
                  collapsed={!inspectorExpanded}
                  onExpand={() => {
                    ignoreScrimUntilRef.current = performance.now() + 500;
                    setInspectorExpanded(true);
                  }}
                  onCollapse={() => setInspectorExpanded(false)}
                  onClose={() => {
                    setSelected(null);
                    selectedSubjectIdRef.current = null;
                    setSelectedMonsterId(null);
                    setInspectorExpanded(false);
                    clearSelection();
                  }}
                  onTransformPeasant={() => {
                    sendCommand({
                      type: 'TRANSFORM_PEASANT',
                      seq: nextCommandSeq(),
                      fgmId: selected.id,
                    });
                  }}
                  onCommandTroops={(troopCount) => {
                    sendCommand({
                      type: 'COMMAND_DETACHMENT',
                      seq: nextCommandSeq(),
                      generalId: selected.id,
                      troopCount,
                      targetId: selectedMonsterId
                        ? `monster:${selectedMonsterId}`
                        : selectedCamp?.id,
                    });
                  }}
                  onKnightHunt={() => {
                    sendCommand({
                      type: 'COMMAND_KNIGHT_HUNT',
                      seq: nextCommandSeq(),
                      knightId: selected.id,
                      monsterId: selectedMonsterId ?? undefined,
                    });
                  }}
                  onSendNearestKnight={() => {
                    sendCommand({
                      type: 'COMMAND_KNIGHT_HUNT',
                      seq: nextCommandSeq(),
                      monsterId: selected.id,
                    });
                  }}
                  onPromoteCareer={(targetRole, cost) => {
                    void handleCareerHire(selected.id, targetRole, cost);
                  }}
                  onGrantMarriage={() => {
                    sendCommand({
                      type: 'GRANT_MARRIAGE',
                      seq: nextCommandSeq(),
                      subjectId: selected.id,
                    });
                  }}
                  onGrantChild={() => {
                    sendCommand({
                      type: 'GRANT_CHILD',
                      seq: nextCommandSeq(),
                      subjectId: selected.id,
                    });
                  }}
                />
              )}
              {selectedBuilding && (
                <BuildingInspectorPanel
                  building={selectedBuilding}
                  gold={gold}
                  infiniteGold={infiniteGold}
                  stats={stats}
                  enabledRoles={sandboxSettings.units.kinds}
                  onTrain={(buildingId, role, castleJob) => {
                    void handleTrainAtBuilding(
                      buildingId,
                      role,
                      selectedBuilding,
                      castleJob
                    );
                  }}
                  onClose={() => {
                    setSelectedBuilding(null);
                    clearSelection();
                  }}
                  onMove={handleMoveBuilding}
                  onDemolish={handleDemolishBuilding}
                />
              )}
              {selectedCamp && (
                <CampInspectorPanel
                  camp={selectedCamp}
                  onArrest={() => {
                    sendCommand({
                      type: 'ARREST_CAMP',
                      seq: nextCommandSeq(),
                      campId: selectedCamp.id,
                    });
                  }}
                  onDestroy={() => {
                    sendCommand({
                      type: 'DESTROY_CAMP',
                      seq: nextCommandSeq(),
                      campId: selectedCamp.id,
                    });
                  }}
                  onClose={() => {
                    setSelectedCamp(null);
                    clearSelection();
                  }}
                  onSelectUnit={(unit: CampRosterEntry) => {
                    sendCommand({
                      type: 'FOCUS_CAMP',
                      seq: nextCommandSeq(),
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
                  canExecute={
                    Boolean(stats.canExecuteCaptive) && captives.length > 0
                  }
                  onRansom={(id, cost) => {
                    void handleRansom(id, cost);
                  }}
                  onExecute={(id) => {
                    sendCommand({
                      type: 'EXECUTE_CAPTIVE',
                      seq: nextCommandSeq(),
                      id,
                    });
                  }}
                  onClose={() => setShowRansom(false)}
                />
              )}
              {showQuestions && (
                <LearningPanel
                  settings={settings}
                  ready={ready}
                  goldPerCorrect={modeProfile.goldPerCorrect}
                  onGoldEarned={addGold}
                  onStreakMilestone={(n) => flash(`${n} in a row!`)}
                  onUpdateSettings={(partial) => {
                    void updateSettings(partial);
                  }}
                  onQuickStart={() => {
                    void applyReadingQuickStart();
                  }}
                  onClose={() => setShowQuestions(false)}
                />
              )}
              {showMarket && (
                <MarketplacePanel
                  gold={gold}
                  infiniteGold={infiniteGold}
                  stats={stats}
                  placeMode={placeMode}
                  onBuyBuilding={(kind) => {
                    void handleBuyBuilding(kind);
                  }}
                  onBuyNaval={(kind) => {
                    void handleBuyNaval(kind);
                  }}
                  onCancelPlace={() => {
                    if (placeMode.mode !== 'relocate') {
                      refundPendingPlace(true);
                    }
                    sendCommand({ type: 'CANCEL_PLACE', seq: nextCommandSeq() });
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
