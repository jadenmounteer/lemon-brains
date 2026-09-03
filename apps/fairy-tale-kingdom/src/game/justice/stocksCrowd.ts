/** Opening volley after someone is locked in. Then NPCs resume their schedule. */
export const STOCKS_SPECTACLE_MS = 16_000;

export function isStocksSpectacleActive(
  nowMs: number,
  spectacleUntilMs: number | undefined
): boolean {
  return (spectacleUntilMs ?? 0) > nowMs;
}

/** One throw per person per lock-in. After that they go back to their day. */
export function canThrowAtStocks(opts: {
  spectacleActive: boolean;
  alreadyTossedThisLock: boolean;
}): { joinCrowd: boolean; passerbyToss: boolean } {
  if (opts.alreadyTossedThisLock) {
    return { joinCrowd: false, passerbyToss: false };
  }
  if (opts.spectacleActive) {
    return { joinCrowd: true, passerbyToss: false };
  }
  return { joinCrowd: false, passerbyToss: true };
}
