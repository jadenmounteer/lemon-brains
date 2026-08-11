import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import type { BuildKind } from '../marketplace/catalog';
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
  DaySnapshot,
  KingdomStats,
  SubjectSnapshot,
} from './subjects/types';

interface PhaserGameProps {
  remountKey: number;
  hireRequest: { seq: number; role: UnitRole } | null;
  placeRequest: { seq: number; kind: BuildKind } | null;
  cancelPlaceToken: number;
  ransomRequest: { seq: number; id: string } | null;
  transformRequest: { seq: number; fgmId: string } | null;
  onSubjectSelected: (subject: SubjectSnapshot | null) => void;
  onBuildingSelected: (building: BuildingSnapshot | null) => void;
  onDayTick: (day: DaySnapshot) => void;
  onDayRolled: () => void;
  onGoldStolen: (payload: GoldStolenPayload) => void;
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
  hireRequest,
  placeRequest,
  cancelPlaceToken,
  ransomRequest,
  transformRequest,
  onSubjectSelected,
  onBuildingSelected,
  onDayTick,
  onDayRolled,
  onGoldStolen,
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
  const onDayRef = useRef(onDayTick);
  const onRolledRef = useRef(onDayRolled);
  const onStolenRef = useRef(onGoldStolen);
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
  onDayRef.current = onDayTick;
  onRolledRef.current = onDayRolled;
  onStolenRef.current = onGoldStolen;
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

    const handleSelect = (snap: SubjectSnapshot | null) => {
      onSelectRef.current(snap);
    };
    const handleBuilding = (snap: BuildingSnapshot | null) => {
      onBuildingRef.current(snap);
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
    game.events.on(KingdomEvents.DAY_TICK, handleDay);
    game.events.on(KingdomEvents.DAY_ROLLED, handleRolled);
    game.events.on(KingdomEvents.GOLD_STOLEN, handleStolen);
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
      game.events.off(KingdomEvents.DAY_TICK, handleDay);
      game.events.off(KingdomEvents.DAY_ROLLED, handleRolled);
      game.events.off(KingdomEvents.GOLD_STOLEN, handleStolen);
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

  return <div className="phaser-host" ref={hostRef} />;
}
