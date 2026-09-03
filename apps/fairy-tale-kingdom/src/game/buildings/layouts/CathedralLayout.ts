import { layoutPoint } from './layoutUtils';

/**
 * Offsets are relative to the cathedral building origin (bottom-center of footprint).
 * Footprint is 320×280, so walkable interior is roughly y in [-280, 0].
 * Positive y is outdoors south of the doors — do not put ceremony spots there.
 */
const ALTAR = { x: 0, y: -70 };
const BISHOP = { x: 0, y: -50 };
/** South nave door, just inside the footprint (matches interior nav door cell). */
const DOOR = { x: 0, y: -4 };
const PEW_LEFT = [
  { x: -90, y: -36 },
  { x: -90, y: -64 },
  { x: -90, y: -92 },
];
const PEW_RIGHT = [
  { x: 90, y: -36 },
  { x: 90, y: -64 },
  { x: 90, y: -92 },
];
const AISLE = [
  { x: -40, y: -28 },
  { x: 0, y: -44 },
  { x: 40, y: -28 },
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
