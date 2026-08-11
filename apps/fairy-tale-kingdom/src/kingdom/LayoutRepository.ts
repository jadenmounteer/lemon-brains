import { LocalStorageAdapter, type StoragePort } from '@knowledge-quest/storage';
import type { UnitRole } from '../game/art/assetManifest';
import { BUILDING_MAX_HP, UNIT_MAX_HP } from '../game/combat/stats';
import { BUILD_CATALOG, type BuildKind } from '../marketplace/catalog';

export const LAYOUT_STORAGE_KEY = 'fairyTaleKingdom.layout';

const VALID_BUILD_KINDS = new Set<string>(BUILD_CATALOG.map((c) => c.kind));

export interface SavedBuilding {
  id: string;
  kind: BuildKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  /** Stairs only — wall they snap to */
  attachedWallId?: string;
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
}

export interface LayoutSave {
  subjects: SavedSubject[];
  buildings: SavedBuilding[];
  keepHp?: number;
  keepMaxHp?: number;
  princeSpawnMs?: number;
  fgmCooldownMs?: number;
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
      if (!Array.isArray(parsed.subjects) || !Array.isArray(parsed.buildings)) {
        return null;
      }
      return {
        ...parsed,
        buildings: parsed.buildings
          .filter((b) => VALID_BUILD_KINDS.has(b.kind))
          .map(normalizeBuilding),
        subjects: parsed.subjects.map(normalizeSubject),
      };
    } catch {
      return null;
    }
  }

  async save(data: LayoutSave): Promise<void> {
    await this.storage.setItem(this.key, JSON.stringify(data));
  }

  async reset(): Promise<void> {
    await this.storage.removeItem(this.key);
  }
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
  return {
    ...s,
    hp,
    maxHp,
    onWall: Boolean(s.onWall),
    hunger: typeof s.hunger === 'number' ? s.hunger : 0,
    sick: Boolean(s.sick),
  };
}
