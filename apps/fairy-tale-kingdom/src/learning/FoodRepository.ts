import { LocalStorageAdapter, type StoragePort } from '@knowledge-quest/storage';
import { EconomyBalance } from '../game/economy/economy';

export const FOOD_STORAGE_KEY = 'fairyTaleKingdom.food';

export class FoodRepository {
  constructor(
    _storage: StoragePort = new LocalStorageAdapter(),
    private readonly key: string = FOOD_STORAGE_KEY
  ) {}

  async load(): Promise<number> {
    return this.loadSync();
  }

  loadSync(): number {
    try {
      const raw = localStorage.getItem(this.key);
      if (raw == null) return EconomyBalance.starterFood;
      const n = Number.parseInt(raw, 10);
      if (!Number.isFinite(n) || n < 0) return EconomyBalance.starterFood;
      return Math.min(EconomyBalance.foodCap, n);
    } catch {
      return EconomyBalance.starterFood;
    }
  }

  async save(amount: number): Promise<void> {
    this.saveSync(amount);
  }

  saveSync(amount: number): void {
    const safe = Math.max(
      0,
      Math.min(EconomyBalance.foodCap, Math.floor(amount))
    );
    localStorage.setItem(this.key, String(safe));
  }

  async add(delta: number): Promise<number> {
    const next = Math.max(
      0,
      Math.min(EconomyBalance.foodCap, this.loadSync() + Math.floor(delta))
    );
    this.saveSync(next);
    return next;
  }

  addSync(delta: number): number {
    const next = Math.max(
      0,
      Math.min(EconomyBalance.foodCap, this.loadSync() + Math.floor(delta))
    );
    this.saveSync(next);
    return next;
  }

  /** Consume up to `amount`; returns how much was actually eaten. */
  consumeSync(amount: number): { eaten: number; left: number } {
    const current = this.loadSync();
    const need = Math.max(0, Math.floor(amount));
    const eaten = Math.min(current, need);
    const left = current - eaten;
    this.saveSync(left);
    return { eaten, left };
  }

  async reset(): Promise<void> {
    this.saveSync(EconomyBalance.starterFood);
  }
}
