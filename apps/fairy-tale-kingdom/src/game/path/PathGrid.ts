import type { Aabb } from '../buildings/BuildingSystem';
import type { Point } from '../subjects/zones';

export interface GridPos {
  col: number;
  row: number;
}

/** Coarse walkability grid; terrain blocks survive clear() for buildings. */
export class PathGrid {
  readonly cols: number;
  readonly rows: number;
  private blocked: boolean[];
  private terrainBlocked: boolean[];

  constructor(
    readonly worldW: number,
    readonly worldH: number,
    readonly tile: number
  ) {
    this.cols = Math.ceil(worldW / tile);
    this.rows = Math.ceil(worldH / tile);
    this.blocked = new Array(this.cols * this.rows).fill(false);
    this.terrainBlocked = new Array(this.cols * this.rows).fill(false);
  }

  /** Reset building blocks; re-apply terrain impassable cells. */
  clear(): void {
    for (let i = 0; i < this.blocked.length; i++) {
      this.blocked[i] = this.terrainBlocked[i]!;
    }
  }

  markTerrainBlocked(col: number, row: number): void {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return;
    const i = row * this.cols + col;
    this.terrainBlocked[i] = true;
    this.blocked[i] = true;
  }

  applyTerrainFromMap(mapData: number[][], isBlockedTile: (t: number) => boolean): void {
    this.terrainBlocked.fill(false);
    for (let r = 0; r < mapData.length && r < this.rows; r++) {
      const row = mapData[r]!;
      for (let c = 0; c < row.length && c < this.cols; c++) {
        if (isBlockedTile(row[c]!)) {
          this.markTerrainBlocked(c, r);
        }
      }
    }
  }

  markAabbBlocked(box: Aabb): void {
    const c0 = Math.max(0, Math.floor(box.left / this.tile));
    const c1 = Math.min(this.cols - 1, Math.floor((box.right - 0.01) / this.tile));
    const r0 = Math.max(0, Math.floor(box.top / this.tile));
    const r1 = Math.min(this.rows - 1, Math.floor((box.bottom - 0.01) / this.tile));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        this.blocked[r * this.cols + c] = true;
      }
    }
  }

  worldToGrid(x: number, y: number): GridPos {
    return {
      col: clamp(Math.floor(x / this.tile), 0, this.cols - 1),
      row: clamp(Math.floor(y / this.tile), 0, this.rows - 1),
    };
  }

  gridToWorld(col: number, row: number): Point {
    return {
      x: col * this.tile + this.tile / 2,
      y: row * this.tile + this.tile / 2,
    };
  }

  isBlocked(col: number, row: number): boolean {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return true;
    return this.blocked[row * this.cols + col]!;
  }

  isWorldBlocked(x: number, y: number): boolean {
    const g = this.worldToGrid(x, y);
    return this.isBlocked(g.col, g.row);
  }

  findPath(from: Point, to: Point): Point[] | null {
    let start = this.worldToGrid(from.x, from.y);
    let goal = this.worldToGrid(to.x, to.y);
    if (this.isBlocked(start.col, start.row)) {
      const alt = this.nearestOpen(start);
      if (!alt) return null;
      start = alt;
    }
    if (this.isBlocked(goal.col, goal.row)) {
      const alt = this.nearestOpen(goal);
      if (!alt) return null;
      goal = alt;
    }
    return this.bfs(start, goal);
  }

  private nearestOpen(pos: GridPos): GridPos | null {
    if (!this.isBlocked(pos.col, pos.row)) return pos;
    const q: GridPos[] = [pos];
    const seen = new Set<string>([`${pos.col},${pos.row}`]);
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    while (q.length) {
      const cur = q.shift()!;
      for (const [dc, dr] of dirs) {
        const n = { col: cur.col + dc!, row: cur.row + dr! };
        const key = `${n.col},${n.row}`;
        if (seen.has(key)) continue;
        if (n.col < 0 || n.row < 0 || n.col >= this.cols || n.row >= this.rows) {
          continue;
        }
        seen.add(key);
        if (!this.isBlocked(n.col, n.row)) return n;
        q.push(n);
      }
    }
    return null;
  }

  private bfs(start: GridPos, goal: GridPos): Point[] | null {
    const q: GridPos[] = [start];
    const prev = new Map<string, string | null>();
    prev.set(`${start.col},${start.row}`, null);
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    while (q.length) {
      const cur = q.shift()!;
      if (cur.col === goal.col && cur.row === goal.row) {
        return this.reconstruct(prev, goal);
      }
      for (const [dc, dr] of dirs) {
        const n = { col: cur.col + dc!, row: cur.row + dr! };
        const key = `${n.col},${n.row}`;
        if (prev.has(key)) continue;
        if (this.isBlocked(n.col, n.row)) continue;
        prev.set(key, `${cur.col},${cur.row}`);
        q.push(n);
      }
    }
    return null;
  }

  private reconstruct(prev: Map<string, string | null>, goal: GridPos): Point[] {
    const path: Point[] = [];
    let key: string | null = `${goal.col},${goal.row}`;
    while (key) {
      const [c, r] = key.split(',').map(Number) as [number, number];
      path.push(this.gridToWorld(c, r));
      key = prev.get(key) ?? null;
    }
    path.reverse();
    return path;
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
