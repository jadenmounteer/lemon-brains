import { layoutPoint } from './layoutUtils';

const ALTAR = { x: 0, y: -70 };
const BISHOP = { x: 0, y: -50 };
const DOOR = { x: 0, y: 110 };
const PEW_LEFT = [
  { x: -90, y: 20 },
  { x: -90, y: 60 },
  { x: -90, y: 100 },
];
const PEW_RIGHT = [
  { x: 90, y: 20 },
  { x: 90, y: 60 },
  { x: 90, y: 100 },
];
const AISLE = [
  { x: -40, y: 70 },
  { x: 0, y: 40 },
  { x: 40, y: 70 },
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
