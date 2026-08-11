import { LocalStorageAdapter, type StoragePort } from '@knowledge-quest/storage';

export const KINGDOM_STORAGE_KEY = 'fairyTaleKingdom.kingdom';

export interface KingdomSave {
  name: string;
  daysPlayed: number;
}

const DEFAULT_SAVE: KingdomSave = {
  name: '',
  daysPlayed: 0,
};

export class KingdomRepository {
  constructor(
    private readonly storage: StoragePort = new LocalStorageAdapter(),
    private readonly key: string = KINGDOM_STORAGE_KEY
  ) {}

  async load(): Promise<KingdomSave> {
    const raw = await this.storage.getItem(this.key);
    if (!raw) return { ...DEFAULT_SAVE };
    try {
      const parsed = JSON.parse(raw) as Partial<KingdomSave>;
      return {
        name: typeof parsed.name === 'string' ? parsed.name.trim() : '',
        daysPlayed:
          typeof parsed.daysPlayed === 'number' && parsed.daysPlayed >= 0
            ? Math.floor(parsed.daysPlayed)
            : 0,
      };
    } catch {
      return { ...DEFAULT_SAVE };
    }
  }

  async save(data: KingdomSave): Promise<void> {
    const next: KingdomSave = {
      name: data.name.trim(),
      daysPlayed: Math.max(0, Math.floor(data.daysPlayed)),
    };
    await this.storage.setItem(this.key, JSON.stringify(next));
  }

  async startNew(name: string): Promise<KingdomSave> {
    const next: KingdomSave = { name: name.trim(), daysPlayed: 0 };
    await this.save(next);
    return next;
  }

  async incrementDays(by = 1): Promise<KingdomSave> {
    const current = await this.load();
    if (!current.name) return current;
    const next = {
      ...current,
      daysPlayed: current.daysPlayed + Math.max(1, Math.floor(by)),
    };
    await this.save(next);
    return next;
  }
}
