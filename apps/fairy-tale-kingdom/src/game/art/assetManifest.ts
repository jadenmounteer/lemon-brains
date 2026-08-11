/**
 * Stable texture / animation keys.
 * Future PNG drop-ins under public/assets must use the same keys and frame layout.
 * Paths (for later loaders) resolve via assetUrl() in src/config.ts.
 */

export const TILE_SIZE = 16;
export const UNIT_WIDTH = 16;
export const UNIT_HEIGHT = 24;

export const DIRECTIONS = ['down', 'left', 'right', 'up'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const UNIT_ROLES = ['peasant', 'guard', 'archer'] as const;
export type UnitRole = (typeof UNIT_ROLES)[number];

/** Hostile units (procedural sheets, same frame layout as friendly cast) */
export const ENEMY_ROLES = ['bandit', 'giant', 'enemy_army'] as const;
export type EnemyRole = (typeof ENEMY_ROLES)[number];

export type AnimRole = UnitRole | EnemyRole;

/** Terrain tileset key + tile indices */
export const TERRAIN_KEY = 'terrain';
export const TerrainTile = {
  grass: 0,
  grassAlt: 1,
  dirt: 2,
  dirtEdge: 3,
} as const;

export const PROP_KEYS = {
  keep: 'prop-keep',
  house: 'prop-house',
  wall: 'prop-wall',
  tavern: 'prop-tavern',
  drawbridge: 'prop-drawbridge',
  drawbridgeClosed: 'prop-drawbridge-closed',
  stairs: 'prop-stairs',
} as const;

/** Future drop-in paths relative to public/ (assetUrl) */
export const dropInPaths = {
  terrain: 'assets/tiles/terrain.png',
  peasant: 'assets/units/peasant.png',
  guard: 'assets/units/guard.png',
  archer: 'assets/units/archer.png',
  keep: 'assets/props/keep.png',
  house: 'assets/props/house.png',
  wall: 'assets/props/wall.png',
  tavern: 'assets/props/tavern.png',
  drawbridge: 'assets/props/drawbridge.png',
  stairs: 'assets/props/stairs.png',
} as const;

/** Frame index layout per unit sheet (16×24 frames in a row) */
export const UnitFrame = {
  idle: 0,
  walkDown: [1, 2, 3, 4] as const,
  walkLeft: [5, 6, 7, 8] as const,
  walkRight: [9, 10, 11, 12] as const,
  walkUp: [13, 14, 15, 16] as const,
} as const;

export const UNIT_FRAME_COUNT = 17;

export function idleAnimKey(role: AnimRole): string {
  return `${role}-idle`;
}

export function walkAnimKey(role: AnimRole, dir: Direction): string {
  return `${role}-walk-${dir}`;
}

export function walkFramesFor(dir: Direction): readonly number[] {
  switch (dir) {
    case 'down':
      return UnitFrame.walkDown;
    case 'left':
      return UnitFrame.walkLeft;
    case 'right':
      return UnitFrame.walkRight;
    case 'up':
      return UnitFrame.walkUp;
  }
}
