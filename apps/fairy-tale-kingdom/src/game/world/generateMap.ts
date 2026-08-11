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
 * Procedural kingdom map: keep clearing, irregular coasts, inland rivers
 * (with tributaries), lakes, forests, mountains, and cave mouths.
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
  const area = cols * rows;
  const scale = Math.sqrt(area / (100 * 64)); // ~2 on the 200×128 map

  for (let r = 0; r < rows; r++) {
    const row: number[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(TerrainTile.grass);
    }
    data.push(row);
  }

  // Base grass variation + meadow freckles
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rand() < 0.14) data[r]![c] = TerrainTile.grassAlt;
      else if (rand() < 0.02) data[r]![c] = TerrainTile.dirt;
    }
  }

  // Keep clearing (no starter roads — player places them)
  paintKeepClearing(data, cols, rows, midCol, midRow, 6, 7);

  // Irregular coastal ocean (not a perfect rectangular frame)
  paintIrregularCoast(data, cols, rows, midCol, midRow, rand, scale);

  // Inland lakes (scaled for larger maps)
  const lakeCount = Math.max(3, Math.round(3 + rand() * 4 * scale));
  const lakeCenters: { c: number; r: number }[] = [];
  for (let i = 0; i < lakeCount; i++) {
    const spot = paintBlob(
      data,
      cols,
      rows,
      midCol,
      midRow,
      rand,
      TerrainTile.water,
      Math.round(5 + rand() * 8 * scale),
      Math.round(4 + rand() * 6 * scale),
      0.22
    );
    if (spot) lakeCenters.push(spot);
  }

  // Mountain ridges first so rivers can rise in the highlands
  const mountainCount = Math.max(4, Math.round(3 + rand() * 4 * scale));
  for (let i = 0; i < mountainCount; i++) {
    const spot = paintBlob(
      data,
      cols,
      rows,
      midCol,
      midRow,
      rand,
      TerrainTile.mountain,
      Math.round(6 + rand() * 9 * scale),
      Math.round(4 + rand() * 7 * scale),
      0.2
    );
    if (spot) mountains.push(tileCenter(spot.c, spot.r));
  }

  // Rivers that cut through the interior (not only the fringe)
  const riverCount = Math.max(2, Math.round(2 + rand() * 2 * scale));
  const riverPaths: { c: number; r: number }[][] = [];
  for (let i = 0; i < riverCount; i++) {
    const path = paintMeanderingRiver(
      data,
      cols,
      rows,
      midCol,
      midRow,
      rand,
      lakeCenters,
      i
    );
    if (path.length > 8) riverPaths.push(path);
  }

  // Tributaries branching from mid-river toward lakes or coast
  for (const path of riverPaths) {
    if (path.length < 20 || rand() > 0.75) continue;
    const fork = path[Math.floor(path.length * (0.3 + rand() * 0.4))]!;
    paintTributary(data, cols, rows, midCol, midRow, rand, fork, lakeCenters);
  }

  // Soft dirt banks along water for readable shores
  paintWaterBanks(data, cols, rows, midCol, midRow);

  // Forests
  const forestCount = Math.max(6, Math.round(5 + rand() * 5 * scale));
  for (let i = 0; i < forestCount; i++) {
    const spot = paintBlob(
      data,
      cols,
      rows,
      midCol,
      midRow,
      rand,
      TerrainTile.forest,
      Math.round(7 + rand() * 10 * scale),
      Math.round(6 + rand() * 8 * scale),
      0.18
    );
    if (spot) forests.push(tileCenter(spot.c, spot.r));
  }

  // Scattered copse freckles for texture between big biomes
  const copseCount = Math.round(8 * scale);
  for (let i = 0; i < copseCount; i++) {
    paintBlob(
      data,
      cols,
      rows,
      midCol,
      midRow,
      rand,
      TerrainTile.forest,
      2 + Math.floor(rand() * 3),
      2 + Math.floor(rand() * 3),
      0.12
    );
  }

  // Dirt clearings / trails hints (not a starter road cross)
  const clearingCount = Math.round(4 * scale);
  for (let i = 0; i < clearingCount; i++) {
    paintBlob(
      data,
      cols,
      rows,
      midCol,
      midRow,
      rand,
      TerrainTile.dirt,
      3 + Math.floor(rand() * 4),
      2 + Math.floor(rand() * 3),
      0.15
    );
  }

  // Re-assert keep clearing so biomes don't swallow the seat of power
  paintKeepClearing(data, cols, rows, midCol, midRow, 4, 5);

  const caves = placeCaves(data, cols, rows, rand);

  if (forests.length === 0) {
    forests.push(
      tileCenter(Math.max(4, midCol - 18), Math.min(rows - 5, midRow + 12))
    );
  }
  if (mountains.length === 0) {
    mountains.push(
      tileCenter(Math.min(cols - 5, midCol + 20), Math.max(4, midRow - 14))
    );
  }

  return { data, caves, forests, mountains, seed };
}

