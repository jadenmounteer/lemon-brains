import { LocalStorageAdapter, type StoragePort } from '@knowledge-quest/storage';
import type { UnitRole } from '../game/art/assetManifest';
import type { BuildKind } from '../marketplace/catalog';

export const LAYOUT_STORAGE_KEY = 'fairyTaleKingdom.layout';

export interface SavedBuilding {
  id: string;
  kind: BuildKind;
  x: number;
  y: number;
}

export interface SavedSubject {
  id: string;
  name: string;
  role: UnitRole;
  houseId: string;
}

export interface LayoutSave {
  subjects: SavedSubject[];
  buildings: SavedBuilding[];
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
      return parsed;
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
