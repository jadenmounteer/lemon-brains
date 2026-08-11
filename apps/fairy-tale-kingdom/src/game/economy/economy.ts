/** Shared economy / royalty balance for Phase 7 */

export const EconomyBalance = {
  starterFood: 20,
  foodCap: 999,
  foodPerHarvestTick: 1,
  harvestRange: 40,
  harvestTickMs: 800,
  lowFoodMult: 3,
  hungerStarvePerHour: 12,
  hungerRecoverPerHour: 18,
  sickAtHunger: 60,
  dieAtHunger: 100,
  granaryHarvestMult: 1.5,
  waveIntervalMs: 150_000,
  waveDurationMs: 20_000,
  waveHarvestMult: 1.25,
  waveCombatMult: 1.15,
  waveMoveMult: 1.15,
  barracksDamageMult: 1.15,
  princeSpawnMs: 150_000,
  fgmTransformCooldownMs: 75_000,
  fgmTransformRange: 56,
  ballMinIntervalMs: 180_000,
  ballDurationMs: 45_000,
  festivalMinIntervalMs: 210_000,
  festivalDurationMs: 40_000,
  festivalHarvestMult: 1.2,
  thiefCheckMs: 90_000,
  thiefNightOnly: true,
} as const;

export const RANSOM_COST: Record<string, number> = {
  king: 50,
  queen: 50,
  prince: 35,
  princess: 35,
  fairy_godmother: 40,
  bishop: 30,
  physician: 25,
};

export const BEDS_PER_MANOR = 2;
