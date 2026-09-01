/** Pure early-game raid pressure curve (testable without sandbox runtime). */

export function computeEarlyPressureFactor(
  days: number,
  population: number,
  raidPressure: number,
  intensity: number
): number {
  const mult = raidPressure * intensity;
  if (mult <= 0) return 0;
  let base: number;
  if (days >= 8 && population >= 12) base = 1;
  else if (days < 8) base = 0.12 + days * 0.08;
  else base = 0.4 + Math.min(0.5, population * 0.04);
  return Math.min(1, base * mult);
}
