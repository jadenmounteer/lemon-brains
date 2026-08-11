import { TILE_SIZE, TerrainTile } from '../art/assetManifest';
import type { CavePoint, Point } from '../subjects/zones';

export interface GeneratedMap {
  data: number[][];
  caves: CavePoint[];
  forests: Point[];
  mountains: Point[];
  seed: number;
}

/** Mulberry32 — deterministic PRNG from a seed. */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function freshMapSeed(): number {
  return (Math.floor(Math.random() * 0xffffffff) ^ Date.now()) >>> 0;
}

/**
 * Procedural kingdom map: roads + keep clearing, random lakes/rivers,
 * forests, mountains, and 2 cave mouths on mountain fringe.
 */
export function generateKingdomMap(
  cols: number,
  rows: number,
  seed: number
): GeneratedMap {
  const rand = mulberry32(seed);
  const data: number[][] = [];
  const midCol = Math.floor(cols / 2);
  const midRow = Math.floor(rows / 2);
  const forests: Point[] = [];
  const mountains: Point[] = [];

  for (let r = 0; r < rows; r++) {
    const row: number[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(TerrainTile.grass);
    }
    data.push(row);
  }

  // Base grass variation
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rand() < 0.12) data[r]![c] = TerrainTile.grassAlt;
    }
  }

  // Keep clearing
  for (let r = midRow - 5; r <= midRow + 5; r++) {
    for (let c = midCol - 6; c <= midCol + 6; c++) {
      if (r < 0 || c < 0 || r >= rows || c >= cols) continue;
      data[r]![c] = TerrainTile.grassAlt;
    }
  }

  // Cross roads through keep
  for (let c = 0; c < cols; c++) {
    for (let dr = -1; dr <= 1; dr++) {
      const r = midRow + dr;
      if (r < 0 || r >= rows) continue;
      data[r]![c] =
        Math.abs(dr) === 1 ? TerrainTile.dirtEdge : TerrainTile.dirt;
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let dc = -2; dc <= 2; dc++) {
      const c = midCol + dc;
      if (c < 0 || c >= cols) continue;
      if (Math.abs(r - midRow) <= 1) continue;
      data[r]![c] =
        Math.abs(dc) === 2 ? TerrainTile.dirtEdge : TerrainTile.dirt;
    }
  }

  // Lakes
  const lakeCount = 1 + Math.floor(rand() * 2);
  for (let i = 0; i < lakeCount; i++) {
    paintBlob(
      data,
      cols,
      rows,
      midCol,
      midRow,
      rand,
      TerrainTile.water,
      5 + Math.floor(rand() * 5),
      4 + Math.floor(rand() * 4),
      0.35
    );
  }

  // River: walk from a lake-ish edge toward another edge
  paintRiver(data, cols, rows, midCol, midRow, rand);

  // Forests
  const forestCount = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < forestCount; i++) {
    const spot = paintBlob(
      data,
      cols,
      rows,
      midCol,
      midRow,
      rand,
      TerrainTile.forest,
      6 + Math.floor(rand() * 6),
      5 + Math.floor(rand() * 5),
      0.28
    );
    if (spot) forests.push(tileCenter(spot.c, spot.r));
  }

  // Mountain ridges
  const mountainCount = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < mountainCount; i++) {
    const spot = paintBlob(
      data,
      cols,
      rows,
      midCol,
      midRow,
      rand,
      TerrainTile.mountain,
      5 + Math.floor(rand() * 7),
      4 + Math.floor(rand() * 5),
      0.32
    );
    if (spot) mountains.push(tileCenter(spot.c, spot.r));
  }

  // Re-assert keep + roads so biomes don't swallow the seat of power
  for (let r = midRow - 4; r <= midRow + 4; r++) {
    for (let c = midCol - 5; c <= midCol + 5; c++) {
      if (r < 0 || c < 0 || r >= rows || c >= cols) continue;
      if (Math.abs(c - midCol) <= 2 || Math.abs(r - midRow) <= 1) {
        data[r]![c] =
          Math.abs(c - midCol) === 2 || Math.abs(r - midRow) === 1
            ? TerrainTile.dirtEdge
            : TerrainTile.dirt;
      } else {
        data[r]![c] = TerrainTile.grassAlt;
      }
    }
  }

  const caves = placeCaves(data, cols, rows, rand);

  if (forests.length === 0) {
    forests.push(tileCenter(Math.max(4, midCol - 18), Math.min(rows - 5, midRow + 12)));
  }
  if (mountains.length === 0) {
    mountains.push(tileCenter(Math.min(cols - 5, midCol + 20), Math.max(4, midRow - 14)));
  }

  return { data, caves, forests, mountains, seed };
}

function tileCenter(c: number, r: number): Point {
  return {
    x: c * TILE_SIZE + TILE_SIZE / 2,
    y: r * TILE_SIZE + TILE_SIZE / 2,
  };
}

