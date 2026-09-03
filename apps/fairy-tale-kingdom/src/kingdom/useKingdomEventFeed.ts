import { useCallback, useState } from 'react';
import type { KingdomEventPayload } from '../game/subjects/events';

export interface KingdomFeedItem extends KingdomEventPayload {
  at: number;
}

const MAX_RECENT = 10;

/** React-side queue for the Kingdom Events rail. */
export function useKingdomEventFeed() {
  const [pinned, setPinned] = useState<KingdomFeedItem[]>([]);
  const [recent, setRecent] = useState<KingdomFeedItem[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);

  const ingest = useCallback((payload: KingdomEventPayload) => {
    const at = Date.now();
    if (payload.clear) {
      setPinned((prev) => prev.filter((e) => e.id !== payload.id));
      return;
    }
    const item: KingdomFeedItem = { ...payload, at };
    if (payload.pin || payload.severity === 'critical') {
      setPinned((prev) => {
        const without = prev.filter((e) => e.id !== item.id);
        return [item, ...without].slice(0, 6);
      });
    } else {
      setRecent((prev) => [item, ...prev.filter((e) => e.id !== item.id)].slice(0, MAX_RECENT));
      if (payload.ttlMs && payload.ttlMs > 0) {
        window.setTimeout(() => {
          setRecent((prev) => prev.filter((e) => e.id !== item.id || e.at !== at));
        }, payload.ttlMs);
      }
    }
  }, []);

  const dismissPinned = useCallback((id: string) => {
    setPinned((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const criticalCount = pinned.filter((e) => e.severity === 'critical').length;
  const warnCount = pinned.filter((e) => e.severity === 'warn').length;

  return {
    pinned,
    recent,
    ingest,
    dismissPinned,
    mobileOpen,
    setMobileOpen,
    criticalCount,
    warnCount,
  };
}
