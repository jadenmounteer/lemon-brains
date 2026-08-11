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

  const resetGold = useCallback(async () => {
    await repository.reset();
    setGold(0);
  }, []);

  const stealGold = useCallback(async (amount: number) => {
    return addGold(-Math.abs(amount));
  }, [addGold]);

  const spend = useCallback(async (amount: number) => {
    const ok = await repository.spend(amount);
    if (ok) {
      setGold(await repository.load());
    }
    return ok;
  }, []);

  return {
    gold,
    ready,
    addGold,
    earnCorrectAnswer,
    resetGold,
    stealGold,
    spend,
    rewardAmount: GOLD_PER_CORRECT,
  };
}
