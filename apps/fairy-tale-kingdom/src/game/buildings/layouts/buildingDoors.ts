import type { BuildKind } from '../../../marketplace/catalog';
import { footprintAabb } from '../buildingShared';
import { cathedralDoor } from './CathedralLayout';
import { dungeonGatePoint } from './DungeonLayout';
import { roomPoint } from '../../keep/KeepLayout';
import type { Point } from '../../subjects/zones';

/** Door offsets from building anchor (bottom-center), in world pixels. */
const DOOR_OFFSETS: Partial<
  Record<BuildKind | 'keep', { x: number; y: number }>
> = {
  keep: { x: 0, y: 0 },
  house: { x: 0, y: -6 },
  manor: { x: 0, y: -4 },
  tavern: { x: 0, y: -2 },
  bakery: { x: -4, y: -2 },
  market: { x: 0, y: -2 },
  infirmary: { x: 0, y: -4 },
  cathedral: { x: 0, y: 0 },
  dungeon: { x: 0, y: 0 },
};

const APPROACH_OUTSIDE = 14;

function doorOffset(kind: BuildKind | 'keep'): { x: number; y: number } {
  return DOOR_OFFSETS[kind] ?? { x: 0, y: -4 };
}

/** World position of the doorway (threshold). */
export function buildingDoorWorld(
  kind: BuildKind | 'keep',
  origin: { x: number; y: number }
): Point {
  if (kind === 'keep') {
    return roomPoint(origin, 'gate', 'door');
  }
  if (kind === 'cathedral') {
    return cathedralDoor(origin);
  }
  if (kind === 'dungeon') {
    return dungeonGatePoint(origin);
  }
  const off = doorOffset(kind);
  return { x: origin.x + off.x, y: origin.y + off.y };
}

/** Grass-side stand point before entering. */
export function buildingDoorApproach(
  kind: BuildKind | 'keep',
  origin: { x: number; y: number }
): Point {
  const door = buildingDoorWorld(kind, origin);
  const box = footprintAabb(kind, origin.x, origin.y);
  const cy = (box.top + box.bottom) / 2;
  if (door.y >= cy) {
    return { x: door.x, y: box.bottom + APPROACH_OUTSIDE };
  }
  return { x: door.x, y: box.top - APPROACH_OUTSIDE };
}

/** Just inside the threshold. */
export function buildingDoorThreshold(
  kind: BuildKind | 'keep',
  origin: { x: number; y: number }
): Point {
  const door = buildingDoorWorld(kind, origin);
  const box = footprintAabb(kind, origin.x, origin.y);
  const cy = (box.top + box.bottom) / 2;
  if (door.y >= cy) {
    return { x: door.x, y: door.y - 8 };
  }
  return { x: door.x, y: door.y + 8 };
}
