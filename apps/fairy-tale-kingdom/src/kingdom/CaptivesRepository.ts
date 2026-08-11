import { LocalStorageAdapter, type StoragePort } from '@knowledge-quest/storage';
import type { UnitRole } from '../game/art/assetManifest';

export const CAPTIVES_STORAGE_KEY = 'fairyTaleKingdom.captives';

export interface CaptiveRecord {
  id: string;
  name: string;
  role: UnitRole;
  houseId: string;
  maxHp: number;
}

export class CaptivesRepository {
  constructor(
    private readonly storage: StoragePort = new LocalStorageAdapter(),
    private readonly key: string = CAPTIVES_STORAGE_KEY
  ) {}

  loadSync(): CaptiveRecord[] {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as CaptiveRecord[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  saveSync(captives: CaptiveRecord[]): void {
    localStorage.setItem(this.key, JSON.stringify(captives));
  }

  async reset(): Promise<void> {
    await this.storage.removeItem(this.key);
  }
}
