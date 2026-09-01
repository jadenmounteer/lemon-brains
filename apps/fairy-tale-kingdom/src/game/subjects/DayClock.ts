import type { DayPhase } from './types';

/** ~2.5 real minutes per in-game day */
export const DAY_LENGTH_MS = 150_000;

export class DayClock {
  private elapsedMs = 0;

  /** Advance time. Returns true when a full day rolls over. */
  tick(deltaMs: number): boolean {
    this.elapsedMs += deltaMs;
    if (this.elapsedMs < DAY_LENGTH_MS) {
      return false;
    }
    this.elapsedMs %= DAY_LENGTH_MS;
    return true;
  }

  get hour(): number {
    return (this.elapsedMs / DAY_LENGTH_MS) * 24;
  }

  setHour(hour: number): void {
    const h = ((hour % 24) + 24) % 24;
    this.elapsedMs = (h / 24) * DAY_LENGTH_MS;
  }

  get phase(): DayPhase {
    const h = this.hour;
    if (h >= 5 && h < 11) return 'Morning';
    if (h >= 11 && h < 17) return 'Afternoon';
    if (h >= 17 && h < 21) return 'Evening';
    return 'Night';
  }

  /** Single source of truth for night-only systems (thieves, undead, camps). */
  isNight(): boolean {
    const h = this.hour;
    return h >= 21 || h < 5;
  }
}
