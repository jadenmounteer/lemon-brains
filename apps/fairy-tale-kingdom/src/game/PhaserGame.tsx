import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import type { BuildKind, NavalKind } from '../marketplace/catalog';
import type { UnitRole } from './art/assetManifest';
import { createGame } from './createGame';
import {
  KingdomEvents,
  type CaptivesChangedPayload,
  type FoodChangedPayload,
  type GameOverPayload,
  type GoldStolenPayload,
  type MarketToastPayload,
  type PlaceModePayload,
  type RaidWarningPayload,
  type RoyalCapturedPayload,
} from './subjects/events';
import type {
  BuildingSnapshot,
  CampSnapshot,
  DaySnapshot,
  KingdomStats,
  SubjectSnapshot,
} from './subjects/types';
import {
  SANDBOX_REGISTRY_KEY,
  type SandboxSettings,
} from '../kingdom/sandboxSettings';
import { setSandboxRuntime } from './sandboxRuntime';

interface PhaserGameProps {
  remountKey: number;
  daysPlayed: number;
  sandboxSettings: SandboxSettings;
  hireRequest: { seq: number; role: UnitRole } | null;
  placeRequest: { seq: number; kind: BuildKind } | null;
  cancelPlaceToken: number;
  ransomRequest: { seq: number; id: string } | null;
  transformRequest: { seq: number; fgmId: string } | null;
  commandRequest: {
    seq: number;
    generalId: string;
    troopCount: number;
  } | null;
  careerHireRequest: {
    seq: number;
    subjectId: string;
    targetRole: UnitRole;
  } | null;
  executeRequest?: { seq: number; id: string } | null;
  destroyCampRequest?: { seq: number; campId: string } | null;
  arrestCampRequest?: { seq: number; campId: string } | null;
  focusCampRequest?: { seq: number; campId: string; unitId?: string } | null;
  navalRequest?: { seq: number; kind: NavalKind } | null;
  onSubjectSelected: (subject: SubjectSnapshot | null) => void;
  onBuildingSelected: (building: BuildingSnapshot | null) => void;
  onCampSelected: (camp: CampSnapshot | null) => void;
  onDayTick: (day: DaySnapshot) => void;
  onDayRolled: () => void;
  onGoldStolen: (payload: GoldStolenPayload) => void;
  onGoldRecovered?: (payload: { amount: number; kind: string }) => void;
  onGameOver: (payload: GameOverPayload) => void;
  onRaidWarning: (payload: RaidWarningPayload) => void;
  onKingdomStats: (stats: KingdomStats) => void;
  onPlaceMode: (mode: PlaceModePayload) => void;
  onMarketToast: (message: string) => void;
  onFoodChanged: (food: number) => void;
  onRoyalCaptured: (payload: RoyalCapturedPayload) => void;
  onCaptivesChanged: (count: number) => void;
  deselectToken: number;
}

