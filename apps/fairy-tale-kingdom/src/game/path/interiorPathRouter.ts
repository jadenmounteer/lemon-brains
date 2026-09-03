import type { BuildKind } from '../../marketplace/catalog';
import { hasInterior } from '../combat/stats';
import {
  buildingDoorApproach,
  buildingDoorThreshold,
  buildingDoorWorld,
} from '../buildings/layouts/buildingDoors';
import { footprintAabb } from '../buildings/buildingShared';
import { InteriorNavGrid } from './InteriorNavGrid';
import { roomPoint, type KeepRoomId } from '../keep/KeepLayout';
import type { Point } from '../subjects/zones';
import { dedupePoints } from './interiorPathfind';

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
  'granary',
  'barracks',
  'cemetery',
  'gallows',
  'dock',
  'watchtower',
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
    if (fromRoom === 'gate') {
      return [roomPoint(origin, 'gate', subjectId)];
    }
    return keepRoomPath(origin, 'gate', toRoom, subjectId);
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

function navPathSegment(
  kind: BuildKind | 'keep',
  origin: { x: number; y: number },
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): Point[] {
  const grid = InteriorNavGrid.forKind(kind);
  if (!grid) return [];
  return grid.findPath(origin, kind, fromX, fromY, toX, toY);
}

/** True when (x,y) sits on a walkable interior nav cell, not merely inside the art box. */
export function isOnWalkableInteriorNav(
  kind: BuildKind | 'keep',
  origin: { x: number; y: number },
  x: number,
  y: number
): boolean {
  const nav = InteriorNavGrid.forKind(kind);
  if (!nav) return false;
  const cell = nav.worldToCell(origin, kind, x, y);
  return cell !== null && nav.isWalkable(cell[0], cell[1]);
}

export function nearBuildingDoor(
  kind: BuildKind | 'keep',
  origin: { x: number; y: number },
  x: number,
  y: number,
  radius = 32
): boolean {
  const approach = buildingDoorApproach(kind, origin);
  return Math.hypot(x - approach.x, y - approach.y) <= radius;
}

/**
 * Waypoints for moving inside a building — outdoor callers should path to the door first.
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
  const targetOutside = !pointInsideFootprint(kind, origin, toX, toY);
  const waypoints: Point[] = [];

  if (outside) {
    waypoints.push(threshold);
  }

  if (targetOutside && !outside) {
    waypoints.push(threshold);
    waypoints.push(buildingDoorApproach(kind, origin));
    return dedupePoints(waypoints);
  }

  if (kind === 'keep') {
    const fromRoom = outside
      ? 'gate'
      : nearestKeepRoom(origin, fromX, fromY);
    const toRoom = nearestKeepRoom(origin, toX, toY);
    const roomCenters = keepRoomPath(origin, fromRoom, toRoom, subjectId);
    let prevX = outside ? threshold.x : fromX;
    let prevY = outside ? threshold.y : fromY;
    for (const room of roomCenters) {
      const seg = navPathSegment(
        kind,
        origin,
        prevX,
        prevY,
        room.x,
        room.y
      );
      waypoints.push(...seg);
      prevX = room.x;
      prevY = room.y;
    }
    const finalSeg = navPathSegment(
      kind,
      origin,
      prevX,
      prevY,
      insideTarget.x,
      insideTarget.y
    );
    waypoints.push(...finalSeg);
    return dedupePoints(waypoints);
  }

  const nav = InteriorNavGrid.forKind(kind);
  if (nav) {
    let startX = outside ? threshold.x : fromX;
    let startY = outside ? threshold.y : fromY;
    if (!pointInsideFootprint(kind, origin, startX, startY)) {
      const snapped = nav.nearestWalkable(origin, kind, threshold.x, threshold.y);
      startX = snapped.x;
      startY = snapped.y;
      if (outside) waypoints[0] = snapped;
    }
    const path = nav.findPath(
      origin,
      kind,
      startX,
      startY,
      insideTarget.x,
      insideTarget.y
    );
    waypoints.push(...path);
    return dedupePoints(waypoints);
  }

  waypoints.push(insideTarget);
  return dedupePoints(waypoints);
}

/** Outdoor stand point when interior routing cannot reach the goal. */
export function exteriorApproachFor(
  kind: BuildKind | 'keep',
  origin: { x: number; y: number }
): Point {
  return buildingDoorApproach(kind, origin);
}

/** Snap a world point to the nearest walkable interior cell. */
export function snapInteriorPoint(
  kind: BuildKind | 'keep',
  origin: { x: number; y: number },
  wx: number,
  wy: number
): Point {
  const nav = InteriorNavGrid.forKind(kind);
  if (!nav) return { x: wx, y: wy };
  return nav.nearestWalkable(origin, kind, wx, wy);
}
