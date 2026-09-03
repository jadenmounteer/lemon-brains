/** Why the inspector Arrest button is disabled, or null if it can fire. */
export function arrestButtonBlockReason(opts: {
  subjectKind?: 'subject' | 'monster';
  hasDungeon: boolean;
  hasGuard: boolean;
}): string | null {
  if (opts.subjectKind === 'monster') return 'Monsters are hunted, not arrested.';
  if (!opts.hasDungeon) return 'Build a dungeon first.';
  if (!opts.hasGuard) return 'Train a guard at the dungeon.';
  return null;
}

/** Why Put in stocks is disabled. */
export function stocksButtonBlockReason(opts: {
  subjectKind?: 'subject' | 'monster';
  hasStocks: boolean;
  hasGuard: boolean;
}): string | null {
  if (opts.subjectKind === 'monster') return 'Monsters are hunted, not pilloried.';
  if (!opts.hasStocks) return 'Build stocks first.';
  if (!opts.hasGuard) return 'Need a free guard to lock them in.';
  return null;
}