function tileCenter(c: number, r: number): Point {
  return {
    x: c * TILE_SIZE + TILE_SIZE / 2,
    y: r * TILE_SIZE + TILE_SIZE / 2,
  };
}

function inKeepCore(
  c: number,
  r: number,
  midCol: number,
  midRow: number,
  padC = 4,
  padR = 3
): boolean {
  return Math.abs(c - midCol) <= padC && Math.abs(r - midRow) <= padR;
}

function paintKeepClearing(
  data: number[][],
  cols: number,
  rows: number,
  midCol: number,
  midRow: number,
  halfR: number,
  halfC: number
): void {
  for (let r = midRow - halfR; r <= midRow + halfR; r++) {
    for (let c = midCol - halfC; c <= midCol + halfC; c++) {
      if (r < 0 || c < 0 || r >= rows || c >= cols) continue;
      data[r]![c] = TerrainTile.grassAlt;
    }
  }
}

/** Wavy ocean fringe — depth varies along each edge so coasts look natural. */
function paintIrregularCoast(
  data: number[][],
  cols: number,
  rows: number,
  midCol: number,
  midRow: number,
  rand: () => number,
  scale: number
): void {
  const base = Math.max(3, Math.floor(Math.min(cols, rows) * 0.035 * scale));
  const topDepth = new Array(cols).fill(0).map(() => 0);
  const botDepth = new Array(cols).fill(0).map(() => 0);
  const leftDepth = new Array(rows).fill(0).map(() => 0);
  const rightDepth = new Array(rows).fill(0).map(() => 0);

  let t = base + Math.floor(rand() * 3);
  let b = base + Math.floor(rand() * 3);
  for (let c = 0; c < cols; c++) {
    t += Math.floor(rand() * 3) - 1;
    b += Math.floor(rand() * 3) - 1;
    t = Math.max(base - 1, Math.min(base + 5, t));
    b = Math.max(base - 1, Math.min(base + 5, b));
    topDepth[c] = t;
    botDepth[c] = b;
  }
  let l = base + Math.floor(rand() * 3);
  let ri = base + Math.floor(rand() * 3);
  for (let r = 0; r < rows; r++) {
    l += Math.floor(rand() * 3) - 1;
    ri += Math.floor(rand() * 3) - 1;
    l = Math.max(base - 1, Math.min(base + 5, l));
    ri = Math.max(base - 1, Math.min(base + 5, ri));
    leftDepth[r] = l;
    rightDepth[r] = ri;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (inKeepCore(c, r, midCol, midRow, 8, 7)) continue;
      const onCoast =
        r < topDepth[c]! ||
        r >= rows - botDepth[c]! ||
        c < leftDepth[r]! ||
        c >= cols - rightDepth[r]!;
      if (onCoast) data[r]![c] = TerrainTile.water;
    }
  }

  // Occasional coastal inlets / bays cutting further inland
  const bayCount = Math.round(2 + 2 * scale);
  for (let i = 0; i < bayCount; i++) {
    const side = Math.floor(rand() * 4);
    let c = 0;
    let r = 0;
    if (side === 0) {
      c = Math.floor(rand() * cols);
      r = topDepth[c]!;
    } else if (side === 1) {
      c = Math.floor(rand() * cols);
      r = rows - 1 - botDepth[c]!;
    } else if (side === 2) {
      r = Math.floor(rand() * rows);
      c = leftDepth[r]!;
    } else {
      r = Math.floor(rand() * rows);
      c = cols - 1 - rightDepth[r]!;
    }
    paintBlobAt(
      data,
      cols,
      rows,
      midCol,
      midRow,
      c,
      r,
      TerrainTile.water,
      4 + Math.floor(rand() * 5),
      3 + Math.floor(rand() * 4),
      rand
    );
  }
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
  let attempts = 0;
  let cx = 0;
  let cy = 0;
  do {
    cx = Math.floor(rand() * cols);
    cy = Math.floor(rand() * rows);
    attempts += 1;
  } while (
    attempts < 50 &&
    Math.hypot(cx - midCol, cy - midRow) < Math.max(cols, rows) * keepClear
  );

  paintBlobAt(
    data,
    cols,
    rows,
    midCol,
    midRow,
    cx,
    cy,
    tile,
    radiusC,
    radiusR,
    rand
  );
  return { c: cx, r: cy };
}

