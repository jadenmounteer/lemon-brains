import type { CampKind } from '../war/WarBalance';
import type { Aabb } from '../buildings/buildingShared';

/** Tent/fence collision boxes relative to camp anchor (bottom-center). */
export function campObstacleBoxes(kind: CampKind, x: number, y: number): Aabb[] {
  switch (kind) {
    case 'bandit':
      return [
        box(x, y, -14, -28, 12, -8),
        box(x, y, 4, -24, 12, -6),
        box(x, y, -20, -18, 8, -4),
        box(x, y, 14, -16, 8, -4),
      ];
    case 'goblin':
      return [
        box(x, y, -12, -26, 10, -8),
        box(x, y, 6, -22, 10, -6),
        box(x, y, -18, -14, 6, -4),
      ];
    case 'giant':
      return [
        box(x, y, -20, -40, 18, -10),
        box(x, y, 8, -32, 16, -8),
        box(x, y, -8, -48, 12, -20),
      ];
    case 'thief':
      return [
        box(x, y, -16, -28, 14, -6),
        box(x, y, 6, -20, 10, -4),
      ];
    case 'siege':
      return [
        box(x, y, -30, -38, 20, -12),
        box(x, y, 10, -32, 18, -10),
        box(x, y, 30, -28, 14, -8),
        box(x, y, -10, -44, 12, -24),
      ];
    case 'gypsy':
      return [
        box(x, y, -12, -24, 10, -6),
        box(x, y, 6, -20, 10, -6),
      ];
    case 'coven':
      return [
        box(x, y, -10, -22, 10, -6),
        box(x, y, 8, -20, 8, -6),
      ];
    default:
      return [];
  }
}

export function isLivingCamp(kind: CampKind): boolean {
  return kind === 'bandit' || kind === 'thief' || kind === 'gypsy';
}

function box(
  ax: number,
  ay: number,
  left: number,
  top: number,
  right: number,
  bottom: number
): Aabb {
  return {
    left: ax + left,
    right: ax + right,
    top: ay + top,
    bottom: ay + bottom,
  };
}
