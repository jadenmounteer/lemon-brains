import { LocalStorageAdapter, type StoragePort } from '@knowledge-quest/storage';

export const GOLD_STORAGE_KEY = 'fairyTaleKingdom.gold';
export const GOLD_PER_CORRECT = 10;

export class GoldRepository {
  constructor(
    private readonly storage: StoragePort = new LocalStorageAdapter(),
    private readonly key: string = GOLD_STORAGE_KEY
  ) {}

  async load(): Promise<number> {
    const raw = await this.storage.getItem(this.key);
    if (raw == null) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  async save(amount: number): Promise<void> {
    const safe = Math.max(0, Math.floor(amount));
    await this.storage.setItem(this.key, String(safe));
  }

  async add(delta: number): Promise<number> {
    const current = await this.load();
    const next = Math.max(0, current + Math.floor(delta));
    await this.save(next);
    return next;
  }

  async reset(): Promise<void> {
    await this.save(0);
  }

  /** Spend gold if funds allow. Returns false when too poor. */
  async spend(amount: number): Promise<boolean> {
    const cost = Math.max(0, Math.floor(amount));
    const current = await this.load();
    if (current < cost) return false;
    await this.save(current - cost);
    return true;
  }
}
