import { layoutPoint } from './layoutUtils';

const ALTAR = { x: 0, y: -14 };
const BISHOP = { x: 0, y: -10 };
const DOOR = { x: 0, y: 22 };
const PEW_LEFT = [
  { x: -18, y: 4 },
  { x: -18, y: 12 },
  { x: -18, y: 20 },
];
const PEW_RIGHT = [
  { x: 18, y: 4 },
  { x: 18, y: 12 },
  { x: 18, y: 20 },
];
const AISLE = [
  { x: -8, y: 14 },
  { x: 0, y: 8 },
  { x: 8, y: 14 },
];

export function cathedralAltar(origin: { x: number; y: number }): { x: number; y: number } {
  return layoutPoint(origin, ALTAR, 'altar', 1);
}

export function cathedralBishopSpot(
  origin: { x: number; y: number },
  subjectId?: string
): { x: number; y: number } {
  return layoutPoint(origin, BISHOP, subjectId, 2);
}

export function cathedralDoor(origin: { x: number; y: number }): { x: number; y: number } {
  return layoutPoint(origin, DOOR, 'door', 2);
}

export function cathedralPewSpot(
  origin: { x: number; y: number },
  side: 'left' | 'right',
  row: number,
  subjectId?: string
): { x: number; y: number } {
  const rows = side === 'left' ? PEW_LEFT : PEW_RIGHT;
  const off = rows[row % rows.length]!;
  return layoutPoint(origin, off, subjectId, 3);
}

export function cathedralAislePoint(
  origin: { x: number; y: number },
  step: number,
  subjectId?: string
): { x: number; y: number } {
  const off = AISLE[step % AISLE.length]!;
  return layoutPoint(origin, off, subjectId, 2);
}

export function cathedralAnchorBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
  const pts = [ALTAR, BISHOP, DOOR, ...PEW_LEFT, ...PEW_RIGHT, ...AISLE];
  return {
    minX: Math.min(...pts.map((p) => p.x)),
    maxX: Math.max(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxY: Math.max(...pts.map((p) => p.y)),
  };
}
