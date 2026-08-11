import type { ZoneId } from './types';

export interface WorldBounds {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Pick a point inside a schedule zone (simple rectangles around landmarks). */
export function randomPointInZone(
  zone: ZoneId,
  homeIndex: number,
  world: WorldBounds,
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
      const homeX = homeIndex % 2 === 0 ? cx - 64 : cx + 72;
      const homeY = homeIndex % 2 === 0 ? cy + 8 : cy + 16;
      return { x: homeX + jitter(28), y: homeY + 12 + jitter(16) };
    }
  }
}
