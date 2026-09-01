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

export const UNIT_ROLES = [
  'peasant',
  'child',
  'guard',
  'soldier',
  'archer',
  'elite_guard',
  'elite_archer',
  'knight',
  'general',
  'physician',
  'bishop',
  'king',
  'queen',
  'prince',
  'princess',
  'duke',
  'duchess',
  'fairy_godmother',
  'jester',
  'dungeon_keeper',
  'executioner',
  'witch_hunter',
  'witch',
  'necromancer',
  'zombie',
  'vampire_wife',
  'bandit',
  'thief',
  'gypsy',
] as const;
export type UnitRole = (typeof UNIT_ROLES)[number];

/** Hostile units (procedural sheets, same frame layout as friendly cast) */
export const ENEMY_ROLES = [
  'bandit',
  'giant',
  'goblin',
  'enemy_army',
  'gypsy',
] as const;
export type EnemyRole = (typeof ENEMY_ROLES)[number];

/** World monsters (scheduled NPCs, not raid waves) */
export const MONSTER_ROLES = ['troll', 'ogre', 'dragon'] as const;
export type MonsterRole = (typeof MONSTER_ROLES)[number];

export type AnimRole = UnitRole | EnemyRole | MonsterRole;

/** Unique sprite-sheet keys (bandit/gypsy appear in both unit + enemy lists). */
export function uniqueSheetRoles(): AnimRole[] {
  const seen = new Set<string>();
  const out: AnimRole[] = [];
  for (const role of [...UNIT_ROLES, ...ENEMY_ROLES, ...MONSTER_ROLES]) {
    if (seen.has(role)) continue;
    seen.add(role);
    out.push(role);
  }
  return out;
}

/** Terrain tileset key + tile indices */
export const TERRAIN_KEY = 'terrain';
export const TerrainTile = {
  grass: 0,
  grassAlt: 1,
  dirt: 2,
  dirtEdge: 3,
  water: 4,
  forest: 5,
  mountain: 6,
} as const;

export function isTerrainBlocked(tile: number): boolean {
  return tile === TerrainTile.water || tile === TerrainTile.mountain;
}

export const PROP_KEYS = {
  keep: 'prop-keep',
  house: 'prop-house',
  wall: 'prop-wall',
  tavern: 'prop-tavern',
  drawbridge: 'prop-drawbridge',
  drawbridgeClosed: 'prop-drawbridge-closed',
  stairs: 'prop-stairs',
  stairsNorth: 'prop-stairs-n',
  stairsSouth: 'prop-stairs-s',
  stairsEast: 'prop-stairs-e',
  stairsWest: 'prop-stairs-w',
  field: 'prop-field',
  granary: 'prop-granary',
  barracks: 'prop-barracks',
  manor: 'prop-manor',
  ballista: 'prop-ballista',
  watchtower: 'prop-watchtower',
  ram: 'prop-ram',
  catapult: 'prop-catapult',
  trebuchet: 'prop-trebuchet',
  flame: 'vfx-flame',
  smoke: 'vfx-smoke',
  rock: 'vfx-rock',
  arrow: 'vfx-arrow',
  bolt: 'vfx-bolt',
  dust: 'vfx-dust',
  cave: 'prop-cave',
  cathedral: 'prop-cathedral',
  infirmary: 'prop-infirmary',
  dungeon: 'prop-dungeon',
  banditCamp: 'prop-bandit-camp',
  goblinCamp: 'prop-goblin-camp',
  giantCamp: 'prop-giant-camp',
  thiefDen: 'prop-thief-den',
  siegeCamp: 'prop-siege-camp',
  gypsyCamp: 'prop-gypsy-camp',
  covenCamp: 'prop-coven-camp',
  bakery: 'prop-bakery',
  market: 'prop-market',
  cemetery: 'prop-cemetery',
  gallows: 'prop-gallows',
  carriage: 'prop-carriage',
  venueFestival: 'prop-venue-festival',
  venueWedding: 'prop-venue-wedding',
  venueJoust: 'prop-venue-joust',
  venueFuneral: 'prop-venue-funeral',
  venueBall: 'prop-venue-ball',
  ballTable: 'prop-ball-table',
  horse: 'prop-horse',
  juggleBall: 'prop-juggle-ball',
  road: 'prop-road',
  bridge: 'prop-bridge',
  bridgeV: 'prop-bridge-v',
  dock: 'prop-dock',
  fishingBoat: 'prop-fishing-boat',
  warship: 'prop-warship',
  vampireCastle: 'prop-vampire-castle',
  /** Interior underlays (shown when roof hidden) */
  houseInterior: 'prop-house-interior',
  keepInterior: 'prop-keep-interior',
  tavernInterior: 'prop-tavern-interior',
  cathedralInterior: 'prop-cathedral-interior',
  infirmaryInterior: 'prop-infirmary-interior',
  dungeonInterior: 'prop-dungeon-interior',
  bakeryInterior: 'prop-bakery-interior',
  marketInterior: 'prop-market-interior',
  vampireCastleInterior: 'prop-vampire-castle-interior',
  hearthFire: 'vfx-hearth-fire',
} as const;

export const HEARTH_FIRE_FRAMES = 4;
export const HEARTH_FIRE_ANIM = 'hearth-fire';

/** N=1 E=2 S=4 W=8 neighbor bitmask → `prop-wall-{mask}` */
export function wallTextureKey(mask: number): string {
  return `prop-wall-${mask & 15}`;
}

export function stairsTextureKey(
  facing: 'north' | 'south' | 'east' | 'west'
): string {
  switch (facing) {
    case 'north':
      return PROP_KEYS.stairsNorth;
    case 'south':
      return PROP_KEYS.stairsSouth;
    case 'east':
      return PROP_KEYS.stairsEast;
    case 'west':
      return PROP_KEYS.stairsWest;
  }
}

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
  field: 'assets/props/field.png',
  granary: 'assets/props/granary.png',
  barracks: 'assets/props/barracks.png',
  manor: 'assets/props/manor.png',
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

export function idleAnimKey(role: string): string {
  return `${role}-idle`;
}

export function walkAnimKey(role: string, dir: Direction): string {
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

export function isRoyalRole(role: UnitRole): boolean {
  return (
    role === 'king' ||
    role === 'queen' ||
    role === 'prince' ||
    role === 'princess' ||
    role === 'duke' ||
    role === 'duchess' ||
    role === 'fairy_godmother' ||
    role === 'bishop'
  );
}

export function livesAtKeep(role: UnitRole): boolean {
  return (
    role === 'king' ||
    role === 'queen' ||
    role === 'prince' ||
    role === 'princess' ||
    role === 'duke' ||
    role === 'duchess' ||
    role === 'fairy_godmother' ||
    role === 'bishop'
  );
}

export function isMilitaryRole(role: UnitRole): boolean {
  return (
    role === 'guard' ||
    role === 'soldier' ||
    role === 'archer' ||
    role === 'elite_guard' ||
    role === 'elite_archer' ||
    role === 'knight' ||
    role === 'general' ||
    role === 'witch_hunter'
  );
}

/** Military roles that patrol within their home sphere (dungeon/barracks). */
export function isSpherePatrolRole(role: UnitRole): boolean {
  return (
    role === 'guard' ||
    role === 'soldier' ||
    role === 'archer' ||
    role === 'elite_guard' ||
    role === 'elite_archer' ||
    role === 'knight'
  );
}

export function isMonarchRole(role: UnitRole): boolean {
  return role === 'king' || role === 'queen';
}

export function isKnightRole(role: UnitRole): boolean {
  return role === 'knight';
}
