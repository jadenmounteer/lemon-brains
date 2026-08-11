/** Format in-game hour (0–24 fractional) as e.g. `7:20pm`. */
export function formatClock(hour: number): string {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  const suffix = h >= 12 ? 'pm' : 'am';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}:${m.toString().padStart(2, '0')}${suffix}`;
}
