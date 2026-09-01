import { FORT_TILE, fortKey } from '../buildings/buildingShared';
import type { Point } from '../subjects/zones';

export interface WallCellNode {
  id: string;
  x: number;
  y: number;
}

/** Ground cell beside stairs that connects to a wall-top node. */
export interface StairsPortal {
  stairsId: string;
  groundX: number;
  groundY: number;
  wallId: string;
  wallX: number;
  wallY: number;
}

/** Enemy siege ladder: ground foothold → wall battlement. */
export interface LadderPortal {
  ladderId: string;
  groundX: number;
  groundY: number;
  wallId: string;
  wallX: number;
  wallY: number;
}

/**
 * Wall-top path graph: nodes at each wall/drawbridge cell, edges along
 * orthogonal neighbors. Stairs and siege ladders act as ground↔wall portals.
 */
export class WallPathGrid {
  private nodes = new Map<string, WallCellNode>();
  private edges = new Map<string, string[]>();
  private stairsPortals: StairsPortal[] = [];
  private ladderPortals: LadderPortal[] = [];

  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.stairsPortals = [];
    this.ladderPortals = [];
  }

  rebuild(input: {
    walls: { id: string; x: number; y: number; kind: 'wall' | 'drawbridge' }[];
    stairs: { id: string; x: number; y: number; attachedWallId?: string }[];
    ladders?: LadderPortal[];
  }): void {
    this.clear();
    const wallByKey = new Map<string, WallCellNode>();
    for (const w of input.walls) {
      const key = fortKey(w.x, w.y);
      const node: WallCellNode = { id: w.id, x: w.x, y: w.y };
      this.nodes.set(key, node);
      wallByKey.set(key, node);
      this.edges.set(key, []);
    }

    const dirs = [
      { dx: 0, dy: -FORT_TILE },
      { dx: FORT_TILE, dy: 0 },
      { dx: 0, dy: FORT_TILE },
      { dx: -FORT_TILE, dy: 0 },
    ];
    for (const [key, node] of this.nodes) {
      for (const { dx, dy } of dirs) {
        const nk = fortKey(node.x + dx, node.y + dy);
        if (this.nodes.has(nk)) {
          this.edges.get(key)!.push(nk);
        }
      }
    }

    for (const s of input.stairs) {
      if (!s.attachedWallId) continue;
      const wall = input.walls.find((w) => w.id === s.attachedWallId);
      if (!wall) continue;
      this.stairsPortals.push({
        stairsId: s.id,
        groundX: s.x,
        groundY: s.y,
        wallId: wall.id,
        wallX: wall.x,
        wallY: wall.y,
      });
    }

    this.ladderPortals = input.ladders ?? [];
  }

  wallNodeAt(x: number, y: number): WallCellNode | null {
    return this.nodes.get(fortKey(x, y)) ?? null;
  }

  nearestWallNode(x: number, y: number): WallCellNode | null {
    let best: WallCellNode | null = null;
    let bestD = Infinity;
    for (const node of this.nodes.values()) {
      const d = Math.hypot(node.x - x, node.y - y);
      if (d < bestD) {
        bestD = d;
        best = node;
      }
    }
    return best;
  }

  stairsPortalNear(x: number, y: number, radius = FORT_TILE * 1.5): StairsPortal | null {
    let best: StairsPortal | null = null;
    let bestD = radius;
    for (const p of this.stairsPortals) {
      const d = Math.hypot(p.groundX - x, p.groundY - y);
      if (d <= bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  ladderPortalNear(x: number, y: number, radius = FORT_TILE * 2): LadderPortal | null {
    let best: LadderPortal | null = null;
    let bestD = radius;
    for (const p of this.ladderPortals) {
      const d = Math.hypot(p.groundX - x, p.groundY - y);
      if (d <= bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  /** BFS along wall-top nodes between two wall cell centers. */
  findWallPath(fromX: number, fromY: number, toX: number, toY: number): Point[] | null {
    const startKey = fortKey(fromX, fromY);
    const goalKey = fortKey(toX, toY);
    if (!this.nodes.has(startKey) || !this.nodes.has(goalKey)) return null;
    if (startKey === goalKey) {
      const n = this.nodes.get(startKey)!;
      return [{ x: n.x, y: n.y }];
    }

    const prev = new Map<string, string | null>();
    const q: string[] = [startKey];
    prev.set(startKey, null);

    while (q.length > 0) {
      const cur = q.shift()!;
      if (cur === goalKey) break;
      for (const nb of this.edges.get(cur) ?? []) {
        if (prev.has(nb)) continue;
        prev.set(nb, cur);
        q.push(nb);
      }
    }

    if (!prev.has(goalKey)) return null;

    const keys: string[] = [];
    let walk: string | null = goalKey;
    while (walk) {
      keys.unshift(walk);
      walk = prev.get(walk) ?? null;
    }
    return keys.map((k) => {
      const n = this.nodes.get(k)!;
      return { x: n.x, y: n.y };
    });
  }

  /** Round-trip: ground → stairs portal → wall node → back down. */
  portalRoundTrip(stairsId: string): {
    up: Point[];
    down: Point[];
  } | null {
    const portal = this.stairsPortals.find((p) => p.stairsId === stairsId);
    if (!portal) return null;
    return {
      up: [
        { x: portal.groundX, y: portal.groundY },
        { x: portal.wallX, y: portal.wallY - 10 },
      ],
      down: [
        { x: portal.wallX, y: portal.wallY - 10 },
        { x: portal.groundX, y: portal.groundY },
      ],
    };
  }

  get stairsPortalsList(): readonly StairsPortal[] {
    return this.stairsPortals;
  }

  get ladderPortalsList(): readonly LadderPortal[] {
    return this.ladderPortals;
  }

  nodeCount(): number {
    return this.nodes.size;
  }
}
