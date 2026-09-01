import {
  FORT_TILE,
  fortKey,
  cornerExteriorGroundCells,
  isWallCornerMask,
} from '../buildings/buildingShared';
import type { Point } from '../subjects/zones';

export interface WallCellNode {
  id: string;
  x: number;
  y: number;
}

/** Defender ground cell that connects to a wall-top node (ladder or corner). */
export interface ClimbPortal {
  climbId: string;
  groundX: number;
  groundY: number;
  wallId: string;
  wallX: number;
  wallY: number;
}

/** Enemy siege ladder: ground foothold → wall battlement. */
export interface SiegeLadderPortal {
  ladderId: string;
  groundX: number;
  groundY: number;
  wallId: string;
  wallX: number;
  wallY: number;
}

/** @deprecated Use ClimbPortal */
export type StairsPortal = ClimbPortal & { stairsId: string };

/**
 * Wall-top path graph: nodes at each wall/drawbridge cell, edges along
 * orthogonal neighbors. Defender ladders and corners act as ground↔wall portals.
 */
export class WallPathGrid {
  private nodes = new Map<string, WallCellNode>();
  private edges = new Map<string, string[]>();
  private climbPortals: ClimbPortal[] = [];
  private siegeLadderPortals: SiegeLadderPortal[] = [];

  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.climbPortals = [];
    this.siegeLadderPortals = [];
  }

  rebuild(input: {
    walls: {
      id: string;
      x: number;
      y: number;
      kind: 'wall' | 'drawbridge';
      neighborMask?: number;
    }[];
    wallLadders: {
      id: string;
      attachedWallId?: string;
      groundX: number;
      groundY: number;
    }[];
    siegeLadders?: SiegeLadderPortal[];
  }): void {
    this.clear();
    for (const w of input.walls) {
      const key = fortKey(w.x, w.y);
      const node: WallCellNode = { id: w.id, x: w.x, y: w.y };
      this.nodes.set(key, node);
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

    for (const ladder of input.wallLadders) {
      if (!ladder.attachedWallId) continue;
      const wall = input.walls.find((w) => w.id === ladder.attachedWallId);
      if (!wall) continue;
      this.climbPortals.push({
        climbId: ladder.id,
        groundX: ladder.groundX,
        groundY: ladder.groundY,
        wallId: wall.id,
        wallX: wall.x,
        wallY: wall.y,
      });
    }

    const ladderWallIds = new Set(
      input.wallLadders
        .map((l) => l.attachedWallId)
        .filter(Boolean) as string[]
    );
    for (const w of input.walls) {
      if (w.kind !== 'wall') continue;
      if (ladderWallIds.has(w.id)) continue;
      const mask = w.neighborMask ?? 0;
      if (!isWallCornerMask(mask)) continue;
      for (const cell of cornerExteriorGroundCells(w.x, w.y, mask)) {
        this.climbPortals.push({
          climbId: `corner-${w.id}-${cell.x}-${cell.y}`,
          groundX: cell.x,
          groundY: cell.y,
          wallId: w.id,
          wallX: w.x,
          wallY: w.y,
        });
      }
    }

    this.siegeLadderPortals = input.siegeLadders ?? [];
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

  climbPortalNear(x: number, y: number, radius = FORT_TILE * 1.5): ClimbPortal | null {
    let best: ClimbPortal | null = null;
    let bestD = radius;
    for (const p of this.climbPortals) {
      const d = Math.hypot(p.groundX - x, p.groundY - y);
      if (d <= bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  /** @deprecated Use climbPortalNear */
  stairsPortalNear(x: number, y: number, radius = FORT_TILE * 1.5): StairsPortal | null {
    const p = this.climbPortalNear(x, y, radius);
    if (!p) return null;
    return { ...p, stairsId: p.climbId };
  }

  siegeLadderPortalNear(
    x: number,
    y: number,
    radius = FORT_TILE * 2
  ): SiegeLadderPortal | null {
    let best: SiegeLadderPortal | null = null;
    let bestD = radius;
    for (const p of this.siegeLadderPortals) {
      const d = Math.hypot(p.groundX - x, p.groundY - y);
      if (d <= bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  /** @deprecated Use siegeLadderPortalNear */
  ladderPortalNear(x: number, y: number, radius = FORT_TILE * 2): SiegeLadderPortal | null {
    return this.siegeLadderPortalNear(x, y, radius);
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

  /** Round-trip: ground → climb portal → wall node → back down. */
  portalRoundTrip(climbId: string): {
    up: Point[];
    down: Point[];
  } | null {
    const portal = this.climbPortals.find((p) => p.climbId === climbId);
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

  get climbPortalsList(): readonly ClimbPortal[] {
    return this.climbPortals;
  }

  /** @deprecated Use climbPortalsList */
  get stairsPortalsList(): readonly StairsPortal[] {
    return this.climbPortals.map((p) => ({ ...p, stairsId: p.climbId }));
  }

  get siegeLadderPortalsList(): readonly SiegeLadderPortal[] {
    return this.siegeLadderPortals;
  }

  /** @deprecated Use siegeLadderPortalsList */
  get ladderPortalsList(): readonly SiegeLadderPortal[] {
    return this.siegeLadderPortals;
  }

  nodeCount(): number {
    return this.nodes.size;
  }
}
