import type { ZoneId } from './types';

export interface WorldBounds {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Pick a point inside a schedule zone. Home uses the subject’s house position. */
export function randomPointInZone(
  zone: ZoneId,
  world: WorldBounds,
  homePoint: Point | null,
  rand: () => number = Math.random
): Point {
  const cx = world.width / 2;
  const cy = world.height / 2;
  const jitter = (span: number) => (rand() - 0.5) * span;

  switch (zone) {
    case 'keep':
      return { x: cx + jitter(48), y: cy + 36 + jitter(28) };
    case 'wall':
      return { x: cx + jitter(70), y: cy - 48 + jitter(20) };
    case 'path':
      return rand() < 0.5
        ? { x: cx + jitter(24), y: cy + jitter(200) }
        : { x: cx + jitter(220), y: cy + jitter(18) };
    case 'field':
      return { x: cx + jitter(160), y: cy + 90 + jitter(60) };
    case 'home': {
      const hx = homePoint?.x ?? cx - 64;
      const hy = homePoint?.y ?? cy + 8;
      return { x: hx + jitter(28), y: hy + 12 + jitter(16) };
    }
  }
}
