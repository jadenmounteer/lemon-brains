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
