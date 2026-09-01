/** Fief-scoped movement rules (Phase 2). */
export interface IMovementPolicy {
  clampToFief(
    keepId: string,
    point: { x: number; y: number }
  ): { x: number; y: number };
  randomPointInFief(
    keepId: string,
    zoneId: string
  ): { x: number; y: number } | null;
}
