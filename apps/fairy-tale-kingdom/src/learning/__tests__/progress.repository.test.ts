import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROGRESS,
  ProgressRepository,
  type ProgressSave,
} from '@knowledge-quest/storage';

class MemoryStorage {
  private data = new Map<string, string>();
  async getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  async setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  async removeItem(key: string) {
    this.data.delete(key);
  }
}

describe('ProgressRepository', () => {
  it('starts from defaults when empty', async () => {
    const repo = new ProgressRepository(new MemoryStorage());
    const loaded = await repo.load();
    expect(loaded).toEqual(DEFAULT_PROGRESS);
  });

  it('increments streak on correct answers', () => {
    const repo = new ProgressRepository(new MemoryStorage());
    let state: ProgressSave = { ...DEFAULT_PROGRESS };
    state = repo.recordAnswer(state, true);
    expect(state.currentStreak).toBe(1);
    expect(state.questionsCorrect).toBe(1);
    state = repo.recordAnswer(state, true);
    expect(state.currentStreak).toBe(2);
    expect(state.bestStreak).toBe(2);
  });

  it('resets streak on wrong answer', () => {
    const repo = new ProgressRepository(new MemoryStorage());
    const state: ProgressSave = {
      currentStreak: 4,
      bestStreak: 4,
      questionsAnswered: 4,
      questionsCorrect: 4,
    };
    const next = repo.recordAnswer(state, false);
    expect(next.currentStreak).toBe(0);
    expect(next.bestStreak).toBe(4);
    expect(next.questionsAnswered).toBe(5);
  });

  it('emits streak milestone at 3', () => {
    const repo = new ProgressRepository(new MemoryStorage());
    const state: ProgressSave = {
      ...DEFAULT_PROGRESS,
      currentStreak: 2,
      bestStreak: 2,
      questionsAnswered: 2,
      questionsCorrect: 2,
    };
    const next = repo.recordAnswer(state, true);
    expect(next.streakMilestone).toBe(3);
  });

  it('persists via recordAndSave', async () => {
    const storage = new MemoryStorage();
    const repo = new ProgressRepository(storage);
    await repo.recordAndSave(true);
    const loaded = await repo.load();
    expect(loaded.questionsCorrect).toBe(1);
    expect(loaded.currentStreak).toBe(1);
  });
});
