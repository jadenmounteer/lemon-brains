import { layoutPoint } from './layoutUtils';

export const DUNGEON_CELL_COUNT = 4;

const GATE = { x: 0, y: 50 };
const CELLS = [
  { x: -70, y: -20 },
  { x: -20, y: -20 },
  { x: 30, y: -20 },
  { x: 80, y: -20 },
];
const PATROL = [
  { x: -60, y: 30 },
  { x: 0, y: 10 },
  { x: 60, y: 30 },
  { x: 0, y: -40 },
];
const KEEPER_DESK = { x: 50, y: 40 };

export function dungeonGatePoint(
  origin: { x: number; y: number },
  subjectId?: string
): { x: number; y: number } {
  return layoutPoint(origin, GATE, subjectId, 2);
}

export function dungeonCellPoint(
  origin: { x: number; y: number },
  cellIndex: number,
  subjectId?: string
): { x: number; y: number } {
  const off = CELLS[cellIndex % CELLS.length] ?? CELLS[0]!;
  return layoutPoint(origin, off, subjectId ?? `cell-${cellIndex}`, 3);
}

export function dungeonPatrolPoint(
  origin: { x: number; y: number },
  waypointIndex: number,
  subjectId?: string
): { x: number; y: number } {
  const off = PATROL[waypointIndex % PATROL.length]!;
  return layoutPoint(origin, off, subjectId, 4);
}

export function dungeonKeeperDesk(
  origin: { x: number; y: number },
  subjectId?: string
): { x: number; y: number } {
  return layoutPoint(origin, KEEPER_DESK, subjectId, 2);
}

/** All anchor offsets must stay inside the dungeon footprint (~200×160). */
export function dungeonAnchorBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
  const xs = [...CELLS, GATE, ...PATROL, KEEPER_DESK].map((p) => p.x);
  const ys = [...CELLS, GATE, ...PATROL, KEEPER_DESK].map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}
