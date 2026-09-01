import type { KingdomGameMode } from '../game/core/GameModeProfile';

export const LAYOUT_SCHEMA_VERSION = 4;

/** Raw layout blob before normalization — any historical version. */
export type RawLayoutBlob = Record<string, unknown>;

export interface MigratedLayoutV4 {
  schemaVersion: 4;
  subjects: unknown[];
  buildings: unknown[];
  monsters?: unknown[];
  encampments?: unknown[];
  mapSeed?: number;
  mapCols?: number;
  mapRows?: number;
  keepHp?: number;
  keepMaxHp?: number;
  princeSpawnMs?: number;
  fgmCooldownMs?: number;
  clockHour?: number;
  royaltyState?: Record<string, unknown>;
  raids?: unknown[];
  daysPlayedSnapshot?: number;
  gameMode?: KingdomGameMode;
}

/** Infer schema version from save shape when `schemaVersion` is missing. */
export function detectLayoutVersion(raw: RawLayoutBlob): number {
  if (typeof raw.schemaVersion === 'number' && raw.schemaVersion >= 1) {
    return Math.min(raw.schemaVersion, LAYOUT_SCHEMA_VERSION);
  }
  if (!Array.isArray(raw.subjects) || !Array.isArray(raw.buildings)) {
    return 0;
  }
  if (raw.gameMode === 'learning' || raw.gameMode === 'normal') {
    return 4;
  }
  if (
    Array.isArray(raw.monsters) ||
    Array.isArray(raw.encampments) ||
    typeof raw.mapSeed === 'number' ||
    typeof raw.clockHour === 'number'
  ) {
    return 3;
  }
  if (
    typeof raw.keepHp === 'number' ||
    typeof raw.keepMaxHp === 'number' ||
    typeof raw.princeSpawnMs === 'number'
  ) {
    return 2;
  }
  return 1;
}

function migrateV1ToV2(raw: RawLayoutBlob): RawLayoutBlob {
  return {
    ...raw,
    schemaVersion: 2,
    keepHp: typeof raw.keepHp === 'number' ? raw.keepHp : undefined,
    keepMaxHp: typeof raw.keepMaxHp === 'number' ? raw.keepMaxHp : undefined,
    princeSpawnMs:
      typeof raw.princeSpawnMs === 'number' ? raw.princeSpawnMs : undefined,
    fgmCooldownMs:
      typeof raw.fgmCooldownMs === 'number' ? raw.fgmCooldownMs : undefined,
  };
}

function migrateV2ToV3(raw: RawLayoutBlob): RawLayoutBlob {
  return {
    ...raw,
    schemaVersion: 3,
    monsters: Array.isArray(raw.monsters) ? raw.monsters : [],
    encampments: Array.isArray(raw.encampments) ? raw.encampments : [],
    mapSeed: typeof raw.mapSeed === 'number' ? raw.mapSeed : undefined,
    mapCols: typeof raw.mapCols === 'number' ? raw.mapCols : undefined,
    mapRows: typeof raw.mapRows === 'number' ? raw.mapRows : undefined,
    clockHour: typeof raw.clockHour === 'number' ? raw.clockHour : undefined,
    royaltyState:
      raw.royaltyState && typeof raw.royaltyState === 'object'
        ? raw.royaltyState
        : undefined,
    raids: Array.isArray(raw.raids) ? raw.raids : undefined,
    daysPlayedSnapshot:
      typeof raw.daysPlayedSnapshot === 'number'
        ? raw.daysPlayedSnapshot
        : undefined,
  };
}

function migrateV3ToV4(raw: RawLayoutBlob): MigratedLayoutV4 {
  const gameMode: KingdomGameMode =
    raw.gameMode === 'learning' ? 'learning' : 'normal';
    return {
    ...(raw as unknown as MigratedLayoutV4),
    schemaVersion: 4,
    subjects: Array.isArray(raw.subjects) ? raw.subjects : [],
    buildings: Array.isArray(raw.buildings) ? raw.buildings : [],
    gameMode,
  };
}

/** Step raw JSON through v1→v4 migrations. */
export function migrateLayoutToV4(raw: RawLayoutBlob): MigratedLayoutV4 | null {
  if (!raw || typeof raw !== 'object') return null;
  if (!Array.isArray(raw.subjects) || !Array.isArray(raw.buildings)) {
    return null;
  }

  let version = detectLayoutVersion(raw);
  let data: RawLayoutBlob = { ...raw };

  if (version < 1) return null;
  if (version < 2) {
    data = migrateV1ToV2(data);
    version = 2;
  }
  if (version < 3) {
    data = migrateV2ToV3(data);
    version = 3;
  }
  if (version < 4) {
    return migrateV3ToV4(data);
  }

  return migrateV3ToV4(data);
}
