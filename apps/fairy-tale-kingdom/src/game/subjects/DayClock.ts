import type { DayPhase } from './types';

/** ~2.5 real minutes per in-game day */
export const DAY_LENGTH_MS = 150_000;

export class DayClock {
  private elapsedMs = 0;

  tick(deltaMs: number): void {
    this.elapsedMs = (this.elapsedMs + deltaMs) % DAY_LENGTH_MS;
  }

  get hour(): number {
    return (this.elapsedMs / DAY_LENGTH_MS) * 24;
  }

  get phase(): DayPhase {
    const h = this.hour;
    if (h >= 5 && h < 11) return 'Morning';
    if (h >= 11 && h < 17) return 'Afternoon';
    if (h >= 17 && h < 21) return 'Evening';
    return 'Night';
  }
}
