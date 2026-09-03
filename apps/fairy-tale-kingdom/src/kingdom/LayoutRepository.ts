import { LocalStorageAdapter, type StoragePort } from '@knowledge-quest/storage';
import { UNIT_ROLES, type UnitRole } from '../game/art/assetManifest';
import { BUILDING_MAX_HP, UNIT_MAX_HP } from '../game/combat/stats';
import type { SavedMonster } from '../game/monsters/MonsterSystem';
import type { SavedEncampment } from '../game/war/EncampmentSystem';
import type { CivilianJob } from '../game/jobs/capacities';
import type { LifeLogEntry } from '../game/thoughts/lifeLog';
import type {
  ActivityId,
  BodyCondition,
  CurseKind,
  SubjectGoal,
  SubjectInterrupt,
  ZoneId,
} from '../game/subjects/types';
import type { KingdomGameMode } from '../game/core/GameModeProfile';
import { BUILD_CATALOG, type BuildKind } from '../marketplace/catalog';
import {
  LAYOUT_SCHEMA_VERSION,
  migrateLayoutToV4,
} from './layoutMigrations';

export const LAYOUT_STORAGE_KEY = 'fairyTaleKingdom.layout';
export { LAYOUT_SCHEMA_VERSION };

const VALID_BUILD_KINDS = new Set<string>([
  ...BUILD_CATALOG.map((c) => c.kind),
  'road', // legacy saves — no longer placeable
]);
const VALID_MONSTER_KINDS = new Set(['troll', 'ogre', 'dragon']);
const VALID_UNIT_ROLES = new Set<string>(UNIT_ROLES);
const VALID_CAMP_KINDS = new Set([
  'bandit',
  'giant',
  'goblin',
  'thief',
  'siege',
  'gypsy',
  'coven',
]);
const VALID_BODIES = new Set(['gaunt', 'average', 'plump', 'obese']);

export interface SavedBuilding {
  id: string;
  kind: BuildKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  /** Ladder only — wall they mount on */
  attachedWallId?: string;
  /** Ladder only — ground side defenders approach from */
  ladderFacing?: 'north' | 'south' | 'east' | 'west';
  /** @deprecated Migrated to ladderFacing */
  stairsFacing?: 'north' | 'south' | 'east' | 'west';
  /** Degrees — bridges use 0 or 90 */
  rotation?: number;
  loyaltyKeepId?: string | null;
}

export interface SavedSubject {
  id: string;
  name: string;
  role: UnitRole;
  houseId: string;
  hp: number;
  maxHp: number;
  onWall?: boolean;
  hunger?: number;
  sick?: boolean;
  gender?: 'male' | 'female';
  temporaryPrincess?: boolean;
  married?: boolean;
  happiness?: number;
  ageYears?: number;
  body?: BodyCondition;
  job?: CivilianJob;
  workplaceId?: string;
  spouseId?: string;
  motherId?: string;
  fatherId?: string;
  pregnant?: boolean;
  pregnantDaysLeft?: number;
  thought?: string;
  backstory?: string;
  goal?: SubjectGoal | null;
  lifeLog?: LifeLogEntry[];
  curse?: CurseKind;
  cursedAsRole?: UnitRole;
  lowHappyHours?: number;
  x?: number;
  y?: number;
  activity?: ActivityId;
  activityLabel?: string;
  zone?: ZoneId;
  interrupt?: SubjectInterrupt | null;
  campId?: string | null;
  allegiance?: 'kingdom' | 'camp';
  loyaltyKeepId?: string | null;
  pendingChildHouseId?: string;
  appearanceVariant?: 0 | 1 | 2 | 3 | 4 | 5;
  legendId?: string;
}

export interface LayoutRoyaltyState {
  ballRemainingMs?: number;
  ballCooldownMs?: number;
  festivalRemainingMs?: number;
  festivalCooldownMs?: number;
  paradeCooldownMs?: number;
  paradeRemainingMs?: number;
}

export interface LayoutSave {
  /** Schema version — v4 adds gameMode. */
  schemaVersion?: number;
  subjects: SavedSubject[];
  buildings: SavedBuilding[];
  monsters?: SavedMonster[];
  encampments?: SavedEncampment[];
  /** Seed for procedural terrain (lakes, forests, mountains, caves). */
  mapSeed?: number;
  /** Map dimensions — mismatch triggers soft layout reset */
  mapCols?: number;
  mapRows?: number;
  keepHp?: number;
  keepMaxHp?: number;
  princeSpawnMs?: number;
  fgmCooldownMs?: number;
  clockHour?: number;
  royaltyState?: LayoutRoyaltyState;
  /** Serializable raid stubs for future persist. */
  raids?: Array<Record<string, unknown>>;
  daysPlayedSnapshot?: number;
  /** Learning vs normal pacing — persisted per kingdom layout. */
  gameMode?: KingdomGameMode;
}

export class LayoutRepository {
  constructor(
    private readonly storage: StoragePort = new LocalStorageAdapter(),
    private readonly key: string = LAYOUT_STORAGE_KEY
  ) {}

  async load(): Promise<LayoutSave | null> {
    return this.loadSync();
  }

