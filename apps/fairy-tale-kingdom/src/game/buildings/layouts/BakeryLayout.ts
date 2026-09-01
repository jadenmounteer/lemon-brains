import { layoutPoint } from './layoutUtils';

const OVEN = { x: 12, y: 2 };
const COUNTER = { x: -6, y: 6 };
const KNEAD = { x: 4, y: 0 };

export function bakeryOvenPoint(
  origin: { x: number; y: number },
  subjectId?: string
): { x: number; y: number } {
  return layoutPoint(origin, OVEN, subjectId, 3);
}

export function bakeryCounterPoint(
  origin: { x: number; y: number },
  subjectId?: string
): { x: number; y: number } {
  return layoutPoint(origin, COUNTER, subjectId, 3);
}

export function bakeryKneadPoint(
  origin: { x: number; y: number },
  subjectId?: string
): { x: number; y: number } {
  return layoutPoint(origin, KNEAD, subjectId, 3);
}

export function bakeryAnchorBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
  const pts = [OVEN, COUNTER, KNEAD];
  return {
    minX: Math.min(...pts.map((p) => p.x)),
    maxX: Math.max(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxY: Math.max(...pts.map((p) => p.y)),
  };
}