function paintBlobAt(
  data: number[][],
  cols: number,
  rows: number,
  midCol: number,
  midRow: number,
  cx: number,
  cy: number,
  tile: number,
  radiusC: number,
  radiusR: number,
  rand: () => number
): void {
  const rC = Math.max(1, radiusC);
  const rR = Math.max(1, radiusR);
  for (let r = cy - rR; r <= cy + rR; r++) {
    for (let c = cx - rC; c <= cx + rC; c++) {
      if (r < 1 || c < 1 || r >= rows - 1 || c >= cols - 1) continue;
      const nx = (c - cx) / rC;
      const ny = (r - cy) / rR;
      if (nx * nx + ny * ny + rand() * 0.4 > 1) continue;
      if (inKeepCore(c, r, midCol, midRow)) continue;
      data[r]![c] = tile;
    }
  }
}

/**
 * One meandering river across the interior: highland/lake → coast (or another lake).
 * Returns the painted path for tributary forks.
 */
function paintMeanderingRiver(
  data: number[][],
  cols: number,
  rows: number,
  midCol: number,
  midRow: number,
  rand: () => number,
  lakes: { c: number; r: number }[],
  index: number
): { c: number; r: number }[] {
  const path: { c: number; r: number }[] = [];

  // Start inland — prefer mountain fringe or a lake, else a random interior point
  let sc: number;
  let sr: number;
  if (lakes.length && rand() < 0.45) {
    const lake = lakes[Math.floor(rand() * lakes.length)]!;
    sc = lake.c;
    sr = lake.r;
  } else {
    // Spread starts around the map by index so rivers don't pile up
    const quadrant = index % 4;
    const margin = Math.floor(Math.min(cols, rows) * 0.18);
    const jc = midCol + (quadrant === 0 || quadrant === 3 ? -1 : 1) * margin;
    const jr = midRow + (quadrant === 0 || quadrant === 1 ? -1 : 1) * margin;
    sc = Math.floor(jc + (rand() - 0.5) * margin);
    sr = Math.floor(jr + (rand() - 0.5) * margin);
  }
  sc = clamp(sc, 4, cols - 5);
  sr = clamp(sr, 4, rows - 5);

  // End on a coastal water tile (or far opposite side)
  const end = pickCoastTarget(data, cols, rows, sc, sr, rand);
  let c = sc;
  let r = sr;
  const maxSteps = cols + rows + Math.floor(rand() * 40);
  let width = rand() < 0.35 ? 2 : 1;

  for (let step = 0; step < maxSteps; step++) {
    stampRiverCell(data, cols, rows, midCol, midRow, c, r, width, rand);
    path.push({ c, r });

    if (Math.hypot(c - end.c, r - end.r) < 2) break;
    if (data[r]![c] === TerrainTile.water && step > 12 && isCoastWater(data, cols, rows, c, r)) {
      break;
    }

    // Meander: mostly toward goal, with sideways wobble so it snakes inland
    const dc = Math.sign(end.c - c);
    const dr = Math.sign(end.r - r);
    const roll = rand();
    if (roll < 0.55) {
      c += dc || (rand() < 0.5 ? 1 : -1);
      if (rand() < 0.35) r += rand() < 0.5 ? 1 : -1;
    } else if (roll < 0.8) {
      r += dr || (rand() < 0.5 ? 1 : -1);
      if (rand() < 0.35) c += rand() < 0.5 ? 1 : -1;
    } else {
      // Oxbow / lazy bend away from the goal briefly
      c += rand() < 0.5 ? 1 : -1;
      r += rand() < 0.5 ? 1 : -1;
    }

    // Occasionally widen mid-course (delta / marsh feel)
    if (step > 0 && step % 28 === 0) {
      width = rand() < 0.4 ? 2 : 1;
    }

    c = clamp(c, 1, cols - 2);
    r = clamp(r, 1, rows - 2);

    // Soft repulsion from keep so the river skirts the bailey instead of through it
    if (inKeepCore(c, r, midCol, midRow, 6, 5)) {
      c += c < midCol ? -2 : 2;
      r += r < midRow ? -2 : 2;
      c = clamp(c, 1, cols - 2);
      r = clamp(r, 1, rows - 2);
    }
  }

  return path;
}

