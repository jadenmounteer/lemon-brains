import type { ZoneId } from './types';

export interface WorldBounds {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface CavePoint extends Point {
  id: string;
}

let cavePoints: CavePoint[] = [];
let forestCenters: Point[] = [];
let mountainCenters: Point[] = [];

export function setWorldBiomes(opts: {
  caves: CavePoint[];
  forests: Point[];
  mountains: Point[];
}): void {
  cavePoints = opts.caves;
  forestCenters = opts.forests;
  mountainCenters = opts.mountains;
}

export function getCavePoints(): CavePoint[] {
  return cavePoints;
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
    case 'cave': {
      if (cavePoints.length) {
        const cave = cavePoints[Math.floor(rand() * cavePoints.length)]!;
        return { x: cave.x + jitter(20), y: cave.y + 10 + jitter(12) };
      }
      return { x: 80 + jitter(40), y: 80 + jitter(40) };
    }
    case 'forest': {
      if (forestCenters.length) {
        const f = forestCenters[Math.floor(rand() * forestCenters.length)]!;
        return { x: f.x + jitter(48), y: f.y + jitter(48) };
      }
      return { x: cx - 200 + jitter(60), y: cy + jitter(60) };
    }
    case 'mountain': {
      if (mountainCenters.length) {
        const m = mountainCenters[Math.floor(rand() * mountainCenters.length)]!;
        return { x: m.x + jitter(40), y: m.y + 30 + jitter(30) };
      }
      return { x: world.width - 100 + jitter(40), y: 100 + jitter(40) };
    }
  }
}
