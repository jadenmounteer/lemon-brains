import { describe, expect, it } from 'vitest';
import {
  canThrowAtStocks,
  isStocksSpectacleActive,
  STOCKS_SPECTACLE_MS,
} from '../stocksCrowd';

describe('stocks crowd interest', () => {
  it('treats pelting as a short spectacle, not a standing job', () => {
    expect(isStocksSpectacleActive(0, STOCKS_SPECTACLE_MS)).toBe(true);
    expect(isStocksSpectacleActive(STOCKS_SPECTACLE_MS, STOCKS_SPECTACLE_MS)).toBe(
      false
    );
  });

  it('recruits only during the opening volley, then only a one-toss passer-by', () => {
    const during = canThrowAtStocks({
      spectacleActive: true,
      alreadyTossedThisLock: false,
    });
    expect(during.joinCrowd).toBe(true);
    expect(during.passerbyToss).toBe(false);

    const after = canThrowAtStocks({
      spectacleActive: false,
      alreadyTossedThisLock: false,
    });
    expect(after.joinCrowd).toBe(false);
    expect(after.passerbyToss).toBe(true);
  });

  it('does not pull someone back once they have already thrown at this prisoner', () => {
    const again = canThrowAtStocks({
      spectacleActive: false,
      alreadyTossedThisLock: true,
    });
    expect(again.joinCrowd).toBe(false);
    expect(again.passerbyToss).toBe(false);
  });
});
