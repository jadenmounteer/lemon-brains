/** Phase 12 tunables for meals, happiness, influence, careers. */
export const Phase12Balance = {
  mealCost: 2,
  mealHungerRecover: 40,
  /** Hunger pressure — pairs with sandbox sickness.hungerRise multiplier. */
  hungerRisePerHour: 10,
  hungerInterruptAt: 45,
  /** Hunger at/above this *may* mark a subject sick (see hungerSickChance). */
  sickAtHunger: 90,
  /** Chance to catch hunger-sickness when crossing the threshold (per hourly tick). */
  hungerSickChance: 0.15,
  /** Hunger at/above this is fatal without food. */
  dieAtHunger: 100,
  eatDurationMs: 1600,
  keepInfluenceRadius: 320,
  /** Happiness bump near supper when cooks are on duty. */
  cookMealHappiness: 2,
  paradeCooldownMs: 180_000,
  paradeDurationMs: 28_000,
  paradeHappiness: 8,
  lineStreetHappiness: 6,
  tavernMealHappiness: 3,
  chatHappiness: 2,
  festivalHappiness: 5,
  jesterAuraRange: 64,
  jesterHappinessPerTick: 1,
  gypsyEntertainRange: 80,
  gypsyEntertainHappiness: 2,
  defectHappinessThreshold: 20,
  defectHoursNeeded: 6,
  /** Extra happiness lost each hour without a house. */
  homelessHappinessDrain: 2,
  /** Miserable homeless peasants/children defect sooner. */
  homelessDefectHoursNeeded: 3,
  pregnancyDays: 4,
  childPromoteAge: 14,
  elderAge: 55,
  defaultLifespan: 72,
  royalLifespan: 80,
  arrestBountyGold: 3,
  careerCosts: {
    guard: 18,
    soldier: 22,
    archer: 22,
    knight: 40,
    general: 65,
    bishop: 50,
    witch_hunter: 45,
    dungeon_keeper: 30,
    executioner: 35,
    jester: 28,
    physician: 35,
  } as Record<string, number>,
} as const;
