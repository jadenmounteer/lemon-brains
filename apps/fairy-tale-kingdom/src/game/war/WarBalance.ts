/**
 * Day-scaled war difficulty. daysPlayed 0 = early game; grows over weeks.
 * Multipliers from sandbox settings apply on top of these calmer defaults.
 */

import { getSandboxRuntime } from '../sandboxRuntime';
import { getModeProfile } from '../core/modeRuntime';
import { computeEarlyPressureFactor } from './computeEarlyPressure';

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

function warMult(): number {
  return getSandboxRuntime().war.intensity;
}

export const WarBalance = {
  /** ms between attempts to place a new fringe camp */
  campSpawnIntervalMs(days: number): number {
    const d = dayScale(days);
    const sb = getSandboxRuntime().war;
    const profile = getModeProfile();
    const rate = Math.max(0.01, sb.campSpawnRate * sb.intensity);
    // Calmer base: ~3 min early, floor 75s
    const base = Math.max(75_000, 180_000 - d * 2_000);
    return (base / rate) * profile.campSpawnMult;
  },

  maxCamps(days: number): number {
    const d = dayScale(days);
    const intensity = warMult();
    const cap = Math.min(28, 4 + Math.floor(d / 2));
    if (intensity <= 0) return 0;
    return Math.max(0, Math.round(cap * Math.min(1.5, 0.5 + intensity * 0.5)));
  },

  /** How many concurrent siege camps are allowed */
  maxSiegeCamps(days: number): number {
    const d = dayScale(days);
    const sb = getSandboxRuntime().war;
    if (sb.siegeRate * sb.intensity <= 0 || !sb.kinds.siege) return 0;
    return Math.min(5, 1 + Math.floor(d / 8));
  },

  /** Early-game softener for raid/siege pressure (0–1) */
  earlyPressureFactor(days: number, population: number): number {
    const sb = getSandboxRuntime().war;
    const profile = getModeProfile();
    return computeEarlyPressureFactor(
      days,
      population,
      sb.raidPressure * profile.raidPressureMult,
      sb.intensity
    );
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
    const sb = getSandboxRuntime().war;
    const growth = Math.max(0.01, sb.garrisonGrowth * sb.intensity);
    const base =
      kind === 'goblin'
        ? 22_000
        : kind === 'giant'
          ? 40_000
          : kind === 'coven'
            ? 45_000
            : kind === 'gypsy'
              ? 36_000
              : 32_000;
    return Math.max(12_000, (base - d * 350) / growth);
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
    const sb = getSandboxRuntime().war;
    const rate = sb.siegeRate * sb.intensity;
    if (rate <= 0) return 0;
    return Math.min(10, Math.round((3 + Math.floor(d / 4)) * Math.min(1.5, rate)));
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
    const sb = getSandboxRuntime().war;
    const rate = Math.max(0.01, sb.siegeRate * sb.intensity);
    return Math.max(8_000, (22_000 - d * 300) / rate);
  },

  /** How often army waves try to arrive (via encampment system) */
  siegeWaveIntervalMs(days: number): number {
    const d = dayScale(days);
    const sb = getSandboxRuntime().war;
    const rate = Math.max(0.01, sb.siegeRate * sb.intensity);
    return Math.max(120_000, (240_000 - d * 3_000) / rate);
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

  /** Extra post-raid cooldown padding (ms) — longer = more peace between raids */
  raidCooldownMs(pressure: number): number {
    // Calmer: ~2–4+ minutes between attempts at low pressure
    return 90_000 + Math.random() * 120_000 + (1 - pressure) * 90_000;
  },

  campKindsWeighted(days: number): CampKind[] {
    const d = dayScale(days);
    const enabled = getSandboxRuntime().war.kinds;
    const kinds: CampKind[] = [];
    const push = (k: CampKind, n = 1) => {
      if (!enabled[k]) return;
      for (let i = 0; i < n; i++) kinds.push(k);
    };
    push('bandit', 2);
    push('thief');
    push('goblin');
    if (d >= 2) push('giant');
    if (d >= 3) push('gypsy');
    if (d >= 4) {
      push('goblin');
      push('bandit');
    }
    if (d >= 6) push('coven');
    if (d >= 8) {
      push('giant');
      push('thief');
      push('gypsy');
    }
    return kinds.length ? kinds : (enabled.bandit ? ['bandit'] : []);
  },
};
