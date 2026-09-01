import type { BuildKind } from '../../../marketplace/catalog';
import { InteriorNavGrid, type InteriorNavSpec } from '../../path/InteriorNavGrid';

/** Rectangular room with perimeter walls and a door on the bottom row. */
function rectRoom(
  cols: number,
  rows: number,
  doorCol: number,
  extraWalls: [number, number][] = []
): InteriorNavSpec {
  const walls: [number, number][] = [...extraWalls];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const border = c === 0 || c === cols - 1 || r === 0 || r === rows - 1;
      const isDoor = r === rows - 1 && c === doorCol;
      if (border && !isDoor) walls.push([c, r]);
    }
  }
  return {
    cellSize: 8,
    cols,
    rows,
    walls,
    doors: [[doorCol, rows - 1]],
  };
}

function hWall(row: number, c0: number, c1: number): [number, number][] {
  const out: [number, number][] = [];
  for (let c = c0; c <= c1; c++) out.push([c, row]);
  return out;
}

function vWall(col: number, r0: number, r1: number): [number, number][] {
  const out: [number, number][] = [];
  for (let r = r0; r <= r1; r++) out.push([col, r]);
  return out;
}

const SPECS: Partial<Record<BuildKind | 'keep', InteriorNavSpec>> = {
  house: rectRoom(7, 6, 3, [
    ...hWall(3, 1, 2),
    ...hWall(3, 4, 5),
    [1, 4],
    [5, 4],
  ]),
  manor: rectRoom(8, 7, 4, [
    ...vWall(4, 2, 4),
    ...hWall(3, 1, 3),
    ...hWall(3, 5, 6),
  ]),
  tavern: rectRoom(6, 5, 3, [
    ...hWall(2, 1, 4),
    [1, 3],
    [4, 3],
  ]),
  bakery: rectRoom(6, 5, 2, [
    ...vWall(3, 1, 3),
    [4, 2],
    [4, 3],
  ]),
  market: rectRoom(6, 4, 3, [
    ...hWall(2, 1, 4),
    [1, 1],
    [4, 1],
  ]),
  infirmary: rectRoom(7, 6, 3, [
    ...vWall(3, 1, 4),
    ...hWall(3, 0, 2),
    ...hWall(3, 4, 6),
  ]),
  granary: rectRoom(5, 6, 2, [
    ...vWall(2, 2, 4),
    [3, 3],
    [3, 4],
  ]),
  barracks: rectRoom(5, 4, 2, [
    ...vWall(2, 0, 2),
    [1, 1],
    [3, 1],
  ]),
  cemetery: rectRoom(6, 5, 3, [
    ...vWall(2, 1, 3),
    ...vWall(4, 1, 3),
  ]),
  gallows: rectRoom(4, 5, 2, [
    [1, 2],
    [2, 2],
  ]),
  dock: rectRoom(5, 4, 2, [
    ...hWall(2, 0, 1),
    ...hWall(2, 3, 4),
  ]),
  watchtower: rectRoom(3, 5, 1, [
    [0, 2],
    [2, 2],
  ]),
  cathedral: rectRoom(40, 35, 20, [
    ...vWall(10, 5, 29),
    ...vWall(30, 5, 29),
    ...hWall(15, 8, 32),
    ...vWall(8, 10, 25),
    ...vWall(32, 10, 25),
  ]),
  dungeon: rectRoom(25, 20, 12, [
    ...vWall(8, 4, 15),
    ...vWall(17, 4, 15),
    ...hWall(10, 4, 20),
    ...hWall(14, 6, 18),
  ]),
  keep: rectRoom(40, 30, 20, [
    ...hWall(8, 12, 28),
    ...vWall(12, 8, 22),
    ...vWall(28, 8, 22),
    ...hWall(14, 8, 12),
    ...hWall(14, 28, 32),
    ...vWall(20, 4, 8),
    ...vWall(20, 22, 26),
    ...hWall(4, 16, 24),
    ...hWall(22, 16, 24),
  ]),
};

export function getInteriorNavSpec(
  kind: BuildKind | 'keep'
): InteriorNavSpec | null {
  return SPECS[kind] ?? null;
}

export function snapToInteriorWalkable(
  kind: BuildKind | 'keep',
  origin: { x: number; y: number },
  wx: number,
  wy: number
): { x: number; y: number } {
  const spec = getInteriorNavSpec(kind);
  if (!spec) return { x: wx, y: wy };
  const nav = new InteriorNavGrid(spec);
  return nav.nearestWalkable(origin, kind, wx, wy);
}