function paintTributary(
  data: number[][],
  cols: number,
  rows: number,
  midCol: number,
  midRow: number,
  rand: () => number,
  start: { c: number; r: number },
  lakes: { c: number; r: number }[]
): void {
  let target: { c: number; r: number };
  if (lakes.length && rand() < 0.5) {
    target = lakes[Math.floor(rand() * lakes.length)]!;
  } else {
    target = pickCoastTarget(data, cols, rows, start.c, start.r, rand);
  }
  let c = start.c;
  let r = start.r;
  const steps = Math.floor((cols + rows) * 0.35);
  for (let i = 0; i < steps; i++) {
    stampRiverCell(data, cols, rows, midCol, midRow, c, r, 1, rand);
    if (Math.hypot(c - target.c, r - target.r) < 2) break;
    const dc = Math.sign(target.c - c);
    const dr = Math.sign(target.r - r);
    if (rand() < 0.6) c += dc || (rand() < 0.5 ? 1 : -1);
    else r += dr || (rand() < 0.5 ? 1 : -1);
    if (rand() < 0.25) {
      c += rand() < 0.5 ? 1 : -1;
      r += rand() < 0.5 ? 1 : -1;
    }
    c = clamp(c, 1, cols - 2);
    r = clamp(r, 1, rows - 2);
    if (inKeepCore(c, r, midCol, midRow, 5, 4)) break;
  }
}

function stampRiverCell(
  data: number[][],
  cols: number,
  rows: number,
  midCol: number,
  midRow: number,
  c: number,
  r: number,
  width: number,
  rand: () => number
): void {
  for (let dr = -width; dr <= width; dr++) {
    for (let dc = -width; dc <= width; dc++) {
      if (Math.abs(dc) + Math.abs(dr) > width + (rand() < 0.3 ? 1 : 0)) continue;
      const cc = c + dc;
      const rr = r + dr;
      if (rr < 1 || cc < 1 || rr >= rows - 1 || cc >= cols - 1) continue;
      if (inKeepCore(cc, rr, midCol, midRow)) continue;
      // Carve through forest/grass/dirt; leave mountains mostly (gorge feel: only edge)
      const t = data[rr]![cc]!;
      if (t === TerrainTile.mountain && Math.abs(dc) + Math.abs(dr) > 0) continue;
      data[rr]![cc] = TerrainTile.water;
    }
  }
}

function paintWaterBanks(
  data: number[][],
  cols: number,
  rows: number,
  midCol: number,
  midRow: number
): void {
  const bank: { c: number; r: number }[] = [];
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      if (data[r]![c] !== TerrainTile.water) continue;
      for (const [dc, dr] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const cc = c + dc!;
        const rr = r + dr!;
        const t = data[rr]![cc]!;
        if (
          t === TerrainTile.grass ||
          t === TerrainTile.grassAlt ||
          t === TerrainTile.forest
        ) {
          if (!inKeepCore(cc, rr, midCol, midRow)) {
            bank.push({ c: cc, r: rr });
          }
        }
      }
    }
  }
  for (const b of bank) {
    // Dirt shoreline — denser on grass, lighter freckles in forest (seed-stable via coords)
    const hash = (b.c * 17 + b.r * 31) % 5;
    if (data[b.r]![b.c] === TerrainTile.forest) {
      if (hash === 0) data[b.r]![b.c] = TerrainTile.dirt;
    } else {
      data[b.r]![b.c] = TerrainTile.dirt;
    }
  }
}

function pickCoastTarget(
  data: number[][],
  cols: number,
  rows: number,
  fromC: number,
  fromR: number,
  rand: () => number
): { c: number; r: number } {
  const candidates: { c: number; r: number; score: number }[] = [];
  const step = 3;
  for (let r = 1; r < rows - 1; r += step) {
    for (let c = 1; c < cols - 1; c += step) {
      if (data[r]![c] !== TerrainTile.water) continue;
      if (!isCoastWater(data, cols, rows, c, r)) continue;
      const dist = Math.hypot(c - fromC, r - fromR);
      if (dist < Math.min(cols, rows) * 0.25) continue;
      candidates.push({ c, r, score: dist + rand() * 20 });
    }
  }
  if (candidates.length === 0) {
    // Far corner fallback
    return {
      c: fromC < cols / 2 ? cols - 3 : 3,
      r: fromR < rows / 2 ? rows - 3 : 3,
    };
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[Math.floor(rand() * Math.min(6, candidates.length))]!;
}

function isCoastWater(
  data: number[][],
  cols: number,
  rows: number,
  c: number,
  r: number
): boolean {
  if (data[r]![c] !== TerrainTile.water) return false;
  // Near map edge OR adjacent to land → treats lake shores too; prefer map-edge
  if (c <= 4 || r <= 4 || c >= cols - 5 || r >= rows - 5) return true;
  return false;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
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