function paintBlob(
  data: number[][],
  cols: number,
  rows: number,
  midCol: number,
  midRow: number,
  rand: () => number,
  tile: number,
  radiusC: number,
  radiusR: number,
  keepClear: number
): { c: number; r: number } | null {
  // Avoid center keep
  let attempts = 0;
  let cx = 0;
  let cy = 0;
  do {
    cx = Math.floor(rand() * cols);
    cy = Math.floor(rand() * rows);
    attempts += 1;
  } while (
    attempts < 40 &&
    Math.hypot(cx - midCol, cy - midRow) < Math.max(cols, rows) * keepClear
  );

  for (let r = cy - radiusR; r <= cy + radiusR; r++) {
    for (let c = cx - radiusC; c <= cx + radiusC; c++) {
      if (r < 1 || c < 1 || r >= rows - 1 || c >= cols - 1) continue;
      const nx = (c - cx) / radiusC;
      const ny = (r - cy) / radiusR;
      if (nx * nx + ny * ny + rand() * 0.35 > 1) continue;
      // Don't overwrite keep core
      if (Math.abs(c - midCol) <= 4 && Math.abs(r - midRow) <= 3) continue;
      data[r]![c] = tile;
    }
  }
  return { c: cx, r: cy };
}

function paintRiver(
  data: number[][],
  cols: number,
  rows: number,
  midCol: number,
  midRow: number,
  rand: () => number
): void {
  const fromLeft = rand() < 0.5;
  let c = fromLeft ? 2 : cols - 3;
  let r = Math.floor(4 + rand() * (rows - 8));
  const steps = cols + rows;
  for (let i = 0; i < steps; i++) {
    if (r > 0 && r < rows - 1 && c > 0 && c < cols - 1) {
      if (!(Math.abs(c - midCol) <= 3 && Math.abs(r - midRow) <= 2)) {
        data[r]![c] = TerrainTile.water;
        if (r + 1 < rows) data[r + 1]![c] = TerrainTile.water;
      }
    }
    // Bias toward opposite side / slightly toward mid
    const towardC = fromLeft ? 1 : -1;
    if (rand() < 0.55) c += towardC;
    else if (rand() < 0.5) r += rand() < 0.5 ? 1 : -1;
    else c += towardC;
    r = Math.max(2, Math.min(rows - 3, r));
    c = Math.max(1, Math.min(cols - 2, c));
    if ((fromLeft && c >= cols - 3) || (!fromLeft && c <= 2)) break;
  }
}

function placeCaves(
  data: number[][],
  cols: number,
  rows: number,
  rand: () => number
): CavePoint[] {
  const fringe: { c: number; r: number }[] = [];
  for (let r = 2; r < rows - 2; r++) {
    for (let c = 2; c < cols - 2; c++) {
      if (data[r]![c] !== TerrainTile.mountain) continue;
      // Prefer edge of mountain next to walkable
      const neighbors = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      for (const [dc, dr] of neighbors) {
        const nc = c + dc!;
        const nr = r + dr!;
        const t = data[nr]![nc]!;
        if (
          t === TerrainTile.grass ||
          t === TerrainTile.grassAlt ||
          t === TerrainTile.forest ||
          t === TerrainTile.dirt
        ) {
          fringe.push({ c: nc, r: nr });
        }
      }
    }
  }

  const caves: CavePoint[] = [];
  const used = new Set<string>();
  let guard = 0;
  while (caves.length < 2 && fringe.length > 0 && guard < 80) {
    guard += 1;
    const pick = fringe[Math.floor(rand() * fringe.length)]!;
    const key = `${pick.c},${pick.r}`;
    if (used.has(key)) continue;
    // Space caves apart
    if (
      caves.some((cv) => {
        const cc = Math.floor(cv.x / TILE_SIZE);
        const rr = Math.floor(cv.y / TILE_SIZE);
        return Math.hypot(cc - pick.c, rr - pick.r) < 12;
      })
    ) {
      continue;
    }
    used.add(key);
    data[pick.r]![pick.c] = TerrainTile.forest;
    // Soften adjacent mountains so pathing reaches the mouth
    for (const [dc, dr] of [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const rr = pick.r + dr!;
      const cc = pick.c + dc!;
      if (data[rr]?.[cc] === TerrainTile.mountain && rand() < 0.7) {
        data[rr]![cc] = TerrainTile.forest;
      }
    }
    caves.push({
      id: `cave-${caves.length}`,
      x: pick.c * TILE_SIZE + TILE_SIZE / 2,
      y: pick.r * TILE_SIZE + TILE_SIZE / 2,
    });
  }

  // Fallback caves if fringe failed
  while (caves.length < 2) {
    const c = 4 + Math.floor(rand() * (cols - 8));
    const r = 4 + Math.floor(rand() * (rows - 8));
    data[r]![c] = TerrainTile.forest;
    caves.push({
      id: `cave-${caves.length}`,
      x: c * TILE_SIZE + TILE_SIZE / 2,
      y: r * TILE_SIZE + TILE_SIZE / 2,
    });
  }

  return caves;
}
