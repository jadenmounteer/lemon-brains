import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import { createGame } from './createGame';
import {
  KingdomEvents,
  type GameOverPayload,
  type GoldStolenPayload,
  type RaidWarningPayload,
} from './subjects/events';
import type { DaySnapshot, SubjectSnapshot } from './subjects/types';

interface PhaserGameProps {
  remountKey: number;
  onSubjectSelected: (subject: SubjectSnapshot | null) => void;
  onDayTick: (day: DaySnapshot) => void;
  onDayRolled: () => void;
  onGoldStolen: (payload: GoldStolenPayload) => void;
  onGameOver: (payload: GameOverPayload) => void;
  onRaidWarning: (payload: RaidWarningPayload) => void;
  deselectToken: number;
}

export function PhaserGame({
  remountKey,
  onSubjectSelected,
  onDayTick,
  onDayRolled,
  onGoldStolen,
  onGameOver,
  onRaidWarning,
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

  onSelectRef.current = onSubjectSelected;
  onDayRef.current = onDayTick;
  onRolledRef.current = onDayRolled;
  onStolenRef.current = onGoldStolen;
  onOverRef.current = onGameOver;
  onWarnRef.current = onRaidWarning;

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

    game.events.on(KingdomEvents.SUBJECT_SELECTED, handleSelect);
    game.events.on(KingdomEvents.DAY_TICK, handleDay);
    game.events.on(KingdomEvents.DAY_ROLLED, handleRolled);
    game.events.on(KingdomEvents.GOLD_STOLEN, handleStolen);
    game.events.on(KingdomEvents.GAME_OVER, handleOver);
    game.events.on(KingdomEvents.RAID_WARNING, handleWarn);

    return () => {
      game.events.off(KingdomEvents.SUBJECT_SELECTED, handleSelect);
      game.events.off(KingdomEvents.DAY_TICK, handleDay);
      game.events.off(KingdomEvents.DAY_ROLLED, handleRolled);
      game.events.off(KingdomEvents.GOLD_STOLEN, handleStolen);
      game.events.off(KingdomEvents.GAME_OVER, handleOver);
      game.events.off(KingdomEvents.RAID_WARNING, handleWarn);
      game.destroy(true);
      gameRef.current = null;
    };
  }, [remountKey]);

  useEffect(() => {
    if (deselectToken === 0) return;
    gameRef.current?.events.emit(KingdomEvents.CLEAR_SELECTION);
  }, [deselectToken]);

  return <div className="phaser-host" ref={hostRef} />;
}
