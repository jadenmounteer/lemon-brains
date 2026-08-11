import { useCallback, useEffect, useState } from 'react';
import { KingdomRepository, type KingdomSave } from './KingdomRepository';

const repository = new KingdomRepository();

export function useKingdom() {
  const [kingdom, setKingdom] = useState<KingdomSave>({
    name: '',
    daysPlayed: 0,
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    repository.load().then((data) => {
      if (!cancelled) {
        setKingdom(data);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const startNewKingdom = useCallback(async (name: string) => {
    const next = await repository.startNew(name);
    setKingdom(next);
    return next;
  }, []);

  const incrementDay = useCallback(async () => {
    const next = await repository.incrementDays(1);
    setKingdom(next);
    return next;
  }, []);

  const needsSetup = ready && !kingdom.name;

  return {
    kingdom,
    ready,
    needsSetup,
    startNewKingdom,
    incrementDay,
  };
}
