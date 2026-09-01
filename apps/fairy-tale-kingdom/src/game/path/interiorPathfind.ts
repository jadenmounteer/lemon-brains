import type { Point } from '../subjects/zones';

/** A* on a 4-connected grid. Returns cell path [col,row][] or null. */
export function astarCells(
  cols: number,
  rows: number,
  blocked: ReadonlySet<string>,
  start: [number, number],
  goal: [number, number]
): [number, number][] | null {
  const sk = `${start[0]},${start[1]}`;
  const gk = `${goal[0]},${goal[1]}`;
  if (blocked.has(sk) || blocked.has(gk)) return null;
  if (start[0] === goal[0] && start[1] === goal[1]) return [start];

  const h = (c: number, r: number) =>
    Math.abs(c - goal[0]) + Math.abs(r - goal[1]);

  const open = new Set<string>([sk]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[sk, 0]]);
  const fScore = new Map<string, number>([[sk, h(start[0], start[1])]]);

  const parse = (k: string): [number, number] => {
    const [c, r] = k.split(',').map(Number);
    return [c!, r!];
  };

  while (open.size > 0) {
    let bestK = '';
    let bestF = Infinity;
    for (const k of open) {
      const f = fScore.get(k) ?? Infinity;
      if (f < bestF) {
        bestF = f;
        bestK = k;
      }
    }
    if (bestK === gk) {
      const path: [number, number][] = [];
      let cur: string | undefined = gk;
      while (cur) {
        path.unshift(parse(cur));
        cur = cameFrom.get(cur);
      }
      return path;
    }
    open.delete(bestK);
    const [c, r] = parse(bestK);
    const curG = gScore.get(bestK) ?? Infinity;
    for (const [dc, dr] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ] as const) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const nk = `${nc},${nr}`;
      if (blocked.has(nk)) continue;
      const tg = curG + 1;
      if (tg < (gScore.get(nk) ?? Infinity)) {
        cameFrom.set(nk, bestK);
        gScore.set(nk, tg);
        fScore.set(nk, tg + h(nc, nr));
        open.add(nk);
      }
    }
  }
  return null;
}

export function dedupePoints(points: Point[], minDist = 6): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && Math.hypot(last.x - p.x, last.y - p.y) < minDist) continue;
    out.push(p);
  }
  return out;
}
