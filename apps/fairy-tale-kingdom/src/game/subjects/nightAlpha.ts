/** Camera overlay alpha from in-game hour (0–24). Midday clear, night darkest. */
export function nightAlphaForHour(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 8 && h < 17) {
    return 0;
  }
  if (h >= 17 && h < 21) {
    return 0.15 + ((h - 17) / 4) * 0.3;
  }
  if (h >= 21 || h < 5) {
    return 0.5;
  }
  // Morning 5–8: fade out
  return 0.5 * (1 - (h - 5) / 3);
}
