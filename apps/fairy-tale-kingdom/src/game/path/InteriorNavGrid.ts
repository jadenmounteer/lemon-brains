import type { BuildKind } from '../../marketplace/catalog';
import { footprintAabb } from '../buildings/buildingShared';
import { getInteriorNavSpec } from '../buildings/layouts/InteriorLayoutRegistry';
import type { Point } from '../subjects/zones';
import { astarCells, dedupePoints } from './interiorPathfind';

export interface InteriorNavSpec {
  cellSize: number;
  cols: number;
  rows: number;
  walls: readonly [number, number][];
  doors: readonly [number, number][];
}

export class InteriorNavGrid {
  private readonly blocked: Set<string>;

  constructor(private readonly spec: InteriorNavSpec) {
    this.blocked = new Set(spec.walls.map(([c, r]) => `${c},${r}`));
  }

  static forKind(kind: BuildKind | 'keep'): InteriorNavGrid | null {
    const spec = getInteriorNavSpec(kind);
    return spec ? new InteriorNavGrid(spec) : null;
  }

  footprintBox(origin: { x: number; y: number }, kind: BuildKind | 'keep') {
    return footprintAabb(kind, origin.x, origin.y);
  }

  gridOrigin(origin: { x: number; y: number }, kind: BuildKind | 'keep') {
    const box = this.footprintBox(origin, kind);
    return { left: box.left, top: box.top };
  }

  worldToCell(
    origin: { x: number; y: number },
    kind: BuildKind | 'keep',
    wx: number,
    wy: number
  ): [number, number] | null {
    const { left, top } = this.gridOrigin(origin, kind);
    const c = Math.floor((wx - left) / this.spec.cellSize);
    const r = Math.floor((wy - top) / this.spec.cellSize);
    if (c < 0 || r < 0 || c >= this.spec.cols || r >= this.spec.rows) return null;
    return [c, r];
  }

  cellToWorld(
    origin: { x: number; y: number },
    kind: BuildKind | 'keep',
    col: number,
    row: number
  ): Point {
    const { left, top } = this.gridOrigin(origin, kind);
    return {
      x: left + (col + 0.5) * this.spec.cellSize,
      y: top + (row + 0.5) * this.spec.cellSize,
    };
  }

  isWalkable(col: number, row: number): boolean {
    if (col < 0 || row < 0 || col >= this.spec.cols || row >= this.spec.rows) {
      return false;
    }
    return !this.blocked.has(`${col},${row}`);
  }

  nearestWalkable(
    origin: { x: number; y: number },
    kind: BuildKind | 'keep',
    wx: number,
    wy: number
  ): Point {
    const cell = this.worldToCell(origin, kind, wx, wy);
    if (cell && this.isWalkable(cell[0], cell[1])) {
      return this.cellToWorld(origin, kind, cell[0], cell[1]);
    }
    let best: Point | null = null;
    let bestD = Infinity;
    for (let r = 0; r < this.spec.rows; r++) {
      for (let c = 0; c < this.spec.cols; c++) {
        if (!this.isWalkable(c, r)) continue;
        const p = this.cellToWorld(origin, kind, c, r);
        const d = Math.hypot(p.x - wx, p.y - wy);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
    }
    return best ?? { x: wx, y: wy };
  }

  findPath(
    origin: { x: number; y: number },
    kind: BuildKind | 'keep',
    fromX: number,
    fromY: number,
    toX: number,
    toY: number
  ): Point[] {
    const from = this.worldToCell(origin, kind, fromX, fromY);
    const to = this.worldToCell(origin, kind, toX, toY);
    if (!from || !to) {
      return [];
    }
    let start = from;
    let goal = to;
    if (!this.isWalkable(start[0], start[1])) {
      const near = this.nearestWalkable(origin, kind, fromX, fromY);
      const nc = this.worldToCell(origin, kind, near.x, near.y);
      if (!nc) return [];
      start = nc;
    }
    if (!this.isWalkable(goal[0], goal[1])) {
      const near = this.nearestWalkable(origin, kind, toX, toY);
      const nc = this.worldToCell(origin, kind, near.x, near.y);
      if (!nc) return [];
      goal = nc;
    }
    const cells = astarCells(
      this.spec.cols,
      this.spec.rows,
      this.blocked,
      start,
      goal
    );
    if (!cells || cells.length === 0) {
      return [];
    }
    return dedupePoints(
      cells.map(([c, r]) => this.cellToWorld(origin, kind, c, r))
    );
  }
}
