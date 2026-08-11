/**
 * Day-scaled war difficulty. daysPlayed 0 = early game; grows over weeks.
 */

export type CampKind = 'bandit' | 'giant' | 'goblin' | 'thief' | 'siege';

function dayScale(days: number): number {
  return Math.max(0, days);
}

export const WarBalance = {
  /** ms between attempts to place a new fringe camp */
  campSpawnIntervalMs(days: number): number {
    const d = dayScale(days);
    return Math.max(45_000, 120_000 - d * 2_500);
  },

  maxCamps(days: number): number {
    const d = dayScale(days);
    return Math.min(14, 3 + Math.floor(d / 3));
  },

  /** Idle garrison size before a raid launches */
  raidThreshold(kind: CampKind, days: number): number {
    const d = dayScale(days);
    const base =
      kind === 'giant' ? 2 : kind === 'goblin' ? 3 : kind === 'thief' ? 2 : 2;
    return base + Math.floor(d / 8);
  },

  garrisonCap(kind: CampKind, days: number): number {
    const d = dayScale(days);
    const base =
      kind === 'giant' ? 4 : kind === 'goblin' ? 8 : kind === 'thief' ? 5 : 6;
    return Math.min(14, base + Math.floor(d / 5));
  },

  /** ms between spawning one garrison unit at a camp */
  garrisonSpawnMs(kind: CampKind, days: number): number {
    const d = dayScale(days);
    const base =
      kind === 'goblin' ? 18_000 : kind === 'giant' ? 35_000 : 28_000;
    return Math.max(10_000, base - d * 400);
  },

  /** Units sent on a raid from a camp */
  raidPartySize(kind: CampKind, days: number, roster: number): number {
    const thresh = this.raidThreshold(kind, days);
    const want =
      kind === 'goblin'
        ? 2 + Math.floor(dayScale(days) / 10)
        : kind === 'giant'
          ? 1 + Math.floor(dayScale(days) / 12)
          : 1 + Math.floor(dayScale(days) / 10);
    return Math.min(roster, Math.max(thresh, want));
  },

  /** Gold stolen per kind (goblin between bandit and giant) */
  stealAmount(kind: 'bandit' | 'giant' | 'goblin' | 'thief'): number {
    switch (kind) {
      case 'bandit':
        return 8;
      case 'goblin':
        return 6;
      case 'giant':
        return 18;
      case 'thief':
        return 12;
    }
  },

  siegeArmyCount(days: number): number {
    const d = dayScale(days);
    return Math.min(10, 3 + Math.floor(d / 4));
  },

  /** Starting supply pool for a siege encampment */
  siegeMaxSupply(days: number): number {
    const d = dayScale(days);
    return 8 + Math.floor(d / 2);
  },

  /** Supply cost per reinforcement spawn */
  siegeReinforceCost: 1,

  siegeReinforceMs(days: number): number {
    const d = dayScale(days);
    return Math.max(8_000, 22_000 - d * 300);
  },

  /** How often army waves try to arrive (via encampment system) */
  siegeWaveIntervalMs(days: number): number {
    const d = dayScale(days);
    return Math.max(90_000, 180_000 - d * 3_000);
  },

  aggroRadius: 96,

  campKindsWeighted(days: number): CampKind[] {
    const d = dayScale(days);
    const kinds: CampKind[] = ['bandit', 'bandit', 'thief', 'goblin'];
    if (d >= 2) kinds.push('giant');
    if (d >= 4) kinds.push('goblin', 'bandit');
    if (d >= 8) kinds.push('giant', 'thief');
    return kinds;
  },
} as const;
