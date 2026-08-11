import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import { createGame } from './createGame';
import { KingdomEvents } from './subjects/events';
import type { DaySnapshot, SubjectSnapshot } from './subjects/types';

interface PhaserGameProps {
  onSubjectSelected: (subject: SubjectSnapshot | null) => void;
  onDayTick: (day: DaySnapshot) => void;
  deselectToken: number;
}

export function PhaserGame({
  onSubjectSelected,
  onDayTick,
  deselectToken,
}: PhaserGameProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const onSelectRef = useRef(onSubjectSelected);
  const onDayRef = useRef(onDayTick);

  onSelectRef.current = onSubjectSelected;
  onDayRef.current = onDayTick;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || gameRef.current) {
      return;
    }

    const game = createGame(host);
    gameRef.current = game;

    const handleSelect = (snap: SubjectSnapshot | null) => {
      onSelectRef.current(snap);
    };
    const handleDay = (day: DaySnapshot) => {
      onDayRef.current(day);
    };

    game.events.on(KingdomEvents.SUBJECT_SELECTED, handleSelect);
    game.events.on(KingdomEvents.DAY_TICK, handleDay);

    return () => {
      game.events.off(KingdomEvents.SUBJECT_SELECTED, handleSelect);
      game.events.off(KingdomEvents.DAY_TICK, handleDay);
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (deselectToken === 0) return;
    gameRef.current?.events.emit(KingdomEvents.CLEAR_SELECTION);
  }, [deselectToken]);

  return <div className="phaser-host" ref={hostRef} />;
}
