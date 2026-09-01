import type { BuildKind } from '../../marketplace/catalog';
import { hasInterior } from '../combat/stats';
import {
  buildingDoorApproach,
  buildingDoorThreshold,
  buildingDoorWorld,
} from '../buildings/layouts/buildingDoors';
import { footprintAabb } from '../buildings/buildingShared';
import { roomPoint, type KeepRoomId } from '../keep/KeepLayout';
import type { Point } from '../subjects/zones';

const INTERIOR_KINDS: (BuildKind | 'keep')[] = [
  'keep',
  'cathedral',
  'dungeon',
  'house',
  'manor',
  'tavern',
  'bakery',
  'market',
  'infirmary',
];

export function isInteriorBuilding(kind: BuildKind | 'keep'): boolean {
  return (
    INTERIOR_KINDS.includes(kind) ||
    kind === 'keep' ||
    hasInterior(kind)
  );
}

export { buildingDoorWorld, buildingDoorApproach, buildingDoorThreshold };

export function pointInsideFootprint(
  kind: BuildKind | 'keep',
  origin: { x: number; y: number },
  x: number,
  y: number
): boolean {
  const box = footprintAabb(kind, origin.x, origin.y);
  return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
}

/** Corridor waypoints inside a keep between rooms (doorway routing). */
const KEEP_EDGES: [KeepRoomId, KeepRoomId][] = [
  ['gate', 'courtyard'],
  ['courtyard', 'great_hall'],
  ['courtyard', 'banquet'],
  ['courtyard', 'servants'],
  ['great_hall', 'chambers'],
  ['great_hall', 'solar'],
  ['great_hall', 'kitchen'],
  ['banquet', 'kitchen'],
  ['servants', 'chapel_nook'],
  ['courtyard', 'armory_nook'],
];

function keepRoomPath(
  origin: { x: number; y: number },
  fromRoom: KeepRoomId,
  toRoom: KeepRoomId,
  subjectId: string
): Point[] {
  if (fromRoom === toRoom) {
    return [roomPoint(origin, toRoom, subjectId)];
  }
  const graph = new Map<KeepRoomId, KeepRoomId[]>();
  for (const [a, b] of KEEP_EDGES) {
    if (!graph.has(a)) graph.set(a, []);
    if (!graph.has(b)) graph.set(b, []);
    graph.get(a)!.push(b);
    graph.get(b)!.push(a);
  }
  const queue: KeepRoomId[] = [fromRoom];
  const prev = new Map<KeepRoomId, KeepRoomId | null>();
  prev.set(fromRoom, null);
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === toRoom) break;
    for (const n of graph.get(cur) ?? []) {
      if (prev.has(n)) continue;
      prev.set(n, cur);
      queue.push(n);
    }
  }
  if (!prev.has(toRoom)) {
    return [roomPoint(origin, toRoom, subjectId)];
  }
  const rooms: KeepRoomId[] = [];
  let step: KeepRoomId | null = toRoom;
  while (step) {
    rooms.unshift(step);
    step = prev.get(step) ?? null;
  }
  return rooms.map((r) => roomPoint(origin, r, subjectId));
}

export function nearestKeepRoom(
  origin: { x: number; y: number },
  x: number,
  y: number
): KeepRoomId {
  const rooms: KeepRoomId[] = [
    'gate',
    'courtyard',
    'great_hall',
    'banquet',
    'kitchen',
    'servants',
    'chambers',
    'solar',
    'chapel_nook',
    'armory_nook',
  ];
  let best: KeepRoomId = 'courtyard';
  let bestD = Infinity;
  for (const r of rooms) {
    const p = roomPoint(origin, r, 'probe');
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return best;
}

function dedupeWaypoints(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && Math.hypot(last.x - p.x, last.y - p.y) < 6) continue;
    out.push(p);
  }
  return out;
}

/**
 * Waypoints for moving inside a large building — outdoor callers should path to the door first.
 */
export function interiorWaypoints(
  kind: BuildKind | 'keep',
  origin: { x: number; y: number },
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  subjectId: string
): Point[] {
  const threshold = buildingDoorThreshold(kind, origin);
  const insideTarget = { x: toX, y: toY };
  const outside = !pointInsideFootprint(kind, origin, fromX, fromY);
  const waypoints: Point[] = [];

  if (outside) {
    waypoints.push(threshold);
  }

  if (kind === 'keep') {
    const fromRoom = outside
      ? 'gate'
      : nearestKeepRoom(origin, fromX, fromY);
    const toRoom = nearestKeepRoom(origin, toX, toY);
    const roomPath = keepRoomPath(origin, fromRoom, toRoom, subjectId);
    if (!outside) {
      waypoints.push(threshold);
    }
    waypoints.push(...roomPath);
    if (
      waypoints.length === 0 ||
      Math.hypot(
        waypoints[waypoints.length - 1]!.x - insideTarget.x,
        waypoints[waypoints.length - 1]!.y - insideTarget.y
      ) > 8
    ) {
      waypoints.push(insideTarget);
    }
    return dedupeWaypoints(waypoints);
  }

  if (kind === 'cathedral' || kind === 'dungeon') {
    if (!outside) {
      waypoints.push(buildingDoorWorld(kind, origin));
    }
    waypoints.push(insideTarget);
    return dedupeWaypoints(waypoints);
  }

  waypoints.push(insideTarget);
  return dedupeWaypoints(waypoints);
}
