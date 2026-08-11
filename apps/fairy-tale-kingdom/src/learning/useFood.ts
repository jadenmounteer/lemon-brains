import { useCallback, useEffect, useState } from 'react';
import { EconomyBalance } from '../game/economy/economy';
import { FoodRepository } from './FoodRepository';

const repository = new FoodRepository();

export function useFood() {
  const [food, setFood] = useState<number>(EconomyBalance.starterFood);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    repository.load().then((amount) => {
      if (!cancelled) {
        setFood(amount);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setFoodAmount = useCallback((amount: number) => {
    setFood(amount);
  }, []);

  const resetFood = useCallback(async () => {
    await repository.reset();
    setFood(EconomyBalance.starterFood);
  }, []);

  return { food, ready, setFoodAmount, resetFood };
}
