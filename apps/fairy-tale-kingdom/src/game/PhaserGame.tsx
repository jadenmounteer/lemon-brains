import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import type { BuildKind } from '../marketplace/catalog';
import type { UnitRole } from './art/assetManifest';
import { createGame } from './createGame';
import {
  KingdomEvents,
  type GameOverPayload,
  type GoldStolenPayload,
  type MarketToastPayload,
  type PlaceModePayload,
  type RaidWarningPayload,
} from './subjects/events';
import type {
  DaySnapshot,
  KingdomStats,
  SubjectSnapshot,
} from './subjects/types';

interface PhaserGameProps {
  remountKey: number;
  hireRequest: { seq: number; role: UnitRole } | null;
  placeRequest: { seq: number; kind: BuildKind } | null;
  cancelPlaceToken: number;
  onSubjectSelected: (subject: SubjectSnapshot | null) => void;
  onDayTick: (day: DaySnapshot) => void;
  onDayRolled: () => void;
  onGoldStolen: (payload: GoldStolenPayload) => void;
  onGameOver: (payload: GameOverPayload) => void;
  onRaidWarning: (payload: RaidWarningPayload) => void;
  onKingdomStats: (stats: KingdomStats) => void;
  onPlaceMode: (mode: PlaceModePayload) => void;
  onMarketToast: (message: string) => void;
  deselectToken: number;
}

export function PhaserGame({
  remountKey,
  hireRequest,
  placeRequest,
  cancelPlaceToken,
  onSubjectSelected,
  onDayTick,
  onDayRolled,
  onGoldStolen,
  onGameOver,
  onRaidWarning,
  onKingdomStats,
  onPlaceMode,
  onMarketToast,
  deselectToken,
}: PhaserGameProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const onSelectRef = useRef(onSubjectSelected);
  const onDayRef = useRef(onDayTick);
  const onRolledRef = useRef(onDayRolled);
  const onStolenRef = useRef(onGoldStolen);
  const onOverRef = useRef(onGameOver);
  const onWarnRef = useRef(onRaidWarning);
  const onStatsRef = useRef(onKingdomStats);
  const onPlaceRef = useRef(onPlaceMode);
  const onToastRef = useRef(onMarketToast);

  onSelectRef.current = onSubjectSelected;
  onDayRef.current = onDayTick;
  onRolledRef.current = onDayRolled;
  onStolenRef.current = onGoldStolen;
  onOverRef.current = onGameOver;
  onWarnRef.current = onRaidWarning;
  onStatsRef.current = onKingdomStats;
  onPlaceRef.current = onPlaceMode;
  onToastRef.current = onMarketToast;

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

    game.events.on(KingdomEvents.SUBJECT_SELECTED, handleSelect);
    game.events.on(KingdomEvents.DAY_TICK, handleDay);
    game.events.on(KingdomEvents.DAY_ROLLED, handleRolled);
    game.events.on(KingdomEvents.GOLD_STOLEN, handleStolen);
    game.events.on(KingdomEvents.GAME_OVER, handleOver);
    game.events.on(KingdomEvents.RAID_WARNING, handleWarn);
    game.events.on(KingdomEvents.KINGDOM_STATS, handleStats);
    game.events.on(KingdomEvents.PLACE_MODE_CHANGED, handlePlace);
    game.events.on(KingdomEvents.MARKET_TOAST, handleToast);

    return () => {
      game.events.off(KingdomEvents.SUBJECT_SELECTED, handleSelect);
      game.events.off(KingdomEvents.DAY_TICK, handleDay);
      game.events.off(KingdomEvents.DAY_ROLLED, handleRolled);
      game.events.off(KingdomEvents.GOLD_STOLEN, handleStolen);
      game.events.off(KingdomEvents.GAME_OVER, handleOver);
      game.events.off(KingdomEvents.RAID_WARNING, handleWarn);
      game.events.off(KingdomEvents.KINGDOM_STATS, handleStats);
      game.events.off(KingdomEvents.PLACE_MODE_CHANGED, handlePlace);
      game.events.off(KingdomEvents.MARKET_TOAST, handleToast);
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

  return <div className="phaser-host" ref={hostRef} />;
}
