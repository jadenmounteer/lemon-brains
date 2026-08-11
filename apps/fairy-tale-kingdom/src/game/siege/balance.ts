/** Tunable siege / morale / defense numbers for Phase 8. */

export const SiegeBalance = {
  /** Sliding window for % loss rout check (ms). */
  routWindowMs: 8000,
  /** Fraction of starting wave that must die inside routWindowMs. */
  routLossFraction: 0.4,
  /** Alternate burst: N kills inside burstWindowMs. */
  routBurstKills: 3,
  routBurstWindowMs: 4000,

  ramHp: 55,
  catapultHp: 40,
  trebuchetHp: 50,

  ramDps: 14,
  catapultDps: 10,
  trebuchetDps: 16,
  ramRange: 28,
  catapultRange: 140,
  trebuchetRange: 200,
  catapultCooldownMs: 2200,
  trebuchetCooldownMs: 3200,
  ramCooldownMs: 900,

  ballistaRange: 130,
  ballistaDamage: 10,
  ballistaEngineMult: 1.6,
  ballistaCooldownMs: 1600,

  watchtowerArcherRangeMult: 1.25,
  watchtowerRadius: 70,

  engineMoveSpeed: 22,
  musterHoldMs: 2500,
  investSpread: 36,

  fieldBurnPriorityRadius: 90,
  vfxMaxFlames: 12,
  vfxMaxProjectiles: 20,
} as const;

export type EngineKind = 'ram' | 'catapult' | 'trebuchet';

export function enginesForRaidCount(raidCount: number): EngineKind[] {
  const out: EngineKind[] = ['ram'];
  if (raidCount >= 6) out.push('catapult');
  if (raidCount >= 9) out.push('trebuchet');
  if (raidCount >= 12) out.push('catapult');
  return out;
}