  /** Sync read for Phaser scene create (localStorage-backed). */
  loadSync(): LayoutSave | null {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as LayoutSave;
      const migrated = migrateLayoutToV4(parsed as unknown as Record<string, unknown>);
      if (!migrated) return null;
      const layout = migrated as LayoutSave;
      return {
        ...layout,
        schemaVersion: LAYOUT_SCHEMA_VERSION,
        buildings: (layout.buildings as SavedBuilding[])
          .map(migrateLegacyBuilding)
          .filter((b) => VALID_BUILD_KINDS.has(b.kind))
          .map(normalizeBuilding),
        subjects: (layout.subjects as SavedSubject[])
          .filter((s) => VALID_UNIT_ROLES.has(s.role))
          .map(normalizeSubject),
        monsters: Array.isArray(layout.monsters)
          ? layout.monsters.filter((m) => VALID_MONSTER_KINDS.has(m.kind))
          : [],
        encampments: Array.isArray(layout.encampments)
          ? layout.encampments.filter(
              (c) =>
                c &&
                typeof c.id === 'string' &&
                VALID_CAMP_KINDS.has(c.kind) &&
                typeof c.x === 'number' &&
                typeof c.y === 'number'
            )
          : [],
        mapSeed:
          typeof layout.mapSeed === 'number' ? layout.mapSeed >>> 0 : undefined,
        mapCols:
          typeof layout.mapCols === 'number' ? layout.mapCols : undefined,
        mapRows:
          typeof layout.mapRows === 'number' ? layout.mapRows : undefined,
        clockHour:
          typeof layout.clockHour === 'number' ? layout.clockHour : undefined,
        royaltyState:
          layout.royaltyState && typeof layout.royaltyState === 'object'
            ? layout.royaltyState
            : undefined,
        raids: Array.isArray(layout.raids) ? layout.raids : undefined,
        daysPlayedSnapshot:
          typeof layout.daysPlayedSnapshot === 'number'
            ? Math.max(0, Math.floor(layout.daysPlayedSnapshot))
            : undefined,
        gameMode:
          layout.gameMode === 'learning' || layout.gameMode === 'normal'
            ? layout.gameMode
            : 'normal',
      };
    } catch {
      return null;
    }
  }

  async save(data: LayoutSave): Promise<void> {
    await this.storage.setItem(
      this.key,
      JSON.stringify({ ...data, schemaVersion: LAYOUT_SCHEMA_VERSION })
    );
  }

  async reset(): Promise<void> {
    await this.storage.removeItem(this.key);
  }
}

function migrateLegacyBuilding(b: SavedBuilding & { kind: string }): SavedBuilding {
  if ((b.kind as string) === 'stairs') {
    return {
      ...b,
      kind: 'ladder',
      ladderFacing: b.ladderFacing ?? b.stairsFacing,
    };
  }
  return b;
}

function normalizeBuilding(b: SavedBuilding): SavedBuilding {
  const maxHp =
    typeof b.maxHp === 'number'
      ? b.maxHp
      : (BUILDING_MAX_HP[b.kind] ?? 30);
  const hp = typeof b.hp === 'number' ? b.hp : maxHp;
  return {
    ...b,
    hp,
    maxHp,
  };
}

function normalizeSubject(s: SavedSubject): SavedSubject {
  const maxHp =
    typeof s.maxHp === 'number' ? s.maxHp : (UNIT_MAX_HP[s.role] ?? 20);
  const hp = typeof s.hp === 'number' ? s.hp : maxHp;
  const body =
    s.body && VALID_BODIES.has(s.body) ? s.body : undefined;
  return {
    ...s,
    hp,
    maxHp,
    onWall: Boolean(s.onWall),
    hunger: typeof s.hunger === 'number' ? s.hunger : 0,
    sick: Boolean(s.sick),
    gender: s.gender === 'male' || s.gender === 'female' ? s.gender : undefined,
    temporaryPrincess: Boolean(s.temporaryPrincess),
    married: Boolean(s.married),
    happiness: typeof s.happiness === 'number' ? s.happiness : undefined,
    ageYears: typeof s.ageYears === 'number' ? s.ageYears : undefined,
    body,
    job: s.job,
    workplaceId: typeof s.workplaceId === 'string' ? s.workplaceId : undefined,
    spouseId: typeof s.spouseId === 'string' ? s.spouseId : undefined,
    motherId: typeof s.motherId === 'string' ? s.motherId : undefined,
    fatherId: typeof s.fatherId === 'string' ? s.fatherId : undefined,
    pregnant: s.pregnant === true ? true : undefined,
    pregnantDaysLeft:
      typeof s.pregnantDaysLeft === 'number' ? s.pregnantDaysLeft : undefined,
    thought: typeof s.thought === 'string' ? s.thought : undefined,
    backstory: typeof s.backstory === 'string' ? s.backstory : undefined,
    goal: s.goal ?? undefined,
    lifeLog: Array.isArray(s.lifeLog) ? s.lifeLog : undefined,
    curse: s.curse ?? undefined,
    cursedAsRole:
      s.cursedAsRole && VALID_UNIT_ROLES.has(s.cursedAsRole)
        ? s.cursedAsRole
        : undefined,
    lowHappyHours:
      typeof s.lowHappyHours === 'number' ? s.lowHappyHours : undefined,
    x: typeof s.x === 'number' ? s.x : undefined,
    y: typeof s.y === 'number' ? s.y : undefined,
    activity: s.activity,
    activityLabel:
      typeof s.activityLabel === 'string' ? s.activityLabel : undefined,
    zone: s.zone,
    interrupt: s.interrupt ?? undefined,
    campId: typeof s.campId === 'string' ? s.campId : undefined,
    allegiance: s.allegiance === 'camp' ? 'camp' : undefined,
    loyaltyKeepId: s.loyaltyKeepId ?? undefined,
    pendingChildHouseId:
      typeof s.pendingChildHouseId === 'string' ? s.pendingChildHouseId : undefined,
    appearanceVariant:
      typeof s.appearanceVariant === 'number' &&
      s.appearanceVariant >= 0 &&
      s.appearanceVariant <= 5
        ? (s.appearanceVariant as 0 | 1 | 2 | 3 | 4 | 5)
        : undefined,
    legendId: typeof s.legendId === 'string' ? s.legendId : undefined,
  };
}