export function PhaserGame({
  remountKey,
  daysPlayed,
  sandboxSettings,
  hireRequest,
  placeRequest,
  cancelPlaceToken,
  ransomRequest,
  transformRequest,
  commandRequest,
  careerHireRequest,
  executeRequest,
  destroyCampRequest,
  arrestCampRequest,
  focusCampRequest,
  navalRequest,
  onSubjectSelected,
  onBuildingSelected,
  onCampSelected,
  onDayTick,
  onDayRolled,
  onGoldStolen,
  onGoldRecovered,
  onGameOver,
  onRaidWarning,
  onKingdomStats,
  onPlaceMode,
  onMarketToast,
  onFoodChanged,
  onRoyalCaptured,
  onCaptivesChanged,
  deselectToken,
}: PhaserGameProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const onSelectRef = useRef(onSubjectSelected);
  const onBuildingRef = useRef(onBuildingSelected);
  const onCampRef = useRef(onCampSelected);
  const onDayRef = useRef(onDayTick);
  const onRolledRef = useRef(onDayRolled);
  const onStolenRef = useRef(onGoldStolen);
  const onRecoveredRef = useRef(onGoldRecovered);
  const onOverRef = useRef(onGameOver);
  const onWarnRef = useRef(onRaidWarning);
  const onStatsRef = useRef(onKingdomStats);
  const onPlaceRef = useRef(onPlaceMode);
  const onToastRef = useRef(onMarketToast);
  const onFoodRef = useRef(onFoodChanged);
  const onCaptureRef = useRef(onRoyalCaptured);
  const onCaptivesRef = useRef(onCaptivesChanged);

  onSelectRef.current = onSubjectSelected;
  onBuildingRef.current = onBuildingSelected;
  onCampRef.current = onCampSelected;
  onDayRef.current = onDayTick;
  onRolledRef.current = onDayRolled;
  onStolenRef.current = onGoldStolen;
  onRecoveredRef.current = onGoldRecovered;
  onOverRef.current = onGameOver;
  onWarnRef.current = onRaidWarning;
  onStatsRef.current = onKingdomStats;
  onPlaceRef.current = onPlaceMode;
  onToastRef.current = onMarketToast;
  onFoodRef.current = onFoodChanged;
  onCaptureRef.current = onRoyalCaptured;
  onCaptivesRef.current = onCaptivesChanged;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    if (gameRef.current) {
      gameRef.current.destroy(true);
      gameRef.current = null;
    }

    const game = createGame(host);
    gameRef.current = game;
    setSandboxRuntime(sandboxSettings);
    game.registry.set(SANDBOX_REGISTRY_KEY, sandboxSettings);
    game.registry.set('daysPlayed', daysPlayed);

    const handleSelect = (snap: SubjectSnapshot | null) => {
      onSelectRef.current(snap);
    };
    const handleBuilding = (snap: BuildingSnapshot | null) => {
      onBuildingRef.current(snap);
    };
    const handleCamp = (snap: CampSnapshot | null) => {
      onCampRef.current(snap);
    };
    const handleDay = (day: DaySnapshot) => {
      onDayRef.current(day);
    };
    const handleRolled = () => {
      onRolledRef.current();
    };
    const handleStolen = (payload: GoldStolenPayload) => {
      onStolenRef.current(payload);
    };
    const handleRecovered = (payload: { amount: number; kind: string }) => {
      onRecoveredRef.current?.(payload);
    };
    const handleOver = (payload: GameOverPayload) => {
      onOverRef.current(payload);
    };
    const handleWarn = (payload: RaidWarningPayload) => {
      onWarnRef.current(payload);
    };
    const handleStats = (stats: KingdomStats) => {
      onStatsRef.current(stats);
    };
    const handlePlace = (mode: PlaceModePayload) => {
      onPlaceRef.current(mode);
    };
    const handleToast = (payload: MarketToastPayload) => {
      onToastRef.current(payload.message);
    };
    const handleFood = (payload: FoodChangedPayload) => {
      onFoodRef.current(payload.food);
    };
    const handleCapture = (payload: RoyalCapturedPayload) => {
      onCaptureRef.current(payload);
    };
    const handleCaptives = (payload: CaptivesChangedPayload) => {
      onCaptivesRef.current(payload.count);
    };

    game.events.on(KingdomEvents.SUBJECT_SELECTED, handleSelect);
    game.events.on(KingdomEvents.BUILDING_SELECTED, handleBuilding);
    game.events.on(KingdomEvents.CAMP_SELECTED, handleCamp);
    game.events.on(KingdomEvents.DAY_TICK, handleDay);
    game.events.on(KingdomEvents.DAY_ROLLED, handleRolled);
    game.events.on(KingdomEvents.GOLD_STOLEN, handleStolen);
    game.events.on(KingdomEvents.GOLD_RECOVERED, handleRecovered);
    game.events.on(KingdomEvents.GAME_OVER, handleOver);
    game.events.on(KingdomEvents.RAID_WARNING, handleWarn);
    game.events.on(KingdomEvents.KINGDOM_STATS, handleStats);
    game.events.on(KingdomEvents.PLACE_MODE_CHANGED, handlePlace);
    game.events.on(KingdomEvents.MARKET_TOAST, handleToast);
    game.events.on(KingdomEvents.FOOD_CHANGED, handleFood);
    game.events.on(KingdomEvents.ROYAL_CAPTURED, handleCapture);
    game.events.on(KingdomEvents.CAPTIVES_CHANGED, handleCaptives);

    return () => {
      game.events.off(KingdomEvents.SUBJECT_SELECTED, handleSelect);
      game.events.off(KingdomEvents.BUILDING_SELECTED, handleBuilding);
      game.events.off(KingdomEvents.CAMP_SELECTED, handleCamp);
      game.events.off(KingdomEvents.DAY_TICK, handleDay);
      game.events.off(KingdomEvents.DAY_ROLLED, handleRolled);
      game.events.off(KingdomEvents.GOLD_STOLEN, handleStolen);
      game.events.off(KingdomEvents.GOLD_RECOVERED, handleRecovered);
      game.events.off(KingdomEvents.GAME_OVER, handleOver);
      game.events.off(KingdomEvents.RAID_WARNING, handleWarn);
      game.events.off(KingdomEvents.KINGDOM_STATS, handleStats);
      game.events.off(KingdomEvents.PLACE_MODE_CHANGED, handlePlace);
      game.events.off(KingdomEvents.MARKET_TOAST, handleToast);
      game.events.off(KingdomEvents.FOOD_CHANGED, handleFood);
      game.events.off(KingdomEvents.ROYAL_CAPTURED, handleCapture);
      game.events.off(KingdomEvents.CAPTIVES_CHANGED, handleCaptives);
      game.destroy(true);
      gameRef.current = null;
    };
  }, [remountKey]);

  useEffect(() => {
    if (deselectToken === 0) return;
    gameRef.current?.events.emit(KingdomEvents.CLEAR_SELECTION);
  }, [deselectToken]);

  useEffect(() => {
    if (!hireRequest) return;
    gameRef.current?.events.emit(KingdomEvents.HIRE_SUBJECT, {
      role: hireRequest.role,
    });
  }, [hireRequest]);

  useEffect(() => {
    if (!placeRequest) return;
    gameRef.current?.events.emit(KingdomEvents.BEGIN_PLACE, {
      kind: placeRequest.kind,
    });
  }, [placeRequest]);

  useEffect(() => {
    if (cancelPlaceToken === 0) return;
    gameRef.current?.events.emit(KingdomEvents.CANCEL_PLACE);
  }, [cancelPlaceToken]);

  useEffect(() => {
    if (!ransomRequest) return;
    gameRef.current?.events.emit(KingdomEvents.PAY_RANSOM, {
      id: ransomRequest.id,
    });
  }, [ransomRequest]);

  useEffect(() => {
    if (!transformRequest) return;
    gameRef.current?.events.emit(KingdomEvents.TRANSFORM_PEASANT, {
      fgmId: transformRequest.fgmId,
    });
  }, [transformRequest]);

  useEffect(() => {
    gameRef.current?.registry.set('daysPlayed', daysPlayed);
    gameRef.current?.events.emit(KingdomEvents.SET_DAYS_PLAYED, {
      daysPlayed,
    });
  }, [daysPlayed]);

  useEffect(() => {
    setSandboxRuntime(sandboxSettings);
    gameRef.current?.registry.set(SANDBOX_REGISTRY_KEY, sandboxSettings);
  }, [sandboxSettings]);

  useEffect(() => {
    if (!commandRequest) return;
    gameRef.current?.events.emit(KingdomEvents.COMMAND_DETACHMENT, {
      generalId: commandRequest.generalId,
      troopCount: commandRequest.troopCount,
    });
  }, [commandRequest]);

  useEffect(() => {
    if (!careerHireRequest) return;
    gameRef.current?.events.emit(KingdomEvents.CAREER_HIRE, {
      subjectId: careerHireRequest.subjectId,
      targetRole: careerHireRequest.targetRole,
    });
  }, [careerHireRequest]);

  useEffect(() => {
    if (!executeRequest) return;
    gameRef.current?.events.emit(KingdomEvents.EXECUTE_CAPTIVE, {
      id: executeRequest.id,
    });
  }, [executeRequest]);

  useEffect(() => {
    if (!destroyCampRequest) return;
    gameRef.current?.events.emit(KingdomEvents.DESTROY_CAMP, {
      campId: destroyCampRequest.campId,
    });
  }, [destroyCampRequest]);

  useEffect(() => {
    if (!arrestCampRequest) return;
    gameRef.current?.events.emit(KingdomEvents.ARREST_CAMP, {
      campId: arrestCampRequest.campId,
    });
  }, [arrestCampRequest]);

  useEffect(() => {
    if (!focusCampRequest) return;
    gameRef.current?.events.emit(KingdomEvents.FOCUS_CAMP, {
      campId: focusCampRequest.campId,
      unitId: focusCampRequest.unitId,
    });
  }, [focusCampRequest]);

  useEffect(() => {
    if (!navalRequest) return;
    gameRef.current?.events.emit(KingdomEvents.BUY_NAVAL, {
      kind: navalRequest.kind,
    });
  }, [navalRequest]);

  return <div className="phaser-host" ref={hostRef} />;
}
