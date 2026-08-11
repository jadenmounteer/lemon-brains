import { useCallback, useEffect, useState } from 'react';
import { GOLD_PER_CORRECT, GoldRepository } from './GoldRepository';

const repository = new GoldRepository();

export function useGold() {
  const [gold, setGold] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    repository.load().then((amount) => {
      if (!cancelled) {
        setGold(amount);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const addGold = useCallback(async (delta: number) => {
    const next = await repository.add(delta);
    setGold(next);
    return next;
  }, []);

  const earnCorrectAnswer = useCallback(async () => {
    return addGold(GOLD_PER_CORRECT);
  }, [addGold]);

  return { gold, ready, addGold, earnCorrectAnswer, rewardAmount: GOLD_PER_CORRECT };
}
