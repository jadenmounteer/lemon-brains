import { layoutPoint } from './layoutUtils';

const STALL_A = { x: -10, y: 4 };
const STALL_B = { x: 10, y: 4 };
const MERCHANT = { x: 0, y: 2 };

export function marketStallPoint(
  origin: { x: number; y: number },
  stall: 0 | 1,
  subjectId?: string
): { x: number; y: number } {
  const off = stall === 0 ? STALL_A : STALL_B;
  return layoutPoint(origin, off, subjectId, 3);
}

export function marketMerchantPoint(
  origin: { x: number; y: number },
  subjectId?: string
): { x: number; y: number } {
  return layoutPoint(origin, MERCHANT, subjectId, 3);
}

export function marketAnchorBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
  const pts = [STALL_A, STALL_B, MERCHANT];
  return {
    minX: Math.min(...pts.map((p) => p.x)),
    maxX: Math.max(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxY: Math.max(...pts.map((p) => p.y)),
  };
}
