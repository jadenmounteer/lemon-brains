export type InjuredCandidate = {
  id: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  onWall: boolean;
  allegiance?: string | null;
  hidden?: boolean;
};

/** Nearest hurt kingdom subject — no search-radius cap. */
export function pickNearestInjured(
  physicianId: string,
  from: { x: number; y: number },
  candidates: InjuredCandidate[]
): InjuredCandidate | null {
  let best: InjuredCandidate | null = null;
  let bestD = Infinity;
  for (const s of candidates) {
    if (s.id === physicianId) continue;
    if (s.hidden) continue;
    if (s.allegiance === 'camp') continue;
    if (s.hp >= s.maxHp) continue;
    const d = Math.hypot(s.x - from.x, s.y - from.y);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}
