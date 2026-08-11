/**
 * Day-scaled war difficulty. daysPlayed 0 = early game; grows over weeks.
 */

export type CampKind =
  | 'bandit'
  | 'giant'
  | 'goblin'
  | 'thief'
  | 'siege'
  | 'gypsy'
  | 'coven';

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
    return Math.min(28, 5 + Math.floor(d / 2));
  },

  /** How many concurrent siege camps are allowed */
  maxSiegeCamps(days: number): number {
    const d = dayScale(days);
    return Math.min(5, 1 + Math.floor(d / 8));
  },

  /** Early-game softener for raid/siege pressure (0–1) */
  earlyPressureFactor(days: number, population: number): number {
    if (days >= 5 && population >= 8) return 1;
    if (days < 5) return 0.35 + days * 0.1;
    return 0.55 + Math.min(0.45, population * 0.05);
  },

  /** Idle garrison size before a raid launches */
  raidThreshold(kind: CampKind, days: number): number {
    const d = dayScale(days);
    const base =
      kind === 'giant'
        ? 2
        : kind === 'goblin'
          ? 3
          : kind === 'thief'
            ? 2
            : kind === 'gypsy' || kind === 'coven'
              ? 99
              : 2;
    return base + Math.floor(d / 8);
  },

  garrisonCap(kind: CampKind, days: number): number {
    const d = dayScale(days);
    const base =
      kind === 'giant'
        ? 4
        : kind === 'goblin'
          ? 8
          : kind === 'thief'
            ? 5
            : kind === 'gypsy'
              ? 4
              : kind === 'coven'
                ? 5
                : 6;
    return Math.min(14, base + Math.floor(d / 5));
  },

  /** ms between spawning one garrison unit at a camp */
  garrisonSpawnMs(kind: CampKind, days: number): number {
    const d = dayScale(days);
    const base =
      kind === 'goblin'
        ? 18_000
        : kind === 'giant'
          ? 35_000
          : kind === 'coven'
            ? 40_000
            : kind === 'gypsy'
              ? 32_000
              : 28_000;
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
  stealAmount(
    kind: 'bandit' | 'giant' | 'goblin' | 'thief' | 'gypsy'
  ): number {
    switch (kind) {
      case 'bandit':
        return 8;
      case 'goblin':
        return 6;
      case 'giant':
        return 18;
      case 'thief':
        return 12;
      case 'gypsy':
        return 4;
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

  /** Range for guards to arrest a whole camp (needs a dungeon) */
  campArrestRange: 140,

  /** Gold bounty per home unit recovered when a camp is arrested */
  campArrestBountyPerUnit: 3,

  /** HP multiplier for a camp's named leader vs rank-and-file */
  leaderHpMult: 1.6,

  /** ms a camp goes leaderless (no raids) after its leader falls */
  demoralizedRecoverMs(days: number): number {
    const d = dayScale(days);
    return Math.max(40_000, 90_000 - d * 1_500);
  },

  campKindsWeighted(days: number): CampKind[] {
    const d = dayScale(days);
    const kinds: CampKind[] = ['bandit', 'bandit', 'thief', 'goblin'];
    if (d >= 2) kinds.push('giant');
    if (d >= 3) kinds.push('gypsy');
    if (d >= 4) kinds.push('goblin', 'bandit');
    if (d >= 6) kinds.push('coven');
    if (d >= 8) kinds.push('giant', 'thief', 'gypsy');
    return kinds;
  },
} as const;
