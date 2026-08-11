export interface LifeLogEntry {
  day: number;
  text: string;
  kind?: string;
}

export const LIFE_LOG_CAP = 50;

export function appendLifeLog(
  log: LifeLogEntry[] | undefined,
  day: number,
  text: string,
  kind?: string
): LifeLogEntry[] {
  const next = [...(log ?? []), { day, text, kind }];
  if (next.length <= LIFE_LOG_CAP) return next;
  // Keep first (birth) entry when trimming
  const birth = next[0];
  const rest = next.slice(1);
  const trimmed = rest.slice(-(LIFE_LOG_CAP - 1));
  return birth ? [birth, ...trimmed] : trimmed;
}

export function dedupeSameDayKind(
  log: LifeLogEntry[],
  day: number,
  kind: string
): boolean {
  return log.some((e) => e.day === day && e.kind === kind);
}

export function backstoryFromLifeLog(log: LifeLogEntry[]): string {
  if (!log.length) {
    return 'A stranger from the wild wood, nursing old grudges.';
  }
  const recent = [...log].reverse().find((e) => e.kind !== 'birth') ?? log[0]!;
  const t = recent.text.toLowerCase();
  if (t.includes('siege') || t.includes('raid') || t.includes('burn')) {
    return `They let the realm burn while I suffered: “${recent.text}”`;
  }
  if (t.includes('hunger') || t.includes('starv') || t.includes('bare')) {
    return `The keep hoarded grain while we starved: “${recent.text}”`;
  }
  if (t.includes('wedding') || t.includes('married') || t.includes('spouse')) {
    return `Love and loss twisted me: “${recent.text}”`;
  }
  if (t.includes('arrest') || t.includes('dungeon')) {
    return `Chains and iron made me bitter: “${recent.text}”`;
  }
  if (t.includes('defect') || t.includes('fled') || t.includes('witch')) {
    return `I left their bright streets behind: “${recent.text}”`;
  }
  return `My past will not be forgotten: “${recent.text}”`;
}
